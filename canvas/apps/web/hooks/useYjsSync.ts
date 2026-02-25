/**
 * ============================================================================
 * LEKHAFLOW - YJS SYNC HOOK (HOCUSPOCUS)
 * ============================================================================
 *
 * Core synchronization hook using HocuspocusProvider for authenticated
 * real-time collaboration.
 *
 * ARCHITECTURE:
 * - Uses HocuspocusProvider instead of y-websocket
 * - Requires JWT token for authentication
 * - Connects only when token is available
 */

"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import type { CanvasElement, Collaborator, Point } from "@repo/common";
import { clientEnv } from "@repo/config/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { useCanvasStore } from "../store";

// ============================================================================
// CONFIGURATION
// ============================================================================

const WS_URL = clientEnv.NEXT_PUBLIC_WS_URL;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Awareness state structure
 */
interface AwarenessState {
	user: {
		name: string;
		color: string;
	};
	cursor: Point | null;
	selectedElementIds: string[];
}

/**
 * Return type of the hook
 */
/**
 * Awareness interface for ghost preview broadcasting
 * Matches HocuspocusProvider.awareness API surface
 */
export interface AwarenessInstance {
	clientID: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, callback: (...args: unknown[]) => void) => void;
	off: (event: string, callback: (...args: unknown[]) => void) => void;
}

interface UseYjsSyncReturn {
	doc: Y.Doc;
	provider: HocuspocusProvider | null;
	addElement: (element: CanvasElement) => void;
	updateElement: (id: string, updates: Partial<CanvasElement>) => void;
	deleteElements: (ids: string[]) => void;
	updateCursor: (position: Point | null) => void;
	updateSelection: (ids: string[]) => void;
	getYElements: () => Y.Map<CanvasElement>;
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;
	/** Y.js awareness instance for ghost preview broadcasting */
	awareness: AwarenessInstance | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Yjs sync hook with Hocuspocus authentication
 *
 * @param roomId - Room identifier for collaboration
 * @param token - JWT token for authentication (null = don't connect)
 */
export function useYjsSync(
	roomId: string,
	token: string | null,
): UseYjsSyncReturn {
	// Create stable Y.Doc instance
	const doc = useMemo(() => new Y.Doc(), []);

	// Provider and undo manager refs
	const providerRef = useRef<HocuspocusProvider | null>(null);
	const undoManagerRef = useRef<Y.UndoManager | null>(null);

	// Track undo/redo capability
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);

	// Get store actions
	const {
		setElements,
		setCollaborators,
		setConnectionStatus,
		setRoomId,
		setSavingStatus,
		myName,
		myColor,
	} = useCanvasStore();

	// Use refs for identity to avoid reconnection loops when identity changes
	const myNameRef = useRef(myName);
	const myColorRef = useRef(myColor);
	const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Keep refs in sync and update awareness when identity changes
	useEffect(() => {
		myNameRef.current = myName;
		myColorRef.current = myColor;

		// Update awareness on existing provider without reconnecting
		if (providerRef.current?.awareness) {
			providerRef.current.awareness.setLocalStateField("user", {
				name: myName,
				color: myColor,
			});
		}
	}, [myName, myColor]);

	// ─────────────────────────────────────────────────────────────────
	// GET SHARED DATA STRUCTURES
	// ─────────────────────────────────────────────────────────────────

	const getYElements = useCallback((): Y.Map<CanvasElement> => {
		return doc.getMap<CanvasElement>("elements");
	}, [doc]);

	// ─────────────────────────────────────────────────────────────────
	// CONNECT TO SERVER
	// ─────────────────────────────────────────────────────────────────

	useEffect(() => {
		// Don't connect without token
		if (!token) {
			console.log("[Hocuspocus] No token provided, skipping connection");
			setConnectionStatus(false, false);
			return;
		}

		console.log(
			"[Hocuspocus] Attempting to connect with token:",
			`${token.substring(0, 20)}...`,
		);

		// Create HocuspocusProvider
		const provider = new HocuspocusProvider({
			url: WS_URL,
			name: roomId,
			document: doc,
			token,
			onConnect: () => {
				console.log("[Hocuspocus] Connected to", roomId);
				setConnectionStatus(true, false);
			},
			onSynced: () => {
				console.log("[Hocuspocus] Synced");
				setConnectionStatus(true, true);
				setSavingStatus("saved");

				// Set local awareness state using refs (not reactive values)
				provider.awareness?.setLocalStateField("user", {
					name: myNameRef.current,
					color: myColorRef.current,
				});
			},
			onDisconnect: () => {
				console.log("[Hocuspocus] Disconnected");
				setConnectionStatus(false, false);
				setSavingStatus("error");
			},
			onAuthenticationFailed: (data: { reason: string }) => {
				console.error("[Hocuspocus] Auth failed:", data.reason);
				console.error(
					"[Hocuspocus] Token used:",
					`${token.substring(0, 20)}...`,
				);
				console.error("[Hocuspocus] WS URL:", WS_URL);
				console.error("[Hocuspocus] Room ID:", roomId);
				setConnectionStatus(false, false);
			},
		});

		providerRef.current = provider;
		setRoomId(roomId);

		// Get shared elements map
		const yElements = getYElements();

		// Set up undo manager
		undoManagerRef.current = new Y.UndoManager(yElements, {
			captureTimeout: 500,
		});

		// Update undo/redo state
		const updateUndoState = () => {
			setCanUndo(undoManagerRef.current?.canUndo() ?? false);
			setCanRedo(undoManagerRef.current?.canRedo() ?? false);
		};

		undoManagerRef.current.on("stack-item-added", updateUndoState);
		undoManagerRef.current.on("stack-item-popped", updateUndoState);

		// ─────────────────────────────────────────────────────────────────
		// ELEMENT OBSERVER
		// ─────────────────────────────────────────────────────────────────

		const handleElementsChange = () => {
			const elementsObj = yElements.toJSON() as Record<string, CanvasElement>;
			const elementsMap = new Map<string, CanvasElement>();

			for (const [id, element] of Object.entries(elementsObj)) {
				if (!element.isDeleted) {
					elementsMap.set(id, element);
				}
			}

			setElements(elementsMap);

			// Track saving status: mark as "saving" when changes occur,
			// then "saved" after the debounce period (matches ws-backend's 3s debounce)
			if (providerRef.current) {
				setSavingStatus("saving");
				if (savedTimerRef.current) {
					clearTimeout(savedTimerRef.current);
				}
				savedTimerRef.current = setTimeout(() => {
					setSavingStatus("saved");
				}, 4000); // slightly longer than server debounce (3s) to account for network
			}
		};

		yElements.observe(handleElementsChange);
		handleElementsChange();

		// ─────────────────────────────────────────────────────────────────
		// AWARENESS OBSERVER
		// ─────────────────────────────────────────────────────────────────

		const handleAwarenessChange = () => {
			if (!provider.awareness) return;

			const states = provider.awareness.getStates();
			const collaborators = new Map<number, Collaborator>();

			states.forEach((state: unknown, clientId: number) => {
				if (clientId === doc.clientID) return;

				const awarenessState = state as AwarenessState | undefined;
				if (!awarenessState?.user?.name) return;

				collaborators.set(clientId, {
					id: String(clientId),
					name: awarenessState.user.name,
					color: awarenessState.user.color,
					cursor: awarenessState.cursor,
					selectedElementIds: awarenessState.selectedElementIds || [],
					isCurrentUser: false,
				});
			});

			setCollaborators(collaborators);
		};

		provider.awareness?.on("change", handleAwarenessChange);
		handleAwarenessChange();

		// ─────────────────────────────────────────────────────────────────
		// CLEANUP
		// ─────────────────────────────────────────────────────────────────

		return () => {
			yElements.unobserve(handleElementsChange);
			provider.awareness?.off("change", handleAwarenessChange);

			undoManagerRef.current?.destroy();
			undoManagerRef.current = null;

			if (savedTimerRef.current) {
				clearTimeout(savedTimerRef.current);
				savedTimerRef.current = null;
			}

			provider.disconnect();
			provider.destroy();
			providerRef.current = null;

			setConnectionStatus(false, false);
			setSavingStatus("idle");
			setRoomId(null);
		};
	}, [
		roomId,
		token,
		doc,
		setElements,
		setCollaborators,
		setConnectionStatus,
		setRoomId,
		setSavingStatus,
		getYElements,
	]);

	// ─────────────────────────────────────────────────────────────────
	// MUTATION FUNCTIONS
	// ─────────────────────────────────────────────────────────────────

	const addElement = useCallback(
		(element: CanvasElement) => {
			const yElements = getYElements();
			doc.transact(() => {
				yElements.set(element.id, element);
			});
		},
		[doc, getYElements],
	);

	const updateElement = useCallback(
		(id: string, updates: Partial<CanvasElement>) => {
			const yElements = getYElements();
			const existing = yElements.get(id);

			if (!existing) {
				console.warn(`Element ${id} not found for update`);
				return;
			}

			doc.transact(() => {
				const newVersion = (existing.version || 0) + 1;
				yElements.set(id, {
					...existing,
					...updates,
					version: newVersion,
					updated: Date.now(),
				} as CanvasElement);
			});
		},
		[doc, getYElements],
	);

	const deleteElements = useCallback(
		(ids: string[]) => {
			const yElements = getYElements();

			doc.transact(() => {
				for (const id of ids) {
					const existing = yElements.get(id);
					if (existing) {
						yElements.set(id, {
							...existing,
							isDeleted: true,
							version: (existing.version || 0) + 1,
							updated: Date.now(),
						} as CanvasElement);
					}
				}
			});
		},
		[doc, getYElements],
	);

	const updateCursor = useCallback((position: Point | null) => {
		const provider = providerRef.current;
		if (!provider?.awareness) return;
		provider.awareness.setLocalStateField("cursor", position);
	}, []);

	const updateSelection = useCallback((ids: string[]) => {
		const provider = providerRef.current;
		if (!provider?.awareness) return;
		provider.awareness.setLocalStateField("selectedElementIds", ids);
	}, []);

	const undo = useCallback(() => {
		undoManagerRef.current?.undo();
	}, []);

	const redo = useCallback(() => {
		undoManagerRef.current?.redo();
	}, []);

	// ─────────────────────────────────────────────────────────────────
	// RETURN API
	// ─────────────────────────────────────────────────────────────────

	return {
		doc,
		provider: providerRef.current,
		addElement,
		updateElement,
		deleteElements,
		updateCursor,
		updateSelection,
		getYElements,
		undo,
		redo,
		canUndo,
		canRedo,
		awareness: (providerRef.current?.awareness as AwarenessInstance) ?? null,
	};
}
