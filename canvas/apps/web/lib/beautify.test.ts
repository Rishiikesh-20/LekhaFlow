/**
 * Unit tests for beautify.ts — Smart Sketch Beautification (Story 3)
 *
 * Tests shape detection heuristics and element generation for:
 * - Rectangle (messy square → clean rectangle)
 * - Ellipse / Circle (round stroke → clean ellipse)
 * - Line (straight stroke → clean line)
 * - Arrow (straight stroke with arrowhead → clean arrow)
 * - Diamond (rotated square → clean diamond)
 * - beautifyElements end-to-end
 */

import type { FreedrawElement } from "@repo/common";
import { describe, expect, it } from "vitest";
import { beautifyElements, buildCleanElement, detectShape } from "./beautify";

// ============================================================================
// HELPERS
// ============================================================================

/** Create a minimal FreedrawElement with the given points */
function makeFreehand(
	points: Array<[number, number]>,
	overrides: Partial<FreedrawElement> = {},
): FreedrawElement {
	return {
		id: "test-fd-1",
		type: "freedraw",
		x: 100,
		y: 100,
		width: 0,
		height: 0,
		angle: 0,
		strokeColor: "#1e1e1e",
		backgroundColor: "transparent",
		strokeWidth: 2,
		strokeStyle: "solid",
		fillStyle: "solid",
		opacity: 100,
		roughness: 0,
		seed: 12345,
		version: 1,
		versionNonce: 12345,
		isDeleted: false,
		groupIds: [],
		boundElements: null,
		updated: Date.now(),
		link: null,
		locked: false,
		zIndex: 1,
		points: points.map(([x, y]) => [x, y] as [number, number, number?]),
		pressures: [],
		simulatePressure: true,
		...overrides,
	};
}

/**
 * Generate points for a rough rectangle (hand-drawn).
 * Adds jitter to simulate human imprecision.
 */
function roughRectPoints(
	w: number,
	h: number,
	jitter = 3,
): Array<[number, number]> {
	const pts: Array<[number, number]> = [];
	const steps = 10;
	const j = () => (Math.random() - 0.5) * jitter;

	// Top edge: (0,0) → (w,0)
	for (let i = 0; i <= steps; i++) {
		pts.push([(w * i) / steps + j(), j()]);
	}
	// Right edge: (w,0) → (w,h)
	for (let i = 1; i <= steps; i++) {
		pts.push([w + j(), (h * i) / steps + j()]);
	}
	// Bottom edge: (w,h) → (0,h)
	for (let i = 1; i <= steps; i++) {
		pts.push([w - (w * i) / steps + j(), h + j()]);
	}
	// Left edge: (0,h) → (0,0) — closing the shape
	for (let i = 1; i <= steps; i++) {
		pts.push([j(), h - (h * i) / steps + j()]);
	}
	return pts;
}

/**
 * Generate points for a rough circle (hand-drawn).
 */
function roughCirclePoints(r: number, jitter = 3): Array<[number, number]> {
	const pts: Array<[number, number]> = [];
	const steps = 30;
	const j = () => (Math.random() - 0.5) * jitter;
	for (let i = 0; i <= steps; i++) {
		const angle = (2 * Math.PI * i) / steps;
		pts.push([r + r * Math.cos(angle) + j(), r + r * Math.sin(angle) + j()]);
	}
	return pts;
}

/**
 * Generate points for a straight line (with jitter).
 */
function roughLinePoints(
	x2: number,
	y2: number,
	jitter = 2,
): Array<[number, number]> {
	const pts: Array<[number, number]> = [];
	const steps = 15;
	const j = () => (Math.random() - 0.5) * jitter;
	for (let i = 0; i <= steps; i++) {
		pts.push([(x2 * i) / steps + j(), (y2 * i) / steps + j()]);
	}
	return pts;
}

// ============================================================================
// TESTS
// ============================================================================

describe("detectShape", () => {
	it("detects a rough rectangle as 'rectangle'", () => {
		const fd = makeFreehand(roughRectPoints(150, 100, 2));
		const result = detectShape(fd);
		expect(result.shape).toBe("rectangle");
		expect(result.confidence).toBeGreaterThan(0.5);
	});

	it("detects a rough circle as 'ellipse'", () => {
		const fd = makeFreehand(roughCirclePoints(60, 2));
		const result = detectShape(fd);
		expect(result.shape).toBe("ellipse");
		expect(result.confidence).toBeGreaterThan(0.5);
	});

	it("detects a rough circle with more jitter as 'ellipse'", () => {
		const fd = makeFreehand(roughCirclePoints(80, 5));
		const result = detectShape(fd);
		expect(result.shape).toBe("ellipse");
		expect(result.confidence).toBeGreaterThan(0.4);
	});

	it("detects a small circle as 'ellipse'", () => {
		const fd = makeFreehand(roughCirclePoints(30, 2));
		const result = detectShape(fd);
		expect(result.shape).toBe("ellipse");
		expect(result.confidence).toBeGreaterThan(0.4);
	});

	it("detects a rough diamond as 'diamond'", () => {
		// Diamond: vertices at (50,0), (100,50), (50,100), (0,50)
		const pts: Array<[number, number]> = [];
		const steps = 8;
		const j = () => (Math.random() - 0.5) * 3;
		// top → right
		for (let i = 0; i <= steps; i++) {
			pts.push([50 + (50 * i) / steps + j(), (50 * i) / steps + j()]);
		}
		// right → bottom
		for (let i = 1; i <= steps; i++) {
			pts.push([100 - (50 * i) / steps + j(), 50 + (50 * i) / steps + j()]);
		}
		// bottom → left
		for (let i = 1; i <= steps; i++) {
			pts.push([50 - (50 * i) / steps + j(), 100 - (50 * i) / steps + j()]);
		}
		// left → top
		for (let i = 1; i <= steps; i++) {
			pts.push([(50 * i) / steps + j(), 50 - (50 * i) / steps + j()]);
		}
		const fd = makeFreehand(pts);
		const result = detectShape(fd);
		expect(result.shape).toBe("diamond");
		expect(result.confidence).toBeGreaterThan(0.5);
	});

	it("detects a straight line as 'line'", () => {
		const fd = makeFreehand(roughLinePoints(200, 0, 1));
		const result = detectShape(fd);
		expect(["line", "arrow"]).toContain(result.shape);
		expect(result.confidence).toBeGreaterThan(0.5);
		expect(result.endpoints).toBeDefined();
	});

	it("detects a diagonal line as 'line'", () => {
		const fd = makeFreehand(roughLinePoints(150, 150, 1));
		const result = detectShape(fd);
		expect(["line", "arrow"]).toContain(result.shape);
		expect(result.confidence).toBeGreaterThan(0.5);
	});

	it("returns a valid bounding box", () => {
		const fd = makeFreehand(roughRectPoints(120, 80, 2));
		const result = detectShape(fd);
		expect(result.boundingBox.width).toBeGreaterThan(0);
		expect(result.boundingBox.height).toBeGreaterThan(0);
	});

	it("handles very few points gracefully", () => {
		const fd = makeFreehand([[0, 0]]);
		const result = detectShape(fd);
		expect(result.shape).toBe("rectangle");
		expect(result.confidence).toBeLessThan(0.5);
	});
});

describe("buildCleanElement", () => {
	it("builds a rectangle element with correct position and size", () => {
		const fd = makeFreehand(roughRectPoints(100, 80, 1));
		const detection = detectShape(fd);
		const clean = buildCleanElement(fd, detection, 5);

		expect(clean.type).toBe("rectangle");
		expect(clean.zIndex).toBe(5);
		expect(clean.width).toBeGreaterThan(0);
		expect(clean.height).toBeGreaterThan(0);
		expect(clean.strokeColor).toBe(fd.strokeColor);
		expect(clean.opacity).toBe(fd.opacity);
	});

	it("builds an ellipse element for a circular stroke", () => {
		const fd = makeFreehand(roughCirclePoints(50, 1));
		const detection = detectShape(fd);
		const clean = buildCleanElement(fd, detection, 3);

		expect(clean.type).toBe("ellipse");
		expect(clean.width).toBeGreaterThan(0);
		expect(clean.height).toBeGreaterThan(0);
	});

	it("builds a line element for a straight stroke", () => {
		const fd = makeFreehand(roughLinePoints(200, 50, 1));
		const detection = detectShape(fd);
		const clean = buildCleanElement(fd, detection, 2);

		expect(["line", "arrow"]).toContain(clean.type);
		if (clean.type === "line" || clean.type === "arrow") {
			expect(clean.points).toHaveLength(2);
		}
	});

	it("preserves style properties from the original element", () => {
		const fd = makeFreehand(roughRectPoints(100, 100, 1), {
			strokeColor: "#ff0000",
			backgroundColor: "#00ff00",
			strokeWidth: 4,
			opacity: 75,
		});
		const detection = detectShape(fd);
		const clean = buildCleanElement(fd, detection, 1);

		expect(clean.strokeColor).toBe("#ff0000");
		expect(clean.backgroundColor).toBe("#00ff00");
		expect(clean.strokeWidth).toBe(4);
		expect(clean.opacity).toBe(75);
	});
});

describe("beautifyElements", () => {
	it("replaces freedraw elements with clean shapes", () => {
		const fd1 = makeFreehand(roughRectPoints(120, 80, 1), { id: "fd-1" });
		const fd2 = makeFreehand(roughCirclePoints(50, 1), { id: "fd-2" });

		let z = 10;
		const result = beautifyElements([fd1, fd2], () => z++);

		expect(result.removedIds).toContain("fd-1");
		expect(result.removedIds).toContain("fd-2");
		expect(result.newElements).toHaveLength(2);

		const types = result.newElements.map((el) => el.type);
		expect(types).toContain("rectangle");
		expect(types).toContain("ellipse");
	});

	it("ignores non-freedraw elements", () => {
		// biome-ignore lint/suspicious/noExplicitAny: test mock
		const rectEl: any = {
			id: "rect-1",
			type: "rectangle",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		};

		const result = beautifyElements([rectEl], () => 1);
		expect(result.removedIds).toHaveLength(0);
		expect(result.newElements).toHaveLength(0);
	});

	it("skips strokes with too few points", () => {
		const fd = makeFreehand(
			[
				[0, 0],
				[1, 1],
			],
			{ id: "short" },
		);
		const result = beautifyElements([fd], () => 1);
		expect(result.removedIds).toHaveLength(0);
	});

	it("assigns incrementing z-indexes to new elements", () => {
		const fd1 = makeFreehand(roughRectPoints(100, 100, 1), { id: "fd-a" });
		const fd2 = makeFreehand(roughRectPoints(100, 100, 1), { id: "fd-b" });

		let z = 5;
		const result = beautifyElements([fd1, fd2], () => z++);

		expect(result.newElements[0]?.zIndex).toBe(5);
		expect(result.newElements[1]?.zIndex).toBe(6);
	});

	it("generates unique IDs for replacement elements", () => {
		const fd1 = makeFreehand(roughRectPoints(100, 100, 1), { id: "fd-x" });
		const fd2 = makeFreehand(roughCirclePoints(60, 1), { id: "fd-y" });

		const result = beautifyElements([fd1, fd2], () => 1);
		const ids = result.newElements.map((el) => el.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
		// IDs should not match the original freedraw IDs
		expect(ids).not.toContain("fd-x");
		expect(ids).not.toContain("fd-y");
	});
});
