/**
 * ============================================================================
 * LEKHAFLOW - ZOOM CONTROLS
 * ============================================================================
 *
 * Bottom-right floating zoom controls with undo/redo buttons.
 */

"use client";

import { Redo, Undo, ZoomIn, ZoomOut } from "lucide-react";
import { useCanvasStore } from "../../store/canvas-store";

interface ZoomControlsProps {
	undo?: () => void;
	redo?: () => void;
	canUndo?: boolean;
	canRedo?: boolean;
}

export function ZoomControls({
	undo,
	redo,
	canUndo = false,
	canRedo = false,
}: ZoomControlsProps) {
	const { zoom, setZoom, resetViewport } = useCanvasStore();

	const zoomIn = () => setZoom(Math.min(5, zoom * 1.2));
	const zoomOut = () => setZoom(Math.max(0.1, zoom / 1.2));

	return (
		<div className="fixed z-[var(--z-controls)] bottom-3 right-3 sm:bottom-4 sm:right-4">
			{/* Zoom Controls - Pill Shape */}
			<div
				className="glass-card-elevated flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 mb-2 sm:mb-3"
				style={{
					borderRadius: "24px",
					boxShadow: "var(--shadow-md)",
					animation: "fade-in 0.3s ease-out 0.4s backwards",
				}}
			>
				{/* Zoom Out */}
				<button
					type="button"
					onClick={zoomOut}
					title="Zoom out (Ctrl -)"
					className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all cursor-pointer border-none bg-transparent"
					style={{ borderRadius: "var(--radius-md)" }}
				>
					<ZoomOut size={18} />
				</button>

				{/* Zoom Level Display */}
				<button
					type="button"
					onClick={resetViewport}
					title="Reset zoom (Ctrl 0)"
					className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-transparent hover:bg-gray-100 text-gray-600 text-xs sm:text-sm font-semibold min-w-[48px] sm:min-w-[64px] tabular-nums cursor-pointer transition-colors border-none"
					style={{ borderRadius: "var(--radius-md)" }}
				>
					{Math.round(zoom * 100)}%
				</button>

				{/* Zoom In */}
				<button
					type="button"
					onClick={zoomIn}
					title="Zoom in (Ctrl +)"
					className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all cursor-pointer border-none bg-transparent"
					style={{ borderRadius: "var(--radius-md)" }}
				>
					<ZoomIn size={18} />
				</button>
			</div>

			{/* Undo/Redo Controls */}
			<div
				className="glass-card-elevated flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5"
				style={{
					borderRadius: "24px",
					boxShadow: "var(--shadow-md)",
					animation: "fade-in 0.3s ease-out 0.5s backwards",
				}}
			>
				{/* Undo */}
				<button
					type="button"
					onClick={() => undo?.()}
					disabled={!canUndo}
					title="Undo (Ctrl Z)"
					className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all border-none bg-transparent ${
						canUndo
							? "text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
							: "text-gray-300 cursor-not-allowed"
					}`}
					style={{ borderRadius: "var(--radius-md)" }}
				>
					<Undo size={18} />
				</button>

				{/* Redo */}
				<button
					type="button"
					onClick={() => redo?.()}
					disabled={!canRedo}
					title="Redo (Ctrl Shift Z)"
					className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all border-none bg-transparent ${
						canRedo
							? "text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
							: "text-gray-300 cursor-not-allowed"
					}`}
					style={{ borderRadius: "var(--radius-md)" }}
				>
					<Redo size={18} />
				</button>
			</div>
		</div>
	);
}
