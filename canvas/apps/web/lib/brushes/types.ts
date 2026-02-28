/**
 * ============================================================================
 * LEKHAFLOW - BRUSH ENGINE TYPES
 * ============================================================================
 *
 * Core interfaces and types for the modular brush system.
 * All brushes implement the Brush interface and produce deterministic
 * SVG path data from input points.
 */

// ============================================================================
// INPUT TYPES
// ============================================================================

/** A single input point with optional pressure (0–1). */
export interface BrushPoint {
	x: number;
	y: number;
	/** Stylus / simulated pressure in [0, 1]. Defaults to 0.5. */
	pressure?: number;
}

/** Options forwarded to every brush's `generatePath`. */
export interface BrushOptions {
	/** Base stroke width in pixels. Default varies per brush. */
	size?: number;
	/** How much pressure affects width (0 = none, 1 = full). Default 0.5. */
	thinning?: number;
	/** Cubic smoothing factor in [0, 1]. Default 0.5. */
	smoothing?: number;
	/** Point-reduction streamline factor in [0, 1]. Default 0.5. */
	streamline?: number;
	/** Whether to simulate pressure from speed when hardware pressure is absent. */
	simulatePressure?: boolean;
	/** Cap or taper the start of the stroke. */
	start?: {
		cap?: boolean;
		taper?: number | boolean;
	};
	/** Cap or taper the end of the stroke. */
	end?: {
		cap?: boolean;
		taper?: number | boolean;
	};
}

// ============================================================================
// BRUSH INTERFACE
// ============================================================================

/**
 * A Brush converts an ordered sequence of points into an SVG path string.
 *
 * Contracts:
 *  - Deterministic: same inputs → same output, no randomness.
 *  - Pure: must NOT mutate the incoming `points` array.
 *  - Standalone: must NOT reference Konva, Y.js, or any store.
 */
export interface Brush {
	/** Unique identifier used for registry lookup (`"round"`, `"marker"`, …). */
	readonly type: string;

	/** Human-readable display name. */
	readonly displayName: string;

	/**
	 * Generate an SVG `<path d="…">` data string from ordered points.
	 *
	 * @param points  – Ordered stroke points (never mutated).
	 * @param options – Optional rendering parameters.
	 * @returns SVG path data string, or `""` for degenerate input.
	 */
	generatePath(
		points: ReadonlyArray<BrushPoint>,
		options?: BrushOptions,
	): string;
}

// ============================================================================
// REGISTRY TYPE
// ============================================================================

/** String-literal union of built-in brush identifiers. */
export type BrushType = "round" | "marker" | "calligraphy";
