/**
 * The ported VDD-schema assertions. Origins:
 *   - `Vibhaga-Admin/src/components/diagram/DiagramRenderer.test.tsx` ("VDD schema" describe,
 *     the hostile-paint acceptance test)
 *   - `Vibhaga-Web/src/components/diagram/VddRenderer.test.tsx` ("parseVdd" describe)
 *   - `Vibhaga-Admin/src/features/onboarding/QuestionCard.test.tsx` (minimal doc, :154)
 *   - `Vibhaga-Web/src/components/questions/AnswerBlock.test.tsx` (empty-elements doc, :8)
 *   - Admin's `StudentPreview` contract (drops elements failing `VddElement.safeParse`)
 *   → `parseVddElement` must agree exactly.
 */
import { describe, expect, it } from "vitest";

import {
  parseVdd,
  parseVddDocument,
  parseVddElement,
} from "../src/vdd-schema/index.js";
import { CIRCLE, GOLDEN_FIXTURES, PROBABILITY, TRIANGLE } from "./fixtures/golden.js";
import {
  ANSWERBLOCK_VDD,
  HOSTILE_PAINT_DOC,
  QUESTIONCARD_VDD,
} from "./fixtures/corpus.js";

describe("VDD schema — ported from Admin DiagramRenderer.test.tsx", () => {
  it("accepts every golden fixture", () => {
    for (const doc of Object.values(GOLDEN_FIXTURES)) {
      expect(parseVddDocument(doc).ok).toBe(true);
    }
  });

  it("rejects a non-VDD object", () => {
    expect(parseVdd({ schema: "nope", elements: [] })).toBeNull();
    expect(
      parseVdd({
        schema: "vibhaga.diagram",
        schemaVersion: 1,
        canvas: { width: 1, height: 1 },
        elements: [{ type: "circle" }],
      }),
    ).toBeNull();
  });

  it("parseVdd returns the typed doc for valid input", () => {
    const doc = parseVdd(TRIANGLE);
    expect(doc?.elements.length).toBe(TRIANGLE.elements.length);
  });
});

describe("parseVdd — ported from Web VddRenderer.test.tsx", () => {
  it("accepts a well-formed document", () => {
    expect(parseVdd(TRIANGLE)).not.toBeNull();
    expect(parseVdd(CIRCLE)).not.toBeNull();
    expect(parseVdd(PROBABILITY)).not.toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(parseVdd(null)).toBeNull();
    expect(parseVdd("nope")).toBeNull();
    expect(parseVdd(42)).toBeNull();
    expect(parseVdd(undefined)).toBeNull();
    expect(parseVdd([])).toBeNull();
  });

  it("returns null for a wrong or missing schema tag", () => {
    expect(
      parseVdd({ schema: "something-else", canvas: { width: 10, height: 10 }, elements: [] }),
    ).toBeNull();
    expect(parseVdd({ canvas: { width: 10, height: 10 }, elements: [] })).toBeNull();
  });

  it("returns null for missing or degenerate canvas/elements", () => {
    expect(parseVdd({ schema: "vibhaga.diagram", elements: [] })).toBeNull();
    expect(
      parseVdd({ schema: "vibhaga.diagram", canvas: { width: 0, height: 10 }, elements: [] }),
    ).toBeNull();
    expect(
      parseVdd({ schema: "vibhaga.diagram", canvas: { width: 10, height: 10 }, elements: "no" }),
    ).toBeNull();
  });

  it("accepts the consumer minimal docs", () => {
    expect(parseVdd(QUESTIONCARD_VDD)).not.toBeNull();
    expect(parseVdd(ANSWERBLOCK_VDD)).not.toBeNull();
  });
});

describe("the SCHEMA accepts hostile paints — ported from Admin DiagramRenderer.test.tsx", () => {
  it("one bad colour must not void a figure a student can see", () => {
    expect(parseVdd(HOSTILE_PAINT_DOC)).not.toBeNull();
    expect(parseVddDocument(HOSTILE_PAINT_DOC).ok).toBe(true);
    // ⚠️ And the value survives parsing UNCHANGED, so the review surface can name it.
    expect(parseVdd(HOSTILE_PAINT_DOC)?.canvas.background).toBe(
      "url(https://tracker.example/track.png)",
    );
  });
});

describe("strict semantics — what the zod oracle does, restated as direct assertions", () => {
  it("strips unknown keys at every object level and never returns the input", () => {
    const raw = {
      schema: "vibhaga.diagram",
      schemaVersion: 1,
      junk: { deep: true },
      canvas: { width: 10, height: 10, junkCanvas: 1 },
      elements: [{ id: "e", type: "circle", center: [1, 2], r: 3, junkEl: "x", stroke: { color: "#fff", junkS: 9 } }],
      meta: { keep: "me", nested: { also: [1, { deep: "kept" }] } },
    };
    const res = parseVddDocument(raw);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).not.toBe(raw);
    expect(res.value).toStrictEqual({
      schema: "vibhaga.diagram",
      schemaVersion: 1,
      canvas: { width: 10, height: 10 },
      elements: [{ id: "e", type: "circle", center: [1, 2], r: 3, stroke: { color: "#fff" } }],
      meta: { keep: "me", nested: { also: [1, { deep: "kept" }] } },
    });
  });

  it("does not mutate its input", () => {
    const raw = {
      schema: "vibhaga.diagram",
      schemaVersion: 1,
      canvas: { width: 10, height: 10 },
      elements: [{ id: "e", type: "circle", center: [1, 2], r: 3, junk: 1 }],
    };
    const before = JSON.stringify(raw);
    parseVddDocument(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("reports ALL issues, addressed at the element — zod-style paths", () => {
    const res = parseVddDocument({
      schema: "vibhaga.diagram",
      schemaVersion: 1,
      canvas: { width: 10, height: 10 },
      elements: [
        { id: "ok", type: "circle", center: [0, 0], r: 1 },
        { id: "bad1", type: "rect", x: 0, y: 0, width: "w", height: 5, stroke: { width: "wide" } },
        { id: "bad2", type: "bogus" },
      ],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const paths = res.errors.map((e) => e.path);
    expect(paths).toContainEqual(["elements", 1, "width"]);
    expect(paths).toContainEqual(["elements", 1, "stroke", "width"]);
    expect(paths).toContainEqual(["elements", 2, "type"]);
    // a good element contributes no issues
    expect(paths.every((p) => !(p[0] === "elements" && p[1] === 0))).toBe(true);
  });

  it("keeps the PATH_D message verbatim", () => {
    const res = parseVddDocument({
      schema: "vibhaga.diagram",
      schemaVersion: 1,
      canvas: { width: 10, height: 10 },
      elements: [{ id: "p", type: "path", d: "M 0 0 X 5" }],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]!.path).toEqual(["elements", 0, "d"]);
    expect(res.errors[0]!.message).toBe(
      "path.d: only M,L,Q,C,A,Z commands are allowed",
    );
  });

  it("distinguishes absent optional keys from present-undefined (zod keeps the latter)", () => {
    const res = parseVddDocument({
      schema: "vibhaga.diagram",
      schemaVersion: 1,
      canvas: { width: 10, height: 10, background: undefined },
      elements: [{ id: "e", type: "circle", center: [0, 0], r: 1, groupId: undefined }],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect("background" in res.value.canvas).toBe(true);
    expect("groupId" in res.value.elements[0]!).toBe(true);
    expect("defaults" in res.value).toBe(false);
    expect("a11y" in res.value).toBe(false);
  });

  it("rejects NaN, ±Infinity and non-safe-integers where zod does", () => {
    const docWith = (version: unknown) => ({
      schema: "vibhaga.diagram",
      schemaVersion: version,
      canvas: { width: 10, height: 10 },
      elements: [],
    });
    for (const v of [NaN, Infinity, -Infinity, 1.5, "1", 2 ** 53]) {
      expect(parseVddDocument(docWith(v)).ok).toBe(false);
    }
    for (const v of [0, 1, -3, Number.MAX_SAFE_INTEGER]) {
      expect(parseVddDocument(docWith(v)).ok).toBe(true);
    }
  });
});

describe("parseVddElement — the StudentPreview drop contract", () => {
  it("accepts a good element and rejects a bad one, matching VddElement.safeParse", () => {
    expect(parseVddElement({ id: "e", type: "circle", center: [0, 0], r: 5 }).ok).toBe(true);
    expect(parseVddElement({ type: "circle", center: [0, 0], r: 5 }).ok).toBe(false); // no id
    expect(parseVddElement({ id: "", type: "circle", center: [0, 0], r: 5 }).ok).toBe(false); // empty id
    expect(parseVddElement({ id: "e", type: "circle", center: [0, 0], r: -1 }).ok).toBe(false); // r < 0
    expect(parseVddElement({ id: "e", type: "bogus" }).ok).toBe(false);
    expect(parseVddElement(5).ok).toBe(false);
    expect(parseVddElement([1, 2]).ok).toBe(false);
  });

  it("strips unknown keys and reports member paths relative to the element", () => {
    const res = parseVddElement({
      id: "e",
      type: "arrow",
      points: [[0, 0], [1, 1]],
      head: "sideways",
      junk: true,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.map((e) => e.path)).toEqual([["head"]]);

    const good = parseVddElement({ id: "e", type: "arrow", points: [[0, 0], [1, 1]], junk: true });
    expect(good.ok).toBe(true);
    if (good.ok) expect("junk" in good.value).toBe(false);
  });
});
