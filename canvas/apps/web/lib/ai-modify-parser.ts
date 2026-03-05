/**
 * ============================================================================
 * LEKHAFLOW - AI MODIFICATION PARSER
 * ============================================================================
 *
 * Converts structured AI modification actions into element diffs
 * that can be applied as a preview layer.
 *
 * Pure functions — no side effects, no store access.
 */

import type { CanvasElement, ExcalidrawElementBase } from "@repo/common";

/**
 * We use Partial<ExcalidrawElementBase> for diffs rather than Partial<CanvasElement>
 * because CanvasElement is a discriminated union (keyed on `type`), and spreading
 * partial diffs from different branches is not type-safe. Since AI modifications
 * only touch shared base props (color, size, position etc.), this is correct.
 */
export type ElementDiff = Partial<ExcalidrawElementBase>;

// ============================================================================
// TYPES
// ============================================================================

/** Supported modification action types */
export type ModifyActionType =
	| "update_color"
	| "update_stroke"
	| "resize"
	| "move"
	| "delete"
	| "update_opacity"
	| "update_stroke_width";

/** Filter to select which elements to modify */
export interface ModifyFilter {
	type?:
		| "rectangle"
		| "ellipse"
		| "diamond"
		| "line"
		| "arrow"
		| "freedraw"
		| "text"
		| "all";
	strokeColor?: string;
	backgroundColor?: string;
	ids?: string[];
}

/** A single modification action from the AI */
export interface ModifyAction {
	action: ModifyActionType;
	filter: ModifyFilter;
	params: Record<string, unknown>;
}

/** Summary of what a modification will do */
export interface ModifySummary {
	description: string;
	affectedCount: number;
	affectedIds: string[];
}

// ============================================================================
// COLOR MATCHING
// ============================================================================

/**
 * Normalize hex color for comparison.
 * Handles 3-char hex shorthand (#abc → #aabbcc) and case sensitivity.
 */
function normalizeHex(color: string): string {
	if (!color) return "";
	const c = color.trim().toLowerCase();
	if (c.length === 4 && c.startsWith("#")) {
		// Expand #abc → #aabbcc
		return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
	}
	return c;
}

function colorsMatch(a: string, b: string): boolean {
	return normalizeHex(a) === normalizeHex(b);
}

// ============================================================================
// FILTER RESOLUTION
// ============================================================================

/**
 * Resolve a filter to a list of element IDs from the current elements.
 */
export function resolveFilter(
	filter: ModifyFilter,
	elements: Map<string, CanvasElement>,
): string[] {
	const allElements = Array.from(elements.values()).filter(
		(el) => !el.isDeleted,
	);

	return allElements
		.filter((el) => {
			// If specific IDs given, only match those
			if (filter.ids && filter.ids.length > 0) {
				return filter.ids.includes(el.id);
			}

			// Type filter
			if (filter.type && filter.type !== "all" && el.type !== filter.type) {
				return false;
			}

			// Stroke color filter
			if (
				filter.strokeColor &&
				!colorsMatch(el.strokeColor, filter.strokeColor)
			) {
				return false;
			}

			// Background color filter
			if (
				filter.backgroundColor &&
				!colorsMatch(el.backgroundColor, filter.backgroundColor)
			) {
				return false;
			}

			return true;
		})
		.map((el) => el.id);
}

// ============================================================================
// ACTION → DIFF
// ============================================================================

/**
 * Convert a modification action into partial element updates.
 */
function actionToDiff(action: ModifyAction): ElementDiff | null {
	switch (action.action) {
		case "update_color": {
			const diff: Record<string, unknown> = {};
			if (action.params.strokeColor)
				diff.strokeColor = action.params.strokeColor;
			if (action.params.backgroundColor)
				diff.backgroundColor = action.params.backgroundColor;
			return Object.keys(diff).length > 0 ? (diff as ElementDiff) : null;
		}

		case "update_stroke": {
			const diff: Record<string, unknown> = {};
			if (action.params.strokeWidth !== undefined)
				diff.strokeWidth = action.params.strokeWidth;
			if (action.params.strokeStyle)
				diff.strokeStyle = action.params.strokeStyle;
			return Object.keys(diff).length > 0 ? (diff as ElementDiff) : null;
		}

		case "resize": {
			const diff: Record<string, unknown> = {};
			if (action.params.width !== undefined) diff.width = action.params.width;
			if (action.params.height !== undefined)
				diff.height = action.params.height;
			return Object.keys(diff).length > 0 ? (diff as ElementDiff) : null;
		}

		case "move": {
			// Move is relative — we return dx/dy as special marker
			// The caller must add these to the element's current x/y
			return {
				x: action.params.dx as number,
				y: action.params.dy as number,
			} as ElementDiff;
		}

		case "update_opacity": {
			if (action.params.opacity !== undefined) {
				return { opacity: action.params.opacity } as ElementDiff;
			}
			return null;
		}

		case "update_stroke_width": {
			if (action.params.strokeWidth !== undefined) {
				return {
					strokeWidth: action.params.strokeWidth,
				} as ElementDiff;
			}
			return null;
		}

		case "delete": {
			return { isDeleted: true };
		}

		default:
			return null;
	}
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse AI modification actions into element diffs.
 *
 * @param actions - Array of modification actions from the AI API
 * @param elements - Current canvas elements
 * @returns Map of element ID → partial diff to apply
 */
export function parseAiModifications(
	actions: ModifyAction[],
	elements: Map<string, CanvasElement>,
): Map<string, ElementDiff> {
	const diffs = new Map<string, ElementDiff>();

	if (!Array.isArray(actions)) return diffs;

	for (const action of actions) {
		if (!action.action || !action.filter) continue;

		const targetIds = resolveFilter(action.filter, elements);
		const diff = actionToDiff(action);

		if (!diff || targetIds.length === 0) continue;

		for (const id of targetIds) {
			const element = elements.get(id);
			if (!element) continue;

			// For "move" action, convert relative dx/dy to absolute positions
			let finalDiff = { ...diff };
			if (action.action === "move") {
				finalDiff = {
					x: element.x + (diff.x || 0),
					y: element.y + (diff.y || 0),
				};
			}

			// Merge with any existing diff for this element
			const existing = diffs.get(id);
			if (existing) {
				diffs.set(id, { ...existing, ...finalDiff });
			} else {
				diffs.set(id, finalDiff);
			}
		}
	}

	return diffs;
}

/**
 * Generate a human-readable summary of what modifications will be applied.
 *
 * @param actions - Array of modification actions
 * @param elements - Current canvas elements
 * @returns Array of summaries
 */
export function summarizeModifications(
	actions: ModifyAction[],
	elements: Map<string, CanvasElement>,
): ModifySummary[] {
	const summaries: ModifySummary[] = [];

	for (const action of actions) {
		const targetIds = resolveFilter(action.filter, elements);
		if (targetIds.length === 0) continue;

		let description = "";
		const typeName =
			action.filter.type === "all"
				? "elements"
				: `${action.filter.type || "element"}s`;

		switch (action.action) {
			case "update_color": {
				const parts: string[] = [];
				if (action.params.strokeColor)
					parts.push(`stroke → ${action.params.strokeColor}`);
				if (action.params.backgroundColor)
					parts.push(`fill → ${action.params.backgroundColor}`);
				description = `Change color of ${targetIds.length} ${typeName}: ${parts.join(", ")}`;
				break;
			}
			case "update_stroke":
				description = `Update stroke of ${targetIds.length} ${typeName}`;
				break;
			case "resize":
				description = `Resize ${targetIds.length} ${typeName} to ${action.params.width}×${action.params.height}`;
				break;
			case "move":
				description = `Move ${targetIds.length} ${typeName} by (${action.params.dx}, ${action.params.dy})`;
				break;
			case "delete":
				description = `Delete ${targetIds.length} ${typeName}`;
				break;
			case "update_opacity":
				description = `Set opacity of ${targetIds.length} ${typeName} to ${action.params.opacity}%`;
				break;
			case "update_stroke_width":
				description = `Set stroke width of ${targetIds.length} ${typeName} to ${action.params.strokeWidth}px`;
				break;
			default:
				description = `Modify ${targetIds.length} ${typeName}`;
		}

		summaries.push({
			description,
			affectedCount: targetIds.length,
			affectedIds: targetIds,
		});
	}

	return summaries;
}
