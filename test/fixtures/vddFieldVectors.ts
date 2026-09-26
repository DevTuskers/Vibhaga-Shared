/**
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE VDD FIELD-DROP VECTOR TABLE — byte-identical in Vibhaga-Admin and Vibhaga-Web.
 *
 * Spec: Vibhaga-Docs/technical/diagram-dsl-spec.md §4 · Trap: TRAPS T96.
 *
 * ⭐ ONE ROW PER (element type × optional field). Each row carries **one** document — the one WITH
 * the field — plus the `path` of that field. The harness builds the "without" document by DELETING
 * exactly that path, renders both, and diffs the SVG. That is the pair-render method that found the
 * nine drops of 2026-08-26, mechanised so it cannot be done sloppily: the two documents differ in
 * that one field and nothing else, by construction.
 *
 * `effect` is the whole point of the table:
 *   - `"renders"`  — the field MUST change the rendered SVG. A row that does not is a silent drop:
 *                    the schema accepts the field, `safeParse` passes, and the figure lies.
 *   - `"inert"`    — the field MUST NOT change the SVG, and that is normative, not an accident
 *                    (`groupId` is "editor grouping only; not a render concern", `link` is a
 *                    "semantic, non-rendering" back-reference — spec §4.3). Pinned so a future
 *                    reader cannot mistake a deliberate non-render for the bug above, and so
 *                    "rendered it or removed it" has a third, *declared* answer.
 *
 * `claims` are DOM claims, not strings: `[selector, what, expected]` where `what` is an attribute
 * name, `style:<property>` (a real `getPropertyValue` read, because stroke/fill paint travels in the
 * `style` attribute here), `#count` (querySelectorAll length), `#text` (textContent of the first
 * match) or `#arcflags` (the large-arc + sweep flags PARSED out of a path's `d`). ⚠️ Never assert on
 * serialised markup — a formatted string passes for the wrong reason the moment React, KaTeX or the
 * style serialiser changes its spacing.
 *
 * ⚠️ AND THE PAIR-RENDER DIFF ALONE IS NOT ENOUGH — three of the nine cannot be seen by it, which is
 * a correction to the method that found them:
 *   - `arrow.stroke.color`: deleting it moves the LINE's colour too, so the diff says "renders" while
 *     the arrowHEAD stays default-black. Only the `marker path[fill]` claim sees it.
 *   - `a11y.description`: the `<desc>` element was always emitted, so the markup differed — what was
 *     missing is that nothing REFERENCED it, and `role="img"` prunes the subtree. Only the
 *     `[aria-describedby]` claim sees it (and the accessibility tree in a real browser).
 *   - element `opacity` on fills: it was a fallback for `stroke.opacity`, so the diff moved for the
 *     stroke while the fill stayed opaque. Only a row that PINS `stroke.opacity` isolates the fill.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
import type { VddDocument } from "../../src/vdd-schema/index.js";

export type FieldEffect = "renders" | "inert";

/** `[selector, attribute | "#count" | "#text", expected]` — asserted on the WITH-field render. */
export type DomClaim = readonly [string, string, string];

export type FieldVector = {
  /** Human name, used as the test title. Starts with the element type or `document`. */
  readonly note: string;
  /** Dotted/indexed path of the ONE field under test, e.g. `elements[0].headSize`. */
  readonly path: string;
  /** The document WITH the field set. The harness deletes `path` to build its pair. */
  readonly doc: VddDocument;
  readonly effect: FieldEffect;
  readonly claims: readonly DomClaim[];
  /**
   * The "without" document, for the rows where DELETING the field is not the honest opposite of
   * setting it. ⚠️ There is exactly one shape of that: a REQUIRED field whose *content* is under
   * test — `text.value` with a `\n` in it. Deleting `value` does not produce "the same figure
   * without multi-line support", it produces a malformed element, and the two renderers then
   * disagree for an unrelated reason (Admin used to throw, Web skipped it) — so the row would have
   * "passed" on a crash. Every other row leaves this undefined and gets the mechanical delete.
   */
  readonly base?: VddDocument;
};

/** A minimal document; `elements` is supplied per row. */
const doc = (elements: unknown[], extra: Record<string, unknown> = {}): VddDocument =>
  ({
    schema: "vibhaga.diagram",
    schemaVersion: 1,
    canvas: { width: 400, height: 300, background: "transparent" },
    elements,
    ...extra,
  }) as unknown as VddDocument;

/* ── the fifteen element types, each with a rotation and an opacity probe ──────────────────────
 * `rotation` and `opacity` are BASE fields (spec §4.3), so "it works on rect" proves nothing about
 * the other fourteen — which is exactly how `rotation` came to be honoured on 4 of 15 types.      */

const EVERY_TYPE: readonly { type: string; el: Record<string, unknown> }[] = [
  { type: "rect", el: { id: "e", type: "rect", x: 10, y: 20, width: 100, height: 50 } },
  { type: "circle", el: { id: "e", type: "circle", center: [100, 100], r: 40 } },
  { type: "ellipse", el: { id: "e", type: "ellipse", center: [100, 100], rx: 60, ry: 30 } },
  { type: "line", el: { id: "e", type: "line", points: [[10, 10], [200, 120]] } },
  { type: "polyline", el: { id: "e", type: "polyline", points: [[10, 10], [80, 90], [200, 40]] } },
  { type: "polygon", el: { id: "e", type: "polygon", points: [[10, 10], [200, 20], [120, 150]] } },
  { type: "arrow", el: { id: "e", type: "arrow", points: [[10, 10], [200, 120]] } },
  { type: "point", el: { id: "e", type: "point", at: [100, 100], label: "P" } },
  { type: "arc", el: { id: "e", type: "arc", center: [100, 100], r: 50, start: 0, end: 120 } },
  { type: "path", el: { id: "e", type: "path", d: "M 10 10 L 100 10 L 100 80 Z" } },
  { type: "angleMark", el: { id: "e", type: "angleMark", vertex: [100, 100], from: [200, 100], to: [100, 20], r: 30, label: "x" } },
  { type: "tickMark", el: { id: "e", type: "tickMark", on: [[10, 10], [200, 120]] } },
  { type: "parallelMark", el: { id: "e", type: "parallelMark", on: [[10, 10], [200, 120]] } },
  { type: "text", el: { id: "e", type: "text", at: [50, 60], value: "AB" } },
  { type: "math", el: { id: "e", type: "math", at: [50, 60], latex: "x^2" } },
];

const ROTATION_VECTORS: readonly FieldVector[] = EVERY_TYPE.map(({ type, el }) => ({
  note: `${type}.rotation — a rotated element must carry a rotate() transform`,
  path: "elements[0].rotation",
  doc: doc([{ ...el, rotation: 30 }]),
  effect: "renders" as const,
  // `math` is an HTML overlay, not an SVG node, so its rotation lands in the wrapper's `transform`
  // style (DD4 — math is never baked into the SVG). Every other type rotates about an SVG anchor.
  claims: type === "math" ? [] : ([["svg [transform]", "#count", "1"]] as const),
}));

const OPACITY_VECTORS: readonly FieldVector[] = EVERY_TYPE.map(({ type, el }) => ({
  note: `${type}.opacity — the element's own opacity must reach the paint`,
  path: "elements[0].opacity",
  doc: doc([{ ...el, opacity: 0.4, fill: { color: "#dddddd" } }]),
  effect: "renders" as const,
  claims: [],
}));

/**
 * ⭐ THE CLAIMED DROP, ISOLATED. `opacity` used to be read as a FALLBACK for `stroke.opacity`
 * (`s?.opacity ?? el.opacity ?? 1`) and `fill.opacity` never looked at it at all, so a half
 * transparent shape drew a solid fill. Pinning `stroke.opacity` holds the stroke half still, which is
 * the only way the diff can see the fill half; spec §4.3 says `opacity` MULTIPLIES both.
 */
const FILL_OPACITY_VECTORS: readonly FieldVector[] = [
  {
    note: "rect.opacity — ⭐ it must reach the FILL, not only the stroke (stroke.opacity pinned)",
    path: "elements[0].opacity",
    doc: doc([
      { id: "e", type: "rect", x: 10, y: 10, width: 80, height: 40, fill: { color: "#dddddd" }, stroke: { opacity: 1 }, opacity: 0.4 },
    ]),
    effect: "renders" as const,
    claims: [
      ["svg rect", "style:fill-opacity", "0.4"],
      ["svg rect", "style:stroke-opacity", "0.4"],
    ],
  },
  {
    note: "polygon.opacity — ⭐ the same, on the type the live figures actually fill",
    path: "elements[0].opacity",
    doc: doc([
      { id: "e", type: "polygon", points: [[10, 10], [200, 20], [120, 150]], fill: { color: "#dddddd", opacity: 0.5 }, stroke: { opacity: 1 }, opacity: 0.5 },
    ]),
    effect: "renders" as const,
    // 0.5 (the fill's own) × 0.5 (the element's) = 0.25 — a MULTIPLICATION, per spec §4.3.
    claims: [["svg polygon", "style:fill-opacity", "0.25"]],
  },
];

/* ── the nine claimed drops, plus the type-specific fields around them ─────────────────────── */

export const VDD_FIELD_VECTORS: readonly FieldVector[] = [
  ...ROTATION_VECTORS,
  ...OPACITY_VECTORS,
  ...FILL_OPACITY_VECTORS,

  /* ── T96's founding case ──────────────────────────────────────────────────────────────── */
  {
    note: 'angleMark.label with variant:"right" — a labelled right angle must draw its label',
    path: "elements[0].label",
    doc: doc([{ id: "e", type: "angleMark", vertex: [100, 100], from: [200, 100], to: [100, 20], r: 30, variant: "right", label: "90°" }]),
    effect: "renders",
    claims: [
      ["svg text", "#count", "1"],
      ["svg text", "#text", "90°"],
      ["svg polyline", "#count", "1"],
    ],
  },
  {
    note: "angleMark.label on the arc variant — the case that always worked (the control)",
    path: "elements[0].label",
    doc: doc([{ id: "e", type: "angleMark", vertex: [100, 100], from: [200, 100], to: [100, 20], r: 30, label: "x" }]),
    effect: "renders",
    claims: [["svg text", "#text", "x"], ["svg path", "#count", "1"]],
  },
  {
    note: "angleMark.arcs — an equal-angle group draws one path per arc",
    path: "elements[0].arcs",
    doc: doc([{ id: "e", type: "angleMark", vertex: [100, 100], from: [200, 100], to: [100, 20], r: 30, arcs: 3 }]),
    effect: "renders",
    claims: [["svg path", "#count", "3"]],
  },
  {
    note: "angleMark.reflex — the mark takes the reflex sweep, and its LABEL follows the mark",
    path: "elements[0].reflex",
    doc: doc([{ id: "e", type: "angleMark", vertex: [100, 100], from: [200, 100], to: [100, 20], r: 30, label: "y", reflex: true }]),
    effect: "renders",
    claims: [["svg path", "#count", "1"], ["svg text", "#text", "y"]],
  },
  {
    note: 'angleMark.variant — "right" is a square (polyline), not an arc',
    path: "elements[0].variant",
    doc: doc([{ id: "e", type: "angleMark", vertex: [100, 100], from: [200, 100], to: [100, 20], r: 30, variant: "right" }]),
    effect: "renders",
    claims: [["svg polyline", "#count", "1"], ["svg path", "#count", "0"]],
  },

  /* ── arrow ────────────────────────────────────────────────────────────────────────────── */
  {
    note: "arrow.headSize — the head must be sized in canvas units (LIVE ×3)",
    path: "elements[0].headSize",
    doc: doc([{ id: "e", type: "arrow", points: [[10, 10], [200, 120]], head: "end", headSize: 24 }]),
    effect: "renders",
    claims: [
      ["svg marker", "#count", "1"],
      ["svg marker", "markerWidth", "24"],
      ["svg marker", "markerHeight", "24"],
      ["svg marker", "markerUnits", "userSpaceOnUse"],
    ],
  },
  {
    note: "arrow.head — `none` draws no marker, `both` marks both ends",
    path: "elements[0].head",
    doc: doc([{ id: "e", type: "arrow", points: [[10, 10], [200, 120]], head: "none" }]),
    effect: "renders",
    claims: [["svg polyline[marker-end]", "#count", "0"], ["svg polyline[marker-start]", "#count", "0"]],
  },
  {
    note: "arrow.stroke.color — the ARROWHEAD takes the arrow's own ink, not the document default",
    path: "elements[0].stroke.color",
    doc: doc([{ id: "e", type: "arrow", points: [[10, 10], [200, 120]], head: "end", stroke: { color: "#4a7ebb" } }], {
      defaults: { strokeColor: "#1f2937" },
    }),
    effect: "renders",
    claims: [["svg marker path", "fill", "#4a7ebb"]],
  },

  /* ── arc ──────────────────────────────────────────────────────────────────────────────── */
  {
    note: "arc.sweep — `ccw` must take the other way round the circle",
    path: "elements[0].sweep",
    doc: doc([{ id: "e", type: "arc", center: [200, 150], r: 90, start: 0, end: 90, sweep: "ccw" }]),
    effect: "renders",
    // 0° → 90° the other way round is a 270° sweep: large-arc 1, sweep-flag 0 (anticlockwise).
    claims: [["svg path", "#count", "1"], ["svg path", "#arcflags", "1,0"]],
  },
  {
    note: "arc.sweep — `cw` on an already-clockwise span is a no-op (the control)",
    path: "elements[0].sweep",
    doc: doc([{ id: "e", type: "arc", center: [200, 150], r: 90, start: 0, end: 90, sweep: "cw" }]),
    effect: "inert",
    claims: [["svg path", "#count", "1"], ["svg path", "#arcflags", "0,1"]],
  },

  /* ── document-level: z, defaults, canvas, a11y ────────────────────────────────────────── */
  {
    note: "element.z — an explicit z reorders the paint order (spec §4.3 / DD6)",
    path: "elements[0].z",
    doc: doc([
      { id: "back", type: "rect", x: 0, y: 0, width: 50, height: 50, z: 5 },
      { id: "front", type: "circle", center: [25, 25], r: 10 },
    ]),
    effect: "renders",
    // With z, `back` sorts AFTER `front`, so the rect is the LAST painted node.
    claims: [["svg > g:last-of-type rect", "#count", "1"]],
  },
  {
    note: "defaults.fontFamily — the document default must reach a text element (LIVE ×12)",
    path: "defaults.fontFamily",
    doc: doc([{ id: "e", type: "text", at: [50, 60], value: "AB" }], { defaults: { fontFamily: "serif" } }),
    effect: "renders",
    claims: [["svg text", "font-family", "ui-serif, 'Noto Sans Sinhala', serif"]],
  },
  {
    note: "defaults.fontFamily — it must reach a point LABEL too (its own font was hardcoded)",
    path: "defaults.fontFamily",
    doc: doc([{ id: "e", type: "point", at: [100, 100], label: "P" }], { defaults: { fontFamily: "mono" } }),
    effect: "renders",
    claims: [["svg text", "#text", "P"], ["svg text", "font-family", "ui-monospace, monospace"]],
  },
  {
    note: "defaults.fontFamily — and an angleMark label",
    path: "defaults.fontFamily",
    doc: doc([{ id: "e", type: "angleMark", vertex: [100, 100], from: [200, 100], to: [100, 20], r: 30, label: "x" }], {
      defaults: { fontFamily: "mono" },
    }),
    effect: "renders",
    claims: [["svg text", "#text", "x"], ["svg text", "font-family", "ui-monospace, monospace"]],
  },
  {
    note: "defaults.opacity — the document default must reach an element with no opacity of its own",
    path: "defaults.opacity",
    doc: doc([{ id: "e", type: "rect", x: 10, y: 10, width: 80, height: 40, fill: { color: "#dddddd" } }], {
      defaults: { opacity: 0.3 },
    }),
    effect: "renders",
    claims: [["svg rect", "style:fill-opacity", "0.3"], ["svg rect", "style:stroke-opacity", "0.3"]],
  },
  {
    note: "defaults.strokeColor / strokeWidth / strokeStyle / fillColor / fontSize — the ones that always worked",
    path: "defaults.strokeWidth",
    doc: doc([{ id: "e", type: "line", points: [[10, 10], [200, 120]] }], { defaults: { strokeWidth: 9 } }),
    effect: "renders",
    claims: [["svg line", "style:stroke-width", "9"]],
  },
  {
    // ⚠️ A NON-DEFAULT background: the spec's default IS `"transparent"` (§4.2), so deleting
    // `background: "transparent"` correctly changes nothing and the row would report a false drop.
    note: "canvas.background — a document background paints the figure's box",
    path: "canvas.background",
    doc: doc([{ id: "e", type: "line", points: [[10, 10], [200, 120]] }], {
      canvas: { width: 400, height: 300, background: "#eef2ff" },
    }),
    effect: "renders",
    claims: [['[role="img"]', "#count", "1"]],
  },

  /* ── a11y — what a screen-reader user gets INSTEAD of the figure ──────────────────────── */
  {
    note: "a11y.title — the figure's accessible name",
    path: "a11y.title",
    doc: doc([{ id: "e", type: "line", points: [[10, 10], [200, 120]] }], {
      a11y: { title: "Triangle ABC", description: "A triangle with vertices A, B and C." },
    }),
    effect: "renders",
    claims: [
      ['[role="img"]', "aria-label", "Triangle ABC"],
      ["svg title", "#text", "Triangle ABC"],
    ],
  },
  {
    note: "⭐ a11y.description — it must be REACHABLE, not merely present as an unreferenced <desc>",
    path: "a11y.description",
    doc: doc([{ id: "e", type: "line", points: [[10, 10], [200, 120]] }], {
      a11y: { title: "Triangle ABC", description: "A triangle with vertices A, B and C." },
    }),
    effect: "renders",
    claims: [
      // The `<desc>` alone is NOT enough: `role="img"` makes the wrapper a leaf in the
      // accessibility tree, so nothing inside the SVG is announced. The description has to be
      // wired to the named node by `aria-describedby`.
      ["svg desc", "#text", "A triangle with vertices A, B and C."],
      ['[role="img"][aria-describedby]', "#count", "1"],
    ],
  },

  /* ── deliberately non-rendering (spec §4.3), pinned so it stays a decision ─────────────── */
  {
    note: "element.groupId — editor grouping only; NOT a render concern (spec §4.3)",
    path: "elements[0].groupId",
    doc: doc([{ id: "e", type: "rect", x: 10, y: 10, width: 80, height: 40, groupId: "g1" }]),
    effect: "inert",
    claims: [["svg rect", "#count", "1"], ["[data-group-id]", "#count", "0"]],
  },
  {
    note: "element.link — a semantic Tier-B back-reference; NOT a render concern (spec §4.3)",
    path: "elements[0].link",
    doc: doc([{ id: "e", type: "rect", x: 10, y: 10, width: 80, height: 40, link: { refType: "mark", refId: "m1" } }]),
    effect: "inert",
    claims: [["svg a", "#count", "0"], ["[href]", "#count", "0"]],
  },
  {
    note: "meta — provenance; never affects rendering (spec §4.2)",
    path: "meta",
    doc: doc([{ id: "e", type: "rect", x: 10, y: 10, width: 80, height: 40 }], { meta: { authoredWith: "excalidraw-adapter" } }),
    effect: "inert",
    claims: [],
  },
  {
    // ⚠️ Listed so the sweep covers the WHOLE schema and nothing is left unexplained: `schemaVersion`
    // is a forward-compat tag (spec §6.3), and the graceful-degrade it governs is per-element —
    // unknown `type`s are skipped and unknown FIELDS are ignored — so it paints nothing by design.
    note: "document.schemaVersion — a forward-compat tag, not a paint instruction (spec §6.3)",
    path: "schemaVersion",
    doc: doc([{ id: "e", type: "rect", x: 10, y: 10, width: 80, height: 40 }]),
    effect: "inert",
    claims: [],
  },
  {
    // `id` is the React reconciliation key and the canvas's selection handle (spec §4.3) — it is
    // never painted, and a figure that drew its element ids would be a defect.
    note: "element.id — the reconciliation key and the editor's handle; never painted (spec §4.3)",
    path: "elements[0].id",
    doc: doc([{ id: "handle-1", type: "rect", x: 10, y: 10, width: 80, height: 40 }]),
    effect: "inert",
    claims: [["#handle-1", "#count", "0"]],
  },

  /* ── point ────────────────────────────────────────────────────────────────────────────── */
  {
    note: "point.label — a labelled point draws its label",
    path: "elements[0].label",
    doc: doc([{ id: "e", type: "point", at: [100, 100], label: "O" }]),
    effect: "renders",
    claims: [["svg text", "#text", "O"], ["svg circle", "#count", "1"]],
  },
  {
    note: "point.labelOffset — the label moves",
    path: "elements[0].labelOffset",
    doc: doc([{ id: "e", type: "point", at: [100, 100], label: "O", labelOffset: [-30, 24] }]),
    effect: "renders",
    claims: [["svg text", "x", "70"], ["svg text", "y", "124"]],
  },
  {
    note: "point.r — the dot radius",
    path: "elements[0].r",
    doc: doc([{ id: "e", type: "point", at: [100, 100], r: 9 }]),
    effect: "renders",
    claims: [["svg circle", "r", "9"]],
  },

  /* ── text + math ──────────────────────────────────────────────────────────────────────── */
  {
    note: "text.fontFamily — an element font overrides the document default",
    path: "elements[0].fontFamily",
    doc: doc([{ id: "e", type: "text", at: [50, 60], value: "AB", fontFamily: "mono" }], { defaults: { fontFamily: "serif" } }),
    effect: "renders",
    claims: [["svg text", "font-family", "ui-monospace, monospace"]],
  },
  {
    note: "text.fontSize / color / align / baseline",
    path: "elements[0].align",
    doc: doc([{ id: "e", type: "text", at: [50, 60], value: "AB", align: "middle" }]),
    effect: "renders",
    claims: [["svg text", "text-anchor", "middle"]],
  },
  {
    note: "⭐ text.value with a newline — each line gets its own baseline (a <tspan> each)",
    path: "elements[0].value (the \\n in it)",
    doc: doc([{ id: "e", type: "text", at: [50, 60], value: "Area of\ntriangle ABC" }]),
    base: doc([{ id: "e", type: "text", at: [50, 60], value: "Area of triangle ABC" }]),
    effect: "renders",
    claims: [
      ["svg text tspan", "#count", "2"],
      ["svg text tspan", "#text", "Area of"],
    ],
  },
  {
    note: "math.latex — KaTeX renders into the overlay, not the SVG (DD4)",
    path: "elements[0].latex",
    doc: doc([{ id: "e", type: "math", at: [50, 60], latex: "\\frac{1}{2}" }]),
    effect: "renders",
    claims: [[".katex", "#count", "1"]],
  },
  {
    note: "math.color / fontSize / align / baseline",
    path: "elements[0].align",
    doc: doc([{ id: "e", type: "math", at: [50, 60], latex: "x", align: "middle" }]),
    effect: "renders",
    claims: [[".katex", "#count", "1"]],
  },

  /* ── shape geometry — the fields nobody ever doubted, kept as controls ────────────────── */
  {
    note: "rect.rx — rounded corners",
    path: "elements[0].rx",
    doc: doc([{ id: "e", type: "rect", x: 10, y: 10, width: 80, height: 40, rx: 8 }]),
    effect: "renders",
    claims: [["svg rect", "rx", "8"]],
  },
  {
    note: "tickMark.count / at / size",
    path: "elements[0].count",
    doc: doc([{ id: "e", type: "tickMark", on: [[10, 10], [200, 120]], count: 3 }]),
    effect: "renders",
    claims: [["svg line", "#count", "3"]],
  },
  {
    note: "parallelMark.count",
    path: "elements[0].count",
    doc: doc([{ id: "e", type: "parallelMark", on: [[10, 10], [200, 120]], count: 2 }]),
    effect: "renders",
    claims: [["svg polyline", "#count", "2"]],
  },
  {
    note: "stroke.opacity — the stroke's own opacity (multiplied by the element's)",
    path: "elements[0].stroke.opacity",
    doc: doc([{ id: "e", type: "line", points: [[10, 10], [200, 120]], stroke: { opacity: 0.5 } }]),
    effect: "renders",
    claims: [["svg line", "style:stroke-opacity", "0.5"]],
  },
  {
    note: "fill.opacity — the fill's own opacity (LIVE ×9)",
    path: "elements[0].fill.opacity",
    doc: doc([{ id: "e", type: "rect", x: 10, y: 10, width: 80, height: 40, fill: { color: "#dddddd", opacity: 0.5 } }]),
    effect: "renders",
    claims: [["svg rect", "style:fill-opacity", "0.5"]],
  },
];
