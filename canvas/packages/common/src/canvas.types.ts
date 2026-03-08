/**
 * ============================================================================
 * LEKHAFLOW CANVAS TYPES
 * ============================================================================
 *
 * Core type definitions for the collaborative canvas sync engine.
 * These types are shared between frontend and backend.
 *
 * Architecture follows Excalidraw's patterns:
 * - Elements are immutable, identified by ID
 * - Changes are tracked via version numbers
 * - Deleted elements are soft-deleted (isDeleted flag)
 */

// ============================================================================
// PRIMITIVE TYPES
// ============================================================================

/**
 * 2D Point representation
 * Used for positions, cursor locations, and path points
 */
export interface Point {
	x: number;
	y: number;
}

/**
 * Bounding box for elements
 * Used for hit testing, selection, and rendering optimizations
 */
export interface BoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

// ============================================================================
// ELEMENT TYPES
// ============================================================================

/**
 * Supported element types in the canvas
 * Each type has specific rendering and interaction logic
 */
export type ElementType =
	| "rectangle" // Basic rectangle shape
	| "ellipse" // Circle/ellipse shape
	| "diamond" // Diamond shape
	| "line" // Straight line with optional arrows
	| "arrow" // Arrow (line with arrowhead)
	| "freedraw" // Freehand drawing path
	| "text"; // Text element

/**
 * Stroke style for element borders
 */
export type StrokeStyle = "solid" | "dashed" | "dotted";

/**
 * Fill style for element backgrounds
 */
export type FillStyle = "solid" | "hachure" | "cross-hatch" | "none";

/**
 * Arrow head types for line/arrow elements
 */
export type Arrowhead = "none" | "arrow" | "triangle" | "circle" | "square";

// ============================================================================
// BASE ELEMENT
// ============================================================================

/**
 * Base properties shared by all canvas elements
 *
 * KEY CONCEPTS:
 * - `id`: Unique identifier (UUID), immutable
 * - `version`: Incremented on every change, used for conflict resolution
 * - `versionNonce`: Random number for tie-breaking concurrent edits
 * - `isDeleted`: Soft delete flag (elements are never truly removed for sync)
 */
export interface ExcalidrawElementBase {
	/** Unique element identifier (UUID v4) */
	id: string;

	/** Element type discriminator */
	type: ElementType;

	/** Position: top-left X coordinate */
	x: number;

	/** Position: top-left Y coordinate */
	y: number;

	/** Element width (can be negative for flipped elements) */
	width: number;

	/** Element height (can be negative for flipped elements) */
	height: number;

	/** Rotation angle in degrees (0-360) */
	angle: number;

	/** Stroke/border color (hex string) */
	strokeColor: string;

	/** Fill/background color (hex string or "transparent") */
	backgroundColor: string;

	/** Stroke width in pixels */
	strokeWidth: number;

	/** Stroke style pattern */
	strokeStyle: StrokeStyle;

	/** Fill pattern style */
	fillStyle: FillStyle;

	/** Element opacity (0-100) */
	opacity: number;

	/** Roughness for hand-drawn effect (0 = clean, higher = rougher) */
	roughness: number;

	/** Seed for consistent rough.js rendering */
	seed: number;

	/**
	 * Sketch-style (Rough.js) rendering configuration.
	 * Applies to non-freehand shapes only (rectangle, ellipse, diamond, line, arrow).
	 * When enabled, shapes are rendered with a hand-drawn look via Rough.js.
	 */
	roughStyle?: {
		/** Whether sketch rendering is active */
		enabled: boolean;
		/** Sloppiness of the hand-drawn effect (0 = clean, 3 = very rough) */
		sloppiness: number;
	};

	/** Version number, incremented on each change */
	version: number;

	/** Random nonce for conflict resolution */
	versionNonce: number;

	/** Soft delete flag */
	isDeleted: boolean;

	/** Group IDs this element belongs to */
	groupIds: string[];

	/** Bound element IDs (e.g., text bound to shape) */
	boundElements: Array<{ id: string; type: "text" | "arrow" }> | null;

	/** Last updated timestamp */
	updated: number;

	/** Link URL (optional, for clickable elements) */
	link: string | null;

	/** Whether element is locked from editing */
	locked: boolean;

	/** Timestamp of creation (Unix epoch) */
	created?: number;

	/** Name of the user who created this element */
	createdBy?: string;

	/** Name of the user who last modified this element */
	lastModifiedBy?: string;

	/** Explicit z-index for layering */
	zIndex?: number;
}

// ============================================================================
// SPECIFIC ELEMENT TYPES
// ============================================================================

/**
 * Rectangle element
 * Simple rectangular shape with optional rounded corners
 */
export interface RectangleElement extends ExcalidrawElementBase {
	type: "rectangle";
	/** Corner radius for rounded rectangles */
	roundness: { type: "adaptive" | "proportional"; value: number } | null;
}

/**
 * Ellipse element
 * Circle or ellipse shape
 */
export interface EllipseElement extends ExcalidrawElementBase {
	type: "ellipse";
}

/**
 * Diamond element
 * Diamond/rhombus shape
 */
export interface DiamondElement extends ExcalidrawElementBase {
	type: "diamond";
}

/**
 * Line element
 * Straight or multi-point line with optional arrowheads
 */
export interface LineElement extends ExcalidrawElementBase {
	type: "line";
	/** Array of points relative to element origin */
	points: Point[];
	/** Start arrowhead type */
	startArrowhead: Arrowhead | null;
	/** End arrowhead type */
	endArrowhead: Arrowhead | null;
	/** Binding at start point */
	startBinding: PointBinding | null;
	/** Binding at end point */
	endBinding: PointBinding | null;
}

/**
 * Arrow element (specialized line with default arrowhead)
 */
export interface ArrowElement extends ExcalidrawElementBase {
	type: "arrow";
	points: Point[];
	startArrowhead: Arrowhead | null;
	endArrowhead: Arrowhead;
	startBinding: PointBinding | null;
	endBinding: PointBinding | null;
}

/**
 * Point binding for connecting arrows to shapes
 */
export interface PointBinding {
	elementId: string;
	focus: number;
	gap: number;
}

/**
 * Freedraw element
 * Freehand drawing path stored as array of points
 */
export interface FreedrawElement extends ExcalidrawElementBase {
	type: "freedraw";
	/** Array of points forming the path, with pressure data */
	points: Array<[number, number, number?]>; // [x, y, pressure?]
	/** Pressure sensitivity enabled */
	pressures: number[];
	/** Smoothing applied */
	simulatePressure: boolean;
	/** Brush style used for this stroke */
	brushType?: string;
	/**
	 * Stable seed for deterministic brush randomness.
	 * Generated once on stroke creation (pointerdown) and kept immutable.
	 * Ensures spray dots / watercolour wash are identical
	 * across local, remote, and ghost preview rendering.
	 */
	seedId?: string;
}

/**
 * Inline text run — a contiguous range of text sharing the same formatting.
 * The full text is reconstructed by concatenating all run `text` values in order.
 */
export interface TextRun {
	/** The text content of this run */
	text: string;
	/** Font family name (e.g. "Arial", "Georgia") */
	fontFamily?: string;
	/** Font size in pixels */
	fontSize?: number;
	/** Bold flag */
	bold?: boolean;
	/** Italic flag */
	italic?: boolean;
	/** Underline flag */
	underline?: boolean;
}

/**
 * Active text style — tracks the current formatting state for the toolbar.
 * When a user toggles bold/italic etc., these values are updated in the store
 * and will be applied to newly typed text or selected ranges (Phase 2+).
 */
export interface ActiveTextStyle {
	fontFamily: string;
	fontSize: number;
	bold: boolean;
	italic: boolean;
	underline: boolean;
}

/**
 * Text element
 * Editable text with font properties
 */
export interface TextElement extends ExcalidrawElementBase {
	type: "text";
	/** Text content (plain-text, kept in sync with runs for backward compat) */
	text: string;
	/** Font size in pixels (default / box-level) */
	fontSize: number;
	/** Font family ID (legacy, kept for backward compat) */
	fontFamily: number;
	/** Text alignment */
	textAlign: "left" | "center" | "right";
	/** Vertical alignment */
	verticalAlign: "top" | "middle" | "bottom";
	/** Line height multiplier */
	lineHeight: number;
	/** ID of container element (if text is bound to shape) */
	containerId: string | null;
	/** Original text before wrapping */
	originalText: string;
	/** Rich-text inline formatting runs (Phase 1 foundation — optional, backward compat) */
	runs?: TextRun[];
}

/**
 * Union type of all element types
 */
export type CanvasElement =
	| RectangleElement
	| EllipseElement
	| DiamondElement
	| LineElement
	| ArrowElement
	| FreedrawElement
	| TextElement;

// ============================================================================
// TOOL TYPES
// ============================================================================

/**
 * Available tools in the canvas
 */
export type Tool =
	| "selection" // Select and move elements
	| "rectangle" // Draw rectangles
	| "ellipse" // Draw ellipses
	| "diamond" // Draw diamonds
	| "line" // Draw lines
	| "arrow" // Draw arrows
	| "freedraw" // Freehand drawing (persistent)
	| "laser" // Laser pointer (temporary)
	| "text" // Add text
	| "eraser" // Erase elements
	| "hand"; // Pan canvas

// ============================================================================
// APP STATE TYPES
// ============================================================================

/**
 * Cursor position with user identity for awareness
 */
export interface UserCursor {
	odLOApointer: Point;
	odLOAuser: {
		odLOAid: string;
		odLOAname: string;
		odLOAcolor: string;
	};
	odLOAselectedElementIds?: string[];
}

/**
 * Canvas viewport state
 */
export interface ViewportState {
	/** Scroll offset X */
	scrollX: number;
	/** Scroll offset Y */
	scrollY: number;
	/** Zoom level (1 = 100%) */
	zoom: number;
}

/**
 * Application state for the canvas
 */
export interface AppState {
	/** Currently selected tool */
	activeTool: Tool;
	/** Current stroke color */
	currentStrokeColor: string;
	/** Current background color */
	currentBackgroundColor: string;
	/** Current stroke width */
	currentStrokeWidth: number;
	/** Current stroke style */
	currentStrokeStyle: StrokeStyle;
	/** Current fill style */
	currentFillStyle: FillStyle;
	/** Current opacity */
	currentOpacity: number;
	/** Current font size */
	currentFontSize: number;
	/** Current font family */
	currentFontFamily: number;
	/** Selected element IDs */
	selectedElementIds: Record<string, boolean>;
	/** Viewport state */
	viewport: ViewportState;
	/** Whether currently dragging */
	isDragging: boolean;
	/** Whether currently resizing */
	isResizing: boolean;
	/** Whether currently drawing */
	isDrawing: boolean;
	/** Cursor position */
	cursorPosition: Point | null;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

/**
 * WebSocket message types for sync protocol
 */
export type SyncMessageType =
	| "sync-update" // Yjs document update
	| "awareness" // Awareness update (cursors)
	| "join-room" // Join room request
	| "leave-room" // Leave room notification
	| "room-state" // Full room state snapshot
	| "error"; // Error message

/**
 * Base sync message structure
 */
export interface SyncMessage {
	type: SyncMessageType;
	roomId: string;
	timestamp: number;
}

/**
 * Yjs document update message
 */
export interface SyncUpdateMessage extends SyncMessage {
	type: "sync-update";
	/** Binary encoded Yjs update */
	update: Uint8Array;
}

/**
 * Awareness update message
 */
export interface AwarenessMessage extends SyncMessage {
	type: "awareness";
	/** User cursor and selection state */
	awareness: UserCursor;
}

/**
 * Room join request
 */
export interface JoinRoomMessage extends SyncMessage {
	type: "join-room";
	userId: string;
	userName: string;
}

// ============================================================================
// HISTORY TYPES
// ============================================================================

/**
 * History entry for undo/redo
 */
export interface HistoryEntry {
	elements: CanvasElement[];
	appState: Partial<AppState>;
	timestamp: number;
}

/**
 * History state
 */
export interface HistoryState {
	/** Undo stack */
	undoStack: HistoryEntry[];
	/** Redo stack */
	redoStack: HistoryEntry[];
}

// ============================================================================
// COLLABORATION TYPES
// ============================================================================

/**
 * Collaborator information
 */
export interface Collaborator {
	id: string;
	name: string;
	color: string;
	cursor: Point | null;
	selectedElementIds: string[];
	isCurrentUser: boolean;
}

/**
 * Room state
 */
export interface RoomState {
	roomId: string;
	collaborators: Map<string, Collaborator>;
	isConnected: boolean;
	isSynced: boolean;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_ELEMENT_PROPS = {
	strokeColor: "#1e1e1e",
	backgroundColor: "transparent",
	strokeWidth: 2,
	strokeStyle: "solid" as StrokeStyle,
	fillStyle: "solid" as FillStyle,
	opacity: 100,
	roughness: 1,
	angle: 0,
	locked: false,
} as const;

export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_FONT_FAMILY = 1; // Virgil (hand-drawn)

export const COLORS = {
	stroke: ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5"],
	background: [
		"transparent",
		"#ffc9c9",
		"#b2f2bb",
		"#a5d8ff",
		"#ffec99",
		"#eebefa",
	],
} as const;
