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
	Tool,
} from "@repo/common";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useRef, useState } from "react";

import {
	Arrow,
	Circle,
	Ellipse,
	Group,
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
import {
	createArrow,
	createFreedraw,
	createLine,
	createShape,
	createText,
	getElementAtPoint,
	type ShapeModifiers,
} from "../lib/element-utils";
import { outlineToSvgPath, simplifyPath } from "../lib/stroke-utils";
import { supabase } from "../lib/supabase.client";
import {
	useCanvasStore,
	useCollaboratorsArray,
	useElementsArray,
} from "../store/canvas-store";
import { CollaboratorCursors } from "./canvas/CollaboratorCursors";
import { ConnectionStatus } from "./canvas/ConnectionStatus";
import { ContextMenu } from "./canvas/ContextMenu";
import { EmptyCanvasHero } from "./canvas/EmptyCanvasHero";
import { ExportModal } from "./canvas/ExportModal";
import GhostLayer from "./canvas/GhostLayer";
import { HeaderLeft, HeaderRight } from "./canvas/Header";
import { PropertiesPanel } from "./canvas/PropertiesPanel";
import { type HandlePosition, ResizeHandles } from "./canvas/ResizeHandles";
import { RotationControls } from "./canvas/RotationControls";
// Import components directly to avoid circular dependencies through barrel exports
import { Toolbar } from "./canvas/Toolbar";
import { ZoomControls } from "./canvas/ZoomControls";

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
				shadowColor: "#3b82f6", // Blue glow
				shadowBlur: 15,
				shadowOpacity: 0.8,
				shadowEnabled: true,
			}
		: {
				shadowEnabled: false,
			};

	// Enhanced glow for lines/arrows (thicker shadow since lines are thin)
	const lineSelectionProps = isSelected
		? {
				shadowColor: "#3b82f6", // Blue glow
				shadowBlur: 25,
				shadowOpacity: 1,
				shadowOffsetX: 0,
				shadowOffsetY: 0,
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
		case "rectangle":
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
							? undefined
							: element.backgroundColor
					}
					cornerRadius={element.roundness?.value ?? 0}
				/>
			);

		case "ellipse":
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
							? undefined
							: element.backgroundColor
					}
				/>
			);

		case "line": {
			const lineElement = element as LineElement;
			const points = lineElement.points.flatMap((p) => [p.x, p.y]);

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
						hitStrokeWidth={Math.max(element.strokeWidth, 10)}
						{...lineSelectionProps}
						onDragEnd={(e: KonvaEventObject<DragEvent>) => {
							onDragEnd(element.id, e.target.x(), e.target.y());
						}}
					/>
				);
			}

			// Solid style: use perfect-freehand for smooth strokes with variable width
			const pathData = outlineToSvgPath(points, {
				size: element.strokeWidth * 2,
				thinning: 0.5,
				smoothing: 0.5,
				streamline: 0.5,
				simulatePressure: true, // Constant width
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
							? undefined
							: element.backgroundColor
					}
				/>
			);
		}

		case "text": {
			const textElement = element as TextElement;
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
		deleteElements,
		updateCursor,
		updateSelection,
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
		clearSelection,
		currentStrokeColor,
		currentBackgroundColor,
		currentStrokeWidth,
		currentStrokeStyle,
		currentOpacity,
		zoom,
		scrollX,
		scrollY,
		setScroll,
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
	} = useCanvasStore();

	// Elements and collaborators from store
	const elements = useElementsArray();
	const collaborators = useCollaboratorsArray();

	// Helper to get the next zIndex for new elements (always on top)
	const getNextZIndex = useCallback(() => {
		if (elements.length === 0) return 1;
		return Math.max(...elements.map((el) => el.zIndex || 0)) + 1;
	}, [elements]);

	// ─────────────────────────────────────────────────────────────────
	// GHOST PREVIEW BROADCASTING
	// Broadcasts current drawing state to remote users via awareness
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Broadcasts current drawing state as a ghost preview to remote users.
	 * Uses Y.js awareness (NOT Y.Doc) — no document writes.
	 * Throttled internally by useGhostPreviews hook (16ms / ~60fps).
	 */
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
				fillColor:
					(element.backgroundColor as string) || currentBackgroundColor,
				strokeStyle:
					(element.strokeStyle as GhostPreview["strokeStyle"]) || "solid",
				clientName: "",
				clientColor: "",
			});
		},
		[
			broadcastGhost,
			currentStrokeColor,
			currentStrokeWidth,
			currentBackgroundColor,
		],
	);

	// Clear ghost preview when tool changes (cancel any in-progress preview)
	// biome-ignore lint/correctness/useExhaustiveDependencies: activeTool is intentionally included to trigger clearGhost when tool changes
	useEffect(() => {
		clearGhost();
	}, [activeTool, clearGhost]);

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

	// Text editing state
	const [editingText, setEditingText] = useState<{
		x: number;
		y: number;
		initialText?: string;
		initialWidth?: number;
		initialHeight?: number;
		elementId?: string; // If set, editing existing element
	} | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const textareaJustOpenedRef = useRef<boolean>(false);

	// Freedraw points accumulator (persistent strokes)
	const freedrawPointsRef = useRef<Array<[number, number]>>([]);

	// Laser points accumulator (temporary pointer)
	const laserPointsRef = useRef<Array<[number, number]>>([]);
	const [laserPath, setLaserPath] = useState<string | null>(null);

	// Eraser state - track continuous drag
	const isErasingRef = useRef<boolean>(false);
	const erasedElementsRef = useRef<Set<string>>(new Set());

	// Ref to track current selection (fixes stale closure in color update effects)
	const selectedElementIdsRef = useRef<Set<string>>(selectedElementIds);

	// Container dimensions
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	// Clipboard for copy/paste
	const [clipboard, setClipboard] = useState<CanvasElement[]>([]);

	// Context menu state
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		visible: boolean;
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

	// Export modal state
	const [showExportModal, setShowExportModal] = useState(false);
	const [exportFormat, setExportFormat] = useState<"png" | "svg" | "json">(
		"png",
	);

	// Handle export from sidebar menu
	const handleExport = useCallback((format: "png" | "svg" | "json") => {
		setExportFormat(format);
		setShowExportModal(true);
	}, []);

	// ─────────────────────────────────────────────────────────────────
	// AUTO-CAPTURE THUMBNAIL for dashboard preview
	// Debounced: captures 2s after any element change
	// ─────────────────────────────────────────────────────────────────

	const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const HTTP_URL = process.env.NEXT_PUBLIC_HTTP_URL || "http://localhost:8000";

	useEffect(() => {
		// Clear previous timer on every element change
		if (thumbnailTimerRef.current) {
			clearTimeout(thumbnailTimerRef.current);
		}

		// Wait 2s after last change, then capture & upload
		thumbnailTimerRef.current = setTimeout(async () => {
			const stage = stageRef.current;
			if (!stage) return;

			const layer = stage.getLayers()[0];
			if (!layer || layer.children.length === 0) return;

			try {
				const KonvaLib = (await import("konva")).default;

				// Add temp background
				const bgRect = new KonvaLib.Rect({
					x: -stage.x() / stage.scaleX(),
					y: -stage.y() / stage.scaleY(),
					width: stage.width() / stage.scaleX(),
					height: stage.height() / stage.scaleY(),
					fill: "#fafafa",
				});
				layer.add(bgRect);
				bgRect.moveToBottom();
				layer.draw();

				const dataURL = stage.toDataURL({
					pixelRatio: 0.2,
					mimeType: "image/png",
				});

				// Cleanup
				bgRect.destroy();
				layer.draw();

				// Upload
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (!session) return;

				await fetch(`${HTTP_URL}/api/v1/canvas/${roomId}`, {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${session.access_token}`,
					},
					body: JSON.stringify({ thumbnail_url: dataURL }),
				});
			} catch {}
		}, 2000);

		return () => {
			if (thumbnailTimerRef.current) {
				clearTimeout(thumbnailTimerRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [roomId, HTTP_URL]);

	// Reconnect function
	const handleReconnect = useCallback(() => {
		// The hook will automatically reconnect when the component re-initializes
		// For now, we can just reload the page or re-establish the connection
		window.location.reload();
	}, []);

	// ─────────────────────────────────────────────────────────────────
	// EFFECTS
	// ─────────────────────────────────────────────────────────────────

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

	// Track keyboard modifiers for shape creation (Shift for aspect ratio, Alt for center scaling)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Shift") setShiftPressed(true);
			if (e.key === "Alt") setAltPressed(true);
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === "Shift") setShiftPressed(false);
			if (e.key === "Alt") setAltPressed(false);
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, []);

	// Auto-resize textarea when editing text
	useEffect(() => {
		if (editingText && textareaRef.current) {
			const textarea = textareaRef.current;

			// Mark that we just opened the textarea to prevent immediate blur
			textareaJustOpenedRef.current = true;

			// Use setTimeout to ensure focus happens after render
			setTimeout(() => {
				textarea.focus();
				textarea.select();
				// Allow blur events after a short delay
				setTimeout(() => {
					textareaJustOpenedRef.current = false;
				}, 100);
			}, 0);

			// Auto-resize function
			const resize = () => {
				textarea.style.height = "auto";
				textarea.style.height = `${textarea.scrollHeight}px`;
			};

			resize();
			textarea.addEventListener("input", resize);

			return () => {
				textarea.removeEventListener("input", resize);
			};
		}
	}, [editingText]);

	/**
	 * Complete text editing and create/update text element
	 */
	const handleCompleteText = useCallback(
		(text: string) => {
			if (editingText && text.trim()) {
				// Get the textarea dimensions for the text box size
				const textarea = textareaRef.current;
				const width = textarea ? textarea.offsetWidth : 200;
				const height = textarea ? textarea.offsetHeight : 40;

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
			} else if (editingText?.elementId && !text.trim()) {
				// If editing existing element and text is empty, delete the element
				deleteElements([editingText.elementId]);
			}
			setEditingText(null);
		},
		[
			editingText,
			currentStrokeColor,
			currentOpacity,
			addElement,
			updateElement,
			deleteElements,
			zoom,
			getNextZIndex,
		],
	);

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
	 * Bring selected elements forward one level (swap with element above)
	 * Elements array is already sorted by zIndex (ascending)
	 */
	const handleBringForward = useCallback(() => {
		if (selectedElementIds.size === 0) return;

		// Process each selected element
		Array.from(selectedElementIds).forEach((id) => {
			const currentIndex = elements.findIndex((el) => el.id === id);
			if (currentIndex === -1 || currentIndex === elements.length - 1) return; // Already on top or not found

			const currentElement = elements[currentIndex];
			const elementAbove = elements[currentIndex + 1];

			if (!currentElement || !elementAbove) return;

			// Swap zIndex values with element above
			const currentZ = currentElement.zIndex ?? currentIndex;
			const aboveZ = elementAbove.zIndex ?? currentIndex + 1;

			// Swap: current gets higher, above gets lower
			updateElement(id, { zIndex: aboveZ });
			updateElement(elementAbove.id, { zIndex: currentZ });
		});
	}, [selectedElementIds, elements, updateElement]);

	/**
	 * Send selected elements backward one level (swap with element below)
	 * Elements array is already sorted by zIndex (ascending)
	 */
	const handleSendBackward = useCallback(() => {
		if (selectedElementIds.size === 0) return;

		// Process each selected element
		Array.from(selectedElementIds).forEach((id) => {
			const currentIndex = elements.findIndex((el) => el.id === id);
			if (currentIndex <= 0) return; // Already at back or not found

			const currentElement = elements[currentIndex];
			const elementBelow = elements[currentIndex - 1];

			if (!currentElement || !elementBelow) return;

			// Swap zIndex values with element below
			const currentZ = currentElement.zIndex ?? currentIndex;
			const belowZ = elementBelow.zIndex ?? currentIndex - 1;

			// Swap: current gets lower, below gets higher
			updateElement(id, { zIndex: belowZ });
			updateElement(elementBelow.id, { zIndex: currentZ });
		});
	}, [selectedElementIds, elements, updateElement]);

	/**
	 * Bring selected elements to front (highest z-index)
	 */
	const handleBringToFront = useCallback(() => {
		if (selectedElementIds.size === 0) return;

		const maxZ = Math.max(...elements.map((el) => el.zIndex || 0), 0);

		let nextZ = maxZ + 1;
		Array.from(selectedElementIds).forEach((id) => {
			updateElement(id, { zIndex: nextZ });
			nextZ++;
		});
	}, [selectedElementIds, elements, updateElement]);

	/**
	 * Send selected elements to back (lowest z-index)
	 */
	const handleSendToBack = useCallback(() => {
		if (selectedElementIds.size === 0) return;

		const minZ = Math.min(...elements.map((el) => el.zIndex || 0), 0);

		// Set selected elements to zIndex below the minimum
		let nextZ = minZ - selectedElementIds.size;
		Array.from(selectedElementIds).forEach((id) => {
			updateElement(id, { zIndex: nextZ });
			nextZ++;
		});
	}, [selectedElementIds, elements, updateElement]);

	/**
	 * Handle context menu (right-click)
	 */
	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			// Block context menu in read-only mode
			if (isReadOnly) return;
			setContextMenu({
				x: e.clientX,
				y: e.clientY,
				visible: true,
			});
		},
		[isReadOnly],
	);

	/**
	 * Close context menu
	 */
	const closeContextMenu = useCallback(() => {
		setContextMenu((prev) => ({ ...prev, visible: false }));
	}, []);

	/**
	 * Handle delete from context menu
	 */
	const handleDelete = useCallback(() => {
		if (selectedElementIds.size > 0) {
			deleteElements(Array.from(selectedElementIds));
			clearSelection();
		}
	}, [selectedElementIds, deleteElements, clearSelection]);

	/**
	 * Clear all elements from canvas
	 */
	const handleClearCanvas = useCallback(() => {
		if (elements.length === 0) return;

		// Confirm before clearing
		if (
			window.confirm(
				"Are you sure you want to clear the entire canvas? This cannot be undone.",
			)
		) {
			const allIds = elements.map((el) => el.id);
			deleteElements(allIds);
			clearSelection();
		}
	}, [elements, deleteElements, clearSelection]);

	// ─────────────────────────────────────────────────────────────────
	// KEYBOARD SHORTCUTS
	// ─────────────────────────────────────────────────────────────────

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if typing in input
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			// Lock toggle: L key (works regardless of read-only state)
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				e.key.toLowerCase() === "l"
			) {
				setReadOnly(!isReadOnly);
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
						});
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
				deleteElements(Array.from(selectedElementIds));
				clearSelection();
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

			// Duplicate: Ctrl/Cmd + D
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
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
		isReadOnly,
		setReadOnly,
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
	const handleMouseDown = useCallback(
		(e: KonvaEventObject<MouseEvent>) => {
			const point = getCanvasPoint(e);
			setInteractionStartPoint(point);

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
					// Check what was clicked
					const clickedOnStage = e.target === e.target.getStage();
					const targetId = e.target.id?.();
					const isActualElement =
						targetId && elements.some((el) => el.id === targetId);

					if (isActualElement) {
						// Clicked directly on an element - select it and enable dragging
						if (!selectedElementIds.has(targetId)) {
							setSelectedElementIds(new Set([targetId]));
						}
						setIsDragging(true);
						break;
					}

					if (!clickedOnStage) {
						// Clicked on a Konva shape that's NOT an element (rotation control, resize handle, etc.)
						// Don't change selection - let the control's own handlers deal with it
						break;
					}

					// Clicked on the stage background - use custom hit detection for overlapping elements
					const clickedElement = getElementAtPoint(point, elements);
					if (clickedElement) {
						if (!selectedElementIds.has(clickedElement.id)) {
							setSelectedElementIds(new Set([clickedElement.id]));
						}
						setIsDragging(true);
					} else {
						// Clicked on empty canvas - clear selection
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
							opacity: currentOpacity,
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
					});
					setDrawingElement(newFreedraw);
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
					break;
				}

				case "eraser": {
					// Start erasing - enable continuous drag deletion
					isErasingRef.current = true;
					erasedElementsRef.current.clear();

					const elementToDelete = getElementAtPoint(point, elements);
					if (elementToDelete) {
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
			clearSelection,
			setIsDrawing,
			setIsDragging,
			setInteractionStartPoint,
			currentStrokeColor,
			currentBackgroundColor,
			currentStrokeWidth,
			currentStrokeStyle,
			currentOpacity,
			shiftPressed,
			altPressed,
			deleteElements,
			isDrawing,
			drawingElement,
			isReadOnly,
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

			// Update cursor position for collaboration
			const stage = stageRef.current;
			const pos = stage?.getPointerPosition();
			if (pos) {
				updateCursor({ x: pos.x, y: pos.y });
			}

			// Handle hand tool panning
			if (isDragging && activeTool === "hand" && interactionStartPoint) {
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
					!erasedElementsRef.current.has(elementToDelete.id)
				) {
					deleteElements([elementToDelete.id]);
					erasedElementsRef.current.add(elementToDelete.id);
				}
				return;
			}

			// Handle laser pointer (temporary drawing)
			if (activeTool === "laser" && isDrawing && interactionStartPoint) {
				const dx = point.x - interactionStartPoint.x;
				const dy = point.y - interactionStartPoint.y;

				laserPointsRef.current.push([dx, dy]);

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
						...lineElement,
						points: newPoints,
						width: Math.abs(dx),
						height: Math.abs(dy),
					});
					break;
				}

				case "freedraw": {
					// Add point to freedraw path (persistent)
					freedrawPointsRef.current.push([dx, dy]);

					setDrawingElement({
						...drawingElement,
						points: freedrawPointsRef.current,
					} as FreedrawElement);
					// Broadcast ghost preview to remote users
					broadcastDrawingPreview({
						...drawingElement,
						points: freedrawPointsRef.current,
					});
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
			broadcastDrawingPreview,
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

		// Finalize drawing
		if (isDrawing && drawingElement) {
			// Freedraw: simplified, no pressure calculation
			if (drawingElement.type === "freedraw") {
				const freedrawElement = drawingElement as FreedrawElement;
				if (freedrawPointsRef.current.length > 2) {
					// Optionally simplify path for network efficiency
					const simplifiedPoints = simplifyPath(
						freedrawPointsRef.current,
						2.0, // epsilon value
					);
					freedrawElement.points = simplifiedPoints;
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
		}

		// Reset state
		setIsDrawing(false);
		setIsDragging(false);
		setDrawingElement(null);
		setInteractionStartPoint(null);
		freedrawPointsRef.current = [];

		// Clear eraser state
		isErasingRef.current = false;
		erasedElementsRef.current.clear();
	}, [
		isDrawing,
		drawingElement,
		addElement,
		setSelectedElementIds,
		setIsDrawing,
		setIsDragging,
		setInteractionStartPoint,
		activeTool,
		getNextZIndex,
		clearGhost,
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
				});
			}
		},
		[getCanvasPoint, elements],
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
	 * Handle rotation move - Update element angle during drag
	 */
	const handleRotationMove = useCallback(
		(elementId: string, angle: number, _e: KonvaEventObject<MouseEvent>) => {
			if (!rotatingElement || rotatingElement.id !== elementId) return;

			// Update element angle in real-time
			updateElement(elementId, { angle });
		},
		[rotatingElement, updateElement],
	);

	/**
	 * Handle rotation end - Finalize the rotation operation
	 */
	const handleRotationEnd = useCallback((_elementId: string) => {
		setRotatingElement(null);
	}, []);

	/**
	 * Handle mouse leave - Clear cursor from awareness
	 */
	const handleMouseLeave = useCallback(() => {
		updateCursor(null);
	}, [updateCursor]);

	// ─────────────────────────────────────────────────────────────────
	// RENDER
	// ─────────────────────────────────────────────────────────────────

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Context menu handler for canvas area
		<div
			ref={containerRef}
			className="relative w-full h-full overflow-hidden"
			style={{ backgroundColor: "var(--color-canvas)" }}
			onContextMenu={handleContextMenu}
		>
			{/* Clean dot grid background - Excalidraw style */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					backgroundImage: `
            radial-gradient(circle, #d4d4d4 1px, transparent 1px)
          `,
					backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
					backgroundPosition: `${scrollX}px ${scrollY}px`,
				}}
			/>

			{/* UI Components */}
			<HeaderLeft onClearCanvas={handleClearCanvas} onExport={handleExport} />
			<HeaderRight />
			<Toolbar />
			<PropertiesPanel />
			<ZoomControls
				undo={undo}
				redo={redo}
				canUndo={canUndo}
				canRedo={canRedo}
			/>

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
					{/* Render existing elements */}
					{elements.map((element) =>
						renderElement(
							element,
							selectedElementIds.has(element.id),
							activeTool === "selection",
							false, // not preview
							handleElementDragEnd,
							handleJointDrag,
						),
					)}

					{/* Render element being drawn */}
					{drawingElement &&
						renderElement(drawingElement, false, false, true, () => {})}

					{/* Render laser path (temporary) */}
					{laserPath && activeTool === "laser" && interactionStartPoint && (
						<Path
							data={laserPath}
							x={interactionStartPoint.x}
							y={interactionStartPoint.y}
							fill={currentStrokeColor}
							opacity={0.6}
							listening={false}
						/>
					)}

					{/* Render resize handles for selected elements (not lines/arrows) */}
					{activeTool === "selection" &&
						elements
							.filter(
								(element) =>
									selectedElementIds.has(element.id) &&
									element.type !== "line" &&
									element.type !== "arrow" &&
									element.type !== "freedraw",
							)
							.map((element) => (
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

					{/* Render rotation controls for selected elements */}
					{activeTool === "selection" &&
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

			{/* Context Menu */}
			<ContextMenu
				x={contextMenu.x}
				y={contextMenu.y}
				isVisible={contextMenu.visible}
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

			{/* Text Editing Overlay */}
			{editingText && (
				<div
					style={{
						position: "absolute",
						left: `${editingText.x * zoom + scrollX}px`,
						top: `${editingText.y * zoom + scrollY}px`,
						zIndex: 1000,
					}}
				>
					<textarea
						ref={textareaRef}
						defaultValue={editingText.initialText || ""}
						style={{
							fontSize: "16px",
							fontFamily: "Arial",
							color: currentStrokeColor,
							background: "white",
							border: "2px solid #6965db",
							borderRadius: "4px",
							padding: "8px",
							minWidth: "100px",
							minHeight: "40px",
							width: editingText.initialWidth
								? `${editingText.initialWidth * zoom}px`
								: "200px",
							height: editingText.initialHeight
								? `${editingText.initialHeight * zoom}px`
								: "auto",
							resize: "both",
							overflow: "auto",
							outline: "none",
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleCompleteText(e.currentTarget.value);
							} else if (e.key === "Escape") {
								setEditingText(null);
							}
						}}
						onBlur={(e) => {
							// Ignore blur if textarea just opened (prevents immediate close)
							if (textareaJustOpenedRef.current) {
								return;
							}
							handleCompleteText(e.currentTarget.value);
						}}
					/>
					{/* Resize hint */}
					<div className="text-xs text-gray-400 mt-1">
						Drag corners/edges to resize • Enter to save • Esc to cancel
					</div>
				</div>
			)}

			{/* Export Modal */}
			<ExportModal
				isOpen={showExportModal}
				onClose={() => setShowExportModal(false)}
				elements={elements}
				stageRef={stageRef}
				initialFormat={exportFormat}
			/>
		</div>
	);
}
