/**
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * VDD PAINT SAFETY — the colour grammar every authored paint value must satisfy.
 *
 * ⚠️ THIS IS A SECURITY MODULE, NOT A TYPOGRAPHY ONE, AND IT EXISTS BECAUSE AN AUTHORED `diagram_dsl`
 * MADE THE SURFACE FETCH OFF-SITE URLS IN REAL CHROMIUM: **2 requests from 3 call sites** — the two
 * paint servers pointed at the same `p.svg`, so three call sites yielded two unique URLs — and **7
 * `url()` paints in computed style** (`div.background-image`, `path.fill`, `line.stroke`, `rect.fill`,
 * `rect.stroke`, `text.fill`, `tspan.fill`). ⚠️ "Three GETs" was written here, in `colors.test.ts`, in
 * both renderers and in both `AGENTS.md`; the number of *requests* is 2 and the number of *call sites*
 * is 3, and conflating them is how a measured fact turns into a slogan. A VDD's colour fields were
 * typed `z.string()` in Admin and `string` in Web, and the renderer put them straight into CSS:
 *
 *   canvas.background   →  `style={{ background: "url(https://…/track.png)" }}`   (a CSS image)
 *   element stroke.color →  `style={{ stroke: "url(https://…/p.svg#g)" }}`        (an SVG paint server)
 *   element fill.color   →  `style={{ fill:   "url(https://…/p.svg#g)" }}`        (an SVG paint server)
 *
 * Staged documents are written by AGENTS (`Vibhaga-Docs/decisions/0008`), so the URL is
 * attacker-chosen rather than operator-chosen. In Admin the review page sits behind Cloudflare Access,
 * so a fetch leaks the operator's IP, User-Agent and Referer **from inside the perimeter** and confirms
 * that a specific human opened a specific question. And the same DSL is served to CHILDREN through
 * Web's copy of the renderer, where the same three call sites exist. Pre-existing in both repos;
 * markdown Phase 3 widened it by rendering four more diagrams per question on the review surface.
 *
 * ⚠️ AN ALLOWLIST GRAMMAR, NOT A DENYLIST OF FUNCTION NAMES, and the difference is the whole point.
 * `url(` is the obvious one; `image-set(`, `-webkit-image-set(`, `element(`, `src(`, `cross-fade(` and
 * `paint(` are the ones a denylist forgets, `var(--x)` is the one that defers the decision to a
 * stylesheet, and CSS escapes (`\75 rl(…)`) are the one that defeats substring matching entirely. So
 * nothing is rejected by name: a paint value is a hex triplet/quad, a bare CSS keyword, or ONE call to
 * a listed COLOUR function whose arguments contain no further parentheses. Every fetching notation is
 * outside that grammar by construction, including the ones nobody has invented yet.
 *
 * ⚠️ IT IS ENFORCED AT THE RENDERER, IN BOTH APPS, AND THE SCHEMA NO LONGER REFUSES THE DOCUMENT — a
 * correction, and the reason is measured. For one round Admin's zod schema rejected a whole VDD for one
 * out-of-grammar colour, so on the SAME stored document, in real Chromium: Admin drew **no `<svg>`** and
 * printed *"…not valid VDD, so a student sees no figure here"*, while Web drew the figure with the
 * stroke neutralised to `rgb(31,41,55)`. Both made **0** off-site requests — so the security outcome was
 * identical and the review surface's sentence was **false**: the student does see a figure. It also
 * fired on legitimate modern CSS (`color-mix(in srgb, red, blue)`), and the documented rationale ("the
 * author must be told the document is not publishable") was false too — `Vibhaga-API` types
 * `diagram_dsl: z.unknown().optional()` and `publish.ts` writes it raw, so it publishes fine. ⇒ both
 * renderers neutralise, the paint value is the only thing lost, and the author is told **which** colour
 * was refused and why (`refusedPaintsIn` below, rendered by Admin's review surface). The renderer is the
 * right place regardless: Web's `parseVdd` is deliberately a light structural guard that never walks
 * elements (`AGENTS.md` §8 — zod is kept out of the student bundle), and `DiagramRenderer` is also
 * called with in-repo fixtures that never pass through `parseVdd` at all.
 *
 * ⚠️ BYTE-IDENTICAL IN `Vibhaga-Admin` AND `Vibhaga-Web` BY **DISCIPLINE**, AND THE CHECKSUM IS NOT WHAT
 * KEEPS THEM SO. `vdd.ts` and the renderer cannot be shared verbatim — Admin's is zod, Web's is plain
 * TypeScript by decision — which is exactly how a security rule ends up written twice and fixed once.
 * This file and `colors.test.ts` are copies kept in lock-step **by hand**; `colors.test.ts` hashes the
 * pair and pins the digest, which catches *"edited one of the two files and forgot the constant"*
 * **inside one repo**. ⚠️ It cannot see a second checkout, so it does NOT catch the one-sided fix it
 * exists to prevent: append a line to one repo's copy, recompute **that repo's own** digest, and both
 * suites are green while `diff -q` reports the files DIVERGED (measured). The cross-repo half is a human
 * step — `diff -r src/components/diagram/colors.{ts,test.ts}` against the sibling checkout — exactly as
 * `src/lib/markdown/lockstep.test.tsx` says of the markdown four. Change it here ⇒ copy to the sibling
 * repo ⇒ recompute the digest in both ⇒ `diff` to prove it.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
/** The paint values a caller may pass through untouched. */
export declare function isSafeColor(value: unknown): value is string;
/**
 * The fetching notations, named — for a legible error message and for a test that can assert the three
 * MECHANISMS that were measured rather than "some string was rejected".
 *
 * ⚠️ NOT THE ENFORCEMENT. `isSafeColor` rejects these because they are outside its grammar, not
 * because they are on this list; a value that defeats this list still has to satisfy the grammar.
 */
export declare const FETCHING_NOTATIONS: readonly ["url(", "image-set(", "-webkit-image-set(", "image(", "element(", "src(", "cross-fade(", "paint(", "var("];
/**
 * Names the fetching notation a rejected value used, if it used a recognisable one.
 *
 * ⚠️ THE OUTERMOST ONE, i.e. the earliest by POSITION and not the first by list order. `image-set(url(…)
 * 1x)` contains both, and reporting the inner `url(` would name the wrong mechanism in the message a
 * human reads.
 */
export declare function fetchingNotationIn(value: string): string | null;
/**
 * A paint value for the renderer: the authored colour when it is safe, the fallback when it is not.
 *
 * ⚠️ NEUTRALISE, DO NOT THROW, AND DO NOT REFUSE THE DOCUMENT EITHER. One hostile colour must not blank
 * a figure a student is waiting for, and on the review surface it must not turn into an "unparseable
 * VDD" note that sends an author looking for a typo — nor into a note claiming a student sees no figure
 * when a student does. The figure draws in the default ink in BOTH apps; the review surface tells the
 * author WHICH value was dropped, from `refusedPaintsIn` below.
 */
export declare function safeColor<T extends string | undefined>(value: unknown, fallback: T): string | T;
/**
 * The canvas background, as a CSS `background` value — or `undefined` for "paint nothing".
 *
 * ⚠️ `transparent` AND `none` COLLAPSE TO `undefined` deliberately: the renderer's existing contract is
 * that a transparent canvas sets no `background` at all, so the white paper plate behind it shows
 * through. `Vibhaga-Docs/technical/diagram-dsl-spec.md` §4.2 types this field as a **color**, and every
 * value in the live corpus is `"transparent"`, so constraining it to the colour grammar takes nothing
 * away from an author and removes a CSS *image* channel entirely.
 */
export declare function safeCanvasBackground(value: unknown): string | undefined;
/**
 * The keys of a VDD that reach CSS as a paint value — the whole set, from the spec's §4.
 *
 * ⚠️ THE WALK IS KEYED ON THESE NAMES, so a new paint field in the spec needs one entry here or its
 * refusal is silent on the review surface. `background` is `canvas.background`; `color` covers
 * `stroke.color`, `fill.color`, `text.color` and `math.color`; the two `defaults` keys are camelCase.
 */
export declare const PAINT_FIELDS: readonly ["color", "background", "strokeColor", "fillColor"];
/** One authored paint value the grammar refused, and where it was authored. */
export interface RefusedPaint {
    /** Where it sits in the document — `canvas.background`, `elements[3].stroke.color`, … */
    readonly path: string;
    /** The authored value, as stored (trimmed, and truncated for display). */
    readonly value: string;
    /** Why it is not a paint value, in the words the author needs. */
    readonly reason: string;
}
/**
 * Why this value is not a paint value — the sentence an author reads.
 *
 * ⚠️ IT NAMES THE MECHANISM RATHER THAN SAYING "invalid colour", because the commonest cause is a value
 * that was never a colour at all: telling somebody their `url(https://…)` is an invalid colour sends
 * them looking for a typo in a hostname.
 */
export declare function paintRefusalReason(value: string): string;
/**
 * Every authored paint value in a document that the grammar refuses, with its path and reason.
 *
 * ⚠️ THIS IS THE HALF THE AUTHOR NEVER GOT. For one round the only surface a refusal reached was
 * `safeParse`'s issue list, which `parseVdd` **discards** (`return parsed.success ? parsed.data : null`),
 * so the `Color` message — carefully worded to name the notation — was unreachable from every screen in
 * the product. A rule nobody is told about is a rule an author cannot satisfy.
 *
 * ⚠️ DEPTH-BOUNDED. `meta` is `Record<string, unknown>`, i.e. arbitrary JSON of arbitrary depth, and this
 * runs during render on a review surface: a 10 000-deep authored object must not overflow the stack where
 * the previous shape merely mis-drew a figure.
 */
export declare function refusedPaintsIn(raw: unknown, path?: string, depth?: number): RefusedPaint[];
