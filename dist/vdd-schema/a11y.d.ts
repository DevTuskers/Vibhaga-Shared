/**
 * Advisory a11y completeness — the Phase-4 `validate` surface wants "this figure
 * carries a real accessible name + description" reported per document. Deliberately
 * NOT part of `parseVddDocument` acceptance: the schema keeps `a11y` fully optional
 * (every live figure predates the requirement), so this is a separate lint the caller
 * decides how to surface.
 */
import type { VddIssue } from "./parse.js";
import type { VddDocument } from "./types.js";
/**
 * One `VddIssue` per missing-or-blank `a11y` field — `["a11y","title"]` and/or
 * `["a11y","description"]`. "Missing" covers an absent `a11y` object and a non-string
 * or whitespace-only value (blank after `.trim()`).
 */
export declare function a11yIssues(doc: VddDocument): VddIssue[];
