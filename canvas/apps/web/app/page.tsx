"use client";

import type { User } from "@supabase/supabase-js";
import { ArrowRight, LogOut, Plus, Sparkles, Users, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Antigravity from "../components/Antigravity";
import { Dashboard } from "../components/Dashboard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { supabase } from "../lib/supabase.client";

const HTTP_URL = process.env.NEXT_PUBLIC_HTTP_URL || "http://localhost:8000";

export default function Home() {
	const router = useRouter();
	const [roomId, setRoomId] = useState("");
	const [user, setUser] = useState<User | null>(null);
	const [authLoading, setAuthLoading] = useState(true);
	const [creating, setCreating] = useState(false);

	// Listen for auth state
	useEffect(() => {
		const getSession = async () => {
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				setUser(session?.user ?? null);
			} catch (err) {
				console.warn("Failed to fetch session (network may be down):", err);
				setUser(null);
			} finally {
				setAuthLoading(false);
			}
		};
		getSession();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
		});

		return () => subscription.unsubscribe();
	}, []);

	const handleSignOut = async () => {
		await supabase.auth.signOut();
		setUser(null);
	};

	const createRoom = async () => {
		if (!user) {
			router.push("/login?next=/");
			return;
		}

		setCreating(true);
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) {
				router.push("/login");
				return;
			}

			const res = await fetch(`${HTTP_URL}/api/v1/canvas/create-canvas`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({ name: "Untitled Canvas" }),
			});

			const data = await res.json();
			if (res.ok) {
				router.push(`/canvas/${data.data.roomId}`);
			} else {
				console.error(
					"Failed to create canvas:",
					data?.message ?? res.statusText,
				);
			}
		} catch (e) {
			console.error("Error creating canvas:", e);
		} finally {
			setCreating(false);
		}
	};

	const joinRoom = (e: React.FormEvent) => {
		e.preventDefault();
		if (!roomId.trim()) return;

		if (!user) {
			router.push(
				`/login?next=${encodeURIComponent(`/canvas/${roomId.trim()}`)}`,
			);
			return;
		}

		router.push(`/canvas/${roomId.trim()}`);
	};

	const userName =
		user?.user_metadata?.name ||
		user?.user_metadata?.full_name ||
		user?.email?.split("@")[0] ||
		"User";
	const userAvatar: string | null =
		user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

	return (
		<main className="min-h-screen bg-[#f8f7f4] font-sans">
			{/* Navbar */}
			<nav className="border-b border-gray-200/60 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
					<Link href="/" className="flex items-center gap-2.5 group">
						<Image
							src="/logo.jpg"
							alt="LekhaFlow"
							width={36}
							height={36}
							className="h-9 w-auto rounded-lg"
						/>
						<span className="font-heading text-lg font-bold text-gray-900">
							LekhaFlow
						</span>
					</Link>
					<div className="flex items-center gap-3">
						{authLoading ? (
							<div className="h-8 w-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
						) : user ? (
							<>
								<div className="flex items-center gap-2.5">
									{userAvatar ? (
										<Image
											src={userAvatar}
											alt={userName}
											width={32}
											height={32}
											className="h-8 w-8 rounded-full ring-2 ring-violet-100"
										/>
									) : (
										<div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center text-sm font-semibold text-violet-600">
											{userName[0]?.toUpperCase()}
										</div>
									)}
									<span className="text-sm font-medium text-gray-700 hidden sm:block">
										{userName}
									</span>
								</div>
								<button
									type="button"
									onClick={handleSignOut}
									className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
									title="Sign out"
								>
									<LogOut size={18} />
								</button>
							</>
						) : (
							<>
								<Link href="/login">
									<Button variant="ghost" size="sm">
										Sign in
									</Button>
								</Link>
								<Link href="/login">
									<Button size="sm">Get Started</Button>
								</Link>
							</>
						)}
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="py-20 sm:py-28 px-6 relative overflow-hidden">
				{/* Antigravity particle background */}
				<Antigravity
					count={200}
					magnetRadius={6}
					ringRadius={7}
					waveSpeed={0.4}
					waveAmplitude={1}
					particleSize={1.2}
					lerpSpeed={0.05}
					color="#7c3aed"
					autoAnimate
					particleVariance={1}
					rotationSpeed={0}
					depthFactor={1}
					pulseSpeed={3}
					particleShape="capsule"
					fieldStrength={10}
					className="absolute inset-0 z-0 opacity-30"
				/>

				<div className="max-w-3xl mx-auto text-center space-y-8 relative z-10 px-4">
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 text-violet-700 text-sm font-medium border border-violet-100">
						<span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
						Real-time collaboration
					</div>

					<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 font-heading tracking-tight leading-[1.08]">
						Think together,
						<br />
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600">
							create together
						</span>
					</h1>

					<p className="text-base sm:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
						A collaborative whiteboard for teams to brainstorm, plan, and
						visualize ideas in real-time.
					</p>

					{/* Action Buttons */}
					<div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
						<Button
							onClick={createRoom}
							size="lg"
							disabled={creating}
							className="h-12 px-8 text-base shadow-lg shadow-violet-200/50"
						>
							{creating ? (
								<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
							) : (
								<Plus className="w-5 h-5 mr-2" />
							)}
							{creating ? "Creating..." : "Create New Canvas"}
						</Button>

						<span className="text-gray-400 text-sm hidden sm:block">or</span>

						<form onSubmit={joinRoom} className="flex gap-2">
							<Input
								value={roomId}
								onChange={(e) => setRoomId(e.target.value)}
								placeholder="Enter room code"
								className="w-44 h-12 bg-white"
							/>
							<Button
								type="submit"
								variant="outline"
								size="lg"
								disabled={!roomId.trim()}
								className="h-12"
							>
								Join
								<ArrowRight className="w-4 h-4 ml-2" />
							</Button>
						</form>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="py-10 border-y border-gray-200/60 bg-white/50">
				<div className="max-w-6xl mx-auto px-6">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
						<div className="flex items-center gap-3 justify-center">
							<div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
								<Zap className="w-4 h-4 text-green-600" />
							</div>
							<span className="text-gray-600 font-medium">Real-time sync</span>
						</div>
						<div className="flex items-center gap-3 justify-center">
							<div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
								<Sparkles className="w-4 h-4 text-violet-600" />
							</div>
							<span className="text-gray-600 font-medium">Infinite canvas</span>
						</div>
						<div className="flex items-center gap-3 justify-center">
							<div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
								<Users className="w-4 h-4 text-amber-600" />
							</div>
							<span className="text-gray-600 font-medium">
								Team collaboration
							</span>
						</div>
						<div className="flex items-center gap-3 justify-center">
							<div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
								<svg
									className="w-4 h-4 text-blue-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
									role="img"
									aria-label="Security icon"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									/>
								</svg>
							</div>
							<span className="text-gray-600 font-medium">
								Secure & private
							</span>
						</div>
					</div>
				</div>
			</section>

			{/* Dashboard Section - only shown when signed in */}
			{user && (
				<section className="px-6 py-16">
					<div className="max-w-6xl mx-auto">
						<div className="flex items-center justify-between mb-8">
							<h2 className="text-2xl font-bold text-gray-900 font-heading">
								Recent Canvases
							</h2>
						</div>
						<Dashboard />
					</div>
				</section>
			)}

			{/* CTA for unauthenticated users */}
			{!authLoading && !user && (
				<section className="px-6 py-20">
					<div className="max-w-2xl mx-auto text-center">
						<h2 className="text-2xl font-bold text-gray-900 font-heading mb-4">
							Ready to collaborate?
						</h2>
						<p className="text-gray-500 mb-8">
							Sign in to create canvases, save your work, and collaborate with
							your team in real-time.
						</p>
						<Link href="/login">
							<Button size="lg" className="h-12 px-8">
								Get Started — It&apos;s Free
							</Button>
						</Link>
					</div>
				</section>
			)}

			{/* Footer */}
			<footer className="border-t border-gray-200/60 py-8 bg-white/50">
				<div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
					<span className="font-heading text-sm font-bold text-gray-500">
						LekhaFlow
					</span>
					<p className="text-sm text-gray-400">
						© 2026 LekhaFlow. Open-source collaborative canvas.
					</p>
				</div>
			</footer>
		</main>
	);
}
