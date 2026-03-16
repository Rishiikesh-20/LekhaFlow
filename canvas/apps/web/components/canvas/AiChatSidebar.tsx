/**
 * ============================================================================
 * LEKHAFLOW - AI CHAT SIDEBAR
 * ============================================================================
 *
 * A sliding sidebar where users can ask natural language questions about the
 * current canvas diagram. The AI (Google Gemini) answers by analyzing a
 * **screenshot** of the canvas along with structured metadata.
 *
 * Features:
 * - **Multimodal AI** — sends a canvas screenshot + metadata to Gemini Vision
 * - Real-time streaming responses
 * - Multi-turn conversation with context
 * - Auto-refreshes canvas context on each question
 * - Markdown-like formatting for AI responses
 * - **Action execution** — detects modification intents and applies them
 *   directly on the canvas via the AI Modify pipeline
 */

"use client";

import type Konva from "konva";
import {
	BookOpen,
	Bot,
	MessageSquare,
	Send,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	type ModifyAction,
	parseAiModifications,
	summarizeModifications,
} from "../../lib/ai-modify-parser";
import { serializeCanvasForAI } from "../../lib/canvas-serializer";
import { useCanvasStore } from "../../store/canvas-store";

// ============================================================================
// ACTION INTENT DETECTION
// ============================================================================

/**
 * Heuristic to detect whether a user message is requesting a canvas
 * modification (action) rather than asking a question (Q&A).
 *
 * Returns `true` when the message looks like an imperative instruction
 * such as "fill all circles with green" or "delete the red rectangles".
 */
export function isActionIntent(message: string): boolean {
	const lower = message.toLowerCase().trim();

	// Strong action verbs that almost always signal a modification request
	const actionVerbs =
		/\b(change|fill|color|colour|paint|make|set|update|modify|resize|scale|move|shift|delete|remove|hide|enlarge|shrink|rotate|reposition|increase|decrease|brighten|darken|thicken|thin)\b/;

	// Target indicators — shape types or "all/every/each"
	const targetIndicators =
		/\b(circle|ellipse|rectangle|square|diamond|arrow|line|text|shape|element|node|all|every|each|everything)\b/;

	// Property references — color names, hex codes, dimensions
	const propertyRefs =
		/\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|cyan|magenta|transparent|opacity|stroke|border|background|width|height|size|bigger|smaller|thicker|thinner|bold|#[0-9a-fA-F]{3,8})\b/;

	// Must have an action verb + at least one of (target OR property)
	if (actionVerbs.test(lower)) {
		return targetIndicators.test(lower) || propertyRefs.test(lower);
	}

	return false;
}

// ============================================================================
// TYPES
// ============================================================================

interface AiChatSidebarProps {
	stageRef: RefObject<Konva.Stage | null>;
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Generate a simple unique ID */
function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Render basic markdown-like formatting in AI responses.
 * Handles: **bold**, *italic*, `code`, bullet lists, numbered lists, headings.
 */
function formatMessage(text: string): string {
	return (
		text
			// Code blocks (```...```)
			.replace(
				/```(\w*)\n?([\s\S]*?)```/g,
				'<pre class="ai-code-block"><code>$2</code></pre>',
			)
			// Inline code
			.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
			// Bold
			.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
			// Italic
			.replace(/\*([^*]+)\*/g, "<em>$1</em>")
			// Headings
			.replace(/^### (.+)$/gm, '<h4 class="ai-heading">$1</h4>')
			.replace(/^## (.+)$/gm, '<h3 class="ai-heading">$1</h3>')
			// Bullet lists
			.replace(/^[•\-*] (.+)$/gm, '<li class="ai-list-item">$1</li>')
			// Numbered lists
			.replace(/^\d+\. (.+)$/gm, '<li class="ai-list-item-num">$1</li>')
			// Line breaks
			.replace(/\n/g, "<br/>")
	);
}

// ============================================================================
// AI CHAT SIDEBAR COMPONENT
// ============================================================================

export function AiChatSidebar({ stageRef }: AiChatSidebarProps) {
	const isOpen = useCanvasStore((s) => s.isAiChatOpen);
	const setOpen = useCanvasStore((s) => s.setAiChatOpen);
	const elements = useCanvasStore((s) => s.elements);
	const updateElement = useCanvasStore((s) => s.updateElement);
	const deleteElements = useCanvasStore((s) => s.deleteElements);

	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInputState] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isBeginnerExplainMode, setIsBeginnerExplainMode] = useState(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("lekhaflow-beginner-mode") === "true";
		}
		return false;
	});

	// Persist beginner mode preference
	useEffect(() => {
		localStorage.setItem(
			"lekhaflow-beginner-mode",
			String(isBeginnerExplainMode),
		);
	}, [isBeginnerExplainMode]);

	// Expose setInput via ref so child components can use it
	const setInput = useCallback((val: string) => setInputState(val), []);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Focus input when sidebar opens
	useEffect(() => {
		if (isOpen) {
			setTimeout(() => inputRef.current?.focus(), 300);
		}
	}, [isOpen]);

	// Send a message to the AI
	const sendMessage = useCallback(async () => {
		const question = input.trim();
		if (!question || isLoading) return;

		setError(null);
		setInput("");

		// Add user message
		const userMessage: ChatMessage = {
			id: generateId(),
			role: "user",
			content: question,
			timestamp: Date.now(),
		};
		setMessages((prev) => [...prev, userMessage]);

		// Serialize current canvas state (supplementary metadata)
		const canvasContext = serializeCanvasForAI(elements);

		// ── Capture the canvas as a base64 PNG screenshot ──
		let canvasImageBase64: string | null = null;
		const stage = stageRef.current;
		if (stage) {
			try {
				const KonvaLib = (await import("konva")).default;
				const layer = stage.getLayers()[0];

				if (layer && layer.children.length > 0) {
					// Temporarily add a white background so the screenshot
					// has a clean background instead of being transparent
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
						pixelRatio: 0.5, // good balance of quality vs size
						mimeType: "image/png",
					});

					// Remove the prefix "data:image/png;base64," to get raw base64
					canvasImageBase64 = dataURL.replace(/^data:image\/png;base64,/, "");

					// Cleanup temp background
					bgRect.destroy();
					layer.draw();
				}
			} catch (err) {
				console.warn("Failed to capture canvas screenshot:", err);
			}
		}

		// Add a placeholder for the AI response
		const assistantId = generateId();
		const assistantMessage: ChatMessage = {
			id: assistantId,
			role: "assistant",
			content: "",
			timestamp: Date.now(),
		};
		setMessages((prev) => [...prev, assistantMessage]);
		setIsLoading(true);

		try {
			// ── Determine intent: action vs question ──
			const actionMode = isActionIntent(question);

			if (actionMode) {
				// ── ACTION PATH — call /api/ai-modify, apply diffs ──
				const response = await fetch("/api/ai-modify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						prompt: question,
						canvasContext,
						canvasImage: canvasImageBase64,
						explainLikeImNew: isBeginnerExplainMode,
					}),
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(
						errorData.error ||
							`Modification request failed with status ${response.status}`,
					);
				}

				const data = await response.json();
				const actions: ModifyAction[] = data.actions || [];

				if (actions.length === 0) {
					// No actionable modifications — fall back to a helpful message
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantId
								? {
										...msg,
										content:
											"I understood your request but couldn't determine specific modifications to make. Could you be more specific about which elements to change?",
									}
								: msg,
						),
					);
					return;
				}

				// Parse actions into element diffs
				const diffs = parseAiModifications(actions, elements);

				// Apply the diffs to the canvas
				const deleteIds: string[] = [];
				for (const [id, diff] of diffs) {
					if (diff.isDeleted) {
						deleteIds.push(id);
					} else {
						updateElement(id, diff);
					}
				}
				if (deleteIds.length > 0) {
					deleteElements(deleteIds);
				}

				// Build confirmation message
				const summaries = summarizeModifications(actions, elements);
				const confirmationLines = summaries.map((s) => `• ${s.description}`);
				const confirmationText = `Done! I've applied the following changes:\n\n${confirmationLines.join("\n")}`;

				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === assistantId
							? { ...msg, content: confirmationText }
							: msg,
					),
				);
			} else {
				// ── Q&A PATH — stream from /api/ai-chat ──
				// Build conversation history for the API
				const history = messages.map((msg) => ({
					role: msg.role === "assistant" ? "model" : "user",
					content: msg.content,
				}));

				const response = await fetch("/api/ai-chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						question,
						canvasContext,
						canvasImage: canvasImageBase64,
						history,
						explainLikeImNew: isBeginnerExplainMode,
					}),
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(
						errorData.error || `Request failed with status ${response.status}`,
					);
				}

				// Read the stream
				const reader = response.body?.getReader();
				if (!reader) throw new Error("No response stream available");

				const decoder = new TextDecoder();
				let fullText = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value, { stream: true });
					fullText += chunk;

					// Update the assistant message with streamed content
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantId ? { ...msg, content: fullText } : msg,
						),
					);
				}
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to get AI response";
			setError(errorMessage);

			// Remove the empty assistant message on error
			setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));
		} finally {
			setIsLoading(false);
		}
	}, [
		input,
		isLoading,
		elements,
		messages,
		setInput,
		stageRef,
		updateElement,
		deleteElements,
		isBeginnerExplainMode,
	]);

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		},
		[sendMessage],
	);

	// Clear conversation
	const clearConversation = useCallback(() => {
		setMessages([]);
		setError(null);
	}, []);

	// Count elements for display
	const elementCount = Array.from(elements.values()).filter(
		(el) => !el.isDeleted,
	).length;

	return (
		<>
			{/* Toggle Button — positioned left of RoomChat button */}
			<button
				type="button"
				onClick={() => setOpen(!isOpen)}
				title="AI Diagram Assistant"
				className="fixed right-[52px] sm:right-[60px] bottom-[120px] sm:bottom-[140px] z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all hover:scale-105"
				style={{
					background: isOpen
						? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
						: "rgba(255,255,255,0.9)",
					color: isOpen ? "#fff" : "#6b7280",
					boxShadow: isOpen
						? "0 4px 16px rgba(124,58,237,0.4)"
						: "0 2px 12px rgba(0,0,0,0.12)",
					backdropFilter: "blur(12px)",
				}}
			>
				<Sparkles size={18} />
			</button>

			{/* Sidebar Panel — slides in from the RIGHT */}
			<div
				className="fixed top-0 right-0 h-full z-40 flex flex-col transition-transform duration-300 ease-out"
				style={{
					width: "min(380px, 100vw)",
					transform: isOpen ? "translateX(0)" : "translateX(100%)",
					background: "rgba(255,255,255,0.97)",
					backdropFilter: "blur(20px)",
					borderLeft: "1px solid rgba(0,0,0,0.06)",
					boxShadow: isOpen ? "-8px 0 32px rgba(0,0,0,0.08)" : "none",
				}}
			>
				{/* Header */}
				<div
					className="flex items-center justify-between px-5 py-4 flex-shrink-0"
					style={{
						borderBottom: "1px solid rgba(0,0,0,0.06)",
						background:
							"linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(109,40,217,0.02) 100%)",
					}}
				>
					<div className="flex items-center gap-2.5">
						<div
							className="w-8 h-8 rounded-[10px] flex items-center justify-center"
							style={{
								background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
								boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
							}}
						>
							<Sparkles size={16} className="text-white" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-gray-800 m-0">
								AI Assistant
							</h3>
							<p className="text-[11px] text-violet-500 m-0 font-medium">
								{elementCount} element{elementCount !== 1 ? "s" : ""} on canvas
							</p>
						</div>
					</div>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => setIsBeginnerExplainMode((v) => !v)}
							title="Explains the diagram in simpler terms for beginners"
							className="flex items-center gap-1 px-2 py-1 rounded-lg border-none cursor-pointer transition-all text-[11px] font-medium"
							style={{
								background: isBeginnerExplainMode
									? "rgba(124,58,237,0.12)"
									: "rgba(0,0,0,0.04)",
								color: isBeginnerExplainMode ? "#7c3aed" : "#9ca3af",
							}}
						>
							<BookOpen size={12} />
							<span>Beginner</span>
						</button>
						{messages.length > 0 && (
							<button
								type="button"
								onClick={clearConversation}
								title="Clear conversation"
								className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer flex items-center justify-center hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
							>
								<Trash2 size={14} />
							</button>
						)}
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer flex items-center justify-center hover:bg-gray-100 transition-colors"
						>
							<X size={16} className="text-gray-500" />
						</button>
					</div>
				</div>

				{/* Messages Area */}
				<div className="flex-1 overflow-y-auto px-4 py-3">
					{messages.length === 0 ? (
						<EmptyState
							elementCount={elementCount}
							onSuggestionClick={setInput}
						/>
					) : (
						<div className="flex flex-col gap-3">
							{messages.map((msg) => (
								<MessageBubble
									key={msg.id}
									message={msg}
									isLoading={
										isLoading && msg.role === "assistant" && msg.content === ""
									}
								/>
							))}
							<div ref={messagesEndRef} />
						</div>
					)}
				</div>

				{/* Error Banner */}
				{error && (
					<div
						className="mx-4 mb-2 px-3 py-2 rounded-lg text-xs font-medium"
						style={{
							background: "rgba(239,68,68,0.1)",
							color: "#dc2626",
							border: "1px solid rgba(239,68,68,0.2)",
						}}
					>
						{error}
					</div>
				)}

				{/* Input Area */}
				<div
					className="flex-shrink-0 px-4 py-3"
					style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
				>
					<div
						className="flex items-end gap-2 rounded-xl px-3 py-2"
						style={{
							background: "rgba(0,0,0,0.03)",
							border: "1px solid rgba(0,0,0,0.08)",
						}}
					>
						<textarea
							ref={inputRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={
								elementCount === 0
									? "Draw something first, then ask about it..."
									: "Ask about your diagram or tell me to change it..."
							}
							disabled={isLoading}
							rows={1}
							className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-gray-700 placeholder-gray-400"
							style={{
								minHeight: "24px",
								maxHeight: "100px",
								lineHeight: "1.5",
							}}
							onInput={(e) => {
								const target = e.target as HTMLTextAreaElement;
								target.style.height = "24px";
								target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
							}}
						/>
						<button
							type="button"
							onClick={sendMessage}
							disabled={!input.trim() || isLoading}
							className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all"
							style={{
								background:
									input.trim() && !isLoading
										? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
										: "rgba(0,0,0,0.05)",
								color: input.trim() && !isLoading ? "#fff" : "#9ca3af",
								opacity: isLoading ? 0.5 : 1,
							}}
						>
							<Send size={14} />
						</button>
					</div>
					<p className="text-[10px] text-gray-400 mt-1.5 px-1">
						Powered by Gemini • Enter to send, Shift+Enter for new line
						{isBeginnerExplainMode && (
							<span className="text-violet-400"> • Beginner mode on</span>
						)}
					</p>
				</div>
			</div>
		</>
	);
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Empty state when no messages yet */
function EmptyState({
	elementCount,
	onSuggestionClick,
}: {
	elementCount: number;
	onSuggestionClick: (text: string) => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center h-full text-center px-6">
			<div
				className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
				style={{
					background:
						"linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(109,40,217,0.06) 100%)",
				}}
			>
				<Bot size={28} className="text-violet-400" />
			</div>
			<h4 className="text-base font-semibold text-gray-700 mb-1">
				Ask about your diagram
			</h4>
			<p className="text-xs text-gray-400 mb-6 leading-relaxed">
				{elementCount === 0
					? "Your canvas is empty. Draw some shapes and connections, then ask me to explain the flow!"
					: `I can see ${elementCount} element${elementCount !== 1 ? "s" : ""} on your canvas. Ask me anything or tell me to make changes!`}
			</p>

			{elementCount > 0 && (
				<div className="flex flex-col gap-2 w-full max-w-[260px]">
					<SuggestionChip
						text="What does this diagram show?"
						onClick={onSuggestionClick}
					/>
					<SuggestionChip
						text="Make all circles green"
						onClick={onSuggestionClick}
					/>
					<SuggestionChip
						text="Explain the flow step by step"
						onClick={onSuggestionClick}
					/>
				</div>
			)}
		</div>
	);
}

/** Suggestion chip for quick questions */
function SuggestionChip({
	text,
	onClick,
}: {
	text: string;
	onClick: (text: string) => void;
}) {
	return (
		<button
			type="button"
			className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-gray-600 transition-all hover:text-violet-600 border-none cursor-pointer"
			style={{
				background: "rgba(124,58,237,0.04)",
				border: "1px solid rgba(124,58,237,0.1)",
			}}
			onClick={() => onClick(text)}
		>
			<MessageSquare
				size={12}
				className="inline-block mr-1.5 text-violet-400"
			/>
			{text}
		</button>
	);
}

/** Individual message bubble */
function MessageBubble({
	message,
	isLoading,
}: {
	message: ChatMessage;
	isLoading: boolean;
}) {
	const isUser = message.role === "user";

	return (
		<div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
					isUser ? "rounded-br-md" : "rounded-bl-md"
				}`}
				style={{
					background: isUser
						? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
						: "rgba(0,0,0,0.04)",
					color: isUser ? "#fff" : "#374151",
					border: isUser ? "none" : "1px solid rgba(0,0,0,0.06)",
				}}
			>
				{isLoading ? (
					<div className="flex items-center gap-1.5 py-1">
						<div className="ai-typing-dot" />
						<div className="ai-typing-dot" style={{ animationDelay: "0.2s" }} />
						<div className="ai-typing-dot" style={{ animationDelay: "0.4s" }} />
					</div>
				) : isUser ? (
					<span>{message.content}</span>
				) : (
					<div
						className="ai-message-content"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Controlled AI output with basic markdown formatting
						dangerouslySetInnerHTML={{
							__html: formatMessage(message.content),
						}}
					/>
				)}
			</div>
		</div>
	);
}
