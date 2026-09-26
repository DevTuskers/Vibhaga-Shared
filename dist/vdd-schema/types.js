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
export const CURRENT_VDD_SCHEMA_VERSION = 1;
