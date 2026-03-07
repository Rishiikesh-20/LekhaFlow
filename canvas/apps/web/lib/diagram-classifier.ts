import type { CanvasElement, TextElement } from "@repo/common";

export type DiagramType =
	| "Flowchart"
	| "ER Diagram"
	| "Architecture Diagram"
	| "Mind Map"
	| "Wireframe"
	| "Generic";

/**
 * Classifies the intent of a diagram based on its geometric elements and text content.
 */
export function classifyDiagram(elements: CanvasElement[]): DiagramType {
	if (!elements || elements.length === 0) {
		return "Generic";
	}

	let rectCount = 0;
	let ellipseCount = 0;
	let diamondCount = 0;
	let lineCount = 0;
	let arrowCount = 0;
	let textCount = 0;

	// Collect text to check for keywords
	const texts: string[] = [];

	for (const el of elements) {
		if (el.isDeleted) continue;

		switch (el.type) {
			case "rectangle":
				rectCount++;
				break;
			case "ellipse":
				ellipseCount++;
				break;
			case "diamond":
				diamondCount++;
				break;
			case "line":
				lineCount++;
				break;
			case "arrow":
				arrowCount++;
				break;
			case "text":
				textCount++;
				texts.push((el as TextElement).text.toLowerCase());
				break;
		}
	}

	const totalShapes = rectCount + ellipseCount + diamondCount;
	const totalConnectors = lineCount + arrowCount;
	const activeElementsCount = totalShapes + totalConnectors + textCount;

	if (activeElementsCount === 0) {
		return "Generic";
	}

	// Helper to check if any text contains specific keywords
	const hasKeywords = (keywords: string[]) =>
		texts.some((text) => keywords.some((kw) => text.includes(kw)));

	// 1. ER Diagram
	// High text usage, connected rectangles (tables), specific keywords.
	const erKeywords = [
		"pk",
		"fk",
		"varchar",
		"int",
		"boolean",
		"primary key",
		"foreign key",
		"table",
		"database",
		"schema",
		"1:n",
		"n:m",
		"1:1",
	];
	if (
		hasKeywords(erKeywords) ||
		(rectCount > 1 && lineCount > 0 && textCount >= rectCount * 2)
	) {
		// Even without strong keywords, many fields (texts) inside tables (rects) connected by lines strongly suggest ER.
		if (hasKeywords(erKeywords) || texts.some((t) => t.includes("_id"))) {
			return "ER Diagram";
		}
	}

	// 2. Architecture Diagram
	// Often uses specific keywords ("server", "client", "aws", "db", "api")
	// and often has nested rects (groups) and connections.
	const archKeywords = [
		"server",
		"client",
		"api",
		"database",
		"db",
		"aws",
		"gcp",
		"azure",
		"cloud",
		"gateway",
		"proxy",
		"service",
		"microservice",
		"frontend",
		"backend",
		"cache",
		"redis",
		"postgres",
		"vpc",
	];
	if (hasKeywords(archKeywords)) {
		return "Architecture Diagram";
	}

	// 3. Flowchart
	// Dominantly shapes (usually rects + diamonds) connected by arrows
	// Text is relatively sparse (one per shape usually)
	if (totalShapes > 0 && arrowCount > 0) {
		const ratioShapesToArrows = totalShapes / arrowCount;
		// A classic flowchart has roughly 1 arrow per shape, or slightly fewer shapes than arrows.
		// It might also feature diamond shapes.
		if (
			ratioShapesToArrows > 0.3 &&
			ratioShapesToArrows < 3.0 &&
			(rectCount > 0 || ellipseCount > 0)
		) {
			const flowchartKeywords = ["start", "end", "yes", "no", "if", "else"];
			if (diamondCount > 0 || hasKeywords(flowchartKeywords)) {
				return "Flowchart";
			}
			// If we just have shapes connected by arrows, assume Flowchart
			return "Flowchart";
		}
	}

	// 4. Mind Map
	// Typically, ellipses/text connected by lines (not arrows), often radiating from a center,
	// but mostly characterized by many ellipses/text and basic lines.
	if (
		ellipseCount > 0 &&
		lineCount > 0 &&
		arrowCount === 0 &&
		rectCount === 0
	) {
		return "Mind Map";
	}

	// 5. Wireframe
	// Lots of rectangles (representing UI elements), very few logic connectors (arrows/lines)
	// Keywords: "button", "header", "login", "nav" etc.
	const wireframeKeywords = [
		"button",
		"header",
		"nav",
		"footer",
		"sidebar",
		"login",
		"form",
		"submit",
		"menu",
		"ui",
	];
	if (
		(rectCount > 3 && totalConnectors === 0) ||
		hasKeywords(wireframeKeywords)
	) {
		// Heuristic: If there are many rectangles without lines/arrows tying them structurally, it's likely a UI mockup.
		return "Wireframe";
	}

	// Heuristic Fallbacks

	// ER diagrams sometimes don't use typical keywords but represent lots of fields via many text + rects
	if (
		rectCount >= 2 &&
		textCount > rectCount * 3 &&
		totalConnectors >= rectCount - 1
	) {
		return "ER Diagram";
	}

	// Flowchart fallback (rectangles with arrows)
	if (rectCount >= 2 && arrowCount >= rectCount - 1) {
		return "Flowchart";
	}

	return "Generic";
}
