/**
 * ============================================================================
 * LEKHAFLOW - DOCUMENTATION MODAL
 * ============================================================================
 *
 * Full-screen modal that displays AI-generated Markdown documentation of the
 * current canvas diagram. Supports:
 *
 * - Streaming generation with live preview
 * - Copy to clipboard
 * - Download as .md file
 * - Re-generate with a single click
 *
 * The modal calls /api/ai-doc-generate with the serialized canvas context
 * and an optional canvas screenshot.
 */

"use client";

import type Konva from "konva";
import {
	Check,
	ClipboardCopy,
	Download,
	FileText,
	Loader2,
	RefreshCw,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { serializeCanvasForAI } from "../../lib/canvas-serializer";
import { useCanvasStore } from "../../store/canvas-store";

// ============================================================================
// TYPES
// ============================================================================

interface DocumentationModalProps {
	isOpen: boolean;
	onClose: () => void;
	stageRef: React.RefObject<Konva.Stage | null>;
}

// ============================================================================
// MARKDOWN RENDERER (lightweight — no extra dependencies)
// ============================================================================

/**
 * Convert raw Markdown text to safe HTML for display.
 * Handles headings, bold, italic, inline code, code blocks,
 * bullet/numbered lists, horizontal rules, and paragraphs.
 */
function renderMarkdown(md: string): string {
	// Escape HTML to prevent XSS, then apply markdown transforms
	let html = md
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	// Fenced code blocks (```lang ... ```)
	html = html.replace(
		/```(\w*)\n([\s\S]*?)```/g,
		'<pre class="doc-code-block"><code>$2</code></pre>',
	);

	// Inline code
	html = html.replace(/`([^`]+)`/g, '<code class="doc-inline-code">$1</code>');

	// Headings (### before ## before #)
	html = html.replace(
		/^#### (.+)$/gm,
		'<h4 class="doc-heading doc-h4">$1</h4>',
	);
	html = html.replace(/^### (.+)$/gm, '<h3 class="doc-heading doc-h3">$1</h3>');
	html = html.replace(/^## (.+)$/gm, '<h2 class="doc-heading doc-h2">$1</h2>');
	html = html.replace(/^# (.+)$/gm, '<h1 class="doc-heading doc-h1">$1</h1>');

	// Horizontal rules
	html = html.replace(/^---$/gm, '<hr class="doc-hr" />');

	// Bold
	html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

	// Italic
	html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

	// Unordered list items
	html = html.replace(/^[-*] (.+)$/gm, '<li class="doc-list-item">$1</li>');

	// Ordered list items
	html = html.replace(
		/^\d+\. (.+)$/gm,
		'<li class="doc-list-item-num">$1</li>',
	);

	// Tables — basic support
	// Detect table rows: lines starting with |
	html = html.replace(/^(\|.+\|)$/gm, (_, row: string) => {
		const isHeader = /^\|[\s-:|]+\|$/.test(row);
		if (isHeader) return ""; // skip separator row
		const cells = row
			.split("|")
			.filter((c: string) => c.trim() !== "")
			.map((c: string) => `<td class="doc-td">${c.trim()}</td>`)
			.join("");
		return `<tr>${cells}</tr>`;
	});

	// Wrap consecutive <tr> in <table>
	html = html.replace(
		/(<tr>[\s\S]*?<\/tr>\n?)+/g,
		'<table class="doc-table">$&</table>',
	);

	// Paragraphs: wrap standalone lines (that aren't already HTML elements)
	html = html
		.split("\n")
		.map((line) => {
			const trimmed = line.trim();
			if (
				trimmed === "" ||
				trimmed.startsWith("<h") ||
				trimmed.startsWith("<li") ||
				trimmed.startsWith("<pre") ||
				trimmed.startsWith("<hr") ||
				trimmed.startsWith("<table") ||
				trimmed.startsWith("<tr") ||
				trimmed.startsWith("<td") ||
				trimmed.startsWith("</")
			) {
				return line;
			}
			return `<p class="doc-p">${line}</p>`;
		})
		.join("\n");

	return html;
}

// ============================================================================
// DOCUMENTATION MODAL COMPONENT
// ============================================================================

export function DocumentationModal({
	isOpen,
	onClose,
	stageRef,
}: DocumentationModalProps) {
	const elements = useCanvasStore((s) => s.elements);
	const [markdown, setMarkdown] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const contentRef = useRef<HTMLDivElement>(null);
	const abortRef = useRef<AbortController | null>(null);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	// ── Generate documentation by calling the API ──
	const generateDocumentation = useCallback(async () => {
		setIsGenerating(true);
		setError(null);
		setMarkdown("");

		// Abort any in-flight request
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		try {
			// Serialize the canvas graph
			const canvasContext = serializeCanvasForAI(elements);

			// Capture canvas screenshot
			let canvasImageBase64: string | null = null;
			const stage = stageRef.current;
			if (stage) {
				try {
					const KonvaLib = (await import("konva")).default;
					const layer = stage.getLayers()[0];

					if (layer && layer.children.length > 0) {
						const bgRect = new KonvaLib.Rect({
							x: -stage.x() / stage.scaleX(),
							y: -stage.y() / stage.scaleY(),
							width: stage.width() / stage.scaleX(),
							height: stage.height() / stage.scaleY(),
							fill: "#fafafa",
						});
						layer.add(bgRect);
						bgRect.moveToBottom();
						layer.draw();

						const dataURL = stage.toDataURL({
							pixelRatio: 1,
							mimeType: "image/png",
						});
						canvasImageBase64 = dataURL.replace(/^data:image\/png;base64,/, "");

						bgRect.destroy();
						layer.draw();
					}
				} catch (err) {
					console.warn("Failed to capture canvas screenshot:", err);
				}
			}

			// Call the API
			const response = await fetch("/api/ai-doc-generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					canvasContext,
					canvasImage: canvasImageBase64,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				throw new Error(
					errorData?.error || `Request failed with status ${response.status}`,
				);
			}

			// Stream response
			const reader = response.body?.getReader();
			if (!reader) throw new Error("No response body");

			const decoder = new TextDecoder();
			let accumulated = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				accumulated += chunk;
				setMarkdown(accumulated);

				// Auto-scroll to bottom
				if (contentRef.current) {
					contentRef.current.scrollTop = contentRef.current.scrollHeight;
				}
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name === "AbortError") return;
			const message =
				err instanceof Error ? err.message : "An unexpected error occurred";
			setError(message);
		} finally {
			setIsGenerating(false);
		}
	}, [elements, stageRef]);

	// Auto-generate when modal opens
	useEffect(() => {
		if (isOpen && markdown === "" && !isGenerating) {
			generateDocumentation();
		}
	}, [isOpen, markdown, isGenerating, generateDocumentation]);

	// ── Copy to clipboard ──
	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(markdown);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement("textarea");
			textarea.value = markdown;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand("copy");
			document.body.removeChild(textarea);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}, [markdown]);

	// ── Download as .md file ──
	const handleDownload = useCallback(() => {
		const blob = new Blob([markdown], { type: "text/markdown" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `lekhaflow-documentation-${new Date().toISOString().slice(0, 10)}.md`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [markdown]);

	// ── Close and cleanup ──
	const handleClose = useCallback(() => {
		abortRef.current?.abort();
		setMarkdown("");
		setError(null);
		setIsGenerating(false);
		onClose();
	}, [onClose]);

	// ── Handle Escape key ──
	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isOpen, handleClose]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center"
			style={{ animation: "fade-in 0.15s ease-out" }}
		>
			{/* Backdrop */}
			<button
				type="button"
				className="absolute inset-0 bg-black/50 backdrop-blur-sm border-none cursor-default"
				onClick={handleClose}
				tabIndex={-1}
				aria-hidden="true"
			/>

			{/* Modal */}
			<div
				className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
				style={{
					width: "min(900px, 90vw)",
					height: "min(700px, 85vh)",
					animation: "slide-in-bottom 0.2s ease-out",
				}}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50">
					<div className="flex items-center gap-3">
						<div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
							<FileText size={18} className="text-white" />
						</div>
						<div>
							<h2 className="text-base font-bold text-gray-900 m-0">
								Generated Documentation
							</h2>
							<p className="text-xs text-gray-500 m-0">
								AI-generated Markdown from your diagram
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{/* Re-generate */}
						<button
							type="button"
							onClick={generateDocumentation}
							disabled={isGenerating}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-100 rounded-lg border-none cursor-pointer hover:bg-violet-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							title="Re-generate documentation"
						>
							<RefreshCw
								size={14}
								className={isGenerating ? "animate-spin" : ""}
							/>
							Re-generate
						</button>

						{/* Copy */}
						<button
							type="button"
							onClick={handleCopy}
							disabled={!markdown || isGenerating}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg border-none cursor-pointer hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							title="Copy Markdown to clipboard"
						>
							{copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
							{copied ? "Copied!" : "Copy"}
						</button>

						{/* Download */}
						<button
							type="button"
							onClick={handleDownload}
							disabled={!markdown || isGenerating}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg border-none cursor-pointer hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
							title="Download as .md file"
						>
							<Download size={14} />
							Download .md
						</button>

						{/* Close */}
						<button
							type="button"
							onClick={handleClose}
							className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer hover:bg-gray-100 transition-colors ml-2"
							title="Close"
						>
							<X size={18} className="text-gray-500" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div
					ref={contentRef}
					className="flex-1 overflow-y-auto px-8 py-6"
					style={{
						fontFamily:
							'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
					}}
				>
					{/* Loading state */}
					{isGenerating && markdown === "" && (
						<div className="flex flex-col items-center justify-center py-20 gap-4">
							<div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center">
								<Loader2 size={24} className="text-violet-600 animate-spin" />
							</div>
							<div className="text-center">
								<p className="text-sm font-medium text-gray-700 m-0">
									Analyzing your diagram...
								</p>
								<p className="text-xs text-gray-400 m-0 mt-1">
									Generating comprehensive documentation
								</p>
							</div>
						</div>
					)}

					{/* Error state */}
					{error && (
						<div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
							<p className="text-sm text-red-700 m-0 font-medium">
								Generation failed
							</p>
							<p className="text-xs text-red-500 m-0 mt-1">{error}</p>
							<button
								type="button"
								onClick={generateDocumentation}
								className="mt-3 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg border-none cursor-pointer hover:bg-red-200 transition-colors"
							>
								Try Again
							</button>
						</div>
					)}

					{/* Rendered Markdown */}
					{markdown && (
						<div
							className="doc-content prose prose-sm max-w-none"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown is rendered from AI output, not user-supplied HTML
							dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
						/>
					)}

					{/* Streaming indicator */}
					{isGenerating && markdown !== "" && (
						<div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
							<Loader2 size={14} className="text-violet-500 animate-spin" />
							<span className="text-xs text-gray-400">Still generating...</span>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
					<p className="text-[11px] text-gray-400 m-0">
						Generated by AI — review for accuracy before using
					</p>
					{markdown && (
						<p className="text-[11px] text-gray-400 m-0">
							{markdown.length.toLocaleString()} characters
						</p>
					)}
				</div>
			</div>

			{/* Scoped styles for the rendered documentation */}
			<style>{`
				.doc-content .doc-h1 {
					font-size: 1.75rem;
					font-weight: 800;
					color: #111827;
					margin: 0 0 1rem 0;
					padding-bottom: 0.75rem;
					border-bottom: 2px solid #e5e7eb;
				}
				.doc-content .doc-h2 {
					font-size: 1.35rem;
					font-weight: 700;
					color: #1f2937;
					margin: 1.5rem 0 0.75rem 0;
				}
				.doc-content .doc-h3 {
					font-size: 1.1rem;
					font-weight: 600;
					color: #374151;
					margin: 1.25rem 0 0.5rem 0;
				}
				.doc-content .doc-h4 {
					font-size: 1rem;
					font-weight: 600;
					color: #4b5563;
					margin: 1rem 0 0.5rem 0;
				}
				.doc-content .doc-p {
					font-size: 0.9rem;
					line-height: 1.7;
					color: #374151;
					margin: 0.25rem 0;
				}
				.doc-content .doc-list-item {
					font-size: 0.9rem;
					line-height: 1.7;
					color: #374151;
					margin-left: 1.5rem;
					list-style: disc;
				}
				.doc-content .doc-list-item-num {
					font-size: 0.9rem;
					line-height: 1.7;
					color: #374151;
					margin-left: 1.5rem;
					list-style: decimal;
				}
				.doc-content .doc-inline-code {
					font-family: "Fira Code", "Cascadia Code", monospace;
					font-size: 0.85em;
					background: #f3f4f6;
					color: #7c3aed;
					padding: 0.15em 0.4em;
					border-radius: 4px;
				}
				.doc-content .doc-code-block {
					background: #1f2937;
					color: #e5e7eb;
					padding: 1rem;
					border-radius: 8px;
					overflow-x: auto;
					font-size: 0.85rem;
					margin: 0.75rem 0;
				}
				.doc-content .doc-code-block code {
					font-family: "Fira Code", "Cascadia Code", monospace;
				}
				.doc-content .doc-hr {
					border: none;
					border-top: 1px solid #e5e7eb;
					margin: 1.5rem 0;
				}
				.doc-content .doc-table {
					width: 100%;
					border-collapse: collapse;
					margin: 0.75rem 0;
					font-size: 0.85rem;
				}
				.doc-content .doc-td {
					padding: 0.5rem 0.75rem;
					border: 1px solid #e5e7eb;
					color: #374151;
				}
				.doc-content tr:first-child .doc-td {
					font-weight: 600;
					background: #f9fafb;
				}
			`}</style>
		</div>
	);
}
