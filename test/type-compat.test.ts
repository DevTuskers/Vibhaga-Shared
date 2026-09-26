/**
 * Type-compatibility proof: `src/vdd-schema/types.ts` (hand-authored, mirroring
 * `Vibhaga-Web/src/components/diagram/vdd.ts` shape-for-shape) must be assignment-
 * compatible BOTH WAYS with the `z.infer` types of the Admin zod oracle. These are
 * compile-time assertions — if a field drifts (optionality, tuple arity, union
 * membership, literal types) `npm run typecheck` fails.
 */
import { describe, expect, it } from "vitest";

import type {
  VddDocument as OracleDocument,
  VddElement as OracleElement,
  VddDefaults as OracleDefaults,
} from "./oracle/admin-vdd-zod.js";
import type {
  VddDocument,
  VddElement,
  VddDefaults,
  VddRect,
  VddAngleMark,
  VddText,
  VddMath,
  VddPoint,
  VddStroke,
  VddFill,
} from "../src/vdd-schema/index.js";

/** `true` only when A and B are mutually assignable (extends in both directions). */
type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;

/* Whole-document, union, and defaults shapes. */
const _doc: MutuallyAssignable<VddDocument, OracleDocument> = true;
const _el: MutuallyAssignable<VddElement, OracleElement> = true;
const _defaults: MutuallyAssignable<VddDefaults, OracleDefaults> = true;

/* Member-wise: every element interface vs the oracle union member of the same type. */
const _rect: MutuallyAssignable<VddRect, Extract<OracleElement, { type: "rect" }>> = true;
const _angle: MutuallyAssignable<
  VddAngleMark,
  Extract<OracleElement, { type: "angleMark" }>
> = true;
const _text: MutuallyAssignable<VddText, Extract<OracleElement, { type: "text" }>> = true;
const _math: MutuallyAssignable<VddMath, Extract<OracleElement, { type: "math" }>> = true;

/* Shared sub-shapes. */
const _stroke: MutuallyAssignable<VddStroke, NonNullable<VddRect["stroke"]>> = true;
const _fill: MutuallyAssignable<VddFill, NonNullable<VddRect["fill"]>> = true;
const _point: MutuallyAssignable<VddPoint, VddRect["x"] extends number ? [number, number] : never> =
  true;

describe("type compatibility (compile-time; this test documents the assertion)", () => {
  it("uses the mutually-assignable constants above so unused-var lint sees them", () => {
    expect([_doc, _el, _defaults, _rect, _angle, _text, _math, _stroke, _fill, _point]).toEqual(
      Array(10).fill(true),
    );
  });
});
