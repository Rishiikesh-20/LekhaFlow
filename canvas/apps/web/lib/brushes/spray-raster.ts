/**
 * ============================================================================
 * LEKHAFLOW — SPRAY RASTER ENGINE
 * ============================================================================
 *
 * Offscreen <canvas> accumulator for live spray-brush drawing.
 *
 * During a spray stroke every new point stamps dots directly to a
 * 2D canvas context (cheap pixel draws).  A single Konva.Image node
 * displays the result — no SVG string building, no growing Path node.
 *
 * On pointerup the accumulated points are committed as a normal
 * FreedrawElement so persistence, undo/redo, export, and ghost
 * preview continue to work unmodified.
 *
 * DETERMINISM:
 *   Same seedId + same points → same dot placement on the raster
 *   (uses the exact same RNG + stepping logic as spray-brush.ts).
 */

import { composeSeed, createRng } from "./rng";

// ============================================================================
// DEFAULTS (mirrors spray-brush.ts)
// ============================================================================

const DEFAULTS = {
	dotsPerStep: 12,
	stepDistance: 4,
	dotRadius: 0.8,
	softCap: 1200,
	hardCap: 4000,
	minDotsPerStep: 2,
} as const;

// ============================================================================
// HELPERS
// ============================================================================

function dist(ax: number, ay: number, bx: number, by: number): number {
	const dx = bx - ax;
	const dy = by - ay;
	return Math.sqrt(dx * dx + dy * dy);
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

// ============================================================================
// ENGINE
// ============================================================================

export interface SprayRasterOptions {
	/** Canvas pixel width */
	width: number;
	/** Canvas pixel height */
	height: number;
	/** Brush diameter (same "size" used by the SVG brush) */
	size: number;
	/** Fill colour (CSS colour string) */
	color: string;
	/** Deterministic seed — must match the element's seedId */
	seedId: string;
}

/**
 * Light-weight raster spray engine.
 *
 * Call `addPoint(x, y)` for every captured pointer position
 * (element-local coordinates, same as stored in FreedrawElement.points).
 * Dots are stamped incrementally — O(newDots) per call, not O(totalDots).
 *
 * Read `canvas` to get the HTMLCanvasElement to feed to Konva.Image.
 */
export class SprayRasterEngine {
	readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;

	/** Offset that maps element-local (0,0) to the canvas centre. */
	readonly originX: number;
	readonly originY: number;

	private readonly radius: number;
	private readonly dotR: number;
	private readonly color: string;
	private readonly seedId: string;

	private lastPt: { x: number; y: number } | null = null;
	private accumDist = 0;
	private stepIdx = 0;

	/** Running dot count — exposed for PerfHUD */
	totalDots = 0;
	/** Dots emitted in the most recent `addPoint` call — exposed for PerfHUD */
	lastFrameDots = 0;

	constructor(opts: SprayRasterOptions) {
		this.canvas = document.createElement("canvas");
		this.canvas.width = opts.width;
		this.canvas.height = opts.height;
		this.ctx = this.canvas.getContext("2d", {
			willReadFrequently: false,
		}) as CanvasRenderingContext2D;
		this.radius = opts.size / 2;
		this.dotR = DEFAULTS.dotRadius;
		this.color = opts.color;
		this.seedId = opts.seedId;
		this.originX = Math.round(opts.width / 2);
		this.originY = Math.round(opts.height / 2);
	}

	/**
	 * Stamp spray dots for a new point (element-local coordinates).
	 * Call once per captured pointer position.
	 */
	addPoint(x: number, y: number, _pressure = 0.5): void {
		this.lastFrameDots = 0;
		const cx = x + this.originX;
		const cy = y + this.originY;

		if (!this.lastPt) {
			this._emitBurst(cx, cy, DEFAULTS.dotsPerStep);
			this.lastPt = { x: cx, y: cy };
			return;
		}

		const d = dist(this.lastPt.x, this.lastPt.y, cx, cy);
		if (d === 0) return;

		this.accumDist += d;
		while (this.accumDist >= DEFAULTS.stepDistance) {
			this.accumDist -= DEFAULTS.stepDistance;
			const t = 1 - this.accumDist / d;
			const px = lerp(this.lastPt.x, cx, t);
			const py = lerp(this.lastPt.y, cy, t);

			// Adaptive density (mirrors spray-brush.ts taper logic)
			let effectiveDots: number = DEFAULTS.dotsPerStep;
			if (this.totalDots >= DEFAULTS.softCap) {
				const progress = Math.min(
					(this.totalDots - DEFAULTS.softCap) /
						(DEFAULTS.hardCap - DEFAULTS.softCap),
					1,
				);
				effectiveDots = Math.round(
					lerp(DEFAULTS.dotsPerStep, DEFAULTS.minDotsPerStep, progress),
				);
			}
			const adjustedDots = Math.max(DEFAULTS.minDotsPerStep, effectiveDots);
			this._emitBurst(px, py, adjustedDots);
		}

		this.lastPt = { x: cx, y: cy };
	}

	// ── internal ──────────────────────────────────────────────────

	private _emitBurst(cx: number, cy: number, count: number): void {
		const rng = createRng(composeSeed(this.seedId, this.stepIdx));
		const ctx = this.ctx;
		ctx.fillStyle = this.color;

		for (let i = 0; i < count; i++) {
			const angle = rng.next() * Math.PI * 2;
			const r = this.radius * Math.sqrt((rng.next() + rng.next()) / 2);
			const dotX = cx + Math.cos(angle) * r;
			const dotY = cy + Math.sin(angle) * r;
			ctx.beginPath();
			ctx.arc(dotX, dotY, this.dotR, 0, Math.PI * 2);
			ctx.fill();
		}

		this.stepIdx++;
		this.totalDots += count;
		this.lastFrameDots += count;
	}

	/** Free canvas memory. */
	dispose(): void {
		_activeEngine = null;
		this.canvas.width = 0;
		this.canvas.height = 0;
	}
}

// ============================================================================
// GLOBAL LIVE-ENGINE ACCESSOR — for PerfHUD / DebugOverlay
// ============================================================================

let _activeEngine: SprayRasterEngine | null = null;

/**
 * Register the currently-active engine so PerfHUD can read its counters.
 * Call with `null` on stroke end.
 */
export function setActiveSprayEngine(engine: SprayRasterEngine | null): void {
	_activeEngine = engine;
}

/** Read live counters from the active raster engine (returns zeros when idle). */
export function getSprayRasterDebug(): {
	totalDots: number;
	lastFrameDots: number;
} {
	if (!_activeEngine) return { totalDots: 0, lastFrameDots: 0 };
	return {
		totalDots: _activeEngine.totalDots,
		lastFrameDots: _activeEngine.lastFrameDots,
	};
}
