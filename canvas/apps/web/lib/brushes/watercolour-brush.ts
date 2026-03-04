/**
 * ============================================================================
 * LEKHAFLOW - WATERCOLOUR BRUSH
 * ============================================================================
 *
 * Wide, soft-edged brush with high pressure sensitivity — emulating a
 * wet watercolour wash. The stroke is wide with feathered/tapered edges
 * that respond strongly to pen pressure (or simulated pressure from speed).
 *
 * Algorithm:
 *  1. EMA streamlining for fluidity.
 *  2. Build a wide outline with significant pressure-driven width variation.
 *  3. Add subtle seeded edge jitter for watercolour wash texture.
 *  4. Smooth the outline using a simple moving-average pass to create
 *     the characteristic soft watercolour edge.
 *  5. Return as closed SVG path.
 *
 * DETERMINISM:
 *  When `options.seedId` is set, the edge jitter is identical across
 *  all clients — local, remote, and ghost preview.
 */

import { composeSeed, createRng } from "./rng";
import type { Brush, BrushOptions, BrushPoint, RenderLayer } from "./types";

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
		// Watercolour: slower = heavier (more paint deposited)
		return lerp(0.9, 0.3, Math.min(d / 60, 1));
	}
	return 0.6;
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
	seedId: string,
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
		// Strong pressure influence for watercolour effect
		const radius = (size / 2) * lerp(0.3, 1.0, pressure * thinning);

		// Seeded edge jitter for wash texture (subtle — 1.5px max)
		let jitterL = 0;
		let jitterR = 0;
		if (seedId) {
			const rngL = createRng(composeSeed(seedId, i, 1));
			const rngR = createRng(composeSeed(seedId, i, 2));
			jitterL = (rngL.next() - 0.5) * 3;
			jitterR = (rngR.next() - 0.5) * 3;
		}

		left.push({
			x: curr.x + nx * (radius + jitterL),
			y: curr.y + ny * (radius + jitterL),
		});
		right.push({
			x: curr.x - nx * (radius + jitterR),
			y: curr.y - ny * (radius + jitterR),
		});
	}

	return { left, right };
}

/** Simple moving-average smoothing pass on outline points. */
function smoothOutline(pts: Vec2[], windowSize: number): Vec2[] {
	if (pts.length < 3) return pts;
	const result: Vec2[] = [];
	const half = Math.floor(windowSize / 2);

	for (let i = 0; i < pts.length; i++) {
		let sx = 0;
		let sy = 0;
		let count = 0;
		for (
			let j = Math.max(0, i - half);
			j <= Math.min(pts.length - 1, i + half);
			j++
		) {
			const p = pts[j] as Vec2;
			sx += p.x;
			sy += p.y;
			count++;
		}
		result.push({ x: sx / count, y: sy / count });
	}
	return result;
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

const WATERCOLOUR_DEFAULTS = {
	size: 32,
	thinning: 0.8,
	streamline: 0.5,
	simulatePressure: true,
	/** Moving-average window for softening edges */
	smoothWindow: 5,
} as const;

// ============================================================================
// WATERCOLOUR BRUSH
// ============================================================================

export const WatercolourBrush: Brush = {
	type: "watercolour",
	displayName: "Watercolour",

	generatePath(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): string {
		if (points.length === 0) return "";

		const size = options.size ?? WATERCOLOUR_DEFAULTS.size;

		// Single point → soft blob
		if (points.length === 1) {
			const p = points[0] as BrushPoint;
			const r = size * 0.45;
			return (
				`M ${p.x - r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x + r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x - r},${p.y} Z`
			);
		}

		const thinning = options.thinning ?? WATERCOLOUR_DEFAULTS.thinning;
		const streamlineFactor =
			options.streamline ?? WATERCOLOUR_DEFAULTS.streamline;
		const simulate =
			options.simulatePressure ?? WATERCOLOUR_DEFAULTS.simulatePressure;
		const seedId = options.seedId ?? "";

		const smoothed = streamline(points, streamlineFactor);
		const { left, right } = buildOutline(
			smoothed,
			size,
			thinning,
			simulate,
			seedId,
		);

		// Soften edges via moving-average
		const softLeft = smoothOutline(left, WATERCOLOUR_DEFAULTS.smoothWindow);
		const softRight = smoothOutline(right, WATERCOLOUR_DEFAULTS.smoothWindow);

		return outlineToSvgPath(softLeft, softRight);
	},

	getLayers(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): RenderLayer[] {
		if (points.length === 0) return [];

		const size = options.size ?? WATERCOLOUR_DEFAULTS.size;
		const thinning = options.thinning ?? WATERCOLOUR_DEFAULTS.thinning;
		const streamlineFactor =
			options.streamline ?? WATERCOLOUR_DEFAULTS.streamline;
		const simulate =
			options.simulatePressure ?? WATERCOLOUR_DEFAULTS.simulatePressure;
		const seedId = options.seedId ?? "";

		const smoothed = streamline(points, streamlineFactor);

		// Helper: build one softened outline at a given size scale
		const makePass = (scale: number, layerSuffix: string): string => {
			const { left, right } = buildOutline(
				smoothed,
				size * scale,
				thinning,
				simulate,
				seedId ? `${seedId}${layerSuffix}` : "",
			);
			const softL = smoothOutline(left, WATERCOLOUR_DEFAULTS.smoothWindow + 2);
			const softR = smoothOutline(right, WATERCOLOUR_DEFAULTS.smoothWindow + 2);
			return outlineToSvgPath(softL, softR);
		};

		// Single-point fallback
		if (points.length === 1) {
			const p = points[0] as BrushPoint;
			const r = size * 0.45;
			const blob =
				`M ${p.x - r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x + r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x - r},${p.y} Z`;
			return [
				{ path: blob, opacity: 0.28, shadowBlur: 10 },
				{ path: blob, opacity: 0.35, shadowBlur: 5 },
				{ path: blob, opacity: 0.2, shadowBlur: 2 },
			];
		}

		/**
		 * Three wash passes (bottom → top):
		 *  1. Wide soft outer bloom — the wet "halo" (blurs outward)
		 *  2. Core wash at normal width (the pigment body)
		 *  3. Tight bright centre — gives luminosity like real watercolour
		 */
		return [
			{ path: makePass(1.65, ":wc0"), opacity: 0.28, shadowBlur: 10 },
			{ path: makePass(1.0, ":wc1"), opacity: 0.38, shadowBlur: 5 },
			{ path: makePass(0.52, ":wc2"), opacity: 0.22, shadowBlur: 2 },
		];
	},
};
