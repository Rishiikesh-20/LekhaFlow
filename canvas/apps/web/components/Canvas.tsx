/**
 * ============================================================================
 * LEKHAFLOW - MAIN CANVAS COMPONENT
 * ============================================================================
 *
 * LINE-BY-LINE EXPLANATION OF THE SYNC ENGINE INTEGRATION:
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    CANVAS COMPONENT ARCHITECTURE                        │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                         │
 * │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
 * │  │   Canvas    │    │  useYjsSync │    │ Zustand     │                 │
 * │  │ Component   │◄───│    Hook     │◄───│   Store     │                 │
 * │  └─────────────┘    └─────────────┘    └─────────────┘                 │
 * │         │                  │                  │                        │
 * │         │ Mouse Events     │ Yjs Updates      │ State                  │
 * │         ▼                  ▼                  ▼                        │
 * │  ┌─────────────────────────────────────────────────────┐              │
 * │  │                 React Konva Stage                   │              │
 * │  │  - Renders all elements from store                  │              │
 * │  │  - Handles mouse/touch interactions                 │              │
 * │  │  - Supports zoom and pan                            │              │
 * │  └─────────────────────────────────────────────────────┘              │
 * │                                                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DATA FLOW (When User Draws):
 *
 * 1. User clicks and drags on canvas
 * 2. Mouse events trigger element creation/update
 * 3. useYjsSync.addElement() updates Yjs document
 * 4. Yjs broadcasts update to server
 * 5. Server broadcasts to other clients
 * 6. All clients' Yjs observers fire
 * 7. Zustand store updates with new elements
 * 8. React re-renders the canvas
 *
 * This ensures REAL-TIME COLLABORATION:
 * - All users see the same canvas state
 * - No manual refresh needed
 * - Conflicts are auto-resolved by CRDT
 */

"use client";

import type {
	ArrowElement,
	CanvasElement,
	FreedrawElement,
	LineElement,
	Point,
	TextElement,
	TextRun,
	Tool,
} from "@repo/common";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Archive as LucideArchive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	Arrow,
	Circle,
	Ellipse,
	Group,
	Image as KonvaImage,
	Layer,
	Line,
	Path,
	Rect,
	Stage,
	Text,
} from "react-konva";
import type { GhostPreview } from "../hooks/useGhostPreviews";
import { useGhostPreviews } from "../hooks/useGhostPreviews";
import { useViewportPersistence } from "../hooks/useViewportPersistence";
import { useYjsSync } from "../hooks/useYjsSync";
import { beautifyElements } from "../lib/beautify";
import {
	type BrushPoint,
	getBrush,
	getCachedLayers,
	getCachedPath,
	normalizeBrushType,
} from "../lib/brushes";
import {
	SprayRasterEngine,
	setActiveSprayEngine,
} from "../lib/brushes/spray-raster";
import { classifyDiagram, type DiagramType } from "../lib/diagram-classifier";
import {
	createArrow,
	createFreedraw,
	createLine,
	createShape,
	createText,
	getAllElementsAtPoint,
	getCombinedBounds,
	getElementAtPoint,
	getElementsInSelection,
	getRotatedBoundingBox,
	normalizeRect,
	type ShapeModifiers,
} from "../lib/element-utils";
import { importSceneFromFile } from "../lib/import-scene";
import {
	type RoughRenderOptions,
	roughArrow,
	roughDiamond,
	roughEllipse,
	roughLine,
	roughRectangle,
} from "../lib/rough-renderer";
import { outlineToSvgPath } from "../lib/stroke-utils";
import { supabase } from "../lib/supabase.client";
import { buildKonvaFontStyle, layoutRuns } from "../lib/text-runs";
import { generateThumbnailBlob } from "../lib/thumbnail";
import {
	useCanvasStore,
	useCollaboratorsArray,
	useElementsArray,
} from "../store/canvas-store";
import { ActivitySidebar } from "./canvas/ActivitySidebar";
import { AiChatSidebar } from "./canvas/AiChatSidebar";
import { AttributionTooltip } from "./canvas/AttributionTooltip";
import { BeautifyButton } from "./canvas/BeautifyButton";
import { CollaboratorCursors } from "./canvas/CollaboratorCursors";
import { ConnectionStatus } from "./canvas/ConnectionStatus";
import { ContextMenu } from "./canvas/ContextMenu";
import { DebugOverlay } from "./canvas/DebugOverlay";
import { DiagramIntentBadge } from "./canvas/DiagramIntentBadge";
import { DocumentationModal } from "./canvas/DocumentationModal";
import { EmptyCanvasHero } from "./canvas/EmptyCanvasHero";
import { ExportModal } from "./canvas/ExportModal";
import GhostLayer from "./canvas/GhostLayer";
import { GridLayer } from "./canvas/GridLayer";
import {
	type GroupHandlePosition,
	GroupTransformHandles,
} from "./canvas/GroupTransformHandles";
import { HeaderLeft, HeaderRight } from "./canvas/Header";
import { PerfHUD } from "./canvas/PerfHUD";
import { PropertiesPanel } from "./canvas/PropertiesPanel";
import { type HandlePosition, ResizeHandles } from "./canvas/ResizeHandles";
import { RoomChat } from "./canvas/RoomChat";
import { RichTextEditor } from "./canvas/RichTextEditor";
import { RotationControls } from "./canvas/RotationControls";
import { TextFormattingToolbar } from "./canvas/TextFormattingToolbar";
// Import components directly to avoid circular dependencies through barrel exports
import { Toolbar } from "./canvas/Toolbar";
import { VersionsPanel } from "./canvas/VersionsPanel";
import { ZoomControls } from "./canvas/ZoomControls";
import { SetupStatus } from "./SetupStatus";

// ============================================================================
// TYPES
// ============================================================================

interface CanvasProps {
	roomId: string;
	token?: string | null;
}

// ============================================================================
// HELPER: RENDER ELEMENT
// ============================================================================

/**
 * Render a single element based on its type
 *
 * @param element - The element to render
 * @param isSelected - Whether the element is selected
 * @param isDraggable - Whether the element can be dragged
 * @param isPreview - Whether this is a preview (dashed rendering)
 * @param onDragEnd - Callback when drag ends
 */
function renderElement(
	element: CanvasElement,
	isSelected: boolean,
	isDraggable: boolean,
	isPreview: boolean,
	onDragEnd: (id: string, x: number, y: number) => void,
	onJointDrag?: (id: string, pointIndex: number, x: number, y: number) => void,
) {
	const commonProps = {
		id: element.id,
		x: element.x,
		y: element.y,
		opacity: element.opacity / 100,
		rotation: element.angle,
		draggable: isDraggable,
		perfectDrawEnabled: false,
		shadowForStrokeEnabled: false,
		listening: isDraggable,
		onDragEnd: (e: KonvaEventObject<DragEvent>) => {
			// For shapes with center-based positioning, adjust back to top-left
			let finalX = e.target.x();
			let finalY = e.target.y();

			// Shapes that use center positioning need offset adjustment
			if (
				element.type === "rectangle" ||
				element.type === "ellipse" ||
				element.type === "diamond" ||
				element.type === "text"
			) {
				finalX = e.target.x() - element.width / 2;
				finalY = e.target.y() - element.height / 2;
			}

			onDragEnd(element.id, finalX, finalY);
		},
	};

	// Selection glow effect
	const selectionProps = isSelected
		? {
				shadowColor: "#3b82f6",
				shadowBlur: 10,
				shadowOpacity: 0.8,
				shadowEnabled: true,
			}
		: {
				shadowEnabled: false,
			};

	// Enhanced glow for lines/arrows (thicker shadow since lines are thin)
	const lineSelectionProps = isSelected
		? {
				shadowColor: "#3b82f6",
				shadowBlur: 15,
				shadowOpacity: 0.9,
				shadowEnabled: true,
			}
		: {
				shadowEnabled: false,
			};

	const strokeProps = {
		stroke: element.strokeColor,
		strokeWidth: element.strokeWidth,
		dash: isPreview
			? [10, 5] // Dashed preview
			: element.strokeStyle === "dashed"
				? [10, 5]
				: element.strokeStyle === "dotted"
					? [2, 2]
					: undefined,
	};

	switch (element.type) {
		case "rectangle": {
			if (element.roughStyle?.enabled) {
				const roughOpts: RoughRenderOptions = {
					strokeColor: element.strokeColor,
					strokeWidth: element.strokeWidth,
					fillColor: element.backgroundColor,
					sloppiness: element.roughStyle.sloppiness,
					seed: element.seed,
					fillStyle: element.fillStyle,
				};
				const { strokePath, fillPath, fillMode } = roughRectangle(
					element.width,
					element.height,
					roughOpts,
				);
				return (
					<Group
						key={element.id}
						{...commonProps}
						{...selectionProps}
						x={element.x + element.width / 2}
						y={element.y + element.height / 2}
						offsetX={element.width / 2}
						offsetY={element.height / 2}
					>
						{/* Invisible hit rect — makes entire interior clickable for selection & drag */}
						<Rect
							x={0}
							y={0}
							width={element.width}
							height={element.height}
							fill="transparent"
						/>
						{fillPath && fillMode === "fill" && (
							<Path
								data={fillPath}
								fill={
									element.backgroundColor === "transparent"
										? undefined
										: element.backgroundColor
								}
							/>
						)}
						{fillPath && fillMode === "stroke" && (
							<Path
								data={fillPath}
								stroke={
									element.backgroundColor === "transparent"
										? undefined
										: element.backgroundColor
								}
								strokeWidth={roughOpts.strokeWidth * 0.5}
								fill="transparent"
							/>
						)}
						{strokePath && (
							<Path
								data={strokePath}
								stroke={element.strokeColor}
								strokeWidth={element.strokeWidth}
								fill="transparent"
								dash={
									isPreview
										? [10, 5]
										: element.strokeStyle === "dashed"
											? [10, 5]
											: element.strokeStyle === "dotted"
												? [2, 2]
												: undefined
								}
							/>
						)}
					</Group>
				);
			}
			return (
				<Rect
					key={element.id}
					{...commonProps}
					{...strokeProps}
					{...selectionProps}
					x={element.x + element.width / 2}
					y={element.y + element.height / 2}
					width={element.width}
					height={element.height}
					offsetX={element.width / 2}
					offsetY={element.height / 2}
					fill={
						element.backgroundColor === "transparent"
							? "transparent"
							: element.backgroundColor
					}
					cornerRadius={element.roundness?.value ?? 0}
				/>
			);
		}

		case "ellipse": {
			if (element.roughStyle?.enabled) {
				const roughOpts: RoughRenderOptions = {
					strokeColor: element.strokeColor,
					strokeWidth: element.strokeWidth,
					fillColor: element.backgroundColor,
					sloppiness: element.roughStyle.sloppiness,
					seed: element.seed,
					fillStyle: element.fillStyle,
				};
				// Rough.js ellipse is center-based: (0,0) center with full w/h
				const { strokePath, fillPath, fillMode } = roughEllipse(
					Math.abs(element.width),
					Math.abs(element.height),
					roughOpts,
				);
				// Rough ellipse is centered at (0,0), so offset the group such that
				// (0,0) maps to the center of the element bounding box
				return (
					<Group
						key={element.id}
						{...commonProps}
						{...selectionProps}
						x={element.x + element.width / 2}
						y={element.y + element.height / 2}
					>
						{/* Invisible hit rect — makes entire interior clickable for selection & drag */}
						<Rect
							x={-Math.abs(element.width) / 2}
							y={-Math.abs(element.height) / 2}
							width={Math.abs(element.width)}
							height={Math.abs(element.height)}
							fill="transparent"
						/>
						{fillPath && fillMode === "fill" && (
							<Path
								data={fillPath}
								fill={
									element.backgroundColor === "transparent"
										? undefined
										: element.backgroundColor
								}
							/>
						)}
						{fillPath && fillMode === "stroke" && (
							<Path
								data={fillPath}
								stroke={
									element.backgroundColor === "transparent"
										? undefined
										: element.backgroundColor
								}
								strokeWidth={roughOpts.strokeWidth * 0.5}
								fill="transparent"
							/>
						)}
						{strokePath && (
							<Path
								data={strokePath}
								stroke={element.strokeColor}
								strokeWidth={element.strokeWidth}
								fill="transparent"
								dash={
									isPreview
										? [10, 5]
										: element.strokeStyle === "dashed"
											? [10, 5]
											: element.strokeStyle === "dotted"
												? [2, 2]
												: undefined
								}
							/>
						)}
					</Group>
				);
			}
			return (
				<Ellipse
					key={element.id}
					{...commonProps}
					{...strokeProps}
					{...selectionProps}
					x={element.x + element.width / 2}
					y={element.y + element.height / 2}
					radiusX={Math.abs(element.width) / 2}
					radiusY={Math.abs(element.height) / 2}
					fill={
						element.backgroundColor === "transparent"
							? "transparent"
							: element.backgroundColor
					}
				/>
			);
		}

		case "line": {
			const lineElement = element as LineElement;
			const points = lineElement.points.flatMap((p) => [p.x, p.y]);

			if (element.roughStyle?.enabled) {
				const roughOpts: RoughRenderOptions = {
					strokeColor: element.strokeColor,
					strokeWidth: element.strokeWidth,
					fillColor: "transparent",
					sloppiness: element.roughStyle.sloppiness,
					seed: element.seed,
				};
				const { strokePath } = roughLine(lineElement.points, roughOpts);

				if (isSelected && onJointDrag && !isPreview) {
					return (
						<Group key={element.id}>
							<Path
								{...commonProps}
								{...lineSelectionProps}
								data={strokePath}
								stroke={element.strokeColor}
								strokeWidth={element.strokeWidth}
								fill="transparent"
								dash={
									isPreview
										? [10, 5]
										: element.strokeStyle === "dashed"
											? [10, 5]
											: element.strokeStyle === "dotted"
												? [2, 2]
												: undefined
								}
							/>
							{lineElement.points.map((point, index) => (
								<Circle
									key={`joint-${element.id}-${index}`}
									x={element.x + point.x}
									y={element.y + point.y}
									radius={8}
									fill="#3b82f6"
									stroke="#ffffff"
									strokeWidth={2}
									draggable={true}
									onDragMove={(e: KonvaEventObject<DragEvent>) => {
										const newX = e.target.x() - element.x;
										const newY = e.target.y() - element.y;
										onJointDrag(element.id, index, newX, newY);
									}}
									style={{ cursor: "move" }}
								/>
							))}
						</Group>
					);
				}

				return (
					<Path
						key={element.id}
						{...commonProps}
						{...lineSelectionProps}
						data={strokePath}
						stroke={element.strokeColor}
						strokeWidth={element.strokeWidth}
						fill="transparent"
						dash={
							isPreview
								? [10, 5]
								: element.strokeStyle === "dashed"
									? [10, 5]
									: element.strokeStyle === "dotted"
										? [2, 2]
										: undefined
						}
					/>
				);
			}

			// If selected, render with draggable endpoint/joint handles
			if (isSelected && onJointDrag && !isPreview) {
				return (
					<Group key={element.id}>
						<Line
							{...commonProps}
							{...strokeProps}
							{...lineSelectionProps}
							points={points}
							tension={0}
							lineCap="round"
							lineJoin="round"
							hitStrokeWidth={Math.max(element.strokeWidth, 10)}
						/>
						{/* Joint handles for each point */}
						{lineElement.points.map((point, index) => (
							<Circle
								key={`joint-${element.id}-${index}`}
								x={element.x + point.x}
								y={element.y + point.y}
								radius={8}
								fill="#3b82f6"
								stroke="#ffffff"
								strokeWidth={2}
								draggable={true}
								onDragMove={(e: KonvaEventObject<DragEvent>) => {
									// Update the point position relative to element origin
									const newX = e.target.x() - element.x;
									const newY = e.target.y() - element.y;
									onJointDrag(element.id, index, newX, newY);
								}}
								style={{ cursor: "move" }}
							/>
						))}
					</Group>
				);
			}

			// Default: simple line without joint handles
			return (
				<Line
					key={element.id}
					{...commonProps}
					{...strokeProps}
					{...lineSelectionProps}
					points={points}
					tension={0}
					lineCap="round"
					lineJoin="round"
					hitStrokeWidth={Math.max(element.strokeWidth, 10)}
				/>
			);
		}

		case "arrow": {
			const arrowElement = element as ArrowElement;
			const points = arrowElement.points.flatMap((p) => [p.x, p.y]);

			if (element.roughStyle?.enabled) {
				const roughOpts: RoughRenderOptions = {
					strokeColor: element.strokeColor,
					strokeWidth: element.strokeWidth,
					fillColor: "transparent",
					sloppiness: element.roughStyle.sloppiness,
					seed: element.seed,
				};
				const { strokePath } = roughArrow(arrowElement.points, roughOpts);

				if (isSelected && onJointDrag && !isPreview) {
					return (
						<Group key={element.id}>
							<Path
								{...commonProps}
								{...lineSelectionProps}
								data={strokePath}
								stroke={element.strokeColor}
								strokeWidth={element.strokeWidth}
								fill="transparent"
								dash={
									isPreview
										? [10, 5]
										: element.strokeStyle === "dashed"
											? [10, 5]
											: element.strokeStyle === "dotted"
												? [2, 2]
												: undefined
								}
							/>
							{arrowElement.points.map((point, index) => (
								<Circle
									key={`joint-${element.id}-${index}`}
									x={element.x + point.x}
									y={element.y + point.y}
									radius={8}
									fill="#3b82f6"
									stroke="#ffffff"
									strokeWidth={2}
									draggable={true}
									onDragMove={(e: KonvaEventObject<DragEvent>) => {
										const newX = e.target.x() - element.x;
										const newY = e.target.y() - element.y;
										onJointDrag(element.id, index, newX, newY);
									}}
									style={{ cursor: "move" }}
								/>
							))}
						</Group>
					);
				}

				return (
					<Path
						key={element.id}
						{...commonProps}
						{...lineSelectionProps}
						data={strokePath}
						stroke={element.strokeColor}
						strokeWidth={element.strokeWidth}
						fill="transparent"
						dash={
							isPreview
								? [10, 5]
								: element.strokeStyle === "dashed"
									? [10, 5]
									: element.strokeStyle === "dotted"
										? [2, 2]
										: undefined
						}
					/>
				);
			}

			// If selected, render with draggable endpoint/joint handles
			if (isSelected && onJointDrag && !isPreview) {
				return (
					<Group key={element.id}>
						<Arrow
							{...commonProps}
							{...strokeProps}
							{...lineSelectionProps}
							points={points}
							tension={0}
							lineCap="round"
							lineJoin="round"
							hitStrokeWidth={Math.max(element.strokeWidth, 10)}
							pointerLength={15}
							pointerWidth={12}
							fill={element.strokeColor}
						/>
						{/* Joint handles for each point */}
						{arrowElement.points.map((point, index) => (
							<Circle
								key={`joint-${element.id}-${index}`}
								x={element.x + point.x}
								y={element.y + point.y}
								radius={8}
								fill="#3b82f6"
								stroke="#ffffff"
								strokeWidth={2}
								draggable={true}
								onDragMove={(e: KonvaEventObject<DragEvent>) => {
									// Update the point position relative to element origin
									const newX = e.target.x() - element.x;
									const newY = e.target.y() - element.y;
									onJointDrag(element.id, index, newX, newY);
								}}
								style={{ cursor: "move" }}
							/>
						))}
					</Group>
				);
			}

			// Default: simple arrow without joint handles
			return (
				<Arrow
					key={element.id}
					{...commonProps}
					{...strokeProps}
					{...lineSelectionProps}
					points={points}
					tension={0}
					lineCap="round"
					lineJoin="round"
					hitStrokeWidth={Math.max(element.strokeWidth, 10)}
					pointerLength={15}
					pointerWidth={12}
					fill={element.strokeColor}
				/>
			);
		}

		case "freedraw": {
			const freedrawElement = element as FreedrawElement;
			// Strip optional pressure parameter for rendering
			const points: Array<[number, number]> = freedrawElement.points.map(
				([x, y]) => [x, y],
			);

			// For dashed/dotted styles, render as a stroked line
			// For solid style, use perfect-freehand filled path for smooth variable-width strokes
			if (
				element.strokeStyle === "dashed" ||
				element.strokeStyle === "dotted"
			) {
				// Convert points to flat array for Konva Line
				const flatPoints = points.flat();
				const dashArray = element.strokeStyle === "dashed" ? [10, 5] : [2, 2];

				return (
					<Line
						key={element.id}
						id={element.id}
						x={element.x}
						y={element.y}
						points={flatPoints}
						stroke={element.strokeColor}
						strokeWidth={element.strokeWidth}
						dash={dashArray}
						lineCap="round"
						lineJoin="round"
						opacity={element.opacity / 100}
						rotation={element.angle}
						draggable={isDraggable}
						perfectDrawEnabled={false}
						shadowForStrokeEnabled={false}
						listening={isDraggable}
						hitStrokeWidth={Math.max(element.strokeWidth, 10)}
						{...lineSelectionProps}
						onDragEnd={(e: KonvaEventObject<DragEvent>) => {
							onDragEnd(element.id, e.target.x(), e.target.y());
						}}
					/>
				);
			}

			// Solid style: use brush engine with path caching for performance
			const brushType = normalizeBrushType(freedrawElement.brushType);
			const brush = getBrush(brushType);

			if (brush) {
				// Convert points to BrushPoint format for the brush engine
				const brushPoints: BrushPoint[] = freedrawElement.points.map(
					([bx, by, pressure]) => ({
						x: bx,
						y: by,
						pressure: pressure ?? 0.5,
					}),
				);
				const brushOpts = {
					size: element.strokeWidth * 2,
					seedId: freedrawElement.seedId,
					streamline: 0,
					smoothing: 0,
				};
				const layers = getCachedLayers(brush, brushPoints, brushOpts);
				if (layers.length > 1) {
					// Multi-pass brush (watercolour): render layered Group
					return (
						<Group
							key={element.id}
							id={element.id}
							x={element.x}
							y={element.y}
							opacity={element.opacity / 100}
							rotation={element.angle}
							draggable={isDraggable}
							{...selectionProps}
							onDragEnd={(e: KonvaEventObject<DragEvent>) => {
								onDragEnd(element.id, e.target.x(), e.target.y());
							}}
						>
							{layers.map((layer, idx) => (
								<Path
									key={`layer-${idx}`}
									data={layer.path}
									fill={element.strokeColor}
									opacity={layer.opacity}
									shadowBlur={layer.shadowBlur ?? 0}
									shadowColor={element.strokeColor}
									shadowEnabled={!!layer.shadowBlur}
									shadowOpacity={0.6}
									listening={!layer.noHit}
								/>
							))}
						</Group>
					);
				}
				// Single-layer brush: use direct cached path
				const pathData = getCachedPath(brush, brushPoints, brushOpts);
				const isStrokeMode = brush.renderMode === "stroke";
				return (
					<Path
						key={element.id}
						id={element.id}
						x={element.x}
						y={element.y}
						data={pathData}
						fill={isStrokeMode ? undefined : element.strokeColor}
						stroke={isStrokeMode ? element.strokeColor : undefined}
						strokeWidth={isStrokeMode ? element.strokeWidth : undefined}
						lineCap={isStrokeMode ? "round" : undefined}
						lineJoin={isStrokeMode ? "miter" : undefined}
						opacity={element.opacity / 100}
						rotation={element.angle}
						draggable={isDraggable}
						hitStrokeWidth={
							isStrokeMode ? Math.max(element.strokeWidth, 10) : undefined
						}
						{...selectionProps}
						onDragEnd={(e: KonvaEventObject<DragEvent>) => {
							onDragEnd(element.id, e.target.x(), e.target.y());
						}}
					/>
				);
			}

			// Fallback to perfect-freehand for unknown brush types — raw input, no smoothing
			const pathData = outlineToSvgPath(points, {
				size: element.strokeWidth * 2,
				thinning: 0.5,
				smoothing: 0,
				streamline: 0,
				simulatePressure: true,
			});
			return (
				<Path
					key={element.id}
					id={element.id}
					x={element.x}
					y={element.y}
					data={pathData}
					fill={element.strokeColor}
					opacity={element.opacity / 100}
					rotation={element.angle}
					draggable={isDraggable}
					perfectDrawEnabled={false}
					shadowForStrokeEnabled={false}
					listening={isDraggable}
					{...selectionProps}
					onDragEnd={(e: KonvaEventObject<DragEvent>) => {
						onDragEnd(element.id, e.target.x(), e.target.y());
					}}
				/>
			);
		}

		case "diamond": {
			const w = element.width;
			const h = element.height;

			if (element.roughStyle?.enabled) {
				const roughOpts: RoughRenderOptions = {
					strokeColor: element.strokeColor,
					strokeWidth: element.strokeWidth,
					fillColor: element.backgroundColor,
					sloppiness: element.roughStyle.sloppiness,
					seed: element.seed,
					fillStyle: element.fillStyle,
				};
				// roughDiamond generates paths at (0,0) origin with given w/h
				const { strokePath, fillPath, fillMode } = roughDiamond(
					w,
					h,
					roughOpts,
				);
				return (
					<Group
						key={element.id}
						{...commonProps}
						{...selectionProps}
						x={element.x + w / 2}
						y={element.y + h / 2}
						offsetX={w / 2}
						offsetY={h / 2}
					>
						{/* Invisible hit rect — makes entire interior clickable for selection & drag */}
						<Rect x={0} y={0} width={w} height={h} fill="transparent" />
						{fillPath && fillMode === "fill" && (
							<Path
								data={fillPath}
								fill={
									element.backgroundColor === "transparent"
										? undefined
										: element.backgroundColor
								}
							/>
						)}
						{fillPath && fillMode === "stroke" && (
							<Path
								data={fillPath}
								stroke={
									element.backgroundColor === "transparent"
										? undefined
										: element.backgroundColor
								}
								strokeWidth={roughOpts.strokeWidth * 0.5}
								fill="transparent"
							/>
						)}
						{strokePath && (
							<Path
								data={strokePath}
								stroke={element.strokeColor}
								strokeWidth={element.strokeWidth}
								fill="transparent"
								dash={
									isPreview
										? [10, 5]
										: element.strokeStyle === "dashed"
											? [10, 5]
											: element.strokeStyle === "dotted"
												? [2, 2]
												: undefined
								}
							/>
						)}
					</Group>
				);
			}

			// Center the diamond points around (0,0) so rotation works correctly
			const diamondPoints = [
				0,
				-h / 2, // top
				w / 2,
				0, // right
				0,
				h / 2, // bottom
				-w / 2,
				0, // left
			];
			return (
				<Line
					key={element.id}
					{...commonProps}
					{...strokeProps}
					{...selectionProps}
					x={element.x + w / 2}
					y={element.y + h / 2}
					points={diamondPoints}
					closed={true}
					// Expand hit region for thin strokes (Story 2.4)
					hitStrokeWidth={Math.max(element.strokeWidth, 10)}
					fill={
						element.backgroundColor === "transparent"
							? "transparent"
							: element.backgroundColor
					}
				/>
			);
		}

		case "text": {
			const textElement = element as TextElement;

			// Rich-text rendering when element has runs
			if (textElement.runs && textElement.runs.length > 0) {
				const layout = layoutRuns(
					textElement.runs,
					textElement.width || undefined,
				);
				return (
					<Group
						key={element.id}
						{...commonProps}
						{...selectionProps}
						x={element.x + element.width / 2}
						y={element.y + element.height / 2}
						offsetX={element.width / 2}
						offsetY={element.height / 2}
					>
						{layout.lines.flatMap((line, li) =>
							line.segments.map((seg, si) => (
								<Text
									key={`${li}-${si}`}
									x={seg.x}
									y={seg.y}
									text={seg.text}
									fontSize={seg.fontSize}
									fontFamily={seg.fontFamily}
									fontStyle={buildKonvaFontStyle(seg.bold, seg.italic)}
									textDecoration={seg.underline ? "underline" : ""}
									fill={element.strokeColor}
								/>
							)),
						)}
					</Group>
				);
			}

			// Legacy plain-text rendering
			return (
				<Text
					key={element.id}
					{...commonProps}
					{...selectionProps}
					x={element.x + element.width / 2}
					y={element.y + element.height / 2}
					offsetX={element.width / 2}
					offsetY={element.height / 2}
					text={textElement.text}
					fontSize={textElement.fontSize}
					fontFamily="Arial"
					fill={element.strokeColor}
					width={element.width || undefined}
					align={textElement.textAlign}
				/>
			);
		}

		default:
			return null;
	}
}

// ============================================================================
// MAIN CANVAS COMPONENT
// ============================================================================

export function Canvas({ roomId, token }: CanvasProps) {
	const router = useRouter();
	// ─────────────────────────────────────────────────────────────────
	// REFS
	// ─────────────────────────────────────────────────────────────────

	const stageRef = useRef<Konva.Stage>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// ─────────────────────────────────────────────────────────────────
	// SYNC HOOK - The heart of collaboration!
	// ─────────────────────────────────────────────────────────────────

	/**
	 * useYjsSync connects to the WebSocket server and handles:
	 * - Document synchronization
	 * - Element CRUD operations
	 * - Awareness (cursors/presence)
	 * - Undo/Redo
	 */
	const {
		addElement,
		updateElement,
		batchUpdateElements,
		deleteElements,
		updateCursor,
		updateLaser,
		updateSelection,
		updateViewport,
		updateEditingElement,
		restoreVersion,
		undo,
		redo,
		canUndo,
		canRedo,
		awareness,
	} = useYjsSync(roomId, token ?? null);

	// ─────────────────────────────────────────────────────────────────
	// GHOST PREVIEWS - Live collaborative drawing previews
	// Uses Y.js awareness (NOT Y.Doc) for zero-latency broadcasting
	// ─────────────────────────────────────────────────────────────────

	const { remoteGhosts, broadcastGhost, clearGhost } =
		useGhostPreviews(awareness);

	// ─────────────────────────────────────────────────────────────────
	// VIEWPORT PERSISTENCE - Save/restore camera position per room
	// ─────────────────────────────────────────────────────────────────

	useViewportPersistence(roomId);

	// ─────────────────────────────────────────────────────────────────
	// STORE - Local state synced with Yjs
	// ─────────────────────────────────────────────────────────────────

	const {
		activeTool,
		setActiveTool,
		selectedElementIds,
		setSelectedElementIds,
		addToSelection,
		removeFromSelection,
		clearSelection,
		currentStrokeColor,
		currentBackgroundColor,
		currentStrokeWidth,
		currentStrokeStyle,
		currentOpacity,
		currentFillStyle,
		currentBrushType,
		currentRoughEnabled,
		currentSloppiness,
		zoom,
		scrollX,
		scrollY,
		setScroll,
		setZoom,
		isDrawing,
		setIsDrawing,
		isDragging,
		setIsDragging,
		interactionStartPoint,
		setInteractionStartPoint,
		isConnected,
		isSynced,
		isReadOnly,
		setReadOnly,
		setStrokeColor,
		setStrokeWidth,
		setOpacity,
		setBrushType,
		batchUpdateElements: storeBatchUpdate,
		activeTextStyle,
		isTextEditing,
		setTextEditing,
		setActiveTextStyle,
		canvasBackgroundColor,
		activeGridMode,
	} = useCanvasStore();

	// ─────────────────────────────────────────────────────────────────
	// BROADCAST VIEWPORT (Follow The Leader)
	// ─────────────────────────────────────────────────────────────────

	useEffect(() => {
		updateViewport({ scrollX, scrollY, zoom });
	}, [scrollX, scrollY, zoom, updateViewport]);

	// Elements and collaborators from store
	const elements = useElementsArray();
	const collaborators = useCollaboratorsArray();

	// Helper to get the next zIndex for new elements (always on top)
	// Uses elementsRef to avoid re-creating downstream callbacks on every element change
	const getNextZIndex = useCallback(() => {
		const els = elementsRef.current;
		if (els.length === 0) return 1;
		return Math.max(...els.map((el) => el.zIndex || 0)) + 1;
	}, []);

	// ─────────────────────────────────────────────────────────────────
	// GHOST PREVIEW BROADCASTING
	// Broadcasts current drawing state as a ghost preview to remote users.
	// Uses Y.js awareness (NOT Y.Doc) — no document writes.
	// Throttled internally by useGhostPreviews hook (16ms / ~60fps).
	// ─────────────────────────────────────────────────────────────────

	const broadcastDrawingPreview = useCallback(
		(element: Record<string, unknown> & { type?: string }) => {
			if (!element.type) return;

			const validTypes = [
				"rectangle",
				"ellipse",
				"diamond",
				"line",
				"arrow",
				"freedraw",
				"freehand",
			];
			if (!validTypes.includes(element.type)) return;

			// Build flat points array for line-based elements
			let flatPoints: number[] = [];
			const rawPoints = (element as Record<string, unknown>).points;
			if (Array.isArray(rawPoints) && rawPoints.length > 0) {
				if (typeof rawPoints[0] === "number") {
					// Already flat [x,y,x,y,...] (freedraw)
					flatPoints = rawPoints as number[];
				} else if (
					Array.isArray(rawPoints[0]) &&
					typeof rawPoints[0][0] === "number"
				) {
					// Tuple array [[x,y],[x,y],...] (freedraw points ref)
					flatPoints = (rawPoints as Array<[number, number]>).flatMap((p) => [
						p[0],
						p[1],
					]);
				} else if (
					typeof rawPoints[0] === "object" &&
					"x" in (rawPoints[0] as Record<string, unknown>)
				) {
					// Object array [{x,y},{x,y},...] (line/arrow points)
					flatPoints = (rawPoints as Array<{ x: number; y: number }>).flatMap(
						(p) => [p.x, p.y],
					);
				}
			}

			broadcastGhost({
				type: element.type as GhostPreview["type"],
				x: (element.x as number) || 0,
				y: (element.y as number) || 0,
				width: (element.width as number) || 0,
				height: (element.height as number) || 0,
				points: flatPoints,
				strokeColor: (element.strokeColor as string) || currentStrokeColor,
				strokeWidth: (element.strokeWidth as number) || currentStrokeWidth,
				opacity: (element.opacity as number) ?? currentOpacity,
				fillColor:
					(element.backgroundColor as string) || currentBackgroundColor,
				strokeStyle:
					(element.strokeStyle as GhostPreview["strokeStyle"]) || "solid",
				brushType:
					(element.brushType as GhostPreview["brushType"]) || currentBrushType,
				seedId: (element.seedId as string) || undefined,
				clientName: "",
				clientColor: "",
			});
		},
		[
			broadcastGhost,
			currentStrokeColor,
			currentStrokeWidth,
			currentOpacity,
			currentBackgroundColor,
			currentBrushType,
		],
	);

	// Clear ghost preview when tool changes (cancel any in-progress preview)
	// biome-ignore lint/correctness/useExhaustiveDependencies: activeTool is intentionally included to trigger clearGhost when tool changes
	useEffect(() => {
		clearGhost();
	}, [activeTool, clearGhost]);

	// Per-tool settings save / restore (Phase 5).
	// When leaving freedraw, snapshot current brush settings into a ref.
	// When returning to freedraw, restore them so selection-sync doesn't
	// permanently overwrite the user's chosen drawing settings.
	const prevActiveToolRef = useRef(activeTool);
	// biome-ignore lint/correctness/useExhaustiveDependencies: setters are stable; only activeTool should trigger this effect
	useEffect(() => {
		const prev = prevActiveToolRef.current;
		prevActiveToolRef.current = activeTool;
		if (prev === activeTool) return;

		const s = useCanvasStore.getState();

		// Leaving freedraw → save
		if (prev === "freedraw") {
			savedFreedrawSettingsRef.current = {
				strokeColor: s.currentStrokeColor,
				strokeWidth: s.currentStrokeWidth,
				opacity: s.currentOpacity,
				brushType: s.currentBrushType,
			};
		}

		// Entering freedraw → restore
		if (activeTool === "freedraw" && savedFreedrawSettingsRef.current) {
			const saved = savedFreedrawSettingsRef.current;
			if (s.currentStrokeColor !== saved.strokeColor)
				setStrokeColor(saved.strokeColor);
			if (s.currentStrokeWidth !== saved.strokeWidth)
				setStrokeWidth(saved.strokeWidth);
			if (s.currentOpacity !== saved.opacity) setOpacity(saved.opacity);
			if (s.currentBrushType !== saved.brushType) setBrushType(saved.brushType);
		}
	}, [activeTool]);

	// ─────────────────────────────────────────────────────────────────
	// LOCAL STATE for drawing
	// ─────────────────────────────────────────────────────────────────

	// Track element being currently drawn
	const [drawingElement, setDrawingElement] = useState<CanvasElement | null>(
		null,
	);

	// Keyboard modifiers for shape creation
	const [shiftPressed, setShiftPressed] = useState(false);
	const [altPressed, setAltPressed] = useState(false);
	// Tracks whether Space is held for temporary pan mode (like Excalidraw/Figma)
	const spacePressedRef = useRef(false);

	// Text editing state
	const [editingText, setEditingText] = useState<{
		x: number;
		y: number;
		initialText?: string;
		initialWidth?: number;
		initialHeight?: number;
		elementId?: string; // If set, editing existing element
		initialRuns?: TextRun[];
	} | null>(null);

	// Freedraw points accumulator (persistent strokes)
	const freedrawPointsRef = useRef<Array<[number, number]>>([]);

	// rAF batching for freedraw updates (Phase 5 — performance)
	const freedrawRafRef = useRef<number>(0);
	const freedrawDirtyRef = useRef(false);

	// Spray raster engine: offscreen canvas accumulator for live spray drawing.
	// Dots are stamped incrementally; Konva renders a single Image node.
	const sprayRasterRef = useRef<SprayRasterEngine | null>(null);
	const sprayImageRef = useRef<Konva.Image | null>(null);
	const sprayGhostThrottleRef = useRef(0);

	// Per-tool settings save/restore: remember freedraw appearance when
	// switching away so it isn't overwritten by the selection-sync effect.
	const savedFreedrawSettingsRef = useRef<{
		strokeColor: string;
		strokeWidth: number;
		opacity: number;
		brushType: "pencil" | "spray" | "watercolour";
	} | null>(null);

	// Laser points accumulator (temporary pointer)
	const laserPointsRef = useRef<Array<[number, number]>>([]);
	const [laserPath, setLaserPath] = useState<string | null>(null);

	// Eraser state - track continuous drag
	const isErasingRef = useRef<boolean>(false);
	const erasedElementsRef = useRef<Set<string>>(new Set());

	// Marquee (drag-select) state — ephemeral, lives in component not store
	const marqueeAnchorRef = useRef<Point | null>(null);
	const [marqueeRect, setMarqueeRect] = useState<{
		x: number;
		y: number;
		width: number;
		height: number;
	} | null>(null);
	/** Whether the current marquee should add to existing selection */
	const marqueeAdditiveRef = useRef(false);

	// ── Group-move interaction state ──
	/** Starting world-coords pointer position for the group drag */
	const groupMoveStartRef = useRef<Point | null>(null);
	/** Cached initial {id, x, y} for every selected element at drag start */
	const groupMoveInitialRef = useRef<
		Array<{ id: string; x: number; y: number }>
	>([]);
	/** rAF handle for batching group-move store updates */
	const groupMoveRafRef = useRef<number>(0);
	/** Latest unprocessed dx/dy for the group-move rAF */
	const groupMoveDeltaRef = useRef<{ dx: number; dy: number }>({
		dx: 0,
		dy: 0,
	});

	// ── Group-rotate interaction state ──
	const groupRotateRef = useRef<{
		centerX: number;
		centerY: number;
		startAngle: number;
		initials: Array<{ id: string; x: number; y: number; angle: number }>;
	} | null>(null);
	const groupRotateRafRef = useRef<number>(0);
	const groupRotateDeltaRef = useRef<number>(0);

	// ── Group-resize interaction state ──
	const groupResizeRef = useRef<{
		anchorX: number;
		anchorY: number;
		origWidth: number;
		origHeight: number;
		origX: number;
		origY: number;
		handle: GroupHandlePosition;
		initials: Array<{
			id: string;
			x: number;
			y: number;
			width: number;
			height: number;
			angle: number;
			points?: Array<[number, number, number?]>;
		}>;
	} | null>(null);
	const groupResizeRafRef = useRef<number>(0);
	const groupResizeScaleRef = useRef<{ sx: number; sy: number }>({
		sx: 1,
		sy: 1,
	});

	// Ref to track current selection (fixes stale closure in color update effects)
	const selectedElementIdsRef = useRef<Set<string>>(selectedElementIds);

	// Performance: throttle refs for cursor updates and hit testing
	const lastCursorUpdateRef = useRef<number>(0);
	const lastTooltipCheckRef = useRef<number>(0);

	// Container dimensions
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	// Clipboard for copy/paste
	const [clipboard, setClipboard] = useState<CanvasElement[]>([]);

	// Attribution tooltip state (hover inspection – Story 7)
	const [hoveredElement, setHoveredElement] = useState<CanvasElement | null>(
		null,
	);
	const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({
		x: 0,
		y: 0,
	});

	// Context menu state
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		visible: boolean;
		metadata?: { createdBy?: string; lastModifiedBy?: string };
	}>({
		x: 0,
		y: 0,
		visible: false,
	});

	// Resize state
	const [resizingElement, setResizingElement] = useState<{
		id: string;
		originalX: number;
		originalY: number;
		originalWidth: number;
		originalHeight: number;
		handle: HandlePosition;
		startMouseX: number;
		startMouseY: number;
	} | null>(null);

	// Rotation state
	const [rotatingElement, setRotatingElement] = useState<{
		id: string;
		originalAngle: number;
	} | null>(null);

	// rAF-batched rotation: store pending angle in a ref, flush via rAF
	const pendingRotationRef = useRef<{
		id: string;
		angle: number;
	} | null>(null);
	const rotationRafRef = useRef<number | null>(null);

	// Export modal state
	const [showExportModal, setShowExportModal] = useState(false);
	const [exportFormat, setExportFormat] = useState<"png" | "svg" | "json">(
		"png",
	);

	// Documentation modal state (Story 4)
	const [showDocModal, setShowDocModal] = useState(false);

	// Diagram Intent State (Story 5)
	const [diagramIntent, setDiagramIntent] = useState<DiagramType>("Generic");

	// Handle export from sidebar menu
	const handleExport = useCallback((format: "png" | "svg" | "json") => {
		setExportFormat(format);
		setShowExportModal(true);
	}, []);

	// Handle documentation generation (Story 4)
	const handleExportDocumentation = useCallback(() => {
		setShowDocModal(true);
	}, []);

	// ─────────────────────────────────────────────────────────────────
	// DEBUG + PERF OVERLAYS  (Phase 0)
	// ─────────────────────────────────────────────────────────────────

	const [showDebugOverlay, setShowDebugOverlay] = useState(false);
	const [showPerfHUD, setShowPerfHUD] = useState(false);

	/** Live freedraw point count (cheap — just reads ref length). */
	const freedrawPointCount = freedrawPointsRef.current.length;

	// Import JSON scene
	const handleImportScene = useCallback(() => {
		const els = elementsRef.current;
		const nextZ =
			els.length === 0 ? 1 : Math.max(...els.map((el) => el.zIndex || 0)) + 1;

		importSceneFromFile(addElement, nextZ).then((result) => {
			if (result.success) {
				console.log(`[LekhaFlow] Imported ${result.importedCount} elements`);
			} else if (result.error && result.error !== "Cancelled") {
				console.error(`[LekhaFlow] Import failed: ${result.error}`);
				window.alert(`Import failed: ${result.error}`);
			}
		});
	}, [addElement]);

	const { updateSettings } = useYjsSync(roomId, token ?? null);

	// ─────────────────────────────────────────────────────────────────
	// AUTO-CAPTURE THUMBNAIL for dashboard preview
	// Debounced: captures 2s after any element change
	// ─────────────────────────────────────────────────────────────────

	const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const HTTP_URL =
		process.env.NEXT_PUBLIC_HTTP_URL || "https://lekhaflow.rishiikesh.me";

	useEffect(() => {
		// Read elements so the hook runs on elements change without lint failing
		const _ = elements;

		// Clear previous timer on every element change
		if (thumbnailTimerRef.current) {
			clearTimeout(thumbnailTimerRef.current);
		}

		// Wait 2s after last change, then capture & upload
		thumbnailTimerRef.current = setTimeout(async () => {
			const stage = stageRef.current;
			if (!stage) return;
			const layer = stage.getLayers()[0];
			if (!layer || layer.children.length === 0 || !("children" in layer))
				return;

			try {
				const blob = await generateThumbnailBlob(
					stage as unknown as import("konva/lib/Stage").Stage,
					canvasBackgroundColor || "#ffffff",
				);
				if (!blob) return;

				// Convert Blob to Base64 for the transfer (since we don't have multer yet)
				const reader = new FileReader();
				const base64Promise = new Promise<string>((resolve) => {
					reader.onloadend = () => resolve(reader.result as string);
				});
				reader.readAsDataURL(blob);
				const base64Data = await base64Promise;

				// Upload to Backend (which handles Supabase Storage)
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (!session) return;

				const res = await fetch(
					`${HTTP_URL}/api/v1/canvas/${roomId}/thumbnail`,
					{
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${session.access_token}`,
						},
						body: JSON.stringify({ thumbnail_url: base64Data }),
					},
				);

				if (!res.ok) {
					console.error(
						"[Thumbnail] Upload HTTP Error:",
						res.status,
						await res.text(),
					);
				}
			} catch (err) {
				console.error("[Thumbnail] Update failed:", err);
			}
		}, 2000);

		return () => {
			if (thumbnailTimerRef.current) {
				clearTimeout(thumbnailTimerRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [roomId, HTTP_URL, elements, canvasBackgroundColor]);

	// Reconnect function
	const handleReconnect = useCallback(() => {
		// The hook will automatically reconnect when the component re-initializes
		// For now, we can just reload the page or re-establish the connection
		window.location.reload();
	}, []);

	// ─────────────────────────────────────────────────────────────────
	// EFFECTS
	// ─────────────────────────────────────────────────────────────────

	// Background Diagram Classifier (Story 5)
	useEffect(() => {
		// Debounce classification to avoid doing it purely on every keystroke/drag tick
		const timer = setTimeout(() => {
			const activeElements = elements.filter((el) => !el.isDeleted);
			const intent = classifyDiagram(activeElements);
			setDiagramIntent(intent);
		}, 1000);

		return () => clearTimeout(timer);
	}, [elements]);

	// Set container dimensions
	useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				setDimensions({
					width: containerRef.current.clientWidth,
					height: containerRef.current.clientHeight,
				});
			}
		};

		updateDimensions();
		window.addEventListener("resize", updateDimensions);
		return () => window.removeEventListener("resize", updateDimensions);
	}, []);

	// Pointer capture — ensures stroke events continue even when the
	// pointer temporarily leaves the canvas boundary during a drag.
	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		const content = stage.content; // Konva's inner <div> housing the canvases
		if (!content) return;

		const onPointerDown = (e: PointerEvent) => {
			content.setPointerCapture(e.pointerId);
		};
		const onPointerUp = (e: PointerEvent) => {
			if (content.hasPointerCapture(e.pointerId)) {
				content.releasePointerCapture(e.pointerId);
			}
		};

		content.addEventListener("pointerdown", onPointerDown);
		content.addEventListener("pointerup", onPointerUp);
		content.addEventListener("pointercancel", onPointerUp);

		return () => {
			content.removeEventListener("pointerdown", onPointerDown);
			content.removeEventListener("pointerup", onPointerUp);
			content.removeEventListener("pointercancel", onPointerUp);
		};
	}, []);

	// ── Wheel / pinch handler: zoom & pan ──
	// Strategy:
	//  • Pinch (ctrlKey+wheel, trackpad): Apply zoom IMMEDIATELY per event for
	//    smooth real-time pinch feel. No batching — batching causes deltas to
	//    cancel out or misfire on Linux trackpads.
	//  • Mouse Ctrl+scroll: large deltaY → rAF-batched single step to prevent
	//    jumping multiple zoom levels in one perceived click.
	//  • Two-finger scroll (no modifier): pan the canvas.
	useEffect(() => {
		// rAF batching only for coarse mouse scroll (large deltaY)
		let mouseZoomRafId: number | null = null;
		let mousePendingClientX = 0;
		let mousePendingClientY = 0;
		let mousePendingDirection = 0; // +1 = zoom in, -1 = zoom out

		const flushMouseZoom = () => {
			mouseZoomRafId = null;
			const container = containerRef.current;
			if (!container) return;
			const { zoom, scrollX, scrollY, setZoom, setScroll } =
				useCanvasStore.getState();
			const rect = container.getBoundingClientRect();
			const px = mousePendingClientX - rect.left;
			const py = mousePendingClientY - rect.top;
			const newZoom = Math.max(
				0.1,
				Math.min(5, zoom * (mousePendingDirection > 0 ? 1.1 : 1 / 1.1)),
			);
			setZoom(newZoom);
			setScroll(
				px - (px - scrollX) * (newZoom / zoom),
				py - (py - scrollY) * (newZoom / zoom),
			);
		};

		const applyPinchZoom = (
			deltaY: number,
			clientX: number,
			clientY: number,
		) => {
			const container = containerRef.current;
			if (!container) return;
			const { zoom, scrollX, scrollY, setZoom, setScroll } =
				useCanvasStore.getState();
			const rect = container.getBoundingClientRect();
			// Check cursor is over canvas (use a loose bounds check)
			if (
				clientX < rect.left ||
				clientX > rect.right ||
				clientY < rect.top ||
				clientY > rect.bottom
			)
				return;

			const px = clientX - rect.left;
			const py = clientY - rect.top;
			// Smooth proportional zoom – factor tuned for trackpad pinch sensitivity
			const factor = 1 - deltaY * 0.006;
			const newZoom = Math.max(0.1, Math.min(5, zoom * factor));
			setZoom(newZoom);
			setScroll(
				px - (px - scrollX) * (newZoom / zoom),
				py - (py - scrollY) * (newZoom / zoom),
			);
		};

		const onWheel = (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				// Always prevent browser zoom regardless of target
				e.preventDefault();

				// Distinguish trackpad pinch (small deltaY) from mouse Ctrl+scroll (large)
				if (Math.abs(e.deltaY) < 40) {
					// ── Trackpad pinch: apply immediately, no batching ──
					applyPinchZoom(e.deltaY, e.clientX, e.clientY);
				} else {
					// ── Mouse Ctrl+scroll: single fixed step per rAF tick ──
					const container = containerRef.current;
					if (!container?.contains(e.target as Node)) return;
					mousePendingClientX = e.clientX;
					mousePendingClientY = e.clientY;
					mousePendingDirection = e.deltaY > 0 ? -1 : 1;
					if (!mouseZoomRafId) {
						mouseZoomRafId = requestAnimationFrame(flushMouseZoom);
					}
				}
			} else {
				// ── Pan: two-finger scroll or plain mouse scroll ──
				const container = containerRef.current;
				if (!container?.contains(e.target as Node)) return;
				e.preventDefault();
				const { scrollX, scrollY, setScroll } = useCanvasStore.getState();
				let dx = e.deltaX;
				let dy = e.deltaY;
				if (e.shiftKey) {
					dx = dy;
					dy = 0;
				}
				setScroll(scrollX - dx, scrollY - dy);
			}
		};

		// Attach to window to catch all events including those originating
		// from Konva canvas elements that may not bubble to containerRef
		window.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			window.removeEventListener("wheel", onWheel);
			if (mouseZoomRafId) cancelAnimationFrame(mouseZoomRafId);
		};
	}, []);

	// Update selection awareness when selection changes
	useEffect(() => {
		updateSelection(Array.from(selectedElementIds));
		// Keep ref in sync with state to avoid stale closures
		selectedElementIdsRef.current = selectedElementIds;
	}, [selectedElementIds, updateSelection]);

	// Update selected elements when stroke color changes (Story 2.4)
	useEffect(() => {
		const currentSelection = selectedElementIdsRef.current;
		if (currentSelection.size === 0) return;
		Array.from(currentSelection).forEach((id) => {
			updateElement(id, { strokeColor: currentStrokeColor });
		});
	}, [currentStrokeColor, updateElement]);

	// Update selected elements when background color changes (Story 2.4)
	useEffect(() => {
		const currentSelection = selectedElementIdsRef.current;
		if (currentSelection.size === 0) return;
		Array.from(currentSelection).forEach((id) => {
			updateElement(id, { backgroundColor: currentBackgroundColor });
		});
	}, [currentBackgroundColor, updateElement]);

	// Update selected elements when stroke width changes (Story 2.4)
	useEffect(() => {
		const currentSelection = selectedElementIdsRef.current;
		if (currentSelection.size === 0) return;
		Array.from(currentSelection).forEach((id) => {
			updateElement(id, { strokeWidth: currentStrokeWidth });
		});
	}, [currentStrokeWidth, updateElement]);

	// Update selected elements when stroke style changes (Story 2.4)
	useEffect(() => {
		const currentSelection = selectedElementIdsRef.current;
		if (currentSelection.size === 0) return;
		Array.from(currentSelection).forEach((id) => {
			updateElement(id, { strokeStyle: currentStrokeStyle });
		});
	}, [currentStrokeStyle, updateElement]);

	// Update selected elements when opacity changes (Story 2.4)
	useEffect(() => {
		const currentSelection = selectedElementIdsRef.current;
		if (currentSelection.size === 0) return;
		Array.from(currentSelection).forEach((id) => {
			updateElement(id, { opacity: currentOpacity });
		});
	}, [currentOpacity, updateElement]);

	// Update selected elements when fill style changes (Phase 3)
	useEffect(() => {
		const currentSelection = selectedElementIdsRef.current;
		if (currentSelection.size === 0) return;
		Array.from(currentSelection).forEach((id) => {
			updateElement(id, { fillStyle: currentFillStyle });
		});
	}, [currentFillStyle, updateElement]);

	// Mirror a Map of elements by id for cheap O(1) lookups in effects and callbacks
	const elementsMapRef = useRef<Map<string, CanvasElement>>(new Map());
	// Keep a ref copy of the sorted elements array so hot-path callbacks
	// (handleMouseMove, handleMouseDown, etc.) can read the latest elements
	// without re-creating closures on every element change.
	const elementsRef = useRef<CanvasElement[]>(elements);
	useEffect(() => {
		elementsMapRef.current = new Map(elements.map((e) => [e.id, e]));
		elementsRef.current = elements;
	}, [elements]);

	// Sync selected freedraw element's appearance back to the panel tools so
	// PropertiesPanel reflects the element's actual values on selection.
	// Only runs in selection mode — skipped in freedraw to avoid overwriting
	// the user's per-tool settings that are restored on tool switch (Phase 5).
	// Guards prevent unnecessary store writes that would cascade through
	// the propagation effects above and cause infinite update loops.
	useEffect(() => {
		if (activeTool === "freedraw") return; // preserve per-tool settings
		if (selectedElementIds.size !== 1) return;
		const [id] = Array.from(selectedElementIds);
		if (!id) return;
		const el = elementsMapRef.current.get(id);
		if (!el || (el.type !== "freedraw" && (el.type as string) !== "freehand"))
			return;
		const { getState } = useCanvasStore;
		const s = getState();
		if (s.currentStrokeColor !== el.strokeColor) setStrokeColor(el.strokeColor);
		if (s.currentStrokeWidth !== el.strokeWidth) setStrokeWidth(el.strokeWidth);
		if (s.currentOpacity !== (el.opacity ?? 100)) setOpacity(el.opacity ?? 100);
		const bt = normalizeBrushType((el as FreedrawElement).brushType);
		if (s.currentBrushType !== bt) setBrushType(bt);
	}, [
		activeTool,
		selectedElementIds,
		setStrokeColor,
		setStrokeWidth,
		setOpacity,
		setBrushType,
	]);

	// Propagate brush type change to selected freedraw elements (mirrors the
	// strokeColor / strokeWidth / opacity effects above)
	useEffect(() => {
		const currentSelection = selectedElementIdsRef.current;
		if (currentSelection.size === 0) return;
		Array.from(currentSelection).forEach((id) => {
			const el = elementsMapRef.current.get(id);
			if (el?.type === "freedraw" || (el?.type as string) === "freehand") {
				updateElement(id, {
					brushType: currentBrushType,
				} as unknown as Partial<CanvasElement>);
			}
		});
	}, [currentBrushType, updateElement]);

	// Track keyboard modifiers for shape creation + space for temporary pan
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Shift") setShiftPressed(true);
			if (e.key === "Alt") setAltPressed(true);
			if (e.key === " ") {
				spacePressedRef.current = true;
				// Prevent page scroll when Space used for canvas pan
				if (document.activeElement === document.body) e.preventDefault();
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === "Shift") setShiftPressed(false);
			if (e.key === "Alt") setAltPressed(false);
			if (e.key === " ") spacePressedRef.current = false;
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyUp);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, []);

	/**
	 * Complete rich-text editing — create or update text element with runs.
	 */
	const handleCompleteText = useCallback(
		async (text: string) => {
			if (editingText && text.trim()) {
				// Use default dimensions since textarea ref is no longer available
				const width = editingText.initialWidth ?? 200;
				const height = editingText.initialHeight ?? 40;

				if (editingText.elementId) {
					// Update existing text element
					updateElement(editingText.elementId, {
						text,
						width: width / zoom,
						height: height / zoom,
					});
				} else {
					// Create new text element
					const newText = createText(editingText.x, editingText.y, text, {
						strokeColor: currentStrokeColor,
						opacity: currentOpacity,
						width: width / zoom,
						height: height / zoom,
						zIndex: getNextZIndex(),
					});
					addElement(newText);
				}

				// Process Mentions
				try {
					const mentionMatches = text.match(/@([a-zA-Z0-9_-]+)/g);
					if (mentionMatches && mentionMatches.length > 0) {
						const state = useCanvasStore.getState();
						const rId = state.roomId;
						const myName = state.myName;

						if (rId && myName) {
							const { data } = await supabase.auth.getSession();
							if (data?.session) {
								const collabMap = state.collaborators;
								const mentionedNames = mentionMatches.map((m) =>
									m.slice(1).toLowerCase(),
								);

								Array.from(collabMap.values()).forEach((collab) => {
									if (!collab.isCurrentUser && collab.name) {
										const collabNameCompact = collab.name
											.replace(/\s+/g, "")
											.toLowerCase();
										if (mentionedNames.includes(collabNameCompact)) {
											// Need HTTP URL from environment
											const HTTP_URL =
												process.env.NEXT_PUBLIC_HTTP_URL ||
												"http://localhost:8000";
											fetch(`${HTTP_URL}/api/v1/notifications`, {
												method: "POST",
												headers: {
													"Content-Type": "application/json",
													Authorization: `Bearer ${data.session.access_token}`,
												},
												body: JSON.stringify({
													userId: collab.id,
													type: "mention",
													content: `${myName} mentioned you: "${text.substring(0, 40)}..."`,
													canvasId: rId,
												}),
											}).catch(console.error);
										}
									}
								});
							}
						}
					}
				} catch (err) {
					console.error("Mentions processing failed:", err);
				}
			} else if (editingText?.elementId && !text.trim()) {
				// If editing existing element and text is empty, delete the element
				deleteElements([editingText.elementId]);
			}

			setEditingText(null);
			setTextEditing(false);
			updateEditingElement(null);
		},
		[
			editingText,
			zoom,
			currentStrokeColor,
			currentOpacity,
			addElement,
			updateElement,
			deleteElements,
			getNextZIndex,
			setTextEditing,
			updateEditingElement,
		],
	);

	const handleCompleteRichText = useCallback(
		(
			runs: TextRun[],
			plainText: string,
			measuredWidth: number,
			measuredHeight: number,
		) => {
			if (editingText) {
				if (plainText.trim()) {
					if (editingText.elementId) {
						// Update existing text element
						updateElement(editingText.elementId, {
							text: plainText,
							width: measuredWidth,
							height: measuredHeight,
							runs,
						} as Partial<import("@repo/common").CanvasElement>);
					} else {
						// Create new text element
						const newText = createText(
							editingText.x,
							editingText.y,
							plainText,
							{
								strokeColor: currentStrokeColor,
								opacity: currentOpacity,
								fontSize: activeTextStyle.fontSize,
								width: measuredWidth,
								height: measuredHeight,
								zIndex: getNextZIndex(),
								runs,
							},
						);
						addElement(newText);
					}
				} else if (editingText.elementId) {
					// Empty text on existing element — delete it
					deleteElements([editingText.elementId]);
				}
			}
			setEditingText(null);
			setTextEditing(false);
			updateEditingElement(null);
		},
		[
			editingText,
			currentStrokeColor,
			currentOpacity,
			activeTextStyle,
			addElement,
			updateElement,
			deleteElements,
			getNextZIndex,
			setTextEditing,
			updateEditingElement,
		],
	);

	/** Cancel text editing without creating an element. */
	const handleCancelText = useCallback(() => {
		setEditingText(null);
		setTextEditing(false);
		updateEditingElement(null);
	}, [setTextEditing, updateEditingElement]);

	// ─────────────────────────────────────────────────────────────────
	// COPY / PASTE / LAYER HANDLERS
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Copy selected elements to clipboard
	 */
	const handleCopy = useCallback(() => {
		if (selectedElementIds.size === 0) return;

		const selectedElements = elements.filter((el) =>
			selectedElementIds.has(el.id),
		);
		// Deep copy to avoid reference issues
		const deepCopied = JSON.parse(JSON.stringify(selectedElements));
		setClipboard(deepCopied);
	}, [selectedElementIds, elements]);

	/**
	 * Paste elements from clipboard
	 */
	const handlePaste = useCallback(() => {
		if (clipboard.length === 0) return;

		const newIds = new Set<string>();
		const offset = 20; // Offset for pasted elements
		let nextZ = getNextZIndex();

		for (const el of clipboard) {
			const newId = `${el.id}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
			// Deep copy the element to avoid reference issues with nested objects (points arrays, etc.)
			const newElement: CanvasElement = {
				...JSON.parse(JSON.stringify(el)),
				id: newId,
				x: el.x + offset,
				y: el.y + offset,
				zIndex: nextZ,
				version: 0,
				created: Date.now(),
				updated: Date.now(),
			};
			addElement(newElement);
			newIds.add(newId);
			nextZ++;
		}

		// Select pasted elements
		setSelectedElementIds(newIds);
	}, [clipboard, addElement, setSelectedElementIds, getNextZIndex]);

	/**
	 * Bring selected elements forward one level.
	 * Treats selection as a block — preserves relative order among selected,
	 * swaps the block with the first unselected element above it.
	 * Atomic: ONE Y.js transaction via batchUpdateElements.
	 */
	const handleBringForward = useCallback(() => {
		if (selectedElementIds.size === 0) return;
		const els = elementsRef.current;

		// Process each selected element
		Array.from(selectedElementIds).forEach((id) => {
			const currentIndex = els.findIndex((el) => el.id === id);
			if (currentIndex === -1 || currentIndex === els.length - 1) return; // Already on top or not found

			const currentElement = els[currentIndex];
			const elementAbove = els[currentIndex + 1];

			if (!currentElement || !elementAbove) return;

			// Swap zIndex values with element above
			const currentZ = currentElement.zIndex ?? currentIndex;
			const aboveZ = elementAbove.zIndex ?? currentIndex + 1;

			// Swap: current gets higher, above gets lower
			updateElement(id, { zIndex: aboveZ });
			updateElement(elementAbove.id, { zIndex: currentZ });
		});
	}, [selectedElementIds, updateElement]);

	/**
	 * Send selected elements backward one level.
	 * Treats selection as a block — preserves relative order.
	 */
	const handleSendBackward = useCallback(() => {
		if (selectedElementIds.size === 0) return;
		const els = elementsRef.current;

		// Process each selected element
		Array.from(selectedElementIds).forEach((id) => {
			const currentIndex = els.findIndex((el) => el.id === id);
			if (currentIndex <= 0) return; // Already at back or not found

			const currentElement = els[currentIndex];
			const elementBelow = els[currentIndex - 1];

			if (!currentElement || !elementBelow) return;

			// Swap zIndex values with element below
			const currentZ = currentElement.zIndex ?? currentIndex;
			const belowZ = elementBelow.zIndex ?? currentIndex - 1;

			// Swap: current gets lower, below gets higher
			updateElement(id, { zIndex: belowZ });
			updateElement(elementBelow.id, { zIndex: currentZ });
		});
	}, [selectedElementIds, updateElement]);

	/**
	 * Bring selected elements to front (highest z-index).
	 * Preserves relative order among selected. Atomic Y.js transaction.
	 */
	const handleBringToFront = useCallback(() => {
		if (selectedElementIds.size === 0) return;

		const maxZ = Math.max(
			...elementsRef.current.map((el) => el.zIndex || 0),
			0,
		);

		let nextZ = maxZ + 1;
		Array.from(selectedElementIds).forEach((id) => {
			updateElement(id, { zIndex: nextZ });
			nextZ++;
		});
	}, [selectedElementIds, updateElement]);

	/**
	 * Send selected elements to back (lowest z-index).
	 * Preserves relative order among selected. Atomic Y.js transaction.
	 */
	const handleSendToBack = useCallback(() => {
		if (selectedElementIds.size === 0) return;

		const minZ = Math.min(
			...elementsRef.current.map((el) => el.zIndex || 0),
			0,
		);

		// Set selected elements to zIndex below the minimum
		let nextZ = minZ - selectedElementIds.size;
		Array.from(selectedElementIds).forEach((id) => {
			updateElement(id, { zIndex: nextZ });
			nextZ++;
		});
	}, [selectedElementIds, updateElement]);

	/**
	 * Handle context menu (right-click)
	 */
	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			// Block context menu in read-only mode
			if (isReadOnly) return;

			let metadata: { createdBy?: string; lastModifiedBy?: string } | undefined;

			// Extract metadata if exactly one element is selected
			if (selectedElementIds.size === 1) {
				const selectedId = Array.from(selectedElementIds)[0];
				const element = elements.find((el) => el.id === selectedId);
				if (element && (element.createdBy || element.lastModifiedBy)) {
					metadata = {
						createdBy: element.createdBy,
						lastModifiedBy: element.lastModifiedBy,
					};
				}
			}

			setContextMenu({
				x: e.clientX,
				y: e.clientY,
				visible: true,
				metadata,
			});
		},
		[isReadOnly, selectedElementIds, elements],
	);

	const [isArchived, setIsArchived] = useState(false);

	// Fetch canvas metadata
	useEffect(() => {
		const fetchMetadata = async () => {
			if (!token) return;
			try {
				const res = await fetch(`${HTTP_URL}/api/v1/canvas/${roomId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (res.ok) {
					const json = await res.json();
					const canvas = json.data.canvas;
					setIsArchived(canvas.is_archived);
					if (canvas.is_archived) {
						setReadOnly(true);
					}
				}
			} catch (e) {
				console.error("Failed to fetch canvas metadata:", e);
			}
		};
		fetchMetadata();
	}, [roomId, token, HTTP_URL, setReadOnly]);

	/**
	 * Close context menu
	 */
	const closeContextMenu = useCallback(() => {
		setContextMenu((prev) => ({ ...prev, visible: false }));
	}, []);

	// ─────────────────────────────────────────────────────────────────
	// BEAUTIFY — Smart Sketch Beautification (Story 3)
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Whether the Beautify button should be visible.
	 * Shown when at least one selected element is a freedraw stroke.
	 */
	const showBeautifyButton = useMemo(() => {
		if (selectedElementIds.size === 0) return false;
		return elementsRef.current.some(
			(el) => selectedElementIds.has(el.id) && el.type === "freedraw",
		);
	}, [selectedElementIds]);

	/**
	 * Handle beautify: detect shapes from selected freedraw strokes and
	 * replace them with clean geometric elements.
	 */
	const handleBeautify = useCallback(() => {
		if (isReadOnly) return;
		const selectedEls = elementsRef.current.filter((el) =>
			selectedElementIds.has(el.id),
		);
		if (selectedEls.length === 0) return;

		const { removedIds, newElements } = beautifyElements(
			selectedEls,
			getNextZIndex,
		);

		if (removedIds.length === 0) return;

		// Remove old freedraw strokes
		deleteElements(removedIds);

		// Add new clean shapes
		const newIds = new Set<string>();
		for (const el of newElements) {
			addElement(el);
			newIds.add(el.id);
		}

		// Select the new elements
		setSelectedElementIds(newIds);
	}, [
		isReadOnly,
		selectedElementIds,
		getNextZIndex,
		deleteElements,
		addElement,
		setSelectedElementIds,
	]);

	/**
	 * Handle delete from context menu
	 */
	const handleDelete = useCallback(() => {
		if (selectedElementIds.size > 0) {
			const unlockedIds = Array.from(selectedElementIds).filter((id) => {
				const el = elementsRef.current.find((e) => e.id === id);
				return el && !el.locked;
			});
			if (unlockedIds.length > 0) {
				deleteElements(unlockedIds);
				clearSelection();
			}
		}
	}, [selectedElementIds, deleteElements, clearSelection]);

	/**
	 * Clear all elements from canvas
	 */
	const handleClearCanvas = useCallback(() => {
		const els = elementsRef.current;
		if (els.length === 0) return;

		// Confirm before clearing
		if (
			window.confirm(
				"Are you sure you want to clear the entire canvas? This cannot be undone.",
			)
		) {
			const allIds = els.map((el) => el.id);
			deleteElements(allIds);
			clearSelection();
		}
	}, [deleteElements, clearSelection]);

	// ─────────────────────────────────────────────────────────────────
	// KEYBOARD SHORTCUTS
	// ─────────────────────────────────────────────────────────────────

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if typing in input or rich text editor
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				(e.target instanceof HTMLElement &&
					e.target.hasAttribute("data-rich-text-editor"))
			) {
				return;
			}

			// Lock toggle: L key (works regardless of read-only state unless archived)
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				e.key.toLowerCase() === "l"
			) {
				if (!isArchived) {
					setReadOnly(!isReadOnly);
				}
				return;
			}

			// Tool shortcuts (only when no modifier keys are pressed)
			if (!e.ctrlKey && !e.metaKey && !e.altKey) {
				const toolShortcuts: Record<string, Tool> = {
					v: "selection",
					h: "hand",
					r: "rectangle",
					o: "ellipse",
					d: "diamond",
					l: "line",
					a: "arrow",
					p: "freedraw",
					k: "laser",
					t: "text",
					e: "eraser",
				};

				const tool = toolShortcuts[e.key.toLowerCase()];
				if (tool) {
					// In read-only mode, only allow hand tool
					if (isReadOnly && tool !== "hand") return;
					setActiveTool(tool);
					return;
				}

				// Beautify: B key — convert selected freedraw to clean shapes
				if (e.key.toLowerCase() === "b" && !isReadOnly) {
					handleBeautify();
					return;
				}

				// Enter key: Edit selected text element
				if (e.key === "Enter" && selectedElementIds.size === 1) {
					const selectedId = Array.from(selectedElementIds)[0];
					const selectedElement = elements.find((el) => el.id === selectedId);
					if (selectedElement?.type === "text") {
						e.preventDefault();
						const textElement = selectedElement as TextElement;
						setEditingText({
							x: textElement.x,
							y: textElement.y,
							initialText: textElement.text,
							initialWidth: textElement.width,
							initialHeight: textElement.height,
							elementId: textElement.id,
							initialRuns: textElement.runs,
						});
						if (textElement.runs?.length) {
							const r = textElement.runs[0];
							setActiveTextStyle({
								fontFamily: r?.fontFamily ?? "Arial",
								fontSize: r?.fontSize ?? textElement.fontSize,
								bold: r?.bold ?? false,
								italic: r?.italic ?? false,
								underline: r?.underline ?? false,
							});
						} else {
							setActiveTextStyle({ fontSize: textElement.fontSize });
						}
						setTextEditing(true, textElement.id);
						updateEditingElement(textElement.id);
						return;
					}
				}
			}

			// Delete selected elements (blocked in read-only mode)
			if (
				(e.key === "Delete" || e.key === "Backspace") &&
				selectedElementIds.size > 0
			) {
				if (isReadOnly) return;
				const unlockedIds = Array.from(selectedElementIds).filter((id) => {
					const el = elements.find((e) => e.id === id);
					return el && !el.locked;
				});
				if (unlockedIds.length > 0) {
					deleteElements(unlockedIds);
					clearSelection();
				}
				return;
			}

			// Undo: Ctrl/Cmd + Z
			if (
				(e.ctrlKey || e.metaKey) &&
				e.key.toLowerCase() === "z" &&
				!e.shiftKey
			) {
				e.preventDefault();
				undo();
				return;
			}

			// Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
			if (
				(e.ctrlKey || e.metaKey) &&
				(e.key.toLowerCase() === "y" ||
					(e.key.toLowerCase() === "z" && e.shiftKey))
			) {
				e.preventDefault();
				redo();
				return;
			}

			// Escape: Clear selection or cancel drawing
			if (e.key === "Escape") {
				clearSelection();
				setIsDrawing(false);
				setDrawingElement(null);
				return;
			}

			// Select all: Ctrl/Cmd + A
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
				e.preventDefault();
				setSelectedElementIds(new Set(elements.map((el) => el.id)));
				return;
			}

			// Copy: Ctrl/Cmd + C
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
				e.preventDefault();
				handleCopy();
				return;
			}

			// Paste: Ctrl/Cmd + V
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
				e.preventDefault();
				handlePaste();
				return;
			}

			// Duplicate: Ctrl/Cmd + D (not Shift — Shift+D = debug overlay)
			if (
				(e.ctrlKey || e.metaKey) &&
				!e.shiftKey &&
				e.key.toLowerCase() === "d"
			) {
				e.preventDefault();
				handleCopy();
				handlePaste();
				return;
			}

			// Bring to front: Ctrl/Cmd + ]
			if ((e.ctrlKey || e.metaKey) && e.key === "]") {
				e.preventDefault();
				handleBringToFront();
				return;
			}

			// Send to back: Ctrl/Cmd + [
			if ((e.ctrlKey || e.metaKey) && e.key === "[") {
				e.preventDefault();
				handleSendToBack();
				return;
			}

			// Export: Ctrl/Cmd + E
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
				e.preventDefault();
				setShowExportModal(true);
				return;
			}

			// Debug Overlay: Ctrl/Cmd + Shift + D
			if (
				(e.ctrlKey || e.metaKey) &&
				e.shiftKey &&
				e.key.toLowerCase() === "d"
			) {
				e.preventDefault();
				setShowDebugOverlay((prev) => !prev);
				return;
			}

			// Perf HUD: Ctrl/Cmd + Shift + P
			if (
				(e.ctrlKey || e.metaKey) &&
				e.shiftKey &&
				e.key.toLowerCase() === "p"
			) {
				e.preventDefault();
				setShowPerfHUD((prev) => !prev);
				return;
			}

			// Import Scene JSON: Ctrl/Cmd + Shift + I
			if (
				(e.ctrlKey || e.metaKey) &&
				e.shiftKey &&
				e.key.toLowerCase() === "i"
			) {
				e.preventDefault();
				handleImportScene();
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		setActiveTool,
		selectedElementIds,
		deleteElements,
		clearSelection,
		undo,
		redo,
		setIsDrawing,
		elements,
		setSelectedElementIds,
		handleCopy,
		handlePaste,
		handleBringToFront,
		handleSendToBack,
		isArchived,
		isReadOnly,
		setReadOnly,
		handleImportScene,
		setActiveTextStyle,
		setTextEditing,
		updateEditingElement,
		handleBeautify,
	]);

	// ─────────────────────────────────────────────────────────────────
	// EVENT HANDLERS
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Get canvas-relative point from mouse event
	 */
	const getCanvasPoint = useCallback(
		(_e: KonvaEventObject<MouseEvent>): Point => {
			const stage = stageRef.current;
			if (!stage) return { x: 0, y: 0 };

			const pos = stage.getPointerPosition();
			if (!pos) return { x: 0, y: 0 };

			// Account for zoom and scroll
			return {
				x: (pos.x - scrollX) / zoom,
				y: (pos.y - scrollY) / zoom,
			};
		},
		[scrollX, scrollY, zoom],
	);

	/**
	 * Handle mouse down - Start drawing or selection
	 *
	 * FLOW:
	 * 1. Get click position
	 * 2. Based on active tool:
	 *    - Selection: Check if clicking element
	 *    - Drawing: Start new element
	 *    - Hand: Start panning
	 */
	// ─────────────────────────────────────────────────────────────────
	// WHEEL HANDLER - Zoom (Ctrl/Meta + scroll) & Pan (plain scroll)
	// ─────────────────────────────────────────────────────────────────
	const handleWheel = useCallback(
		(e: KonvaEventObject<WheelEvent>) => {
			e.evt.preventDefault();

			const stage = stageRef.current;
			if (!stage) return;

			const isZoom = e.evt.ctrlKey || e.evt.metaKey;

			if (isZoom) {
				// ── Pinch-to-zoom / Ctrl+scroll ──
				const scaleBy = 1.05;
				const oldZoom = zoom;

				// Determine new zoom direction
				const direction = e.evt.deltaY > 0 ? -1 : 1;
				const newZoom = Math.max(
					0.1,
					Math.min(5, direction > 0 ? oldZoom * scaleBy : oldZoom / scaleBy),
				);

				// Get pointer position relative to the stage container
				const pointer = stage.getPointerPosition();
				if (!pointer) return;

				// Compute new scroll so the point under the cursor stays fixed
				const mousePointTo = {
					x: (pointer.x - scrollX) / oldZoom,
					y: (pointer.y - scrollY) / oldZoom,
				};

				const newScrollX = pointer.x - mousePointTo.x * newZoom;
				const newScrollY = pointer.y - mousePointTo.y * newZoom;

				setZoom(newZoom);
				setScroll(newScrollX, newScrollY);
			} else {
				// ── Regular scroll → pan ──
				const dx = e.evt.deltaX;
				const dy = e.evt.deltaY;
				setScroll(scrollX - dx, scrollY - dy);
			}
		},
		[zoom, scrollX, scrollY, setZoom, setScroll],
	);

	const handleMouseDown = useCallback(
		(e: KonvaEventObject<MouseEvent>) => {
			const point = getCanvasPoint(e);
			setInteractionStartPoint(point);

			// Middle-click (button=1) or Space+click → start canvas pan immediately,
			// regardless of active tool. Covers trackpad press-drag and Figma-style Space+drag.
			if (e.evt.button === 1 || spacePressedRef.current) {
				setIsDragging(true);
				return;
			}

			// READ-ONLY MODE: Only allow hand tool panning
			if (isReadOnly && activeTool !== "hand") {
				return;
			}

			// SHIFT+CLICK while drawing a line/arrow: Add a new point (create multi-segment line)
			if (
				isDrawing &&
				shiftPressed &&
				drawingElement &&
				(drawingElement.type === "line" || drawingElement.type === "arrow")
			) {
				const lineElement = drawingElement as LineElement | ArrowElement;
				const dx = point.x - drawingElement.x;
				const dy = point.y - drawingElement.y;

				// Add the current point as a fixed intermediate point, then add new end point
				const existingPoints = lineElement.points;
				const newPoints = [...existingPoints, { x: dx, y: dy }];

				setDrawingElement({
					...lineElement,
					points: newPoints,
				} as CanvasElement);

				// Update interaction start point to continue from here
				setInteractionStartPoint(point);
				return; // Don't process the switch - we just added a point
			}

			switch (activeTool) {
				case "selection": {
					// --- Resolve Konva target (walk up parent for rough Groups) ---
					let konvaTargetId = e.target.id?.() || "";
					if (!konvaTargetId && e.target.parent) {
						konvaTargetId = e.target.parent.id?.() || "";
					}
					const clickedOnStage = e.target === e.target.getStage();
					const isKonvaElement =
						konvaTargetId && elements.some((el) => el.id === konvaTargetId);

					// If the click landed on a non-stage, non-element Konva node
					// (resize handle, rotation control, etc.) let its own handler run.
					if (!clickedOnStage && !isKonvaElement) {
						break;
					}

					// --- Math-based hit testing (single source of truth) ---
					const allHits = getAllElementsAtPoint(point, elements);

					// Alt+Click: cycle through overlapping elements
					if (
						altPressed &&
						allHits.length > 1 &&
						selectedElementIds.size === 1
					) {
						const currentId = Array.from(selectedElementIds)[0];
						const currentIdx = allHits.findIndex((el) => el.id === currentId);
						if (currentIdx !== -1) {
							const nextIdx = (currentIdx + 1) % allHits.length;
							const target = allHits[nextIdx];
							if (target) {
								setSelectedElementIds(new Set([target.id]));
							}
							break;
						}
					}

					// Click on element
					if (allHits.length > 0) {
						const topHit = allHits[0];
						if (topHit) {
							if (shiftPressed || e.evt.ctrlKey || e.evt.metaKey) {
								// Shift/Ctrl/Cmd+click: toggle element in/out of selection
								if (selectedElementIds.has(topHit.id)) {
									removeFromSelection([topHit.id]);
								} else {
									addToSelection([topHit.id]);
								}
							} else if (!selectedElementIds.has(topHit.id)) {
								// Normal click on unselected element: replace selection
								setSelectedElementIds(new Set([topHit.id]));
							}

							setIsDragging(true);

							// Initiate group move when multi-selected and clicked
							// on an already-selected element (no shift/ctrl toggle)
							if (
								!shiftPressed &&
								!e.evt.ctrlKey &&
								!e.evt.metaKey &&
								selectedElementIds.size > 1 &&
								selectedElementIds.has(topHit.id)
							) {
								groupMoveStartRef.current = point;
								groupMoveInitialRef.current = elements
									.filter((el) => selectedElementIds.has(el.id) && !el.locked)
									.map((el) => ({ id: el.id, x: el.x, y: el.y }));
							}
						}
						break;
					}

					// Multi-select: click inside group bounds but not on any element
					// → start group move of all selected elements
					if (selectedElementIds.size > 1) {
						const selEls = elements.filter(
							(el) => selectedElementIds.has(el.id) && !el.locked,
						);
						const gb = getCombinedBounds(selEls);
						if (
							gb &&
							point.x >= gb.x - 4 &&
							point.x <= gb.x + gb.width + 4 &&
							point.y >= gb.y - 4 &&
							point.y <= gb.y + gb.height + 4
						) {
							setIsDragging(true);
							groupMoveStartRef.current = point;
							groupMoveInitialRef.current = selEls.map((el) => ({
								id: el.id,
								x: el.x,
								y: el.y,
							}));
							break;
						}
					}

					// Clicked on empty canvas — start marquee drag
					marqueeAnchorRef.current = point;
					marqueeAdditiveRef.current =
						shiftPressed || e.evt.ctrlKey || e.evt.metaKey;
					if (!shiftPressed && !e.evt.ctrlKey && !e.evt.metaKey) {
						clearSelection();
					}
					break;
				}

				case "hand":
					setIsDragging(true);
					break;

				case "rectangle":
				case "ellipse":
				case "diamond": {
					setIsDrawing(true);
					const modifiers: ShapeModifiers = {
						shift: shiftPressed,
						alt: altPressed,
					};
					const newShape = createShape(
						activeTool as "rectangle" | "ellipse" | "diamond",
						point.x,
						point.y,
						0,
						0,
						modifiers,
						{
							strokeColor: currentStrokeColor,
							backgroundColor: currentBackgroundColor,
							strokeWidth: currentStrokeWidth,
							strokeStyle: currentStrokeStyle,
							fillStyle: currentFillStyle,
							opacity: currentOpacity,
							roughStyle: currentRoughEnabled
								? { enabled: true, sloppiness: currentSloppiness }
								: undefined,
						},
					);
					setDrawingElement(newShape);
					break;
				}

				case "line": {
					setIsDrawing(true);
					const newLine = createLine(point.x, point.y, [{ x: 0, y: 0 }], {
						strokeColor: currentStrokeColor,
						strokeWidth: currentStrokeWidth,
						strokeStyle: currentStrokeStyle,
						opacity: currentOpacity,
						roughStyle: currentRoughEnabled
							? { enabled: true, sloppiness: currentSloppiness }
							: undefined,
					});
					setDrawingElement(newLine);
					break;
				}

				case "arrow": {
					setIsDrawing(true);
					const newArrow = createArrow(point.x, point.y, [{ x: 0, y: 0 }], {
						strokeColor: currentStrokeColor,
						strokeWidth: currentStrokeWidth,
						strokeStyle: currentStrokeStyle,
						opacity: currentOpacity,
						roughStyle: currentRoughEnabled
							? { enabled: true, sloppiness: currentSloppiness }
							: undefined,
					});
					setDrawingElement(newArrow);
					break;
				}

				case "freedraw": {
					setIsDrawing(true);
					freedrawPointsRef.current = [[0, 0]];
					const newFreedraw = createFreedraw(point.x, point.y, [[0, 0]], {
						strokeColor: currentStrokeColor,
						strokeWidth: currentStrokeWidth,
						opacity: currentOpacity,
						brushType: currentBrushType,
					});
					setDrawingElement(newFreedraw);

					// Spray: create offscreen raster engine for real-time stamping
					if (currentBrushType === "spray") {
						const w = (dimensions.width || window.innerWidth) * 2;
						const h = (dimensions.height || window.innerHeight) * 2;
						sprayRasterRef.current = new SprayRasterEngine({
							width: w,
							height: h,
							size: currentStrokeWidth * 2,
							color: currentStrokeColor,
							seedId: newFreedraw.seedId ?? "spray",
						});
						sprayRasterRef.current.addPoint(0, 0);
						sprayGhostThrottleRef.current = 0;
						setActiveSprayEngine(sprayRasterRef.current);
					}
					break;
				}

				case "laser": {
					// Laser tool - temporary pointer (doesn't persist)
					setIsDrawing(true);
					laserPointsRef.current = [[0, 0]];
					break;
				}

				case "text": {
					// Open text editor overlay instead of prompt
					setEditingText({
						x: point.x,
						y: point.y,
					});
					setTextEditing(true);
					break;
				}

				case "eraser": {
					// Start erasing - enable continuous drag deletion
					isErasingRef.current = true;
					erasedElementsRef.current.clear();

					const elementToDelete = getElementAtPoint(point, elements);
					if (elementToDelete && !elementToDelete.locked) {
						deleteElements([elementToDelete.id]);
						erasedElementsRef.current.add(elementToDelete.id);
					}
					break;
				}
			}
		},
		[
			getCanvasPoint,
			activeTool,
			elements,
			selectedElementIds,
			setSelectedElementIds,
			addToSelection,
			removeFromSelection,
			clearSelection,
			setIsDrawing,
			setIsDragging,
			setInteractionStartPoint,
			currentStrokeColor,
			currentBackgroundColor,
			currentStrokeWidth,
			currentStrokeStyle,
			currentOpacity,
			currentFillStyle,
			currentBrushType,
			currentRoughEnabled,
			currentSloppiness,
			shiftPressed,
			altPressed,
			deleteElements,
			isDrawing,
			drawingElement,
			isReadOnly,
			dimensions.width,
			dimensions.height,
			setTextEditing,
		],
	);

	/**
	 * Handle mouse move - Update drawing or pan
	 *
	 * FLOW:
	 * 1. Update cursor position for awareness
	 * 2. If drawing: Update element dimensions
	 * 3. If panning: Update scroll position
	 */
	const handleMouseMove = useCallback(
		(e: KonvaEventObject<MouseEvent>) => {
			const point = getCanvasPoint(e);

			// Update cursor position for collaboration (throttled to ~30fps)
			const now = performance.now();
			const stage = stageRef.current;
			const pos = stage?.getPointerPosition();
			if (pos && now - lastCursorUpdateRef.current > 33) {
				lastCursorUpdateRef.current = now;
				updateCursor({ x: pos.x, y: pos.y });
			}

			// Attribution tooltip – detect hovered element (throttled to ~10fps, only when idle)
			if (
				activeTool === "selection" &&
				!isDrawing &&
				!isDragging &&
				!resizingElement &&
				!rotatingElement
			) {
				if (now - lastTooltipCheckRef.current > 100) {
					lastTooltipCheckRef.current = now;
					const el = getElementAtPoint(point, elements);
					setHoveredElement(el ?? null);
					if (pos) {
						setTooltipPos({ x: e.evt.clientX, y: e.evt.clientY });
					}
				}
			} else {
				setHoveredElement(null);
			}

			// Handle marquee drag-select
			if (marqueeAnchorRef.current && activeTool === "selection") {
				const anchor = marqueeAnchorRef.current;
				setMarqueeRect({
					x: anchor.x,
					y: anchor.y,
					width: point.x - anchor.x,
					height: point.y - anchor.y,
				});
				return;
			}

			// Handle group move (multi-select drag) — rAF batched
			if (groupMoveStartRef.current && activeTool === "selection") {
				const dx = point.x - groupMoveStartRef.current.x;
				const dy = point.y - groupMoveStartRef.current.y;
				groupMoveDeltaRef.current = { dx, dy };
				if (!groupMoveRafRef.current) {
					groupMoveRafRef.current = requestAnimationFrame(() => {
						groupMoveRafRef.current = 0;
						const { dx: fdx, dy: fdy } = groupMoveDeltaRef.current;
						const batch = groupMoveInitialRef.current.map(({ id, x, y }) => ({
							id,
							updates: { x: x + fdx, y: y + fdy } as Partial<CanvasElement>,
						}));
						storeBatchUpdate(batch);
					});
				}
				return;
			}

			// Handle hand tool panning OR space+drag / middle-click panning
			if (
				isDragging &&
				(activeTool === "hand" || spacePressedRef.current) &&
				interactionStartPoint
			) {
				const dx = point.x - interactionStartPoint.x;
				const dy = point.y - interactionStartPoint.y;
				setScroll(scrollX + dx * zoom, scrollY + dy * zoom);
				return;
			}

			// Handle eraser continuous drag deletion
			if (isErasingRef.current && activeTool === "eraser") {
				const elementToDelete = getElementAtPoint(point, elements);
				if (
					elementToDelete &&
					!elementToDelete.locked &&
					!erasedElementsRef.current.has(elementToDelete.id)
				) {
					deleteElements([elementToDelete.id]);
					erasedElementsRef.current.add(elementToDelete.id);
				}
				return;
			}

			// Handle laser pointer (temporary drawing)
			if (activeTool === "laser" && isDrawing && interactionStartPoint) {
				laserPointsRef.current.push([point.x, point.y]);
				updateLaser(laserPointsRef.current);

				// Generate SVG path for laser
				const pathData = outlineToSvgPath(laserPointsRef.current, {
					size: currentStrokeWidth * 2,
					thinning: 0.5,
					smoothing: 0.5,
					streamline: 0.5,
					simulatePressure: true,
				});
				setLaserPath(pathData);
				return;
			}

			// Handle drawing
			if (!isDrawing || !drawingElement || !interactionStartPoint) return;

			const dx = point.x - interactionStartPoint.x;
			const dy = point.y - interactionStartPoint.y;

			switch (drawingElement.type) {
				case "rectangle":
				case "ellipse":
				case "diamond": {
					// Apply shape modifiers (Shift for aspect ratio, Alt for center scaling)
					const modifiers: ShapeModifiers = {
						shift: shiftPressed,
						alt: altPressed,
					};
					let width = dx;
					let height = dy;
					let x = drawingElement.x;
					let y = drawingElement.y;

					// Apply aspect ratio lock (Shift key)
					if (modifiers.shift) {
						const size = Math.max(Math.abs(width), Math.abs(height));
						width = width >= 0 ? size : -size;
						height = height >= 0 ? size : -size;
					}

					// Apply center scaling (Alt key)
					if (modifiers.alt) {
						x = interactionStartPoint.x - width / 2;
						y = interactionStartPoint.y - height / 2;
						width = width * 2;
						height = height * 2;
					}

					setDrawingElement({
						...drawingElement,
						x,
						y,
						width,
						height,
					} as CanvasElement);
					// Broadcast ghost preview to remote users
					broadcastDrawingPreview({
						...drawingElement,
						x,
						y,
						width,
						height,
					});
					break;
				}

				case "line":
				case "arrow": {
					const lineElement = drawingElement as LineElement | ArrowElement;
					// Keep all existing points except the last one, then add updated end point
					const existingPoints = lineElement.points;
					const fixedPoints =
						existingPoints.length > 1
							? existingPoints.slice(0, -1) // Remove last point (the one we're dragging)
							: existingPoints;
					const newPoints = [...fixedPoints, { x: dx, y: dy }];

					setDrawingElement({
						...lineElement,
						points: newPoints,
						width: Math.abs(dx),
						height: Math.abs(dy),
					} as CanvasElement);
					// Broadcast ghost preview to remote users
					broadcastDrawingPreview({
						...drawingElement,
						points: newPoints,
						width: Math.abs(dx),
						height: Math.abs(dy),
					});
					break;
				}

				case "freedraw": {
					// Add point to freedraw path - skip if too close to last point (perf)
					const lastPt =
						freedrawPointsRef.current[freedrawPointsRef.current.length - 1];
					const ptDist = lastPt
						? Math.hypot(dx - lastPt[0], dy - lastPt[1])
						: Infinity;
					if (ptDist < 2) break; // Skip sub-pixel movements for performance
					// Add point to ref immediately (zero allocation on hot path)
					freedrawPointsRef.current.push([dx, dy]);

					// ── Spray uses offscreen raster engine ──
					if (sprayRasterRef.current) {
						// Stamp dots to offscreen canvas (O(newDots), very cheap)
						sprayRasterRef.current.addPoint(dx, dy);

						// rAF-batched: ask Konva to re-blit the Image node.
						// NO React state update needed — just a Konva layer redraw.
						if (!freedrawDirtyRef.current) {
							freedrawDirtyRef.current = true;
							freedrawRafRef.current = requestAnimationFrame(() => {
								freedrawDirtyRef.current = false;
								sprayImageRef.current?.getLayer()?.batchDraw();

								// Throttled ghost broadcast for spray (~5 Hz)
								const now = performance.now();
								if (now - sprayGhostThrottleRef.current > 200) {
									sprayGhostThrottleRef.current = now;
									broadcastDrawingPreview({
										...drawingElement,
										points: freedrawPointsRef.current,
									});
								}
							});
						}
						break;
					}

					// ── Non-spray (pencil / watercolour) ──
					// rAF-batched render: schedule a single state update per frame
					// instead of re-rendering the entire scene on every pointermove.
					if (!freedrawDirtyRef.current) {
						freedrawDirtyRef.current = true;
						freedrawRafRef.current = requestAnimationFrame(() => {
							freedrawDirtyRef.current = false;
							// drawingElement may be stale in the closure so read from ref-stable data
							setDrawingElement((prev) => {
								if (!prev || prev.type !== "freedraw") return prev;
								return {
									...prev,
									points: freedrawPointsRef.current,
								} as FreedrawElement;
							});
							// Broadcast ghost preview to remote users
							broadcastDrawingPreview({
								...drawingElement,
								points: freedrawPointsRef.current,
							});
						});
					}
					break;
				}
			}
		},
		[
			getCanvasPoint,
			updateCursor,
			isDragging,
			activeTool,
			interactionStartPoint,
			scrollX,
			scrollY,
			zoom,
			setScroll,
			isDrawing,
			drawingElement,
			shiftPressed,
			altPressed,
			elements,
			deleteElements,
			currentStrokeWidth,
			resizingElement,
			rotatingElement,
			broadcastDrawingPreview,
			storeBatchUpdate,
			updateLaser,
		],
	);

	/**
	 * Handle mouse up - Finish drawing
	 *
	 * FLOW:
	 * 1. If drawing: Finalize element and add to Yjs
	 * 2. Reset drawing state
	 */
	const handleMouseUp = useCallback(() => {
		// Clear ghost preview immediately — before any commit logic
		clearGhost();

		// Finalise marquee drag-select
		if (marqueeAnchorRef.current) {
			marqueeAnchorRef.current = null;
			if (marqueeRect) {
				const norm = normalizeRect(marqueeRect);
				// Only apply if user actually dragged (not just clicked)
				if (norm.width > 3 || norm.height > 3) {
					const hits = getElementsInSelection(norm, elements);
					const hitIds = hits.map((el) => el.id);
					if (marqueeAdditiveRef.current) {
						addToSelection(hitIds);
					} else {
						setSelectedElementIds(new Set(hitIds));
					}
				}
			}
			setMarqueeRect(null);
			marqueeAdditiveRef.current = false;
			return;
		}

		// Finalise group move — commit to Y.js in one transaction
		if (groupMoveStartRef.current) {
			// Cancel any pending rAF
			if (groupMoveRafRef.current) {
				cancelAnimationFrame(groupMoveRafRef.current);
				groupMoveRafRef.current = 0;
			}
			// Apply final delta to initial cached positions
			const { dx, dy } = groupMoveDeltaRef.current;
			if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
				const batch = groupMoveInitialRef.current.map(({ id, x, y }) => ({
					id,
					updates: { x: x + dx, y: y + dy },
				}));
				// Commit to Y.js in a single transaction
				batchUpdateElements(batch);
			}
			// Reset group move state
			groupMoveStartRef.current = null;
			groupMoveInitialRef.current = [];
			groupMoveDeltaRef.current = { dx: 0, dy: 0 };
			setIsDragging(false);
			return;
		}

		// Cancel any pending freedraw rAF so the final commit uses the
		// complete point buffer (Phase 5 — flush rAF).
		if (freedrawRafRef.current) {
			cancelAnimationFrame(freedrawRafRef.current);
			freedrawRafRef.current = 0;
			freedrawDirtyRef.current = false;
		}

		// Finalize drawing
		if (isDrawing && drawingElement) {
			// Freedraw: commit raw points with no simplification so the
			// stroke faithfully follows the cursor.
			if (drawingElement.type === "freedraw") {
				const freedrawElement = drawingElement as FreedrawElement;
				if (freedrawPointsRef.current.length > 2) {
					freedrawElement.points = freedrawPointsRef.current;
					// Assign proper zIndex so new elements appear on top
					freedrawElement.zIndex = getNextZIndex();
					addElement(freedrawElement);
					setSelectedElementIds(new Set([freedrawElement.id]));
				}
			} else {
				// Other element types: only add if element has size
				if (
					Math.abs(drawingElement.width) > 5 ||
					Math.abs(drawingElement.height) > 5
				) {
					// Normalize negative dimensions
					const finalElement = { ...drawingElement };

					if (finalElement.width < 0) {
						finalElement.x += finalElement.width;
						finalElement.width = Math.abs(finalElement.width);
					}
					if (finalElement.height < 0) {
						finalElement.y += finalElement.height;
						finalElement.height = Math.abs(finalElement.height);
					}

					// Assign proper zIndex so new elements appear on top
					finalElement.zIndex = getNextZIndex();

					// Add to Yjs - this syncs to all clients!
					addElement(finalElement);

					// Select the new element
					setSelectedElementIds(new Set([finalElement.id]));
				}
			}
		}

		// Clear laser path (temporary tool)
		if (activeTool === "laser") {
			setLaserPath(null);
			laserPointsRef.current = [];
			updateLaser(undefined);
		}

		// Reset state
		setIsDrawing(false);
		setIsDragging(false);
		setDrawingElement(null);
		setInteractionStartPoint(null);
		freedrawPointsRef.current = [];

		// Dispose spray raster engine (if active)
		if (sprayRasterRef.current) {
			setActiveSprayEngine(null);
			sprayRasterRef.current.dispose();
			sprayRasterRef.current = null;
		}

		// Clear eraser state
		isErasingRef.current = false;
		erasedElementsRef.current.clear();
	}, [
		isDrawing,
		drawingElement,
		addElement,
		setSelectedElementIds,
		addToSelection,
		setIsDrawing,
		setIsDragging,
		setInteractionStartPoint,
		activeTool,
		getNextZIndex,
		clearGhost,
		marqueeRect,
		elements,
		batchUpdateElements,
		updateLaser,
	]);

	/**
	 * Handle double-click - Edit text elements
	 */
	const handleDoubleClick = useCallback(
		(e: KonvaEventObject<MouseEvent>) => {
			const point = getCanvasPoint(e);
			const clickedElement = getElementAtPoint(point, elements);

			if (clickedElement?.type === "text") {
				const textElement = clickedElement as TextElement;
				setEditingText({
					x: textElement.x,
					y: textElement.y,
					initialText: textElement.text,
					initialWidth: textElement.width,
					initialHeight: textElement.height,
					elementId: textElement.id,
					initialRuns: textElement.runs,
				});
				// Populate toolbar with element's current formatting
				if (textElement.runs?.length) {
					const r = textElement.runs[0];
					setActiveTextStyle({
						fontFamily: r?.fontFamily ?? "Arial",
						fontSize: r?.fontSize ?? textElement.fontSize,
						bold: r?.bold ?? false,
						italic: r?.italic ?? false,
						underline: r?.underline ?? false,
					});
				} else {
					setActiveTextStyle({ fontSize: textElement.fontSize });
				}
				setTextEditing(true, textElement.id);
				updateEditingElement(textElement.id);
			}
		},
		[
			getCanvasPoint,
			elements,
			setTextEditing,
			setActiveTextStyle,
			updateEditingElement,
		],
	);

	/**
	 * Handle element drag end - Update position in Yjs
	 */
	const handleElementDragEnd = useCallback(
		(id: string, x: number, y: number) => {
			updateElement(id, { x, y });
		},
		[updateElement],
	);

	/**
	 * Handle joint point drag - Update specific point in line/arrow
	 */
	const handleJointDrag = useCallback(
		(id: string, pointIndex: number, x: number, y: number) => {
			const element = elements.find((el) => el.id === id);
			if (!element) return;

			if (element.type === "line" || element.type === "arrow") {
				const typedElement = element as LineElement | ArrowElement;
				const newPoints = [...typedElement.points];
				newPoints[pointIndex] = { x, y };
				updateElement(id, { points: newPoints });
			}
		},
		[elements, updateElement],
	);

	/**
	 * Handle resize start - Store initial element state
	 */
	const handleResizeStart = useCallback(
		(
			elementId: string,
			handle: HandlePosition,
			_e: KonvaEventObject<MouseEvent>,
		) => {
			const element = elements.find((el) => el.id === elementId);
			if (!element) return;

			const stage = stageRef.current;
			const pos = stage?.getPointerPosition();
			if (!pos) return;

			setResizingElement({
				id: elementId,
				originalX: element.x,
				originalY: element.y,
				originalWidth: element.width,
				originalHeight: element.height,
				handle,
				startMouseX: (pos.x - scrollX) / zoom,
				startMouseY: (pos.y - scrollY) / zoom,
			});
		},
		[elements, scrollX, scrollY, zoom],
	);

	/**
	 * Handle resize move - Calculate new dimensions based on handle drag
	 */
	const handleResizeMove = useCallback(
		(
			elementId: string,
			handle: HandlePosition,
			_e: KonvaEventObject<MouseEvent>,
		) => {
			if (!resizingElement || resizingElement.id !== elementId) return;

			const stage = stageRef.current;
			const pos = stage?.getPointerPosition();
			if (!pos) return;

			const mouseX = (pos.x - scrollX) / zoom;
			const mouseY = (pos.y - scrollY) / zoom;

			const deltaX = mouseX - resizingElement.startMouseX;
			const deltaY = mouseY - resizingElement.startMouseY;

			let newX = resizingElement.originalX;
			let newY = resizingElement.originalY;
			let newWidth = resizingElement.originalWidth;
			let newHeight = resizingElement.originalHeight;

			// Calculate new dimensions based on handle position
			switch (handle) {
				case "top-left":
					newX = resizingElement.originalX + deltaX;
					newY = resizingElement.originalY + deltaY;
					newWidth = resizingElement.originalWidth - deltaX;
					newHeight = resizingElement.originalHeight - deltaY;
					break;
				case "top-right":
					newY = resizingElement.originalY + deltaY;
					newWidth = resizingElement.originalWidth + deltaX;
					newHeight = resizingElement.originalHeight - deltaY;
					break;
				case "bottom-left":
					newX = resizingElement.originalX + deltaX;
					newWidth = resizingElement.originalWidth - deltaX;
					newHeight = resizingElement.originalHeight + deltaY;
					break;
				case "bottom-right":
					newWidth = resizingElement.originalWidth + deltaX;
					newHeight = resizingElement.originalHeight + deltaY;
					break;
				case "top-center":
					newY = resizingElement.originalY + deltaY;
					newHeight = resizingElement.originalHeight - deltaY;
					break;
				case "bottom-center":
					newHeight = resizingElement.originalHeight + deltaY;
					break;
				case "left-center":
					newX = resizingElement.originalX + deltaX;
					newWidth = resizingElement.originalWidth - deltaX;
					break;
				case "right-center":
					newWidth = resizingElement.originalWidth + deltaX;
					break;
			}

			// Apply Shift key for aspect ratio lock
			if (shiftPressed) {
				const aspectRatio =
					resizingElement.originalWidth / resizingElement.originalHeight;

				// For corner handles, lock aspect ratio
				if (
					handle === "top-left" ||
					handle === "top-right" ||
					handle === "bottom-left" ||
					handle === "bottom-right"
				) {
					const newAspect = Math.abs(newWidth / newHeight);
					if (newAspect > aspectRatio) {
						// Width is proportionally larger, adjust it
						newWidth = Math.sign(newWidth) * Math.abs(newHeight) * aspectRatio;
					} else {
						// Height is proportionally larger, adjust it
						newHeight =
							(Math.sign(newHeight) * Math.abs(newWidth)) / aspectRatio;
					}

					// Recalculate position for handles that change origin
					if (handle === "top-left") {
						newX =
							resizingElement.originalX +
							resizingElement.originalWidth -
							newWidth;
						newY =
							resizingElement.originalY +
							resizingElement.originalHeight -
							newHeight;
					} else if (handle === "top-right") {
						newY =
							resizingElement.originalY +
							resizingElement.originalHeight -
							newHeight;
					} else if (handle === "bottom-left") {
						newX =
							resizingElement.originalX +
							resizingElement.originalWidth -
							newWidth;
					}
				}
			}

			// Ensure minimum size
			const MIN_SIZE = 10;
			if (newWidth < MIN_SIZE) {
				if (handle.includes("left")) {
					newX =
						resizingElement.originalX +
						resizingElement.originalWidth -
						MIN_SIZE;
				}
				newWidth = MIN_SIZE;
			}
			if (newHeight < MIN_SIZE) {
				if (handle.includes("top")) {
					newY =
						resizingElement.originalY +
						resizingElement.originalHeight -
						MIN_SIZE;
				}
				newHeight = MIN_SIZE;
			}

			// Update element in real-time
			updateElement(elementId, {
				x: newX,
				y: newY,
				width: newWidth,
				height: newHeight,
			});
		},
		[resizingElement, scrollX, scrollY, zoom, shiftPressed, updateElement],
	);

	/**
	 * Handle resize end - Finalize the resize operation
	 */
	const handleResizeEnd = useCallback((_elementId: string) => {
		setResizingElement(null);
	}, []);

	/**
	 * Handle 90° rotation - Rotate element clockwise by 90 degrees
	 */
	const handleRotate90 = useCallback(
		(elementId: string) => {
			const element = elements.find((el) => el.id === elementId);
			if (!element) return;

			// Rotate by 90° clockwise
			const newAngle = (element.angle + 90) % 360;
			updateElement(elementId, { angle: newAngle });
		},
		[elements, updateElement],
	);

	/**
	 * Handle rotation start - Begin arbitrary rotation
	 */
	const handleRotationStart = useCallback(
		(elementId: string, _e: KonvaEventObject<MouseEvent>) => {
			const element = elements.find((el) => el.id === elementId);
			if (!element) return;

			setRotatingElement({
				id: elementId,
				originalAngle: element.angle,
			});
		},
		[elements],
	);

	/**
	 * Handle rotation move - rAF-batched angle update for smooth rotation
	 */
	const handleRotationMove = useCallback(
		(elementId: string, angle: number, _e: KonvaEventObject<MouseEvent>) => {
			if (!rotatingElement || rotatingElement.id !== elementId) return;

			// Store pending angle; let rAF flush it
			pendingRotationRef.current = { id: elementId, angle };
			if (rotationRafRef.current == null) {
				rotationRafRef.current = requestAnimationFrame(() => {
					rotationRafRef.current = null;
					const pending = pendingRotationRef.current;
					if (pending) {
						updateElement(pending.id, { angle: pending.angle });
					}
				});
			}
		},
		[rotatingElement, updateElement],
	);

	/**
	 * Handle rotation end - Flush any pending rAF and finalize
	 */
	const handleRotationEnd = useCallback(
		(_elementId: string) => {
			// Flush any pending rotation before clearing state
			if (rotationRafRef.current != null) {
				cancelAnimationFrame(rotationRafRef.current);
				rotationRafRef.current = null;
			}
			const pending = pendingRotationRef.current;
			if (pending) {
				updateElement(pending.id, { angle: pending.angle });
				pendingRotationRef.current = null;
			}
			setRotatingElement(null);
		},
		[updateElement],
	);

	// ─────────────────────────────────────────────────────────────────
	// GROUP ROTATE HANDLERS (Phase 3)
	// ─────────────────────────────────────────────────────────────────

	const handleGroupRotateStart = useCallback(
		(_e: KonvaEventObject<MouseEvent>) => {
			const selected = elements.filter((el) => selectedElementIds.has(el.id));
			if (selected.length < 2) return;
			const gb = getCombinedBounds(selected);
			if (!gb) return;

			const stage = stageRef.current;
			const pos = stage?.getPointerPosition();
			if (!pos) return;

			const cx = gb.x + gb.width / 2;
			const cy = gb.y + gb.height / 2;
			const px = (pos.x - scrollX) / zoom;
			const py = (pos.y - scrollY) / zoom;
			const startAngle = Math.atan2(py - cy, px - cx);

			groupRotateRef.current = {
				centerX: cx,
				centerY: cy,
				startAngle,
				initials: selected.map((el) => ({
					id: el.id,
					x: el.x,
					y: el.y,
					angle: el.angle,
				})),
			};
			groupRotateDeltaRef.current = 0;
			setIsDragging(true);
		},
		[elements, selectedElementIds, scrollX, scrollY, zoom, setIsDragging],
	);

	const handleGroupRotateMove = useCallback(
		(_e: KonvaEventObject<MouseEvent>) => {
			const rot = groupRotateRef.current;
			if (!rot) return;

			const stage = stageRef.current;
			const pos = stage?.getPointerPosition();
			if (!pos) return;

			const px = (pos.x - scrollX) / zoom;
			const py = (pos.y - scrollY) / zoom;
			const currentAngle = Math.atan2(py - rot.centerY, px - rot.centerX);
			const deltaAngle = currentAngle - rot.startAngle;
			groupRotateDeltaRef.current = deltaAngle;

			if (!groupRotateRafRef.current) {
				groupRotateRafRef.current = requestAnimationFrame(() => {
					groupRotateRafRef.current = 0;
					const r = groupRotateRef.current;
					if (!r) return;
					const da = groupRotateDeltaRef.current;
					const cos = Math.cos(da);
					const sin = Math.sin(da);
					const daDeg = (da * 180) / Math.PI;
					const batch = r.initials.map(({ id, x, y, angle }) => {
						const dx = x - r.centerX;
						const dy = y - r.centerY;
						return {
							id,
							updates: {
								x: r.centerX + dx * cos - dy * sin,
								y: r.centerY + dx * sin + dy * cos,
								angle: (((angle + daDeg) % 360) + 360) % 360,
							} as Partial<CanvasElement>,
						};
					});
					storeBatchUpdate(batch);
				});
			}
		},
		[scrollX, scrollY, zoom, storeBatchUpdate],
	);

	const handleGroupRotateEnd = useCallback(() => {
		const rot = groupRotateRef.current;
		if (!rot) return;

		if (groupRotateRafRef.current) {
			cancelAnimationFrame(groupRotateRafRef.current);
			groupRotateRafRef.current = 0;
		}

		const da = groupRotateDeltaRef.current;
		if (Math.abs(da) > 0.001) {
			const cos = Math.cos(da);
			const sin = Math.sin(da);
			const daDeg = (da * 180) / Math.PI;
			const batch = rot.initials.map(({ id, x, y, angle }) => {
				const dx = x - rot.centerX;
				const dy = y - rot.centerY;
				return {
					id,
					updates: {
						x: rot.centerX + dx * cos - dy * sin,
						y: rot.centerY + dx * sin + dy * cos,
						angle: (((angle + daDeg) % 360) + 360) % 360,
					},
				};
			});
			batchUpdateElements(batch);
		}

		groupRotateRef.current = null;
		groupRotateDeltaRef.current = 0;
		setIsDragging(false);
	}, [batchUpdateElements, setIsDragging]);

	// ─────────────────────────────────────────────────────────────────
	// GROUP RESIZE HANDLERS (Phase 3)
	// ─────────────────────────────────────────────────────────────────

	const handleGroupResizeStart = useCallback(
		(handle: GroupHandlePosition, _e: KonvaEventObject<MouseEvent>) => {
			const selected = elements.filter((el) => selectedElementIds.has(el.id));
			if (selected.length < 2) return;
			const gb = getCombinedBounds(selected);
			if (!gb) return;

			// Anchor = opposite corner/edge of the handle being dragged
			let anchorX = gb.x;
			let anchorY = gb.y;
			if (handle.includes("left")) anchorX = gb.x + gb.width;
			else if (handle.includes("right")) anchorX = gb.x;
			else anchorX = gb.x; // center handles: anchor at left
			if (handle.includes("top")) anchorY = gb.y + gb.height;
			else if (handle.includes("bottom")) anchorY = gb.y;
			else anchorY = gb.y; // center handles: anchor at top

			groupResizeRef.current = {
				anchorX,
				anchorY,
				origWidth: gb.width,
				origHeight: gb.height,
				origX: gb.x,
				origY: gb.y,
				handle,
				initials: selected.map((el) => ({
					id: el.id,
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					angle: el.angle,
					points:
						el.type === "freedraw" ? (el as FreedrawElement).points : undefined,
				})),
			};
			groupResizeScaleRef.current = { sx: 1, sy: 1 };
			setIsDragging(true);
		},
		[elements, selectedElementIds, setIsDragging],
	);

	const handleGroupResizeMove = useCallback(
		(_handle: GroupHandlePosition, _e: KonvaEventObject<MouseEvent>) => {
			const rs = groupResizeRef.current;
			if (!rs) return;

			const stage = stageRef.current;
			const pos = stage?.getPointerPosition();
			if (!pos) return;

			const px = (pos.x - scrollX) / zoom;
			const py = (pos.y - scrollY) / zoom;

			// Compute scale relative to anchor
			let sx = 1;
			let sy = 1;
			const handle = rs.handle;

			if (handle.includes("left") || handle.includes("right")) {
				const newW = Math.abs(px - rs.anchorX);
				sx = Math.max(0.05, newW / rs.origWidth);
			}
			if (handle.includes("top") || handle.includes("bottom")) {
				const newH = Math.abs(py - rs.anchorY);
				sy = Math.max(0.05, newH / rs.origHeight);
			}
			// Edge-center handles: preserve other axis
			if (handle === "top-center" || handle === "bottom-center") sx = 1;
			if (handle === "left-center" || handle === "right-center") sy = 1;

			// Shift = uniform scale
			if (shiftPressed && handle.includes("-") && !handle.includes("center")) {
				const uniform = Math.max(sx, sy);
				sx = uniform;
				sy = uniform;
			}

			groupResizeScaleRef.current = { sx, sy };

			if (!groupResizeRafRef.current) {
				groupResizeRafRef.current = requestAnimationFrame(() => {
					groupResizeRafRef.current = 0;
					const r = groupResizeRef.current;
					if (!r) return;
					const { sx: fsx, sy: fsy } = groupResizeScaleRef.current;
					const batch = r.initials.map((init) => {
						const newX = r.anchorX + (init.x - r.anchorX) * fsx;
						const newY = r.anchorY + (init.y - r.anchorY) * fsy;
						const updates: Partial<CanvasElement> = {
							x: newX,
							y: newY,
							width: init.width * fsx,
							height: init.height * fsy,
						};
						return { id: init.id, updates };
					});
					storeBatchUpdate(batch);
				});
			}
		},
		[scrollX, scrollY, zoom, shiftPressed, storeBatchUpdate],
	);

	const handleGroupResizeEnd = useCallback(() => {
		const rs = groupResizeRef.current;
		if (!rs) return;

		if (groupResizeRafRef.current) {
			cancelAnimationFrame(groupResizeRafRef.current);
			groupResizeRafRef.current = 0;
		}

		const { sx, sy } = groupResizeScaleRef.current;
		if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
			const batch = rs.initials.map((init) => {
				const newX = rs.anchorX + (init.x - rs.anchorX) * sx;
				const newY = rs.anchorY + (init.y - rs.anchorY) * sy;
				const updates: Record<string, unknown> = {
					x: newX,
					y: newY,
					width: init.width * sx,
					height: init.height * sy,
				};
				// Bake scaled points for freedraw elements
				if (init.points) {
					updates.points = init.points.map((p) => {
						const scaled: [number, number, number?] = [p[0] * sx, p[1] * sy];
						if (p[2] != null) scaled[2] = p[2];
						return scaled;
					});
				}
				return { id: init.id, updates };
			});
			batchUpdateElements(
				batch as Array<{ id: string; updates: Partial<CanvasElement> }>,
			);
		}

		groupResizeRef.current = null;
		groupResizeScaleRef.current = { sx: 1, sy: 1 };
		setIsDragging(false);
	}, [batchUpdateElements, setIsDragging]);

	/**
	 * Handle mouse leave - Clear cursor from awareness
	 */
	const handleMouseLeave = useCallback(() => {
		updateCursor(null);
		setHoveredElement(null);
	}, [updateCursor]);

	// ─────────────────────────────────────────────────────────────────
	// RENDER
	// ─────────────────────────────────────────────────────────────────

	// Performance: Viewport culling - skip rendering elements far outside visible area
	const visibleElements = useMemo(() => {
		// Skip culling for small canvases where overhead isn't worth it
		if (elements.length < 50) return elements;

		const vw = dimensions.width || window.innerWidth;
		const vh = dimensions.height || window.innerHeight;
		const pad = 500; // generous padding to avoid pop-in at edges
		const viewLeft = -scrollX / zoom - pad;
		const viewTop = -scrollY / zoom - pad;
		const viewRight = (-scrollX + vw) / zoom + pad;
		const viewBottom = (-scrollY + vh) / zoom + pad;

		return elements.filter((el) => {
			// Always render selected elements (needed for resize/rotation handles)
			if (selectedElementIds.has(el.id)) return true;

			// Line-based elements: use origin with extra generous bounds
			if (el.type === "freedraw" || el.type === "line" || el.type === "arrow") {
				const extraPad = 2000;
				return (
					el.x >= viewLeft - extraPad &&
					el.x <= viewRight + extraPad &&
					el.y >= viewTop - extraPad &&
					el.y <= viewBottom + extraPad
				);
			}

			// Shape elements: proper bounding box check
			const minX = Math.min(el.x, el.x + el.width);
			const minY = Math.min(el.y, el.y + el.height);
			const maxX = Math.max(el.x, el.x + el.width);
			const maxY = Math.max(el.y, el.y + el.height);
			return (
				maxX >= viewLeft &&
				minX <= viewRight &&
				maxY >= viewTop &&
				minY <= viewBottom
			);
		});
	}, [
		elements,
		scrollX,
		scrollY,
		zoom,
		dimensions.width,
		dimensions.height,
		selectedElementIds,
	]);

	// Performance: Memoize filtered elements for resize/rotation handles
	const selectedResizableElements = useMemo(() => {
		if (activeTool !== "selection" || selectedElementIds.size === 0) return [];
		return elements.filter(
			(el) =>
				selectedElementIds.has(el.id) &&
				el.type !== "line" &&
				el.type !== "arrow" &&
				el.type !== "freedraw" &&
				!el.locked,
		);
	}, [activeTool, elements, selectedElementIds]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Context menu handler for canvas area
		<div
			ref={containerRef}
			className="relative w-full h-full overflow-hidden transition-colors duration-300"
			style={{ backgroundColor: canvasBackgroundColor }}
			onContextMenu={handleContextMenu}
		>
			{/* UI Components */}
			<HeaderLeft
				onClearCanvas={handleClearCanvas}
				onExport={handleExport}
				onImportJson={handleImportScene}
				onExportDocumentation={handleExportDocumentation}
			/>
			<HeaderRight />
			<Toolbar />
			{isTextEditing && <TextFormattingToolbar />}
			<PropertiesPanel onUpdateSettings={updateSettings} />
			<BeautifyButton
				visible={showBeautifyButton}
				onBeautify={handleBeautify}
			/>
			<ZoomControls
				undo={undo}
				redo={redo}
				canUndo={canUndo}
				canRedo={canRedo}
			/>

			<RoomChat />
			<SetupStatus />

			{/* Diagram Intent Classification Badge (Story 5) */}
			<DiagramIntentBadge intent={diagramIntent} />

			{/* Phase 0 — Debug & Perf overlays */}
			<DebugOverlay
				visible={showDebugOverlay}
				freedrawPointCount={freedrawPointCount}
			/>
			<PerfHUD visible={showPerfHUD} freedrawPointCount={freedrawPointCount} />

			{/* Empty Canvas Hero - shown when no elements */}
			{elements.length === 0 && <EmptyCanvasHero />}

			{/* Collaborator Cursors */}
			<CollaboratorCursors collaborators={collaborators} />

			{/* Connection Status */}
			<ConnectionStatus
				isConnected={isConnected}
				isSynced={isSynced}
				collaboratorCount={collaborators.length}
				onReconnect={handleReconnect}
			/>

			{/* Canvas Stage */}
			<Stage
				ref={stageRef}
				width={dimensions.width || window.innerWidth}
				height={dimensions.height || window.innerHeight}
				scaleX={zoom}
				scaleY={zoom}
				x={scrollX}
				y={scrollY}
				onWheel={handleWheel}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseLeave}
				onDblClick={handleDoubleClick}
				style={{
					cursor:
						activeTool === "hand"
							? isDragging
								? "grabbing"
								: "grab"
							: activeTool === "selection"
								? "default"
								: "crosshair",
				}}
			>
				<Layer>
					{/* Grid Background Component (Synced Story 1.3.2) */}
					<GridLayer
						width={dimensions.width || window.innerWidth}
						height={dimensions.height || window.innerHeight}
						zoom={zoom}
						scrollX={scrollX}
						scrollY={scrollY}
						mode={activeGridMode}
						canvasBackgroundColor={canvasBackgroundColor}
					/>

					{/* Render visible elements (viewport-culled for performance) */}
					{visibleElements.map((element) =>
						renderElement(
							element,
							selectedElementIds.has(element.id),
							activeTool === "selection" &&
								!rotatingElement &&
								!element.locked &&
								selectedElementIds.size <= 1,
							false, // not preview
							handleElementDragEnd,
							handleJointDrag,
						),
					)}

					{/* Render element being drawn */}
					{drawingElement &&
						(sprayRasterRef.current ? (
							// Spray live preview: single Konva.Image blitting the offscreen canvas
							<KonvaImage
								ref={(node) => {
									sprayImageRef.current = node;
								}}
								image={sprayRasterRef.current.canvas}
								x={drawingElement.x - sprayRasterRef.current.originX}
								y={drawingElement.y - sprayRasterRef.current.originY}
								opacity={(drawingElement.opacity ?? 100) / 100}
								listening={false}
							/>
						) : (
							renderElement(drawingElement, false, false, true, () => {})
						))}

					{/* Render laser path (temporary) */}
					{laserPath && activeTool === "laser" && (
						<Path
							data={laserPath}
							fill={currentStrokeColor}
							opacity={0.6}
							listening={false}
						/>
					)}

					{/* Render remote laser paths */}
					{collaborators.map((c) => {
						if (!c.laserData || c.laserData.length === 0) return null;
						const remotePath = outlineToSvgPath(c.laserData, {
							size: currentStrokeWidth * 2,
							thinning: 0.5,
							smoothing: 0.5,
							streamline: 0.5,
							simulatePressure: true,
						});
						return (
							<Path
								key={`laser-${c.id}`}
								data={remotePath}
								fill={c.color}
								opacity={0.6}
								listening={false}
							/>
						);
					})}

					{/* ── Single-selection handles (resize + rotate) ── */}
					{selectedElementIds.size === 1 &&
						selectedResizableElements.map((element) => (
							<ResizeHandles
								key={`resize-${element.id}`}
								x={element.x}
								y={element.y}
								width={element.width}
								height={element.height}
								elementId={element.id}
								onResizeStart={handleResizeStart}
								onResizeMove={handleResizeMove}
								onResizeEnd={handleResizeEnd}
							/>
						))}

					{selectedElementIds.size === 1 &&
						activeTool === "selection" &&
						elements
							.filter(
								(element) =>
									selectedElementIds.has(element.id) &&
									element.type !== "line" &&
									element.type !== "arrow" &&
									element.type !== "freedraw",
							)
							.map((element) => (
								<RotationControls
									key={`rotate-${element.id}`}
									x={element.x}
									y={element.y}
									width={element.width}
									height={element.height}
									rotation={element.angle}
									elementId={element.id}
									zoom={zoom}
									scrollX={scrollX}
									scrollY={scrollY}
									onRotate90={handleRotate90}
									onRotationStart={handleRotationStart}
									onRotationMove={handleRotationMove}
									onRotationEnd={handleRotationEnd}
								/>
							))}

					{/* ── Multi-selection visuals ── */}
					{selectedElementIds.size > 1 &&
						activeTool === "selection" &&
						(() => {
							const selElements = elements.filter((el) =>
								selectedElementIds.has(el.id),
							);
							const groupBounds = getCombinedBounds(selElements);
							return (
								<>
									{/* Per-object selection boxes */}
									{selElements.map((el) => {
										const b = getRotatedBoundingBox(el);
										return (
											<Rect
												key={`sel-box-${el.id}`}
												x={b.x}
												y={b.y}
												width={b.width}
												height={b.height}
												stroke="#6965db"
												strokeWidth={1}
												dash={[4, 4]}
												listening={false}
											/>
										);
									})}
									{groupBounds && (
										<GroupTransformHandles
											x={groupBounds.x - 4}
											y={groupBounds.y - 4}
											width={groupBounds.width + 8}
											height={groupBounds.height + 8}
											onResizeStart={handleGroupResizeStart}
											onResizeMove={handleGroupResizeMove}
											onResizeEnd={handleGroupResizeEnd}
											onRotateStart={handleGroupRotateStart}
											onRotateMove={handleGroupRotateMove}
											onRotateEnd={handleGroupRotateEnd}
										/>
									)}
								</>
							);
						})()}

					{/* ── Marquee selection overlay ── */}
					{marqueeRect && (
						<Rect
							x={
								marqueeRect.width < 0
									? marqueeRect.x + marqueeRect.width
									: marqueeRect.x
							}
							y={
								marqueeRect.height < 0
									? marqueeRect.y + marqueeRect.height
									: marqueeRect.y
							}
							width={Math.abs(marqueeRect.width)}
							height={Math.abs(marqueeRect.height)}
							fill="rgba(105, 101, 219, 0.08)"
							stroke="#6965db"
							strokeWidth={1}
							listening={false}
						/>
					)}
				</Layer>

				{/* Ghost Layer: Remote users' live drawing previews */}
				{/* Completely isolated: listening={false}, no zIndex, no selection */}
				<GhostLayer remoteGhosts={remoteGhosts} />
			</Stage>

			{/* Help Text (bottom right) */}
			<div className="absolute bottom-4 right-4 z-20 text-xs text-gray-400">
				Press <kbd className="px-1 py-0.5 bg-gray-100 rounded">?</kbd> for
				shortcuts
			</div>

			{/* Attribution Tooltip (hover inspection – Story 7) */}
			<AttributionTooltip
				element={hoveredElement}
				x={tooltipPos.x}
				y={tooltipPos.y}
			/>

			{/* Context Menu */}
			<ContextMenu
				x={contextMenu.x}
				y={contextMenu.y}
				isVisible={contextMenu.visible}
				metadata={contextMenu.metadata}
				hasSelection={selectedElementIds.size > 0}
				onClose={closeContextMenu}
				onCopy={handleCopy}
				onPaste={handlePaste}
				onDelete={handleDelete}
				onBringForward={handleBringForward}
				onSendBackward={handleSendBackward}
				onBringToFront={handleBringToFront}
				onSendToBack={handleSendToBack}
			/>

			{/* Rich text editor — both new text and editing existing */}
			{editingText && (
				<RichTextEditor
					x={editingText.x}
					y={editingText.y}
					zoom={zoom}
					scrollX={scrollX}
					scrollY={scrollY}
					strokeColor={currentStrokeColor}
					initialRuns={editingText.initialRuns}
					initialText={editingText.initialText}
					elementId={editingText.elementId}
					initialWidth={editingText.initialWidth}
					initialHeight={editingText.initialHeight}
					onComplete={handleCompleteRichText}
					onCancel={handleCancelText}
				/>
			)}

			{/* Export Modal */}
			<ExportModal
				isOpen={showExportModal}
				onClose={() => setShowExportModal(false)}
				elements={elements}
				stageRef={stageRef}
				initialFormat={exportFormat}
			/>

			{/* Documentation Modal (Story 4) */}
			<DocumentationModal
				isOpen={showDocModal}
				onClose={() => setShowDocModal(false)}
				stageRef={stageRef}
			/>

			{/* Activity Log Sidebar */}
			<ActivitySidebar />

			{/* Archived Banner */}
			{isArchived && (
				<div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
					<div className="bg-orange-50 border border-orange-200 text-orange-700 px-6 py-2 rounded-full shadow-lg flex items-center gap-2 font-medium backdrop-blur-sm pointer-events-auto">
						<LucideArchive size={16} />
						<span>This canvas is archived and is in read-only mode</span>
						<button
							type="button"
							onClick={() => router.push("/")}
							className="ml-2 text-xs bg-orange-200 hover:bg-orange-300 px-2 py-0.5 rounded transition-colors"
						>
							Back to Dashboard
						</button>
					</div>
				</div>
			)}

			{/* AI Chat Sidebar */}
			<AiChatSidebar stageRef={stageRef} />

			{/* Named Versions Sidebar */}
			<VersionsPanel
				token={token}
				onRestore={(snapshot) =>
					restoreVersion(
						snapshot as Record<string, import("@repo/common").CanvasElement>,
					)
				}
			/>
		</div>
	);
}
