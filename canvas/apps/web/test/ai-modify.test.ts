import { beforeEach, describe, expect, it } from "vitest";
import {
	type ModifyAction,
	parseAiModifications,
	resolveFilter,
	summarizeModifications,
} from "../lib/ai-modify-parser";
import { createEllipse, createRectangle } from "../lib/element-utils";
import { initialState, useCanvasStore } from "../store/canvas-store";

// Helper to reset store
const resetStore = () => {
	useCanvasStore.setState(initialState);
};

// Helper to create a test elements map
function createTestElements() {
	const elements = new Map();
	const rect1 = createRectangle(10, 10, 100, 50, {
		strokeColor: "#1971c2",
		backgroundColor: "#a5d8ff",
	});
	const rect2 = createRectangle(200, 10, 80, 80, {
		strokeColor: "#1971c2",
		backgroundColor: "#a5d8ff",
	});
	const ellipse1 = createEllipse(50, 150, 60, 60, {
		strokeColor: "#1971c2",
		backgroundColor: "#a5d8ff",
	});
	const ellipse2 = createEllipse(200, 150, 40, 40, {
		strokeColor: "#e03131",
		backgroundColor: "#ffc9c9",
	});
	const ellipse3 = createEllipse(350, 150, 50, 50, {
		strokeColor: "#1971c2",
		backgroundColor: "#a5d8ff",
	});

	elements.set(rect1.id, rect1);
	elements.set(rect2.id, rect2);
	elements.set(ellipse1.id, ellipse1);
	elements.set(ellipse2.id, ellipse2);
	elements.set(ellipse3.id, ellipse3);

	return { elements, rect1, rect2, ellipse1, ellipse2, ellipse3 };
}

describe("AI Modify Parser", () => {
	describe("resolveFilter", () => {
		it("filters by element type", () => {
			const { elements, ellipse1, ellipse2, ellipse3 } = createTestElements();

			const ids = resolveFilter({ type: "ellipse" }, elements);

			expect(ids).toHaveLength(3);
			expect(ids).toContain(ellipse1.id);
			expect(ids).toContain(ellipse2.id);
			expect(ids).toContain(ellipse3.id);
		});

		it("filters by type and stroke color", () => {
			const { elements, ellipse1, ellipse3 } = createTestElements();

			const ids = resolveFilter(
				{ type: "ellipse", strokeColor: "#1971c2" },
				elements,
			);

			expect(ids).toHaveLength(2);
			expect(ids).toContain(ellipse1.id);
			expect(ids).toContain(ellipse3.id);
		});

		it("filters by specific IDs", () => {
			const { elements, rect1 } = createTestElements();

			const ids = resolveFilter({ ids: [rect1.id] }, elements);

			expect(ids).toHaveLength(1);
			expect(ids[0]).toBe(rect1.id);
		});

		it("type 'all' matches every element", () => {
			const { elements } = createTestElements();

			const ids = resolveFilter({ type: "all" }, elements);

			expect(ids).toHaveLength(5);
		});

		it("excludes deleted elements", () => {
			const { elements, rect1 } = createTestElements();
			const deleted = { ...rect1, isDeleted: true };
			elements.set(rect1.id, deleted);

			const ids = resolveFilter({ type: "all" }, elements);

			expect(ids).toHaveLength(4);
			expect(ids).not.toContain(rect1.id);
		});
	});

	describe("parseAiModifications", () => {
		it("applies update_color to matching elements", () => {
			const { elements, ellipse1, ellipse3 } = createTestElements();

			const actions: ModifyAction[] = [
				{
					action: "update_color",
					filter: { type: "ellipse", strokeColor: "#1971c2" },
					params: { backgroundColor: "#22c55e" },
				},
			];

			const diffs = parseAiModifications(actions, elements);

			expect(diffs.size).toBe(2);
			expect(diffs.get(ellipse1.id)).toEqual({
				backgroundColor: "#22c55e",
			});
			expect(diffs.get(ellipse3.id)).toEqual({
				backgroundColor: "#22c55e",
			});
		});

		it("applies resize to specific elements", () => {
			const { elements, rect1, rect2 } = createTestElements();

			const actions: ModifyAction[] = [
				{
					action: "resize",
					filter: { type: "rectangle" },
					params: { width: 200, height: 200 },
				},
			];

			const diffs = parseAiModifications(actions, elements);

			expect(diffs.size).toBe(2);
			expect(diffs.get(rect1.id)).toEqual({ width: 200, height: 200 });
			expect(diffs.get(rect2.id)).toEqual({ width: 200, height: 200 });
		});

		it("applies move with relative offsets", () => {
			const { elements, rect1 } = createTestElements();

			const actions: ModifyAction[] = [
				{
					action: "move",
					filter: { ids: [rect1.id] },
					params: { dx: 50, dy: -20 },
				},
			];

			const diffs = parseAiModifications(actions, elements);

			expect(diffs.size).toBe(1);
			const diff = diffs.get(rect1.id);
			expect(diff?.x).toBe(rect1.x + 50);
			expect(diff?.y).toBe(rect1.y + -20);
		});

		it("applies delete action", () => {
			const { elements, ellipse2 } = createTestElements();

			const actions: ModifyAction[] = [
				{
					action: "delete",
					filter: { type: "ellipse", strokeColor: "#e03131" },
					params: {},
				},
			];

			const diffs = parseAiModifications(actions, elements);

			expect(diffs.size).toBe(1);
			expect(diffs.get(ellipse2.id)).toEqual({ isDeleted: true });
		});

		it("handles invalid actions gracefully", () => {
			const { elements } = createTestElements();

			// @ts-expect-error — testing invalid input
			const diffs = parseAiModifications("not an array", elements);
			expect(diffs.size).toBe(0);
		});

		it("handles empty actions array", () => {
			const { elements } = createTestElements();

			const diffs = parseAiModifications([], elements);
			expect(diffs.size).toBe(0);
		});

		it("merges multiple actions targeting the same element", () => {
			const { elements, rect1 } = createTestElements();

			const actions: ModifyAction[] = [
				{
					action: "update_color",
					filter: { ids: [rect1.id] },
					params: { strokeColor: "#22c55e" },
				},
				{
					action: "resize",
					filter: { ids: [rect1.id] },
					params: { width: 300, height: 300 },
				},
			];

			const diffs = parseAiModifications(actions, elements);

			expect(diffs.size).toBe(1);
			const diff = diffs.get(rect1.id);
			expect(diff?.strokeColor).toBe("#22c55e");
			expect(diff?.width).toBe(300);
			expect(diff?.height).toBe(300);
		});
	});

	describe("summarizeModifications", () => {
		it("generates readable summaries", () => {
			const { elements } = createTestElements();

			const actions: ModifyAction[] = [
				{
					action: "update_color",
					filter: { type: "ellipse" },
					params: { backgroundColor: "#22c55e" },
				},
			];

			const summaries = summarizeModifications(actions, elements);

			expect(summaries).toHaveLength(1);
			expect(summaries[0]?.affectedCount).toBe(3);
			expect(summaries[0]?.description).toContain("ellipse");
			expect(summaries[0]?.description).toContain("#22c55e");
		});
	});
});

describe("AI Preview Store Actions", () => {
	beforeEach(() => {
		resetStore();
	});

	it("setAiPreview enters preview mode", () => {
		const { elements, rect1, rect2 } = createTestElements();

		// Add elements to store
		useCanvasStore.getState().setElements(elements);

		const changes = new Map();
		changes.set(rect1.id, { strokeColor: "#22c55e" });
		changes.set(rect2.id, { backgroundColor: "#fbbf24" });

		const originals = new Map();
		originals.set(rect1.id, rect1);
		originals.set(rect2.id, rect2);

		useCanvasStore.getState().setAiPreview(changes, originals);

		const state = useCanvasStore.getState();
		expect(state.isAiPreviewActive).toBe(true);
		expect(state.aiPreviewChanges.size).toBe(2);
		expect(state.aiPreviewOriginals.size).toBe(2);
	});

	it("acceptAiPreview clears preview", () => {
		const { elements, rect1 } = createTestElements();

		// Add elements to store
		useCanvasStore.getState().setElements(elements);

		const changes = new Map();
		changes.set(rect1.id, { strokeColor: "#22c55e" });

		const originals = new Map();
		originals.set(rect1.id, rect1);

		useCanvasStore.getState().setAiPreview(changes, originals);
		useCanvasStore.getState().acceptAiPreview();

		const state = useCanvasStore.getState();
		expect(state.isAiPreviewActive).toBe(false);
		expect(state.aiPreviewChanges.size).toBe(0);
		expect(state.aiPreviewOriginals.size).toBe(0);
	});

	it("rejectAiPreview clears preview", () => {
		const { elements, rect1 } = createTestElements();

		// Add elements to store
		useCanvasStore.getState().setElements(elements);

		// Pre-modify element in store
		useCanvasStore
			.getState()
			.updateElement(rect1.id, { strokeColor: "#modified" });

		const changes = new Map();
		changes.set(rect1.id, { strokeColor: "#modified" });

		const originals = new Map();
		originals.set(rect1.id, rect1); // Original with #1971c2

		useCanvasStore.getState().setAiPreview(changes, originals);
		useCanvasStore.getState().rejectAiPreview();

		const state = useCanvasStore.getState();
		expect(state.isAiPreviewActive).toBe(false);
		expect(state.aiPreviewChanges.size).toBe(0);
		expect(state.aiPreviewOriginals.size).toBe(0);
	});

	it("clearAiPreview resets preview state", () => {
		const changes = new Map();
		changes.set("test-id", { strokeColor: "#22c55e" });

		const originals = new Map();

		useCanvasStore.getState().setAiPreview(changes, originals);

		expect(useCanvasStore.getState().isAiPreviewActive).toBe(true);

		useCanvasStore.getState().clearAiPreview();

		const state = useCanvasStore.getState();
		expect(state.isAiPreviewActive).toBe(false);
		expect(state.aiPreviewChanges.size).toBe(0);
	});
});
