/**
 * The strict VDD parser — a dependency-free reimplementation of the zod schema that
 * used to live in `Vibhaga-Admin/src/components/diagram/vdd.ts` (zod 4.4.3). Behaviour
 * is the contract, proven by `test/differential.test.ts` against that very file (the
 * test oracle): same accept/reject on every input, success output deep-equal to zod's
 * (unknown keys stripped at every object level, `meta` record values kept as-is, new
 * objects — never the input), and zod-style issue paths addressing the element, e.g.
 * `["elements", 3, "stroke", "width"]`.
 *
 * Semantics mirrored from zod 4 (measured, not assumed):
 *   - `number()` rejects NaN, ±Infinity, BigInt, non-numbers.
 *   - `int()` is a SAFE-integer check (2**53 rejects).
 *   - tuples are exact-length; `array().min(n)` fails at the array's own path.
 *   - the discriminated union on `type` reports ONE issue at `["type"]` when the
 *     discriminator is missing/invalid, otherwise the chosen member's issues verbatim.
 *   - an optional field present-but-`undefined` is kept (`{key: undefined}`); absent is
 *     omitted; required-but-`undefined` is an error.
 *   - `record` values accept any non-array object and are copied shallowly.
 *   - objects reject arrays, `null`, and non-objects; all issues are collected, not
 *     only the first.
 */
import type { VddDocument, VddElement } from "./types.js";
export interface VddIssue {
    path: (string | number)[];
    message: string;
}
export type VddResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    errors: VddIssue[];
};
/**
 * The strict document parser — same accept/reject and same output shape as Admin's
 * `VddDocument.safeParse` (zod 4.4.3). On failure `errors` holds every issue, with
 * zod-style paths addressing the element (`["elements", 3, "stroke", "width"]`).
 */
export declare function parseVddDocument(raw: unknown): VddResult<VddDocument>;
/**
 * The strict element parser — same verdict as Admin's `VddElement.safeParse`, used where a
 * consumer drops single elements that fail (Admin's `StudentPreview`).
 */
export declare function parseVddElement(raw: unknown): VddResult<VddElement>;
/** Parse unknown data (e.g. a staged question's `diagram_dsl`) into a VDD doc, or null if invalid. */
export declare function parseVdd(raw: unknown): VddDocument | null;
