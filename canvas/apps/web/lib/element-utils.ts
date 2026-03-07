/**
 * ============================================================================
 * LEKHAFLOW - ELEMENT UTILITIES
 * ============================================================================
 *
 * Utility functions for creating, manipulating, and testing canvas elements.
 *
 * LINE-BY-LINE EXPLANATION:
 *
 * These utilities handle:
 * 1. Element creation with proper defaults
 * 2. Bounding box calculations
 * 3. Hit testing (is point inside element?)
 * 4. Element transformations
 */

import {
	type ArrowElement,
	type BoundingBox,
	type CanvasElement,
	DEFAULT_ELEMENT_PROPS,
	type ElementType,
	type EllipseElement,
	type FreedrawElement,
	type LineElement,
	type Point,
	type RectangleElement,
	type TextElement,
} from "@repo/common";
import { v4 as uuidv4 } from "uuid";

// Re-export for consumers that import from this file
export { DEFAULT_ELEMENT_PROPS };

// ============================================================================
// TYPES
// ============================================================================

export interface ShapeModifiers {
	shift?: boolean;
	alt?: boolean;
}

// ============================================================================
// ELEMENT CREATION
// ============================================================================

/**
 * Generate base properties for any element
 *
 * @param type - Element type
 * @param x - Starting X position
 * @param y - Starting Y position
 * @param options - Override options
 * @returns Base element properties
 *
 * VERSIONING:
 * - version: Starts at 1, incremented on each change
 * - versionNonce: Random number for tie-breaking concurrent edits
 *   If two clients edit at the same version, nonce determines winner
 */
function createBaseElement(
	_type: ElementType,
	x: number,
	y: number,
	options: Partial<CanvasElement> = {},
): Omit<CanvasElement, "type"> {
	return {
		id: uuidv4(),
		x,
		y,
		width: 0,
		height: 0,
		angle: options.angle ?? DEFAULT_ELEMENT_PROPS.angle,
		strokeColor: options.strokeColor ?? DEFAULT_ELEMENT_PROPS.strokeColor,
		backgroundColor:
			options.backgroundColor ?? DEFAULT_ELEMENT_PROPS.backgroundColor,
		strokeWidth: options.strokeWidth ?? DEFAULT_ELEMENT_PROPS.strokeWidth,
		strokeStyle: options.strokeStyle ?? DEFAULT_ELEMENT_PROPS.strokeStyle,
		fillStyle: options.fillStyle ?? DEFAULT_ELEMENT_PROPS.fillStyle,
		opacity: options.opacity ?? DEFAULT_ELEMENT_PROPS.opacity,
		roughness: options.roughness ?? DEFAULT_ELEMENT_PROPS.roughness,
		seed: Math.floor(Math.random() * 2147483647),
		roughStyle: options.roughStyle ?? undefined,
		version: 1,
		versionNonce: Math.floor(Math.random() * 2147483647),
		isDeleted: false,
		groupIds: [],
		boundElements: null,
		updated: Date.now(),
		link: null,
		locked: options.locked ?? DEFAULT_ELEMENT_PROPS.locked,
		zIndex: options.zIndex ?? 0,
	};
}

/**
 * Create a rectangle element
 */
export function createRectangle(
	x: number,
	y: number,
	width: number,
	height: number,
	options: Partial<RectangleElement> = {},
): RectangleElement {
	return {
		...createBaseElement("rectangle", x, y, options),
		type: "rectangle",
		width,
		height,
		roundness: options.roundness ?? null,
	} as RectangleElement;
}

/**
 * Create an ellipse element
 */
export function createEllipse(
	x: number,
	y: number,
	width: number,
	height: number,
	options: Partial<EllipseElement> = {},
): EllipseElement {
	return {
		...createBaseElement("ellipse", x, y, options),
		type: "ellipse",
		width,
		height,
	} as EllipseElement;
}

/**
 * Create a diamond element
 */
export function createDiamond(
	x: number,
	y: number,
	width: number,
	height: number,
	options: Partial<CanvasElement> = {},
): CanvasElement {
	return {
		...createBaseElement("diamond", x, y, options),
		type: "diamond",
		width,
		height,
	} as CanvasElement;
}

/**
 * Create a shape (rectangle, ellipse, or diamond) with modifiers
 *
 * @param type - Shape type
 * @param x - X position
 * @param y - Y position
 * @param width - Width
 * @param height - Height
 * @param modifiers - Shift (square/circle) and Alt (center origin)
 * @param options - Element options
 */
export function createShape(
	type: "rectangle" | "ellipse" | "diamond",
	x: number,
	y: number,
	width: number,
	height: number,
	modifiers: ShapeModifiers,
	options: Partial<CanvasElement> = {},
): CanvasElement {
	let adjustedWidth = width;
	let adjustedHeight = height;
	let adjustedX = x;
	let adjustedY = y;

	// Shift: Make square/circle (equal dimensions)
	if (modifiers.shift) {
		const size = Math.max(Math.abs(width), Math.abs(height));
		adjustedWidth = width < 0 ? -size : size;
		adjustedHeight = height < 0 ? -size : size;
	}

	// Alt: Draw from center
	if (modifiers.alt) {
		adjustedX = x - adjustedWidth;
		adjustedY = y - adjustedHeight;
		adjustedWidth = adjustedWidth * 2;
		adjustedHeight = adjustedHeight * 2;
	}

	switch (type) {
		case "rectangle":
			return createRectangle(
				adjustedX,
				adjustedY,
				adjustedWidth,
				adjustedHeight,
				// biome-ignore lint/suspicious/noExplicitAny: options is a partial of CanvasElement union, safe to pass to specific creator
				options as any,
			);
		case "ellipse":
			return createEllipse(
				adjustedX,
				adjustedY,
				adjustedWidth,
				adjustedHeight,
				// biome-ignore lint/suspicious/noExplicitAny: options is a partial of CanvasElement union, safe to pass to specific creator
				options as any,
			);
		case "diamond":
			return createDiamond(
				adjustedX,
				adjustedY,
				adjustedWidth,
				adjustedHeight,
				// biome-ignore lint/suspicious/noExplicitAny: options is a partial of CanvasElement union, safe to pass to specific creator
				options as any,
			);
	}
}

/**
 * Create a line element
 *
 * @param points - Array of points relative to element origin
 */
export function createLine(
	x: number,
	y: number,
	points: Point[],
	options: Partial<LineElement> = {},
): LineElement {
	// Calculate bounding box from points
	const { width, height } = calculatePointsBounds(points);

	return {
		...createBaseElement("line", x, y, options),
		type: "line",
		width,
		height,
		points,
		startArrowhead: options.startArrowhead ?? null,
		endArrowhead: options.endArrowhead ?? null,
		startBinding: null,
		endBinding: null,
	} as LineElement;
}

/**
 * Create an arrow element
 */
export function createArrow(
	x: number,
	y: number,
	points: Point[],
	options: Partial<ArrowElement> = {},
): ArrowElement {
	const { width, height } = calculatePointsBounds(points);

	return {
		...createBaseElement("arrow", x, y, options),
		type: "arrow",
		width,
		height,
		points,
		startArrowhead: options.startArrowhead ?? null,
		endArrowhead: options.endArrowhead ?? "arrow",
		startBinding: null,
		endBinding: null,
	} as ArrowElement;
}

/**
 * Create a freedraw element
 *
 * @param points - Array of [x, y, pressure?] tuples
 */
export function createFreedraw(
	x: number,
	y: number,
	points: Array<[number, number, number?]>,
	options: Partial<FreedrawElement> = {},
): FreedrawElement {
	// Calculate bounds from points
	let minX = Infinity,
		maxX = -Infinity;
	let minY = Infinity,
		maxY = -Infinity;

	for (const [px, py] of points) {
		minX = Math.min(minX, px);
		maxX = Math.max(maxX, px);
		minY = Math.min(minY, py);
		maxY = Math.max(maxY, py);
	}

	return {
		...createBaseElement("freedraw", x, y, options),
		type: "freedraw",
		width: maxX - minX || 1,
		height: maxY - minY || 1,
		points,
		pressures: points.map((p) => p[2] ?? 0.5),
		simulatePressure: true,
		brushType: options.brushType ?? "pencil",
		seedId: options.seedId ?? uuidv4(),
	} as FreedrawElement;
}

/**
 * Create a text element
 */
export function createText(
	x: number,
	y: number,
	text: string,
	options: Partial<TextElement> = {},
): TextElement {
	// Estimate text dimensions (will be measured more accurately in renderer)
	const fontSize = options.fontSize ?? 20;
	const lines = text.split("\n");
	const maxLineLength = Math.max(...lines.map((l) => l.length));

	// Use provided dimensions or calculate based on text content
	const width = options.width ?? maxLineLength * fontSize * 0.6;
	const height = options.height ?? lines.length * fontSize * 1.2;

	return {
		...createBaseElement("text", x, y, options),
		type: "text",
		width,
		height,
		text,
		fontSize,
		fontFamily: options.fontFamily ?? 1,
		textAlign: options.textAlign ?? "left",
		verticalAlign: options.verticalAlign ?? "top",
		lineHeight: options.lineHeight ?? 1.25,
		containerId: options.containerId ?? null,
		originalText: text,
	} as TextElement;
}

// ============================================================================
// BOUNDING BOX CALCULATIONS
// ============================================================================

/**
 * Calculate bounding box for points array
 */
function calculatePointsBounds(points: Point[]): {
	width: number;
	height: number;
} {
	if (points.length === 0) return { width: 0, height: 0 };

	let minX = Infinity,
		maxX = -Infinity;
	let minY = Infinity,
		maxY = -Infinity;

	for (const point of points) {
		minX = Math.min(minX, point.x);
		maxX = Math.max(maxX, point.x);
		minY = Math.min(minY, point.y);
		maxY = Math.max(maxY, point.y);
	}

	return {
		width: maxX - minX || 1,
		height: maxY - minY || 1,
	};
}

/**
 * Get bounding box for any element
 *
 * @param element - Canvas element
 * @returns Bounding box in canvas coordinates
 *
 * NOTE: Does NOT account for rotation!
 * For rotated elements, use getRotatedBoundingBox
 */
export function getElementBounds(element: CanvasElement): BoundingBox {
	return {
		x: element.x,
		y: element.y,
		width: Math.abs(element.width),
		height: Math.abs(element.height),
	};
}

/**
 * Get bounding box that accounts for rotation
 *
 * When an element is rotated, its axis-aligned bounding box
 * is larger than the element itself.
 */
export function getRotatedBoundingBox(element: CanvasElement): BoundingBox {
	if (element.angle === 0) {
		return getElementBounds(element);
	}

	// Get the four corners of the element
	const cx = element.x + element.width / 2;
	const cy = element.y + element.height / 2;
	const corners = [
		{ x: element.x, y: element.y },
		{ x: element.x + element.width, y: element.y },
		{ x: element.x + element.width, y: element.y + element.height },
		{ x: element.x, y: element.y + element.height },
	];

	// Rotate each corner
	const angleRad = (element.angle * Math.PI) / 180;
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);

	const rotatedCorners = corners.map((corner) => ({
		x: cx + (corner.x - cx) * cos - (corner.y - cy) * sin,
		y: cy + (corner.x - cx) * sin + (corner.y - cy) * cos,
	}));

	// Find bounding box of rotated corners
	let minX = Infinity,
		maxX = -Infinity;
	let minY = Infinity,
		maxY = -Infinity;

	for (const corner of rotatedCorners) {
		minX = Math.min(minX, corner.x);
		maxX = Math.max(maxX, corner.x);
		minY = Math.min(minY, corner.y);
		maxY = Math.max(maxY, corner.y);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

/**
 * Get combined bounding box for multiple elements
 */
export function getCombinedBounds(
	elements: CanvasElement[],
): BoundingBox | null {
	if (elements.length === 0) return null;

	let minX = Infinity,
		maxX = -Infinity;
	let minY = Infinity,
		maxY = -Infinity;

	for (const element of elements) {
		const bounds = getRotatedBoundingBox(element);
		minX = Math.min(minX, bounds.x);
		maxX = Math.max(maxX, bounds.x + bounds.width);
		minY = Math.min(minY, bounds.y);
		maxY = Math.max(maxY, bounds.y + bounds.height);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

// ============================================================================
// HIT TESTING
// ============================================================================

/**
 * Check if a point is inside an element
 *
 * @param point - Point to test
 * @param element - Element to test against
 * @param threshold - Additional padding for easier selection (pixels)
 * @returns true if point is inside element
 *
 * HIT TESTING STRATEGY:
 * - Rectangle: Simple bounds check
 * - Ellipse: Distance from center check
 * - Line/Arrow: Distance to line segment
 * - Freedraw: Distance to any point in path
 * - Text: Bounds check
 */
export function isPointInElement(
	point: Point,
	element: CanvasElement,
	threshold = 10,
): boolean {
	// If the element is rotated, un-rotate the test point around the element
	// center so that axis-aligned hit tests work in local coordinates.
	let testPoint = point;
	if (element.angle && element.angle !== 0) {
		const cx = element.x + element.width / 2;
		const cy = element.y + element.height / 2;
		const rad = (-element.angle * Math.PI) / 180; // negative = un-rotate
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		testPoint = {
			x: cx + (point.x - cx) * cos - (point.y - cy) * sin,
			y: cy + (point.x - cx) * sin + (point.y - cy) * cos,
		};
	}

	switch (element.type) {
		case "rectangle":
		case "text":
			return isPointInRectangle(testPoint, element, threshold);

		case "ellipse":
			return isPointInEllipse(testPoint, element, threshold);

		case "diamond":
			return isPointInDiamond(testPoint, element, threshold);

		case "line":
		case "arrow":
			return isPointNearLine(
				testPoint,
				element as LineElement | ArrowElement,
				threshold,
			);

		case "freedraw":
			return isPointNearFreedraw(
				testPoint,
				element as FreedrawElement,
				threshold,
			);

		default:
			return false;
	}
}

/**
 * Check if point is in rectangle bounds
 */
function isPointInRectangle(
	point: Point,
	element: CanvasElement,
	threshold: number,
): boolean {
	const x = element.x - threshold;
	const y = element.y - threshold;
	const width = Math.abs(element.width) + threshold * 2;
	const height = Math.abs(element.height) + threshold * 2;

	return (
		point.x >= x &&
		point.x <= x + width &&
		point.y >= y &&
		point.y <= y + height
	);
}

/**
 * Check if point is in ellipse
 *
 * Uses the ellipse equation: (x/a)² + (y/b)² <= 1
 */
function isPointInEllipse(
	point: Point,
	element: CanvasElement,
	threshold: number,
): boolean {
	const cx = element.x + element.width / 2;
	const cy = element.y + element.height / 2;
	const rx = Math.abs(element.width) / 2 + threshold;
	const ry = Math.abs(element.height) / 2 + threshold;

	const dx = point.x - cx;
	const dy = point.y - cy;

	return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

/**
 * Check if point is in diamond (rhombus)
 *
 * A diamond is defined by 4 vertices: top, right, bottom, left
 * Uses the Manhattan distance formula normalized by half-dimensions
 * |dx|/(w/2) + |dy|/(h/2) <= 1
 */
function isPointInDiamond(
	point: Point,
	element: CanvasElement,
	threshold: number,
): boolean {
	const cx = element.x + element.width / 2;
	const cy = element.y + element.height / 2;
	const halfWidth = Math.abs(element.width) / 2 + threshold;
	const halfHeight = Math.abs(element.height) / 2 + threshold;

	const dx = Math.abs(point.x - cx);
	const dy = Math.abs(point.y - cy);

	// Point is inside diamond if normalized Manhattan distance <= 1
	return dx / halfWidth + dy / halfHeight <= 1;
}

/**
 * Check if point is near a line segment
 */
function isPointNearLine(
	point: Point,
	element: LineElement | ArrowElement,
	threshold: number,
): boolean {
	const { x, y, points } = element;

	// Check distance to each line segment
	for (let i = 0; i < points.length - 1; i++) {
		// biome-ignore lint/style/noNonNullAssertion: Points are guaranteed to exist by loop bounds
		const p1 = { x: x + points[i]!.x, y: y + points[i]!.y };
		// biome-ignore lint/style/noNonNullAssertion: Points are guaranteed to exist by loop bounds
		const p2 = { x: x + points[i + 1]!.x, y: y + points[i + 1]!.y };

		const dist = pointToSegmentDistance(point, p1, p2);
		if (dist <= threshold + element.strokeWidth / 2) {
			return true;
		}
	}

	return false;
}

/**
 * Check if point is near a freedraw path
 */
function isPointNearFreedraw(
	point: Point,
	element: FreedrawElement,
	threshold: number,
): boolean {
	const { x, y, points, strokeWidth } = element;

	// Check if point is near any line segment in the freedraw path
	for (let i = 0; i < points.length - 1; i++) {
		// biome-ignore lint/style/noNonNullAssertion: Points are guaranteed to exist by loop bounds
		const p1 = { x: x + points[i]![0], y: y + points[i]![1] };
		// biome-ignore lint/style/noNonNullAssertion: Points are guaranteed to exist by loop bounds
		const p2 = { x: x + points[i + 1]![0], y: y + points[i + 1]![1] };

		const dist = pointToSegmentDistance(point, p1, p2);
		if (dist <= threshold + strokeWidth / 2) {
			return true;
		}
	}

	return false;
}

/**
 * Calculate distance from point to line segment
 *
 * Uses projection formula to find closest point on segment
 */
function pointToSegmentDistance(point: Point, p1: Point, p2: Point): number {
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;
	const lengthSq = dx * dx + dy * dy;

	if (lengthSq === 0) {
		// Segment is a point
		return Math.hypot(point.x - p1.x, point.y - p1.y);
	}

	// Project point onto line, clamped to segment
	let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));

	const closestX = p1.x + t * dx;
	const closestY = p1.y + t * dy;

	return Math.hypot(point.x - closestX, point.y - closestY);
}

// ============================================================================
// ELEMENT AT POINT
// ============================================================================

/**
 * Find the topmost element at a point
 *
 * @param point - Point to test
 * @param elements - Array of elements (ordered back-to-front)
 * @returns Element at point, or null
 *
 * We iterate in reverse (front-to-back) to get the topmost element
 */
export function getElementAtPoint(
	point: Point,
	elements: CanvasElement[],
): CanvasElement | null {
	// Iterate in reverse to check topmost elements first
	for (let i = elements.length - 1; i >= 0; i--) {
		const element = elements[i];
		if (element && !element.isDeleted && isPointInElement(point, element)) {
			return element;
		}
	}
	return null;
}

/**
 * Find ALL elements at a point, sorted by zIndex (topmost first).
 *
 * Used for:
 * - Layer cycling (Alt+Click to select elements below the top one)
 * - Unified hit testing that checks all overlapping objects
 *
 * @param point - Point to test
 * @param elements - Array of elements (any order)
 * @returns Array of hit elements, sorted topmost-first by zIndex
 */
export function getAllElementsAtPoint(
	point: Point,
	elements: CanvasElement[],
): CanvasElement[] {
	const hits: CanvasElement[] = [];
	for (const element of elements) {
		if (!element.isDeleted && isPointInElement(point, element)) {
			hits.push(element);
		}
	}
	// Sort by zIndex descending (topmost first)
	hits.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
	return hits;
}

/**
 * Normalize a rectangle so width/height are always positive.
 * Handles marquee rects where the user dragged left/up.
 */
export function normalizeRect(rect: BoundingBox): BoundingBox {
	return {
		x: rect.width < 0 ? rect.x + rect.width : rect.x,
		y: rect.height < 0 ? rect.y + rect.height : rect.y,
		width: Math.abs(rect.width),
		height: Math.abs(rect.height),
	};
}

/**
 * Check whether two axis-aligned bounding boxes intersect.
 */
export function rectsIntersect(a: BoundingBox, b: BoundingBox): boolean {
	return (
		a.x < b.x + b.width &&
		a.x + a.width > b.x &&
		a.y < b.y + b.height &&
		a.y + a.height > b.y
	);
}

/**
 * Find all elements whose rotated AABB intersects a selection rectangle.
 *
 * @param selectionBox - Selection rectangle (must be normalised)
 * @param elements - Array of elements
 * @returns Array of intersecting, non-deleted elements
 */
export function getElementsInSelection(
	selectionBox: BoundingBox,
	elements: CanvasElement[],
): CanvasElement[] {
	return elements.filter((element) => {
		if (element.isDeleted) return false;
		const bounds = getRotatedBoundingBox(element);
		return rectsIntersect(selectionBox, bounds);
	});
}

// ============================================================================
// RESIZE HANDLES
// ============================================================================

/**
 * Resize handle positions
 */
export type ResizeHandle = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

/**
 * Get resize handle positions for an element
 */
export function getResizeHandles(
	element: CanvasElement,
): Record<ResizeHandle, Point> {
	const { x, y, width, height } = element;

	return {
		nw: { x, y },
		n: { x: x + width / 2, y },
		ne: { x: x + width, y },
		w: { x, y: y + height / 2 },
		e: { x: x + width, y: y + height / 2 },
		sw: { x, y: y + height },
		s: { x: x + width / 2, y: y + height },
		se: { x: x + width, y: y + height },
	};
}

/**
 * Check if point is on a resize handle
 */
export function getResizeHandleAtPoint(
	point: Point,
	element: CanvasElement,
	handleSize = 8,
): ResizeHandle | null {
	const handles = getResizeHandles(element);

	for (const [handle, pos] of Object.entries(handles)) {
		const dist = Math.hypot(point.x - pos.x, point.y - pos.y);
		if (dist <= handleSize) {
			return handle as ResizeHandle;
		}
	}

	return null;
}

// ============================================================================
// ELEMENT DUPLICATION
// ============================================================================

/**
 * Duplicate an element with new ID and position
 */
export function duplicateElement(
	element: CanvasElement,
	offsetX = 20,
	offsetY = 20,
): CanvasElement {
	return {
		...element,
		id: uuidv4(),
		x: element.x + offsetX,
		y: element.y + offsetY,
		version: 1,
		versionNonce: Math.floor(Math.random() * 2147483647),
		updated: Date.now(),
		seed: Math.floor(Math.random() * 2147483647),
	};
}
