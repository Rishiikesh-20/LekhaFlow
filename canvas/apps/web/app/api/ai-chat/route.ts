/**
 * ============================================================================
 * LEKHAFLOW - AI CHAT API ROUTE (MULTIMODAL / VISION)
 * ============================================================================
 *
 * Next.js API route that handles AI-powered diagram Q&A.
 * Uses Google Gemini's **multimodal** capabilities to analyse a
 * **screenshot** of the canvas together with structured metadata.
 *
 * POST /api/ai-chat
 * Body: {
 *   question: string,
 *   canvasContext: SerializedCanvas,
 *   canvasImage?: string,   // base64-encoded PNG of the canvas
 *   history?: Array<{ role: string, content: string }>
 * }
 * Returns: Streamed text response from the LLM
 */

import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { type NextRequest, NextResponse } from "next/server";

import { getSystemPrompt } from "../../../lib/ai-chat-prompts";

// Allow longer AI generation time
export const maxDuration = 60; // seconds

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
	try {
		const apiKey = process.env.GEMINI_API_KEY;

		if (!apiKey) {
			return NextResponse.json(
				{
					error:
						"GEMINI_API_KEY is not configured. Please add it to your .env.local file.",
				},
				{ status: 500 },
			);
		}

		const body = await request.json();
		const { question, canvasContext, canvasImage, history } = body;
		const beginnerMode = body.explainLikeImNew === true;

		if (!question || typeof question !== "string") {
			return NextResponse.json(
				{ error: "Question is required." },
				{ status: 400 },
			);
		}

		// Initialize Gemini
		const genAI = new GoogleGenerativeAI(apiKey);

		// Models to try in order — if one's quota is exhausted, fall back to the next
		const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

		// ── Build the multimodal prompt parts ──
		// The very first user turn includes the image + metadata + question.
		// Subsequent turns in the conversation are text-only (the image was
		// already provided in the first turn).

		const isFirstTurn = !history || history.length === 0;

		// ── Chat history for multi-turn conversation ──
		const chatHistory: Array<{
			role: "user" | "model";
			parts: Part[];
		}> = [];

		if (isFirstTurn) {
			// First turn: send the image + metadata as one combined user message,
			// followed by the model acknowledgement.
			const firstUserParts: Part[] = [];

			// Add canvas screenshot if available
			if (canvasImage) {
				firstUserParts.push({
					inlineData: {
						mimeType: "image/png",
						data: canvasImage,
					},
				});
			}

			// Add structured metadata as supplementary text
			let metadataText =
				"Here is the current canvas I'm working on. Please analyze it.";
			if (canvasContext) {
				metadataText += `\n\n## Supplementary Structured Metadata\n\n${canvasContext.summary || ""}`;
				if (canvasContext.nodes?.length) {
					metadataText += `\n\n### Nodes:\n${JSON.stringify(canvasContext.nodes, null, 2)}`;
				}
				if (canvasContext.edges?.length) {
					metadataText += `\n\n### Edges:\n${JSON.stringify(canvasContext.edges, null, 2)}`;
				}
			}
			firstUserParts.push({ text: metadataText });

			chatHistory.push({ role: "user", parts: firstUserParts });
			chatHistory.push({
				role: "model",
				parts: [
					{
						text: "I can see your canvas. I've analyzed the visual content and the metadata. Feel free to ask me anything about it!",
					},
				],
			});
		} else {
			// Subsequent turns: re-inject the image at the start of the history
			// so the model retains visual context across turns.
			const contextParts: Part[] = [];

			if (canvasImage) {
				contextParts.push({
					inlineData: {
						mimeType: "image/png",
						data: canvasImage,
					},
				});
			}

			let metadataText =
				"Here is the current canvas I'm working on. Please analyze it.";
			if (canvasContext) {
				metadataText += `\n\n## Supplementary Structured Metadata\n\n${canvasContext.summary || ""}`;
				if (canvasContext.nodes?.length) {
					metadataText += `\n\n### Nodes:\n${JSON.stringify(canvasContext.nodes, null, 2)}`;
				}
				if (canvasContext.edges?.length) {
					metadataText += `\n\n### Edges:\n${JSON.stringify(canvasContext.edges, null, 2)}`;
				}
			}
			contextParts.push({ text: metadataText });

			chatHistory.push({ role: "user", parts: contextParts });
			chatHistory.push({
				role: "model",
				parts: [
					{
						text: "I can see your canvas. I've analyzed the visual content and the metadata. Feel free to ask me anything about it!",
					},
				],
			});

			// Add previous conversation history
			for (const msg of history) {
				if (msg.role === "user" || msg.role === "model") {
					chatHistory.push({
						role: msg.role,
						parts: [{ text: msg.content }],
					});
				}
			}
		}

		// ── Try each model until one succeeds ──
		let lastError: unknown = null;

		for (const modelName of MODELS) {
			try {
				const model = genAI.getGenerativeModel({
					model: modelName,
					systemInstruction: getSystemPrompt(beginnerMode),
				});

				const chat = model.startChat({ history: chatHistory });

				// Stream the response
				const result = await chat.sendMessageStream(question);

				const stream = new ReadableStream({
					async start(controller) {
						try {
							for await (const chunk of result.stream) {
								const text = chunk.text();
								if (text) {
									controller.enqueue(new TextEncoder().encode(text));
								}
							}
							controller.close();
						} catch (err) {
							controller.error(err);
						}
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/plain; charset=utf-8",
						"Cache-Control": "no-cache",
						"Transfer-Encoding": "chunked",
					},
				});
			} catch (err: unknown) {
				lastError = err;
				const errMsg = err instanceof Error ? err.message : String(err);

				// Quota/rate-limit error — try next model
				if (
					errMsg.includes("429") ||
					errMsg.includes("quota") ||
					errMsg.includes("RESOURCE_EXHAUSTED")
				) {
					console.warn(
						`Model ${modelName} quota exhausted, trying next model...`,
					);
					continue;
				}

				throw err;
			}
		}

		// All models exhausted
		const fallbackMsg =
			lastError instanceof Error
				? lastError.message
				: "All models have exceeded their free-tier quota. Please wait a few minutes and try again, or use a different API key.";

		return NextResponse.json({ error: fallbackMsg }, { status: 429 });
	} catch (error: unknown) {
		console.error("AI Chat error:", error);

		const message =
			error instanceof Error ? error.message : "An unexpected error occurred";

		return NextResponse.json({ error: message }, { status: 500 });
	}
}
