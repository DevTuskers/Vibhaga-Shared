/**
 * `a11yIssues` — the advisory Phase-4 lint. It is NOT part of `parseVddDocument`
 * acceptance (the schema keeps `a11y` fully optional), so these tests assert the two
 * stay independent: a doc can parse clean and still carry a11y issues.
 */
import { describe, expect, it } from "vitest";

import { a11yIssues, parseVddDocument } from "../src/vdd-schema/index.js";
import { TRIANGLE } from "./fixtures/golden.js";

const MIN_DOC = {
  schema: "vibhaga.diagram",
  schemaVersion: 1,
  canvas: { width: 10, height: 10 },
  elements: [],
};

describe("a11yIssues", () => {
  it("flags both fields when a11y is absent — while the doc still parses", () => {
    const res = parseVddDocument(MIN_DOC);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(a11yIssues(res.value).map((i) => i.path)).toEqual([
      ["a11y", "title"],
      ["a11y", "description"],
    ]);
  });

  it("flags missing, non-string and blank-after-trim values", () => {
    const doc = {
      ...MIN_DOC,
      a11y: { title: "   ", description: 42 },
    };
    const res = parseVddDocument(doc);
    // title:"   " and description:42 are schema-valid strings/objects? — description:42 is NOT.
    expect(res.ok).toBe(false);
    // a11yIssues is advisory and works on any doc-shaped value the caller holds:
    expect(a11yIssues(doc as never).map((i) => i.path)).toEqual([
      ["a11y", "title"],
      ["a11y", "description"],
    ]);

    const blankTitle = { ...MIN_DOC, a11y: { title: " \t\n ", description: "ok" } };
    const r2 = parseVddDocument(blankTitle);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(a11yIssues(r2.value).map((i) => i.path)).toEqual([["a11y", "title"]]);
  });

  it("returns [] for a fully described document", () => {
    const res = parseVddDocument(TRIANGLE);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(a11yIssues(res.value)).toEqual([]);
  });

  it("flags only the missing half", () => {
    const res = parseVddDocument({ ...MIN_DOC, a11y: { description: "a figure" } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(a11yIssues(res.value).map((i) => i.path)).toEqual([["a11y", "title"]]);
  });
});
