/**
 * ============================================================================
 * LEKHAFLOW - AI MODIFICATION API ROUTE
 * ============================================================================
 *
 * Accepts a natural-language modification request together with canvas metadata,
 * and returns a JSON array of structured modification actions that can be
 * previewed before applying.
 *
 * POST /api/ai-modify
 * Body: {
 *   prompt: string,
 *   canvasContext: SerializedCanvas,
 *   canvasImage?: string  // optional base64 PNG
 * }
 * Returns: JSON { actions: ModificationAction[] }
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// ============================================================================
// SYSTEM PROMPT — instructs model to return ONLY JSON
// ============================================================================

const MODIFY_SYSTEM_PROMPT = `You are a canvas modification assistant for a collaborative drawing app called LekhaFlow.

You will receive:
1. A structured description of the current canvas (shapes, their IDs, types, positions, colors).
2. A user request describing what changes to make (e.g. "Make all circles green", "Resize rectangles to 200x200").

Your job is to output ONLY a valid JSON array of modification actions. No prose, no markdown, no explanation — just the raw JSON array.

Each action object must follow this EXACT schema:

{
  "action": "update_color" | "update_stroke" | "resize" | "move" | "delete" | "update_opacity" | "update_stroke_width",
  "filter": {
    "type": "rectangle" | "ellipse" | "diamond" | "line" | "arrow" | "freedraw" | "text" | "all",
    "strokeColor": "#hex" (optional — match elements with this stroke color),
    "backgroundColor": "#hex" (optional — match elements with this background color),
    "ids": ["id1", "id2"] (optional — target specific element IDs)
  },
  "params": {
    // For update_color:
    "strokeColor": "#hex" (optional),
    "backgroundColor": "#hex" (optional),
    // For update_stroke:
    "strokeWidth": number (optional),
    "strokeStyle": "solid" | "dashed" | "dotted" (optional),
    // For resize:
    "width": number,
    "height": number,
    // For move:
    "dx": number (relative X offset),
    "dy": number (relative Y offset),
    // For update_opacity:
    "opacity": number (0-100),
    // For update_stroke_width:
    "strokeWidth": number
  }
}

IMPORTANT RULES:
1. Output ONLY the JSON array — no explanation, no markdown fences, nothing else.
2. Use the element metadata (types, colors, positions) to determine which elements to target.
3. The filter should match the user's intent (e.g. "all circles" → type: "ellipse").
4. When user says "circles", map that to type "ellipse". When they say "squares", map to "rectangle".
5. Colors must be valid hex strings (e.g. "#22c55e" for green, "#ef4444" for red, "#3b82f6" for blue).
6. If the request is unclear or cannot be represented as modifications, return an empty array [].

Example input: "Make all circles green"
Example output:
[{"action":"update_color","filter":{"type":"ellipse"},"params":{"backgroundColor":"#22c55e"}}]

Example input: "Change the stroke color of blue rectangles to red"
Example output:
[{"action":"update_color","filter":{"type":"rectangle","strokeColor":"#1971c2"},"params":{"strokeColor":"#ef4444"}}]`;

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
		const { prompt, canvasContext, canvasImage } = body;

		if (!prompt || typeof prompt !== "string") {
			return NextResponse.json(
				{ error: "Prompt is required." },
				{ status: 400 },
			);
		}

		if (
			!canvasContext ||
			!canvasContext.nodes ||
			canvasContext.nodes.length === 0
		) {
			return NextResponse.json(
				{
					error:
						"Canvas is empty. Please add some shapes before requesting modifications.",
				},
				{ status: 400 },
			);
		}

		const genAI = new GoogleGenerativeAI(apiKey);
		const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

		// Build user message with canvas metadata
		let userMessage = `User request: "${prompt}"\n\n`;
		userMessage += "Current canvas elements:\n";
		userMessage += JSON.stringify(canvasContext.nodes, null, 2);

		if (canvasContext.edges?.length) {
			userMessage += "\n\nConnections:\n";
			userMessage += JSON.stringify(canvasContext.edges, null, 2);
		}

		let lastError: unknown = null;

		for (const modelName of MODELS) {
			try {
				const model = genAI.getGenerativeModel({
					model: modelName,
					systemInstruction: MODIFY_SYSTEM_PROMPT,
				});

				// Build parts — include image if available for better understanding
				const parts: Array<
					{ text: string } | { inlineData: { mimeType: string; data: string } }
				> = [];

				if (canvasImage) {
					parts.push({
						inlineData: {
							mimeType: "image/png",
							data: canvasImage,
						},
					});
				}

				parts.push({ text: userMessage });

				const result = await model.generateContent(parts);
				const response = result.response;
				const text = response.text().trim();

				// Extract JSON from the response
				let jsonText = text;

				// Strip markdown code fences if present
				const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
				if (jsonMatch) {
					jsonText = jsonMatch[1]?.trim() || text;
				}

				// Try to parse JSON
				let actions: unknown;
				try {
					actions = JSON.parse(jsonText);
				} catch {
					// Try to find JSON array in the text
					const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
					if (arrayMatch) {
						actions = JSON.parse(arrayMatch[0]);
					} else {
						return NextResponse.json(
							{
								actions: [],
								message: "Could not parse AI response into actions.",
							},
							{ status: 200 },
						);
					}
				}

				if (!Array.isArray(actions)) {
					actions = [actions];
				}

				return NextResponse.json({ actions }, { status: 200 });
			} catch (err: unknown) {
				lastError = err;
				const errMsg = err instanceof Error ? err.message : String(err);

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

		const fallbackMsg =
			lastError instanceof Error
				? lastError.message
				: "All models have exceeded their free-tier quota.";

		return NextResponse.json({ error: fallbackMsg }, { status: 429 });
	} catch (error: unknown) {
		console.error("AI Modify error:", error);

		const message =
			error instanceof Error ? error.message : "An unexpected error occurred";

		return NextResponse.json({ error: message }, { status: 500 });
	}
}
