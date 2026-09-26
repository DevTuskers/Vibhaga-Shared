/**
 * The Vibhaga Diagram DSL (VDD) — the portable, renderer-agnostic representation of
 * an O/L maths diagram, authored in Vibhaga-Admin (diagram-dsl-spec.md §4) and served
 * by the API as `diagram_dsl`.
 *
 * ⭐ THESE ARE NOW THE CANONICAL TYPES (Vibhaga-Shared, playground Phase 2). They were
 * previously two hand-mirrored declarations — Admin's `z.infer` output (zod schema in
 * `src/components/diagram/vdd.ts`) and Web's plain-TypeScript copy — and the shapes here
 * are byte-for-byte the Web declarations, which the differential suite proves
 * assignment-compatible BOTH WAYS with Admin's `z.infer` types (test/type-compat.test.ts).
 * Consumers delete their local copies and import from `@vibhaga/shared/vdd-schema`.
 *
 * Absolute coordinates in a fixed canvas; array order = paint order; degrees clockwise
 * from +x (spec §4.1).
 *
 * ⚠️ THE COLOUR FIELDS BELOW ARE `string` AND THAT IS NOT A LICENCE — THEY ARE PAINT VALUES, AND THE
 * CONTRACT IS ENFORCED AT THE RENDERER. An authored colour lands in CSS, where `url(…)` is a live
 * network reference (a CSS image on `canvas.background`, an SVG paint server on `stroke`/`fill`);
 * measured in real Chromium from those three call sites, **2 off-site GETs** and 7 `url()` paints in
 * computed style. The grammar lives in **`./colors.ts`** (moved here verbatim from the byte-identical
 * Admin/Web pair), and both renderers run every paint value through it.
 *
 * ⚠️ WHY THE SCHEMA DOES NOT REFUSE A DOCUMENT OVER A PAINT VALUE: paint fields are `string` here by
 * measured decision. For one round Admin's zod schema rejected a whole VDD for one out-of-grammar
 * colour — on the same stored document, in Chromium, Admin drew **no `<svg>`** and told the author
 * *"a student sees no figure here"* while Web drew it neutralised to `rgb(31,41,55)`. Both made 0
 * off-site requests — identical security, a false sentence on the review surface — and refusing fired
 * on legitimate modern CSS (`color-mix(in srgb, red, blue)`) while `publish.ts` writes `diagram_dsl`
 * raw anyway. Both apps neutralise; the AUTHOR (never the student) is told which value was dropped,
 * via `refusedPaintsIn`. See `./colors.ts`.
 */

export type VddPoint = [number, number];
export type VddStrokeStyle = "solid" | "dashed" | "dotted";
export type VddAlign = "start" | "middle" | "end";
export type VddBaseline = "top" | "middle" | "alphabetic";

export interface VddStroke {
  color?: string;
  width?: number;
  style?: VddStrokeStyle;
  opacity?: number;
}
export interface VddFill {
  color?: string;
  opacity?: number;
}

interface VddBase {
  id: string;
  z?: number;
  rotation?: number;
  stroke?: VddStroke;
  fill?: VddFill;
  opacity?: number;
  groupId?: string;
  link?: { refType?: string; refId?: string };
}

export interface VddRect extends VddBase { type: "rect"; x: number; y: number; width: number; height: number; rx?: number }
export interface VddCircle extends VddBase { type: "circle"; center: VddPoint; r: number }
export interface VddEllipse extends VddBase { type: "ellipse"; center: VddPoint; rx: number; ry: number }
export interface VddLine extends VddBase { type: "line"; points: [VddPoint, VddPoint] }
export interface VddPolyline extends VddBase { type: "polyline"; points: VddPoint[] }
export interface VddPolygon extends VddBase { type: "polygon"; points: VddPoint[] }
export interface VddArrow extends VddBase { type: "arrow"; points: VddPoint[]; head?: "end" | "both" | "none"; headSize?: number }
export interface VddPointEl extends VddBase { type: "point"; at: VddPoint; r?: number; label?: string; labelOffset?: VddPoint }
export interface VddArc extends VddBase { type: "arc"; center: VddPoint; r: number; start: number; end: number; sweep?: "cw" | "ccw" }
export interface VddPath extends VddBase { type: "path"; d: string }
export interface VddAngleMark extends VddBase { type: "angleMark"; vertex: VddPoint; from: VddPoint; to: VddPoint; r: number; label?: string; arcs?: number; variant?: "arc" | "right"; reflex?: boolean }
export interface VddTickMark extends VddBase { type: "tickMark"; on: [VddPoint, VddPoint]; count?: number; at?: number; size?: number }
export interface VddParallelMark extends VddBase { type: "parallelMark"; on: [VddPoint, VddPoint]; count?: number; at?: number; size?: number }
export interface VddText extends VddBase { type: "text"; at: VddPoint; value: string; fontSize?: number; fontFamily?: "sans" | "serif" | "mono"; color?: string; align?: VddAlign; baseline?: VddBaseline }
export interface VddMath extends VddBase { type: "math"; at: VddPoint; latex: string; fontSize?: number; color?: string; align?: VddAlign; baseline?: VddBaseline }

export type VddElement =
  | VddRect | VddCircle | VddEllipse | VddLine | VddPolyline | VddPolygon | VddArrow
  | VddPointEl | VddArc | VddPath | VddAngleMark | VddTickMark | VddParallelMark
  | VddText | VddMath;

/**
 * ⚠️ `fontFamily` IS THE THREE-WAY UNION, NOT A FREE STRING, matching `VddText.fontFamily` — the
 * field it is the default FOR — and matching Admin's zod `z.enum(["sans","serif","mono"])`. It was
 * `string`, and it was **ignored by the renderer entirely** until 2026-08-28 (TRAPS T96): all 12 live
 * figures that set it set `"sans"`, which is also the fallback, so no figure was wrong and nothing
 * told an author the field did nothing. The renderer re-checks the value against the three keys at
 * paint time as well, because an out-of-stack string reaches `FONT_STACK[…]` as `undefined`.
 */
export interface VddDefaults {
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: VddStrokeStyle;
  fillColor?: string;
  opacity?: number;
  fontSize?: number;
  fontFamily?: "sans" | "serif" | "mono";
}

export interface VddDocument {
  schema: "vibhaga.diagram";
  schemaVersion: number;
  canvas: { width: number; height: number; background?: string };
  defaults?: VddDefaults;
  elements: VddElement[];
  a11y?: { title?: string; description?: string };
  meta?: Record<string, unknown>;
}

export const CURRENT_VDD_SCHEMA_VERSION = 1;
