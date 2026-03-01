/**
 * ============================================================================
 * LEKHAFLOW - PENCIL BRUSH (Normal Pencil)
 * ============================================================================
 *
 * Truly raw pencil stroke — zero post-processing.
 *
 * Output: an open SVG polyline (`M … L … L …`) rendered with Konva's
 * `stroke` + `strokeWidth` instead of `fill`.  Every input point appears
 * in the path verbatim; sharp corners stay sharp; no EMA, no outline
 * offset, no pressure simulation, no curve fitting.
 *
 * renderMode = "stroke" signals Canvas.tsx / GhostLayer.tsx to use
 * `stroke` props when rendering this brush's path data.
 */

import type { Brush, BrushOptions, BrushPoint } from "./types";

// ============================================================================
// DEFAULTS
// ============================================================================

const PENCIL_DEFAULTS = {
	size: 4,
} as const;

// ============================================================================
// PENCIL BRUSH
// ============================================================================

export const PencilBrush: Brush = {
	type: "pencil",
	displayName: "Normal Pencil",
	renderMode: "stroke",

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

		// Raw open polyline — no smoothing, no outline, no pressure math.
		// The path is rendered with Konva stroke + strokeWidth (renderMode=stroke).
		const first = points[0] as BrushPoint;
		let d = `M ${first.x},${first.y}`;
		for (let i = 1; i < points.length; i++) {
			const p = points[i] as BrushPoint;
			d += ` L ${p.x},${p.y}`;
		}
		return d;
	},
};
