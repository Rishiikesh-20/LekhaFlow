import { describe, expect, it } from "vitest";
import { classifyDiagram } from "../lib/diagram-classifier";
import {
	createArrow,
	createEllipse,
	createLine,
	createRectangle,
	createText,
} from "../lib/element-utils";

describe("Diagram Intent Classifier", () => {
	it("returns Generic for empty array", () => {
		expect(classifyDiagram([])).toBe("Generic");
	});

	it("returns Flowchart for rectangles connected by arrows", () => {
		const elements = [
			createRectangle(0, 0, 100, 50),
			createRectangle(200, 0, 100, 50),
			createRectangle(100, 100, 50, 50), // Diamond-ish in purpose but a rectangle shape
			createArrow(100, 25, [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			]),
			createArrow(250, 50, [
				{ x: 0, y: 0 },
				{ x: -100, y: 50 },
			]),
		];
		expect(classifyDiagram(elements)).toBe("Flowchart");
	});

	it("returns Flowchart if flowchart logic keywords are present", () => {
		const elements = [
			createRectangle(0, 0, 100, 50),
			createText(10, 10, "if (condition)"),
			createArrow(100, 25, [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			]),
		];
		expect(classifyDiagram(elements)).toBe("Flowchart");
	});

	it("returns ER Diagram for tables connected by lines and DB keywords", () => {
		const elements = [
			createRectangle(0, 0, 150, 200),
			createText(10, 10, "users"),
			createText(10, 40, "id PK"),
			createText(10, 70, "email varchar"),
			createRectangle(250, 0, 150, 200),
			createText(260, 10, "posts"),
			createText(260, 40, "id PK"),
			createText(260, 70, "user_id FK"),
			createLine(150, 100, [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			]),
		];
		expect(classifyDiagram(elements)).toBe("ER Diagram");
	});

	it("returns Architecture Diagram for architecture keywords", () => {
		const elements = [
			createRectangle(0, 0, 100, 100),
			createText(10, 10, "Frontend Client"),
			createRectangle(200, 0, 100, 100),
			createText(210, 10, "API Gateway"),
			createRectangle(400, 0, 100, 100),
			createText(410, 10, "Postgres DB"),
			createArrow(100, 50, [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			]),
			createArrow(300, 50, [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			]),
		];
		expect(classifyDiagram(elements)).toBe("Architecture Diagram");
	});

	it("returns Mind Map for radiating ellipses and nodes", () => {
		const elements = [
			createEllipse(150, 150, 100, 50),
			createText(160, 160, "Central Idea"),
			createEllipse(0, 0, 80, 40),
			createText(10, 10, "Branch 1"),
			createEllipse(300, 0, 80, 40),
			createText(310, 10, "Branch 2"),
			createLine(150, 150, [
				{ x: 0, y: 0 },
				{ x: -70, y: -110 },
			]),
			createLine(250, 150, [
				{ x: 0, y: 0 },
				{ x: 90, y: -110 },
			]),
		];
		expect(classifyDiagram(elements)).toBe("Mind Map");
	});

	it("returns Wireframe when lots of rectangles exist without connectors", () => {
		const elements = [
			createRectangle(0, 0, 800, 600), // App container
			createRectangle(0, 0, 800, 60), // Header
			createText(10, 20, "Nav Menu"), // text
			createRectangle(0, 60, 200, 540), // Sidebar
			createRectangle(220, 80, 560, 200), // Hero
			createRectangle(220, 300, 260, 150), // Card 1
			createRectangle(500, 300, 260, 150), // Card 2
		];
		expect(classifyDiagram(elements)).toBe("Wireframe");
	});

	it("returns Generic when few unidentifiable elements exist", () => {
		const elements = [
			createRectangle(0, 0, 100, 100),
			createText(10, 10, "Hello world"),
		];
		expect(classifyDiagram(elements)).toBe("Generic");
	});

	it("ignores deleted elements during classification", () => {
		const elements = [
			{ ...createRectangle(0, 0, 100, 100), isDeleted: true },
			{ ...createRectangle(200, 0, 100, 100), isDeleted: true },
			{ ...createArrow(100, 50, []), isDeleted: true },
		];
		expect(classifyDiagram(elements)).toBe("Generic");
	});
});
