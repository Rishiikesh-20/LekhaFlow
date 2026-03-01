/**
 * ============================================================================
 * LEKHAFLOW — PERFORMANCE HUD  (Phase 0)
 * ============================================================================
 *
 * Toggle: Ctrl + Shift + P
 *
 * Displays live performance metrics:
 *   - FPS          (exponential moving average over ~60 frames)
 *   - Frame time   (ms per animation frame)
 *   - Total objects in scene
 *   - Points in current freedraw stroke
 *
 * *** Zero cost when hidden — the RAF loop only runs while visible. ***
 */

"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { getPathCacheSize } from "../../lib/brushes/path-cache";
import { getSprayDebug } from "../../lib/brushes/spray-brush";
import { getSprayRasterDebug } from "../../lib/brushes/spray-raster";
import { useCanvasStore, useElementsArray } from "../../store/canvas-store";

// ─── constants ──────────────────────────────────────────────────────────────

/** EMA smoothing factor (0.05 = slow, 0.2 = fast) */
const ALPHA = 0.1;
/** How often (ms) we push the smoothed value to React state */
const UPDATE_INTERVAL_MS = 250;

// ─── types ──────────────────────────────────────────────────────────────────

interface PerfSnapshot {
	fps: number;
	frameTime: number; // ms
}

// ─── component ──────────────────────────────────────────────────────────────

interface PerfHUDProps {
	visible: boolean;
	/** Current freedraw point count — passed from Canvas (ref‑based). */
	freedrawPointCount: number;
}

export const PerfHUD = memo(function PerfHUD({
	visible,
	freedrawPointCount,
}: PerfHUDProps) {
	if (!visible) return null;
	return <PerfHUDInner freedrawPointCount={freedrawPointCount} />;
});

/**
 * Inner — only mounted while visible so the RAF loop doesn't run when hidden.
 */
function PerfHUDInner({ freedrawPointCount }: { freedrawPointCount: number }) {
	const elements = useElementsArray();
	const isDrawing = useCanvasStore((s) => s.isDrawing);
	const activeTool = useCanvasStore((s) => s.activeTool);
	const currentBrushType = useCanvasStore((s) => s.currentBrushType);

	const [perf, setPerf] = useState<PerfSnapshot>({ fps: 0, frameTime: 0 });

	// RAF‑based FPS meter
	const rafRef = useRef(0);
	const lastTimeRef = useRef(performance.now());
	const emaFpsRef = useRef(60);
	const emaFrameRef = useRef(16.67);
	const lastFlushRef = useRef(performance.now());

	const tick = useCallback((now: DOMHighResTimeStamp) => {
		const dt = now - lastTimeRef.current;
		lastTimeRef.current = now;

		if (dt > 0) {
			const instantFps = 1000 / dt;
			emaFpsRef.current = ALPHA * instantFps + (1 - ALPHA) * emaFpsRef.current;
			emaFrameRef.current = ALPHA * dt + (1 - ALPHA) * emaFrameRef.current;
		}

		// Flush to React at a lower cadence to avoid unnecessary re‑renders
		if (now - lastFlushRef.current > UPDATE_INTERVAL_MS) {
			lastFlushRef.current = now;
			setPerf({
				fps: Math.round(emaFpsRef.current),
				frameTime: emaFrameRef.current,
			});
		}

		rafRef.current = requestAnimationFrame(tick);
	}, []);

	useEffect(() => {
		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, [tick]);

	// Colour helpers
	const fpsColor =
		perf.fps >= 50
			? "text-green-400"
			: perf.fps >= 30
				? "text-yellow-400"
				: "text-red-400";
	const ftColor =
		perf.frameTime <= 20
			? "text-green-400"
			: perf.frameTime <= 33
				? "text-yellow-400"
				: "text-red-400";

	return (
		<div
			className="absolute top-14 right-3 z-[900] w-[190px]
			           rounded-xl bg-gray-900/90 backdrop-blur-md text-gray-200 shadow-xl
			           border border-gray-700/60 select-none pointer-events-auto"
			style={{ fontSize: 11 }}
		>
			{/* Header */}
			<div className="px-3 py-2 border-b border-gray-700/60 flex items-center justify-between">
				<span className="text-[11px] font-bold tracking-wider text-emerald-400">
					PERF
				</span>
				<span className="text-[9px] text-gray-500">Ctrl+Shift+P</span>
			</div>

			<div className="px-3 py-2 space-y-1">
				{/* FPS */}
				<div className="flex justify-between">
					<span className="text-gray-400">FPS</span>
					<span className={`font-mono font-bold tabular-nums ${fpsColor}`}>
						{perf.fps}
					</span>
				</div>

				{/* Frame time */}
				<div className="flex justify-between">
					<span className="text-gray-400">frame</span>
					<span className={`font-mono tabular-nums ${ftColor}`}>
						{perf.frameTime.toFixed(1)} ms
					</span>
				</div>

				{/* Total objects */}
				<div className="flex justify-between">
					<span className="text-gray-400">objects</span>
					<span className="font-mono tabular-nums text-gray-100">
						{elements.length}
					</span>
				</div>

				{/* Points in current stroke */}
				{activeTool === "freedraw" && isDrawing && (
					<div className="flex justify-between">
						<span className="text-gray-400">stroke pts</span>
						<span className="font-mono tabular-nums text-gray-100">
							{freedrawPointCount}
						</span>
					</div>
				)}

				{/* Spray debug counters */}
				{activeTool === "freedraw" &&
					isDrawing &&
					currentBrushType === "spray" && <SprayDebugRow />}

				{/* Brush path cache utilisation (Phase 6) */}
				<div className="flex justify-between">
					<span className="text-gray-400">path cache</span>
					<span className="font-mono tabular-nums text-gray-100">
						{getPathCacheSize()}
					</span>
				</div>
			</div>
		</div>
	);
}

/**
 * Spray debug sub-row — reads the module-level counters from spray-brush.ts.
 * Rendered only while spray is actively drawing so getSprayDebug() is fresh.
 */
function SprayDebugRow() {
	const svgDebug = getSprayDebug();
	const rasterDebug = getSprayRasterDebug();
	// Prefer raster counters during live drawing (rasterDebug.totalDots > 0),
	// fall back to SVG counters for committed-element re-render.
	const totalDots = rasterDebug.totalDots || svgDebug.totalDots;
	const densityMode = svgDebug.densityMode;
	const frameDots = rasterDebug.lastFrameDots;
	const modeColor =
		densityMode === "full"
			? "text-green-400"
			: densityMode === "tapering"
				? "text-yellow-400"
				: "text-red-400";
	return (
		<>
			<div className="flex justify-between">
				<span className="text-gray-400">spray dots</span>
				<span className="font-mono tabular-nums text-gray-100">
					{totalDots}
				</span>
			</div>
			<div className="flex justify-between">
				<span className="text-gray-400">frame dots</span>
				<span className="font-mono tabular-nums text-gray-100">
					{frameDots}
				</span>
			</div>
			<div className="flex justify-between">
				<span className="text-gray-400">density</span>
				<span className={`font-mono tabular-nums ${modeColor}`}>
					{densityMode}
				</span>
			</div>
		</>
	);
}
