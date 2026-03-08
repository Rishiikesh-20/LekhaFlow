import "./env.js";

import http from "node:http";
import { Database } from "@hocuspocus/extension-database";
import { Logger } from "@hocuspocus/extension-logger";
import { Server } from "@hocuspocus/server";
import { serverEnv } from "@repo/config/server";
import { createServiceClient } from "./supabase.server.js";

const supabase = createServiceClient();

const PORT = parseInt(serverEnv.WS_PORT, 10);

const server = Server.configure({
	port: PORT,

	/**
	 * Debounce database writes to avoid excessive saves during active editing.
	 * The onStoreDocument hook will only fire after 3 seconds of inactivity.
	 * maxDebounce ensures a save happens at least every 10 seconds during
	 * continuous editing, preventing data loss.
	 */
	debounce: 3000,
	maxDebounce: 10000,

	onAuthenticate: async (data) => {
		const { token, documentName } = data;

		console.log("[Hocuspocus] Auth attempt for document:", documentName);
		console.log("[Hocuspocus] Token present:", !!token);

		if (!token) {
			console.error("[Hocuspocus] No token provided");
			throw new Error("Unauthorized: No token provided");
		}

		console.log("[Hocuspocus] Token preview:", `${token.substring(0, 30)}...`);

		const {
			data: { user },
			error,
		} = await supabase.auth.getUser(token);

		console.log(
			"[Hocuspocus] Supabase auth result - User:",
			!!user,
			"Error:",
			error?.message,
		);

		if (error || !user) {
			console.error("[Hocuspocus] Auth failed:", error?.message || "No user");
			throw new Error("Unauthorized: Invalid token");
		}

		console.log("[Hocuspocus] Auth successful for user:", user.email);

		// Track that this user accessed this canvas (for shared canvas dashboard)
		// Use upsert-like logic: insert only if no recent entry exists
		try {
			// Check for existing recent access log (within last hour to avoid spam)
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
			const { data: existingLog } = await supabase
				.from("activity_logs")
				.select("id")
				.eq("canvas_id", documentName)
				.eq("user_id", user.id)
				.eq("action", "accessed")
				.gte("created_at", oneHourAgo)
				.maybeSingle();

			if (!existingLog) {
				await supabase.from("activity_logs").insert({
					canvas_id: documentName,
					user_id: user.id,
					action: "accessed",
					details: null,
				});
			}
		} catch (e) {
			// Non-critical — don't block auth if activity log fails
			console.warn("[Hocuspocus] Failed to log access:", e);
		}

		return {
			user: {
				id: user.id,
				email: user.email,
			},
		};
	},

	extensions: [
		new Logger(),
		new Database({
			fetch: async ({ documentName }) => {
				const { data, error } = await supabase
					.from("canvases")
					.select("data")
					.eq("id", documentName)
					.maybeSingle();

				// maybeSingle returns null data if not found, without error
				if (error) {
					console.error("[Hocuspocus] Error fetching canvas:", error.message);
					return null;
				}

				// If no data exists yet, that's OK - return null to start fresh
				if (!data) {
					console.log(
						"[Hocuspocus] No existing canvas found for:",
						documentName,
					);
					return null;
				}

				// Handle bytea column - PostgreSQL returns hex string like \x5b312c33...
				if (data.data && typeof data.data === "string") {
					const hexString = data.data;
					console.log(
						"[Hocuspocus] Data is hex string for:",
						documentName,
						"starts with:",
						hexString.slice(0, 20),
					);

					// Remove \x prefix if present (PostgreSQL bytea hex format)
					let hex = hexString;
					if (hex.startsWith("\\x")) {
						hex = hex.slice(2);
					}

					// Convert hex string to Uint8Array
					try {
						const buffer = Buffer.from(hex, "hex");
						console.log(
							"[Hocuspocus] Decoded hex to buffer, length:",
							buffer.length,
							"first bytes:",
							Array.from(buffer.slice(0, 10)),
						);
						return new Uint8Array(buffer);
					} catch (e) {
						console.error(
							"[Hocuspocus] Failed to decode hex, starting fresh:",
							e,
						);
						// Return null to start with empty document instead of failing
						return null;
					}
				}

				// If it's already a buffer/array (shouldn't happen but just in case)
				if (data.data && data.data instanceof Uint8Array) {
					return data.data;
				}

				// data.data is null or some other non-string type — start fresh
				console.log(
					"[Hocuspocus] No binary data stored yet for:",
					documentName,
				);
				return null;
			},

			store: async ({ documentName, state, context }) => {
				// Get the authenticated user's ID from the context (set in onAuthenticate)
				const userId = (context as { user?: { id: string } })?.user?.id;

				if (!state || !(state instanceof Uint8Array)) {
					console.log("[Hocuspocus] No state to save for:", documentName);
					return;
				}

				// Convert Uint8Array to hex string with \x prefix for bytea column
				const hexData = `\\x${Buffer.from(state).toString("hex")}`;

				// Check if canvas already exists
				const { data: existing } = await supabase
					.from("canvases")
					.select("id")
					.eq("id", documentName)
					.maybeSingle();

				if (existing) {
					// Canvas exists — only update data and timestamp (don't overwrite name/owner)
					const { error } = await supabase
						.from("canvases")
						.update({
							data: hexData,
							updated_at: new Date().toISOString(),
						})
						.eq("id", documentName);

					if (error) {
						console.error("[Hocuspocus] Error updating canvas:", error.message);
					} else {
						console.log("[Hocuspocus] Updated canvas:", documentName);
					}
				} else if (userId) {
					// Canvas does not exist — create it (needs owner_id)
					const { error } = await supabase.from("canvases").insert({
						id: documentName,
						data: hexData,
						updated_at: new Date().toISOString(),
						owner_id: userId,
						name: `Canvas ${documentName.slice(0, 8)}`,
					});

					if (error) {
						console.error(
							"[Hocuspocus] Error inserting canvas:",
							error.message,
						);
					} else {
						console.log("[Hocuspocus] Inserted new canvas:", documentName);
					}
				} else {
					console.error(
						"[Hocuspocus] Cannot create canvas without userId:",
						documentName,
					);
				}
			},
		}),
	],
});

// Start a small HTTP health-check server alongside Hocuspocus
const HEALTH_PORT = parseInt(process.env.WS_HEALTH_PORT ?? "8081", 10);
const healthServer = http.createServer((_req, res) => {
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(
		JSON.stringify({
			status: "ok",
			service: "ws-backend",
			timestamp: new Date().toISOString(),
		}),
	);
});
healthServer.listen(HEALTH_PORT, () => {
	console.log(`WS health-check server running on port ${HEALTH_PORT}`);
});

server.listen().then(() => {
	console.log(`Hocuspocus server running on port ${PORT}`);
	console.log("Auth logging enabled for debugging");
});
