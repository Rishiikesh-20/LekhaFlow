/**
 * ============================================================================
 * LEKHAFLOW - CALLIGRAPHY BRUSH
 * ============================================================================
 *
 * Angle-sensitive nib brush that simulates a flat calligraphy pen.
 * The visible width depends on the *direction of travel* relative to a
 * fixed nib angle — strokes perpendicular to the nib are thick; strokes
 * parallel to it are thin.
 *
 * Algorithm:
 *  1. Streamline input points (EMA).
 *  2. At each point compute the travel direction.
 *  3. Project the nib axis onto the perpendicular of the travel direction
 *     to derive an effective half-width.
 *  4. Build left/right outlines from that width.
 *  5. Close and return as SVG path.
 */

import type { Brush, BrushOptions, BrushPoint } from "./types";

// ============================================================================
// HELPERS
// ============================================================================

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function streamline(
	points: ReadonlyArray<BrushPoint>,
	factor: number,
): BrushPoint[] {
	if (points.length === 0) return [];
	const first = points[0] as BrushPoint;
	const result: BrushPoint[] = [{ ...first }];
	const t = Math.max(0, Math.min(1, factor));

	for (let i = 1; i < points.length; i++) {
		const prev = result[result.length - 1] as BrushPoint;
		const curr = points[i] as BrushPoint;
		result.push({
			x: lerp(prev.x, curr.x, 1 - t),
			y: lerp(prev.y, curr.y, 1 - t),
			pressure: curr.pressure,
		});
	}
	return result;
}

// ============================================================================
// CALLIGRAPHY MATH
// ============================================================================

/** Default nib angle in radians (30° — a common italic calligraphy angle). */
const DEFAULT_NIB_ANGLE = Math.PI / 6;

/** Minimum width ratio so the stroke never fully vanishes. */
const MIN_WIDTH_RATIO = 0.1;

interface Vec2 {
	x: number;
	y: number;
}

/**
 * Compute the effective half-width at a point given the travel direction.
 *
 * The nib is modelled as a line segment of length `size` centred on the pen
 * tip, rotated to `nibAngle`. The visible cross-section perpendicular to
 * the direction of travel determines the rendered width.
 */
function effectiveHalfWidth(
	dirX: number,
	dirY: number,
	nibAngle: number,
	size: number,
	pressure: number,
	thinning: number,
): number {
	const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
	// Unit perpendicular to travel direction (rotated 90°)
	const perpX = -dirY / len;
	const perpY = dirX / len;

	// Nib axis vector
	const nibX = Math.cos(nibAngle);
	const nibY = Math.sin(nibAngle);

	// Projection of nib onto perpendicular = how much of the nib is visible
	const projection = Math.abs(nibX * perpX + nibY * perpY);
	const ratio = Math.max(MIN_WIDTH_RATIO, projection);

	const basePressure = lerp(1, pressure, thinning);
	return (size / 2) * ratio * basePressure;
}

// ============================================================================
// OUTLINE GENERATION
// ============================================================================

function buildCalligraphyOutline(
	pts: BrushPoint[],
	size: number,
	nibAngle: number,
	thinning: number,
	simulate: boolean,
): { left: Vec2[]; right: Vec2[] } {
	const left: Vec2[] = [];
	const right: Vec2[] = [];

	for (let i = 0; i < pts.length; i++) {
		const curr = pts[i] as BrushPoint;
		const prev = i > 0 ? (pts[i - 1] as BrushPoint) : null;
		const next = i < pts.length - 1 ? (pts[i + 1] as BrushPoint) : null;

		// Travel direction
		let dx: number;
		let dy: number;
		if (next) {
			dx = next.x - curr.x;
			dy = next.y - curr.y;
		} else if (prev) {
			dx = curr.x - prev.x;
			dy = curr.y - prev.y;
		} else {
			dx = 1;
			dy = 0;
		}

		// Pressure
		let pressure: number;
		if (curr.pressure !== undefined && curr.pressure > 0) {
			pressure = curr.pressure;
		} else if (simulate && prev) {
			const d = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
			pressure = lerp(0.75, 0.25, Math.min(d / 50, 1));
		} else {
			pressure = 0.5;
		}

		const hw = effectiveHalfWidth(dx, dy, nibAngle, size, pressure, thinning);

		// Perpendicular offset
		const len = Math.sqrt(dx * dx + dy * dy) || 1;
		const nx = -dy / len;
		const ny = dx / len;

		left.push({ x: curr.x + nx * hw, y: curr.y + ny * hw });
		right.push({ x: curr.x - nx * hw, y: curr.y - ny * hw });
	}

	return { left, right };
}

// ============================================================================
// SVG PATH
// ============================================================================

function outlineToSvgPath(left: Vec2[], right: Vec2[]): string {
	if (left.length === 0) return "";

	const first = left[0] as Vec2;
	let d = `M ${first.x},${first.y}`;

	for (let i = 1; i < left.length; i++) {
		const p = left[i] as Vec2;
		d += ` L ${p.x},${p.y}`;
	}

	for (let i = right.length - 1; i >= 0; i--) {
		const p = right[i] as Vec2;
		d += ` L ${p.x},${p.y}`;
	}

	d += " Z";
	return d;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const CALLIGRAPHY_DEFAULTS: Required<
	Pick<BrushOptions, "size" | "thinning" | "streamline" | "simulatePressure">
> = {
	size: 20,
	thinning: 0.6,
	streamline: 0.35,
	simulatePressure: true,
};

// ============================================================================
// CALLIGRAPHY BRUSH
// ============================================================================

export const CalligraphyBrush: Brush = {
	type: "calligraphy",
	displayName: "Calligraphy Brush",

	generatePath(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): string {
		if (points.length === 0) return "";

		const size = options.size ?? CALLIGRAPHY_DEFAULTS.size;

		// Single point → nib-shaped diamond
		if (points.length === 1) {
			const p = points[0] as BrushPoint;
			const half = size / 2;
			const nibX = Math.cos(DEFAULT_NIB_ANGLE) * half;
			const nibY = Math.sin(DEFAULT_NIB_ANGLE) * half;
			const perpX = -Math.sin(DEFAULT_NIB_ANGLE) * half * MIN_WIDTH_RATIO;
			const perpY = Math.cos(DEFAULT_NIB_ANGLE) * half * MIN_WIDTH_RATIO;
			return (
				`M ${p.x + nibX},${p.y + nibY} ` +
				`L ${p.x + perpX},${p.y + perpY} ` +
				`L ${p.x - nibX},${p.y - nibY} ` +
				`L ${p.x - perpX},${p.y - perpY} Z`
			);
		}

		const thinning = options.thinning ?? CALLIGRAPHY_DEFAULTS.thinning;
		const streamlineFactor =
			options.streamline ?? CALLIGRAPHY_DEFAULTS.streamline;
		const simulate =
			options.simulatePressure ?? CALLIGRAPHY_DEFAULTS.simulatePressure;

		const smoothed = streamline(points, streamlineFactor);
		const { left, right } = buildCalligraphyOutline(
			smoothed,
			size,
			DEFAULT_NIB_ANGLE,
			thinning,
			simulate,
		);

		return outlineToSvgPath(left, right);
	},
};
