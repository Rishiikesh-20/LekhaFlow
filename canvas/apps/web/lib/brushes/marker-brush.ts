/**
 * ============================================================================
 * LEKHAFLOW - MARKER BRUSH
 * ============================================================================
 *
 * Flat / chisel-tip marker brush.
 * The stroke width does NOT vary with pressure — instead, the *opacity*
 * conceptually changes (the caller decides how to use that). The path itself
 * is a constant-width ribbon with a fixed 45° chisel angle, giving it the
 * characteristic felt-tip marker look.
 *
 * Algorithm:
 *  1. Streamline points (EMA).
 *  2. At each point compute two offset corners along the fixed chisel axis.
 *  3. Build left/right outlines and close the path.
 */

import type { Brush, BrushOptions, BrushPoint } from "./types";

// ============================================================================
// HELPERS
// ============================================================================

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * EMA streamlining — returns a *new* array, never mutates input.
 */
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
// OUTLINE
// ============================================================================

interface Vec2 {
	x: number;
	y: number;
}

/** Fixed chisel angle in radians (45°). */
const CHISEL_ANGLE = Math.PI / 4;
const COS_CHISEL = Math.cos(CHISEL_ANGLE);
const SIN_CHISEL = Math.sin(CHISEL_ANGLE);

/**
 * Build left/right outlines along a fixed chisel axis.
 * The marker tip is an elongated ellipse tilted at 45°.
 * `widthRatio` controls the aspect ratio of the chisel (0.3 = narrow tip).
 */
function buildChiselOutline(
	pts: BrushPoint[],
	size: number,
): { left: Vec2[]; right: Vec2[] } {
	const left: Vec2[] = [];
	const right: Vec2[] = [];
	const halfW = size / 2;

	for (let i = 0; i < pts.length; i++) {
		const p = pts[i] as BrushPoint;

		// Offset along the fixed chisel axis
		const ox = COS_CHISEL * halfW;
		const oy = SIN_CHISEL * halfW;

		left.push({ x: p.x + ox, y: p.y + oy });
		right.push({ x: p.x - ox, y: p.y - oy });
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

const MARKER_DEFAULTS: Required<Pick<BrushOptions, "size" | "streamline">> = {
	size: 24,
	streamline: 0.4,
};

// ============================================================================
// MARKER BRUSH
// ============================================================================

export const MarkerBrush: Brush = {
	type: "marker",
	displayName: "Marker Brush",

	generatePath(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): string {
		if (points.length === 0) return "";

		const size = options.size ?? MARKER_DEFAULTS.size;

		// Single point → small chisel dot (diamond)
		if (points.length === 1) {
			const p = points[0] as BrushPoint;
			const halfW = size / 2;
			const ox = COS_CHISEL * halfW;
			const oy = SIN_CHISEL * halfW;
			return (
				`M ${p.x + ox},${p.y + oy} ` +
				`L ${p.x + oy},${p.y - ox} ` +
				`L ${p.x - ox},${p.y - oy} ` +
				`L ${p.x - oy},${p.y + ox} Z`
			);
		}

		const streamlineFactor = options.streamline ?? MARKER_DEFAULTS.streamline;

		const smoothed = streamline(points, streamlineFactor);
		const { left, right } = buildChiselOutline(smoothed, size);

		return outlineToSvgPath(left, right);
	},
};
