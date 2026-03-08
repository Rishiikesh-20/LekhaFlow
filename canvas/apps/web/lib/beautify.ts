/**
 * ============================================================================
 * LEKHAFLOW - SMART SKETCH BEAUTIFICATION
 * ============================================================================
 *
 * Detects shapes from rough hand-drawn freedraw strokes and converts them
 * into clean geometric elements (rectangle, ellipse, diamond, arrow, line).
 *
 * ALGORITHM OVERVIEW:
 *
 * 1. Normalize the freedraw points to a bounding box.
 * 2. Compute geometric features: convex hull, corner count, circularity,
 *    linearity, and aspect ratio.
 * 3. Classify the stroke using a heuristic decision tree.
 * 4. Generate the clean replacement element.
 *
 * SHAPE HEURISTICS:
 * ┌─────────────┬──────────────────────────────────────────────────────────┐
 * │ Shape       │ Detection criteria                                      │
 * ├─────────────┼──────────────────────────────────────────────────────────┤
 * │ Line/Arrow  │ High linearity (points close to a line), low area       │
 * │ Rectangle   │ ~4 corners, low circularity, closed stroke              │
 * │ Diamond     │ ~4 corners, rotated ~45°, closed stroke                 │
 * │ Ellipse     │ High circularity, closed stroke                         │
 * └─────────────┴──────────────────────────────────────────────────────────┘
 */

import type {
	ArrowElement,
	CanvasElement,
	DiamondElement,
	EllipseElement,
	FreedrawElement,
	LineElement,
	Point,
	RectangleElement,
} from "@repo/common";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// TYPES
// ============================================================================

export type DetectedShape =
	| "rectangle"
	| "ellipse"
	| "diamond"
	| "line"
	| "arrow";

export interface ShapeDetectionResult {
	shape: DetectedShape;
	confidence: number;
	boundingBox: { x: number; y: number; width: number; height: number };
	/** For line/arrow: start and end points */
	endpoints?: { start: Point; end: Point };
}

// ============================================================================
// SAFE ARRAY HELPERS
// ============================================================================

const ORIGIN: Point = { x: 0, y: 0 };

/** Safely get the first element of an array */
function head(pts: Point[]): Point {
	return pts[0] ?? ORIGIN;
}

/** Safely get the last element of an array */
function tail(pts: Point[]): Point {
	return pts[pts.length - 1] ?? ORIGIN;
}

/** Safely get an element at index */
function at(pts: Point[], i: number): Point {
	return pts[i] ?? ORIGIN;
}

// ============================================================================
// POINT UTILITIES
// ============================================================================

/** Euclidean distance between two points */
function dist(
	a: { x: number; y: number },
	b: { x: number; y: number },
): number {
	return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Compute the total path length of a polyline */
function pathLength(pts: Point[]): number {
	let len = 0;
	for (let i = 1; i < pts.length; i++) {
		len += dist(at(pts, i - 1), at(pts, i));
	}
	return len;
}

/** Convert freedraw points (tuples) to Point objects */
function toPoints(raw: Array<[number, number, number?]>): Point[] {
	return raw.map(([x, y]) => ({ x, y }));
}

/** Compute axis-aligned bounding box */
function computeBBox(pts: Point[]): {
	x: number;
	y: number;
	width: number;
	height: number;
	cx: number;
	cy: number;
} {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const p of pts) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}
	const width = maxX - minX;
	const height = maxY - minY;
	return {
		x: minX,
		y: minY,
		width,
		height,
		cx: minX + width / 2,
		cy: minY + height / 2,
	};
}

/**
 * Perpendicular distance from point P to line segment AB.
 */
function perpendicularDist(p: Point, a: Point, b: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) return dist(p, a);
	const t = Math.max(
		0,
		Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
	);
	return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

// ============================================================================
// GEOMETRIC FEATURES
// ============================================================================

/**
 * Check if stroke is "closed" — the first and last points are close together
 * relative to the bounding box diagonal.
 */
function isClosed(pts: Point[], bbox: ReturnType<typeof computeBBox>): boolean {
	if (pts.length < 3) return false;
	const diag = Math.sqrt(bbox.width ** 2 + bbox.height ** 2);
	if (diag === 0) return true;
	return dist(head(pts), tail(pts)) / diag < 0.2;
}

/**
 * Compute linearity: how close all points are to the line from first to last.
 * Returns a value 0–1 where 1 = perfectly straight.
 */
function computeLinearity(pts: Point[]): number {
	if (pts.length < 2) return 1;
	const f = head(pts);
	const l = tail(pts);
	const d = dist(f, l);
	if (d === 0) return 0; // degenerate — it's a dot, not a line
	let maxDev = 0;
	for (const p of pts) {
		const dev = perpendicularDist(p, f, l);
		if (dev > maxDev) maxDev = dev;
	}
	return 1 - Math.min(maxDev / d, 1);
}

/**
 * Ramer-Douglas-Peucker simplification to extract corners.
 * Returns the simplified polygon.
 */
function rdpSimplify(pts: Point[], epsilon: number): Point[] {
	if (pts.length <= 2) return [...pts];

	const f = head(pts);
	const l = tail(pts);
	let maxDist = 0;
	let maxIdx = 0;

	for (let i = 1; i < pts.length - 1; i++) {
		const d = perpendicularDist(at(pts, i), f, l);
		if (d > maxDist) {
			maxDist = d;
			maxIdx = i;
		}
	}

	if (maxDist > epsilon) {
		const left = rdpSimplify(pts.slice(0, maxIdx + 1), epsilon);
		const right = rdpSimplify(pts.slice(maxIdx), epsilon);
		return [...left.slice(0, -1), ...right];
	}
	return [f, l];
}

/**
 * Count corners by applying RDP simplification and counting the resulting
 * vertices (minus 1 if the stroke is closed, since first ≈ last).
 */
function countCorners(
	pts: Point[],
	bbox: ReturnType<typeof computeBBox>,
): number {
	const diag = Math.sqrt(bbox.width ** 2 + bbox.height ** 2);
	// Epsilon as percentage of diagonal — tuned for hand-drawn roughness
	const epsilon = diag * 0.06;
	const simplified = rdpSimplify(pts, epsilon);
	const closed = isClosed(pts, bbox);
	// If the stroke is closed, the first and last point are basically duplicates
	return closed ? Math.max(simplified.length - 1, 0) : simplified.length;
}

/**
 * Compute circularity using the isoperimetric quotient:
 *   Q = 4π · Area / Perimeter²
 * Q=1 for a perfect circle, Q<1 for other shapes.
 *
 * We approximate area using the shoelace formula, and perimeter = total path length.
 */
function computeCircularity(pts: Point[]): number {
	if (pts.length < 3) return 0;

	// Shoelace formula for area
	let area = 0;
	for (let i = 0; i < pts.length; i++) {
		const cur = at(pts, i);
		const next = at(pts, (i + 1) % pts.length);
		area += cur.x * next.y - next.x * cur.y;
	}
	area = Math.abs(area) / 2;

	const perim = pathLength(pts) + dist(tail(pts), head(pts));
	if (perim === 0) return 0;
	return (4 * Math.PI * area) / (perim * perim);
}

/**
 * Check if corners are at approximately 45° rotated positions (diamond detection).
 * A diamond has vertices at top, right, bottom, left of its bbox center.
 */
function isDiamondLike(
	pts: Point[],
	bbox: ReturnType<typeof computeBBox>,
): boolean {
	const diag = Math.sqrt(bbox.width ** 2 + bbox.height ** 2);
	const epsilon = diag * 0.06;
	const simplified = rdpSimplify(pts, epsilon);
	const corners = isClosed(pts, bbox) ? simplified.slice(0, -1) : simplified;

	if (corners.length < 4 || corners.length > 6) return false;

	// Expected diamond vertices: top-center, right-center, bottom-center, left-center
	const expected: Point[] = [
		{ x: bbox.cx, y: bbox.y }, // top
		{ x: bbox.x + bbox.width, y: bbox.cy }, // right
		{ x: bbox.cx, y: bbox.y + bbox.height }, // bottom
		{ x: bbox.x, y: bbox.cy }, // left
	];

	// For each expected vertex, find closest actual corner
	const threshold = diag * 0.25;
	let matchCount = 0;
	for (const exp of expected) {
		let minD = Number.POSITIVE_INFINITY;
		for (const c of corners) {
			const d = dist(c, exp);
			if (d < minD) minD = d;
		}
		if (minD < threshold) matchCount++;
	}

	return matchCount >= 3; // allow one vertex to be off
}

/**
 * Check if the RDP-simplified polygon has "sharp" corners characteristic
 * of polygonal shapes (rectangles, diamonds) rather than smooth curves (circles).
 *
 * Measures interior angles at each vertex of the simplified polygon.
 * Rectangle corners are ~90°; circle vertices from RDP are obtuse (>115°).
 *
 * @returns true if at least 3 corners have an interior angle < 115°.
 */
function hasSharpCorners(
	pts: Point[],
	bbox: ReturnType<typeof computeBBox>,
): boolean {
	const diag = Math.sqrt(bbox.width ** 2 + bbox.height ** 2);
	const epsilon = diag * 0.06;
	const simplified = rdpSimplify(pts, epsilon);
	const closed = isClosed(pts, bbox);
	const vertices = closed ? simplified.slice(0, -1) : simplified;

	if (vertices.length < 3) return false;

	let sharpCount = 0;
	const n = vertices.length;
	for (let i = 0; i < n; i++) {
		const prev = at(vertices, (i - 1 + n) % n);
		const curr = at(vertices, i);
		const next = at(vertices, (i + 1) % n);

		const v1x = prev.x - curr.x;
		const v1y = prev.y - curr.y;
		const v2x = next.x - curr.x;
		const v2y = next.y - curr.y;
		const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
		const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
		if (len1 === 0 || len2 === 0) continue;

		const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
		const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
		const angleDeg = (angle * 180) / Math.PI;

		// Polygon corners (rectangles/diamonds) are typically < 115°
		// Curve-approx vertices from RDP on circles are > 115°
		if (angleDeg < 115) sharpCount++;
	}

	return sharpCount >= 3;
}

/**
 * Detect if a stroke looks like it has an arrowhead at the end.
 * We check the last portion of the stroke — if the final segment forks
 * at a sharp angle relative to the main direction, it's an arrowhead.
 */
function hasArrowHead(pts: Point[]): boolean {
	if (pts.length < 10) return false;

	// Main direction: from first to ~80% of the stroke
	const eightyPct = Math.floor(pts.length * 0.8);
	const ptAt80 = at(pts, eightyPct);
	const ptFirst = head(pts);
	const ptLast = tail(pts);

	const mainDir = {
		x: ptAt80.x - ptFirst.x,
		y: ptAt80.y - ptFirst.y,
	};
	const mainLen = Math.sqrt(mainDir.x ** 2 + mainDir.y ** 2);
	if (mainLen === 0) return false;

	// End direction: from 80% point to end
	const endDir = {
		x: ptLast.x - ptAt80.x,
		y: ptLast.y - ptAt80.y,
	};
	const endLen = Math.sqrt(endDir.x ** 2 + endDir.y ** 2);
	if (endLen === 0) return false;

	// Angle between main direction and end direction
	const dot =
		(mainDir.x * endDir.x + mainDir.y * endDir.y) / (mainLen * endLen);
	const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

	// Arrow heads typically change direction by 20-160 degrees
	const angleDeg = (angle * 180) / Math.PI;
	return angleDeg > 20 && angleDeg < 160;
}

// ============================================================================
// SHAPE DETECTION
// ============================================================================

/**
 * Detect what shape a freedraw stroke most likely represents.
 *
 * Decision tree:
 * 1. If very linear (linearity > 0.85) → line or arrow
 * 2. If closed stroke:
 *    a. If high circularity AND no sharp corners → ellipse
 *       (RDP reduces circles to 4-7 vertices, but angles are obtuse >115°)
 *    b. If diamond-like (vertices at bbox edge midpoints) → diamond
 *    c. If ~4 sharp corners (angles < 115°) → rectangle
 *    d. If moderate circularity → ellipse
 *    e. Fallback → ellipse
 * 3. If open stroke with moderate linearity → line/arrow
 * 4. Otherwise → rectangle (safest default for blobby shapes)
 */
export function detectShape(element: FreedrawElement): ShapeDetectionResult {
	const pts = toPoints(element.points);
	if (pts.length < 2) {
		return {
			shape: "rectangle",
			confidence: 0.3,
			boundingBox: { x: element.x, y: element.y, width: 10, height: 10 },
		};
	}

	const bbox = computeBBox(pts);
	const linearity = computeLinearity(pts);
	const closed = isClosed(pts, bbox);
	const corners = countCorners(pts, bbox);
	const circularity = closed ? computeCircularity(pts) : 0;

	// Absolute (canvas-space) bounding box
	const absBBox = {
		x: element.x + bbox.x,
		y: element.y + bbox.y,
		width: Math.max(bbox.width, 4),
		height: Math.max(bbox.height, 4),
	};

	// ── LINE / ARROW ──────────────────────────────────────────────
	if (linearity > 0.85 && !closed) {
		const f = head(pts);
		const l = tail(pts);
		const startPt: Point = { x: element.x + f.x, y: element.y + f.y };
		const endPt: Point = { x: element.x + l.x, y: element.y + l.y };
		const isArrow = hasArrowHead(pts);
		return {
			shape: isArrow ? "arrow" : "line",
			confidence: 0.7 + linearity * 0.3,
			boundingBox: absBBox,
			endpoints: { start: startPt, end: endPt },
		};
	}

	// ── CLOSED SHAPES ─────────────────────────────────────────────
	// We use corner angles (hasSharpCorners) to discriminate polygons from curves.
	// RDP simplification reduces both circles and rectangles to ~4-7 vertices,
	// but rectangle vertices have ~90° angles while circle vertices are >115°.
	const sharp = closed ? hasSharpCorners(pts, bbox) : false;

	if (closed) {
		// Ellipse: high circularity AND no sharp polygon-like corners
		// This catches circles/ovals that RDP would otherwise reduce to 4-7 vertices
		if (circularity > 0.55 && !sharp) {
			return {
				shape: "ellipse",
				confidence: 0.6 + circularity * 0.4,
				boundingBox: absBBox,
			};
		}

		// Diamond: 4-6 corners, vertices at midpoints of bbox edges
		if (corners >= 4 && corners <= 6 && isDiamondLike(pts, bbox)) {
			return {
				shape: "diamond",
				confidence: 0.75,
				boundingBox: absBBox,
			};
		}

		// Rectangle: ~4 sharp corners forming a box
		if (corners >= 4 && corners <= 7 && sharp) {
			return {
				shape: "rectangle",
				confidence: 0.6 + (corners === 4 || corners === 5 ? 0.25 : 0.1),
				boundingBox: absBBox,
			};
		}

		// Moderate circularity without sharp corners → ellipse
		if (circularity > 0.4) {
			return {
				shape: "ellipse",
				confidence: 0.5 + circularity * 0.4,
				boundingBox: absBBox,
			};
		}

		// Rounded blob → ellipse as fallback for closed shapes
		return {
			shape: "ellipse",
			confidence: 0.4,
			boundingBox: absBBox,
		};
	}

	// ── OPEN SHAPES (moderate linearity) ──────────────────────────
	if (linearity > 0.6) {
		const f = head(pts);
		const l = tail(pts);
		const startPt: Point = { x: element.x + f.x, y: element.y + f.y };
		const endPt: Point = { x: element.x + l.x, y: element.y + l.y };
		return {
			shape: hasArrowHead(pts) ? "arrow" : "line",
			confidence: 0.5 + linearity * 0.3,
			boundingBox: absBBox,
			endpoints: { start: startPt, end: endPt },
		};
	}

	// ── FALLBACK ──────────────────────────────────────────────────
	return {
		shape: "rectangle",
		confidence: 0.4,
		boundingBox: absBBox,
	};
}

// ============================================================================
// ELEMENT GENERATION
// ============================================================================

/**
 * Create base element properties, inheriting style from the original freedraw.
 */
function baseProps(
	original: FreedrawElement,
	zIndex: number,
): Omit<CanvasElement, "type"> {
	return {
		id: uuidv4(),
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		angle: 0,
		strokeColor: original.strokeColor,
		backgroundColor: original.backgroundColor,
		strokeWidth: original.strokeWidth,
		strokeStyle: original.strokeStyle,
		fillStyle: original.fillStyle,
		opacity: original.opacity,
		roughness: 0,
		seed: Math.floor(Math.random() * 2147483647),
		version: 1,
		versionNonce: Math.floor(Math.random() * 2147483647),
		isDeleted: false,
		groupIds: [],
		boundElements: null,
		updated: Date.now(),
		link: null,
		locked: false,
		zIndex,
	};
}

/**
 * Build a clean replacement element from a detection result and the original
 * freedraw element.
 */
export function buildCleanElement(
	original: FreedrawElement,
	detection: ShapeDetectionResult,
	zIndex: number,
): CanvasElement {
	const base = baseProps(original, zIndex);
	const { x, y, width, height } = detection.boundingBox;

	switch (detection.shape) {
		case "rectangle":
			return {
				...base,
				type: "rectangle",
				x,
				y,
				width,
				height,
				roundness: null,
			} as RectangleElement;

		case "ellipse":
			return {
				...base,
				type: "ellipse",
				x,
				y,
				width,
				height,
			} as EllipseElement;

		case "diamond":
			return {
				...base,
				type: "diamond",
				x,
				y,
				width,
				height,
			} as DiamondElement;

		case "line": {
			const start = detection.endpoints?.start ?? { x, y };
			const end = detection.endpoints?.end ?? { x: x + width, y: y + height };
			return {
				...base,
				type: "line",
				x: start.x,
				y: start.y,
				width: Math.abs(end.x - start.x),
				height: Math.abs(end.y - start.y),
				points: [
					{ x: 0, y: 0 },
					{ x: end.x - start.x, y: end.y - start.y },
				],
				startArrowhead: null,
				endArrowhead: null,
				startBinding: null,
				endBinding: null,
			} as LineElement;
		}

		case "arrow": {
			const start = detection.endpoints?.start ?? { x, y };
			const end = detection.endpoints?.end ?? { x: x + width, y: y + height };
			return {
				...base,
				type: "arrow",
				x: start.x,
				y: start.y,
				width: Math.abs(end.x - start.x),
				height: Math.abs(end.y - start.y),
				points: [
					{ x: 0, y: 0 },
					{ x: end.x - start.x, y: end.y - start.y },
				],
				startArrowhead: null,
				endArrowhead: "arrow",
				startBinding: null,
				endBinding: null,
			} as ArrowElement;
		}
	}
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface BeautifyResult {
	/** The original freedraw IDs that were replaced */
	removedIds: string[];
	/** The new clean elements that replace them */
	newElements: CanvasElement[];
}

/**
 * Beautify selected freedraw elements.
 *
 * @param elements - All selected elements (non-freedraw are ignored)
 * @param getNextZIndex - Returns the next available z-index
 * @returns Object with IDs to remove and new elements to add
 */
export function beautifyElements(
	elements: CanvasElement[],
	getNextZIndex: () => number,
): BeautifyResult {
	const removedIds: string[] = [];
	const newElements: CanvasElement[] = [];

	for (const el of elements) {
		if (el.type !== "freedraw") continue;
		const fd = el as FreedrawElement;

		// Need at least a few points to detect a shape
		if (fd.points.length < 4) continue;

		const detection = detectShape(fd);

		// Only beautify if confidence is reasonable
		if (detection.confidence < 0.35) continue;

		const clean = buildCleanElement(fd, detection, getNextZIndex());
		removedIds.push(fd.id);
		newElements.push(clean);
	}

	return { removedIds, newElements };
}
