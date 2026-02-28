/**
 * ============================================================================
 * LEKHAFLOW - SEEDED PSEUDO-RANDOM NUMBER GENERATOR
 * ============================================================================
 *
 * Deterministic PRNG for brush textures. All brush randomness (spray dots,
 * crayon jitter, watercolour wash noise) MUST use this instead of Math.random()
 * so that every client renders the exact same stroke given the same seed.
 *
 * Seed strategy:
 *  - Each stroke gets a unique `seedId` (generated once on pointerdown).
 *  - The same `seedId` is stored on the FreedrawElement AND broadcast via
 *    awareness for ghost previews, so local / remote / ghost all match.
 *  - Per-point and per-dot randomness is achieved by composing:
 *      seed = `${seedId}:${pointIndex}:${dotIndex}`
 *
 * Algorithm: splitmix32 — extremely fast, 32-bit, passes BigCrush.
 *
 * @module rng
 */

// ============================================================================
// HASH: convert any string/number seed into a 32-bit integer
// ============================================================================

/**
 * Hash a string into a 32-bit unsigned integer (FNV-1a).
 * Used to convert composite seed strings like "abc-123:5:2" into
 * a numeric seed for splitmix32.
 */
export function hashSeed(input: string | number): number {
	if (typeof input === "number") return input | 0;
	let h = 2166136261; // FNV offset basis
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619); // FNV prime
	}
	return h >>> 0;
}

// ============================================================================
// CORE PRNG: splitmix32
// ============================================================================

/**
 * Create a seeded PRNG that yields repeatable floats in [0, 1).
 *
 * @example
 * ```ts
 * const rng = createRng("stroke-abc:5:0");
 * const val = rng.next(); // always same value for same seed
 * ```
 */
export function createRng(seed: string | number): { next(): number } {
	let s = hashSeed(seed);
	return {
		next() {
			s |= 0;
			s = (s + 0x9e3779b9) | 0;
			let t = s ^ (s >>> 16);
			t = Math.imul(t, 0x21f0aaad);
			t ^= t >>> 15;
			t = Math.imul(t, 0x735a2d97);
			t ^= t >>> 15;
			return (t >>> 0) / 4294967296;
		},
	};
}

/**
 * Convenience: get a single random float for a composite seed key.
 * Equivalent to `createRng(seed).next()` but more readable when
 * only one value is needed.
 */
export function seededRandom(seed: string | number, index = 0): number {
	const rng = createRng(seed);
	// Advance `index` times to decorrelate sequential indices
	let v = 0;
	for (let i = 0; i <= index; i++) {
		v = rng.next();
	}
	return v;
}

// ============================================================================
// HELPER FUNCTIONS (stateful — call rng.next() internally)
// ============================================================================

/**
 * Random float in [min, max).
 */
export function randFloat(
	rng: { next(): number },
	min: number,
	max: number,
): number {
	return min + rng.next() * (max - min);
}

/**
 * Random integer in [min, max] (inclusive).
 */
export function randInt(
	rng: { next(): number },
	min: number,
	max: number,
): number {
	return Math.floor(min + rng.next() * (max - min + 1));
}

/**
 * Random sign: -1 or +1.
 */
export function randSign(rng: { next(): number }): number {
	return rng.next() < 0.5 ? -1 : 1;
}

/**
 * Approximate Gaussian distribution (mean 0, stddev ~1) using
 * the Irwin-Hall approximation (sum of 6 uniforms, shifted).
 * Good enough for brush jitter — no Box-Muller needed.
 */
export function randGaussianLike(rng: { next(): number }): number {
	let sum = 0;
	for (let i = 0; i < 6; i++) {
		sum += rng.next();
	}
	return sum - 3; // ≈ N(0, 1)
}

// ============================================================================
// SEED COMPOSITION HELPERS
// ============================================================================

/**
 * Build a deterministic composite seed string for a specific dot
 * within a specific point of a specific stroke.
 *
 * @param strokeSeedId - The stable `seedId` of the stroke
 * @param pointIndex   - Index of the point along the path
 * @param dotIndex     - Index of the dot at that point (for spray-type effects)
 * @returns Composite seed string
 *
 * @example
 * ```ts
 * const seed = composeSeed("abc-123", 5, 2);
 * // → "abc-123:5:2"
 * const rng = createRng(seed);
 * ```
 */
export function composeSeed(
	strokeSeedId: string,
	pointIndex: number,
	dotIndex = 0,
): string {
	return `${strokeSeedId}:${pointIndex}:${dotIndex}`;
}
