"use client";

import { Archive, File, Files, Grid, List, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.client";
import { Button } from "./ui/Button";

const HTTP_URL =
	process.env.NEXT_PUBLIC_HTTP_URL || "https://lekhaflow.rishiikesh.me";

interface Canvas {
	id: string;
	name: string;
	updated_at: string;
	thumbnail_url: string | null;
	owner_id: string;
	is_archived?: boolean;
}

export function Dashboard() {
	const [canvases, setCanvases] = useState<Canvas[]>([]);
	const [loading, setLoading] = useState(true);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [showArchived, setShowArchived] = useState(false);
	const [_currentUserId, setCurrentUserId] = useState<string | null>(null);
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

	const handleDuplicate = async (canvas: Canvas, e: React.MouseEvent) => {
		e.stopPropagation();

		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return;

		// Optimistic UI: Add a "ghost" copy to the list
		const tempId = `temp-${Date.now()}`;
		const optimisticCopy: Canvas = {
			...canvas,
			id: tempId,
			name: `${canvas.name} (Copy)`,
			updated_at: new Date().toISOString(),
		};

		setCanvases((prev) => [optimisticCopy, ...prev]);

		try {
			const res = await fetch(
				`${HTTP_URL}/api/v1/canvas/${canvas.id}/duplicate`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${session.access_token}`,
						"Content-Type": "application/json",
					},
				},
			);

			if (res.ok) {
				const json = await res.json();
				const newCanvas = json.data.canvas;

				// Replace ghost with real data
				setCanvases((prev) =>
					prev.map((c) => (c.id === tempId ? newCanvas : c)),
				);
			} else {
				throw new Error("Failed to duplicate");
			}
		} catch (e) {
			console.error(e);
			// Rollback on error
			setCanvases((prev) => prev.filter((c) => c.id !== tempId));
			alert("Failed to duplicate canvas. Please try again.");
		}
	};

	const handleArchive = async (
		id: string,
		isArchived: boolean,
		e: React.MouseEvent,
	) => {
		e.stopPropagation();

		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return;

		try {
			const res = await fetch(`${HTTP_URL}/api/v1/canvas/${id}/archive`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({ isArchived }),
			});

			if (res.ok) {
				setCanvases((prev) =>
					prev.map((c) =>
						c.id === id ? { ...c, is_archived: isArchived } : c,
					),
				);
			}
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

	const filteredCanvases = canvases.filter((c) =>
		showArchived ? c.is_archived === true : !c.is_archived,
	);

	return (
		<div className="space-y-6">
			{/* Toolbar */}
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div className="flex bg-gray-100 border border-gray-200 rounded-xl p-1">
					<button
						type="button"
						onClick={() => setShowArchived(false)}
						className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
							!showArchived
								? "bg-white text-violet-600 shadow-sm"
								: "text-gray-500 hover:text-gray-700"
						}`}
					>
						Active
					</button>
					<button
						type="button"
						onClick={() => setShowArchived(true)}
						className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
							showArchived
								? "bg-white text-violet-600 shadow-sm"
								: "text-gray-500 hover:text-gray-700"
						}`}
					>
						Archived
					</button>
				</div>

				<div className="flex items-center gap-3">
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

					{!showArchived && (
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
							New Canvas
						</Button>
					)}
				</div>
			</div>

			{filteredCanvases.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed border-gray-300 rounded-3xl bg-white">
					<div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6 text-gray-400">
						{showArchived ? <Archive size={32} /> : <File size={32} />}
					</div>
					<h3 className="text-xl font-semibold text-gray-900 mb-2">
						{showArchived ? "No archived canvases" : "No canvases yet"}
					</h3>
					<p className="text-gray-500 text-center max-w-sm">
						{showArchived
							? "Your archived canvases will appear here. Archiving helps you stay organized."
							: "Create your first canvas to start brainstorming."}
					</p>
				</div>
			) : viewMode === "grid" ? (
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
					{filteredCanvases.map((canvas) => (
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
							className="group relative flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100 transition-all cursor-pointer"
						>
							{/* Thumbnail Section */}
							<div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
								{canvas.thumbnail_url ? (
									<Image
										src={canvas.thumbnail_url}
										alt={canvas.name || "Thumbnail"}
										className="object-cover"
										fill
									/>
								) : (
									<div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
										<div
											className="absolute inset-0 opacity-[0.3]"
											style={{
												backgroundImage:
													"radial-gradient(circle, #d1d5db 1px, transparent 1px)",
												backgroundSize: "16px 16px",
											}}
										/>
										<File size={32} />
									</div>
								)}

								{/* Hover Overlay */}
								<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
									<Button
										size="sm"
										className="bg-white text-gray-900 hover:bg-gray-100 border-none px-4"
										onClick={(e) => {
											e.stopPropagation();
											router.push(`/canvas/${canvas.id}`);
										}}
									>
										Open
									</Button>
									<Button
										size="sm"
										variant="primary"
										className="bg-violet-600 border-none"
										onClick={(e) => handleDuplicate(canvas, e)}
									>
										<Files size={14} />
									</Button>
								</div>
							</div>

							{/* Info Section */}
							<div className="p-4 flex items-center justify-between border-t border-gray-100">
								<div className="min-w-0 flex-1">
									<h3 className="font-semibold text-gray-900 truncate">
										{canvas.name || "Untitled"}
									</h3>
									<p className="text-xs text-gray-500 mt-1">
										{formatDate(canvas.updated_at)}
									</p>
								</div>

								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={(e) =>
											handleArchive(canvas.id, !canvas.is_archived, e)
										}
										className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
										title={canvas.is_archived ? "Unarchive" : "Archive"}
									>
										<Archive size={16} />
									</button>
									<button
										type="button"
										onClick={(e) => handleDelete(canvas.id, e)}
										className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
										title="Delete"
									>
										<Trash2 size={16} />
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
					{filteredCanvases.map((canvas) => (
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
							className="flex items-center justify-between p-4 hover:bg-violet-50/50 cursor-pointer transition-colors group"
						>
							<div className="flex items-center gap-4 min-w-0">
								<div className="h-12 w-16 bg-gray-100 relative rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 flex items-center justify-center">
									{canvas.thumbnail_url ? (
										<Image
											src={canvas.thumbnail_url}
											alt={canvas.name || "Thumbnail"}
											className="object-cover"
											fill
										/>
									) : (
										<File size={20} className="text-gray-400" />
									)}
								</div>
								<div className="min-w-0">
									<h3 className="font-semibold text-gray-900 truncate">
										{canvas.name}
									</h3>
									<p className="text-xs text-gray-500">
										Edited {formatDate(canvas.updated_at)}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
								<Button
									variant="secondary"
									size="sm"
									onClick={(e) => handleDuplicate(canvas, e)}
								>
									<Files size={14} className="mr-2" />
									Duplicate
								</Button>
								<button
									type="button"
									onClick={(e) =>
										handleArchive(canvas.id, !canvas.is_archived, e)
									}
									className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg"
								>
									<Archive size={18} />
								</button>
								<button
									type="button"
									onClick={(e) => handleDelete(canvas.id, e)}
									className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
								>
									<Trash2 size={18} />
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
