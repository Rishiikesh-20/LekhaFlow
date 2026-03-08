"use client";

import {
	ArrowUpDown,
	ChevronRight,
	Clock,
	File,
	Folder,
	FolderOpen,
	FolderPlus,
	Grid,
	Home,
	List,
	Plus,
	Search,
	Share2,
	Trash2,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.client";
import { Button } from "./ui/Button";

const HTTP_URL =
	process.env.NEXT_PUBLIC_HTTP_URL || "https://lekhaflow.rishiikesh.me";

interface FolderItem {
	id: string;
	name: string;
	parent_id: string | null;
	created_at: string | null;
	updated_at: string | null;
	owner_id: string;
}

interface CanvasItem {
	id: string;
	name: string;
	updated_at: string | null;
	thumbnail_url: string | null;
	owner_id: string;
	folder_id: string | null;
}

interface BreadcrumbItem {
	id: string;
	name: string;
}

export function FolderView() {
	const [folders, setFolders] = useState<FolderItem[]>([]);
	const [canvases, setCanvases] = useState<CanvasItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
	const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [showCreateFolder, setShowCreateFolder] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const [creatingFolder, setCreatingFolder] = useState(false);
	const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<"createdAt" | "title">("createdAt");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
	const [searchResults, setSearchResults] = useState<CanvasItem[]>([]);
	const [isSearchMode, setIsSearchMode] = useState(false);
	const [searchLoading, setSearchLoading] = useState(false);
	const [searchTotal, setSearchTotal] = useState(0);
	const [recentCanvases, setRecentCanvases] = useState<CanvasItem[]>([]);
	const justDroppedRef = useRef(false);
	const router = useRouter();

	const getAuthHeaders = useCallback(async () => {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return null;
		return {
			Authorization: `Bearer ${session.access_token}`,
			"Content-Type": "application/json",
		};
	}, []);

	const fetchContents = useCallback(async () => {
		const headers = await getAuthHeaders();
		if (!headers) {
			setLoading(false);
			return;
		}

		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (session) setCurrentUserId(session.user.id);

		try {
			const params = new URLSearchParams();
			if (currentFolderId) params.set("folderId", currentFolderId);
			if (sortBy) params.set("sortBy", sortBy);
			if (sortOrder) params.set("order", sortOrder);

			const url = `${HTTP_URL}/api/v1/folder/contents?${params.toString()}`;

			const res = await fetch(url, { headers });
			if (res.ok) {
				const json = await res.json();
				const data = json?.data ?? json;
				setFolders(data.folders ?? []);
				setCanvases(data.canvases ?? []);
			}
		} catch (e) {
			console.error("Error fetching folder contents:", e);
		} finally {
			setLoading(false);
		}
	}, [currentFolderId, sortBy, sortOrder, getAuthHeaders]);

	const fetchBreadcrumb = useCallback(async () => {
		if (!currentFolderId) {
			setBreadcrumb([]);
			return;
		}

		const headers = await getAuthHeaders();
		if (!headers) return;

		try {
			const res = await fetch(
				`${HTTP_URL}/api/v1/folder/${currentFolderId}/breadcrumb`,
				{ headers },
			);
			if (res.ok) {
				const json = await res.json();
				const data = json?.data ?? json;
				setBreadcrumb(data.breadcrumb ?? []);
			}
		} catch (e) {
			console.error("Error fetching breadcrumb:", e);
		}
	}, [currentFolderId, getAuthHeaders]);

	useEffect(() => {
		if (!isSearchMode) {
			setLoading(true);
			fetchContents();
			fetchBreadcrumb();
		}
	}, [fetchContents, fetchBreadcrumb, isSearchMode]);

	// Fetch recently accessed canvases (cached in local state)
	useEffect(() => {
		const fetchRecent = async () => {
			const headers = await getAuthHeaders();
			if (!headers) return;

			try {
				const res = await fetch(`${HTTP_URL}/api/v1/canvas/recent`, {
					headers,
				});
				if (res.ok) {
					const json = await res.json();
					const data = json?.data ?? json;
					setRecentCanvases(data.canvases ?? []);
				}
			} catch (e) {
				console.error("Error fetching recent canvases:", e);
			}
		};

		fetchRecent();
	}, [getAuthHeaders]);

	// Debounced search effect (300ms)
	useEffect(() => {
		if (!searchQuery.trim()) {
			setIsSearchMode(false);
			setSearchResults([]);
			setSearchTotal(0);
			return;
		}

		setIsSearchMode(true);
		setSearchLoading(true);

		const timer = setTimeout(async () => {
			const headers = await getAuthHeaders();
			if (!headers) {
				setSearchLoading(false);
				return;
			}

			try {
				const params = new URLSearchParams({
					q: searchQuery.trim(),
					sortBy,
					order: sortOrder,
				});
				const res = await fetch(
					`${HTTP_URL}/api/v1/canvas/search?${params.toString()}`,
					{ headers },
				);
				if (res.ok) {
					const json = await res.json();
					const data = json?.data ?? json;
					setSearchResults(data.canvases ?? []);
					setSearchTotal(data.total ?? 0);
				}
			} catch (e) {
				console.error("Error searching canvases:", e);
			} finally {
				setSearchLoading(false);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [searchQuery, sortBy, sortOrder, getAuthHeaders]);

	const handleSortChange = (value: string) => {
		switch (value) {
			case "newest":
				setSortBy("createdAt");
				setSortOrder("desc");
				break;
			case "oldest":
				setSortBy("createdAt");
				setSortOrder("asc");
				break;
			case "az":
				setSortBy("title");
				setSortOrder("asc");
				break;
		}
	};

	const currentSortValue =
		sortBy === "title" ? "az" : sortOrder === "asc" ? "oldest" : "newest";

	const navigateToFolder = (folderId: string | null) => {
		setCurrentFolderId(folderId);
		setSearchQuery("");
		setIsSearchMode(false);
	};

	const handleCreateFolder = async () => {
		if (!newFolderName.trim()) return;
		setCreatingFolder(true);

		const headers = await getAuthHeaders();
		if (!headers) return;

		try {
			const res = await fetch(`${HTTP_URL}/api/v1/folder`, {
				method: "POST",
				headers,
				body: JSON.stringify({
					name: newFolderName.trim(),
					parentId: currentFolderId,
				}),
			});
			if (res.ok) {
				setNewFolderName("");
				setShowCreateFolder(false);
				fetchContents();
			}
		} catch (e) {
			console.error("Error creating folder:", e);
		} finally {
			setCreatingFolder(false);
		}
	};

	const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!confirm("Delete this folder and all its contents?")) return;

		const headers = await getAuthHeaders();
		if (!headers) return;

		try {
			await fetch(`${HTTP_URL}/api/v1/folder/${folderId}`, {
				method: "DELETE",
				headers,
			});
			setFolders((prev) => prev.filter((f) => f.id !== folderId));
		} catch (e) {
			console.error("Error deleting folder:", e);
		}
	};

	const handleDeleteCanvas = async (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!confirm("Delete this canvas?")) return;

		const headers = await getAuthHeaders();
		if (!headers) return;

		try {
			await fetch(`${HTTP_URL}/api/v1/canvas/${id}`, {
				method: "DELETE",
				headers,
			});
			setCanvases((prev) => prev.filter((c) => c.id !== id));
		} catch (e) {
			console.error("Error deleting canvas:", e);
		}
	};

	const handleCreateCanvas = async () => {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) {
			router.push("/login");
			return;
		}

		try {
			const res = await fetch(`${HTTP_URL}/api/v1/canvas/create-canvas`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({
					name: "Untitled Canvas",
					folderId: currentFolderId,
				}),
			});
			if (res.ok) {
				const data = await res.json();
				router.push(`/canvas/${data.data.roomId}`);
			}
		} catch (e) {
			console.error(e);
		}
	};

	// Drag and drop handlers
	const handleDragStart = (
		e: React.DragEvent,
		itemId: string,
		itemType: "canvas" | "folder",
	) => {
		e.dataTransfer.setData("text/plain", JSON.stringify({ itemId, itemType }));
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e: React.DragEvent, folderId: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOverFolderId(folderId);
	};

	const handleDragLeave = () => {
		setDragOverFolderId(null);
	};

	const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOverFolderId(null);

		// Prevent the click event that fires after drop from navigating
		justDroppedRef.current = true;
		setTimeout(() => {
			justDroppedRef.current = false;
		}, 300);

		// Read drag data SYNCHRONOUSLY before any await — browsers clear
		// dataTransfer after the event handler yields.
		const rawData = e.dataTransfer.getData("text/plain");
		if (!rawData) return;

		let itemId: string;
		let itemType: "canvas" | "folder";
		try {
			const parsed = JSON.parse(rawData);
			itemId = parsed.itemId;
			itemType = parsed.itemType;
		} catch {
			console.error("Invalid drag data:", rawData);
			return;
		}

		const headers = await getAuthHeaders();
		if (!headers) return;

		try {
			if (itemType === "canvas") {
				await fetch(`${HTTP_URL}/api/v1/folder/move-canvas/${itemId}`, {
					method: "PUT",
					headers,
					body: JSON.stringify({ folderId: targetFolderId }),
				});
			} else if (itemType === "folder") {
				if (itemId === targetFolderId) return;
				const res = await fetch(`${HTTP_URL}/api/v1/folder/${itemId}/move`, {
					method: "PUT",
					headers,
					body: JSON.stringify({ parentId: targetFolderId }),
				});
				if (!res.ok) {
					const errorData = await res.json();
					alert(errorData.message || "Failed to move folder");
					return;
				}
			}

			fetchContents();
		} catch (e) {
			console.error("Error processing drop:", e);
		}
	};

	const formatDate = (dateStr: string | null) => {
		if (!dateStr) return "";
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
				<div className="h-8 w-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
			</div>
		);
	}

	const isEmpty = folders.length === 0 && canvases.length === 0;

	return (
		<div className="space-y-4">
			{/* Jump Back In — Recent Canvases */}
			{!isSearchMode &&
				currentFolderId === null &&
				recentCanvases.length > 0 && (
					<div className="mb-2">
						<div className="flex items-center gap-2 mb-3">
							<Clock size={16} className="text-violet-500" />
							<h3 className="text-sm font-semibold text-gray-700">
								Jump Back In
							</h3>
						</div>
						<div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
							{recentCanvases.map((canvas) => (
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
									className="group flex-shrink-0 w-48 bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100 transition-all cursor-pointer"
								>
									{/* Compact Thumbnail */}
									<div className="aspect-[16/9] bg-gray-50 relative overflow-hidden">
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
												<div
													className="absolute inset-0 opacity-[0.4]"
													style={{
														backgroundImage:
															"radial-gradient(circle, #d1d5db 1px, transparent 1px)",
														backgroundSize: "12px 12px",
													}}
												/>
												<div className="w-full h-full flex items-center justify-center">
													<File className="w-6 h-6 text-gray-300" />
												</div>
											</>
										)}
										<div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/5 transition-colors" />
									</div>
									{/* Info */}
									<div className="p-2.5">
										<h4 className="font-medium text-xs text-gray-900 truncate">
											{canvas.name || "Untitled"}
										</h4>
										<p className="text-[11px] text-gray-400 mt-0.5">
											{formatDate(canvas.updated_at)}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

			{/* Breadcrumb */}
			<nav className="flex items-center gap-1 text-sm flex-wrap">
				<button
					type="button"
					onClick={() => navigateToFolder(null)}
					className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
						currentFolderId === null
							? "text-violet-600 font-semibold bg-violet-50"
							: "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
					}`}
				>
					<Home size={14} />
					<span>Home</span>
				</button>
				{breadcrumb.map((crumb, index) => (
					<span key={crumb.id} className="flex items-center gap-1">
						<ChevronRight size={14} className="text-gray-300" />
						<button
							type="button"
							onClick={() => navigateToFolder(crumb.id)}
							className={`px-2 py-1 rounded-md transition-colors ${
								index === breadcrumb.length - 1
									? "text-violet-600 font-semibold bg-violet-50"
									: "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
							}`}
						>
							{crumb.name}
						</button>
					</span>
				))}
			</nav>

			{/* Search Bar & Sort Dropdown */}
			<div className="flex items-center gap-3">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<input
						id="canvas-search-input"
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search canvases by title or tag..."
						className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 transition-all placeholder:text-gray-400"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => {
								setSearchQuery("");
								setIsSearchMode(false);
							}}
							className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
						>
							<X size={14} />
						</button>
					)}
				</div>
				<div className="relative">
					<ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
					<select
						id="canvas-sort-select"
						value={currentSortValue}
						onChange={(e) => handleSortChange(e.target.value)}
						className="appearance-none pl-8 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 cursor-pointer transition-all"
					>
						<option value="newest">Newest First</option>
						<option value="oldest">Oldest First</option>
						<option value="az">Alphabetical (A-Z)</option>
					</select>
				</div>
			</div>

			{/* Toolbar */}
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Button
						variant="secondary"
						size="sm"
						onClick={() => setShowCreateFolder(true)}
					>
						<FolderPlus className="w-4 h-4 mr-1.5" />
						New Folder
					</Button>
					<Button size="sm" onClick={handleCreateCanvas}>
						<Plus className="w-4 h-4 mr-1.5" />
						New Canvas
					</Button>
				</div>
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

			{/* Create Folder Inline */}
			{showCreateFolder && (
				<div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl animate-in fade-in">
					<FolderPlus className="w-5 h-5 text-violet-500 flex-shrink-0" />
					<input
						type="text"
						value={newFolderName}
						onChange={(e) => setNewFolderName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleCreateFolder();
							if (e.key === "Escape") {
								setShowCreateFolder(false);
								setNewFolderName("");
							}
						}}
						placeholder="Folder name..."
						className="flex-1 bg-white border border-violet-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-400"
					/>
					<Button
						size="sm"
						onClick={handleCreateFolder}
						disabled={!newFolderName.trim() || creatingFolder}
					>
						{creatingFolder ? "Creating..." : "Create"}
					</Button>
					<button
						type="button"
						onClick={() => {
							setShowCreateFolder(false);
							setNewFolderName("");
						}}
						className="p-1 text-gray-400 hover:text-gray-600"
					>
						<X size={16} />
					</button>
				</div>
			)}

			{/* Search Loading */}
			{isSearchMode && searchLoading && (
				<div className="flex items-center justify-center p-16">
					<div className="h-8 w-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
				</div>
			)}

			{/* Search Results Empty State */}
			{isSearchMode && !searchLoading && searchResults.length === 0 && (
				<div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed border-gray-300 rounded-2xl bg-white">
					<div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
						<Search className="w-8 h-8 text-gray-400" />
					</div>
					<h3 className="text-lg font-medium text-gray-900 font-heading mb-2">
						No results found
					</h3>
					<p className="text-gray-500 text-center max-w-sm">
						No canvases match &ldquo;{searchQuery}&rdquo;. Try a different
						keyword or check your spelling.
					</p>
				</div>
			)}

			{/* Search Results */}
			{isSearchMode && !searchLoading && searchResults.length > 0 && (
				<div>
					<p className="text-xs text-gray-500 mb-3">
						{searchTotal} result{searchTotal !== 1 ? "s" : ""} for &ldquo;
						{searchQuery}&rdquo;
					</p>
					{viewMode === "grid" ? (
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
							{searchResults.map((canvas) => (
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
										<div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/5 transition-colors" />
									</div>
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
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
							{searchResults.map((canvas) => (
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
												/* biome-ignore lint/performance/noImgElement: Dynamic canvas thumbnails from external URLs */
												<img
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
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Empty State (non-search) */}
			{!isSearchMode && isEmpty && (
				<div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed border-gray-300 rounded-2xl bg-white">
					<div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-6">
						{currentFolderId ? (
							<FolderOpen className="w-8 h-8 text-violet-500" />
						) : (
							<File className="w-8 h-8 text-violet-500" />
						)}
					</div>
					<h3 className="text-lg font-medium text-gray-900 font-heading mb-2">
						{currentFolderId ? "This folder is empty" : "No canvases yet"}
					</h3>
					<p className="text-gray-500 text-center max-w-sm mb-6">
						{currentFolderId
							? "Create a canvas or folder, or drag items here."
							: "Create your first canvas to start brainstorming with your team."}
					</p>
					<div className="flex gap-3">
						<Button
							variant="secondary"
							onClick={() => setShowCreateFolder(true)}
						>
							<FolderPlus className="w-4 h-4 mr-2" />
							New Folder
						</Button>
						<Button onClick={handleCreateCanvas}>
							<Plus className="w-4 h-4 mr-2" />
							Create Canvas
						</Button>
					</div>
				</div>
			)}

			{/* Grid View */}
			{!isSearchMode && !isEmpty && viewMode === "grid" && (
				<div className="space-y-6">
					{/* Folders */}
					{folders.length > 0 && (
						<div>
							<h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
								Folders
							</h4>
							<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
								{folders.map((folder) => (
									<div
										key={folder.id}
										role="button"
										tabIndex={0}
										draggable
										onDragStart={(e) => handleDragStart(e, folder.id, "folder")}
										onDragOver={(e) => handleDragOver(e, folder.id)}
										onDragLeave={handleDragLeave}
										onDrop={(e) => handleDrop(e, folder.id)}
										onClick={() => {
											if (!justDroppedRef.current) navigateToFolder(folder.id);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												navigateToFolder(folder.id);
											}
										}}
										className={`group relative flex items-center gap-3 p-4 bg-white border rounded-xl cursor-pointer transition-all ${
											dragOverFolderId === folder.id
												? "border-violet-400 bg-violet-50 shadow-lg shadow-violet-100 scale-[1.02]"
												: "border-gray-200 hover:border-violet-300 hover:shadow-md hover:shadow-violet-50"
										}`}
									>
										<div
											className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
												dragOverFolderId === folder.id
													? "bg-violet-200"
													: "bg-amber-50 group-hover:bg-amber-100"
											}`}
										>
											{dragOverFolderId === folder.id ? (
												<FolderOpen className="w-5 h-5 text-violet-600" />
											) : (
												<Folder className="w-5 h-5 text-amber-500" />
											)}
										</div>
										<div className="min-w-0 flex-1">
											<h3 className="font-medium text-sm text-gray-900 truncate">
												{folder.name}
											</h3>
											<p className="text-xs text-gray-400 mt-0.5">
												{formatDate(folder.updated_at)}
											</p>
										</div>
										{(!currentUserId || folder.owner_id === currentUserId) && (
											<button
												type="button"
												onClick={(e) => handleDeleteFolder(folder.id, e)}
												className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
											>
												<Trash2 size={14} />
											</button>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* Canvases */}
					{canvases.length > 0 && (
						<div>
							<h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
								Canvases
							</h4>
							<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
								{canvases.map((canvas) => (
									<div
										key={canvas.id}
										role="button"
										tabIndex={0}
										draggable
										onDragStart={(e) => handleDragStart(e, canvas.id, "canvas")}
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
											<div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/5 transition-colors" />
										</div>

										{/* Info */}
										<div className="p-3 flex items-center justify-between border-t border-gray-100">
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-1.5">
													<h3 className="font-medium text-sm text-gray-900 truncate">
														{canvas.name || "Untitled"}
													</h3>
													{currentUserId &&
														canvas.owner_id !== currentUserId && (
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
											{(!currentUserId ||
												canvas.owner_id === currentUserId) && (
												<button
													type="button"
													onClick={(e) => handleDeleteCanvas(canvas.id, e)}
													className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
												>
													<Trash2 size={14} />
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* List View */}
			{!isSearchMode && !isEmpty && viewMode === "list" && (
				<div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
					{/* Folders */}
					{folders.map((folder) => (
						<div
							key={folder.id}
							role="button"
							tabIndex={0}
							draggable
							onDragStart={(e) => handleDragStart(e, folder.id, "folder")}
							onDragOver={(e) => handleDragOver(e, folder.id)}
							onDragLeave={handleDragLeave}
							onDrop={(e) => handleDrop(e, folder.id)}
							onClick={() => {
								if (!justDroppedRef.current) navigateToFolder(folder.id);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									navigateToFolder(folder.id);
								}
							}}
							className={`flex items-center justify-between p-4 cursor-pointer group transition-all ${
								dragOverFolderId === folder.id
									? "bg-violet-50 border-l-2 border-violet-400"
									: "hover:bg-violet-50/50"
							}`}
						>
							<div className="flex items-center gap-4 min-w-0">
								<div
									className={`h-10 w-10 rounded-lg flex-shrink-0 flex items-center justify-center transition-colors ${
										dragOverFolderId === folder.id
											? "bg-violet-200"
											: "bg-amber-50"
									}`}
								>
									{dragOverFolderId === folder.id ? (
										<FolderOpen size={20} className="text-violet-600" />
									) : (
										<Folder size={20} className="text-amber-500" />
									)}
								</div>
								<div className="min-w-0">
									<h3 className="font-medium text-gray-900 truncate">
										{folder.name}
									</h3>
									<p className="text-xs text-gray-500">
										{formatDate(folder.updated_at)}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
								<Button variant="secondary" size="sm">
									Open
								</Button>
								{(!currentUserId || folder.owner_id === currentUserId) && (
									<button
										type="button"
										onClick={(e) => handleDeleteFolder(folder.id, e)}
										className="p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
									>
										<Trash2 size={14} />
									</button>
								)}
							</div>
						</div>
					))}

					{/* Canvases */}
					{canvases.map((canvas) => (
						<div
							key={canvas.id}
							role="button"
							tabIndex={0}
							draggable
							onDragStart={(e) => handleDragStart(e, canvas.id, "canvas")}
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
										/* biome-ignore lint/performance/noImgElement: Dynamic canvas thumbnails from external URLs */
										<img
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
										onClick={(e) => handleDeleteCanvas(canvas.id, e)}
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
