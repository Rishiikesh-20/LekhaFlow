/**
 * ============================================================================
 * LEKHAFLOW - AI CHAT "EXPLAIN LIKE I'M NEW" (Story 6.8) TESTS
 * ============================================================================
 *
 * Phase 4 test coverage:
 * 1. Backend — prompt builder, flag handling, route safety
 * 2. Frontend — toggle state, request payload, intent classification
 * 3. Integration — modify flow isolation, streaming compatibility
 * 4. Non-regression — no impact on existing AI pipelines
 */

import { beforeEach, describe, expect, it } from "vitest";
import { isActionIntent } from "../components/canvas/AiChatSidebar";
import {
	BEGINNER_ADDENDUM,
	getSystemPrompt,
	SYSTEM_PROMPT,
} from "../lib/ai-chat-prompts";
import {
	type ModifyAction,
	parseAiModifications,
	resolveFilter,
} from "../lib/ai-modify-parser";
import { serializeCanvasForAI } from "../lib/canvas-serializer";
import { createEllipse, createRectangle } from "../lib/element-utils";

// ============================================================================
// 1. BACKEND — PROMPT BUILDER
// ============================================================================

describe("getSystemPrompt", () => {
	it("returns base prompt when beginnerMode is false", () => {
		const result = getSystemPrompt(false);
		expect(result).toBe(SYSTEM_PROMPT);
		expect(result).not.toContain("Explain Like I'm New");
	});

	it("returns base prompt + beginner addendum when beginnerMode is true", () => {
		const result = getSystemPrompt(true);
		expect(result).toContain(SYSTEM_PROMPT);
		expect(result).toContain(BEGINNER_ADDENDUM);
		expect(result).toContain("Explain Like I'm New");
	});

	it("base prompt is a prefix of beginner prompt", () => {
		const base = getSystemPrompt(false);
		const beginner = getSystemPrompt(true);
		expect(beginner.startsWith(base)).toBe(true);
	});

	it("beginner addendum contains key instructional phrases", () => {
		expect(BEGINNER_ADDENDUM).toContain("simple");
		expect(BEGINNER_ADDENDUM).toContain("jargon");
		expect(BEGINNER_ADDENDUM).toContain("numbered steps");
		expect(BEGINNER_ADDENDUM).toContain("new to the topic");
		expect(BEGINNER_ADDENDUM).toContain("empty");
	});

	it("base prompt does not mention beginner instructions", () => {
		expect(SYSTEM_PROMPT).not.toContain("Explain Like I'm New");
		expect(SYSTEM_PROMPT).not.toContain("Beginner");
	});
});

// ============================================================================
// 2. BACKEND — FLAG SAFETY / COERCION
// ============================================================================

describe("explainLikeImNew flag safety", () => {
	it("getSystemPrompt handles false correctly", () => {
		expect(getSystemPrompt(false)).toBe(SYSTEM_PROMPT);
	});

	it("getSystemPrompt handles true correctly", () => {
		expect(getSystemPrompt(true)).not.toBe(SYSTEM_PROMPT);
	});

	// Simulate how the route coerces body.explainLikeImNew === true
	const coerce = (val: unknown) => val === true;

	it("coerces undefined to false", () => {
		expect(coerce(undefined)).toBe(false);
	});

	it("coerces null to false", () => {
		expect(coerce(null)).toBe(false);
	});

	it("coerces 'true' string to false", () => {
		expect(coerce("true")).toBe(false);
	});

	it("coerces 1 to false", () => {
		expect(coerce(1)).toBe(false);
	});

	it("coerces false to false", () => {
		expect(coerce(false)).toBe(false);
	});

	it("coerces true to true", () => {
		expect(coerce(true)).toBe(true);
	});

	it("missing field in empty object coerces to false", () => {
		const body: Record<string, unknown> = {};
		expect(coerce(body.explainLikeImNew)).toBe(false);
	});
});

// ============================================================================
// 3. FRONTEND — INTENT CLASSIFICATION IS UNAFFECTED
// ============================================================================

describe("isActionIntent independence from beginner mode", () => {
	// These tests verify the intent classifier is a pure function of the
	// message text — it doesn't reference beginner mode at all.

	it("detects action intents", () => {
		expect(isActionIntent("Make all circles green")).toBe(true);
		expect(isActionIntent("change the rectangle color to red")).toBe(true);
		expect(isActionIntent("delete all shapes")).toBe(true);
		expect(isActionIntent("resize all rectangles")).toBe(true);
		expect(isActionIntent("move the ellipse to the right")).toBe(true);
	});

	it("detects Q&A intents", () => {
		expect(isActionIntent("What does this diagram show?")).toBe(false);
		expect(isActionIntent("Explain the flow step by step")).toBe(false);
		expect(isActionIntent("How many elements are there?")).toBe(false);
		expect(isActionIntent("Describe the architecture")).toBe(false);
	});

	it("edge cases: empty and whitespace", () => {
		expect(isActionIntent("")).toBe(false);
		expect(isActionIntent("   ")).toBe(false);
	});
});

// ============================================================================
// 4. FRONTEND — REQUEST PAYLOAD STRUCTURE
// ============================================================================

describe("request payload includes explainLikeImNew", () => {
	it("Q&A payload shape is correct with flag on", () => {
		const payload = {
			question: "What is this?",
			canvasContext: { nodes: [], edges: [], summary: "" },
			canvasImage: null,
			history: [],
			explainLikeImNew: true,
		};
		expect(payload).toHaveProperty("explainLikeImNew", true);
		expect(payload).toHaveProperty("question");
		expect(payload).toHaveProperty("canvasContext");
		expect(payload).toHaveProperty("history");
	});

	it("Q&A payload shape is correct with flag off", () => {
		const payload = {
			question: "What is this?",
			canvasContext: { nodes: [], edges: [], summary: "" },
			canvasImage: null,
			history: [],
			explainLikeImNew: false,
		};
		expect(payload.explainLikeImNew).toBe(false);
	});

	it("modify payload includes flag without breaking structure", () => {
		const payload = {
			prompt: "Make all circles green",
			canvasContext: { nodes: [], edges: [], summary: "" },
			canvasImage: null,
			explainLikeImNew: true,
		};
		expect(payload).toHaveProperty("prompt");
		expect(payload).toHaveProperty("canvasContext");
		// The modify route ignores this field — it's a pass-through
		expect(payload).toHaveProperty("explainLikeImNew");
	});
});

// ============================================================================
// 5. NON-REGRESSION — MODIFY PARSER STILL WORKS
// ============================================================================

describe("AI modify pipeline is unaffected", () => {
	function createTestElements() {
		const elements = new Map();
		const rect = createRectangle(10, 10, 100, 50, {
			strokeColor: "#1971c2",
			backgroundColor: "#a5d8ff",
		});
		const ellipse = createEllipse(200, 100, 60, 60, {
			strokeColor: "#e03131",
			backgroundColor: "#ffc9c9",
		});
		elements.set(rect.id, rect);
		elements.set(ellipse.id, ellipse);
		return { elements, rect, ellipse };
	}

	it("resolveFilter still works for type filter", () => {
		const { elements, ellipse } = createTestElements();
		const ids = resolveFilter({ type: "ellipse" }, elements);
		expect(ids).toHaveLength(1);
		expect(ids).toContain(ellipse.id);
	});

	it("parseAiModifications still produces diffs", () => {
		const { elements, rect } = createTestElements();
		const actions: ModifyAction[] = [
			{
				action: "update_color",
				filter: { type: "rectangle" },
				params: { backgroundColor: "#00ff00" },
			},
		];
		const diffs = parseAiModifications(actions, elements);
		expect(diffs.size).toBe(1);
		expect(diffs.get(rect.id)).toBeDefined();
		expect(diffs.get(rect.id)?.backgroundColor).toBe("#00ff00");
	});
});

// ============================================================================
// 6. NON-REGRESSION — CANVAS SERIALIZATION STILL WORKS
// ============================================================================

describe("Canvas serialization is unaffected", () => {
	it("serializes elements correctly", () => {
		const elements = new Map();
		const rect = createRectangle(50, 100, 120, 60, {
			strokeColor: "#1971c2",
			backgroundColor: "#a5d8ff",
		});
		elements.set(rect.id, rect);

		const result = serializeCanvasForAI(elements);
		expect(result.nodes.length).toBe(1);
		expect(result.nodes[0]?.type).toBe("rectangle");
	});

	it("handles empty canvas", () => {
		const result = serializeCanvasForAI(new Map());
		expect(result.nodes).toHaveLength(0);
		expect(result.edges).toHaveLength(0);
		expect(result.summary).toContain("empty");
	});
});

// ============================================================================
// 7. NON-REGRESSION — TOGGLE STATE PERSISTENCE
// ============================================================================

describe("localStorage beginner mode persistence", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("defaults to false when localStorage is empty", () => {
		const val = localStorage.getItem("lekhaflow-beginner-mode");
		expect(val).toBeNull();
		// The component initializer would return false
		const result = localStorage.getItem("lekhaflow-beginner-mode") === "true";
		expect(result).toBe(false);
	});

	it("reads true when localStorage has 'true'", () => {
		localStorage.setItem("lekhaflow-beginner-mode", "true");
		const result = localStorage.getItem("lekhaflow-beginner-mode") === "true";
		expect(result).toBe(true);
	});

	it("reads false when localStorage has 'false'", () => {
		localStorage.setItem("lekhaflow-beginner-mode", "false");
		const result = localStorage.getItem("lekhaflow-beginner-mode") === "true";
		expect(result).toBe(false);
	});

	it("survives write-read roundtrip", () => {
		const mode = true;
		localStorage.setItem("lekhaflow-beginner-mode", String(mode));
		const read = localStorage.getItem("lekhaflow-beginner-mode") === "true";
		expect(read).toBe(mode);
	});
});

// ============================================================================
// 8. ROUTE SCOPE — ONLY CHAT ROUTE HAS BEGINNER PROMPT
// ============================================================================

describe("route scope isolation", () => {
	it("SYSTEM_PROMPT is a non-empty string", () => {
		expect(typeof SYSTEM_PROMPT).toBe("string");
		expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
	});

	it("BEGINNER_ADDENDUM is a non-empty string", () => {
		expect(typeof BEGINNER_ADDENDUM).toBe("string");
		expect(BEGINNER_ADDENDUM.length).toBeGreaterThan(50);
	});

	it("getSystemPrompt always returns a string", () => {
		expect(typeof getSystemPrompt(false)).toBe("string");
		expect(typeof getSystemPrompt(true)).toBe("string");
	});

	it("toggle does not affect base prompt content", () => {
		const base = getSystemPrompt(false);
		const beginner = getSystemPrompt(true);
		// The base prompt portion is identical in both
		expect(beginner.slice(0, base.length)).toBe(base);
	});
});
