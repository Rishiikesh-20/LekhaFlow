/**
 * ============================================================================
 * LEKHAFLOW - BRUSH ENGINE (barrel export)
 * ============================================================================
 *
 * Public API for the brush engine module.
 *
 * Usage example:
 * ```ts
 * import { getBrush, type BrushPoint } from "@/lib/brushes";
 *
 * const points: BrushPoint[] = [
 *   { x: 10, y: 20 },
 *   { x: 15, y: 22, pressure: 0.6 },
 *   { x: 25, y: 30, pressure: 0.8 },
 *   { x: 40, y: 35, pressure: 0.4 },
 * ];
 *
 * const round = getBrush("round")!;
 * const svgPath = round.generatePath(points, { size: 12 });
 * // → "M …" SVG path data string
 *
 * const marker = getBrush("marker")!;
 * const markerPath = marker.generatePath(points, { size: 24 });
 *
 * const calligraphy = getBrush("calligraphy")!;
 * const calliPath = calligraphy.generatePath(points, { size: 18 });
 * ```
 */

// Brush implementations
export { CalligraphyBrush } from "./calligraphy-brush";
export { MarkerBrush } from "./marker-brush";
// Path cache
export { clearPathCache, getCachedPath, getPathCacheSize } from "./path-cache";
// Registry
export {
	getBrush,
	listBrushes,
	listBrushTypes,
	registerBrush,
} from "./registry";
export { RoundBrush } from "./round-brush";
// Types
export type { Brush, BrushOptions, BrushPoint, BrushType } from "./types";
