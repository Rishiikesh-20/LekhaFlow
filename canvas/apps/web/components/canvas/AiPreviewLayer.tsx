/**
 * ============================================================================
 * LEKHAFLOW - AI PREVIEW LAYER
 * ============================================================================
 *
 * Renders a visual overlay showing proposed AI modifications before
 * the user accepts or rejects them.
 *
 * Affected elements are highlighted with a pulsing green glow and
 * dashed borders to clearly distinguish them from committed elements.
 *
 * ISOLATION: listening={false} → no pointer events, no selection conflicts
 */

"use client";

import type { CanvasElement } from "@repo/common";
import { memo } from "react";
import { Ellipse, Group, Layer, Line, Rect, Text } from "react-konva";
import type { ElementDiff } from "../../lib/ai-modify-parser";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Highlight color for preview overlay */
const PREVIEW_COLOR = "#22c55e"; // green-500

/** Dash pattern for preview borders */
const PREVIEW_DASH = [6, 3];

/** Preview overlay opacity */
const PREVIEW_OPACITY = 0.55;

// ============================================================================
// PREVIEW SHAPE RENDERER
// ============================================================================

/**
 * Renders a single preview element with the proposed diff applied.
 * Elements are shown with a green glow + dashed border.
 */
const PreviewShape = memo(
	({ element, diff }: { element: CanvasElement; diff: ElementDiff }) => {
		// Apply diff on top of original element
		const preview = { ...element, ...diff };

		const highlightProps = {
			stroke: PREVIEW_COLOR,
			strokeWidth: 2,
			dash: PREVIEW_DASH,
			opacity: PREVIEW_OPACITY,
			listening: false,
			perfectDrawEnabled: false,
		};

		const labelText = "AI Preview";

		switch (element.type) {
			case "rectangle":
				return (
					<Group>
						{/* Modified element fill preview */}
						<Rect
							x={preview.x}
							y={preview.y}
							width={preview.width}
							height={preview.height}
							fill={
								preview.backgroundColor !== "transparent"
									? `${preview.backgroundColor}60`
									: undefined
							}
							stroke={preview.strokeColor || PREVIEW_COLOR}
							strokeWidth={preview.strokeWidth || 2}
							dash={PREVIEW_DASH}
							opacity={PREVIEW_OPACITY}
							listening={false}
							perfectDrawEnabled={false}
						/>
						{/* Green highlight border */}
						<Rect
							x={preview.x - 3}
							y={preview.y - 3}
							width={preview.width + 6}
							height={preview.height + 6}
							{...highlightProps}
							fill="transparent"
						/>
						<Text
							x={preview.x}
							y={preview.y - 18}
							text={labelText}
							fontSize={10}
							fill={PREVIEW_COLOR}
							opacity={0.8}
							listening={false}
						/>
					</Group>
				);

			case "ellipse":
				return (
					<Group>
						<Ellipse
							x={preview.x + preview.width / 2}
							y={preview.y + preview.height / 2}
							radiusX={Math.abs(preview.width / 2)}
							radiusY={Math.abs(preview.height / 2)}
							fill={
								preview.backgroundColor !== "transparent"
									? `${preview.backgroundColor}60`
									: undefined
							}
							stroke={preview.strokeColor || PREVIEW_COLOR}
							strokeWidth={preview.strokeWidth || 2}
							dash={PREVIEW_DASH}
							opacity={PREVIEW_OPACITY}
							listening={false}
							perfectDrawEnabled={false}
						/>
						{/* Green highlight border */}
						<Ellipse
							x={preview.x + preview.width / 2}
							y={preview.y + preview.height / 2}
							radiusX={Math.abs(preview.width / 2) + 4}
							radiusY={Math.abs(preview.height / 2) + 4}
							{...highlightProps}
							fill="transparent"
						/>
						<Text
							x={preview.x}
							y={preview.y - 18}
							text={labelText}
							fontSize={10}
							fill={PREVIEW_COLOR}
							opacity={0.8}
							listening={false}
						/>
					</Group>
				);

			case "diamond": {
				const cx = preview.width / 2;
				const cy = preview.height / 2;
				const diamondPoints = [
					cx,
					0,
					preview.width,
					cy,
					cx,
					preview.height,
					0,
					cy,
				];
				return (
					<Group>
						<Line
							x={preview.x}
							y={preview.y}
							points={diamondPoints}
							closed
							fill={
								preview.backgroundColor !== "transparent"
									? `${preview.backgroundColor}60`
									: undefined
							}
							stroke={preview.strokeColor || PREVIEW_COLOR}
							strokeWidth={preview.strokeWidth || 2}
							dash={PREVIEW_DASH}
							opacity={PREVIEW_OPACITY}
							listening={false}
							perfectDrawEnabled={false}
						/>
						<Text
							x={preview.x}
							y={preview.y - 18}
							text={labelText}
							fontSize={10}
							fill={PREVIEW_COLOR}
							opacity={0.8}
							listening={false}
						/>
					</Group>
				);
			}

			case "text":
				return (
					<Group>
						<Rect
							x={preview.x - 3}
							y={preview.y - 3}
							width={preview.width + 6}
							height={preview.height + 6}
							{...highlightProps}
							fill={`${PREVIEW_COLOR}10`}
						/>
						<Text
							x={preview.x}
							y={preview.y - 16}
							text={labelText}
							fontSize={10}
							fill={PREVIEW_COLOR}
							opacity={0.8}
							listening={false}
						/>
					</Group>
				);

			default:
				// For line, arrow, freedraw — show simple highlight box
				return (
					<Group>
						<Rect
							x={preview.x - 5}
							y={preview.y - 5}
							width={(preview.width || 50) + 10}
							height={(preview.height || 50) + 10}
							{...highlightProps}
							fill={`${PREVIEW_COLOR}08`}
						/>
						<Text
							x={preview.x}
							y={preview.y - 18}
							text={labelText}
							fontSize={10}
							fill={PREVIEW_COLOR}
							opacity={0.8}
							listening={false}
						/>
					</Group>
				);
		}
	},
);

PreviewShape.displayName = "PreviewShape";

// ============================================================================
// AI PREVIEW LAYER
// ============================================================================

interface AiPreviewLayerProps {
	elements: Map<string, CanvasElement>;
	previewChanges: Map<string, ElementDiff>;
	isActive: boolean;
}

/**
 * AiPreviewLayer — Rendered above the shapes layer to show proposed changes.
 *
 * listening={false} ensures no interference with user interactions.
 */
const AiPreviewLayer = memo(
	({ elements, previewChanges, isActive }: AiPreviewLayerProps) => {
		if (!isActive || previewChanges.size === 0) return null;

		return (
			<Layer name="ai-preview-layer" listening={false}>
				{Array.from(previewChanges.entries()).map(([id, diff]) => {
					const element = elements.get(id);
					if (!element) return null;

					return (
						<PreviewShape
							key={`ai-preview-${id}`}
							element={element}
							diff={diff}
						/>
					);
				})}
			</Layer>
		);
	},
);

AiPreviewLayer.displayName = "AiPreviewLayer";

export default AiPreviewLayer;
