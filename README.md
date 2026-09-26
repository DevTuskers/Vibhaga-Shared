# @vibhaga/shared

The shared TypeScript kernel for the Vibhaga umbrella (`Vibhaga-Admin`, `Vibhaga-Web`,
`Vibhaga-API`) — modules that used to be hand-copied across repos. **Zero runtime
dependencies.** Public repo: never commit production content, real question data, or
secrets.

## Modules

### `@vibhaga/shared/vdd-schema`

The Vibhaga Diagram DSL (VDD) schema, strict parser and paint grammar — formerly
`src/components/diagram/{vdd.ts,colors.ts}` in both app repos (spec:
`Vibhaga-Docs/technical/diagram-dsl-spec.md`; playground plan Phase 2).

```ts
import {
  parseVdd,            // (raw: unknown) => VddDocument | null — convenience wrapper
  parseVddDocument,    // (raw: unknown) => VddResult<VddDocument> — strict, all issues
  parseVddElement,     // (raw: unknown) => VddResult<VddElement> — the StudentPreview drop contract
  a11yIssues,          // (doc: VddDocument) => VddIssue[] — advisory a11y lint (Phase 4)
  isSafeColor, safeColor, safeCanvasBackground,
  FETCHING_NOTATIONS, fetchingNotationIn,
  PAINT_FIELDS, paintRefusalReason, refusedPaintsIn,
  CURRENT_VDD_SCHEMA_VERSION,   // = 1
  type VddDocument, type VddElement, type VddRect /* …all element interfaces */,
  type VddDefaults, type VddPoint, type VddStroke, type VddFill,
  type VddStrokeStyle, type VddAlign, type VddBaseline,
  type VddIssue, type VddResult, type RefusedPaint,
} from "@vibhaga/shared/vdd-schema";
```

`VddResult<T>` is `{ ok: true; value: T } | { ok: false; errors: VddIssue[] }`;
`VddIssue` is `{ path: (string | number)[]; message: string }`.

#### Strict semantics — one parser, no lenient mode

`parseVddDocument`/`parseVddElement` are **behaviourally identical** to Admin's former
zod-4.4.3 schema — identical accept/reject, output, and issue paths (multiset) vs the
zod 4.4.3 oracle on the differential suite (`test/oracle/admin-vdd-zod.ts` is a
byte-verbatim copy pinned to a git sha; `test/differential.test.ts` runs ~13k fixture +
generated cases through both):

- same accept/reject on every input;
- on success the output deep-equals zod's: **unknown keys stripped at every object
  level**, `meta` record values kept as-is, a new object — never the input;
- on failure `errors` reports every issue with zod-style paths addressing the
  element, e.g. `["elements", 3, "stroke", "width"]` — messages name the field in
  plain English (`path.d`'s regex message is kept verbatim);
- `number()` rejects NaN/±Infinity; `int()` mirrors zod's `safeint` (a type-level
  `Number.isInteger` that skips the check stage, plus an implicit safe-range check
  that reports alongside `min`/`max`); tuples are exact length (too-short
  reports only the length issue; too-long also validates items 0..expected−1, matching
  zod); `type` is a discriminated union; optional-vs-`undefined` and `in`-semantics
  field presence (prototype/getter/Proxy fields) match zod;
- **one documented path-shape exception:** inside `meta`, an enumerable *symbol* key
  fails the record as zod's does, but `VddIssue.path` is `(string|number)[]`, so the
  symbol segment is emitted as `String(sym)` (e.g. `["meta","Symbol(x)"]`) rather than
  the symbol itself;
- **one deliberate behavioural divergence:** a field value whose `.length` is a
  `Symbol` (e.g. `{"id": {"length": Symbol()}}`) makes zod's coerced `length >= min`
  comparison **throw** a `TypeError` out of `safeParse`; this parser returns a normal
  issue instead — a parser on a Worker request path must never throw. Both reject the
  input; the differential suite encodes it as "oracle threw ⇒ parser returns
  `ok: false`".

Paint safety is **not** a schema rule: hostile colours parse fine (the figure must still
draw) and are refused at the render boundary by `safeColor`/`safeCanvasBackground`;
`refusedPaintsIn` names every refused value + path for the author.

`a11yIssues` is **advisory** — `a11y` is schema-optional, so this is a separate lint
(`["a11y","title"]` / `["a11y","description"]` when missing or blank), not a parse rule.

## Consuming it

This package is consumed as a **git dependency pinned to a tag** — never a branch,
never `#latest`:

```jsonc
// package.json
"dependencies": {
  "@vibhaga/shared": "git+https://github.com/DevTuskers/Vibhaga-Shared.git#v0.1.0"
}
```

Use the explicit `git+https://` form, not npm's `github:` shorthand — the shorthand
serializes to `git+ssh://git@github.com/…`, which needs SSH credentials even for this
public repo in anything that takes the URL literally (`git` itself, non-npm package
managers). Write the line into `package.json` directly: `npm install <pkg>@<git+https
url>` normalizes GitHub URLs back to `github:` on save.

`dist/` is **committed**, so the git dep needs no build step and no `prepare` script.
Works with Next 16 (bundler resolution), Vitest, wrangler/workerd, and plain Node 24
ESM. The package is `"type": "module"` + `"sideEffects": false` — tree-shakeable, no
side effects on import.

## The bump procedure

1. Make the change here; `npm run build` and commit **src + dist together**
   (`npm run check:dist` fails if dist is stale).
2. Tag a release: `git tag vX.Y.Z && git push --tags`.
3. Pin-bump PRs in each consumer (`Vibhaga-Admin`, `Vibhaga-Web`, `Vibhaga-API`) to the
   new tag.
4. Re-run the consumers' suites. **Behavioural-equivalence rule:** a parser/grammar
   change must keep the differential suite green against the oracle — if the schema
   itself is meant to change, update the oracle file first (refresh from the new Admin
   sha, or hand-edit it as the new spec) and note it in the commit message.

## Development

```sh
npm ci          # install devDeps (typescript 5.9.3, vitest 4.1.9, zod 4.4.3 oracle-only)
npm run typecheck
npm test
npm run build
npm run check:dist   # build + fail if committed dist/ is stale
```

Node 24. `zod` is a **devDependency only** — it powers the test oracle; the runtime
code has zero dependencies.
