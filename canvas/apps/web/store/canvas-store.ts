/**
 * ============================================================================
 * LEKHAFLOW CANVAS STORE
 * ============================================================================
 *
 * Zustand-based state management for the canvas application.
 *
 * LINE-BY-LINE EXPLANATION:
 *
 * WHY ZUSTAND?
 * - Simple, minimal boilerplate
 * - Works great with React and Yjs
 * - No context providers needed
 * - Excellent TypeScript support
 *
 * STORE ARCHITECTURE:
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                         CANVAS STORE                            │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │  Elements State          UI State            Collaborators     │
 * │  ┌─────────────┐        ┌──────────────┐    ┌──────────────┐   │
 * │  │ elements    │        │ activeTool   │    │ collaborators│   │
 * │  │ selectedIds │        │ strokeColor  │    │ isConnected  │   │
 * │  │ history     │        │ bgColor      │    │ isSynced     │   │
 * │  └─────────────┘        └──────────────┘    └──────────────┘   │
 * │                                                                 │
 * │  Actions: addElement, updateElement, deleteElement,            │
 * │           setTool, setColors, undo, redo, etc.                 │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * DATA FLOW:
 * 1. User action (click, drag) triggers store action
 * 2. Action updates Yjs document (NOT React state directly)
 * 3. Yjs broadcasts update to other clients
 * 4. Yjs observer fires, updates React state
 * 5. React re-renders with new state
 *
 * This ensures all clients stay in sync!
 */

import type {
	CanvasElement,
	Collaborator,
	FillStyle,
	Point,
	StrokeStyle,
	Tool,
} from "@repo/common";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

// ============================================================================
// TYPES
// ============================================================================

/**
 * History entry for undo/redo
 */
interface HistoryEntry {
	elements: Map<string, CanvasElement>;
	timestamp: number;
}

/**
 * Activity log entry for the sidebar
 */
export interface ActivityLogEntry {
	id: string;
	timestamp: number;
	userName: string;
	userColor: string;
	action: "added" | "updated" | "deleted";
	elementType: string;
}

/**
 * Saving status for auto-save indicator
 */
export type SavingStatus = "idle" | "saving" | "saved" | "error";

/**
 * Canvas store state
 */
interface CanvasState {
	// ─────────────────────────────────────────────────────────────────
	// ELEMENTS STATE
	// ─────────────────────────────────────────────────────────────────

	/** All elements on the canvas, keyed by ID */
	elements: Map<string, CanvasElement>;

	/** Currently selected element IDs */
	selectedElementIds: Set<string>;

	/** Element being currently edited (e.g., text editing) */
	editingElementId: string | null;

	// ─────────────────────────────────────────────────────────────────
	// HISTORY STATE (for undo/redo)
	// ─────────────────────────────────────────────────────────────────

	/** Undo stack */
	undoStack: HistoryEntry[];

	/** Redo stack */
	redoStack: HistoryEntry[];

	// ─────────────────────────────────────────────────────────────────
	// SAVING STATUS
	// ─────────────────────────────────────────────────────────────────

	/** Current saving status for auto-save indicator */
	savingStatus: SavingStatus;

	// ─────────────────────────────────────────────────────────────────
	// READ-ONLY MODE
	// ─────────────────────────────────────────────────────────────────

	/** Whether the canvas is in read-only (locked) mode */
	isReadOnly: boolean;

	// ─────────────────────────────────────────────────────────────────
	// TOOL STATE
	// ─────────────────────────────────────────────────────────────────

	/** Currently active tool */
	activeTool: Tool;

	/** Current stroke color for new elements */
	currentStrokeColor: string;

	/** Current background color for new elements */
	currentBackgroundColor: string;

	/** Current stroke width */
	currentStrokeWidth: number;

	/** Current stroke style */
	currentStrokeStyle: StrokeStyle;

	/** Current fill style */
	currentFillStyle: FillStyle;

	/** Current opacity (0-100) */
	currentOpacity: number;

	/** Current brush type for freedraw tool */
	currentBrushType: "pencil" | "spray" | "watercolour";

	/** Whether sketch-style (Rough.js) rendering is enabled for new shapes */
	currentRoughEnabled: boolean;

	/** Sloppiness of the sketch effect (0 = clean, 3 = very rough) */
	currentSloppiness: number;

	// ─────────────────────────────────────────────────────────────────
	// VIEWPORT STATE
	// ─────────────────────────────────────────────────────────────────

	/** Scroll offset X */
	scrollX: number;

	/** Scroll offset Y */
	scrollY: number;

	/** Zoom level (1 = 100%) */
	zoom: number;

	// ─────────────────────────────────────────────────────────────────
	// INTERACTION STATE
	// ─────────────────────────────────────────────────────────────────

	/** Whether currently dragging element(s) */
	isDragging: boolean;

	/** Whether currently resizing element(s) */
	isResizing: boolean;

	/** Whether currently drawing a new element */
	isDrawing: boolean;

	/** Resize handle being used */
	resizeHandle: string | null;

	/** Starting point of current interaction */
	interactionStartPoint: Point | null;

	/** Current cursor position */
	cursorPosition: Point | null;

	// ─────────────────────────────────────────────────────────────────
	// COLLABORATION STATE
	// ─────────────────────────────────────────────────────────────────

	/** Other users in the room */
	collaborators: Map<number, Collaborator>;

	/** WebSocket connection status */
	isConnected: boolean;

	/** Whether initial sync is complete */
	isSynced: boolean;

	/** Current room ID */
	roomId: string | null;

	// ─────────────────────────────────────────────────────────────────
	// MY IDENTITY
	// ─────────────────────────────────────────────────────────────────

	/** My user name */
	myName: string;

	/** My user color */
	myColor: string;

	// ─────────────────────────────────────────────────────────────────
	// ACTIVITY LOG STATE
	// ─────────────────────────────────────────────────────────────────

	/** Recent activity log entries (max 50, most-recent first) */
	activityLog: ActivityLogEntry[];

	/** Whether the activity sidebar is open */
	isActivitySidebarOpen: boolean;
}

/**
 * Canvas store actions
 */
interface CanvasActions {
	// ─────────────────────────────────────────────────────────────────
	// ELEMENT ACTIONS
	// ─────────────────────────────────────────────────────────────────

	/** Set all elements (usually from Yjs sync) */
	setElements: (elements: Map<string, CanvasElement>) => void;

	/** Add a new element */
	addElement: (element: CanvasElement) => void;

	/** Update an existing element */
	updateElement: (id: string, updates: Partial<CanvasElement>) => void;

	/** Update multiple elements in a single store update (no intermediate re-renders) */
	batchUpdateElements: (
		updates: Array<{ id: string; updates: Partial<CanvasElement> }>,
	) => void;

	/** Delete elements by IDs */
	deleteElements: (ids: string[]) => void;

	/** Clear all elements */
	clearCanvas: () => void;

	// ─────────────────────────────────────────────────────────────────
	// SELECTION ACTIONS
	// ─────────────────────────────────────────────────────────────────

	/** Set selected element IDs */
	setSelectedElementIds: (ids: Set<string>) => void;

	/** Add to selection */
	addToSelection: (ids: string[]) => void;

	/** Remove from selection */
	removeFromSelection: (ids: string[]) => void;

	/** Clear selection */
	clearSelection: () => void;

	/** Select all elements */
	selectAll: () => void;

	// ─────────────────────────────────────────────────────────────────
	// TOOL ACTIONS
	// ─────────────────────────────────────────────────────────────────

	/** Set active tool */
	setActiveTool: (tool: Tool) => void;

	/** Set stroke color */
	setStrokeColor: (color: string) => void;

	/** Set background color */
	setBackgroundColor: (color: string) => void;

	/** Set stroke width */
	setStrokeWidth: (width: number) => void;

	/** Set stroke style */
	setStrokeStyle: (style: StrokeStyle) => void;

	/** Set fill style */
	setFillStyle: (style: FillStyle) => void;

	/** Set opacity */
	setOpacity: (opacity: number) => void;

	/** Set brush type */
	setBrushType: (brushType: "pencil" | "spray" | "watercolour") => void;

	/** Set rough style enabled */
	setRoughEnabled: (enabled: boolean) => void;

	/** Set sloppiness level */
	setSloppiness: (sloppiness: number) => void;

	// ─────────────────────────────────────────────────────────────────
	// VIEWPORT ACTIONS
	// ─────────────────────────────────────────────────────────────────

	/** Set scroll position */
	setScroll: (x: number, y: number) => void;

	/** Set zoom level */
	setZoom: (zoom: number) => void;

	/** Zoom to fit all elements */
	zoomToFit: () => void;

	/** Reset viewport to default */
	resetViewport: () => void;

	// ─────────────────────────────────────────────────────────────────
	// INTERACTION ACTIONS
	// ─────────────────────────────────────────────────────────────────

	/** Set dragging state */
	setIsDragging: (isDragging: boolean) => void;

	/** Set resizing state */
	setIsResizing: (isResizing: boolean, handle?: string | null) => void;

	/** Set drawing state */
	setIsDrawing: (isDrawing: boolean) => void;

	/** Set interaction start point */
	setInteractionStartPoint: (point: Point | null) => void;

	/** Set cursor position */
	setCursorPosition: (point: Point | null) => void;

	// ─────────────────────────────────────────────────────────────────
	// HISTORY ACTIONS
	// ─────────────────────────────────────────────────────────────────

	/** Push current state to undo stack */
	pushToHistory: () => void;

	/** Undo last action */
	undo: () => void;

	/** Redo last undone action */
	redo: () => void;

	/** Clear history */
	clearHistory: () => void;

	// ─────────────────────────────────────────────────────────────────
	// COLLABORATION ACTIONS
	// ─────────────────────────────────────────────────────────────────

	/** Set collaborators */
	setCollaborators: (collaborators: Map<number, Collaborator>) => void;

	/** Update a single collaborator */
	updateCollaborator: (id: number, updates: Partial<Collaborator>) => void;

	/** Remove a collaborator */
	removeCollaborator: (id: number) => void;

	/** Set connection status */
	setConnectionStatus: (isConnected: boolean, isSynced?: boolean) => void;

	/** Set room ID */
	setRoomId: (roomId: string | null) => void;

	/** Set my identity */
	setMyIdentity: (name: string, color: string) => void;

	/** Set saving status */
	setSavingStatus: (status: SavingStatus) => void;

	/** Toggle read-only (lock) mode */
	setReadOnly: (isReadOnly: boolean) => void;

	// ─────────────────────────────────────────────────────────────────
	// ACTIVITY LOG ACTIONS
	// ─────────────────────────────────────────────────────────────────

	/** Add an activity log entry (prepends, caps at 50) */
	addActivityLogEntry: (entry: ActivityLogEntry) => void;

	/** Toggle the activity sidebar */
	setActivitySidebarOpen: (open: boolean) => void;

	/** Clear the activity log */
	clearActivityLog: () => void;
}

// ============================================================================
// STORE CREATION
// ============================================================================

// Random name and color generators for user identity
const USER_COLORS = [
	"#FF5733",
	"#33FF57",
	"#3357FF",
	"#F033FF",
	"#33FFF5",
	"#FF33A1",
	"#A133FF",
	"#33FFA1",
];

const getRandomColor = () =>
	USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)] || "#FF5733";

/**
 * Initial state values
 */
export const initialState: CanvasState = {
	// Elements
	elements: new Map(),
	selectedElementIds: new Set(),
	editingElementId: null,

	// History
	undoStack: [],
	redoStack: [],

	// Saving
	savingStatus: "idle" as SavingStatus,

	// Read-only mode
	isReadOnly: false,

	// Tool
	activeTool: "selection",
	currentStrokeColor: "#1e1e1e",
	currentBackgroundColor: "transparent",
	currentStrokeWidth: 2,
	currentStrokeStyle: "solid",
	currentFillStyle: "solid",
	currentOpacity: 100,
	currentBrushType: "pencil" as const,
	currentRoughEnabled: false,
	currentSloppiness: 1,

	// Viewport
	scrollX: 0,
	scrollY: 0,
	zoom: 1,

	// Interaction
	isDragging: false,
	isResizing: false,
	isDrawing: false,
	resizeHandle: null,
	interactionStartPoint: null,
	cursorPosition: null,

	// Collaboration
	collaborators: new Map(),
	isConnected: false,
	isSynced: false,
	roomId: null,

	// Identity - set by CanvasAuthWrapper from actual user data
	myName: "User",
	myColor: getRandomColor(),

	// Activity log
	activityLog: [],
	isActivitySidebarOpen: false,
};

/**
 * Create the canvas store
 *
 * Using subscribeWithSelector middleware for efficient subscriptions
 */
export const useCanvasStore = create<CanvasState & CanvasActions>()(
	subscribeWithSelector((set, get) => ({
		...initialState,

		// ─────────────────────────────────────────────────────────────────
		// ELEMENT ACTIONS
		// ─────────────────────────────────────────────────────────────────

		setElements: (elements) => set({ elements }),

		addElement: (element) =>
			set((state) => {
				const newElements = new Map(state.elements);
				newElements.set(element.id, element);
				return { elements: newElements };
			}),

		updateElement: (id, updates) =>
			set((state) => {
				const element = state.elements.get(id);
				if (!element) return state;

				const newElements = new Map(state.elements);
				newElements.set(id, { ...element, ...updates } as CanvasElement);
				return { elements: newElements };
			}),

		batchUpdateElements: (updates) =>
			set((state) => {
				const newElements = new Map(state.elements);
				for (const { id, updates: partial } of updates) {
					const element = newElements.get(id);
					if (element) {
						newElements.set(id, { ...element, ...partial } as CanvasElement);
					}
				}
				return { elements: newElements };
			}),

		deleteElements: (ids) =>
			set((state) => {
				const newElements = new Map(state.elements);
				const newSelection = new Set(state.selectedElementIds);

				for (const id of ids) {
					newElements.delete(id);
					newSelection.delete(id);
				}

				return { elements: newElements, selectedElementIds: newSelection };
			}),

		clearCanvas: () =>
			set({
				elements: new Map(),
				selectedElementIds: new Set(),
			}),

		// ─────────────────────────────────────────────────────────────────
		// SELECTION ACTIONS
		// ─────────────────────────────────────────────────────────────────

		setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),

		addToSelection: (ids) =>
			set((state) => {
				const newSelection = new Set(state.selectedElementIds);
				for (const id of ids) {
					newSelection.add(id);
				}
				return { selectedElementIds: newSelection };
			}),

		removeFromSelection: (ids) =>
			set((state) => {
				const newSelection = new Set(state.selectedElementIds);
				for (const id of ids) {
					newSelection.delete(id);
				}
				return { selectedElementIds: newSelection };
			}),

		clearSelection: () => set({ selectedElementIds: new Set() }),

		selectAll: () =>
			set((state) => ({
				selectedElementIds: new Set(state.elements.keys()),
			})),

		// ─────────────────────────────────────────────────────────────────
		// TOOL ACTIONS
		// ─────────────────────────────────────────────────────────────────

		setActiveTool: (tool) =>
			set({ activeTool: tool, selectedElementIds: new Set() }),
		setStrokeColor: (color) => set({ currentStrokeColor: color }),
		setBackgroundColor: (color) => set({ currentBackgroundColor: color }),
		setStrokeWidth: (width) => set({ currentStrokeWidth: width }),
		setStrokeStyle: (style) => set({ currentStrokeStyle: style }),
		setFillStyle: (style) => set({ currentFillStyle: style }),
		setOpacity: (opacity) => set({ currentOpacity: opacity }),
		setBrushType: (brushType) => set({ currentBrushType: brushType }),
		setRoughEnabled: (enabled) => set({ currentRoughEnabled: enabled }),
		setSloppiness: (sloppiness) =>
			set({ currentSloppiness: Math.max(0, Math.min(3, sloppiness)) }),

		// ─────────────────────────────────────────────────────────────────
		// VIEWPORT ACTIONS
		// ─────────────────────────────────────────────────────────────────

		setScroll: (x, y) => set({ scrollX: x, scrollY: y }),

		setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),

		zoomToFit: () => {
			// TODO: Implement zoom to fit all elements
			set({ zoom: 1, scrollX: 0, scrollY: 0 });
		},

		resetViewport: () => set({ zoom: 1, scrollX: 0, scrollY: 0 }),

		// ─────────────────────────────────────────────────────────────────
		// INTERACTION ACTIONS
		// ─────────────────────────────────────────────────────────────────

		setIsDragging: (isDragging) => set({ isDragging }),

		setIsResizing: (isResizing, handle = null) =>
			set({
				isResizing,
				resizeHandle: handle,
			}),

		setIsDrawing: (isDrawing) => set({ isDrawing }),

		setInteractionStartPoint: (point) => set({ interactionStartPoint: point }),

		setCursorPosition: (point) => set({ cursorPosition: point }),

		// ─────────────────────────────────────────────────────────────────
		// HISTORY ACTIONS
		// ─────────────────────────────────────────────────────────────────

		pushToHistory: () =>
			set((state) => ({
				undoStack: [
					...state.undoStack.slice(-49), // Keep last 50 entries
					{
						elements: new Map(state.elements),
						timestamp: Date.now(),
					},
				],
				redoStack: [], // Clear redo stack on new action
			})),

		undo: () =>
			set((state) => {
				if (state.undoStack.length === 0) return state;

				const lastEntry = state.undoStack[state.undoStack.length - 1];
				if (!lastEntry) return state;

				return {
					elements: lastEntry.elements,
					undoStack: state.undoStack.slice(0, -1),
					redoStack: [
						...state.redoStack,
						{
							elements: new Map(state.elements),
							timestamp: Date.now(),
						},
					],
				};
			}),

		redo: () =>
			set((state) => {
				if (state.redoStack.length === 0) return state;

				const lastEntry = state.redoStack[state.redoStack.length - 1];
				if (!lastEntry) return state;

				return {
					elements: lastEntry.elements,
					redoStack: state.redoStack.slice(0, -1),
					undoStack: [
						...state.undoStack,
						{
							elements: new Map(state.elements),
							timestamp: Date.now(),
						},
					],
				};
			}),

		clearHistory: () => set({ undoStack: [], redoStack: [] }),

		// ─────────────────────────────────────────────────────────────────
		// COLLABORATION ACTIONS
		// ─────────────────────────────────────────────────────────────────

		setCollaborators: (collaborators) => set({ collaborators }),

		updateCollaborator: (id, updates) =>
			set((state) => {
				const collaborator = state.collaborators.get(id);
				if (!collaborator) return state;

				const newCollaborators = new Map(state.collaborators);
				newCollaborators.set(id, { ...collaborator, ...updates });
				return { collaborators: newCollaborators };
			}),

		removeCollaborator: (id) =>
			set((state) => {
				const newCollaborators = new Map(state.collaborators);
				newCollaborators.delete(id);
				return { collaborators: newCollaborators };
			}),

		setConnectionStatus: (isConnected, isSynced) =>
			set((state) => ({
				isConnected,
				isSynced: isSynced ?? state.isSynced,
			})),

		setRoomId: (roomId) => set({ roomId }),

		setMyIdentity: (name, color) => set({ myName: name, myColor: color }),

		setSavingStatus: (status) => set({ savingStatus: status }),

		setReadOnly: (isReadOnly) => {
			// Persist lock state to localStorage per room
			const roomId = get().roomId;
			if (roomId) {
				try {
					localStorage.setItem(
						`lekhaflow-lock-${roomId}`,
						JSON.stringify(isReadOnly),
					);
				} catch {}
			}
			set((state) => ({
				isReadOnly,
				// When entering read-only mode, force hand tool and clear selection
				...(isReadOnly
					? {
							activeTool: "hand" as Tool,
							selectedElementIds: new Set<string>(),
							isDrawing: false,
							isDragging: false,
							isResizing: false,
						}
					: { activeTool: state.activeTool }),
			}));
		},

		// ─────────────────────────────────────────────────────────────────
		// ACTIVITY LOG ACTIONS
		// ─────────────────────────────────────────────────────────────────

		addActivityLogEntry: (entry) =>
			set((state) => ({
				activityLog: [entry, ...state.activityLog].slice(0, 50),
			})),

		setActivitySidebarOpen: (open) => set({ isActivitySidebarOpen: open }),

		clearActivityLog: () => set({ activityLog: [] }),
	})),
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

/**
 * Get selected elements as array
 *
 * useShallow prevents infinite loops by doing shallow comparison
 * of array contents instead of reference equality
 */
export const useSelectedElements = () => {
	return useCanvasStore(
		useShallow((state) => {
			const selected: CanvasElement[] = [];
			for (const id of state.selectedElementIds) {
				const element = state.elements.get(id);
				if (element) selected.push(element);
			}
			return selected;
		}),
	);
};

/**
 * Get elements as array, sorted by zIndex (for correct rendering order)
 *
 * useShallow prevents infinite loops by doing shallow comparison
 * of array contents instead of reference equality
 */
export const useElementsArray = () => {
	return useCanvasStore(
		useShallow((state) =>
			Array.from(state.elements.values()).sort(
				(a, b) => (a.zIndex || 0) - (b.zIndex || 0),
			),
		),
	);
};

/**
 * Get collaborators as array
 *
 * useShallow prevents infinite loops by doing shallow comparison
 */
export const useCollaboratorsArray = () => {
	return useCanvasStore(
		useShallow((state) => Array.from(state.collaborators.values())),
	);
};

/**
 * Check if an element is selected
 */
export const useIsElementSelected = (id: string) => {
	return useCanvasStore((state) => state.selectedElementIds.has(id));
};
