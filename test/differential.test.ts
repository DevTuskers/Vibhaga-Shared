/**
 * THE EQUIVALENCE PROOF. Every fixture and every generated mutant is run through BOTH the
 * hand-rolled parser (`src/vdd-schema/parse.ts`) and the test oracle — the byte-verbatim
 * copy of Admin's zod schema (`test/oracle/admin-vdd-zod.ts`, zod 4.4.3). For every input:
 *
 *   1. accept/reject parity:               `result.ok === oracle.success`
 *   2. on success, value equality:         `deepStrictEqual(result.value, oracle.data)`
 *      (unknown keys stripped at every level, `meta` kept as-is, new object not the input)
 *   3. on failure, path-MULTISET equality: the issue paths match as a multiset — same
 *      paths AND same counts per path (catches zod's one-issue-per-field rules).
 *      Symbol segments are normalized with `String(sym)` on both sides (VddIssue.path
 *      is `(string|number)[]`; zod's real path carries the symbol — see parse.ts `rec`).
 *   4. non-mutation:                       the input is byte-identical after parsing
 *
 * All four must hold for 100% of cases. The suite is deterministic — no randomness at all.
 */

import { describe, expect, it } from "vitest";

declare const console: { info(...args: unknown[]): void };

import { VddDocument as OracleDocument, VddElement as OracleElement } from "./oracle/admin-vdd-zod.js";
import {
  parseVddDocument,
  parseVddElement,
  type VddResult,
} from "../src/vdd-schema/index.js";
import { GOLDEN_FIXTURES } from "./fixtures/golden.js";
import { ELEMENT_EXEMPLARS, SEED_DOCS } from "./fixtures/corpus.js";
import { VDD_FIELD_VECTORS } from "./fixtures/vddFieldVectors.js";

/* ── mismatch reporting ─────────────────────────────────────────────────────── */

type Mismatch = {
  label: string;
  kind: "verdict" | "value" | "paths" | "mutated";
  detail: string;
};

const mismatches: Mismatch[] = [];
const counts = { doc: 0, element: 0, accepted: 0, rejected: 0 };

/**
 * Snapshot for dedup keys and the non-mutation check. Plain `JSON.stringify` throws
 * on bigint and mangles symbols/functions — corpus entries now include all three —
 * so they're rendered explicitly instead.
 */
const snap = (v: unknown): string => {
  try {
    return (
      JSON.stringify(v, (_k, x) =>
        typeof x === "bigint"
          ? `bigint:${x.toString()}`
          : typeof x === "symbol"
            ? String(x)
            : typeof x === "function"
              ? "<fn>"
              : x) ?? "<undefined>"
    );
  } catch {
    return "<unstringifiable>";
  }
};

/**
 * Multiset of issue paths, JSON-encoded and sorted. Symbol path segments (which zod
 * emits verbatim inside `meta` record failures) are normalized to `String(sym)` so
 * they compare against the parser's documented `String(sym)` emission.
 */
const pathMultiset = (issues: readonly { path: readonly PropertyKey[] }[]): string[] =>
  issues
    .map((i) => JSON.stringify(i.path.map((s) => (typeof s === "symbol" ? String(s) : s))))
    .sort();

type OracleOut = {
  success: boolean;
  data?: unknown;
  error?: { issues: readonly { path: readonly PropertyKey[] }[] };
};

function compare<T>(
  label: string,
  mine: VddResult<T>,
  oracle: OracleOut | "THREW",
  inputSnapshot: string,
  raw: unknown,
): void {
  if (snap(raw) !== inputSnapshot) {
    mismatches.push({ label, kind: "mutated", detail: "input changed by parsing" });
  }
  if (oracle === "THREW") {
    // The ONE deliberate divergence (README/AGENTS): zod's coerced `length >= min`
    // throws TypeError on a Symbol `.length`. A parser on a request path must never
    // throw — the contract is "oracle threw ⇒ the parser still rejects".
    if (mine.ok) {
      mismatches.push({
        label,
        kind: "verdict",
        detail: `oracle threw; parser must still reject input=${inputSnapshot.slice(0, 300)}`,
      });
    }
    return;
  }
  if (mine.ok !== oracle.success) {
    mismatches.push({
      label,
      kind: "verdict",
      detail: `mine.ok=${mine.ok} oracle.success=${oracle.success} input=${inputSnapshot.slice(0, 400)}`,
    });
    return;
  }
  if (mine.ok) {
    try {
      expect(mine.value).toStrictEqual(oracle.data);
    } catch (err) {
      mismatches.push({
        label,
        kind: "value",
        detail: `${(err as Error).message.slice(0, 600)} input=${inputSnapshot.slice(0, 300)}`,
      });
    }
  } else {
    const mp = pathMultiset(mine.errors);
    const op = pathMultiset(oracle.error!.issues);
    if (JSON.stringify(mp) !== JSON.stringify(op)) {
      mismatches.push({
        label,
        kind: "paths",
        detail: `mine=${JSON.stringify(mp)} oracle=${JSON.stringify(op)} input=${inputSnapshot.slice(0, 300)}`,
      });
    }
  }
}

function checkDoc(raw: unknown, label: string): void {
  counts.doc++;
  const before = snap(raw);
  let mine: ReturnType<typeof parseVddDocument>;
  try {
    mine = parseVddDocument(raw);
  } catch (err) {
    // The parser must never throw on a request path — a throw is a mismatch
    // regardless of what the oracle does.
    mismatches.push({ label, kind: "verdict", detail: `PARSER THREW: ${String(err).slice(0, 200)}` });
    return;
  }
  let oracle: OracleOut | "THREW";
  try {
    oracle = OracleDocument.safeParse(raw) as OracleOut;
  } catch {
    oracle = "THREW";
  }
  (mine.ok ? counts.accepted++ : counts.rejected++);
  compare(label, mine, oracle, before, raw);
}

function checkElement(raw: unknown, label: string): void {
  counts.element++;
  const before = snap(raw);
  let mine: ReturnType<typeof parseVddElement>;
  try {
    mine = parseVddElement(raw);
  } catch (err) {
    mismatches.push({ label, kind: "verdict", detail: `PARSER THREW: ${String(err).slice(0, 200)}` });
    return;
  }
  let oracle: OracleOut | "THREW";
  try {
    oracle = OracleElement.safeParse(raw) as OracleOut;
  } catch {
    oracle = "THREW";
  }
  compare(label, mine, oracle, before, raw);
}

/** Element mutant inside a minimal valid doc, so document paths are exercised too. */
const wrap = (el: unknown): Record<string, unknown> => ({
  schema: "vibhaga.diagram",
  schemaVersion: 1,
  canvas: { width: 400, height: 300 },
  elements: [el],
});

/* ── immutable path helpers (mutant construction never shares structure edits) ── */

const setPath = (obj: any, path: readonly (string | number)[], val: unknown): any => {
  if (path.length === 0) return val;
  const [head, ...rest] = path;
  const src = obj !== null && typeof obj === "object" ? obj : {};
  const copy: any = Array.isArray(src) ? src.slice() : { ...src };
  copy[head] = setPath(src[head], rest, val);
  return copy;
};

const delPath = (obj: any, path: readonly (string | number)[]): any => {
  const [head, ...rest] = path;
  const src = obj !== null && typeof obj === "object" ? obj : {};
  const copy: any = Array.isArray(src) ? src.slice() : { ...src };
  if (rest.length === 0) {
    if (Array.isArray(copy)) copy.splice(Number(head), 1);
    else delete copy[head];
  } else {
    copy[head] = delPath(src[head], rest);
  }
  return copy;
};

/* ── document corpus ────────────────────────────────────────────────────────── */

const seenDoc = new Set<string>();
const docCases: [string, unknown][] = [];
const addDoc = (label: string, doc: unknown): void => {
  const key = snap(doc);
  if (seenDoc.has(key)) return;
  seenDoc.add(key);
  docCases.push([label, doc]);
};

/* ── element corpus + mutants ───────────────────────────────────────────────── */

const seenEl = new Set<string>();
const elCases: [string, unknown][] = [];
const addEl = (label: string, el: unknown): void => {
  const key = snap(el);
  if (seenEl.has(key)) return;
  seenEl.add(key);
  elCases.push([label, el]);
};

const WRONG_TYPES: unknown[] = ["x", 42, true, null, [], {}, undefined, () => 0];
const NUMERIC_BAD: unknown[] = [NaN, Infinity, -Infinity, -1, 0.5, 2 ** 53];

/** Domain-specific bad (and a few boundary-good) values per element type + field. */
const FIELD_EXTRA: Record<string, Record<string, unknown[]>> = {
  "*": {
    id: ["", 5, null],
    type: ["bogus", "RECT", 5, null],
    z: [1.5, 2 ** 53, -0.5],
    rotation: [NaN, Infinity, "10"],
    opacity: [2, -0.1, NaN, "0.5"],
    groupId: [5, null],
    stroke: ["x", 5, [], null],
    fill: [null, [], "red"],
    link: ["x", { refType: 5 }, { refId: null }, []],
  },
  rect: { rx: [NaN, -1], x: [NaN], y: [Infinity] },
  circle: { r: [-1, NaN, 0], center: [[0], [0, 0, 0], ["x", 0], [0, NaN], "x"] },
  ellipse: { rx: [-1], ry: [-1, NaN] },
  line: { points: [[], [[0, 0]], [[0, 0], [1, 1], [2, 2]], [["x", 0], [1, 1]], [[0], [1, 1]]] },
  polyline: { points: [[], [[0, 0]], [[0, 0], ["x", 0]], [[0, 0], [1]]] },
  polygon: { points: [[], [[0, 0]], [[0, 0], [1, 1]], [[0, 0], [1, "x"], [2, 2]]] },
  arrow: {
    head: ["bogus", 5, "END"],
    headSize: [NaN, -3],
    points: [[], [[0, 0]], [[0, 0], [1, "x"]]],
  },
  point: {
    at: [[0], [0, 0, 0], ["x", 0], [NaN, 0]],
    r: [NaN, -1],
    label: [5],
    labelOffset: [[0], [0, 0, 0], ["x", 0]],
  },
  arc: { r: [-1], start: [NaN], end: [Infinity], sweep: ["bogus", 5, "CW"] },
  path: {
    d: [
      "M 0 0 X 5",
      "M0T5",
      "M0 0 L1 1 R2 2",
      "m 0 0 l 5 5", // relative commands are NOT in the whitelist
      "M 0 0 ↔ L 1 1",
      42,
      null,
      "",
    ],
  },
  angleMark: {
    arcs: [0, -2, 1.5, 2 ** 53],
    variant: ["bogus", 5],
    reflex: ["yes", 1, 0],
    r: [-1, 0],
    vertex: [[0], ["x", 0]],
    from: [[0, 0, 0]],
    to: [[NaN, 0]],
  },
  tickMark: {
    count: [0, -1, 1.5],
    at: [1.1, -0.1, NaN],
    size: [NaN],
    on: [[], [[0, 0]], [[0, 0], [1, 1], [2, 2]], [[0], [1, 1]]],
  },
  parallelMark: {
    count: [0, -1, 1.5],
    at: [1.1, -0.1],
    on: [[], [[0, 0]]],
  },
  text: {
    fontFamily: ["Comic Sans", 5, "SANS"],
    align: ["bogus", 5],
    baseline: ["bogus", "middle "],
    fontSize: [NaN, -4],
    color: [5, null],
    value: [5, null],
    at: [["x", 0], [0], [0, 0, 0]],
  },
  math: {
    align: ["bogus"],
    baseline: ["bogus"],
    fontSize: [NaN],
    color: [5],
    latex: [5, null],
    at: [[NaN, 0]],
  },
};

function elementMutants(el: Record<string, unknown>, label: string): void {
  const type = typeof el.type === "string" ? el.type : "";
  const extras = { ...FIELD_EXTRA["*"], ...(FIELD_EXTRA[type] ?? {}) };

  for (const key of Object.keys(el)) {
    addEl(`${label}:del ${key}`, delPath(el, [key]));
    for (const [i, v] of WRONG_TYPES.entries()) {
      addEl(`${label}:${key}=wrong#${i}`, setPath(el, [key], v));
    }
    const value = el[key];
    if (typeof value === "number") {
      for (const [i, v] of NUMERIC_BAD.entries()) {
        addEl(`${label}:${key}=num#${i}`, setPath(el, [key], v));
      }
    }
    if (Array.isArray(value)) {
      if (value.every((p) => typeof p === "number")) {
        // a point tuple
        addEl(`${label}:${key} short`, setPath(el, [key], value.slice(0, -1)));
        addEl(`${label}:${key} long`, setPath(el, [key], [...value, 0]));
        addEl(`${label}:${key} stritem`, setPath(el, [key], ["x", 0]));
        addEl(`${label}:${key} nanitem`, setPath(el, [key], [NaN, 0]));
      } else if (value.every((p) => Array.isArray(p))) {
        // a point list
        addEl(`${label}:${key} empty`, setPath(el, [key], []));
        addEl(`${label}:${key} one`, setPath(el, [key], value.slice(0, 1)));
        addEl(`${label}:${key} baditem`, setPath(el, [key], [...value.slice(0, -1), "x"]));
        addEl(`${label}:${key} badinner`, setPath(el, [key], [...value.slice(0, -1), [1]]));
      }
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const sub of Object.keys(value as Record<string, unknown>)) {
        addEl(`${label}:${key}.${sub} del`, delPath(el, [key, sub]));
        addEl(`${label}:${key}.${sub} str`, setPath(el, [key, sub], "x"));
        addEl(`${label}:${key}.${sub} num`, setPath(el, [key, sub], 42));
        addEl(`${label}:${key}.${sub} null`, setPath(el, [key, sub], null));
        addEl(`${label}:${key}.${sub} junk`, setPath(el, [key, sub], { junk: 1 }));
      }
      addEl(`${label}:${key} junkkey`, setPath(el, [key], { ...(value as object), junk: 1 }));
    }
    for (const [i, v] of (extras[key] ?? []).entries()) {
      addEl(`${label}:${key}=extra#${i}`, setPath(el, [key], v));
    }
  }
  addEl(`${label}:+unknown`, { ...el, unknownExtra: { deep: [1] } });
  addEl(`${label}:nonobj`, "not-an-element");
  addEl(`${label}:arr`, [1, 2]);
  // composed: several fields wrong at once — issue aggregation across fields
  const keys = Object.keys(el);
  if (keys.length >= 3) {
    addEl(
      `${label}:multi-bad`,
      setPath(setPath(setPath(el, [keys[1]!], "x"), [keys[2]!], NaN), [keys[3] ?? keys[0]!], null),
    );
  }
  addEl(`${label}:no-type-no-id`, delPath(delPath(el, ["type"]), ["id"]));
}

/* ── document mutants ───────────────────────────────────────────────────────── */

function docMutants(doc: Record<string, unknown>, label: string): void {
  for (const key of Object.keys(doc)) {
    addDoc(`${label}:del ${key}`, delPath(doc, [key]));
    for (const [i, v] of WRONG_TYPES.entries()) {
      addDoc(`${label}:${key}=wrong#${i}`, setPath(doc, [key], v));
    }
    const value = doc[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const sub of Object.keys(value as Record<string, unknown>)) {
        addDoc(`${label}:${key}.${sub} del`, delPath(doc, [key, sub]));
        addDoc(`${label}:${key}.${sub} str`, setPath(doc, [key, sub], "x"));
        addDoc(`${label}:${key}.${sub} num`, setPath(doc, [key, sub], 42));
        addDoc(`${label}:${key}.${sub} null`, setPath(doc, [key, sub], null));
      }
      addDoc(`${label}:${key} junkkey`, setPath(doc, [key], { ...(value as object), junk: 1 }));
    }
  }
  addDoc(`${label}:+unknown`, { ...doc, extraTop: { a: 1 } });
  addDoc(`${label}:schemaVersion=1.5`, setPath(doc, ["schemaVersion"], 1.5));
  addDoc(`${label}:schemaVersion="1"`, setPath(doc, ["schemaVersion"], "1"));
  addDoc(`${label}:schemaVersion=NaN`, setPath(doc, ["schemaVersion"], NaN));
  addDoc(`${label}:schemaVersion=2^53`, setPath(doc, ["schemaVersion"], 2 ** 53));
  addDoc(`${label}:canvas.width=0`, setPath(doc, ["canvas", "width"], 0));
  addDoc(`${label}:canvas.width=-1`, setPath(doc, ["canvas", "width"], -1));
  addDoc(`${label}:canvas.width=NaN`, setPath(doc, ["canvas", "width"], NaN));
  addDoc(`${label}:canvas.height=0`, setPath(doc, ["canvas", "height"], 0));
  addDoc(`${label}:canvas.bg=42`, setPath(doc, ["canvas", "background"], 42));
  addDoc(`${label}:defaults.fontFamily=Comic Sans`, setPath(doc, ["defaults", "fontFamily"], "Comic Sans"));
  addDoc(`${label}:defaults.strokeStyle=bogus`, setPath(doc, ["defaults", "strokeStyle"], "bogus"));
  addDoc(`${label}:defaults.opacity=2`, setPath(doc, ["defaults", "opacity"], 2));
  addDoc(`${label}:defaults.opacity=-0.5`, setPath(doc, ["defaults", "opacity"], -0.5));
  addDoc(`${label}:meta=string`, setPath(doc, ["meta"], "x"));
  addDoc(`${label}:meta=array`, setPath(doc, ["meta"], []));
  addDoc(`${label}:meta=Date`, setPath(doc, ["meta"], new Date(0)));
  addDoc(`${label}:meta=undefkey`, setPath(doc, ["meta"], { a: undefined }));
  // `__proto__` as an own data property — reachable only via JSON.parse, never a literal.
  addDoc(`${label}:meta=protokey`, setPath(doc, ["meta"], JSON.parse('{"__proto__":{"x":1}}')));
  addDoc(`${label}:schemaVersion=-1`, setPath(doc, ["schemaVersion"], -1));
  addDoc(`${label}:schemaVersion=0`, setPath(doc, ["schemaVersion"], 0));
  addDoc(`${label}:schemaVersion=MAX_SAFE`, setPath(doc, ["schemaVersion"], Number.MAX_SAFE_INTEGER));
  addDoc(
    `${label}:elements=[multi-bad]`,
    setPath(doc, ["elements"], [{ id: "a" }, { type: "bogus" }, { id: "e", type: "circle", center: [0, 0], r: 1 }]),
  );
  addDoc(`${label}:a11y=string`, setPath(doc, ["a11y"], "x"));
  addDoc(`${label}:a11y.title=42`, setPath(doc, ["a11y", "title"], 42));
  addDoc(`${label}:elements=obj`, setPath(doc, ["elements"], {}));
  addDoc(`${label}:elements=[5]`, setPath(doc, ["elements"], [5]));
  addDoc(`${label}:elements=[null]`, setPath(doc, ["elements"], [null]));
  addDoc(`${label}:elements=[[]]`, setPath(doc, ["elements"], [[]]));
  addDoc(`${label}:elements=[{}]`, setPath(doc, ["elements"], [{}]));
  addDoc(`${label}:elements=[bogus-type]`, setPath(doc, ["elements"], [{ id: "e", type: "bogus" }]));
  addDoc(`${label}:elements=[type=5]`, setPath(doc, ["elements"], [{ id: "e", type: 5 }]));
  addDoc(`${label}:elements=[undef]`, setPath(doc, ["elements"], [undefined]));
}

/* ── the suite ──────────────────────────────────────────────────────────────── */

describe("differential: package parser vs Admin zod oracle", () => {
  it("verdict, output value, error-path set and non-mutation agree on every case", () => {
    // seeds: every fixture document
    for (const [name, doc] of Object.entries(GOLDEN_FIXTURES)) {
      addDoc(`golden:${name}`, doc);
      docMutants(doc as unknown as Record<string, unknown>, `golden:${name}`);
      for (const [i, el] of (doc.elements as unknown[]).entries()) {
        if (el !== null && typeof el === "object" && !Array.isArray(el)) {
          addEl(`golden:${name} el[${i}]`, el);
          elementMutants(el as Record<string, unknown>, `golden:${name} el[${i}]`);
        }
      }
    }
    for (const [name, doc] of SEED_DOCS) {
      addDoc(`seed:${name}`, doc);
      docMutants(doc, `seed:${name}`);
      const els = doc.elements;
      if (Array.isArray(els)) {
        for (const [i, el] of els.entries()) {
          if (el !== null && typeof el === "object" && !Array.isArray(el)) {
            addEl(`seed:${name} el[${i}]`, el);
            elementMutants(el as Record<string, unknown>, `seed:${name} el[${i}]`);
          }
        }
      }
    }
    for (const [i, v] of VDD_FIELD_VECTORS.entries()) {
      for (const [tag, doc] of [
        ["doc", v.doc],
        ["base", v.base],
      ] as const) {
        if (!doc) continue;
        addDoc(`vector[${i}]:${v.note}:${tag}`, doc);
        docMutants(doc as unknown as Record<string, unknown>, `vector[${i}]:${tag}`);
      }
    }
    for (const [i, el] of ELEMENT_EXEMPLARS.entries()) {
      addEl(`exemplar[${i}]`, el);
      elementMutants(el as Record<string, unknown>, `exemplar[${i}]`);
    }
    // non-document top-level shapes
    for (const [i, v] of [null, undefined, 42, "x", true, [], new Date(0), () => 0, Object.create(null)].entries()) {
      addDoc(`toplevel#${i}`, v);
      addEl(`toplevel#${i}`, v);
    }

    /* ── critique R1 case classes (F5) ─────────────────────────────────────────
     * The classes the committed generator used to miss, found by the independent
     * probe: `in`-semantics field presence, asymmetric tuple item validation,
     * record symbol keys, int() type-level short-circuit. Deterministic only —
     * stateful getters/Proxies are excluded (each impl would see a different read). */

    // F1: `in`-semantics — fields supplied by prototype, getter, or Proxy `has` trap
    addDoc("r1:doc-fields-on-proto", Object.assign(
      Object.create({ schema: "vibhaga.diagram", schemaVersion: 1 }),
      { canvas: { width: 1, height: 1 }, elements: [] },
    ));
    addEl("r1:el-fields-on-proto", Object.assign(
      Object.create({ id: "e", type: "circle" }),
      { center: [0, 0], r: 1 },
    ));
    addDoc("r1:proto-wrong-type-field", Object.assign(
      Object.create({ schema: "vibhaga.diagram", schemaVersion: "one" }),
      { canvas: { width: 1, height: 1 }, elements: [] },
    ));
    class ClassEl { id = "e"; type = "rect"; x = 1; y = 2; width = 3; height = 4; }
    class GetterEl { id = "e"; get type() { return "circle" as const; } get center() { return [0, 0]; } get r() { return 1; } }
    addDoc("r1:class-instance-element", wrap(new ClassEl()));
    addEl("r1:getter-fields-element", new GetterEl());
    addDoc("r1:proxy-passthrough", new Proxy({
      schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1, height: 1 }, elements: [],
    }, {}));
    addDoc("r1:proxy-has-hides-canvas", new Proxy({
      schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1, height: 1 }, elements: [],
    }, { has: (t, p) => (p === "canvas" ? false : Reflect.has(t, p)) }));
    addDoc("r1:proto-getter-canvas", {
      schema: "vibhaga.diagram", schemaVersion: 1, elements: [],
      get canvas() { return { width: 1, height: 1 }; },
    });

    // F2: tuple length × item errors (asymmetric zod semantics)
    addEl("r2:line.points-long-baditem", { id: "e", type: "line", points: [["x", 0], [1, 1], [2, 2]] });
    addEl("r2:line.points-long-okitems", { id: "e", type: "line", points: [[0, 0], [1, 1], [2, 2]] });
    addEl("r2:line.points-short-baditem", { id: "e", type: "line", points: [["x", 0]] });
    addEl("r2:line.points-short-okitem", { id: "e", type: "line", points: [[0, 0]] });
    addEl("r2:tickmark.on-long-baditem", { id: "e", type: "tickMark", on: [[0, 0], ["x", 1], [2, 2]] });
    addEl("r2:tickmark.on-short", { id: "e", type: "tickMark", on: [[0, 0]] });
    addEl("r2:point.at-long-baditem", { id: "e", type: "point", at: ["x", 0, 5] });
    addEl("r2:point.at-short", { id: "e", type: "point", at: [0] });
    addEl("r2:point.at-empty", { id: "e", type: "point", at: [] });
    addDoc("r2:wrapped-tuple-mutants", wrap({ id: "e", type: "line", points: [["x", 0], [1, 1], [2, 2]] }));

    // F3: enumerable symbol keys — inside `meta` (record → reject) vs unknown doc/element keys (stripped → accept)
    const symKey = Symbol("critique");
    addDoc("r3:meta-symbol-key", {
      schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1, height: 1 },
      elements: [], meta: { [symKey]: 1, a: 2 },
    });
    addDoc("r3:doc-symbol-unknown-key", {
      schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1, height: 1 },
      elements: [], [symKey]: 1,
    } as Record<string, unknown>);
    addEl("r3:element-symbol-unknown-key", { id: "e", type: "circle", center: [0, 0], r: 1, [symKey]: 9 } as unknown as Record<string, unknown>);
    {
      const nonEnum = { a: 1 };
      Object.defineProperty(nonEnum, Symbol("hidden"), { value: 1, enumerable: false });
      addDoc("r3:meta-nonenum-symbol", {
        schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1, height: 1 },
        elements: [], meta: nonEnum,
      });
    }

    // F4: int() is type-level — int failure emits ONE issue (min/max skipped)
    addEl("r4:angleMark.arcs=0.3", { id: "e", type: "angleMark", vertex: [0, 0], from: [1, 0], to: [0, 1], r: 5, arcs: 0.3 });
    addEl("r4:angleMark.arcs=5e-324", { id: "e", type: "angleMark", vertex: [0, 0], from: [1, 0], to: [0, 1], r: 5, arcs: 5e-324 });
    addEl("r4:angleMark.arcs=0.30000000000000004", { id: "e", type: "angleMark", vertex: [0, 0], from: [1, 0], to: [0, 1], r: 5, arcs: 0.1 + 0.2 });
    addEl("r4:tickMark.count=0.5", { id: "e", type: "tickMark", on: [[0, 0], [1, 1]], count: 0.5 });
    addDoc("r4:schemaVersion=0.5", { schema: "vibhaga.diagram", schemaVersion: 0.5, canvas: { width: 1, height: 1 }, elements: [] });

    // nested multi-fault — issue aggregation across several fields/levels
    addDoc("r5:nested-multi-fault", {
      schema: "vibhaga.diagram",
      schemaVersion: 1.5,
      canvas: { width: -1, height: "x" },
      defaults: { opacity: 9, fontFamily: "Comic Sans" },
      elements: [
        { id: "a", type: "rect", x: 0, y: 0, width: "w", height: 5, stroke: { width: "wide", style: "bogus" } },
        { type: "bogus" },
      ],
      a11y: { title: 42 },
    });

    // sparse arrays / holes
    addDoc("r5:elements-sparse-Array(3)", { schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1, height: 1 }, elements: new Array(3) });
    addDoc("r5:elements-hole", { schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1, height: 1 }, elements: [{ id: "a", type: "circle", center: [0, 0], r: 1 }, , { id: "b", type: "circle", center: [0, 0], r: 1 }] });
    addEl("r5:points-hole", { id: "e", type: "line", points: [[0, 0], ,] });

    // null-prototype objects
    addDoc("r5:nullproto-doc", Object.assign(Object.create(null), {
      schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1, height: 1 }, elements: [],
    }));
    addDoc("r5:nullproto-meta", {
      schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1, height: 1 },
      elements: [], meta: Object.assign(Object.create(null), { a: 1 }),
    });
    addEl("r5:nullproto-element", Object.assign(Object.create(null), { id: "e", type: "circle", center: [0, 0], r: 1 }));

    // numeric boundaries in int/number slots (the committed NUMERIC_BAD covers most;
    // these pin the specific boundary values called out in the critique)
    for (const [tag, v] of [["-0", -0], ["1e308", 1e308], ["5e-324", 5e-324], ["MSI", Number.MAX_SAFE_INTEGER], ["MSI+1", Number.MAX_SAFE_INTEGER + 1], ["MIN-SAFE-1", Number.MIN_SAFE_INTEGER - 1]] as const) {
      addDoc(`r5:schemaVersion=${tag}`, { schema: "vibhaga.diagram", schemaVersion: v, canvas: { width: 1, height: 1 }, elements: [] });
      addEl(`r5:z=${tag}`, { id: "e", type: "circle", center: [0, 0], r: 1, z: v });
    }
    addDoc("r5:canvas-extreme-floats", { schema: "vibhaga.diagram", schemaVersion: 1, canvas: { width: 1e308, height: 5e-324 }, elements: [] });
    addEl("r5:duplicate-points", { id: "e", type: "polygon", points: [[1, 1], [1, 1], [1, 1]] });

    // frozen inputs — parse must not mutate and must not throw
    {
      const freeze = (o: unknown): unknown => {
        if (o && typeof o === "object") {
          for (const v of Object.values(o)) freeze(v);
          Object.freeze(o);
        }
        return o;
      };
      addDoc("r5:deep-frozen-doc", freeze({
        schema: "vibhaga.diagram", schemaVersion: 1,
        canvas: { width: 10, height: 10 },
        elements: [{ id: "e", type: "circle", center: [0, 0], r: 1, junk: 1 }],
      }));
    }

    /* ── critique R2 case classes (F7–F9) ─────────────────────────────────────
     * Ported from wt/shared-vdd/critique/minimal-repros-r2.mts: the sizable-gated
     * min_length check is `when`-gated on `length !== undefined` (NOT typeof) with
     * the coerced `length >= min` comparison; record inputs use zod's constructor-
     * chain isPlainObject heuristic; each enumerable symbol key is its own issue.
     * Proto/delegate/ctor cases push directly — a JSON dedup key cannot tell a
     * delegate proto from a literal and would silently drop them. */

    // F7: non-number `.length` on min-gated slots — id (minLen 1), points (min 2/3)
    for (const [tag, len] of [
      ["str", "abc"], ["str-num", "0"], ["null", null], ["false", false], ["true", true],
      ["bigint0", 0n], ["bigint2", 2n], ["nan", NaN], ["empty-arr", []], ["arr9", [9]],
      ["obj", {}], ["undef", undefined],
    ] as const) {
      addEl(`r6:id.length=${tag}`, { id: { length: len }, type: "circle", center: [0, 0], r: 1 });
    }
    // the documented divergence: Symbol `.length` makes the ORACLE throw; the
    // parser must still reject (compare() special-cases "oracle threw ⇒ ok:false")
    addEl("r6:id.length=Symbol", { id: { length: Symbol("L") }, type: "circle", center: [0, 0], r: 1 });
    for (const [tag, len] of [
      ["str", "abc"], ["str-1", "1"], ["null", null], ["false", false],
      ["bigint1", 1n], ["nan", NaN], ["empty-arr", []], ["arr5", [5]],
    ] as const) {
      addEl(`r6:polyline.points.length=${tag}`, { id: "e", type: "polyline", points: { length: len } });
      addEl(`r6:polygon.points.length=${tag}`, { id: "e", type: "polygon", points: { length: len } });
    }
    // inherited / getter `.length` — the `when` gate reads `val.length` normally
    elCases.push(["r6:id.proto-length0", { id: Object.create({ length: 0 }), type: "circle", center: [0, 0], r: 1 }]);
    elCases.push(["r6:id.getter-length", { id: { get length() { return "x"; } }, type: "circle", center: [0, 0], r: 1 }]);
    // tuple non-array: zod emits invalid_type ONLY — tuples have no sizable gate
    for (const v of ["x", "ab", "abc", { length: 0 }, { length: 2 }, { length: 5 }]) {
      addEl(`r6:point.at=${JSON.stringify(v)}`, { id: "e", type: "point", at: v });
      addEl(`r6:line.points=${JSON.stringify(v)}`, { id: "e", type: "line", points: v });
    }

    // F8: record input gate — zod util.isPlainObject resolves `o.constructor`
    // through the proto chain (delegates can pass; own ctor overrides can fail)
    const metaDoc = (meta: unknown): Record<string, unknown> => ({
      schema: "vibhaga.diagram", schemaVersion: 1,
      canvas: { width: 1, height: 1 }, elements: [], meta,
    });
    docCases.push(["r7:meta-delegate-proto", metaDoc(Object.create({ a: 1 }))]);
    docCases.push(["r7:meta-delegate-empty", metaDoc(Object.create({}))]);
    docCases.push(["r7:meta-own-ctor-fn", metaDoc({ constructor: function () {}, a: 1 })]);
    docCases.push(["r7:meta-own-ctor-42", metaDoc({ constructor: 42, a: 1 })]);
    docCases.push(["r7:meta-own-ctor-null", metaDoc({ constructor: null, a: 1 })]);
    docCases.push(["r7:meta-own-ctor-undef", metaDoc({ constructor: undefined, a: 1 })]);
    docCases.push(["r7:meta-proto-isPrototypeOf", metaDoc(Object.create({ isPrototypeOf() {}, x: 1 }))]);
    class MetaClass { a = 1; }
    // a class METHOD lands on the prototype as an own (non-enumerable) property —
    // exactly what flips zod's isPlainObject check to "accept"
    class MetaClassIso { a = 1; isPrototypeOf(): boolean { return true; } }
    docCases.push(["r7:meta-class-instance", metaDoc(new MetaClass())]);
    docCases.push(["r7:meta-class-own-isPrototypeOf", metaDoc(new MetaClassIso())]);
    docCases.push(["r7:meta-proxy", metaDoc(new Proxy({ a: 1 }, {}))]);
    docCases.push(["r7:meta-map", metaDoc(new Map([["a", 1]]))]);
    // F9: every enumerable symbol key earns its own invalid_key issue
    docCases.push(["r7:meta-2-symbols", metaDoc({ [Symbol("a")]: 1, [Symbol("b")]: 2, c: 3 })]);
    docCases.push(["r7:meta-3-symbols", metaDoc({ [Symbol("a")]: 1, [Symbol("b")]: 2, [Symbol("c")]: 3 })]);
    docCases.push(["r7:meta-anon-symbol", metaDoc({ [Symbol()]: 1 })]);

    for (const [label, doc] of docCases) checkDoc(doc, `doc:${label}`);
    for (const [label, el] of elCases) {
      checkElement(el, `el:${label}`);
      checkDoc(wrap(el), `wrapped-el:${label}`);
    }

    // eslint-disable-next-line no-console
    console.info(
      `differential cases: ${counts.doc} document + ${counts.element} element ` +
        `(${counts.accepted} accepted, ${counts.rejected} rejected at doc level; ` +
        `corpus ${docCases.length} docs, ${elCases.length} elements)`,
    );
    // sanity: the corpus actually exercises both branches broadly
    expect(counts.rejected).toBeGreaterThan(500);
    expect(counts.accepted).toBeGreaterThan(50);
    expect(mismatches).toEqual([]);
  });
});
