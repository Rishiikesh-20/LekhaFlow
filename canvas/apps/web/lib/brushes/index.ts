/**
 * ============================================================================
 * LEKHAFLOW - BRUSH ENGINE (barrel export)
 * ============================================================================
 *
 * Public API for the brush engine module.
 *
 * Usage example:
 * ```ts
 * import { getBrush, normalizeBrushType, type BrushPoint } from "@/lib/brushes";
 *
 * const points: BrushPoint[] = [
 *   { x: 10, y: 20 },
 *   { x: 15, y: 22, pressure: 0.6 },
 *   { x: 25, y: 30, pressure: 0.8 },
 *   { x: 40, y: 35, pressure: 0.4 },
 * ];
 *
 * const pencil = getBrush("pencil")!;
 * const svgPath = pencil.generatePath(points, { size: 4 });
 *
 * const marker = getBrush("marker")!;
 * const markerPath = marker.generatePath(points, { size: 24 });
 *
 * // Backward compat: old "round" type → resolved to "pencil"
 * const resolved = normalizeBrushType("round"); // → "pencil"
 * ```
 */

// Brush implementations
export { CrayonBrush } from "./crayon-brush";
export { MarkerBrush } from "./marker-brush";
// Path cache
export {
	clearPathCache,
	getCachedLayers,
	getCachedPath,
	getPathCacheSize,
} from "./path-cache";
export { PencilBrush } from "./pencil-brush";
// Registry
export {
	getBrush,
	listBrushes,
	listBrushTypes,
	registerBrush,
} from "./registry";
// Seeded RNG
export {
	composeSeed,
	createRng,
	hashSeed,
	randFloat,
	randGaussianLike,
	randInt,
	randSign,
	seededRandom,
} from "./rng";
export { SprayBrush } from "./spray-brush";
// Types & backward-compat mapper
export type { Brush, BrushOptions, BrushPoint, BrushType } from "./types";
export { normalizeBrushType } from "./types";
export { WatercolourBrush } from "./watercolour-brush";
