/**
 * ============================================================================
 * LEKHAFLOW - GHOST PREVIEW HOOK
 * ============================================================================
 *
 * Manages live collaborative ghost stroke previews via Y.js awareness protocol.
 *
 * KEY DESIGN DECISIONS:
 * - Uses awareness protocol (NOT Y.Doc) → no document writes until commit
 * - Throttled broadcasts (~60fps) to avoid flooding the network
 * - Stale ghost cleanup handles disconnected clients
 * - Completely isolated from zIndex, selection, rotation systems
 *
 * DATA FLOW:
 * 1. Local user draws → broadcastGhost() sends preview via awareness
 * 2. Remote users receive awareness change → remoteGhosts[] updated
 * 3. GhostLayer renders translucent previews
 * 4. On mouseup → clearGhost() removes preview, real shape committed to Y.Doc
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Ghost Preview Data Structure
 * Broadcast via Y.js awareness (NOT Y.Doc)
 * Lightweight — only contains rendering-critical fields
 */
export interface GhostPreview {
	/** Element type being drawn */
	type:
		| "rectangle"
		| "ellipse"
		| "diamond"
		| "line"
		| "arrow"
		| "freedraw"
		| "freehand";
	/** Starting x coordinate (canvas space) */
	x: number;
	/** Starting y coordinate (canvas space) */
	y: number;
	/** Current width (for shapes) */
	width: number;
	/** Current height (for shapes) */
	height: number;
	/** Flat points array [x,y,x,y,...] for line/arrow/freedraw/freehand */
	points: number[];
	/** Stroke color */
	strokeColor: string;
	/** Stroke width */
	strokeWidth: number;
	/** Fill color (for shapes) */
	fillColor: string;
	/** Stroke style */
	strokeStyle: "solid" | "dashed" | "dotted";
	/** Client display name */
	clientName: string;
	/** Client color tint for ghost differentiation */
	clientColor: string;
	/** Timestamp for staleness detection */
	timestamp: number;
}

/** Remote ghost with client ID attached */
export interface RemoteGhost {
	clientId: number;
	preview: GhostPreview;
}

/**
 * Awareness interface matching HocuspocusProvider.awareness
 * Using structural typing to avoid import coupling
 */
interface AwarenessLike {
	clientID: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, callback: (...args: unknown[]) => void) => void;
	off: (event: string, callback: (...args: unknown[]) => void) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Throttle interval for awareness updates (ms) - ~60fps cap */
const THROTTLE_MS = 16;

/** Stale ghost timeout (ms) - remove ghosts older than this */
const STALE_TIMEOUT = 5000;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook: useGhostPreviews
 *
 * Manages ghost stroke previews via Y.js awareness protocol.
 *
 * @param awareness - HocuspocusProvider awareness instance (null when not connected)
 * @returns { remoteGhosts, broadcastGhost, clearGhost }
 */
export function useGhostPreviews(awareness: AwarenessLike | null) {
	const [remoteGhosts, setRemoteGhosts] = useState<RemoteGhost[]>([]);
	const lastBroadcastRef = useRef<number>(0);
	const staleCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// ─────────────────────────────────────────────────────────────────
	// BROADCAST: Send local drawing preview to remote users
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Broadcast local ghost preview via awareness
	 * Throttled to THROTTLE_MS to avoid flooding the network
	 */
	const broadcastGhost = useCallback(
		(preview: Omit<GhostPreview, "timestamp">) => {
			if (!awareness) return;

			const now = Date.now();
			if (now - lastBroadcastRef.current < THROTTLE_MS) return;
			lastBroadcastRef.current = now;

			awareness.setLocalStateField("drawingPreview", {
				...preview,
				timestamp: now,
			});
		},
		[awareness],
	);

	// ─────────────────────────────────────────────────────────────────
	// CLEAR: Remove local ghost preview from awareness
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Clear local ghost preview from awareness
	 * Called on mouseup, tool switch, or drawing cancel
	 */
	const clearGhost = useCallback(() => {
		if (!awareness) return;
		awareness.setLocalStateField("drawingPreview", null);
	}, [awareness]);

	// ─────────────────────────────────────────────────────────────────
	// SUBSCRIBE: Listen for remote users' drawing previews
	// ─────────────────────────────────────────────────────────────────

	useEffect(() => {
		if (!awareness) return;

		const handleAwarenessChange = () => {
			const states = awareness.getStates();
			const ghosts: RemoteGhost[] = [];
			const localId = awareness.clientID;

			states.forEach((state, clientId) => {
				// Skip local client — we render our own drawingElement directly
				if (clientId === localId) return;

				if (state.drawingPreview) {
					ghosts.push({
						clientId,
						preview: state.drawingPreview as GhostPreview,
					});
				}
			});

			setRemoteGhosts(ghosts);
		};

		awareness.on("change", handleAwarenessChange);

		// Initial read in case there are already active ghosts
		handleAwarenessChange();

		return () => {
			awareness.off("change", handleAwarenessChange);
		};
	}, [awareness]);

	// ─────────────────────────────────────────────────────────────────
	// CLEANUP: Remove stale ghosts from disconnected clients
	// ─────────────────────────────────────────────────────────────────

	useEffect(() => {
		staleCleanupRef.current = setInterval(() => {
			const now = Date.now();
			setRemoteGhosts((prev) =>
				prev.filter((ghost) => now - ghost.preview.timestamp < STALE_TIMEOUT),
			);
		}, STALE_TIMEOUT);

		return () => {
			if (staleCleanupRef.current) {
				clearInterval(staleCleanupRef.current);
			}
		};
	}, []);

	return {
		remoteGhosts,
		broadcastGhost,
		clearGhost,
	};
}
