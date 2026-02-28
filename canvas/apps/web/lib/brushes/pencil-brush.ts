/**
 * ============================================================================
 * LEKHAFLOW - PENCIL BRUSH (Normal Pencil)
 * ============================================================================
 *
 * Classic thin pencil stroke with slight pressure sensitivity.
 * Produces a clean, slightly variable-width line — similar to MS Paint's
 * default pencil tool but with smooth anti-aliased edges.
 *
 * Algorithm:
 *  1. Light EMA streamlining (low factor for responsiveness).
 *  2. Build thin left/right outlines with subtle pressure variation.
 *  3. Close and return as SVG path.
 */

import type { Brush, BrushOptions, BrushPoint } from "./types";

// ============================================================================
// HELPERS
// ============================================================================

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
	const dx = bx - ax;
	const dy = by - ay;
	return Math.sqrt(dx * dx + dy * dy);
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

function resolvePressure(
	point: BrushPoint,
	prev: BrushPoint | null,
	simulate: boolean,
): number {
	if (point.pressure !== undefined && point.pressure > 0) {
		return point.pressure;
	}
	if (simulate && prev) {
		const d = dist(prev.x, prev.y, point.x, point.y);
		return lerp(0.75, 0.25, Math.min(d / 50, 1));
	}
	return 0.5;
}

// ============================================================================
// OUTLINE
// ============================================================================

interface Vec2 {
	x: number;
	y: number;
}

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
		const nx = -dy / len;
		const ny = dx / len;

		const pressure = resolvePressure(curr, prev, simulate);
		// Pencil: very subtle pressure influence — thin, consistent line
		const radius = (size / 2) * lerp(0.85, 1.0, pressure * thinning);

		left.push({ x: curr.x + nx * radius, y: curr.y + ny * radius });
		right.push({ x: curr.x - nx * radius, y: curr.y - ny * radius });
	}

	return { left, right };
}

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

const PENCIL_DEFAULTS = {
	size: 4,
	thinning: 0.3,
	streamline: 0, // Raw input — no EMA smoothing
	simulatePressure: true,
} as const;

// ============================================================================
// PENCIL BRUSH
// ============================================================================

export const PencilBrush: Brush = {
	type: "pencil",
	displayName: "Normal Pencil",

	generatePath(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): string {
		if (points.length === 0) return "";

		const size = options.size ?? PENCIL_DEFAULTS.size;

		// Single point → small dot
		if (points.length === 1) {
			const p = points[0] as BrushPoint;
			const r = size * 0.3;
			return (
				`M ${p.x - r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x + r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x - r},${p.y} Z`
			);
		}

		const thinning = options.thinning ?? PENCIL_DEFAULTS.thinning;
		const streamlineFactor = options.streamline ?? PENCIL_DEFAULTS.streamline;
		const simulate =
			options.simulatePressure ?? PENCIL_DEFAULTS.simulatePressure;

		const smoothed = streamline(points, streamlineFactor);
		const { left, right } = buildOutline(smoothed, size, thinning, simulate);

		return outlineToSvgPath(left, right);
	},
};
