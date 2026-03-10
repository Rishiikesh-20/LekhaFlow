"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.client";

const HTTP_URL =
	process.env.NEXT_PUBLIC_HTTP_URL || "https://lekhaflow.rishiikesh.me";

function Loading() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
			<div className="flex flex-col items-center gap-4 animate-fade-in">
				<div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
				<p className="text-white text-base font-medium">
					Completing sign in...
				</p>
			</div>
		</div>
	);
}

function AuthCallbackContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const handleAuthCallback = async () => {
			const {
				data: { session },
				error: sessionError,
			} = await supabase.auth.getSession();

			if (sessionError) {
				console.error("[AuthCallback] Error:", sessionError.message);
				setError(sessionError.message);
				return;
			}

			if (!session) {
				const {
					data: { session: retrySession },
				} = await supabase.auth.getSession();

				if (!retrySession) {
					setError("Failed to authenticate. Please try again.");
					return;
				}
			}

			// Sync user profile to public.users table
			const activeSession =
				session ?? (await supabase.auth.getSession()).data.session;
			if (activeSession) {
				try {
					await fetch(`${HTTP_URL}/api/v1/auth/sync-user`, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${activeSession.access_token}`,
							"Content-Type": "application/json",
						},
					});
				} catch (e) {
					console.warn("[AuthCallback] User sync failed (non-critical):", e);
				}
			}

			const next = searchParams?.get("next") ?? "/";
			router.replace(next);
		};

		handleAuthCallback();
	}, [router, searchParams]);

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-red-50 p-5">
				<div className="text-center max-w-sm animate-fade-in">
					<div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
						<svg
							className="w-6 h-6 text-red-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
							role="img"
							aria-label="Error icon"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</div>
					<p className="text-red-600 mb-4 text-sm">{error}</p>
					<button
						type="button"
						onClick={() => router.push("/login")}
						className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
					>
						Back to Login
					</button>
				</div>
			</div>
		);
	}

	return <Loading />;
}

export default function AuthCallbackPage() {
	return (
		<Suspense fallback={<Loading />}>
			<AuthCallbackContent />
		</Suspense>
	);
}
