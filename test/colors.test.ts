/**
 * PORTED from `Vibhaga-Admin/src/components/diagram/colors.test.ts` (byte-identical with
 * `Vibhaga-Web`'s copy at adoption time). Only the trailing "paint contract" checksum
 * `describe` and the `paintContractDigest` machinery are dropped — those guarded the
 * two hand-copied per-repo files, which this package replaces with ONE home. Every
 * behavioural assertion is verbatim.
 */
import { describe, expect, it } from "vitest";

import {
  FETCHING_NOTATIONS,
  fetchingNotationIn,
  isSafeColor,
  paintRefusalReason,
  refusedPaintsIn,
  safeCanvasBackground,
  safeColor,
} from "../src/vdd-schema/index.js";

/* ── the three measured call sites ───────────────────────────────────────────────────────────── */

/**
 * The exact values that made real Chromium fetch off-site: **3 call sites, 2 unique URLs, 2 requests**
 * (`stroke.color` and `fill.color` both pointed at the same `p.svg`), and 7 `url()` paints in computed
 * style. ⚠️ "Three GETs" was written here and in five other places; requests and call sites are
 * different counts and the smaller one is the one a network log shows.
 *
 * ⚠️ THE SVG PAINT SERVER IS THE ONE THAT LOOKS HARMLESS. `fill: url(https://…#g)` is a legal SVG paint
 * reference, not a CSS image, so a reviewer scanning for `background-image` finds nothing — and it
 * fetches a cross-origin document all the same.
 */
const HOSTILE_PAINTS = [
  "url(https://tracker.example/track.png)",
  "url('https://tracker.example/p.svg#g')",
  'url("https://tracker.example/p.svg#g")',
  "URL(https://tracker.example/track.png)",
  "  url( https://tracker.example/track.png )  ",
  "image-set(url(https://tracker.example/a.png) 1x)",
  "-webkit-image-set(url(https://tracker.example/a.png) 1x)",
  "element(#live)",
  "src(https://tracker.example/a.png)",
  "cross-fade(url(https://tracker.example/a.png), red)",
  "paint(worklet)",
  "var(--injected)",
  "#fff url(https://tracker.example/track.png) no-repeat",
  "red;background:url(https://tracker.example/x.png)",
  // ⚠️ A CSS HEX ESCAPE. `\75` is `u`, so this IS `url(…)` to the parser and is not `url(` to any
  // substring or `startsWith` test — the reason the grammar is an allowlist.
  "\\75 rl(https://tracker.example/track.png)",
  "linear-gradient(red, url(https://tracker.example/a.png))",
  // ⚠️ A BARE IDENTIFIER THAT FETCHES, which `colors.ts` used to claim was impossible. With
  // `canvas.background: "inherit"` and a planted `background-image` on an ancestor, Chromium ISSUED THE
  // GET. Unreachable in the product today (0 figure ancestors carry a `background-image`), and refused by
  // name anyway, because "a bare identifier cannot reference a URL" is false as a security premise.
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
] as const;

/** Everything the diagram canvas, the fixtures and the live corpus actually emit. */
const REAL_PAINTS = [
  "transparent",
  "none",
  "currentColor",
  "#fff",
  "#1f2937",
  "#9ca3af",
  "#ffffffcc",
  "white",
  "rebeccapurple",
  "rgb(31, 41, 55)",
  "rgba(31,41,55,0.5)",
  "hsl(210 40% 20%)",
  "oklch(0.5 0.1 200deg / 50%)",
  // ⚠️ LEGITIMATE MODERN CSS, and refusing it was a false positive that fired the review surface's
  // security note on a value that cannot fetch anything.
  "color-mix(in srgb, red, blue)",
  "color-mix(in oklab, #1f2937 40%, white)",
] as const;

describe("VDD paint safety — the colour grammar", () => {
  it.each(HOSTILE_PAINTS)("rejects %j", (value) => {
    expect(isSafeColor(value)).toBe(false);
  });

  it.each(REAL_PAINTS)("accepts %j", (value) => {
    expect(isSafeColor(value)).toBe(true);
  });

  /**
   * ⚠️ EVERY FETCHING NOTATION, ASSERTED AS A LIST RATHER THAN AS THREE EXAMPLES. The critique named
   * `url(`, `image-set(` and `element(`; the list also carries the four a denylist forgets.
   */
  it.each(FETCHING_NOTATIONS)("rejects the %s notation whatever it wraps", (notation) => {
    expect(isSafeColor(`${notation}https://tracker.example/a.png)`)).toBe(false);
    expect(isSafeColor(`${notation})`)).toBe(false);
  });

  it("names the notation a rejected value used, for a legible message", () => {
    expect(fetchingNotationIn("url(https://x/y.png)")).toBe("url(");
    expect(fetchingNotationIn("image-set(url(https://x/y.png) 1x)")).toBe("image-set(");
    expect(fetchingNotationIn("#fff")).toBeNull();
  });

  /** Non-strings, empties and absurd lengths are not colours either. */
  it("rejects anything that is not a string, and anything unbounded", () => {
    for (const value of [undefined, null, 0, {}, [], () => {}, "", "   ", "#".repeat(200)]) {
      expect(isSafeColor(value)).toBe(false);
    }
    expect(isSafeColor(`rgb(${"0,".repeat(40)}0)`)).toBe(false);
  });

  /**
   * ⚠️ NO NESTED PARENTHESES INSIDE A COLOUR FUNCTION. This is what makes the function allowlist
   * airtight rather than merely narrow: `var()` and `calc()` cannot be smuggled inside `rgb()`.
   */
  it("allows one colour-function call and never a nested one", () => {
    expect(isSafeColor("rgb(0, 0, 0)")).toBe(true);
    expect(isSafeColor("rgb(0, 0, var(--x))")).toBe(false);
    expect(isSafeColor("rgb(0, 0, calc(1 * 2))")).toBe(false);
    expect(isSafeColor("hsl(from red h s l)")).toBe(true); // relative colour: no parens, no fetch
  });
});

describe("VDD paint safety — what the renderer and the schema do with it", () => {
  /** Neutralise, never throw: one hostile colour must not blank a figure a student is waiting for. */
  it("falls back to the default ink for an unsafe stroke or fill", () => {
    expect(safeColor("url(https://tracker.example/p.svg#g)", "#1f2937")).toBe("#1f2937");
    expect(safeColor("#abcdef", "#1f2937")).toBe("#abcdef");
    expect(safeColor(undefined, "none")).toBe("none");
    expect(safeColor("url(https://tracker.example/a.png)", undefined)).toBeUndefined();
  });

  /**
   * The canvas background is a CSS `background`, i.e. the one field where a colour and an IMAGE share a
   * property. `transparent`/`none` collapse to `undefined` because the renderer's existing contract is
   * to set no `background` at all and let the white paper plate show through.
   */
  it("drops an unsafe canvas background entirely, and keeps `transparent` meaning nothing", () => {
    expect(safeCanvasBackground("url(https://tracker.example/track.png)")).toBeUndefined();
    expect(safeCanvasBackground("transparent")).toBeUndefined();
    expect(safeCanvasBackground("none")).toBeUndefined();
    expect(safeCanvasBackground(undefined)).toBeUndefined();
    expect(safeCanvasBackground("#eef2ff")).toBe("#eef2ff");
    expect(safeCanvasBackground("  #eef2ff  ")).toBe("#eef2ff");
  });
});

describe("VDD paint safety — what the AUTHOR is told", () => {
  /**
   * ⭐ THE HALF NOBODY GOT FOR A ROUND. The only place a refusal was reported was `safeParse`'s issue
   * list, and `parseVdd` throws it away (`return parsed.success ? parsed.data : null`) — so the `Color`
   * message, written specifically to name the notation, was unreachable from every surface in the
   * product. An author saw a figure quietly drawn in the wrong ink (Web) or a note saying the document
   * was not valid VDD (Admin), and in neither case which value was at fault.
   */
  const hostileDoc = {
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

  it("names every refused paint value, with its path in the document", () => {
    expect(refusedPaintsIn(hostileDoc).map((r) => r.path)).toEqual([
      "canvas.background",
      "defaults.fillColor",
      "elements[1].fill.color",
    ]);
  });

  it("names the mechanism rather than saying `invalid colour`", () => {
    const byPath = new Map(refusedPaintsIn(hostileDoc).map((r) => [r.path, r]));
    expect(byPath.get("canvas.background")?.reason).toContain("url(");
    expect(byPath.get("canvas.background")?.value).toBe("url(https://tracker.example/track.png)");
    expect(byPath.get("defaults.fillColor")?.reason).toContain("image-set(");
    expect(byPath.get("elements[1].fill.color")?.reason).toContain("var(");
    expect(paintRefusalReason("inherit")).toContain("CSS-wide keyword");
    expect(paintRefusalReason("notacolour!")).toContain("hex");
  });

  it("says nothing at all about a healthy document", () => {
    const clean = {
      canvas: { background: "transparent" },
      defaults: { strokeColor: "#1f2937" },
      elements: [
        { id: "a", stroke: { color: "color-mix(in srgb, red, blue)" }, fill: { color: "none" } },
        { id: "b", color: "currentColor" },
      ],
    };
    expect(refusedPaintsIn(clean)).toEqual([]);
  });

  /**
   * ⚠️ ONLY PAINT KEYS. `meta`/`a11y` hold arbitrary author prose, and reporting *"`title` is not a
   * colour"* on a figure's description would be noise indistinguishable from a real finding.
   */
  it("looks only at the paint fields, never at prose", () => {
    expect(
      refusedPaintsIn({
        a11y: { title: "url(https://tracker.example/x.png)" },
        meta: { note: "not a colour either" },
        elements: [{ id: "a", type: "text", value: "url(https://tracker.example/y.png)" }],
      }),
    ).toEqual([]);
  });

  /**
   * ⚠️ DEPTH-BOUNDED, because this runs during a review-surface render and `meta` is arbitrary JSON. A
   * throw here would cost the author the screen, where the fault it reports costs them one colour.
   */
  it("never throws on absurdly nested authored data", () => {
    let nested: Record<string, unknown> = { color: "url(https://tracker.example/deep.png)" };
    for (let i = 0; i < 5000; i++) nested = { meta: nested };
    expect(() => refusedPaintsIn(nested)).not.toThrow();
    expect(refusedPaintsIn(nested)).toEqual([]);
    expect(refusedPaintsIn(null)).toEqual([]);
    expect(refusedPaintsIn("url(https://tracker.example/x.png)")).toEqual([]);
  });

  /** A 200-character hostile URL must not push the note off the review surface. */
  it("truncates the value it displays", () => {
    const long = `url(https://tracker.example/${"a".repeat(200)}.png)`;
    const [refused] = refusedPaintsIn({ canvas: { background: long } });
    expect(refused!.value.length).toBeLessThanOrEqual(49);
    expect(refused!.value.endsWith("…")).toBe(true);
  });
});
