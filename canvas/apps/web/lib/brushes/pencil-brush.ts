/**
 * ============================================================================
 * LEKHAFLOW — PENCIL BRUSH  (Excalidraw-style Pen)
 * ============================================================================
 *
 * Stores raw input points unmodified (for data integrity / undo / export).
 * At *render time*, feeds those points through perfect-freehand's getStroke()
 * to produce a filled outline polygon — giving the Excalidraw "pen" look:
 *   • visually smooth & continuous
 *   • rounded caps/joins
 *   • variable-width via pressure (real or simulated)
 *   • NO geometric autocorrect — user's drawing intent is preserved
 *
 * renderMode = "fill" — Canvas.tsx / GhostLayer.tsx render the resulting
 * closed SVG path with `fill` (not `stroke`).
 */

import getStroke from "perfect-freehand";
import type { Brush, BrushOptions, BrushPoint } from "./types";

// ============================================================================
// DEFAULTS
// ============================================================================

const PENCIL_DEFAULTS = {
	size: 4,
	thinning: 0.5,
	smoothing: 0.5,
	streamline: 0.5,
	simulatePressure: true,
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert an array of outline points (from perfect-freehand) into a closed
 * SVG path using average-midpoint quadratic curves — identical to the
 * approach Excalidraw uses for butter-smooth rendering.
 */
function outlineToPath(outline: number[][]): string {
	if (outline.length === 0) return "";

	const first = outline[0] as number[];
	if (outline.length < 3) {
		return `M ${first[0]},${first[1]} Z`;
	}

	let d = `M ${first[0]},${first[1]}`;

	for (let i = 1; i < outline.length - 1; i++) {
		const curr = outline[i] as [number, number];
		const next = outline[i + 1] as [number, number];
		// Midpoint between current and next → control point = curr
		const mx = (curr[0] + next[0]) / 2;
		const my = (curr[1] + next[1]) / 2;
		d += ` Q ${curr[0]},${curr[1]} ${mx},${my}`;
	}

	d += " Z";
	return d;
}

// ============================================================================
// PENCIL BRUSH
// ============================================================================

export const PencilBrush: Brush = {
	type: "pencil",
	displayName: "Normal Pencil",
	renderMode: "fill",

	generatePath(
		points: ReadonlyArray<BrushPoint>,
		options: BrushOptions = {},
	): string {
		if (points.length === 0) return "";

		const size = options.size ?? PENCIL_DEFAULTS.size;

		// Single point → small dot (filled circle)
		if (points.length === 1) {
			const p = points[0] as BrushPoint;
			const r = size * 0.3;
			return (
				`M ${p.x - r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x + r},${p.y} ` +
				`A ${r},${r} 0 1,0 ${p.x - r},${p.y} Z`
			);
		}

		// Map BrushPoint[] → [x, y, pressure][] for perfect-freehand
		const inputPoints: [number, number, number][] = [];
		for (let i = 0; i < points.length; i++) {
			const p = points[i] as BrushPoint;
			inputPoints.push([p.x, p.y, p.pressure ?? 0.5]);
		}

		// Generate outline polygon via perfect-freehand
		const outline = getStroke(inputPoints, {
			size,
			thinning: PENCIL_DEFAULTS.thinning,
			smoothing: PENCIL_DEFAULTS.smoothing,
			streamline: PENCIL_DEFAULTS.streamline,
			simulatePressure: PENCIL_DEFAULTS.simulatePressure,
			start: { cap: true },
			end: { cap: true },
			last: true,
		});

		if (outline.length === 0) return "";

		// Convert outline polygon to smooth SVG path (Excalidraw-style Q curves)
		return outlineToPath(outline);
	},
};
