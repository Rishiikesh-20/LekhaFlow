/**
 * ============================================================================
 * LEKHAFLOW — RICH TEXT EDITOR OVERLAY
 * ============================================================================
 *
 * In-canvas rich-text input for BOTH new text boxes and editing existing ones.
 * Uses a controlled contentEditable div so the browser handles cursor &
 * selection display natively, while all mutations go through our TextRun model.
 *
 * Phase 2: new text entry with active formatting.
 * Phase 3: inline selection-based formatting of existing text.
 */

"use client";

import type { TextRun } from "@repo/common";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	applyStyleToRange,
	deleteRange,
	getStyleAtOffset,
	getStyleForRange,
	insertTextAtOffset,
	layoutRuns,
	mergeAdjacentRuns,
	runsFromLegacyText,
	runsToPlainText,
} from "../../lib/text-runs";
import { useCanvasStore } from "../../store/canvas-store";

// ============================================================================
// TYPES
// ============================================================================

interface RichTextEditorProps {
	x: number;
	y: number;
	zoom: number;
	scrollX: number;
	scrollY: number;
	strokeColor: string;
	/** Pre-existing runs (editing an existing element) */
	initialRuns?: TextRun[];
	/** Pre-existing plain text (legacy elements without runs) */
	initialText?: string;
	/** Element ID when editing an existing element */
	elementId?: string;
	initialWidth?: number;
	initialHeight?: number;
	onComplete: (
		runs: TextRun[],
		plainText: string,
		width: number,
		height: number,
	) => void;
	onCancel: () => void;
}

// ============================================================================
// DOM ↔ OFFSET HELPERS
// ============================================================================

/** Map a DOM selection anchor/focus to a character offset within the container. */
function textOffsetInContainer(
	container: HTMLElement,
	node: Node,
	nodeOffset: number,
): number {
	const range = document.createRange();
	range.selectNodeContents(container);
	range.setEnd(node, nodeOffset);
	return range.toString().length;
}

/** Read the current DOM selection as character offsets relative to container. */
function getSelectionOffsets(
	container: HTMLElement,
): { start: number; end: number } | null {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return null;
	const { anchorNode, anchorOffset, focusNode, focusOffset } = sel;
	if (!anchorNode || !focusNode) return null;
	if (!container.contains(anchorNode) || !container.contains(focusNode))
		return null;

	const anchor = textOffsetInContainer(container, anchorNode, anchorOffset);
	const focus = textOffsetInContainer(container, focusNode, focusOffset);
	return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
}

/** Walk text nodes to find the DOM position for a character offset. */
function findDomPosition(
	container: HTMLElement,
	targetOffset: number,
): { node: Node; offset: number } {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
	let count = 0;
	while (walker.nextNode()) {
		const node = walker.currentNode;
		const len = node.textContent?.length ?? 0;
		if (count + len >= targetOffset) {
			return { node, offset: targetOffset - count };
		}
		count += len;
	}
	// Fallback: end of container
	const last = walker.currentNode ?? container;
	return { node: last, offset: last.textContent?.length ?? 0 };
}

/** Restore DOM selection from character offsets. */
function restoreSelection(
	container: HTMLElement,
	start: number,
	end: number,
): void {
	const sel = window.getSelection();
	if (!sel) return;
	const s = findDomPosition(container, start);
	const e = findDomPosition(container, end);
	const range = document.createRange();
	range.setStart(s.node, s.offset);
	range.setEnd(e.node, e.offset);
	sel.removeAllRanges();
	sel.addRange(range);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RichTextEditor({
	x,
	y,
	zoom,
	scrollX,
	scrollY,
	strokeColor,
	initialRuns,
	initialText,
	elementId,
	initialWidth,
	initialHeight: _initialHeight,
	onComplete,
	onCancel,
}: RichTextEditorProps) {
	// ── State ───────────────────────────────────────────────────────
	const [runs, setRuns] = useState<TextRun[]>(() => {
		if (initialRuns && initialRuns.length > 0) return initialRuns;
		if (initialText) return runsFromLegacyText(initialText, 20, "Arial");
		return [];
	});

	const activeTextStyle = useCanvasStore((s) => s.activeTextStyle);
	const setActiveTextStyle = useCanvasStore((s) => s.setActiveTextStyle);
	const formatSeq = useCanvasStore((s) => s._formatCommandSeq);
	const formatStyle = useCanvasStore((s) => s._formatCommandStyle);

	const containerRef = useRef<HTMLDivElement>(null);
	const justOpenedRef = useRef(true);
	const composingRef = useRef(false);
	const compositionStartOffsetRef = useRef(0);
	const runsRef = useRef(runs);
	runsRef.current = runs;
	const committedRef = useRef(false);
	const prevFormatSeqRef = useRef(formatSeq);

	/** Character offsets to restore after next render. */
	const pendingSelectionRef = useRef<{
		start: number;
		end: number;
	} | null>(null);

	// ── Focus on mount ──────────────────────────────────────────────
	useEffect(() => {
		const el = containerRef.current;
		if (el) {
			el.focus();
			// Place cursor at end
			const total = runsToPlainText(runsRef.current).length;
			restoreSelection(el, total, total);
			const timer = setTimeout(() => {
				justOpenedRef.current = false;
			}, 100);
			return () => clearTimeout(timer);
		}
	}, []);

	// ── Restore selection after state-driven re-render ──────────────
	useLayoutEffect(() => {
		const pending = pendingSelectionRef.current;
		const el = containerRef.current;
		if (pending && el) {
			restoreSelection(el, pending.start, pending.end);
			pendingSelectionRef.current = null;
		}
	});

	// ── Helpers ─────────────────────────────────────────────────────
	const updateRuns = useCallback(
		(newRuns: TextRun[], cursorStart: number, cursorEnd?: number) => {
			const merged = mergeAdjacentRuns(newRuns);
			setRuns(merged);
			pendingSelectionRef.current = {
				start: cursorStart,
				end: cursorEnd ?? cursorStart,
			};
		},
		[],
	);

	const applyFormatToSelection = useCallback(
		(style: Partial<Omit<TextRun, "text">>) => {
			const container = containerRef.current;
			if (!container) return;
			const sel = getSelectionOffsets(container);
			if (sel && sel.start !== sel.end) {
				const newRuns = applyStyleToRange(
					runsRef.current,
					sel.start,
					sel.end,
					style,
				);
				updateRuns(newRuns, sel.start, sel.end);
			}
			// When no selection (caret), activeTextStyle is already updated
			// for insertion style — no run mutation needed.
		},
		[updateRuns],
	);

	// ── Format command from toolbar ─────────────────────────────────
	useEffect(() => {
		if (formatSeq !== prevFormatSeqRef.current) {
			prevFormatSeqRef.current = formatSeq;
			if (formatStyle) {
				applyFormatToSelection(formatStyle);
			}
		}
	}, [formatSeq, formatStyle, applyFormatToSelection]);

	// ── Commit / cancel ─────────────────────────────────────────────
	const doCommit = useCallback(() => {
		if (committedRef.current) return;
		committedRef.current = true;
		const currentRuns = runsRef.current;
		const plainText = runsToPlainText(currentRuns);
		if (plainText.trim()) {
			const layout = layoutRuns(currentRuns);
			onComplete(currentRuns, plainText, layout.width, layout.height);
		} else if (elementId) {
			// Existing element with empty text — let parent decide (delete)
			onComplete([], "", 0, 0);
		} else {
			onCancel();
		}
	}, [onComplete, onCancel, elementId]);

	const doCancel = useCallback(() => {
		if (committedRef.current) return;
		committedRef.current = true;
		onCancel();
	}, [onCancel]);

	// ── Keyboard handling ───────────────────────────────────────────
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (composingRef.current) return;
			const container = containerRef.current;
			if (!container) return;

			// ── Ctrl / Meta shortcuts ───────────────────────────────
			if (e.ctrlKey || e.metaKey) {
				if (e.key === "b") {
					e.preventDefault();
					const sel = getSelectionOffsets(container);
					const newBold = !activeTextStyle.bold || undefined;
					if (sel && sel.start !== sel.end) {
						updateRuns(
							applyStyleToRange(runsRef.current, sel.start, sel.end, {
								bold: newBold,
							}),
							sel.start,
							sel.end,
						);
					}
					setActiveTextStyle({ bold: newBold ?? false });
					return;
				}
				if (e.key === "i") {
					e.preventDefault();
					const sel = getSelectionOffsets(container);
					const newItalic = !activeTextStyle.italic || undefined;
					if (sel && sel.start !== sel.end) {
						updateRuns(
							applyStyleToRange(runsRef.current, sel.start, sel.end, {
								italic: newItalic,
							}),
							sel.start,
							sel.end,
						);
					}
					setActiveTextStyle({ italic: newItalic ?? false });
					return;
				}
				if (e.key === "u") {
					e.preventDefault();
					const sel = getSelectionOffsets(container);
					const newUnderline = !activeTextStyle.underline || undefined;
					if (sel && sel.start !== sel.end) {
						updateRuns(
							applyStyleToRange(runsRef.current, sel.start, sel.end, {
								underline: newUnderline,
							}),
							sel.start,
							sel.end,
						);
					}
					setActiveTextStyle({ underline: newUnderline ?? false });
					return;
				}
				// Let Ctrl+A, Ctrl+C, Ctrl+X, Ctrl+V through
				return;
			}

			// ── Navigation keys: let browser handle ─────────────────
			if (
				[
					"ArrowLeft",
					"ArrowRight",
					"ArrowUp",
					"ArrowDown",
					"Home",
					"End",
				].includes(e.key)
			) {
				return;
			}

			// ── Commit / cancel ─────────────────────────────────────
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				doCommit();
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				doCancel();
				return;
			}
			if (e.key === "Enter" && e.shiftKey) {
				e.preventDefault();
				const sel = getSelectionOffsets(container);
				if (sel) {
					let r = runsRef.current;
					const offset = sel.start;
					if (sel.start !== sel.end) {
						r = deleteRange(r, sel.start, sel.end);
					}
					r = insertTextAtOffset(r, offset, "\n", activeTextStyle);
					updateRuns(r, offset + 1);
				}
				return;
			}

			// ── Backspace ───────────────────────────────────────────
			if (e.key === "Backspace") {
				e.preventDefault();
				const sel = getSelectionOffsets(container);
				if (sel) {
					if (sel.start !== sel.end) {
						updateRuns(
							deleteRange(runsRef.current, sel.start, sel.end),
							sel.start,
						);
					} else if (sel.start > 0) {
						updateRuns(
							deleteRange(runsRef.current, sel.start - 1, sel.start),
							sel.start - 1,
						);
					}
				}
				return;
			}

			// ── Delete key ──────────────────────────────────────────
			if (e.key === "Delete") {
				e.preventDefault();
				const sel = getSelectionOffsets(container);
				const totalLen = runsToPlainText(runsRef.current).length;
				if (sel) {
					if (sel.start !== sel.end) {
						updateRuns(
							deleteRange(runsRef.current, sel.start, sel.end),
							sel.start,
						);
					} else if (sel.start < totalLen) {
						updateRuns(
							deleteRange(runsRef.current, sel.start, sel.start + 1),
							sel.start,
						);
					}
				}
				return;
			}

			// ── Tab: ignore ─────────────────────────────────────────
			if (e.key === "Tab") {
				e.preventDefault();
				return;
			}

			// ── Printable character ─────────────────────────────────
			if (e.key.length === 1) {
				e.preventDefault();
				const sel = getSelectionOffsets(container);
				if (sel) {
					let r = runsRef.current;
					const offset = sel.start;
					if (sel.start !== sel.end) {
						r = deleteRange(r, sel.start, sel.end);
					}
					r = insertTextAtOffset(r, offset, e.key, activeTextStyle);
					updateRuns(r, offset + 1);
				}
			}
		},
		[activeTextStyle, doCommit, doCancel, setActiveTextStyle, updateRuns],
	);

	// ── IME composition ─────────────────────────────────────────────
	const handleCompositionStart = useCallback(() => {
		composingRef.current = true;
		const container = containerRef.current;
		if (container) {
			const sel = getSelectionOffsets(container);
			compositionStartOffsetRef.current =
				sel?.start ?? runsToPlainText(runsRef.current).length;
		}
	}, []);

	const handleCompositionEnd = useCallback(
		(e: React.CompositionEvent) => {
			composingRef.current = false;
			const text = e.data;
			if (text) {
				const offset = compositionStartOffsetRef.current;
				const r = insertTextAtOffset(
					runsRef.current,
					offset,
					text,
					activeTextStyle,
				);
				updateRuns(r, offset + text.length);
			}
		},
		[activeTextStyle, updateRuns],
	);

	// ── Paste ───────────────────────────────────────────────────────
	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			e.preventDefault();
			const text = e.clipboardData.getData("text/plain");
			if (!text) return;
			const container = containerRef.current;
			if (!container) return;
			const sel = getSelectionOffsets(container);
			if (sel) {
				let r = runsRef.current;
				const offset = sel.start;
				if (sel.start !== sel.end) {
					r = deleteRange(r, sel.start, sel.end);
				}
				r = insertTextAtOffset(r, offset, text, activeTextStyle);
				updateRuns(r, offset + text.length);
			}
		},
		[activeTextStyle, updateRuns],
	);

	// ── Selection change → sync toolbar ─────────────────────────────
	useEffect(() => {
		const handler = () => {
			if (composingRef.current) return;
			const container = containerRef.current;
			if (!container) return;
			const sel = window.getSelection();
			if (!sel || !container.contains(sel.anchorNode)) return;

			const offsets = getSelectionOffsets(container);
			if (!offsets) return;
			const currentRuns = runsRef.current;
			if (currentRuns.length === 0) return;

			if (offsets.start !== offsets.end) {
				const style = getStyleForRange(currentRuns, offsets.start, offsets.end);
				setActiveTextStyle(style);
			} else {
				const style = getStyleAtOffset(currentRuns, offsets.start);
				setActiveTextStyle({
					fontFamily: style.fontFamily ?? "Arial",
					fontSize: style.fontSize ?? 20,
					bold: style.bold ?? false,
					italic: style.italic ?? false,
					underline: style.underline ?? false,
				});
			}
		};
		document.addEventListener("selectionchange", handler);
		return () => document.removeEventListener("selectionchange", handler);
	}, [setActiveTextStyle]);

	// ── Blur → commit ───────────────────────────────────────────────
	const handleBlur = useCallback(() => {
		if (justOpenedRef.current) return;
		doCommit();
	}, [doCommit]);

	// ── Width for the editor container ──────────────────────────────
	const editorMinWidth = initialWidth ? `${initialWidth * zoom}px` : "200px";

	// ── Render ──────────────────────────────────────────────────────
	return (
		<div
			style={{
				position: "absolute",
				left: `${x * zoom + scrollX}px`,
				top: `${y * zoom + scrollY}px`,
				zIndex: 1000,
			}}
		>
			<div
				ref={containerRef}
				data-rich-text-editor
				role="textbox"
				contentEditable
				suppressContentEditableWarning
				tabIndex={0}
				onKeyDown={handleKeyDown}
				onCompositionStart={handleCompositionStart}
				onCompositionEnd={handleCompositionEnd}
				onPaste={handlePaste}
				onBlur={handleBlur}
				style={{
					background: "white",
					border: "2px solid #6965db",
					borderRadius: "4px",
					padding: "8px",
					minWidth: editorMinWidth,
					minHeight: "40px",
					outline: "none",
					cursor: "text",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
					lineHeight: 1.25,
					caretColor: "#6965db",
				}}
			>
				{runs.length === 0 ? (
					<span
						style={{
							color: "#aaa",
							fontSize: `${activeTextStyle.fontSize}px`,
							fontFamily: activeTextStyle.fontFamily,
							fontStyle: activeTextStyle.italic ? "italic" : "normal",
							fontWeight: activeTextStyle.bold ? "bold" : "normal",
						}}
					>
						Start typing…
					</span>
				) : (
					runs.map((run, i) => (
						<span
							key={`run-${i}-${run.text.length}`}
							style={{
								fontFamily: run.fontFamily ?? "Arial",
								fontSize: `${run.fontSize ?? 20}px`,
								fontWeight: run.bold ? "bold" : "normal",
								fontStyle: run.italic ? "italic" : "normal",
								textDecoration: run.underline ? "underline" : "none",
								color: strokeColor,
								whiteSpace: "pre-wrap",
							}}
						>
							{run.text}
						</span>
					))
				)}
			</div>
			<div className="text-xs text-gray-400 mt-1">
				Enter to save · Shift+Enter for new line · Esc to cancel
			</div>
		</div>
	);
}
