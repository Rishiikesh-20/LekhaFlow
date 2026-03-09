/**
 * ============================================================================
 * LEKHAFLOW — TEXT RUN UTILITIES
 * ============================================================================
 *
 * Functions for manipulating rich-text runs and laying out mixed-style text.
 * Used by both the RichTextEditor (editing overlay) and the Konva renderer.
 */

import type {
	ActiveTextStyle,
	CanvasElement,
	TextElement,
	TextRun,
} from "@repo/common";

// ============================================================================
// STYLE HELPERS
// ============================================================================

/** Convert ActiveTextStyle to run style properties (everything except `text`). */
export function activeStyleToRunProps(
	style: ActiveTextStyle,
): Omit<TextRun, "text"> {
	return {
		fontFamily: style.fontFamily,
		fontSize: style.fontSize,
		bold: style.bold || undefined,
		italic: style.italic || undefined,
		underline: style.underline || undefined,
	};
}

/** Normalise optional run fields to concrete values. */
function norm(run: TextRun) {
	return {
		fontFamily: run.fontFamily ?? "Arial",
		fontSize: run.fontSize ?? 20,
		bold: run.bold ?? false,
		italic: run.italic ?? false,
		underline: run.underline ?? false,
	};
}

/** Check whether a run's style matches the active style. */
export function runMatchesStyle(run: TextRun, style: ActiveTextStyle): boolean {
	const n = norm(run);
	return (
		n.fontFamily === style.fontFamily &&
		n.fontSize === style.fontSize &&
		n.bold === style.bold &&
		n.italic === style.italic &&
		n.underline === style.underline
	);
}

// ============================================================================
// RUN MUTATION (APPEND-ONLY FOR PHASE 2)
// ============================================================================

/**
 * Check whether two runs have identical styling (ignoring text content).
 */
function runsHaveSameStyle(a: TextRun, b: TextRun): boolean {
	const na = norm(a);
	const nb = norm(b);
	return (
		na.fontFamily === nb.fontFamily &&
		na.fontSize === nb.fontSize &&
		na.bold === nb.bold &&
		na.italic === nb.italic &&
		na.underline === nb.underline
	);
}

/**
 * Merge adjacent runs that share the same style.
 * Also removes empty runs.
 */
export function mergeAdjacentRuns(runs: TextRun[]): TextRun[] {
	if (runs.length <= 1) return runs.filter((r) => r.text.length > 0);
	const result: TextRun[] = [];
	for (const run of runs) {
		if (run.text.length === 0) continue;
		const prev = result[result.length - 1];
		if (prev && runsHaveSameStyle(prev, run)) {
			result[result.length - 1] = { ...prev, text: prev.text + run.text };
		} else {
			result.push({ ...run });
		}
	}
	return result;
}

/**
 * Apply a partial style to every character in [start, end).
 *
 * Algorithm:
 * 1. Walk runs, splitting at `start` and `end` boundaries
 * 2. Spread `style` onto each in-range fragment
 * 3. Merge adjacent runs with identical styles
 */
export function applyStyleToRange(
	runs: TextRun[],
	start: number,
	end: number,
	style: Partial<Omit<TextRun, "text">>,
): TextRun[] {
	if (start >= end || runs.length === 0) return runs;

	const atoms: TextRun[] = [];
	let offset = 0;

	for (const run of runs) {
		const runStart = offset;
		const runEnd = offset + run.text.length;

		if (runEnd <= start || runStart >= end) {
			// Entirely outside the target range
			atoms.push({ ...run });
		} else {
			// Before-range portion
			if (runStart < start) {
				atoms.push({ ...run, text: run.text.slice(0, start - runStart) });
			}
			// In-range portion — apply style
			const inStart = Math.max(0, start - runStart);
			const inEnd = Math.min(run.text.length, end - runStart);
			atoms.push({
				...run,
				...style,
				text: run.text.slice(inStart, inEnd),
			});
			// After-range portion
			if (runEnd > end) {
				atoms.push({ ...run, text: run.text.slice(end - runStart) });
			}
		}
		offset = runEnd;
	}

	return mergeAdjacentRuns(atoms);
}

/**
 * Get the style at a single character offset (for caret / insertion style).
 * Returns the style of the run that contains `offset`.
 * At a boundary, prefers the run to the left (ending at that offset).
 */
export function getStyleAtOffset(
	runs: TextRun[],
	offset: number,
): Omit<TextRun, "text"> {
	let pos = 0;
	let lastStyle: Omit<TextRun, "text"> = {};
	for (const run of runs) {
		const n = norm(run);
		lastStyle = {
			fontFamily: n.fontFamily,
			fontSize: n.fontSize,
			bold: n.bold || undefined,
			italic: n.italic || undefined,
			underline: n.underline || undefined,
		};
		if (pos + run.text.length >= offset) return lastStyle;
		pos += run.text.length;
	}
	return lastStyle;
}

/**
 * Get the common style for a character range (for toolbar sync).
 *
 * Approach: neutral/unset for mixed boolean props.
 * - bold/italic/underline: true only if ALL characters in range have it
 * - fontFamily/fontSize: taken from the first overlapping run
 */
export function getStyleForRange(
	runs: TextRun[],
	start: number,
	end: number,
): ActiveTextStyle {
	const fallback: ActiveTextStyle = {
		fontFamily: "Arial",
		fontSize: 20,
		bold: false,
		italic: false,
		underline: false,
	};
	if (start >= end || runs.length === 0) return fallback;

	let offset = 0;
	let allBold = true;
	let allItalic = true;
	let allUnderline = true;
	let first: ReturnType<typeof norm> | null = null;

	for (const run of runs) {
		const runEnd = offset + run.text.length;
		if (runEnd > start && offset < end) {
			const n = norm(run);
			if (!first) first = n;
			if (!n.bold) allBold = false;
			if (!n.italic) allItalic = false;
			if (!n.underline) allUnderline = false;
		}
		offset = runEnd;
		if (offset >= end) break;
	}

	return {
		fontFamily: first?.fontFamily ?? "Arial",
		fontSize: first?.fontSize ?? 20,
		bold: allBold,
		italic: allItalic,
		underline: allUnderline,
	};
}

/**
 * Insert `text` at a character offset with the given style.
 * Splits the run at `offset`, inserts a new run, and merges.
 */
export function insertTextAtOffset(
	runs: TextRun[],
	offset: number,
	text: string,
	style: ActiveTextStyle,
): TextRun[] {
	if (!text) return runs;
	const newRun: TextRun = { text, ...activeStyleToRunProps(style) };

	if (runs.length === 0) return [newRun];

	let pos = 0;
	for (let i = 0; i < runs.length; i++) {
		const run = runs[i];
		if (!run) continue;
		const runEnd = pos + run.text.length;
		if (offset <= runEnd) {
			const before = run.text.slice(0, offset - pos);
			const after = run.text.slice(offset - pos);
			const result: TextRun[] = [
				...runs.slice(0, i),
				...(before ? [{ ...run, text: before }] : []),
				newRun,
				...(after ? [{ ...run, text: after }] : []),
				...runs.slice(i + 1),
			];
			return mergeAdjacentRuns(result);
		}
		pos = runEnd;
	}

	return mergeAdjacentRuns([...runs, newRun]);
}

/**
 * Delete characters in the range [start, end).
 */
export function deleteRange(
	runs: TextRun[],
	start: number,
	end: number,
): TextRun[] {
	if (start >= end || runs.length === 0) return runs;
	const result: TextRun[] = [];
	let offset = 0;

	for (const run of runs) {
		const runStart = offset;
		const runEnd = offset + run.text.length;

		if (runEnd <= start || runStart >= end) {
			result.push({ ...run });
		} else {
			let kept = "";
			if (runStart < start) kept += run.text.slice(0, start - runStart);
			if (runEnd > end) kept += run.text.slice(end - runStart);
			if (kept) result.push({ ...run, text: kept });
		}
		offset = runEnd;
	}

	return mergeAdjacentRuns(result);
}

/**
 * Convert legacy plain text to a single-run array (for editing old elements).
 */
export function runsFromLegacyText(
	text: string,
	fontSize: number,
	fontFamily = "Arial",
): TextRun[] {
	if (!text) return [];
	return [{ text, fontSize, fontFamily }];
}

/** Append text to runs, merging with the last run when styles match. */
export function appendTextToRuns(
	runs: TextRun[],
	text: string,
	style: ActiveTextStyle,
): TextRun[] {
	if (!text) return runs;
	const lastRun = runs[runs.length - 1];
	if (lastRun && runMatchesStyle(lastRun, style)) {
		return [...runs.slice(0, -1), { ...lastRun, text: lastRun.text + text }];
	}
	return [...runs, { text, ...activeStyleToRunProps(style) }];
}

/** Delete `count` characters from the end of runs. */
export function deleteFromRunsEnd(runs: TextRun[], count: number): TextRun[] {
	if (runs.length === 0 || count <= 0) return runs;
	const result = [...runs];
	let remaining = count;
	while (remaining > 0 && result.length > 0) {
		const last = result[result.length - 1];
		if (!last) break;
		if (last.text.length <= remaining) {
			remaining -= last.text.length;
			result.pop();
		} else {
			result[result.length - 1] = {
				...last,
				text: last.text.slice(0, -remaining),
			};
			remaining = 0;
		}
	}
	return result;
}

/** Reconstruct plain text from runs. */
export function runsToPlainText(runs: TextRun[]): string {
	return runs.map((r) => r.text).join("");
}

// ============================================================================
// TEXT MEASUREMENT
// ============================================================================

/** Build a CSS / Canvas font string for a run. */
export function buildFontString(run: TextRun): string {
	const style = run.italic ? "italic" : "normal";
	const weight = run.bold ? "bold" : "normal";
	const size = run.fontSize ?? 20;
	const family = run.fontFamily ?? "Arial";
	return `${style} ${weight} ${size}px ${family}`;
}

/** Build Konva-compatible fontStyle value (bold / italic / both / normal). */
export function buildKonvaFontStyle(bold: boolean, italic: boolean): string {
	if (bold && italic) return "italic bold";
	if (bold) return "bold";
	if (italic) return "italic";
	return "normal";
}

let _measureCanvas: HTMLCanvasElement | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
	if (typeof document === "undefined") return null;
	if (!_measureCanvas) {
		_measureCanvas = document.createElement("canvas");
	}
	return _measureCanvas.getContext("2d");
}

/** Measure the pixel width of `text` rendered in `font` (CSS font string). */
export function measureTextWidth(text: string, font: string): number {
	const ctx = getMeasureCtx();
	if (!ctx) return text.length * 10; // SSR fallback estimate
	ctx.font = font;
	return ctx.measureText(text).width;
}

// ============================================================================
// LAYOUT ENGINE
// ============================================================================

export interface LayoutSegment {
	text: string;
	x: number;
	y: number;
	width: number;
	fontSize: number;
	fontFamily: string;
	bold: boolean;
	italic: boolean;
	underline: boolean;
}

export interface LayoutLine {
	segments: LayoutSegment[];
	height: number;
	width: number;
	y: number;
}

export interface LayoutResult {
	lines: LayoutLine[];
	width: number;
	height: number;
}

/**
 * Lay out runs into positioned segments with word wrapping.
 *
 * Tokenisation:
 *   A token is a word (non-space, non-newline) + its trailing spaces,
 *   or a standalone newline.  Words wrap at `maxWidth` when provided.
 *   Line height = max(fontSize in line) × lineHeightMultiplier.
 *
 * Results are cached to avoid re-measuring identical content.
 */

const _layoutCache = new Map<string, LayoutResult>();
const MAX_LAYOUT_CACHE = 256;

function layoutCacheKey(
	runs: TextRun[],
	maxWidth?: number,
	lhm?: number,
): string {
	let key = "";
	for (const r of runs) {
		key += `${r.text}\t${r.fontFamily ?? ""}\t${r.fontSize ?? ""}\t${r.bold ? 1 : 0}${r.italic ? 1 : 0}${r.underline ? 1 : 0}\n`;
	}
	key += `|${maxWidth ?? ""}|${lhm ?? ""}`;
	return key;
}

export function layoutRuns(
	runs: TextRun[],
	maxWidth?: number,
	lineHeightMultiplier = 1.25,
): LayoutResult {
	// ── Cache lookup ────────────────────────────────────────────────
	const cacheKey = layoutCacheKey(runs, maxWidth, lineHeightMultiplier);
	const cached = _layoutCache.get(cacheKey);
	if (cached) return cached;

	if (runs.length === 0) {
		return { lines: [], width: 0, height: 0 };
	}

	// ── Tokenise ────────────────────────────────────────────────────
	interface Token {
		text: string;
		fontSize: number;
		fontFamily: string;
		bold: boolean;
		italic: boolean;
		underline: boolean;
		width: number;
		isNewline: boolean;
	}

	const tokens: Token[] = [];

	for (const run of runs) {
		const { fontFamily, fontSize, bold, italic, underline } = norm(run);
		const font = buildFontString(run);

		let i = 0;
		while (i < run.text.length) {
			if (run.text[i] === "\n") {
				tokens.push({
					text: "\n",
					fontSize,
					fontFamily,
					bold,
					italic,
					underline,
					width: 0,
					isNewline: true,
				});
				i++;
				continue;
			}

			// Word + trailing spaces
			let chunk = "";
			while (
				i < run.text.length &&
				run.text[i] !== "\n" &&
				run.text[i] !== " "
			) {
				chunk += run.text[i];
				i++;
			}
			while (i < run.text.length && run.text[i] === " ") {
				chunk += run.text[i];
				i++;
			}
			if (chunk) {
				tokens.push({
					text: chunk,
					fontSize,
					fontFamily,
					bold,
					italic,
					underline,
					width: measureTextWidth(chunk, font),
					isNewline: false,
				});
			}
		}
	}

	// ── Build lines ─────────────────────────────────────────────────
	const lines: LayoutLine[] = [];
	let segs: LayoutSegment[] = [];
	let lineX = 0;
	let maxFont = 0;
	let totalMaxW = 0;

	const flush = () => {
		const h = (maxFont || tokens[0]?.fontSize || 20) * lineHeightMultiplier;
		totalMaxW = Math.max(totalMaxW, lineX);
		lines.push({ segments: segs, height: h, width: lineX, y: 0 });
		segs = [];
		lineX = 0;
		maxFont = 0;
	};

	for (const tok of tokens) {
		if (tok.isNewline) {
			flush();
			continue;
		}
		if (maxWidth && lineX + tok.width > maxWidth && segs.length > 0) {
			flush();
		}
		segs.push({
			text: tok.text,
			x: lineX,
			y: 0,
			width: tok.width,
			fontSize: tok.fontSize,
			fontFamily: tok.fontFamily,
			bold: tok.bold,
			italic: tok.italic,
			underline: tok.underline,
		});
		lineX += tok.width;
		maxFont = Math.max(maxFont, tok.fontSize);
	}
	if (segs.length > 0) flush();

	if (lines.length === 0) {
		lines.push({
			segments: [],
			height: 20 * lineHeightMultiplier,
			width: 0,
			y: 0,
		});
	}

	// ── Assign cumulative Y ─────────────────────────────────────────
	let cy = 0;
	for (const line of lines) {
		line.y = cy;
		for (const s of line.segments) s.y = cy;
		cy += line.height;
	}

	const result: LayoutResult = {
		lines,
		width: maxWidth ? Math.max(maxWidth, totalMaxW) : totalMaxW,
		height: cy,
	};

	// ── Cache store ─────────────────────────────────────────────────
	if (_layoutCache.size >= MAX_LAYOUT_CACHE) _layoutCache.clear();
	_layoutCache.set(cacheKey, result);

	return result;
}

// ============================================================================
// LEGACY MIGRATION
// ============================================================================

/**
 * Ensure a text element has a `runs` array.
 * Legacy elements stored only `text` + `fontSize`; this migrates them to a
 * single-run model so all rendering paths can rely on `runs`.
 * Non-text elements are returned unchanged.
 */
export function ensureTextRuns(element: CanvasElement): CanvasElement {
	if (element.type !== "text") return element;
	const textEl = element as TextElement;
	if (textEl.runs && textEl.runs.length > 0) return element;
	return {
		...textEl,
		runs: runsFromLegacyText(textEl.text || "", textEl.fontSize || 20, "Arial"),
	};
}
