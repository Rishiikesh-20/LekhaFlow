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
import {
	type BrushPoint,
	getBrush,
	getCachedLayers,
	getCachedPath,
	normalizeBrushType,
} from "../../lib/brushes";
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

	// Effective ghost opacity = element's own opacity × ghost factor
	// e.g. a 50%-opacity stroke ghosted at 35% → 17.5% total opacity
	const elementOpacity = (preview.opacity ?? 100) / 100;
	const ghostAlpha = elementOpacity * GHOST_OPACITY;

	// Common props for shape ghosts (rect / ellipse / diamond / line / arrow)
	// freedraw paths are NOT given these props — they handle opacity individually
	const commonProps = {
		opacity: ghostAlpha,
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

			// Convert flat [x,y,x,y,...] to pair array for rendering
			const pointPairs: Array<[number, number]> = [];
			for (let i = 0; i < points.length; i += 2) {
				const px = points[i];
				const py = points[i + 1];
				if (px !== undefined && py !== undefined) {
					pointPairs.push([px, py]);
				}
			}

			// Use brush engine with path caching for performance
			const brushType = normalizeBrushType(preview.brushType);
			const brush = getBrush(brushType);

			const labelNode = (
				<Text
					x={x + (pointPairs[0]?.[0] || 0)}
					y={y + (pointPairs[0]?.[1] || 0) - 18}
					text={labelText}
					fontSize={11}
					fill={ghostStroke}
					opacity={0.6}
					listening={false}
				/>
			);

			if (brush) {
				const brushPoints: BrushPoint[] = pointPairs.map(([bx, by]) => ({
					x: bx,
					y: by,
					pressure: 0.5,
				}));
				const brushOpts = {
					size: strokeWidth * 2,
					seedId: preview.seedId,
				};
				// Use cached layers — ghost previews are recomputed at ~60fps,
				// caching avoids redundant path generation for identical point sets
				const layers = getCachedLayers(brush, brushPoints, brushOpts);
				if (!layers.length) return null;

				if (layers.length > 1) {
					// Multi-pass ghost: the inner Group composites all passes first,
					// then ghostAlpha fades the whole result uniformly.
					return (
						<Group>
							<Group x={x} y={y} opacity={ghostAlpha}>
								{layers.map((layer, idx) => (
									<Path
										key={`layer-${idx}`}
										data={layer.path}
										fill={ghostStroke}
										opacity={layer.opacity}
										shadowBlur={layer.shadowBlur ?? 0}
										shadowColor={ghostStroke}
										shadowEnabled={!!layer.shadowBlur}
										shadowOpacity={0.4}
										listening={false}
										perfectDrawEnabled={false}
									/>
								))}
							</Group>
							{labelNode}
						</Group>
					);
				}

				// Single-layer ghost (pencil, spray): straightforward tinted path
				const pathData = getCachedPath(brush, brushPoints, brushOpts);
				if (!pathData) return null;
				return (
					<Group>
						<Path
							x={x}
							y={y}
							data={pathData}
							fill={ghostStroke}
							opacity={ghostAlpha}
							listening={false}
							perfectDrawEnabled={false}
						/>
						{labelNode}
					</Group>
				);
			}

			// Fallback to perfect-freehand for unknown brush types
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
						fill={ghostStroke}
						opacity={ghostAlpha}
						listening={false}
						perfectDrawEnabled={false}
					/>
					{labelNode}
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
