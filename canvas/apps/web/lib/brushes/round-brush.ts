/**
 * ============================================================================
 * LEKHAFLOW - ROUND BRUSH
 * ============================================================================
 *
 * Classic variable-width pressure-sensitive brush.
 * Produces a smooth, filled outline path similar to perfect-freehand output.
 *
 * Algorithm:
 *  1. Streamline input points (Exponential Moving Average).
 *  2. Walk the polyline, computing a perpendicular offset at each point
 *     proportional to pressure × size × thinning.
 *  3. Build left/right outlines, then close with rounded end-caps.
 *  4. Convert the closed outline to an SVG path string.
 */

import type { Brush, BrushOptions, BrushPoint } from "./types";

// ============================================================================
// HELPERS (pure, no side-effects)
// ============================================================================

/** Linearly interpolate between two values. */
function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** Distance between two 2-D points. */
function dist(ax: number, ay: number, bx: number, by: number): number {
	const dx = bx - ax;
	const dy = by - ay;
	return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Apply EMA (Exponential Moving Average) streamlining to reduce jitter.
 * Returns a *new* array — never mutates input.
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

/**
 * Simulate pressure from speed when hardware pressure is not available.
 * Returns a number in [0.25, 0.75].
 */
function simulatePressureFromSpeed(prev: BrushPoint, curr: BrushPoint): number {
	const d = dist(prev.x, prev.y, curr.x, curr.y);
	// Fast movement → low pressure, slow → high pressure
	const normalised = Math.min(d / 50, 1);
	return lerp(0.75, 0.25, normalised);
}

/**
 * Resolve the effective pressure for a point.
 */
function resolvePressure(
	point: BrushPoint,
	prev: BrushPoint | null,
	simulate: boolean,
): number {
	if (point.pressure !== undefined && point.pressure > 0) {
		return point.pressure;
	}
	if (simulate && prev) {
		return simulatePressureFromSpeed(prev, point);
	}
	return 0.5;
}

// ============================================================================
// OUTLINE GENERATION
// ============================================================================

interface Vec2 {
	x: number;
	y: number;
}

/**
 * Produce left and right outline polylines from the streamlined centreline.
 */
function buildOutline(
	pts: BrushPoint[],
	size: number,
	thinning: number,
	simulate: boolean,
): { left: Vec2[]; right: Vec2[] } {
	const left: Vec2[] = [];
	const right: Vec2[] = [];

	for (let i = 0; i < pts.length; i++) {
		const curr = pts[i] as BrushPoint;
		const prev = i > 0 ? (pts[i - 1] as BrushPoint) : null;
		const next = i < pts.length - 1 ? (pts[i + 1] as BrushPoint) : null;

		// Direction vector (forward finite difference; backward at end)
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

		const len = Math.sqrt(dx * dx + dy * dy) || 1;
		// Unit perpendicular (rotated 90°)
		const nx = -dy / len;
		const ny = dx / len;

		const pressure = resolvePressure(curr, prev, simulate);
		const radius = (size / 2) * lerp(1, pressure, thinning);

		left.push({ x: curr.x + nx * radius, y: curr.y + ny * radius });
		right.push({ x: curr.x - nx * radius, y: curr.y - ny * radius });
	}

	return { left, right };
}

// ============================================================================
// SVG PATH CONSTRUCTION
// ============================================================================

/**
 * Build an SVG path from left + right outlines.
 * The path traces left → (end cap) → right (reversed) → (start cap) → close.
 */
function outlineToSvgPath(left: Vec2[], right: Vec2[]): string {
	if (left.length === 0) return "";

	const first = left[0] as Vec2;
	let d = `M ${first.x},${first.y}`;

	// Left outline (forward)
	for (let i = 1; i < left.length; i++) {
		const p = left[i] as Vec2;
		d += ` L ${p.x},${p.y}`;
	}

	// Right outline (reversed)
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

const ROUND_DEFAULTS: Required<
	Pick<
		BrushOptions,
		"size" | "thinning" | "smoothing" | "streamline" | "simulatePressure"
	>
> = {
	size: 16,
	thinning: 0.5,
	smoothing: 0.5,
	streamline: 0.5,
	simulatePressure: true,
};

// ============================================================================
// ROUND BRUSH
// ============================================================================

export const RoundBrush: Brush = {
	type: "round",
	displayName: "Round Brush",

	generatePath(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): string {
		if (points.length === 0) return "";

		// Single-point → small dot
		if (points.length === 1) {
			const p = points[0] as BrushPoint;
			const r = ((options.size ?? ROUND_DEFAULTS.size) / 2) * 0.4;
			return (
				`M ${p.x - r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x + r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x - r},${p.y} Z`
			);
		}

		const size = options.size ?? ROUND_DEFAULTS.size;
		const thinning = options.thinning ?? ROUND_DEFAULTS.thinning;
		const streamlineFactor = options.streamline ?? ROUND_DEFAULTS.streamline;
		const simulate =
			options.simulatePressure ?? ROUND_DEFAULTS.simulatePressure;

		const smoothed = streamline(points, streamlineFactor);
		const { left, right } = buildOutline(smoothed, size, thinning, simulate);

		return outlineToSvgPath(left, right);
	},
};
