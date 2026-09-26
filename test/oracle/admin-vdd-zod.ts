/**
 * TEST ORACLE — byte-verbatim copy of `Vibhaga-Admin/src/components/diagram/vdd.ts`
 * at `Vibhaga-Admin` origin/main commit 34cef070e8e10ac6695a01bd528f23afa6fd341b
 * (zod 4.4.3). The package's hand-rolled parser in `src/vdd-schema/parse.ts` must match
 * this schema exactly: `test/differential.test.ts` runs every fixture + generated mutant
 * through both and asserts identical accept/reject, deep-equal outputs, and identical
 * error-path sets. Never edit this file to match the parser — edit the parser (or refresh
 * the whole file from a new Admin sha, updating this header).
 */
import { z } from "zod";

/**
 * The Vibhaga Diagram DSL (VDD) — the portable, renderer-agnostic representation
 * of an O/L maths diagram (see Vibhaga-Docs/technical/diagram-dsl-spec.md).
 *
 * This zod schema is the runtime mirror of the spec's §4 JSON schema: it validates
 * a stored/authored diagram and yields the `VddDocument` type the renderer + the
 * (future) Excalidraw adapter share. Absolute coordinates in a fixed canvas, array
 * order = paint order, degrees clockwise from +x (see spec §4.1).
 *
 * ⚠️ EVERY COLOUR FIELD IS A PAINT VALUE, NOT A FREE STRING — AND THE BOUNDARY IS THE RENDERER, NOT
 * THIS SCHEMA. `stroke.color`, `fill.color`, `text.color`, `math.color`, the two `defaults` colours and
 * `canvas.background` all reach CSS, where `url(…)` is a live network reference: an authored one made
 * the surface fetch off-site (measured in real Chromium — **2 requests from 3 call sites**, 7 `url()`
 * paints in computed style). Staged docs are written by AGENTS (`0008`), so the URL is attacker-chosen,
 * and the same DSL is served to children through `Vibhaga-Web`. The grammar lives in the
 * hand-lock-stepped `./colors.ts`; `DiagramRenderer` runs every paint value through it, exactly as
 * `Vibhaga-Web`'s `VddRenderer` does. See that file for why it is an allowlist and why the document is
 * neutralised rather than refused.
 */

const Point = z.tuple([z.number(), z.number()]);
const StrokeStyle = z.enum(["solid", "dashed", "dotted"]);

/**
 * A paint value: structurally a string here, constrained to the paint grammar AT THE RENDERER.
 *
 * ⚠️ THIS WAS A `superRefine` AGAINST `isSafeColor` FOR ONE ROUND, AND IT MADE THE REVIEW SURFACE STATE
 * THE OPPOSITE OF WHAT A STUDENT GETS. `parseVdd` is a whole-document `safeParse`, so one out-of-grammar
 * colour made the whole VDD invalid: measured on the same stored document in real Chromium, **Admin drew
 * no `<svg>` at all and printed *"…not valid VDD, so a student sees no figure here"*, while Web drew the
 * figure with the stroke neutralised to `rgb(31,41,55)`** — 0 off-site requests either way. The security
 * outcome was identical; the sentence on the attestation surface was simply false.
 *
 * Three more things were wrong with refusing here, all measurable:
 *   1. **The stated rationale was false.** It said the author must be told the document is *"not
 *      publishable"* — but `Vibhaga-API` types `diagram_dsl: z.unknown().optional()`
 *      (`api/src/onboarding/validation.ts:60,80`) and `publish.ts:363` writes it **raw**. It publishes.
 *   2. **The author was never told anything.** `parseVdd` discards `safeParse`'s issues, so the `Color`
 *      message — written specifically to name the notation — was unreachable from every surface.
 *   3. **It fired on legitimate modern CSS.** `color-mix(in srgb, red, blue)` cannot fetch anything and
 *      voided the whole figure.
 *
 * ⇒ the paint value is neutralised in both apps (`safeColor`, `safeCanvasBackground`) and the review
 * surface NAMES the refused value (`refusedPaintsIn` → `StudentPreview`'s figure note), which is what an
 * author can act on. Nothing about the grammar changed; what changed is the blast radius of one colour.
 */
const Color = z.string();

const Stroke = z
  .object({
    color: Color,
    width: z.number().nonnegative(),
    style: StrokeStyle,
    opacity: z.number().min(0).max(1),
  })
  .partial();

const Fill = z.object({ color: Color, opacity: z.number().min(0).max(1) }).partial();

// Fields shared by every element (spec §4.3).
const baseFields = {
  id: z.string().min(1),
  z: z.number().int().optional(),
  rotation: z.number().optional(),
  stroke: Stroke.optional(),
  fill: Fill.optional(),
  opacity: z.number().min(0).max(1).optional(),
  groupId: z.string().optional(),
  link: z.object({ refType: z.string(), refId: z.string() }).partial().optional(),
};

// --- Elements (spec §4.4–4.6) ------------------------------------------------

const Rect = z.object({ ...baseFields, type: z.literal("rect"), x: z.number(), y: z.number(), width: z.number(), height: z.number(), rx: z.number().optional() });
const Circle = z.object({ ...baseFields, type: z.literal("circle"), center: Point, r: z.number().nonnegative() });
const Ellipse = z.object({ ...baseFields, type: z.literal("ellipse"), center: Point, rx: z.number().nonnegative(), ry: z.number().nonnegative() });
const Line = z.object({ ...baseFields, type: z.literal("line"), points: z.tuple([Point, Point]) });
const Polyline = z.object({ ...baseFields, type: z.literal("polyline"), points: z.array(Point).min(2) });
const Polygon = z.object({ ...baseFields, type: z.literal("polygon"), points: z.array(Point).min(3) });
const Arrow = z.object({ ...baseFields, type: z.literal("arrow"), points: z.array(Point).min(2), head: z.enum(["end", "both", "none"]).optional(), headSize: z.number().optional() });
const PointEl = z.object({ ...baseFields, type: z.literal("point"), at: Point, r: z.number().optional(), label: z.string().optional(), labelOffset: Point.optional() });
const Arc = z.object({ ...baseFields, type: z.literal("arc"), center: Point, r: z.number().nonnegative(), start: z.number(), end: z.number(), sweep: z.enum(["cw", "ccw"]).optional() });
// `d` is whitelisted to the M,L,Q,C,A,Z command subset (+ numbers/separators) so
// a renderer never sees arbitrary path commands and nothing unexpected is stored
// (spec §4.4 DD). The canvas emits primitives; `path` is a rare escape hatch.
const PATH_D = /^[MLQCAZ\s,.\-+0-9eE]*$/;
const Path = z.object({ ...baseFields, type: z.literal("path"), d: z.string().regex(PATH_D, "path.d: only M,L,Q,C,A,Z commands are allowed") });

const AngleMark = z.object({ ...baseFields, type: z.literal("angleMark"), vertex: Point, from: Point, to: Point, r: z.number().nonnegative(), label: z.string().optional(), arcs: z.number().int().min(1).optional(), variant: z.enum(["arc", "right"]).optional(), reflex: z.boolean().optional() });
const TickMark = z.object({ ...baseFields, type: z.literal("tickMark"), on: z.tuple([Point, Point]), count: z.number().int().min(1).optional(), at: z.number().min(0).max(1).optional(), size: z.number().optional() });
const ParallelMark = z.object({ ...baseFields, type: z.literal("parallelMark"), on: z.tuple([Point, Point]), count: z.number().int().min(1).optional(), at: z.number().min(0).max(1).optional(), size: z.number().optional() });

const Align = z.enum(["start", "middle", "end"]);
const TextEl = z.object({ ...baseFields, type: z.literal("text"), at: Point, value: z.string(), fontSize: z.number().optional(), fontFamily: z.enum(["sans", "serif", "mono"]).optional(), color: Color.optional(), align: Align.optional(), baseline: z.enum(["top", "middle", "alphabetic"]).optional() });
const MathEl = z.object({ ...baseFields, type: z.literal("math"), at: Point, latex: z.string(), fontSize: z.number().optional(), color: Color.optional(), align: Align.optional(), baseline: z.enum(["top", "middle", "alphabetic"]).optional() });

export const VddElement = z.discriminatedUnion("type", [
  Rect, Circle, Ellipse, Line, Polyline, Polygon, Arrow, PointEl, Arc, Path, AngleMark, TickMark, ParallelMark, TextEl, MathEl,
]);

/**
 * ⚠️ `fontFamily` IS THE THREE-WAY ENUM, NOT A FREE STRING, AND THAT IS A NARROWING. It was
 * `z.string()` while `TextEl.fontFamily` — the field it is the default FOR — has always been
 * `sans|serif|mono`, so the schema accepted `"Comic Sans"` for a renderer that maps exactly three
 * keys onto a font stack. It was also **ignored by the renderer entirely** until 2026-08-28 (TRAPS
 * T96): all 12 live figures that set it set `"sans"`, which is the fallback, so nothing on screen was
 * wrong and nothing said the field did nothing either. Safe to narrow — measured against production:
 * 12 of 12 are `"sans"`, 0 rows would newly fail `safeParse`.
 */
const Defaults = z
  .object({
    strokeColor: Color,
    strokeWidth: z.number(),
    strokeStyle: StrokeStyle,
    fillColor: Color,
    opacity: z.number().min(0).max(1),
    fontSize: z.number(),
    fontFamily: z.enum(["sans", "serif", "mono"]),
  })
  .partial();

export const VddDocument = z.object({
  schema: z.literal("vibhaga.diagram"),
  schemaVersion: z.number().int(),
  canvas: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    background: Color.optional(),
  }),
  defaults: Defaults.optional(),
  elements: z.array(VddElement),
  a11y: z.object({ title: z.string(), description: z.string() }).partial().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type VddDocument = z.infer<typeof VddDocument>;
export type VddElement = z.infer<typeof VddElement>;
export type VddDefaults = z.infer<typeof Defaults>;

/** Parse unknown data (e.g. a staged question's `diagram_dsl`) into a VDD doc, or null if invalid. */
export function parseVdd(raw: unknown): VddDocument | null {
  const parsed = VddDocument.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const CURRENT_VDD_SCHEMA_VERSION = 1;
