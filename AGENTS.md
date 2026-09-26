# AGENTS.md — Vibhaga-Shared (`@vibhaga/shared`)

The shared TypeScript kernel for the Vibhaga umbrella — modules that used to be
hand-copied between `Vibhaga-Admin`, `Vibhaga-Web` and `Vibhaga-API` (see the umbrella
`AGENTS.md` and `Vibhaga-Docs/plans/2026-09-25-agent-question-playground.md` Phase 2).

## What this repo is / is NOT

- ✅ One npm package at the repo root; sources under `src/<module>/`, one `exports`
  subpath per module (`./vdd-schema` today). `dist/` is **committed** — a git dep must
  not need a build step; `check:dist` enforces it.
- ✅ **PUBLIC.** Never commit production content, real question data (incl. fixture
  dumps like `live-dsl.json`), or secrets. Synthetic fixtures only.
- ❌ Not a place for app code, renderers, or React. Types, parsers and pure helpers
  only; **zero runtime dependencies** is a hard rule (`zod` is devDep, oracle-only).
- ❌ Strict-only by owner ruling: the parser is identical to Admin's old zod schema.
  No lenient/shallow entry point — don't add one.

## Verify

`npm ci && npm run typecheck && npm test && npm run check:dist` — all four must be
clean. The heart of the suite is `test/differential.test.ts`: every fixture + ~13k
generated mutants run through both `src/vdd-schema/parse.ts` and
`test/oracle/admin-vdd-zod.ts` (byte-verbatim copy of Admin's `vdd.ts` at the sha in
its header) asserting verdict parity, deep-equal outputs, identical error-path sets,
and non-mutation. 100% or it's a bug in the parser.

## Behavioural-equivalence rule

The zod oracle is the spec made executable. If `parse.ts` and the oracle disagree, the
parser is wrong unless the schema is *deliberately* changing — in which case update
the oracle file first and say so in the commit. Keep the oracle's header sha honest
when refreshing it.

The ONE allowed divergence is named in the README: where zod *throws* (a `Symbol`
`.length` on a min-gated field makes its coerced `length >= min` throw `TypeError`),
the parser must still reject with issues — never throw, because it runs on a Worker
request path. The differential suite encodes this as "oracle threw ⇒ `ok: false`".
