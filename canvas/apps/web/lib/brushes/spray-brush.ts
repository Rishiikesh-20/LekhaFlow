/**
 * ============================================================================
 * LEKHAFLOW - SPRAY BRUSH (Spraybrush)
 * ============================================================================
 *
 * Classic MS Paint-style spraybrush that emits scattered dots/particles
 * along the stroke path. Produces an airbrush / spray-can effect.
 *
 * Algorithm:
 *  1. Walk along the path at fixed step intervals.
 *  2. At each step, emit N tiny circles within a spray radius.
 *  3. Deterministic pseudo-random scatter driven by `options.seedId`
 *     (falls back to position-based seed when seedId is absent).
 *  4. Return the combined SVG path of all dot circles.
 *
 * DETERMINISM:
 *  When `options.seedId` is set, every client produces the exact same
 *  dot scatter for the same stroke — local, remote, and ghost preview.
 *  Seed composition: `${seedId}:${stepIndex}:${dotIndex}`
 */

import { composeSeed, createRng } from "./rng";
import type { Brush, BrushOptions, BrushPoint } from "./types";

// ============================================================================
// HELPERS
// ============================================================================

function dist(ax: number, ay: number, bx: number, by: number): number {
	const dx = bx - ax;
	const dy = by - ay;
	return Math.sqrt(dx * dx + dy * dy);
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const SPRAY_DEFAULTS = {
	size: 24,
	/** Dots emitted per step along the stroke */
	dotsPerStep: 12,
	/** Spacing between emission steps (px). Smaller = denser. */
	stepDistance: 4,
	/** Base dot radius */
	dotRadius: 0.8,
	/** Hard cap on total dots per stroke to avoid SVG path explosion (Phase 6) */
	maxDotsPerStroke: 600,
} as const;

// ============================================================================
// SPRAY BRUSH
// ============================================================================

export const SprayBrush: Brush = {
	type: "spray",
	displayName: "Spraybrush",

	generatePath(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): string {
		if (points.length === 0) return "";

		const size = options.size ?? SPRAY_DEFAULTS.size;
		const radius = size / 2;
		const dotsPerStep = SPRAY_DEFAULTS.dotsPerStep;
		const stepDist = SPRAY_DEFAULTS.stepDistance;
		const dotR = SPRAY_DEFAULTS.dotRadius;
		const seedId = options.seedId ?? "";
		const maxDots = SPRAY_DEFAULTS.maxDotsPerStroke;

		// Single point → burst at a single point
		if (points.length === 1) {
			const p = points[0] as BrushPoint;
			return emitBurst(p.x, p.y, radius, dotsPerStep * 3, dotR, seedId, 0);
		}

		// Walk along the polyline at fixed step intervals
		let accumDist = 0;
		let stepIndex = 0;
		let totalDots = 0;
		const parts: string[] = [];

		const first = points[0] as BrushPoint;
		parts.push(
			emitBurst(
				first.x,
				first.y,
				radius,
				dotsPerStep,
				dotR,
				seedId,
				stepIndex++,
			),
		);
		totalDots += dotsPerStep;

		for (let i = 1; i < points.length; i++) {
			if (totalDots >= maxDots) break; // Phase 6: hard cap

			const prev = points[i - 1] as BrushPoint;
			const curr = points[i] as BrushPoint;
			const d = dist(prev.x, prev.y, curr.x, curr.y);

			if (d === 0) continue;

			accumDist += d;
			while (accumDist >= stepDist) {
				if (totalDots >= maxDots) break; // Phase 6: hard cap
				accumDist -= stepDist;
				const t = 1 - accumDist / d;
				const x = lerp(prev.x, curr.x, t);
				const y = lerp(prev.y, curr.y, t);
				// Pressure affects density
				const pressure =
					curr.pressure !== undefined && curr.pressure > 0
						? curr.pressure
						: 0.5;
				const adjustedDots = Math.max(3, Math.round(dotsPerStep * pressure));
				parts.push(
					emitBurst(x, y, radius, adjustedDots, dotR, seedId, stepIndex++),
				);
				totalDots += adjustedDots;
			}
		}

		return parts.join(" ");
	},
};

// ============================================================================
// EMISSION
// ============================================================================

/**
 * Emit a burst of dots around (cx, cy).
 *
 * @param seedId    - Stroke seedId for cross-client determinism
 * @param stepIndex - Step counter along the polyline (used as pointIndex in seed)
 */
function emitBurst(
	cx: number,
	cy: number,
	radius: number,
	count: number,
	dotR: number,
	seedId: string,
	stepIndex: number,
): string {
	// Create an RNG seeded from the stroke + step index.
	// When seedId is empty (legacy strokes without seedId) we fall back to
	// a position-derived seed so output is still deterministic per-render.
	const seed = seedId
		? composeSeed(seedId, stepIndex)
		: `pos:${Math.round(cx * 13 + cy * 17)}:${stepIndex}`;
	const rng = createRng(seed);

	let d = "";

	for (let i = 0; i < count; i++) {
		// Random angle + gaussian-ish radial distribution (sum of 2 randoms)
		const angle = rng.next() * Math.PI * 2;
		const r = radius * Math.sqrt((rng.next() + rng.next()) / 2);
		const x = cx + Math.cos(angle) * r;
		const y = cy + Math.sin(angle) * r;
		// Each dot is a tiny circle
		d +=
			`M ${x - dotR},${y} ` +
			`A ${dotR},${dotR} 0 1,0 ${x + dotR},${y} ` +
			`A ${dotR},${dotR} 0 1,0 ${x - dotR},${y} Z `;
	}

	return d;
}
