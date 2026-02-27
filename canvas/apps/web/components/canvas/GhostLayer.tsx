/**
 * ============================================================================
 * LEKHAFLOW - GHOST LAYER COMPONENT
 * ============================================================================
 *
 * Renders translucent previews of what remote users are currently drawing.
 *
 * ISOLATION GUARANTEES:
 * - listening={false} → no pointer events, no selection conflicts
 * - Separate <Layer> → not part of the main shapes layer
 * - No zIndex system involvement
 * - No Y.js document involvement
 * - No rotation/resize handle interference
 * - Memoized to prevent unnecessary re-renders
 */

"use client";

import { memo } from "react";
import {
	Arrow,
	Ellipse,
	Group,
	Layer,
	Line,
	Path,
	Rect,
	Text,
} from "react-konva";
import type { RemoteGhost } from "../../hooks/useGhostPreviews";
import { outlineToSvgPath } from "../../lib/stroke-utils";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Ghost opacity for translucent preview */
const GHOST_OPACITY = 0.35;

/** Dash pattern for ghost outlines */
const GHOST_DASH = [8, 4];

// ============================================================================
// GHOST SHAPE RENDERER
// ============================================================================

/**
 * Renders a single ghost shape based on its type.
 * All ghosts are non-interactive:
 * - No selection
 * - No dragging
 * - No resize handles
 * - No rotation handles
 */
const GhostShape = memo(({ ghost }: { ghost: RemoteGhost }) => {
	const { preview, clientId } = ghost;
	const {
		type,
		x,
		y,
		width,
		height,
		points,
		strokeColor,
		strokeWidth,
		fillColor,
		clientName,
	} = preview;

	// Use client color tint if available, otherwise stroke color
	const ghostStroke = preview.clientColor || strokeColor || "#888888";
	const ghostFill = fillColor ? `${fillColor}40` : "transparent"; // 25% alpha fill

	// Common props for all ghost shapes — ensures no interaction
	const commonProps = {
		opacity: GHOST_OPACITY,
		dash: GHOST_DASH,
		listening: false,
		perfectDrawEnabled: false,
	};

	const labelText = clientName || `User ${clientId}`;

	switch (type) {
		case "rectangle":
			return (
				<Group>
					<Rect
						x={x}
						y={y}
						width={width}
						height={height}
						stroke={ghostStroke}
						strokeWidth={strokeWidth}
						fill={ghostFill}
						{...commonProps}
					/>
					<Text
						x={x}
						y={y - 18}
						text={labelText}
						fontSize={11}
						fill={ghostStroke}
						opacity={0.6}
						listening={false}
					/>
				</Group>
			);

		case "ellipse":
			return (
				<Group>
					<Ellipse
						x={x + width / 2}
						y={y + height / 2}
						radiusX={Math.abs(width / 2)}
						radiusY={Math.abs(height / 2)}
						stroke={ghostStroke}
						strokeWidth={strokeWidth}
						fill={ghostFill}
						{...commonProps}
					/>
					<Text
						x={x}
						y={y - 18}
						text={labelText}
						fontSize={11}
						fill={ghostStroke}
						opacity={0.6}
						listening={false}
					/>
				</Group>
			);

		case "diamond": {
			const cx = width / 2;
			const cy = height / 2;
			const diamondPoints = [cx, 0, width, cy, cx, height, 0, cy];
			return (
				<Group>
					<Line
						x={x}
						y={y}
						points={diamondPoints}
						closed
						stroke={ghostStroke}
						strokeWidth={strokeWidth}
						fill={ghostFill}
						{...commonProps}
					/>
					<Text
						x={x}
						y={y - 18}
						text={labelText}
						fontSize={11}
						fill={ghostStroke}
						opacity={0.6}
						listening={false}
					/>
				</Group>
			);
		}

		case "line":
			return (
				<Group>
					<Line
						x={x}
						y={y}
						points={points}
						stroke={ghostStroke}
						strokeWidth={strokeWidth}
						{...commonProps}
					/>
					<Text
						x={x + (points[0] || 0)}
						y={y + (points[1] || 0) - 18}
						text={labelText}
						fontSize={11}
						fill={ghostStroke}
						opacity={0.6}
						listening={false}
					/>
				</Group>
			);

		case "arrow":
			return (
				<Group>
					<Arrow
						x={x}
						y={y}
						points={points}
						stroke={ghostStroke}
						strokeWidth={strokeWidth}
						pointerLength={10}
						pointerWidth={10}
						fill={ghostStroke}
						{...commonProps}
					/>
					<Text
						x={x + (points[0] || 0)}
						y={y + (points[1] || 0) - 18}
						text={labelText}
						fontSize={11}
						fill={ghostStroke}
						opacity={0.6}
						listening={false}
					/>
				</Group>
			);

		case "freedraw":
		case "freehand": {
			if (!points || points.length < 4) return null;

			// Convert flat [x,y,x,y,...] to [[x,y],[x,y],...] for perfect-freehand
			const pointPairs: Array<[number, number]> = [];
			for (let i = 0; i < points.length; i += 2) {
				const px = points[i];
				const py = points[i + 1];
				if (px !== undefined && py !== undefined) {
					pointPairs.push([px, py]);
				}
			}

			const pathData = outlineToSvgPath(pointPairs, {
				size: strokeWidth * 2,
				thinning: 0.5,
				smoothing: 0.5,
				streamline: 0.5,
				simulatePressure: true,
			});

			if (!pathData) return null;

			return (
				<Group>
					<Path
						x={x}
						y={y}
						data={pathData}
						fill={`${ghostStroke}59`} // 35% alpha
						{...commonProps}
					/>
					<Text
						x={x + (pointPairs[0]?.[0] || 0)}
						y={y + (pointPairs[0]?.[1] || 0) - 18}
						text={labelText}
						fontSize={11}
						fill={ghostStroke}
						opacity={0.6}
						listening={false}
					/>
				</Group>
			);
		}

		default:
			return null;
	}
});

GhostShape.displayName = "GhostShape";

// ============================================================================
// GHOST LAYER
// ============================================================================

interface GhostLayerProps {
	remoteGhosts: RemoteGhost[];
}

/**
 * GhostLayer — Rendered above the shapes layer, below UI controls
 *
 * listening={false} ensures:
 * - No pointer events reach ghost shapes
 * - No interference with selection system
 * - No interference with rotation handles
 * - No interference with resize handles
 * - No interference with drag/drop
 */
const GhostLayer = memo(({ remoteGhosts }: GhostLayerProps) => {
	if (remoteGhosts.length === 0) return null;

	return (
		<Layer name="ghost-layer" listening={false}>
			{remoteGhosts.map((ghost) => (
				<GhostShape key={`ghost-${ghost.clientId}`} ghost={ghost} />
			))}
		</Layer>
	);
});

GhostLayer.displayName = "GhostLayer";

export default GhostLayer;
