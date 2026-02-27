import { createClient } from "@supabase/supabase-js";

// Use process.env directly so Next.js can substitute values at build time.
// Workspace packages (like @repo/config) do NOT receive NEXT_PUBLIC_* from
// apps/web/.env, so importing clientEnv from there yields empty strings.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error(
		"[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
	);
}

/**
 * Custom fetch that adds a per-request timeout so Supabase calls don't
 * hang forever when the network is down (e.g. ERR_NETWORK_CHANGED in Brave).
 *
 * - Each attempt times out after 8 seconds
 * - Network errors are retried up to 2 times with a short delay
 * - If all retries fail the error is thrown so callers (getSession, etc.)
 *   resolve with an error instead of blocking indefinitely
 */
async function fetchWithTimeout(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	const PER_REQUEST_TIMEOUT = 8_000; // 8 seconds
	const MAX_RETRIES = 2;
	let attempt = 0;

	while (true) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT);

		try {
			const response = await fetch(input, {
				...init,
				signal: init?.signal ?? controller.signal,
			});
			clearTimeout(timeoutId);
			return response;
		} catch (err) {
			clearTimeout(timeoutId);
			attempt++;
			const isNetworkError =
				err instanceof TypeError && err.message === "Failed to fetch";
			const isAbort = err instanceof DOMException && err.name === "AbortError";

			if ((!isNetworkError && !isAbort) || attempt >= MAX_RETRIES) throw err;

			// Short delay before retry: 1s, 2s
			await new Promise((r) => setTimeout(r, 1000 * attempt));
		}
	}
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	global: { fetch: fetchWithTimeout },
});
