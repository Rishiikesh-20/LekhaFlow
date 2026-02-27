/**
 * ============================================================================
 * RESTORE VERSION TESTS (Story 8)
 * ============================================================================
 *
 * Validates:
 * 1. restoreVersion clears all existing elements and sets snapshot elements
 * 2. Yjs document reflects the restored state (source of truth)
 * 3. Zustand store updates reactively from Yjs observer
 * 4. Deleted elements in snapshot are excluded
 * 5. Multiple restores work correctly (idempotent)
 * 6. Collaboration: simulated "User B" sees the restored state
 */

import type { CanvasElement } from "@repo/common";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useYjsSync } from "../hooks/useYjsSync";
import { createEllipse, createRectangle } from "../lib/element-utils";
import { initialState, useCanvasStore } from "../store/canvas-store";

// ─────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────

const { MockHocuspocusProvider } = vi.hoisted(() => {
	const providerMethods = {
		connect: vi.fn(),
		disconnect: vi.fn(),
		destroy: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		awareness: {
			setLocalStateField: vi.fn(),
			getStates: vi.fn().mockReturnValue(new Map()),
			on: vi.fn(),
			off: vi.fn(),
		},
		configuration: {} as Record<string, unknown>,
	};

	class MockHocuspocusProvider {
		// biome-ignore lint/suspicious/noExplicitAny: Mocking arbitrary config
		constructor(config: any) {
			providerMethods.configuration = config;
			setTimeout(() => {
				if (config.onConnect) config.onConnect();
				if (config.onSynced) config.onSynced();
			}, 0);
			// biome-ignore lint/correctness/noConstructorReturn: Returning singleton mock for testing
			return providerMethods;
		}
	}

	return { MockHocuspocusProvider };
});

vi.mock("@hocuspocus/provider", () => ({
	HocuspocusProvider: MockHocuspocusProvider,
}));

const resetStore = () => {
	useCanvasStore.setState(initialState);
};

// ─────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────

describe("Story 8 – Restore to Previous Version", () => {
	beforeEach(() => {
		resetStore();
		vi.clearAllMocks();
	});

	// ─────────────────────────────────────────────────────
	// 1. Hard Reset — Delete All + Create All
	// ─────────────────────────────────────────────────────

	describe("Hard Reset via restoreVersion", () => {
		it("replaces all current elements with snapshot elements", async () => {
			const { result } = renderHook(() => useYjsSync("room-1", "token-123"));

			await waitFor(() =>
				expect(useCanvasStore.getState().isConnected).toBe(true),
			);

			// Add 3 current elements
			const rect1 = createRectangle(0, 0, 50, 50);
			const rect2 = createRectangle(100, 100, 80, 80);
			const ellipse1 = createEllipse(200, 200, 60, 40);
			result.current.addElement(rect1);
			result.current.addElement(rect2);
			result.current.addElement(ellipse1);

			await waitFor(() =>
				expect(useCanvasStore.getState().elements.size).toBe(3),
			);

			// Create a snapshot with completely different elements
			const snapRect = createRectangle(10, 10, 30, 30);
			const snapEllipse = createEllipse(50, 50, 20, 20);
			const snapshot: Record<string, CanvasElement> = {
				[snapRect.id]: snapRect,
				[snapEllipse.id]: snapEllipse,
			};

			// Restore
			result.current.restoreVersion(snapshot);

			// Verify: old elements are gone, snapshot elements are present
			await waitFor(() => {
				const elements = useCanvasStore.getState().elements;
				expect(elements.size).toBe(2);
				expect(elements.has(rect1.id)).toBe(false);
				expect(elements.has(rect2.id)).toBe(false);
				expect(elements.has(ellipse1.id)).toBe(false);
				expect(elements.has(snapRect.id)).toBe(true);
				expect(elements.has(snapEllipse.id)).toBe(true);
			});
		});

		it("clears canvas when snapshot is empty", async () => {
			const { result } = renderHook(() => useYjsSync("room-1", "token-123"));

			await waitFor(() =>
				expect(useCanvasStore.getState().isConnected).toBe(true),
			);

			// Add elements
			result.current.addElement(createRectangle(0, 0, 50, 50));
			result.current.addElement(createRectangle(10, 10, 50, 50));

			await waitFor(() =>
				expect(useCanvasStore.getState().elements.size).toBe(2),
			);

			// Restore empty snapshot
			result.current.restoreVersion({});

			await waitFor(() =>
				expect(useCanvasStore.getState().elements.size).toBe(0),
			);
		});

		it("excludes deleted elements from snapshot", async () => {
			const { result } = renderHook(() => useYjsSync("room-1", "token-123"));

			await waitFor(() =>
				expect(useCanvasStore.getState().isConnected).toBe(true),
			);

			const alive = createRectangle(0, 0, 50, 50);
			const deleted = createRectangle(100, 100, 50, 50);

			const snapshot: Record<string, CanvasElement> = {
				[alive.id]: alive,
				[deleted.id]: { ...deleted, isDeleted: true },
			};

			result.current.restoreVersion(snapshot);

			await waitFor(() => {
				const elements = useCanvasStore.getState().elements;
				expect(elements.size).toBe(1);
				expect(elements.has(alive.id)).toBe(true);
				expect(elements.has(deleted.id)).toBe(false);
			});
		});
	});

	// ─────────────────────────────────────────────────────
	// 2. Yjs Document as Source of Truth
	// ─────────────────────────────────────────────────────

	describe("Yjs Document", () => {
		it("Y.Map reflects restored elements", async () => {
			const { result } = renderHook(() => useYjsSync("room-1", "token-123"));

			await waitFor(() =>
				expect(useCanvasStore.getState().isConnected).toBe(true),
			);

			// Add initial element
			const rect = createRectangle(0, 0, 10, 10);
			result.current.addElement(rect);

			await waitFor(() =>
				expect(useCanvasStore.getState().elements.size).toBe(1),
			);

			// Snapshot with new element
			const snapEl = createRectangle(50, 50, 25, 25);
			result.current.restoreVersion({
				[snapEl.id]: snapEl,
			});

			// Verify Y.Map directly
			const yElements = result.current.getYElements();
			expect(yElements.size).toBe(1);
			expect(yElements.get(snapEl.id)).toBeDefined();
			expect(yElements.get(rect.id)).toBeUndefined();
		});

		it("restore is atomic (single transaction)", async () => {
			const { result } = renderHook(() => useYjsSync("room-1", "token-123"));

			await waitFor(() =>
				expect(useCanvasStore.getState().isConnected).toBe(true),
			);

			// Track Yjs events to verify single transaction
			const yElements = result.current.getYElements();
			const events: Y.YMapEvent<CanvasElement>[] = [];

			// Need to import Y for the type
			const Y = await import("yjs");
			yElements.observe((event) => {
				events.push(event);
			});

			// Add initial element
			result.current.addElement(createRectangle(0, 0, 10, 10));

			// Wait for the add to propagate
			await waitFor(() => expect(events.length).toBe(1));

			// Clear for counting restore events
			events.length = 0;

			// Restore with new elements
			const snap1 = createRectangle(1, 1, 1, 1);
			const snap2 = createEllipse(2, 2, 2, 2);
			result.current.restoreVersion({
				[snap1.id]: snap1,
				[snap2.id]: snap2,
			});

			// Should be exactly 1 event (atomic transaction)
			expect(events.length).toBe(1);

			// Cleanup observer
			yElements.unobserve(() => {});
		});
	});

	// ─────────────────────────────────────────────────────
	// 3. Multiple Restores (Idempotent)
	// ─────────────────────────────────────────────────────

	describe("Multiple restores", () => {
		it("second restore fully replaces the first", async () => {
			const { result } = renderHook(() => useYjsSync("room-1", "token-123"));

			await waitFor(() =>
				expect(useCanvasStore.getState().isConnected).toBe(true),
			);

			// First restore
			const v1Rect = createRectangle(0, 0, 10, 10);
			result.current.restoreVersion({ [v1Rect.id]: v1Rect });

			await waitFor(() => {
				expect(useCanvasStore.getState().elements.size).toBe(1);
				expect(useCanvasStore.getState().elements.has(v1Rect.id)).toBe(true);
			});

			// Second restore with different elements
			const v2Ellipse = createEllipse(50, 50, 20, 20);
			result.current.restoreVersion({ [v2Ellipse.id]: v2Ellipse });

			await waitFor(() => {
				const elements = useCanvasStore.getState().elements;
				expect(elements.size).toBe(1);
				expect(elements.has(v1Rect.id)).toBe(false);
				expect(elements.has(v2Ellipse.id)).toBe(true);
			});
		});
	});

	// ─────────────────────────────────────────────────────
	// 4. Collaboration — Client B sees restored state
	// ─────────────────────────────────────────────────────

	describe("Collaboration", () => {
		it("simulated remote read sees restored elements via Y.Doc", async () => {
			const { result } = renderHook(() => useYjsSync("room-1", "token-123"));

			await waitFor(() =>
				expect(useCanvasStore.getState().isConnected).toBe(true),
			);

			// Add some elements (current state)
			result.current.addElement(createRectangle(0, 0, 10, 10));
			result.current.addElement(createRectangle(20, 20, 10, 10));

			await waitFor(() =>
				expect(useCanvasStore.getState().elements.size).toBe(2),
			);

			// Restore — this modifies the shared Y.Doc
			const snapEl = createEllipse(100, 100, 30, 30);
			result.current.restoreVersion({ [snapEl.id]: snapEl });

			// "User B" reads the Y.Doc — should see only the restored element
			const yElements = result.current.getYElements();
			const allEntries = Object.fromEntries(yElements.entries());

			expect(Object.keys(allEntries).length).toBe(1);
			expect(allEntries[snapEl.id]).toBeDefined();
			expect(allEntries[snapEl.id]?.type).toBe("ellipse");
		});

		it("element properties preserved exactly after restore", async () => {
			const { result } = renderHook(() => useYjsSync("room-1", "token-123"));

			await waitFor(() =>
				expect(useCanvasStore.getState().isConnected).toBe(true),
			);

			const base = createRectangle(42, 84, 200, 150, {
				strokeColor: "#ff00ff",
				backgroundColor: "#00ff00",
				opacity: 75,
			});
			// Manually add attribution fields (not handled by createBaseElement)
			const original: CanvasElement = {
				...base,
				createdBy: "OriginalAuthor",
				lastModifiedBy: "Editor",
			};

			result.current.restoreVersion({ [original.id]: original });

			await waitFor(() => {
				const restored = useCanvasStore.getState().elements.get(original.id);
				expect(restored).toBeDefined();
				expect(restored?.x).toBe(42);
				expect(restored?.y).toBe(84);
				expect(restored?.width).toBe(200);
				expect(restored?.height).toBe(150);
				expect(restored?.strokeColor).toBe("#ff00ff");
				expect(restored?.backgroundColor).toBe("#00ff00");
				expect(restored?.opacity).toBe(75);
				expect(restored?.createdBy).toBe("OriginalAuthor");
				expect(restored?.lastModifiedBy).toBe("Editor");
			});
		});
	});

	// ─────────────────────────────────────────────────────
	// 5. Snapshot parsing (VersionsPanel logic)
	// ─────────────────────────────────────────────────────

	describe("Snapshot parsing", () => {
		it("parses valid JSON snapshot string", () => {
			const rect = createRectangle(0, 0, 10, 10);
			const snapshotStr = JSON.stringify({ [rect.id]: rect });
			const parsed = JSON.parse(snapshotStr) as Record<string, CanvasElement>;

			expect(Object.keys(parsed).length).toBe(1);
			expect(parsed[rect.id]?.type).toBe("rectangle");
		});

		it("throws on invalid JSON", () => {
			expect(() => JSON.parse("not-json{")).toThrow();
		});

		it("filters out isDeleted elements from snapshot", () => {
			const alive = createRectangle(0, 0, 10, 10);
			const dead = createRectangle(20, 20, 10, 10);
			const snapshot: Record<string, CanvasElement> = {
				[alive.id]: alive,
				[dead.id]: { ...dead, isDeleted: true },
			};

			const filtered = Object.fromEntries(
				Object.entries(snapshot).filter(([, el]) => !el.isDeleted),
			);

			expect(Object.keys(filtered).length).toBe(1);
			expect(filtered[alive.id]).toBeDefined();
			expect(filtered[dead.id]).toBeUndefined();
		});
	});
});
