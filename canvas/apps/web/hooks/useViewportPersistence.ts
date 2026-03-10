/**
 * ============================================================================
 * LEKHAFLOW - VIEWPORT PERSISTENCE HOOK
 * ============================================================================
 *
 * Persists viewport state (scrollX, scrollY, zoom) to localStorage
 * keyed by roomId, and hydrates on mount to restore the user's
 * camera position across page reloads.
 *
 * Tasks: 4.2.1 (Persist User Viewport Settings)
 *        4.2.2 (Hydrate Camera on Initialization)
 */

"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "../store/canvas-store";

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY_PREFIX = "lekhaflow-viewport-";
const DEBOUNCE_MS = 500;

// ============================================================================
// TYPES
// ============================================================================

interface ViewportData {
	scrollX: number;
	scrollY: number;
	zoom: number;
	timestamp: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function getStorageKey(roomId: string): string {
	return `${STORAGE_KEY_PREFIX}${roomId}`;
}

function loadViewport(roomId: string): ViewportData | null {
	try {
		const raw = localStorage.getItem(getStorageKey(roomId));
		if (!raw) return null;
		const data = JSON.parse(raw) as ViewportData;
		// Basic validation
		if (
			typeof data.scrollX === "number" &&
			typeof data.scrollY === "number" &&
			typeof data.zoom === "number"
		) {
			return data;
		}
		return null;
	} catch {
		return null;
	}
}

function saveViewport(
	roomId: string,
	data: Omit<ViewportData, "timestamp">,
): void {
	try {
		const payload: ViewportData = {
			...data,
			timestamp: Date.now(),
		};
		localStorage.setItem(getStorageKey(roomId), JSON.stringify(payload));
	} catch {
		// localStorage might be full or unavailable — fail silently
	}
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Persists and restores viewport (scroll + zoom) per room.
 *
 * - On mount: reads from localStorage and calls setScroll/setZoom (4.2.2)
 * - On viewport changes: debounce-writes to localStorage (4.2.1)
 *
 * @param roomId - The canvas room identifier used as localStorage key
 */
export function useViewportPersistence(roomId: string): void {
	const { setScroll, setZoom } = useCanvasStore();
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hydratedRef = useRef(false);

	// ─────────────────────────────────────────────────────────────────
	// 4.2.2 — HYDRATE CAMERA ON INITIALIZATION
	// ─────────────────────────────────────────────────────────────────

	useEffect(() => {
		if (!roomId || hydratedRef.current) return;

		// Priority 1: Check URL query params (from share link with viewport)
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			const urlX = params.get("x");
			const urlY = params.get("y");
			const urlZ = params.get("z");

			if (urlX !== null && urlY !== null) {
				const x = parseFloat(urlX);
				const y = parseFloat(urlY);
				const z = urlZ ? parseFloat(urlZ) : 1;

				if (!Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(z)) {
					setScroll(x, y);
					setZoom(z);
					console.log(
						"[Viewport] Hydrated from share URL:",
						`scroll=(${x}, ${y})`,
						`zoom=${z}`,
					);
					hydratedRef.current = true;
					return;
				}
			}
		}

		// Priority 2: Fall back to localStorage
		const saved = loadViewport(roomId);
		if (saved) {
			setScroll(saved.scrollX, saved.scrollY);
			setZoom(saved.zoom);
			console.log(
				"[Viewport] Hydrated from localStorage:",
				`scroll=(${saved.scrollX}, ${saved.scrollY})`,
				`zoom=${saved.zoom}`,
			);
		}

		hydratedRef.current = true;
	}, [roomId, setScroll, setZoom]);

	// ─────────────────────────────────────────────────────────────────
	// 4.2.1 — PERSIST VIEWPORT CHANGES (DEBOUNCED)
	// ─────────────────────────────────────────────────────────────────

	useEffect(() => {
		if (!roomId) return;

		const unsub = useCanvasStore.subscribe(
			(state) => ({
				scrollX: state.scrollX,
				scrollY: state.scrollY,
				zoom: state.zoom,
			}),
			(viewport) => {
				// Skip the initial default values before hydration
				if (!hydratedRef.current) return;

				if (debounceTimerRef.current) {
					clearTimeout(debounceTimerRef.current);
				}

				debounceTimerRef.current = setTimeout(() => {
					saveViewport(roomId, viewport);
				}, DEBOUNCE_MS);
			},
			{
				equalityFn: (a, b) =>
					a.scrollX === b.scrollX &&
					a.scrollY === b.scrollY &&
					a.zoom === b.zoom,
			},
		);

		return () => {
			unsub();
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [roomId]);
}
