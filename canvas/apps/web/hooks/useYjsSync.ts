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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { ensureTextRuns } from "../lib/text-runs";
import { useCanvasStore } from "../store";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Use process.env directly so Next.js substitutes values from apps/web/.env.
// @repo/config/client does NOT receive NEXT_PUBLIC_* from the app's .env.
const WS_URL =
	process.env.NEXT_PUBLIC_WS_URL ?? "wss://lekhaflow.rishiikesh.me/ws";

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
	/** Element currently being text-edited by this user */
	editingElementId: string | null;
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
	updateElements: (updatesMap: Map<string, Partial<CanvasElement>>) => void;
	batchUpdateElements: (
		updates: Array<{ id: string; updates: Partial<CanvasElement> }>,
	) => void;
	deleteElements: (ids: string[]) => void;
	updateCursor: (position: Point | null) => void;
	updateSelection: (ids: string[]) => void;
	updateEditingElement: (id: string | null) => void;
	getYElements: () => Y.Map<CanvasElement>;
	getYSettings: () => Y.Map<unknown>;
	restoreVersion: (snapshot: Record<string, CanvasElement>) => void;
	updateSettings: (updates: Record<string, unknown>) => void;
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
		addActivityLogEntry,
		setCanvasBackgroundColor,
		setGridMode,
		myName,
		myColor,
	} = useCanvasStore();

	// Use refs for identity to avoid reconnection loops when identity changes
	const myNameRef = useRef(myName);
	const myColorRef = useRef(myColor);
	const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hasSyncedRef = useRef(false);

	// Store token in a ref so provider reconnection only happens on roomId change
	const tokenRef = useRef(token);
	useEffect(() => {
		tokenRef.current = token;
	}, [token]);

	// Boolean flag: only triggers effect when token goes from null → non-null
	const hasToken = !!token;

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

	const getYSettings = useCallback((): Y.Map<unknown> => {
		return doc.getMap<unknown>("settings");
	}, [doc]);

	// ─────────────────────────────────────────────────────────────────
	// CONNECT TO SERVER
	// ─────────────────────────────────────────────────────────────────

	useEffect(() => {
		// Don't connect without token
		if (!hasToken || !tokenRef.current) {
			console.log("[Hocuspocus] No token provided, skipping connection");
			setConnectionStatus(false, false);
			return;
		}

		// Read token from ref (avoids re-triggering effect on token refresh)
		const initialToken = tokenRef.current;

		console.log(
			"[Hocuspocus] Attempting to connect with token:",
			`${initialToken.substring(0, 20)}...`,
		);

		// Get shared elements map (before provider so we can use it in callbacks)
		const yElements = getYElements();

		// Helper to read Y.Map state and push to store
		const syncElementsToStore = () => {
			const elementsObj = yElements.toJSON() as Record<string, CanvasElement>;
			const elementsMap = new Map<string, CanvasElement>();

			for (const [id, element] of Object.entries(elementsObj)) {
				if (!element.isDeleted) {
					elementsMap.set(id, element);
				}
			}

			setElements(elementsMap);
		};

		// Create HocuspocusProvider
		const provider = new HocuspocusProvider({
			url: WS_URL,
			name: roomId,
			document: doc,
			token: initialToken,
			onConnect: () => {
				console.log("[Hocuspocus] Connected to", roomId);
				setConnectionStatus(true, false);
			},
			onSynced: () => {
				console.log("[Hocuspocus] Synced");
				setConnectionStatus(true, true);
				setSavingStatus("saved");
				hasSyncedRef.current = true;

				// CRITICAL: Re-read elements after sync to ensure store has
				// the full server state.
				syncElementsToStore();

				// Delayed re-read to catch any async update processing
				setTimeout(() => {
					console.log("[Hocuspocus] Delayed post-sync re-read");
					syncElementsToStore();
				}, 300);

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
					`${initialToken.substring(0, 20)}...`,
				);
				console.error("[Hocuspocus] WS URL:", WS_URL);
				console.error("[Hocuspocus] Room ID:", roomId);
				setConnectionStatus(false, false);
			},
		});

		const ySettings = getYSettings();

		// Helper to read Y.Map settings and push to store
		const syncSettingsToStore = () => {
			const settings = ySettings.toJSON();
			const currentState = useCanvasStore.getState();

			if (
				settings.backgroundColor &&
				settings.backgroundColor !== currentState.canvasBackgroundColor
			) {
				setCanvasBackgroundColor(settings.backgroundColor as string);
			}
			if (
				settings.gridMode &&
				settings.gridMode !== currentState.activeGridMode
			) {
				setGridMode(settings.gridMode as "none" | "grid" | "dots");
			}
		};

		providerRef.current = provider;
		setRoomId(roomId);

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

		// Helper: convert element type to human-readable label
		const formatElementType = (type: string): string => {
			const labels: Record<string, string> = {
				rectangle: "Rectangle",
				ellipse: "Ellipse",
				diamond: "Diamond",
				line: "Line",
				arrow: "Arrow",
				freedraw: "Drawing",
				text: "Text",
			};
			return labels[type] || type;
		};

		const handleElementsChange = (event?: Y.YMapEvent<CanvasElement>) => {
			// Sync Y.Map state to the Zustand store
			syncElementsToStore();
			const elementsObj = yElements.toJSON() as Record<string, CanvasElement>;
			const elementsMap = new Map<string, CanvasElement>();

			for (const [id, element] of Object.entries(elementsObj)) {
				if (!element.isDeleted) {
					// Migrate legacy text elements to runs model
					elementsMap.set(id, ensureTextRuns(element));
				}
			}

			setElements(elementsMap);

			// ── Generate activity log entries from the Y.Map event ──
			if (event && hasSyncedRef.current) {
				event.changes.keys.forEach((change, key) => {
					// Determine user name/color — use awareness for remote,
					// fall back to local identity
					let userName = myNameRef.current;
					let userColor = myColorRef.current;

					// Check if the change came from a remote client
					if (
						event.transaction.origin !== null &&
						providerRef.current?.awareness
					) {
						const states = providerRef.current.awareness.getStates();
						// Find the first remote user (heuristic: last writer wins visually)
						states.forEach((state: unknown, clientId: number) => {
							if (clientId === doc.clientID) return;
							const s = state as
								| { user?: { name: string; color: string } }
								| undefined;
							if (s?.user?.name) {
								userName = s.user.name;
								userColor = s.user.color;
							}
						});
					}

					const element = yElements.get(key);
					const elementType = element
						? formatElementType(element.type)
						: "Element";

					let action: "added" | "updated" | "deleted";
					if (change.action === "add") {
						action = "added";
					} else if (change.action === "update") {
						// If update made it "isDeleted", treat as deleted
						action = element?.isDeleted ? "deleted" : "updated";
					} else {
						action = "deleted";
					}

					addActivityLogEntry({
						id: `${key}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
						timestamp: Date.now(),
						userName,
						userColor,
						action,
						elementType,
					});
				});
			}

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
		// Initial load — call without event so no logs are generated
		handleElementsChange();

		const handleSettingsChange = () => {
			syncSettingsToStore();
		};
		ySettings.observe(handleSettingsChange);
		syncSettingsToStore();

		// After initial hydration, allow future changes to be logged
		hasSyncedRef.current = true;

		// ─────────────────────────────────────────────────────────────────
		// DOCUMENT UPDATE LISTENER (catches ALL Y.Doc mutations)
		// The Y.Map observer only fires for direct Y.Map operations.
		// When HocuspocusProvider applies remote sync updates via
		// Y.applyUpdate(), the internal origin varies by version, so
		// we unconditionally re-read the Y.Map on every update.
		// This is idempotent and ensures the store always matches Y.Doc.
		// ─────────────────────────────────────────────────────────────────
		const handleDocUpdate = () => {
			syncElementsToStore();
		};
		doc.on("update", handleDocUpdate);

		// ─────────────────────────────────────────────────────────────────
		// PROVIDER SYNCED LISTENER (additional safety for initial load)
		// Fires when the provider finishes exchanging state vectors with
		// the server. Re-read elements after a short delay to handle
		// any race conditions with Y.applyUpdate processing.
		// ─────────────────────────────────────────────────────────────────
		const handleProviderSynced = () => {
			console.log("[Hocuspocus] Provider 'synced' event fired");
			syncElementsToStore();
			// Delayed re-read as a safety net for async update application
			setTimeout(() => {
				syncElementsToStore();
			}, 500);
		};
		provider.on("synced", handleProviderSynced);

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
			ySettings.unobserve(handleSettingsChange);
			doc.off("update", handleDocUpdate);
			provider.off("synced", handleProviderSynced);
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
		hasToken,
		doc,
		setElements,
		setCollaborators,
		setConnectionStatus,
		setRoomId,
		setSavingStatus,
		addActivityLogEntry,
		getYElements,
		getYSettings,
		setCanvasBackgroundColor,
		setGridMode,
	]);

	// ─────────────────────────────────────────────────────────────────
	// MUTATION FUNCTIONS
	// ─────────────────────────────────────────────────────────────────

	const addElement = useCallback(
		(element: CanvasElement) => {
			const yElements = getYElements();
			doc.transact(() => {
				const enrichedElement = {
					...element,
					createdBy: element.createdBy || myNameRef.current,
					lastModifiedBy: element.lastModifiedBy || myNameRef.current,
				};
				yElements.set(enrichedElement.id, enrichedElement as CanvasElement);
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
					lastModifiedBy: myNameRef.current,
					version: newVersion,
					updated: Date.now(),
				} as CanvasElement);
			});
		},
		[doc, getYElements],
	);

	const updateElements = useCallback(
		(updatesMap: Map<string, Partial<CanvasElement>>) => {
			const yElements = getYElements();

			doc.transact(() => {
				for (const [id, updates] of updatesMap.entries()) {
					const existing = yElements.get(id);
					if (existing) {
						const newVersion = (existing.version || 0) + 1;
						yElements.set(id, {
							...existing,
							...updates,
							lastModifiedBy: myNameRef.current,
							version: newVersion,
							updated: Date.now(),
						} as CanvasElement);
					}
				}
			});
		},
		[doc, getYElements],
	);

	const batchUpdateElements = useCallback(
		(updates: Array<{ id: string; updates: Partial<CanvasElement> }>) => {
			const yElements = getYElements();
			const now = Date.now();
			doc.transact(() => {
				for (const { id, updates: partial } of updates) {
					const existing = yElements.get(id);
					if (!existing) continue;
					yElements.set(id, {
						...existing,
						...partial,
						lastModifiedBy: myNameRef.current,
						version: (existing.version || 0) + 1,
						updated: now,
					} as CanvasElement);
				}
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

	/** Broadcast which element the local user is currently editing (text). */
	const updateEditingElement = useCallback((id: string | null) => {
		const provider = providerRef.current;
		if (!provider?.awareness) return;
		provider.awareness.setLocalStateField("editingElementId", id);
	}, []);

	/**
	 * Restore canvas to a saved version snapshot.
	 * Performs a "hard reset": deletes all current elements and recreates
	 * from the snapshot in a single Yjs transaction.
	 * This automatically propagates to all connected clients.
	 */
	const restoreVersion = useCallback(
		(snapshot: Record<string, CanvasElement>) => {
			const yElements = getYElements();

			doc.transact(() => {
				// Phase 1: Delete all existing elements
				const existingKeys = Array.from(yElements.keys());
				for (const key of existingKeys) {
					yElements.delete(key);
				}

				// Phase 2: Recreate all elements from snapshot
				for (const [id, element] of Object.entries(snapshot)) {
					if (!element.isDeleted) {
						yElements.set(id, element);
					}
				}
			});

			console.log(
				"[Yjs] Version restored:",
				Object.keys(snapshot).length,
				"elements",
			);
		},
		[doc, getYElements],
	);

	const updateSettings = useCallback(
		(updates: Record<string, unknown>) => {
			const ySettings = getYSettings();
			doc.transact(() => {
				for (const [key, value] of Object.entries(updates)) {
					ySettings.set(key, value);
				}
			});
		},
		[doc, getYSettings],
	);

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
		updateElements,
		batchUpdateElements,
		deleteElements,
		updateCursor,
		updateSelection,
		updateEditingElement,
		getYElements,
		getYSettings,
		restoreVersion,
		updateSettings,
		undo,
		redo,
		canUndo,
		canRedo,
		awareness: (providerRef.current?.awareness as AwarenessInstance) ?? null,
	};
}
