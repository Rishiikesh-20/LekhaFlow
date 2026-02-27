"use client";

import { File, Grid, List, Plus, Share2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.client";
import { Button } from "./ui/Button";

const HTTP_URL = process.env.NEXT_PUBLIC_HTTP_URL || "http://localhost:8000";

interface Canvas {
	id: string;
	name: string;
	updated_at: string;
	thumbnail_url: string | null;
	owner_id: string;
}

export function Dashboard() {
	const [canvases, setCanvases] = useState<Canvas[]>([]);
	const [loading, setLoading] = useState(true);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const router = useRouter();

	useEffect(() => {
		let cancelled = false;

		const fetchCanvases = async () => {
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();

				if (cancelled) return;

				if (!session) {
					setLoading(false);
					return;
				}

				setCurrentUserId(session.user.id);

				try {
					const res = await fetch(`${HTTP_URL}/api/v1/canvas`, {
						headers: {
							Authorization: `Bearer ${session.access_token}`,
						},
					});
					if (!cancelled && res.ok) {
						const json = await res.json();
						const list = json?.data?.canvases ?? json?.canvases ?? [];
						setCanvases(Array.isArray(list) ? list : []);
					}
				} catch (e) {
					if (!cancelled) console.error(e);
				} finally {
					if (!cancelled) setLoading(false);
				}
			} catch (err) {
				if (cancelled) return;
				if (err instanceof Error && err.name === "AbortError") return;
				console.error("[Dashboard] getSession failed:", err);
				setLoading(false);
			}
		};

		fetchCanvases();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleDelete = async (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!confirm("Delete this canvas?")) return;

		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return;

		try {
			await fetch(`${HTTP_URL}/api/v1/canvas/${id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${session.access_token}` },
			});
			setCanvases((prev) => prev.filter((c) => c.id !== id));
		} catch (e) {
			console.error(e);
		}
	};

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "Today";
		if (diffDays === 1) return "Yesterday";
		if (diffDays < 7) return `${diffDays} days ago`;
		return date.toLocaleDateString();
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center p-16">
				<div className="h-8 w-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
			</div>
		);
	}

	if (canvases.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed border-gray-300 rounded-2xl bg-white">
				<div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-6">
					<File className="w-8 h-8 text-violet-500" />
				</div>
				<h3 className="text-lg font-medium text-gray-900 font-heading mb-2">
					No canvases yet
				</h3>
				<p className="text-gray-500 text-center max-w-sm mb-6">
					Create your first canvas to start brainstorming with your team.
				</p>
				<Button
					onClick={async () => {
						const {
							data: { session },
						} = await supabase.auth.getSession();
						if (!session) {
							router.push("/login");
							return;
						}
						try {
							const res = await fetch(
								`${HTTP_URL}/api/v1/canvas/create-canvas`,
								{
									method: "POST",
									headers: {
										"Content-Type": "application/json",
										Authorization: `Bearer ${session.access_token}`,
									},
									body: JSON.stringify({ name: "Untitled Canvas" }),
								},
							);
							if (res.ok) {
								const data = await res.json();
								router.push(`/canvas/${data.data.roomId}`);
							}
						} catch (e) {
							console.error(e);
						}
					}}
				>
					<Plus className="w-4 h-4 mr-2" />
					Create Canvas
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex items-center justify-end">
				<div className="flex bg-gray-100 border border-gray-200 rounded-lg p-0.5">
					<button
						type="button"
						onClick={() => setViewMode("grid")}
						className={`p-2 rounded-md transition-colors ${
							viewMode === "grid"
								? "bg-white text-violet-600 shadow-sm"
								: "text-gray-500 hover:text-gray-700"
						}`}
					>
						<Grid size={16} />
					</button>
					<button
						type="button"
						onClick={() => setViewMode("list")}
						className={`p-2 rounded-md transition-colors ${
							viewMode === "list"
								? "bg-white text-violet-600 shadow-sm"
								: "text-gray-500 hover:text-gray-700"
						}`}
					>
						<List size={16} />
					</button>
				</div>
			</div>

			{/* Grid View */}
			{viewMode === "grid" ? (
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
					{canvases.map((canvas) => (
						<div
							key={canvas.id}
							role="button"
							tabIndex={0}
							onClick={() => router.push(`/canvas/${canvas.id}`)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									router.push(`/canvas/${canvas.id}`);
								}
							}}
							className="group relative flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100 transition-all cursor-pointer"
						>
							{/* Thumbnail */}
							<div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
								{canvas.thumbnail_url ? (
									/* biome-ignore lint/performance/noImgElement: Dynamic canvas thumbnails from external URLs */
									<img
										src={canvas.thumbnail_url}
										alt={canvas.name || "Canvas preview"}
										className="w-full h-full object-cover"
										loading="lazy"
									/>
								) : (
									<>
										{/* Grid pattern fallback */}
										<div
											className="absolute inset-0 opacity-[0.4]"
											style={{
												backgroundImage:
													"radial-gradient(circle, #d1d5db 1px, transparent 1px)",
												backgroundSize: "16px 16px",
											}}
										/>
										<div className="w-full h-full flex items-center justify-center">
											<File className="w-10 h-10 text-gray-300" />
										</div>
									</>
								)}

								{/* Hover overlay */}
								<div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/5 transition-colors" />
							</div>

							{/* Info */}
							<div className="p-3 flex items-center justify-between border-t border-gray-100">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-1.5">
										<h3 className="font-medium text-sm text-gray-900 truncate">
											{canvas.name || "Untitled"}
										</h3>
										{currentUserId && canvas.owner_id !== currentUserId && (
											<span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 bg-violet-50 rounded-full">
												<Share2 size={10} />
												Shared
											</span>
										)}
									</div>
									<p className="text-xs text-gray-500 mt-0.5">
										{formatDate(canvas.updated_at)}
									</p>
								</div>

								{(!currentUserId || canvas.owner_id === currentUserId) && (
									<button
										type="button"
										onClick={(e) => handleDelete(canvas.id, e)}
										className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
									>
										<Trash2 size={14} />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			) : (
				/* List View */
				<div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
					{canvases.map((canvas) => (
						<div
							key={canvas.id}
							role="button"
							tabIndex={0}
							onClick={() => router.push(`/canvas/${canvas.id}`)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									router.push(`/canvas/${canvas.id}`);
								}
							}}
							className="flex items-center justify-between p-4 hover:bg-violet-50/50 cursor-pointer group transition-colors"
						>
							<div className="flex items-center gap-4 min-w-0">
								<div className="h-10 w-14 bg-gray-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200">
									{canvas.thumbnail_url ? (
										/* biome-ignore lint/performance/noImgElement: Dynamic canvas thumbnails from external URLs */ <img
											src={canvas.thumbnail_url}
											alt={canvas.name || "Canvas preview"}
											className="w-full h-full object-cover"
											loading="lazy"
										/>
									) : (
										<File size={18} className="text-violet-500" />
									)}
								</div>
								<div className="min-w-0">
									<div className="flex items-center gap-1.5">
										<h3 className="font-medium text-gray-900 truncate">
											{canvas.name || "Untitled"}
										</h3>
										{currentUserId && canvas.owner_id !== currentUserId && (
											<span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 bg-violet-50 rounded-full">
												<Share2 size={10} />
												Shared
											</span>
										)}
									</div>
									<p className="text-xs text-gray-500">
										Edited {formatDate(canvas.updated_at)}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
								<Button variant="secondary" size="sm">
									Open
								</Button>
								{(!currentUserId || canvas.owner_id === currentUserId) && (
									<button
										type="button"
										onClick={(e) => handleDelete(canvas.id, e)}
										className="p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
									>
										<Trash2 size={14} />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
