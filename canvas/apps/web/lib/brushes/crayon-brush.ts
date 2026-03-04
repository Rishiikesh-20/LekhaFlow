/**
 * ============================================================================
 * LEKHAFLOW - CRAYON BRUSH
 * ============================================================================
 *
 * Rough, textured crayon stroke with jittery edges — similar to drawing
 * with a real wax crayon on textured paper.
 *
 * Algorithm:
 *  1. Streamline the input for smoothness.
 *  2. Build left/right outlines with perpendicular offsets.
 *  3. Add deterministic jitter (seeded from `options.seedId`) to the
 *     outline points to simulate the uneven crayon texture.
 *  4. Close and return as SVG path.
 *
 * DETERMINISM:
 *  When `options.seedId` is set, every client produces the exact same
 *  jitter offsets for the same stroke — local, remote, and ghost preview.
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

/** Deterministic noise using position-based hash (legacy fallback). */
function noise(x: number, y: number, seed: number): number {
	let h = seed | 0;
	h = Math.imul(h ^ Math.round(x * 100), 0x9e3779b9);
	h = Math.imul(h ^ Math.round(y * 100), 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296; // 0..1
}

/**
 * Seeded noise for a specific point index.
 * Uses composeSeed when seedId is available, falls back to position hash.
 */
function seededNoise(
	seedId: string,
	pointIndex: number,
	channel: number,
	x: number,
	y: number,
): number {
	if (seedId) {
		const rng = createRng(composeSeed(seedId, pointIndex, channel));
		return rng.next();
	}
	// Legacy fallback: position-based hash
	return noise(x, y, channel);
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
		return lerp(0.6, 0.3, Math.min(d / 40, 1));
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

function buildCrayonOutline(
	pts: BrushPoint[],
	size: number,
	thinning: number,
	simulate: boolean,
	jitterAmount: number,
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
		const radius = (size / 2) * lerp(0.7, 1.0, pressure * thinning);

		// Add deterministic jitter to simulate crayon texture
		const jitterL =
			(seededNoise(seedId, i, 1, curr.x, curr.y) - 0.5) * jitterAmount;
		const jitterR =
			(seededNoise(seedId, i, 2, curr.x, curr.y) - 0.5) * jitterAmount;

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

const CRAYON_DEFAULTS = {
	size: 12,
	thinning: 0.2,
	streamline: 0.25,
	simulatePressure: true,
	/** How much the outline edges wobble (px). */
	jitter: 2.5,
} as const;

// ============================================================================
// CRAYON BRUSH
// ============================================================================

export const CrayonBrush: Brush = {
	type: "crayon",
	displayName: "Crayon",

	generatePath(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): string {
		if (points.length === 0) return "";

		const size = options.size ?? CRAYON_DEFAULTS.size;
		const seedId = options.seedId ?? "";

		// Single point → rough dot
		if (points.length === 1) {
			const p = points[0] as BrushPoint;
			const r = size * 0.4;
			// Bumpy circle using seed-based offsets
			const segments = 8;
			let d = "";
			for (let s = 0; s <= segments; s++) {
				const angle = (s / segments) * Math.PI * 2;
				const jitter = (seededNoise(seedId, s, 42, p.x + s, p.y + s) - 0.5) * 2;
				const rr = r + jitter;
				const px = p.x + Math.cos(angle) * rr;
				const py = p.y + Math.sin(angle) * rr;
				d += s === 0 ? `M ${px},${py}` : ` L ${px},${py}`;
			}
			d += " Z";
			return d;
		}

		const thinning = options.thinning ?? CRAYON_DEFAULTS.thinning;
		const streamlineFactor = options.streamline ?? CRAYON_DEFAULTS.streamline;
		const simulate =
			options.simulatePressure ?? CRAYON_DEFAULTS.simulatePressure;

		const smoothed = streamline(points, streamlineFactor);
		const { left, right } = buildCrayonOutline(
			smoothed,
			size,
			thinning,
			simulate,
			CRAYON_DEFAULTS.jitter,
			seedId,
		);

		return outlineToSvgPath(left, right);
	},

	getLayers(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): RenderLayer[] {
		const size = options.size ?? CRAYON_DEFAULTS.size;
		const seedId = options.seedId ?? "";

		// Layer 1: main jittery outline (slightly reduced opacity to leave
		// room for the grain layer above it)
		const basePath = this.generatePath(points, options);

		// Layer 2: sparse grain stipple dots to simulate paper texture
		const grainPath = generateGrainPath(points, size, seedId);

		return [
			{ path: basePath, opacity: 0.88 },
			// Grain dots are decorative — no need to participate in hit testing
			{ path: grainPath, opacity: 0.45, noHit: true },
		];
	},
};

// ============================================================================
// GRAIN STIPPLE (crayon texture layer)
// ============================================================================

/**
 * Generate a stipple of tiny dots along the stroke to simulate
 * the grainy, fibrous texture of crayon-on-paper.
 *
 * Each dot is a tiny circle SVG arc.  Dots are randomly placed
 * perpendicular to the path, within the stroke width, using the
 * seeded RNG so every client gets the same texture.
 */
function generateGrainPath(
	points: ReadonlyArray<BrushPoint>,
	size: number,
	seedId: string,
): string {
	if (points.length === 0) return "";
	const halfW = size * 0.5;
	const dotR = 0.55; // tiny dot radius (px)
	let d = "";

	// Walk every 2nd point to keep dot count manageable
	for (let i = 0; i < points.length; i += 2) {
		const curr = points[i] as BrushPoint;
		const next = i + 1 < points.length ? (points[i + 1] as BrushPoint) : null;

		// Compute perpendicular direction
		let px = 1;
		let py = 0;
		if (next) {
			const dx = next.x - curr.x;
			const dy = next.y - curr.y;
			const len = Math.sqrt(dx * dx + dy * dy) || 1;
			px = -dy / len;
			py = dx / len;
		}

		// Place 2–3 dots per sampled point
		const dotsHere =
			2 + (createRng(composeSeed(seedId, i, 9)).next() > 0.6 ? 1 : 0);
		for (let k = 0; k < dotsHere; k++) {
			const rng = createRng(composeSeed(seedId, i, 10 + k));
			// Random perpendicular offset within ±halfW
			const perp = (rng.next() * 2 - 1) * halfW;
			// Random along-path jitter (±1px)
			const along = (rng.next() * 2 - 1) * 1.0;
			const x = curr.x + px * perp + py * along;
			const y = curr.y + py * perp - px * along;
			d +=
				`M ${x - dotR},${y} ` +
				`A ${dotR},${dotR} 0 1,0 ${x + dotR},${y} ` +
				`A ${dotR},${dotR} 0 1,0 ${x - dotR},${y} Z `;
		}
	}
	return d;
}
