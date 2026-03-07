"use client";

import { useEffect, useState } from "react";
import { Canvas } from "../../../components/Canvas";
import { supabase } from "../../../lib/supabase.client";

interface CanvasPageClientProps {
	roomId: string;
}

export function CanvasPageClient({ roomId }: CanvasPageClientProps) {
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Get the current session
		const getSession = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (session?.access_token) {
				setToken(session.access_token);
			}
			setLoading(false);
		};

		getSession();

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setToken(session?.access_token ?? null);
		});

		return () => subscription.unsubscribe();
	}, []);

	// Fire-and-forget: update last_accessed_at with 2s debounce
	useEffect(() => {
		if (!token) return;

		const HTTP_URL =
			process.env.NEXT_PUBLIC_HTTP_URL || "http://localhost:8000";
		const timer = setTimeout(() => {
			fetch(`${HTTP_URL}/api/v1/canvas/${roomId}/touch`, {
				method: "PATCH",
				headers: { Authorization: `Bearer ${token}` },
			}).catch(() => {
				// Silently ignore errors — this is a non-critical update
			});
		}, 2000);

		return () => clearTimeout(timer);
	}, [token, roomId]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-gray-500">Loading canvas...</div>
			</div>
		);
	}

	if (!token) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-4">
				<p className="text-gray-600">Please log in to use the canvas.</p>
				<a
					href="/login"
					className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
				>
					Go to Login
				</a>
			</div>
		);
	}

	return <Canvas roomId={roomId} token={token} />;
}
