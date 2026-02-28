/**
 * ============================================================================
 * LEKHAFLOW — DEBUG OVERLAY  (Phase 0)
 * ============================================================================
 *
 * Toggle: Ctrl + Shift + D
 *
 * Displays live state:
 *   - activeTool, activeBrushStyle (when freedraw)
 *   - thickness  (currentStrokeWidth)
 *   - opacity    (currentOpacity)
 *   - selectedObjectId(s), type, zIndex
 *   - transform  (x, y, width, height, angle)
 *   - zoom, scroll
 *   - element count, connection status
 *
 * Zero cost when hidden — the component returns `null`.
 */

"use client";

import type { CanvasElement } from "@repo/common";
import { memo } from "react";
import { getSprayDebug } from "../../lib/brushes/spray-brush";
import {
	useCanvasStore,
	useElementsArray,
	useSelectedElements,
} from "../../store/canvas-store";

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number | undefined, decimals = 1): string =>
	n == null ? "—" : n.toFixed(decimals);

const Section = ({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) => (
	<div className="mb-2">
		<div className="text-[10px] font-bold tracking-wider text-violet-300 uppercase mb-0.5">
			{title}
		</div>
		{children}
	</div>
);

const Row = ({ label, value }: { label: string; value: string | number }) => (
	<div className="flex justify-between gap-4 text-[11px] leading-[18px]">
		<span className="text-gray-400">{label}</span>
		<span className="text-gray-100 font-mono tabular-nums text-right">
			{value}
		</span>
	</div>
);

// ─── component ──────────────────────────────────────────────────────────────

interface DebugOverlayProps {
	visible: boolean;
	/** Current freedraw point count (from refs — passed in by Canvas) */
	freedrawPointCount: number;
}

export const DebugOverlay = memo(function DebugOverlay({
	visible,
	freedrawPointCount,
}: DebugOverlayProps) {
	// Early‑out: zero cost while closed
	if (!visible) return null;

	return <DebugOverlayInner freedrawPointCount={freedrawPointCount} />;
});

/**
 * Inner component — only mounted when the overlay is visible so hooks
 * only subscribe while the panel is open.
 */
function DebugOverlayInner({
	freedrawPointCount,
}: {
	freedrawPointCount: number;
}) {
	const activeTool = useCanvasStore((s) => s.activeTool);
	const brushType = useCanvasStore((s) => s.currentBrushType);
	const strokeWidth = useCanvasStore((s) => s.currentStrokeWidth);
	const strokeColor = useCanvasStore((s) => s.currentStrokeColor);
	const bgColor = useCanvasStore((s) => s.currentBackgroundColor);
	const strokeStyle = useCanvasStore((s) => s.currentStrokeStyle);
	const opacity = useCanvasStore((s) => s.currentOpacity);
	const zoom = useCanvasStore((s) => s.zoom);
	const scrollX = useCanvasStore((s) => s.scrollX);
	const scrollY = useCanvasStore((s) => s.scrollY);
	const isDrawing = useCanvasStore((s) => s.isDrawing);
	const isDragging = useCanvasStore((s) => s.isDragging);
	const isResizing = useCanvasStore((s) => s.isResizing);
	const isReadOnly = useCanvasStore((s) => s.isReadOnly);
	const isConnected = useCanvasStore((s) => s.isConnected);
	const isSynced = useCanvasStore((s) => s.isSynced);
	const roughEnabled = useCanvasStore((s) => s.currentRoughEnabled);

	const elements = useElementsArray();
	const selectedElements = useSelectedElements();

	const sel: CanvasElement | null =
		selectedElements.length === 1 ? (selectedElements[0] ?? null) : null;

	return (
		<div
			className="absolute top-14 left-3 z-[900] w-[220px] max-h-[calc(100vh-80px)] overflow-y-auto
			           rounded-xl bg-gray-900/90 backdrop-blur-md text-gray-200 shadow-xl
			           border border-gray-700/60 select-none pointer-events-auto"
			style={{ fontSize: 11 }}
		>
			{/* Header */}
			<div className="px-3 py-2 border-b border-gray-700/60 flex items-center justify-between">
				<span className="text-[11px] font-bold tracking-wider text-violet-400">
					DEBUG
				</span>
				<span className="text-[9px] text-gray-500">Ctrl+Shift+D</span>
			</div>

			<div className="px-3 py-2 space-y-1">
				{/* ── Tool ── */}
				<Section title="Tool">
					<Row label="active" value={activeTool} />
					{activeTool === "freedraw" && <Row label="brush" value={brushType} />}
					<Row label="thickness" value={strokeWidth} />
					<Row label="opacity" value={`${opacity}%`} />
					<Row label="strokeColor" value={strokeColor} />
					<Row label="bgColor" value={bgColor} />
					<Row label="strokeStyle" value={strokeStyle} />
					{roughEnabled && <Row label="rough" value="on" />}
				</Section>

				{/* ── Viewport ── */}
				<Section title="Viewport">
					<Row label="zoom" value={`${(zoom * 100).toFixed(0)}%`} />
					<Row label="scrollX" value={fmt(scrollX, 0)} />
					<Row label="scrollY" value={fmt(scrollY, 0)} />
				</Section>

				{/* ── Interaction ── */}
				<Section title="Interaction">
					<Row label="drawing" value={isDrawing ? "yes" : "no"} />
					<Row label="dragging" value={isDragging ? "yes" : "no"} />
					<Row label="resizing" value={isResizing ? "yes" : "no"} />
					<Row label="readOnly" value={isReadOnly ? "yes" : "no"} />
					{activeTool === "freedraw" && (
						<Row label="points" value={freedrawPointCount} />
					)}
				</Section>

				{/* ── Spray Debug ── */}
				{activeTool === "freedraw" && isDrawing && brushType === "spray" && (
					<Section title="Spray">
						<SprayDebugSection />
					</Section>
				)}

				{/* ── Scene ── */}
				<Section title="Scene">
					<Row label="elements" value={elements.length} />
					<Row label="connected" value={isConnected ? "yes" : "no"} />
					<Row label="synced" value={isSynced ? "yes" : "no"} />
				</Section>

				{/* ── Selection ── */}
				<Section title="Selection">
					<Row label="count" value={selectedElements.length} />
					{sel && (
						<>
							<Row label="id" value={sel.id.slice(0, 8)} />
							<Row label="type" value={sel.type} />
							<Row label="zIndex" value={sel.zIndex ?? "—"} />
							<Row label="x" value={fmt(sel.x)} />
							<Row label="y" value={fmt(sel.y)} />
							<Row label="w" value={fmt(sel.width)} />
							<Row label="h" value={fmt(sel.height)} />
							<Row label="angle" value={`${fmt(sel.angle ?? 0)}°`} />
							<Row label="opacity" value={`${sel.opacity ?? 100}%`} />
						</>
					)}
				</Section>
			</div>
		</div>
	);
}

/** Spray debug sub-section — mirrors PerfHUD's SprayDebugRow. */
function SprayDebugSection() {
	const { totalDots, densityMode } = getSprayDebug();
	return (
		<>
			<Row label="dots" value={totalDots} />
			<Row label="density" value={densityMode} />
		</>
	);
}
