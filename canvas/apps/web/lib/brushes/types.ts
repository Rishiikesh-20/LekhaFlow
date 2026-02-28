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
	/**
	 * Stable seed identifier for deterministic brush randomness.
	 * When provided, brushes that use randomness (spray, crayon, watercolour)
	 * will produce identical output across all clients for the same seed.
	 * Composed from the stroke's `seedId` property.
	 */
	seedId?: string;
}

// ============================================================================
// RENDER LAYER
// ============================================================================

/**
 * A single visual pass in a multi-layer brush rendering.
 *
 * Brushes like Watercolour and Crayon compose multiple passes to achieve
 * their characteristic look (wash layers, grain dots etc.).
 * Canvas.tsx and GhostLayer.tsx iterate over the layers returned by
 * `Brush.getLayers()` and render each as a separate Konva Path inside
 * a <Group>, preserving zIndex, rotation, and hit-testing.
 */
export interface RenderLayer {
	/** Precomputed SVG path data for this pass. */
	path: string;
	/**
	 * Opacity multiplier in [0, 1] applied on top of the element's own opacity.
	 * Final rendered opacity = (element.opacity / 100) * layer.opacity
	 */
	opacity: number;
	/**
	 * Konva shadowBlur value for this pass.
	 * Use small values (2–8) for soft-edge effects.
	 * 0 or undefined = no blur.
	 */
	shadowBlur?: number;
	/**
	 * When true, this layer should NOT participate in hit-testing.
	 * Useful for purely-decorative passes (e.g. grain stipple).
	 * Defaults to false (all layers are hit-testable).
	 */
	noHit?: boolean;
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

	/**
	 * Generate multi-layer render instructions for this brush.
	 *
	 * When defined, Canvas.tsx and GhostLayer.tsx use this instead of
	 * `generatePath` to render multiple Konva <Path> nodes inside a <Group>.
	 * This enables multi-pass effects (watercolour washes, crayon grain,
	 * marker soft edges) without breaking selection, rotation, or zIndex.
	 *
	 * @param points  – Ordered stroke points (never mutated).
	 * @param options – Optional rendering parameters.
	 * @returns Array of RenderLayer, outermost layer first (bottom-to-top).
	 *          Must return at least one layer.
	 */
	getLayers?(
		points: ReadonlyArray<BrushPoint>,
		options?: BrushOptions,
	): RenderLayer[];
}

// ============================================================================
// REGISTRY TYPE
// ============================================================================

/** String-literal union of built-in brush identifiers. */
export type BrushType =
	| "pencil"
	| "spray"
	| "crayon"
	| "marker"
	| "watercolour";

/**
 * Backward-compatibility mapper.
 * Normalises any stored / incoming brush-type string to one of the
 * current five built-in types.  Old or unknown identifiers fall back
 * to `"pencil"` so nothing ever crashes or silently disappears.
 *
 * Mapping:
 *  - "round"        → "pencil"  (closest visual match)
 *  - "calligraphy"  → "pencil"  (no direct replacement)
 *  - "marker"       → "marker"  (kept as-is)
 *  - "pencil" / "spray" / "crayon" / "watercolour" → pass-through
 *  - anything else  → "pencil"
 */
export function normalizeBrushType(
	input: string | null | undefined,
): BrushType {
	switch (input) {
		case "pencil":
		case "spray":
		case "crayon":
		case "marker":
		case "watercolour":
			return input;
		default:
			// Covers legacy "round", "calligraphy", and any unknown types
			return "pencil";
	}
}
