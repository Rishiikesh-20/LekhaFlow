/**
 * ============================================================================
 * LEKHAFLOW - BRUSH PATH CACHE
 * ============================================================================
 *
 * LRU cache for generated SVG path strings.
 * Prevents redundant path regeneration when points haven't changed.
 *
 * - Deterministic: same inputs → same cache key → same output
 * - Bounded: evicts oldest entries when capacity exceeded
 * - No side-effects: does NOT touch Konva, Y.js, or any store
 */

import type { Brush, BrushOptions, BrushPoint, RenderLayer } from "./types";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of cached paths before LRU eviction (Phase 6: raised for heavy canvases) */
const MAX_CACHE_SIZE = 512;

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Build a deterministic cache key from brush type, points, and options.
 *
 * Key format: `brushType|size|pointCount|hash`
 * The hash is a fast numeric fingerprint of the point coordinates and pressures.
 * This avoids JSON.stringify overhead on hot paths.
 */
function buildCacheKey(
	brushType: string,
	points: ReadonlyArray<BrushPoint>,
	size: number,
	seedId?: string,
): string {
	// FNV-1a-inspired fast hash of point data
	let hash = 2166136261; // FNV offset basis (32-bit)
	for (let i = 0; i < points.length; i++) {
		const p = points[i] as BrushPoint;
		// Mix x, y, pressure into hash
		hash ^= ((p.x * 1000) | 0) & 0xffffffff;
		hash = Math.imul(hash, 16777619); // FNV prime
		hash ^= ((p.y * 1000) | 0) & 0xffffffff;
		hash = Math.imul(hash, 16777619);
		hash ^= (((p.pressure ?? 0.5) * 1000) | 0) & 0xffffffff;
		hash = Math.imul(hash, 16777619);
	}
	// Include seedId in cache key so different seeds don't collide
	const seedSuffix = seedId ? `|${seedId}` : "";
	// Convert to unsigned 32-bit hex
	return `${brushType}|${size}|${points.length}|${(hash >>> 0).toString(16)}${seedSuffix}`;
}

// ============================================================================
// LRU CACHE
// ============================================================================

/** Insertion-ordered map used as LRU cache */
const pathCache = new Map<string, string>();

/**
 * Get a cached path or generate and cache a new one.
 *
 * @param brush     - The brush instance to use for generation
 * @param points    - Ordered stroke points (never mutated)
 * @param options   - Brush options (only `size` affects cache key)
 * @returns SVG path data string
 */
export function getCachedPath(
	brush: Brush,
	points: ReadonlyArray<BrushPoint>,
	options?: BrushOptions,
): string {
	const size = options?.size ?? 16;
	const key = buildCacheKey(brush.type, points, size, options?.seedId);

	// Cache hit — move to end (most-recently-used)
	const cached = pathCache.get(key);
	if (cached !== undefined) {
		// Re-insert to update recency (Map preserves insertion order)
		pathCache.delete(key);
		pathCache.set(key, cached);
		return cached;
	}

	// Cache miss — generate path
	const pathData = brush.generatePath(points, options);

	// Evict oldest if at capacity
	if (pathCache.size >= MAX_CACHE_SIZE) {
		const oldestKey = pathCache.keys().next().value;
		if (oldestKey !== undefined) {
			pathCache.delete(oldestKey);
		}
	}

	pathCache.set(key, pathData);
	return pathData;
}

/**
 * Clear the entire path cache.
 * Called when switching documents or resetting state.
 */
export function clearPathCache(): void {
	pathCache.clear();
}

/**
 * Get the current cache size (for diagnostics only).
 */
export function getPathCacheSize(): number {
	return pathCache.size;
}

// ============================================================================
// LAYER CACHE (multi-pass brushes)
// ============================================================================

/** Insertion-ordered map used as LRU cache for layer arrays */
const layerCache = new Map<string, RenderLayer[]>();

/**
 * Get cached render layers or generate and cache new ones.
 *
 * Only valid for brushes that implement `getLayers()`. Falls back to
 * a single-layer array wrapping `generatePath` for other brushes.
 *
 * @param brush   - The brush instance
 * @param points  - Ordered stroke points
 * @param options - Brush options (size + seedId affect cache key)
 * @returns Array of RenderLayer, bottom-to-top order
 */
export function getCachedLayers(
	brush: Brush,
	points: ReadonlyArray<BrushPoint>,
	options?: BrushOptions,
): RenderLayer[] {
	const size = options?.size ?? 16;
	const key = buildCacheKey(brush.type, points, size, options?.seedId);
	const layerKey = `L:${key}`;

	// Cache hit
	const cached = layerCache.get(layerKey);
	if (cached !== undefined) {
		layerCache.delete(layerKey);
		layerCache.set(layerKey, cached);
		return cached;
	}

	// Cache miss — generate layers
	let layers: RenderLayer[];
	if (brush.getLayers) {
		layers = brush.getLayers(points, options);
		// Phase 6: safety fallback — if getLayers returns empty for non-empty
		// points (race condition / unexpected state), fall back to single-layer
		// path so the stroke never visually disappears.
		if (layers.length === 0 && points.length > 0) {
			const path = getCachedPath(brush, points, options);
			layers = [{ path, opacity: 1 }];
		}
	} else {
		// Single-layer fallback: use getCachedPath
		const path = getCachedPath(brush, points, options);
		layers = [{ path, opacity: 1 }];
	}

	// Evict oldest entry if at capacity
	if (layerCache.size >= MAX_CACHE_SIZE) {
		const oldestKey = layerCache.keys().next().value;
		if (oldestKey !== undefined) {
			layerCache.delete(oldestKey);
		}
	}

	layerCache.set(layerKey, layers);
	return layers;
}
