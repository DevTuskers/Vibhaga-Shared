/**
 * `@vibhaga/shared/vdd-schema` — the one Vibhaga Diagram DSL (VDD) schema, parser and
 * paint grammar for the whole umbrella (playground Phase 2). Strict everywhere by
 * owner ruling: this is the same accept/reject as Admin's former zod schema — there is
 * no lenient entry point. Zero runtime dependencies.
 */
export * from "./types.js";
export { parseVddDocument, parseVddElement, parseVdd, } from "./parse.js";
export { isSafeColor, FETCHING_NOTATIONS, fetchingNotationIn, safeColor, safeCanvasBackground, PAINT_FIELDS, paintRefusalReason, refusedPaintsIn, } from "./colors.js";
export { a11yIssues } from "./a11y.js";
