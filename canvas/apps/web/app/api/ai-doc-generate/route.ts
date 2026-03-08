/**
 * ============================================================================
 * LEKHAFLOW - AI DOCUMENTATION GENERATION API ROUTE
 * ============================================================================
 *
 * Next.js API route that generates Markdown documentation from a canvas
 * diagram. Uses Google Gemini to analyse the graph structure (nodes, edges,
 * spatial layout) and optional screenshot, then produces a well-structured
 * document describing the diagram.
 *
 * POST /api/ai-doc-generate
 * Body: {
 *   canvasContext: SerializedCanvas,
 *   canvasImage?: string,   // base64-encoded PNG of the canvas
 * }
 * Returns: Streamed Markdown text from the LLM
 */

import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { type NextRequest, NextResponse } from "next/server";

// Allow longer AI generation time
export const maxDuration = 60; // seconds

// ============================================================================
// SYSTEM PROMPT — tailored for documentation generation
// ============================================================================

const DOC_SYSTEM_PROMPT = `You are a professional technical writer that generates clear, well-structured Markdown documentation from diagrams and flowcharts.

You will receive:
1. A **screenshot** (PNG image) of a canvas diagram — this is the primary source of truth.
2. **Structured metadata** (JSON) describing shapes (nodes), connections (edges), and text labels.

Your job is to produce a **comprehensive Markdown document** that explains **what the diagram represents** — the concepts, systems, processes, or workflows it depicts — NOT the shapes used to draw it.

CRITICAL: NEVER describe the diagram in terms of shapes (rectangles, circles, ellipses, diamonds, arrows, lines). Instead, interpret what each shape represents based on its label/text and context:
- A rectangle labeled "Database" is a database, NOT "a rectangle".
- A circle labeled "User" is a user/actor, NOT "a circle" or "an ellipse".
- An arrow from "Client" to "Server" is a request or communication flow, NOT "an arrow connecting two shapes".
- A diamond labeled "Valid?" is a decision point, NOT "a diamond shape".

Structure the document as follows:

1. **Title** — A descriptive title based on what the diagram is about (use # heading). For example, "User Authentication Flow" instead of "Diagram with Rectangles and Arrows".
2. **Overview** — A concise 2-3 sentence summary of the system, process, or concept the diagram illustrates.
3. **Components** — List and describe each component/entity by what it represents (its label and role in the system). Use a table or bulleted list. Explain the purpose of each.
4. **Flow / Interactions** — Describe the step-by-step process or data flow using the labels and semantic meaning. Use a numbered list. If there are multiple flows, describe each separately.
5. **Relationships** — Explain how components interact, depend on, or communicate with each other.
6. **Notes** — Any additional observations: architecture patterns used, potential bottlenecks, design decisions implied by the diagram, etc.

Guidelines:
- Write in clear, professional English.
- Use proper Markdown formatting: headings (#, ##, ###), bold, bullet lists, numbered lists, tables, and code blocks where appropriate.
- ALWAYS refer to elements by their labels or what they represent, NEVER by their shape type.
- If an element has no label, infer its purpose from context (position, connections, nearby labeled elements). Only describe it by shape type as a last resort.
- Follow the connection direction to determine flow (source → destination).
- If the diagram looks like a specific kind of diagram (flowchart, system architecture, sequence diagram, ER diagram, data flow diagram, etc.), mention that explicitly.
- Focus on the meaning and semantics. Someone reading this document should understand the system/process without ever needing to see the diagram.
- Be thorough but concise.
- Do NOT make up information that isn't visible. If something is ambiguous, say so.
- Do NOT include any preamble like "Here is the documentation" — start directly with the title heading.`;

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
		const { canvasContext, canvasImage } = body;

		if (!canvasContext) {
			return NextResponse.json(
				{ error: "Canvas context is required." },
				{ status: 400 },
			);
		}

		// Initialize Gemini
		const genAI = new GoogleGenerativeAI(apiKey);

		// Models to try in order — if one's quota is exhausted, fall back
		const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

		// ── Build the multimodal prompt parts ──
		const promptParts: Part[] = [];

		// Add canvas screenshot if available
		if (canvasImage) {
			promptParts.push({
				inlineData: {
					mimeType: "image/png",
					data: canvasImage,
				},
			});
		}

		// Add structured metadata
		let metadataText =
			"Generate comprehensive Markdown documentation for the following diagram.\n\n";
		metadataText += `## Canvas Summary\n\n${canvasContext.summary || "No summary available."}\n\n`;

		if (canvasContext.nodes?.length) {
			metadataText += `## Nodes (${canvasContext.nodes.length} total)\n\n${JSON.stringify(canvasContext.nodes, null, 2)}\n\n`;
		}

		if (canvasContext.edges?.length) {
			metadataText += `## Edges / Connections (${canvasContext.edges.length} total)\n\n${JSON.stringify(canvasContext.edges, null, 2)}\n\n`;
		}

		if (
			(!canvasContext.nodes || canvasContext.nodes.length === 0) &&
			(!canvasContext.edges || canvasContext.edges.length === 0)
		) {
			metadataText +=
				"The canvas appears to have no structured elements. If there is a screenshot, describe what you see visually.\n";
		}

		promptParts.push({ text: metadataText });

		// ── Try each model until one succeeds ──
		let lastError: unknown = null;

		for (const modelName of MODELS) {
			try {
				const model = genAI.getGenerativeModel({
					model: modelName,
					systemInstruction: DOC_SYSTEM_PROMPT,
				});

				const result = await model.generateContentStream(promptParts);

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
		console.error("AI Doc Generation error:", error);

		const message =
			error instanceof Error ? error.message : "An unexpected error occurred";

		return NextResponse.json({ error: message }, { status: 500 });
	}
}
