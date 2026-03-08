/**
 * ============================================================================
 * LEKHAFLOW — IMPORT SCENE JSON  (Phase 0)
 * ============================================================================
 *
 * Provides `importSceneFromFile()` which:
 *   1. Opens a native file-picker (`<input type="file">`)
 *   2. Reads and validates the JSON (expects `{ version, elements }`)
 *   3. Calls `addElement()` for each entry via the Yjs sync hook
 *
 * Also provides `importSceneFromJson()` for programmatic usage
 * (e.g. drag-and-drop or clipboard).
 */

import type { CanvasElement } from "@repo/common";

// ─── public API ─────────────────────────────────────────────────────────────

export interface ImportResult {
	success: boolean;
	importedCount: number;
	error?: string;
}

/**
 * Validate + normalise a CanvasElement from untrusted JSON.
 * Returns `null` if the element is not salvageable.
 */
function validateElement(raw: unknown): CanvasElement | null {
	if (!raw || typeof raw !== "object") return null;
	const el = raw as Record<string, unknown>;

	// Must have at minimum: id, type, x, y
	if (typeof el.id !== "string" || !el.id) return null;
	if (typeof el.type !== "string") return null;

	const VALID_TYPES = new Set([
		"rectangle",
		"ellipse",
		"diamond",
		"line",
		"arrow",
		"freedraw",
		"text",
	]);
	if (!VALID_TYPES.has(el.type)) return null;

	if (typeof el.x !== "number" || typeof el.y !== "number") return null;

	// Validate runs array if present on text elements
	let runs: unknown = el.runs;
	if (el.type === "text" && runs !== undefined) {
		if (!Array.isArray(runs)) {
			runs = undefined;
		} else {
			runs = (runs as unknown[]).filter(
				(r) =>
					r &&
					typeof r === "object" &&
					typeof (r as Record<string, unknown>).text === "string",
			);
			if ((runs as unknown[]).length === 0) runs = undefined;
		}
	}

	// Normalise optional fields
	return {
		...el,
		width: typeof el.width === "number" ? el.width : 0,
		height: typeof el.height === "number" ? el.height : 0,
		zIndex: typeof el.zIndex === "number" ? el.zIndex : 0,
		isDeleted: false,
		opacity: typeof el.opacity === "number" ? el.opacity : 100,
		...(el.type === "text" && runs ? { runs } : {}),
	} as CanvasElement;
}

/**
 * Parse + validate raw JSON text into an array of CanvasElements.
 */
export function parseSceneJson(jsonText: string): {
	elements: CanvasElement[];
	error?: string;
} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		return { elements: [], error: "Invalid JSON" };
	}

	if (!parsed || typeof parsed !== "object") {
		return { elements: [], error: "Expected a JSON object at top level" };
	}

	const obj = parsed as Record<string, unknown>;

	// Support both `{ elements: [...] }` and bare arrays
	let rawElements: unknown[];
	if (Array.isArray(obj.elements)) {
		rawElements = obj.elements;
	} else if (Array.isArray(parsed)) {
		rawElements = parsed;
	} else {
		return {
			elements: [],
			error: "JSON must contain an `elements` array",
		};
	}

	const validated: CanvasElement[] = [];
	for (const raw of rawElements) {
		const el = validateElement(raw);
		if (el) validated.push(el);
	}

	if (validated.length === 0) {
		return { elements: [], error: "No valid elements found in the file" };
	}

	return { elements: validated };
}

/**
 * Import elements via the given `addElement` callback.
 *
 * Assigns new IDs so imports never collide with existing scene elements.
 */
export function importElements(
	elements: CanvasElement[],
	addElement: (el: CanvasElement) => void,
	baseZIndex: number,
): number {
	let count = 0;
	for (const el of elements) {
		// Generate a new unique ID to prevent collisions
		const newId = `${el.type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
		addElement({
			...el,
			id: newId,
			zIndex: baseZIndex + count,
			isDeleted: false,
		});
		count++;
	}
	return count;
}

/**
 * Open a file-picker, read a `.json` file, and import.
 *
 * Usage:
 * ```ts
 * const result = await importSceneFromFile(addElement, nextZIndex);
 * ```
 */
export function importSceneFromFile(
	addElement: (el: CanvasElement) => void,
	baseZIndex: number,
): Promise<ImportResult> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json,application/json";
		input.style.display = "none";

		input.addEventListener("change", async () => {
			const file = input.files?.[0];
			if (!file) {
				resolve({
					success: false,
					importedCount: 0,
					error: "No file selected",
				});
				return;
			}

			try {
				const text = await file.text();
				const { elements, error } = parseSceneJson(text);

				if (error || elements.length === 0) {
					resolve({
						success: false,
						importedCount: 0,
						error: error || "No valid elements",
					});
					return;
				}

				const count = importElements(elements, addElement, baseZIndex);
				resolve({ success: true, importedCount: count });
			} catch (err) {
				resolve({
					success: false,
					importedCount: 0,
					error: String(err),
				});
			} finally {
				input.remove();
			}
		});

		// User cancelled
		input.addEventListener("cancel", () => {
			resolve({ success: false, importedCount: 0, error: "Cancelled" });
			input.remove();
		});

		document.body.appendChild(input);
		input.click();
	});
}
