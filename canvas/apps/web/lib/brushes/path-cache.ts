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

import type { Brush, BrushOptions, BrushPoint } from "./types";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of cached paths before LRU eviction */
const MAX_CACHE_SIZE = 256;

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
	// Convert to unsigned 32-bit hex
	return `${brushType}|${size}|${points.length}|${(hash >>> 0).toString(16)}`;
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
	const key = buildCacheKey(brush.type, points, size);

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
