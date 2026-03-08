"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.client";
import { useCanvasStore } from "../store/canvas-store";
import { Canvas } from "./Canvas";

const USER_COLORS = [
	"#FF5733",
	"#33FF57",
	"#3357FF",
	"#F033FF",
	"#33FFF5",
	"#FF33A1",
	"#A133FF",
	"#33FFA1",
];

function getUserColor(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	}
	return USER_COLORS[Math.abs(hash) % USER_COLORS.length] || "#FF5733";
}

export function CanvasAuthWrapper({ roomId }: { roomId: string }) {
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [joining, setJoining] = useState(false);
	const [connError, setConnError] = useState<string | null>(null);
	const router = useRouter();
	const searchParams = useSearchParams();
	const setMyIdentity = useCanvasStore((s) => s.setMyIdentity);

	const HTTP_URL = process.env.NEXT_PUBLIC_HTTP_URL || "http://localhost:8000";

	useEffect(() => {
		let cancelled = false;

		const fetchSession = async () => {
			try {
				const {
					data: { session },
					error,
				} = await supabase.auth.getSession();

				if (cancelled) return;

				if (error) {
					setConnError(
						"Failed to connect to authentication service. Please check your internet connection and try again.",
					);
					setLoading(false);
					return;
				}

				if (!session) {
					// Save full URL including search params so the invite token is preserved after logic
					const fullUrl = window.location.pathname + window.location.search;
					router.replace(`/login?next=${encodeURIComponent(fullUrl)}`);
					return;
				}

				// Check for invite token
				const inviteToken = searchParams.get("inviteToken");

				if (inviteToken) {
					setJoining(true);
					try {
						const res = await fetch(
							`${HTTP_URL}/api/v1/canvas/${roomId}/join`,
							{
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									Authorization: `Bearer ${session.access_token}`,
								},
								body: JSON.stringify({ token: inviteToken }),
							},
						);

						if (!res.ok) {
							console.error("Failed to join canvas via invite link");
						} else {
							// Clean up URL to remove the single-use token from history
							const currentUrl = new URL(window.location.href);
							currentUrl.searchParams.delete("inviteToken");
							router.replace(currentUrl.pathname + currentUrl.search);
						}
					} catch (err) {
						console.error("Error joining with invite link:", err);
					} finally {
						if (!cancelled) setJoining(false);
					}
				}

				setToken(session.access_token);

				const user = session.user;
				const name =
					user.user_metadata?.name ||
					user.user_metadata?.full_name ||
					user.email?.split("@")[0] ||
					"User";
				const color = getUserColor(user.id);
				setMyIdentity(name, color);
				setLoading(false);
			} catch (err) {
				if (cancelled) return;
				// Ignore AbortError — caused by React Fast Refresh unmounting
				if (err instanceof Error && err.name === "AbortError") return;
				console.error("[CanvasAuthWrapper] getSession failed:", err);
				setConnError(
					"Failed to connect to authentication service. Please check your internet connection and try again.",
				);
				setLoading(false);
			}
		};

		fetchSession();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			if (cancelled) return;
			if (session) {
				setToken(session.access_token);
				const user = session.user;
				const name =
					user.user_metadata?.name ||
					user.user_metadata?.full_name ||
					user.email?.split("@")[0] ||
					"User";
				const color = getUserColor(user.id);
				setMyIdentity(name, color);
			} else {
				router.replace(
					`/login?next=${encodeURIComponent(`/canvas/${roomId}`)}`,
				);
			}
		});

		return () => {
			cancelled = true;
			subscription.unsubscribe();
		};
	}, [roomId, router, setMyIdentity, searchParams, HTTP_URL]);

	if (connError) {
		return (
			<div className="flex items-center justify-center h-screen bg-gray-50">
				<div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
					<div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
						<svg
							className="w-7 h-7 text-red-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
							/>
						</svg>
					</div>
					<h2 className="text-lg font-semibold text-gray-800">
						Connection Error
					</h2>
					<p className="text-sm text-gray-500">{connError}</p>
					<button
						type="button"
						onClick={() => {
							setConnError(null);
							setLoading(true);
						}}
						className="mt-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (loading || joining) {
		return (
			<div className="flex items-center justify-center h-screen bg-gray-50">
				<div className="flex flex-col items-center gap-4">
					<Loader2 className="animate-spin text-violet-600 h-10 w-10" />
					<p className="text-gray-400 text-sm">
						{joining ? "Joining canvas..." : "Loading canvas..."}
					</p>
				</div>
			</div>
		);
	}

	return <Canvas roomId={roomId} token={token} />;
}
