/**
 * Advisory a11y completeness — the Phase-4 `validate` surface wants "this figure
 * carries a real accessible name + description" reported per document. Deliberately
 * NOT part of `parseVddDocument` acceptance: the schema keeps `a11y` fully optional
 * (every live figure predates the requirement), so this is a separate lint the caller
 * decides how to surface.
 */
/**
 * One `VddIssue` per missing-or-blank `a11y` field — `["a11y","title"]` and/or
 * `["a11y","description"]`. "Missing" covers an absent `a11y` object and a non-string
 * or whitespace-only value (blank after `.trim()`).
 */
export function a11yIssues(doc) {
    const issues = [];
    const a11y = doc.a11y;
    if (typeof a11y?.title !== "string" || a11y.title.trim() === "") {
        issues.push({
            path: ["a11y", "title"],
            message: "a11y.title: a real title is required",
        });
    }
    if (typeof a11y?.description !== "string" || a11y.description.trim() === "") {
        issues.push({
            path: ["a11y", "description"],
            message: "a11y.description: a real description is required",
        });
    }
    return issues;
}
