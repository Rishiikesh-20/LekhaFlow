/**
 * ============================================================================
 * LEKHAFLOW - ROUGH RENDERER
 * ============================================================================
 *
 * Utility that uses Rough.js generator to produce sketch-style SVG path data
 * for non-freehand shapes (rectangle, ellipse, diamond, line, arrow).
 *
 * KEY DESIGN DECISIONS:
 * - Uses rough.generator (headless — no Canvas/SVG DOM needed)
 * - Deterministic rendering via element `seed`
 * - Returns SVG path strings for Konva <Path> components
 * - Does NOT affect freehand/freedraw shapes
 * - Does NOT touch Y.js, Konva internals, or any store
 * - LRU cache for generated paths to avoid redundant computation
 */

import { RoughGenerator } from "roughjs/bin/generator";

// ============================================================================
// TYPES
// ============================================================================

export interface RoughShapeResult {
	/** SVG path data for the stroke outline */
	strokePath: string;
	/** SVG path data for the fill pattern (hachure lines, etc.) */
	fillPath: string;
	/** How to render the fill path: "stroke" for hachure/cross-hatch, "fill" for solid */
	fillMode: "stroke" | "fill";
}

export interface RoughRenderOptions {
	/** Stroke color */
	strokeColor: string;
	/** Stroke width */
	strokeWidth: number;
	/** Fill color (or "transparent" for no fill) */
	fillColor: string;
	/** Sloppiness/roughness (0 = clean, 3 = very rough) */
	sloppiness: number;
	/** Seed for deterministic rendering across clients */
	seed: number;
	/** Fill style: solid, hachure, cross-hatch, none */
	fillStyle?: "solid" | "hachure" | "cross-hatch" | "none";
}

// ============================================================================
// GENERATOR SINGLETON
// ============================================================================

/** Single Rough.js generator instance — reused for all shapes */
let roughGen: RoughGenerator | null = null;

function getGenerator(): RoughGenerator {
	if (!roughGen) {
		roughGen = new RoughGenerator();
	}
	return roughGen;
}

// ============================================================================
// LRU CACHE
// ============================================================================

const CACHE_MAX = 256;
const roughCache = new Map<string, RoughShapeResult>();

function buildKey(
	shape: string,
	w: number,
	h: number,
	opts: RoughRenderOptions,
	extra?: string,
): string {
	return `${shape}|${w}|${h}|${opts.sloppiness}|${opts.seed}|${opts.strokeWidth}|${opts.fillStyle ?? "hachure"}|${extra ?? ""}`;
}

function cachedResult(
	key: string,
	compute: () => RoughShapeResult,
): RoughShapeResult {
	const hit = roughCache.get(key);
	if (hit) {
		// LRU: move to end
		roughCache.delete(key);
		roughCache.set(key, hit);
		return hit;
	}
	const result = compute();
	if (roughCache.size >= CACHE_MAX) {
		const oldest = roughCache.keys().next().value;
		if (oldest !== undefined) roughCache.delete(oldest);
	}
	roughCache.set(key, result);
	return result;
}

// ============================================================================
// PATH EXTRACTION HELPERS
// ============================================================================

/**
 * Convert a rough.js Drawable into stroke + fill SVG path strings.
 * Rough.js Drawable contains `sets` with type "path" (stroke) and "fillPath" / "fillSketch" (fill).
 */
function drawableToSvgPaths(drawable: {
	sets: Array<{
		type: string;
		ops: Array<{ op: string; data: number[] }>;
	}>;
}): RoughShapeResult {
	let strokePath = "";
	let fillPath = "";
	let fillMode: "stroke" | "fill" = "stroke";

	for (const set of drawable.sets) {
		const d = opsToSvgPath(set.ops);
		if (set.type === "path") {
			strokePath += d;
		} else if (set.type === "fillPath") {
			fillPath += d;
			fillMode = "fill"; // solid fill — render as filled path
		} else if (set.type === "fillSketch") {
			fillPath += d;
			fillMode = "stroke"; // hachure — render as stroked path
		}
	}

	return { strokePath, fillPath, fillMode };
}

function opsToSvgPath(ops: Array<{ op: string; data: number[] }>): string {
	let d = "";
	for (const op of ops) {
		const data = op.data;
		switch (op.op) {
			case "move":
				d += `M ${data[0]} ${data[1]} `;
				break;
			case "lineTo":
				d += `L ${data[0]} ${data[1]} `;
				break;
			case "bcurveTo":
				d += `C ${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]} `;
				break;
			default:
				break;
		}
	}
	return d;
}

// ============================================================================
// ROUGH OPTIONS BUILDER
// ============================================================================

function buildRoughOptions(opts: RoughRenderOptions) {
	const fillStyle =
		opts.fillColor === "transparent" || opts.fillStyle === "none"
			? "solid"
			: opts.fillStyle === "cross-hatch"
				? "cross-hatch"
				: "hachure";

	return {
		roughness: opts.sloppiness,
		seed: opts.seed,
		stroke: opts.strokeColor,
		strokeWidth: opts.strokeWidth,
		fill: opts.fillColor === "transparent" ? undefined : opts.fillColor,
		fillStyle,
		fillWeight: opts.strokeWidth * 0.5,
		hachureGap: opts.strokeWidth * 4,
		hachureAngle: -41, // Excalidraw-style angle
		bowing: 1,
		curveFitting: 0.95,
		curveStepCount: 9,
	};
}

// ============================================================================
// PUBLIC API — Shape Generators
// ============================================================================

/**
 * Generate rough rectangle SVG paths.
 * Coordinates are local (0, 0) origin — caller handles positioning via Konva x/y.
 */
export function roughRectangle(
	width: number,
	height: number,
	opts: RoughRenderOptions,
): RoughShapeResult {
	const key = buildKey("rect", width, height, opts);
	return cachedResult(key, () => {
		const gen = getGenerator();
		const drawable = gen.rectangle(
			0,
			0,
			width,
			height,
			buildRoughOptions(opts),
		);
		return drawableToSvgPaths(drawable);
	});
}

/**
 * Generate rough ellipse SVG paths.
 * Center-based: (0, 0) is the center.
 */
export function roughEllipse(
	width: number,
	height: number,
	opts: RoughRenderOptions,
): RoughShapeResult {
	const key = buildKey("ellipse", width, height, opts);
	return cachedResult(key, () => {
		const gen = getGenerator();
		const drawable = gen.ellipse(0, 0, width, height, buildRoughOptions(opts));
		return drawableToSvgPaths(drawable);
	});
}

/**
 * Generate rough diamond (rhombus) SVG paths.
 * Coordinates are local (0, 0) origin.
 */
export function roughDiamond(
	width: number,
	height: number,
	opts: RoughRenderOptions,
): RoughShapeResult {
	const cx = width / 2;
	const cy = height / 2;
	const points: Array<[number, number]> = [
		[cx, 0],
		[width, cy],
		[cx, height],
		[0, cy],
	];
	const key = buildKey("diamond", width, height, opts);
	return cachedResult(key, () => {
		const gen = getGenerator();
		const drawable = gen.polygon(points, buildRoughOptions(opts));
		return drawableToSvgPaths(drawable);
	});
}

/**
 * Generate rough line SVG paths.
 * Points are relative to element origin.
 */
export function roughLine(
	points: Array<{ x: number; y: number }>,
	opts: RoughRenderOptions,
): RoughShapeResult {
	const extra = points.map((p) => `${p.x},${p.y}`).join(";");
	const key = buildKey("line", 0, 0, opts, extra);
	return cachedResult(key, () => {
		const gen = getGenerator();
		if (points.length < 2)
			return { strokePath: "", fillPath: "", fillMode: "stroke" };

		// For multi-segment lines, draw segments
		let strokePath = "";
		for (let i = 0; i < points.length - 1; i++) {
			const from = points[i] as { x: number; y: number };
			const to = points[i + 1] as { x: number; y: number };
			const drawable = gen.line(
				from.x,
				from.y,
				to.x,
				to.y,
				buildRoughOptions(opts),
			);
			const paths = drawableToSvgPaths(drawable);
			strokePath += paths.strokePath;
		}
		return { strokePath, fillPath: "", fillMode: "stroke" };
	});
}

/**
 * Generate rough arrow SVG paths (line + arrowhead).
 * The arrowhead is drawn as a rough polygon.
 */
export function roughArrow(
	points: Array<{ x: number; y: number }>,
	opts: RoughRenderOptions,
	pointerLength = 15,
	pointerWidth = 12,
): RoughShapeResult {
	const extra = `arrow|${pointerLength}|${pointerWidth}|${points.map((p) => `${p.x},${p.y}`).join(";")}`;
	const key = buildKey("arrow", 0, 0, opts, extra);
	return cachedResult(key, () => {
		const gen = getGenerator();
		if (points.length < 2)
			return { strokePath: "", fillPath: "", fillMode: "stroke" };

		// Draw line segments
		let strokePath = "";
		for (let i = 0; i < points.length - 1; i++) {
			const from = points[i] as { x: number; y: number };
			const to = points[i + 1] as { x: number; y: number };
			const drawable = gen.line(
				from.x,
				from.y,
				to.x,
				to.y,
				buildRoughOptions(opts),
			);
			const paths = drawableToSvgPaths(drawable);
			strokePath += paths.strokePath;
		}

		// Draw arrowhead at the last point
		const last = points[points.length - 1] as { x: number; y: number };
		const prev = points[points.length - 2] as { x: number; y: number };
		const angle = Math.atan2(last.y - prev.y, last.x - prev.x);

		const tip = last;
		const leftX = tip.x - pointerLength * Math.cos(angle - Math.PI / 6);
		const leftY = tip.y - pointerLength * Math.sin(angle - Math.PI / 6);
		const rightX = tip.x - pointerLength * Math.cos(angle + Math.PI / 6);
		const rightY = tip.y - pointerLength * Math.sin(angle + Math.PI / 6);

		const arrowHead: Array<[number, number]> = [
			[leftX, leftY],
			[tip.x, tip.y],
			[rightX, rightY],
		];

		const headDrawable = gen.linearPath(arrowHead, {
			...buildRoughOptions(opts),
			fill: undefined,
		});
		strokePath += drawableToSvgPaths(headDrawable).strokePath;

		return { strokePath, fillPath: "", fillMode: "stroke" };
	});
}

/**
 * Clear the rough path cache.
 */
export function clearRoughCache(): void {
	roughCache.clear();
}
