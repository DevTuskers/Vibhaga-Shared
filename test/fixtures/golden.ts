/**
 * Ported verbatim (import line adjusted) from
 * `Vibhaga-Admin/src/components/diagram/fixtures.ts` — the three worked golden figures
 * from the DSL spec (§7), encoded as VDD. Byte-identical with `Vibhaga-Web`'s copy.
 */
import type { VddDocument } from "../../src/vdd-schema/index.js";

/** §7.1 — Triangle ABC with marked angles (diagram c6f78d09…). */
export const TRIANGLE: VddDocument = {
  schema: "vibhaga.diagram",
  schemaVersion: 1,
  canvas: { width: 680, height: 520, background: "transparent" },
  defaults: { strokeColor: "#1f2937", strokeWidth: 2, fontSize: 22 },
  elements: [
    { id: "tri", type: "polygon", points: [[500, 120], [540, 380], [150, 430]], fill: { color: "none" } },
    { id: "A", type: "point", at: [500, 120], label: "A", labelOffset: [10, -12] },
    { id: "B", type: "point", at: [540, 380], label: "B", labelOffset: [16, 4] },
    { id: "C", type: "point", at: [150, 430], label: "C", labelOffset: [-22, 10] },
    { id: "angA", type: "angleMark", vertex: [500, 120], from: [540, 380], to: [150, 430], r: 46, label: "72°" },
    { id: "angB", type: "angleMark", vertex: [540, 380], from: [500, 120], to: [150, 430], r: 46, label: "58°" },
    { id: "angC", type: "angleMark", vertex: [150, 430], from: [500, 120], to: [540, 380], r: 46, label: "x" },
  ],
  a11y: {
    title: "Triangle ABC",
    description: "Triangle with vertices A, B, C. Angle at A is 72 degrees, angle at B is 58 degrees, angle at C is unknown x.",
  },
};

/** §7.2 — Circle: central & inscribed angle (diagram 440195a1…). */
export const CIRCLE: VddDocument = {
  schema: "vibhaga.diagram",
  schemaVersion: 1,
  canvas: { width: 760, height: 620, background: "transparent" },
  defaults: { strokeColor: "#1f2937", strokeWidth: 2, fontSize: 22 },
  elements: [
    { id: "circ", type: "circle", center: [380, 300], r: 200, fill: { color: "none" } },
    { id: "segOA", type: "line", points: [[380, 300], [240, 440]] },
    { id: "segOB", type: "line", points: [[380, 300], [520, 440]] },
    { id: "segCA", type: "line", points: [[580, 300], [240, 440]] },
    { id: "segCB", type: "line", points: [[580, 300], [520, 440]] },
    { id: "segAB", type: "line", points: [[240, 440], [520, 440]] },
    { id: "O", type: "point", at: [380, 300], label: "O", labelOffset: [-18, -8] },
    { id: "A", type: "point", at: [240, 440], label: "A", labelOffset: [-22, 12] },
    { id: "B", type: "point", at: [520, 440], label: "B", labelOffset: [12, 12] },
    { id: "C", type: "point", at: [580, 300], label: "C", labelOffset: [14, 0] },
    { id: "angO", type: "angleMark", vertex: [380, 300], from: [240, 440], to: [520, 440], r: 54, label: "72°" },
    { id: "angC", type: "angleMark", vertex: [580, 300], from: [240, 440], to: [520, 440], r: 44, label: "x" },
  ],
  a11y: {
    title: "Circle with centre O",
    description: "Circle centre O with points A, B, C on the circumference. Central angle AOB = 72 degrees; inscribed angle ACB = x. Radii OA, OB and chords CA, CB, AB are drawn.",
  },
};

/** §7.3 — Probability sample-space grid with a math label + a Sinhala-safe text label. */
export const PROBABILITY: VddDocument = {
  schema: "vibhaga.diagram",
  schemaVersion: 1,
  canvas: { width: 720, height: 560, background: "transparent" },
  defaults: { strokeColor: "#1f2937", strokeWidth: 2, fontSize: 18 },
  elements: [
    { id: "grid1", type: "line", points: [[120, 80], [120, 440]], stroke: { color: "#9ca3af", width: 1, style: "dotted" } },
    { id: "xaxis", type: "arrow", points: [[100, 440], [640, 440]], head: "end" },
    { id: "yaxis", type: "arrow", points: [[120, 460], [120, 60]], head: "end" },
    { id: "xlabel", type: "text", at: [560, 470], value: "dice", align: "middle" },
    { id: "ylabel", type: "text", at: [70, 80], value: "කාසිය", align: "middle" },
    { id: "ty1", type: "text", at: [96, 300], value: "H", align: "end" },
    { id: "ty2", type: "text", at: [96, 360], value: "T", align: "end" },
    { id: "pHR1", type: "point", at: [180, 300], r: 4 },
    { id: "prob", type: "math", at: [430, 150], latex: "P(R)=\\frac{2}{6}", fontSize: 24 },
  ],
  a11y: {
    title: "Probability sample space grid",
    description: "A grid with dice on the x-axis and coin (H/T) on the y-axis; a plotted outcome point and the probability P(R)=2/6.",
  },
};

export const GOLDEN_FIXTURES = { TRIANGLE, CIRCLE, PROBABILITY } as const;
