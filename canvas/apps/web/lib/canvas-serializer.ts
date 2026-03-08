/**
 * ============================================================================
 * LEKHAFLOW - CANVAS SERIALIZER FOR AI CONTEXT
 * ============================================================================
 *
 * Serializes the current canvas state into a lightweight JSON representation
 * that can be sent to an LLM for contextual Q&A about the diagram.
 *
 * The serializer extracts:
 * - Nodes (shapes, text elements)
 * - Edges (arrows, lines connecting elements)
 * - Labels (text content on elements)
 * - Spatial relationships (relative positions)
 */

import type {
	ArrowElement,
	CanvasElement,
	LineElement,
	TextElement,
} from "@repo/common";

// ============================================================================
// TYPES
// ============================================================================

/** Lightweight node representation for the LLM */
export interface SerializedNode {
	id: string;
	type: string;
	label: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
	connectedTo: string[];
	connectedFrom: string[];
}

/** Lightweight edge representation for the LLM */
export interface SerializedEdge {
	id: string;
	type: "arrow" | "line";
	fromNodeId: string | null;
	toNodeId: string | null;
	fromLabel: string;
	toLabel: string;
}

/** Full serialized canvas state */
export interface SerializedCanvas {
	nodes: SerializedNode[];
	edges: SerializedEdge[];
	summary: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the center point of an element
 */
function getCenter(el: CanvasElement): { cx: number; cy: number } {
	return {
		cx: el.x + el.width / 2,
		cy: el.y + el.height / 2,
	};
}

/**
 * Check if a point is approximately inside an element's bounding box
 * (with tolerance for arrow endpoints that are near a shape)
 */
function isPointNearElement(
	px: number,
	py: number,
	el: CanvasElement,
	tolerance = 40,
): boolean {
	const minX = Math.min(el.x, el.x + el.width) - tolerance;
	const maxX = Math.max(el.x, el.x + el.width) + tolerance;
	const minY = Math.min(el.y, el.y + el.height) - tolerance;
	const maxY = Math.max(el.y, el.y + el.height) + tolerance;
	return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

/**
 * Find the nearest shape element to a given point
 */
function findNearestShape(
	px: number,
	py: number,
	shapes: CanvasElement[],
	tolerance = 60,
): CanvasElement | null {
	let nearest: CanvasElement | null = null;
	let nearestDist = tolerance;

	for (const shape of shapes) {
		const { cx, cy } = getCenter(shape);
		const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
		// Also check if close to bounding box edges
		if (isPointNearElement(px, py, shape, tolerance) && dist < nearestDist) {
			nearestDist = dist;
			nearest = shape;
		}
	}

	return nearest;
}

/**
 * Find text elements that are bound to or visually overlapping a shape
 */
function findBoundText(
	shape: CanvasElement,
	textElements: TextElement[],
): string {
	// Check for explicitly bound elements
	if (shape.boundElements) {
		for (const bound of shape.boundElements) {
			if (bound.type === "text") {
				const textEl = textElements.find((t) => t.id === bound.id);
				if (textEl) return textEl.text;
			}
		}
	}

	// Check for overlapping text elements (within the shape bounds)
	for (const textEl of textElements) {
		const textCenter = getCenter(textEl);
		if (isPointNearElement(textCenter.cx, textCenter.cy, shape, 10)) {
			return textEl.text;
		}
	}

	return "";
}

// ============================================================================
// MAIN SERIALIZER
// ============================================================================

/**
 * Serialize canvas elements into a lightweight JSON for LLM context.
 *
 * @param elements - Map of all canvas elements
 * @returns SerializedCanvas with nodes, edges, and a text summary
 */
export function serializeCanvasForAI(
	elements: Map<string, CanvasElement>,
): SerializedCanvas {
	const allElements = Array.from(elements.values()).filter(
		(el) => !el.isDeleted,
	);

	// Separate elements by type
	const shapes = allElements.filter(
		(el) =>
			el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond",
	);
	const arrows = allElements.filter(
		(el) => el.type === "arrow",
	) as ArrowElement[];
	const lines = allElements.filter((el) => el.type === "line") as LineElement[];
	const texts = allElements.filter((el) => el.type === "text") as TextElement[];
	const freedraws = allElements.filter((el) => el.type === "freedraw");

	// Build nodes from shapes
	const nodes: SerializedNode[] = shapes.map((shape) => {
		const label = findBoundText(shape, texts);
		return {
			id: shape.id,
			type: shape.type,
			label: label || `${shape.type} (unlabeled)`,
			x: Math.round(shape.x),
			y: Math.round(shape.y),
			width: Math.round(Math.abs(shape.width)),
			height: Math.round(Math.abs(shape.height)),
			color: shape.backgroundColor || shape.strokeColor,
			connectedTo: [],
			connectedFrom: [],
		};
	});

	// Add standalone text elements as nodes too
	const boundTextIds = new Set<string>();
	for (const shape of shapes) {
		if (shape.boundElements) {
			for (const bound of shape.boundElements) {
				if (bound.type === "text") boundTextIds.add(bound.id);
			}
		}
	}

	// Standalone text that is not overlapping any shape
	for (const textEl of texts) {
		if (boundTextIds.has(textEl.id)) continue;
		// Check if this text is visually inside any shape
		const textCenter = getCenter(textEl);
		const overlappingShape = shapes.find((s) =>
			isPointNearElement(textCenter.cx, textCenter.cy, s, 10),
		);
		if (!overlappingShape) {
			nodes.push({
				id: textEl.id,
				type: "text",
				label: textEl.text || "Empty Text",
				x: Math.round(textEl.x),
				y: Math.round(textEl.y),
				width: Math.round(Math.abs(textEl.width)),
				height: Math.round(Math.abs(textEl.height)),
				color: textEl.strokeColor,
				connectedTo: [],
				connectedFrom: [],
			});
		}
	}

	// Build a node map for quick lookup
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	// Build edges from arrows and lines
	const edges: SerializedEdge[] = [];

	for (const arrow of arrows) {
		let fromNode: CanvasElement | null = null;
		let toNode: CanvasElement | null = null;

		// Use binding info if available
		if (arrow.startBinding) {
			fromNode =
				shapes.find((s) => s.id === arrow.startBinding?.elementId) || null;
		}
		if (arrow.endBinding) {
			toNode = shapes.find((s) => s.id === arrow.endBinding?.elementId) || null;
		}

		// If no binding, try spatial proximity
		if (!fromNode && arrow.points.length > 0) {
			const firstPt = arrow.points[0];
			if (firstPt) {
				const startX = arrow.x + firstPt.x;
				const startY = arrow.y + firstPt.y;
				fromNode = findNearestShape(startX, startY, shapes);
			}
		}

		if (!toNode && arrow.points.length > 1) {
			const lastPt = arrow.points[arrow.points.length - 1];
			if (lastPt) {
				const endX = arrow.x + lastPt.x;
				const endY = arrow.y + lastPt.y;
				toNode = findNearestShape(endX, endY, shapes);
			}
		}

		const fromId = fromNode?.id || null;
		const toId = toNode?.id || null;

		// Update connectivity on nodes
		if (fromId && nodeMap.has(fromId) && toId) {
			nodeMap.get(fromId)?.connectedTo.push(toId);
		}
		if (toId && nodeMap.has(toId) && fromId) {
			nodeMap.get(toId)?.connectedFrom.push(fromId);
		}

		edges.push({
			id: arrow.id,
			type: "arrow",
			fromNodeId: fromId,
			toNodeId: toId,
			fromLabel: fromId
				? (nodeMap.get(fromId)?.label ?? "unknown")
				: "unconnected",
			toLabel: toId ? (nodeMap.get(toId)?.label ?? "unknown") : "unconnected",
		});
	}

	// Lines as edges too
	for (const line of lines) {
		if (line.points.length < 2) continue;

		const firstPt = line.points[0];
		const lastPt = line.points[line.points.length - 1];
		if (!firstPt || !lastPt) continue;

		const startX = line.x + firstPt.x;
		const startY = line.y + firstPt.y;
		const endX = line.x + lastPt.x;
		const endY = line.y + lastPt.y;

		const fromNode = findNearestShape(startX, startY, shapes);
		const toNode = findNearestShape(endX, endY, shapes);

		const fromId = fromNode?.id || null;
		const toId = toNode?.id || null;

		if (fromId && nodeMap.has(fromId) && toId) {
			nodeMap.get(fromId)?.connectedTo.push(toId);
		}
		if (toId && nodeMap.has(toId) && fromId) {
			nodeMap.get(toId)?.connectedFrom.push(fromId);
		}

		edges.push({
			id: line.id,
			type: "line",
			fromNodeId: fromId,
			toNodeId: toId,
			fromLabel: fromId
				? (nodeMap.get(fromId)?.label ?? "unknown")
				: "unconnected",
			toLabel: toId ? (nodeMap.get(toId)?.label ?? "unknown") : "unconnected",
		});
	}

	// Build a human-readable summary
	const summary = buildSummary(nodes, edges, freedraws.length);

	return { nodes, edges, summary };
}

/**
 * Build a concise text summary of the canvas for the LLM system prompt.
 */
function buildSummary(
	nodes: SerializedNode[],
	edges: SerializedEdge[],
	freedrawCount: number,
): string {
	const parts: string[] = [];

	if (nodes.length === 0 && edges.length === 0 && freedrawCount === 0) {
		return "The canvas is empty.";
	}

	parts.push(
		`The canvas contains ${nodes.length} node(s) and ${edges.length} connection(s).`,
	);

	if (freedrawCount > 0) {
		parts.push(`There are also ${freedrawCount} freehand drawing(s).`);
	}

	// Describe nodes
	if (nodes.length > 0) {
		parts.push("\nNodes:");
		for (const node of nodes) {
			parts.push(
				`  - "${node.label}" (${node.type}) at position (${node.x}, ${node.y})`,
			);
		}
	}

	// Describe connections/flow
	if (edges.length > 0) {
		parts.push("\nConnections (flow):");
		for (const edge of edges) {
			const arrow = edge.type === "arrow" ? "→" : "—";
			parts.push(`  - "${edge.fromLabel}" ${arrow} "${edge.toLabel}"`);
		}
	}

	return parts.join("\n");
}
