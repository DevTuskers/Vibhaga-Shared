/**
 * The strict VDD parser — a dependency-free reimplementation of the zod schema that
 * used to live in `Vibhaga-Admin/src/components/diagram/vdd.ts` (zod 4.4.3). Behaviour
 * is the contract, proven by `test/differential.test.ts` against that very file (the
 * test oracle): same accept/reject on every input, success output deep-equal to zod's
 * (unknown keys stripped at every object level, `meta` record values kept as-is, new
 * objects — never the input), and zod-style issue paths addressing the element, e.g.
 * `["elements", 3, "stroke", "width"]`.
 *
 * Semantics mirrored from zod 4 (measured, not assumed):
 *   - `number()` rejects NaN, ±Infinity, BigInt, non-numbers.
 *   - `int()` is a SAFE-integer check (2**53 rejects).
 *   - tuples are exact-length; `array().min(n)` fails at the array's own path.
 *   - the discriminated union on `type` reports ONE issue at `["type"]` when the
 *     discriminator is missing/invalid, otherwise the chosen member's issues verbatim.
 *   - an optional field present-but-`undefined` is kept (`{key: undefined}`); absent is
 *     omitted; required-but-`undefined` is an error.
 *   - `record` values accept any non-array object and are copied shallowly.
 *   - objects reject arrays, `null`, and non-objects; all issues are collected, not
 *     only the first.
 */
/* `d` is whitelisted to the M,L,Q,C,A,Z command subset (+ numbers/separators) so a
 * renderer never sees arbitrary path commands (spec §4.4 DD). The message text is
 * load-bearing: it is the one message kept verbatim from the zod schema. */
const PATH_D = /^[MLQCAZ\s,.\-+0-9eE]*$/;
const PATH_D_MESSAGE = "path.d: only M,L,Q,C,A,Z commands are allowed";
const BAD = Symbol("vdd-bad");
function dotted(path, root) {
    return path.length === 0 ? root : path.join(".");
}
function fail(ctx, path, detail) {
    ctx.issues.push({ path, message: `${dotted(path, ctx.root)}: ${detail}` });
    return BAD;
}
/* ── primitives ──────────────────────────────────────────────────────────────── */
const num = (opts = {}) => (v, path, ctx) => {
    if (typeof v !== "number" || !Number.isFinite(v)) {
        return fail(ctx, path, "expected a number");
    }
    let ok = true;
    if (opts.int && !Number.isSafeInteger(v)) {
        fail(ctx, path, "expected an integer");
        ok = false;
    }
    if (opts.min !== undefined) {
        const bad = opts.minExclusive ? v <= opts.min : v < opts.min;
        if (bad) {
            fail(ctx, path, `expected a number ${opts.minExclusive ? ">" : ">="} ${opts.min}`);
            ok = false;
        }
    }
    if (opts.max !== undefined && v > opts.max) {
        fail(ctx, path, `expected a number <= ${opts.max}`);
        ok = false;
    }
    return ok ? v : BAD;
};
const str = (opts = {}) => (v, path, ctx) => {
    if (typeof v !== "string")
        return fail(ctx, path, "expected a string");
    let ok = true;
    if (opts.minLen !== undefined && v.length < opts.minLen) {
        fail(ctx, path, `expected a string of at least ${opts.minLen} characters`);
        ok = false;
    }
    if (opts.regex && !opts.regex.test(v)) {
        // `regexMessage` is verbatim zod text and must not get the path prefix.
        ctx.issues.push({ path, message: opts.regexMessage ?? `does not match ${opts.regex}` });
        ok = false;
    }
    return ok ? v : BAD;
};
const bool = (v, path, ctx) => typeof v === "boolean" ? v : fail(ctx, path, "expected a boolean");
const lit = (expected) => (v, path, ctx) => v === expected ? v : fail(ctx, path, `expected ${JSON.stringify(expected)}`);
const enm = (values) => (v, path, ctx) => typeof v === "string" && values.includes(v)
    ? v
    : fail(ctx, path, `expected one of ${values.map((s) => `"${s}"`).join("|")}`);
/* ── composites ──────────────────────────────────────────────────────────────── */
const isPlainObjectInput = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const obj = (fields) => (v, path, ctx) => {
    if (!isPlainObjectInput(v))
        return fail(ctx, path, "expected an object");
    const out = {};
    let ok = true;
    for (const [key, check, required] of fields) {
        if (!Object.prototype.hasOwnProperty.call(v, key)) {
            if (required) {
                fail(ctx, [...path, key], "missing required field");
                ok = false;
            }
            continue;
        }
        const value = v[key];
        if (value === undefined) {
            if (required) {
                fail(ctx, [...path, key], "expected a value, received undefined");
                ok = false;
            }
            else {
                out[key] = undefined;
            }
            continue;
        }
        const parsed = check(value, [...path, key], ctx);
        if (parsed === BAD) {
            ok = false;
        }
        else {
            out[key] = parsed;
        }
    }
    return ok ? out : BAD;
};
const tup = (items) => (v, path, ctx) => {
    if (!Array.isArray(v))
        return fail(ctx, path, `expected a ${items.length}-item tuple`);
    if (v.length !== items.length) {
        return fail(ctx, path, `expected a ${items.length}-item tuple, got ${v.length}`);
    }
    const out = [];
    let ok = true;
    for (let i = 0; i < items.length; i++) {
        const parsed = items[i](v[i], [...path, i], ctx);
        if (parsed === BAD)
            ok = false;
        else
            out[i] = parsed;
    }
    return ok ? out : BAD;
};
const arr = (item, min) => (v, path, ctx) => {
    if (!Array.isArray(v))
        return fail(ctx, path, "expected an array");
    let ok = true;
    if (min !== undefined && v.length < min) {
        fail(ctx, path, `expected an array of at least ${min} items`);
        ok = false;
    }
    const out = [];
    for (let i = 0; i < v.length; i++) {
        const parsed = item(v[i], [...path, i], ctx);
        if (parsed === BAD)
            ok = false;
        else
            out[i] = parsed;
    }
    return ok ? out : BAD;
};
/**
 * `record(string → unknown)`: zod 4 requires a *plain* object — proto `Object.prototype` or
 * `null` (Dates, class instances, Maps, arrays, functions all reject). Values are kept as-is;
 * zod iterates `Object.keys`, so only string-keyed own props survive the copy.
 */
const isRecordInput = (v) => isPlainObjectInput(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const rec = (v, path, ctx) => {
    if (!isRecordInput(v))
        return fail(ctx, path, "expected a record (plain object)");
    // zod's copy drops `__proto__` wholesale (an own `__proto__` key on the input — only
    // producible via JSON.parse — survives into neither the output's own keys nor its
    // prototype), keeps every other string key, and keeps values by reference.
    const out = {};
    for (const [k, val] of Object.entries(v)) {
        if (k !== "__proto__")
            out[k] = val;
    }
    return out;
};
/* ── the VDD schema (mirror of the zod definitions, field for field) ─────────── */
const Point = tup([num(), num()]);
const StrokeStyle = enm(["solid", "dashed", "dotted"]);
const Align = enm(["start", "middle", "end"]);
const Baseline = enm(["top", "middle", "alphabetic"]);
const FontFamily = enm(["sans", "serif", "mono"]);
const Opacity01 = num({ min: 0, max: 1 });
const Stroke = obj([
    ["color", str(), false],
    ["width", num({ min: 0 }), false],
    ["style", StrokeStyle, false],
    ["opacity", Opacity01, false],
]);
const Fill = obj([
    ["color", str(), false],
    ["opacity", Opacity01, false],
]);
const Link = obj([
    ["refType", str(), false],
    ["refId", str(), false],
]);
const BASE_FIELDS = [
    ["id", str({ minLen: 1 }), true],
    ["z", num({ int: true }), false],
    ["rotation", num(), false],
    ["stroke", Stroke, false],
    ["fill", Fill, false],
    ["opacity", Opacity01, false],
    ["groupId", str(), false],
    ["link", Link, false],
];
const el = (type, extra) => obj([...BASE_FIELDS, ["type", lit(type), true], ...extra]);
const POINT_FIELDS = [["at", Point, true]];
const ELEMENT_MEMBERS = {
    rect: el("rect", [
        ["x", num(), true],
        ["y", num(), true],
        ["width", num(), true],
        ["height", num(), true],
        ["rx", num(), false],
    ]),
    circle: el("circle", [
        ["center", Point, true],
        ["r", num({ min: 0 }), true],
    ]),
    ellipse: el("ellipse", [
        ["center", Point, true],
        ["rx", num({ min: 0 }), true],
        ["ry", num({ min: 0 }), true],
    ]),
    line: el("line", [["points", tup([Point, Point]), true]]),
    polyline: el("polyline", [["points", arr(Point, 2), true]]),
    polygon: el("polygon", [["points", arr(Point, 3), true]]),
    arrow: el("arrow", [
        ["points", arr(Point, 2), true],
        ["head", enm(["end", "both", "none"]), false],
        ["headSize", num(), false],
    ]),
    point: el("point", [
        ...POINT_FIELDS,
        ["r", num(), false],
        ["label", str(), false],
        ["labelOffset", Point, false],
    ]),
    arc: el("arc", [
        ["center", Point, true],
        ["r", num({ min: 0 }), true],
        ["start", num(), true],
        ["end", num(), true],
        ["sweep", enm(["cw", "ccw"]), false],
    ]),
    path: el("path", [
        ["d", str({ regex: PATH_D, regexMessage: PATH_D_MESSAGE }), true],
    ]),
    angleMark: el("angleMark", [
        ["vertex", Point, true],
        ["from", Point, true],
        ["to", Point, true],
        ["r", num({ min: 0 }), true],
        ["label", str(), false],
        ["arcs", num({ int: true, min: 1 }), false],
        ["variant", enm(["arc", "right"]), false],
        ["reflex", bool, false],
    ]),
    tickMark: el("tickMark", [
        ["on", tup([Point, Point]), true],
        ["count", num({ int: true, min: 1 }), false],
        ["at", Opacity01, false],
        ["size", num(), false],
    ]),
    parallelMark: el("parallelMark", [
        ["on", tup([Point, Point]), true],
        ["count", num({ int: true, min: 1 }), false],
        ["at", Opacity01, false],
        ["size", num(), false],
    ]),
    text: el("text", [
        ...POINT_FIELDS,
        ["value", str(), true],
        ["fontSize", num(), false],
        ["fontFamily", FontFamily, false],
        ["color", str(), false],
        ["align", Align, false],
        ["baseline", Baseline, false],
    ]),
    math: el("math", [
        ...POINT_FIELDS,
        ["latex", str(), true],
        ["fontSize", num(), false],
        ["color", str(), false],
        ["align", Align, false],
        ["baseline", Baseline, false],
    ]),
};
const ELEMENT_CHECK = (v, path, ctx) => {
    if (!isPlainObjectInput(v))
        return fail(ctx, path, "expected an object");
    const disc = v.type;
    const member = typeof disc === "string" ? ELEMENT_MEMBERS[disc] : undefined;
    if (!member) {
        return fail(ctx, [...path, "type"], `invalid element type: expected one of ${Object.keys(ELEMENT_MEMBERS).join("|")}`);
    }
    return member(v, path, ctx);
};
const Defaults = obj([
    ["strokeColor", str(), false],
    ["strokeWidth", num(), false],
    ["strokeStyle", StrokeStyle, false],
    ["fillColor", str(), false],
    ["opacity", Opacity01, false],
    ["fontSize", num(), false],
    ["fontFamily", FontFamily, false],
]);
const Canvas = obj([
    ["width", num({ min: 0, minExclusive: true }), true],
    ["height", num({ min: 0, minExclusive: true }), true],
    ["background", str(), false],
]);
const A11y = obj([
    ["title", str(), false],
    ["description", str(), false],
]);
const DOCUMENT_CHECK = obj([
    ["schema", lit("vibhaga.diagram"), true],
    ["schemaVersion", num({ int: true }), true],
    ["canvas", Canvas, true],
    ["defaults", Defaults, false],
    ["elements", arr(ELEMENT_CHECK), true],
    ["a11y", A11y, false],
    ["meta", rec, false],
]);
/* ── public API ──────────────────────────────────────────────────────────────── */
function run(check, raw, root) {
    const ctx = { issues: [], root };
    const out = check(raw, [], ctx);
    return out === BAD ? { ok: false, errors: ctx.issues } : { ok: true, value: out };
}
/**
 * The strict document parser — same accept/reject and same output shape as Admin's
 * `VddDocument.safeParse` (zod 4.4.3). On failure `errors` holds every issue, with
 * zod-style paths addressing the element (`["elements", 3, "stroke", "width"]`).
 */
export function parseVddDocument(raw) {
    return run(DOCUMENT_CHECK, raw, "document");
}
/**
 * The strict element parser — same verdict as Admin's `VddElement.safeParse`, used where a
 * consumer drops single elements that fail (Admin's `StudentPreview`).
 */
export function parseVddElement(raw) {
    return run(ELEMENT_CHECK, raw, "element");
}
/** Parse unknown data (e.g. a staged question's `diagram_dsl`) into a VDD doc, or null if invalid. */
export function parseVdd(raw) {
    const parsed = parseVddDocument(raw);
    return parsed.ok ? parsed.value : null;
}
