/**
 * ============================================================================
 * LEKHAFLOW - GRID LAYER
 * ============================================================================
 *
 * Konva-based background grid that renders dots or lines based on zoom level.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Group, Rect } from "react-konva";

interface GridLayerProps {
	width: number;
	height: number;
	zoom: number;
	scrollX: number;
	scrollY: number;
	mode: "none" | "grid" | "dots";
	canvasBackgroundColor: string;
}

export function GridLayer({
	width,
	height,
	zoom,
	scrollX,
	scrollY,
	mode,
	canvasBackgroundColor,
}: GridLayerProps) {
	const gridSize = 24;
	const [patternImage, setPatternImage] = useState<HTMLCanvasElement | null>(
		null,
	);

	// Determine grid color based on background luminance
	const isDarkBackground = useMemo(() => {
		const hex = canvasBackgroundColor.startsWith("#")
			? canvasBackgroundColor.replace("#", "")
			: "ffffff";
		const r = Number.parseInt(hex.substring(0, 2), 16) || 0;
		const g = Number.parseInt(hex.substring(2, 4), 16) || 0;
		const b = Number.parseInt(hex.substring(4, 6), 16) || 0;
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return luminance < 0.5;
	}, [canvasBackgroundColor]);

	useEffect(() => {
		if (mode === "none") return;

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		canvas.width = gridSize;
		canvas.height = gridSize;

		const gridColor = isDarkBackground
			? "rgba(255, 255, 255, 0.15)"
			: "rgba(0, 0, 0, 0.1)";

		if (mode === "dots") {
			ctx.fillStyle = gridColor;
			ctx.beginPath();
			ctx.arc(0, 0, 1 / Math.max(0.5, zoom), 0, Math.PI * 2);
			ctx.fill();
		} else if (mode === "grid") {
			ctx.strokeStyle = gridColor;
			ctx.lineWidth = 1 / Math.max(0.5, zoom);
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(gridSize, 0);
			ctx.moveTo(0, 0);
			ctx.lineTo(0, gridSize);
			ctx.stroke();
		}

		setPatternImage(canvas);
	}, [mode, zoom, isDarkBackground]);

	if (mode === "none" || !patternImage) return null;

	// Viewport in world coordinates
	const vw = width / zoom;
	const vh = height / zoom;
	const vx = -scrollX / zoom;
	const vy = -scrollY / zoom;

	return (
		<Group listening={false}>
			<Rect
				x={vx}
				y={vy}
				width={vw}
				height={vh}
				fillPatternImage={patternImage as unknown as HTMLImageElement}
				fillPatternScale={{ x: 1, y: 1 }}
				fillPatternOffset={{
					x: -vx,
					y: -vy,
				}}
				fillPatternRepeat="repeat"
			/>
		</Group>
	);
}
