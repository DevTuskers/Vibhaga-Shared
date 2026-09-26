/**
 * The differential corpus' seed documents: one *maximal* exemplar per element type
 * (every optional field populated, so delete-each-key mutants can prove which keys
 * the schema actually requires), the minimal docs ported from consumer tests, and the
 * hostile-paint document that must still parse (paint safety is a render-time
 * concern, not a schema one — Admin `DiagramRenderer.test.tsx` "the SCHEMA accepts it").
 */

const FULL_STROKE = { color: "#123456", width: 2, style: "dashed", opacity: 0.5 };
const FULL_FILL = { color: "rebeccapurple", opacity: 0.3 };
const FULL_LINK = { refType: "question", refId: "abc-123" };

/** Base fields every element can carry, all set. */
const BASE_EXTRAS = {
  z: 3,
  rotation: 15,
  stroke: FULL_STROKE,
  fill: FULL_FILL,
  opacity: 0.9,
  groupId: "grp",
  link: FULL_LINK,
};

/** One element per `type`, every optional field populated — all schema-valid. */
export const ELEMENT_EXEMPLARS: readonly Record<string, unknown>[] = [
  { id: "r1", type: "rect", x: 10, y: 20, width: 100, height: 50, rx: 8, ...BASE_EXTRAS },
  { id: "c1", type: "circle", center: [100, 100], r: 40, ...BASE_EXTRAS },
  { id: "e1", type: "ellipse", center: [100, 100], rx: 60, ry: 30, ...BASE_EXTRAS },
  { id: "l1", type: "line", points: [[10, 10], [200, 120]], ...BASE_EXTRAS },
  { id: "pl1", type: "polyline", points: [[10, 10], [80, 90], [200, 40]], ...BASE_EXTRAS },
  { id: "pg1", type: "polygon", points: [[10, 10], [80, 90], [200, 40], [50, 120]], ...BASE_EXTRAS },
  { id: "a1", type: "arrow", points: [[10, 10], [200, 40]], head: "both", headSize: 12, ...BASE_EXTRAS },
  { id: "p1", type: "point", at: [50, 60], r: 4, label: "P", labelOffset: [8, -8], ...BASE_EXTRAS },
  { id: "ar1", type: "arc", center: [100, 100], r: 50, start: 0, end: 90, sweep: "ccw", ...BASE_EXTRAS },
  { id: "pa1", type: "path", d: "M 0 0 L 10 10 Q 5 5 20 20 C 1 2 3 4 5 6 A 10 10 0 0 1 30 30 Z", ...BASE_EXTRAS },
  {
    id: "am1",
    type: "angleMark",
    vertex: [100, 100],
    from: [150, 100],
    to: [100, 50],
    r: 30,
    label: "θ",
    arcs: 2,
    variant: "right",
    reflex: true,
    ...BASE_EXTRAS,
  },
  { id: "tm1", type: "tickMark", on: [[10, 10], [100, 10]], count: 3, at: 0.5, size: 8, ...BASE_EXTRAS },
  { id: "pm1", type: "parallelMark", on: [[10, 20], [100, 20]], count: 2, at: 0.3, size: 6, ...BASE_EXTRAS },
  {
    id: "t1",
    type: "text",
    at: [40, 40],
    value: "hello\nworld",
    fontSize: 20,
    fontFamily: "serif",
    color: "#333333",
    align: "middle",
    baseline: "top",
    ...BASE_EXTRAS,
  },
  {
    id: "m1",
    type: "math",
    at: [60, 60],
    latex: "\\frac{a}{b}",
    fontSize: 24,
    color: "#111111",
    align: "start",
    baseline: "alphabetic",
    ...BASE_EXTRAS,
  },
];

/** A document carrying every exemplar element, plus every optional document field. */
export const MAXIMAL_DOC = {
  schema: "vibhaga.diagram",
  schemaVersion: 1,
  canvas: { width: 800, height: 600, background: "#eef2ff" },
  defaults: {
    strokeColor: "#1f2937",
    strokeWidth: 2,
    strokeStyle: "dashed",
    fillColor: "#dddddd",
    opacity: 0.8,
    fontSize: 18,
    fontFamily: "mono",
  },
  elements: ELEMENT_EXEMPLARS,
  a11y: { title: "Maximal doc", description: "One element of each type." },
  meta: { author: "test", nested: { list: [1, "two", { three: 3 }], flag: true } },
};

/** The minimal valid doc from `Vibhaga-Admin/src/features/onboarding/QuestionCard.test.tsx:154`. */
export const QUESTIONCARD_VDD = {
  schema: "vibhaga.diagram",
  schemaVersion: 1,
  canvas: { width: 800, height: 600, background: "transparent" },
  elements: [{ id: "e1", type: "line", points: [[0, 0], [10, 10]] }],
};

/** The empty-elements doc from `Vibhaga-Web/src/components/questions/AnswerBlock.test.tsx:8`. */
export const ANSWERBLOCK_VDD = {
  schema: "vibhaga.diagram",
  schemaVersion: 1,
  canvas: { width: 800, height: 600, background: "transparent" },
  elements: [],
};

/**
 * The hostile-paint doc — must PARSE (Admin `DiagramRenderer.test.tsx` "the SCHEMA accepts
 * it — one bad colour must not void a figure a student can see"; the paint grammar is a
 * render-time boundary, `colors.ts`, not a schema rule).
 */
export const HOSTILE_PAINT_DOC = {
  schema: "vibhaga.diagram",
  schemaVersion: 1,
  canvas: { width: 400, height: 300, background: "url(https://tracker.example/track.png)" },
  defaults: { strokeColor: "#1f2937", fillColor: "image-set(url(https://tracker.example/a.png) 1x)" },
  elements: [
    { id: "a", type: "line", points: [[0, 0], [10, 10]], stroke: { color: "#9ca3af" } },
    { id: "b", type: "rect", x: 0, y: 0, width: 10, height: 10, fill: { color: "var(--injected)" } },
    { id: "c", type: "text", at: [5, 5], value: "T", color: "rebeccapurple" },
  ],
};

/** Every seed document for the differential suite, labelled for failure reports. */
export const SEED_DOCS: readonly [string, Record<string, unknown>][] = [
  ["maximal", MAXIMAL_DOC],
  ["questioncard-minimal", QUESTIONCARD_VDD],
  ["answerblock-empty", ANSWERBLOCK_VDD],
  ["hostile-paint", HOSTILE_PAINT_DOC],
];
