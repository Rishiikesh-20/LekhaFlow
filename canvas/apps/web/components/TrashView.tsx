"use client";

import { RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.client";
import { Button } from "./ui/Button";

const HTTP_URL =
	process.env.NEXT_PUBLIC_HTTP_URL || "https://lekhaflow.rishiikesh.me";

interface TrashItem {
	id: string;
	name: string;
	deleted_at: string | null;
	updated_at: string | null;
	thumbnail_url: string | null;
	owner_id: string;
	folder_id: string | null;
}

export function TrashView() {
	const [items, setItems] = useState<TrashItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [purgeConfirmId, setPurgeConfirmId] = useState<string | null>(null);

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

	const fetchTrash = useCallback(async () => {
		const headers = await getAuthHeaders();
		if (!headers) {
			setLoading(false);
			return;
		}

		try {
			const res = await fetch(`${HTTP_URL}/api/v1/trash`, { headers });
			if (res.ok) {
				const json = await res.json();
				const data = json?.data ?? json;
				setItems(data.items ?? []);
			}
		} catch (e) {
			console.error("Error fetching trash:", e);
		} finally {
			setLoading(false);
		}
	}, [getAuthHeaders]);

	useEffect(() => {
		fetchTrash();
	}, [fetchTrash]);

	const handleRestore = async (id: string) => {
		const headers = await getAuthHeaders();
		if (!headers) return;

		try {
			const res = await fetch(`${HTTP_URL}/api/v1/trash/restore/${id}`, {
				method: "PATCH",
				headers,
			});
			if (res.ok) {
				setItems((prev) => prev.filter((item) => item.id !== id));
			}
		} catch (e) {
			console.error("Error restoring item:", e);
		}
	};

	const handlePurge = async (id: string) => {
		const headers = await getAuthHeaders();
		if (!headers) return;

		try {
			const res = await fetch(`${HTTP_URL}/api/v1/trash/purge/${id}`, {
				method: "DELETE",
				headers,
			});
			if (res.ok) {
				setItems((prev) => prev.filter((item) => item.id !== id));
				setPurgeConfirmId(null);
			}
		} catch (e) {
			console.error("Error purging item:", e);
		}
	};

	const formatDeletedDate = (dateStr: string | null) => {
		if (!dateStr) return "Unknown";
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

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed border-gray-300 rounded-2xl bg-white">
				<div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
					<Trash2 className="w-8 h-8 text-gray-400" />
				</div>
				<h3 className="text-lg font-medium text-gray-900 font-heading mb-2">
					Your trash is empty
				</h3>
				<p className="text-gray-500 text-center max-w-sm">
					Items you delete will appear here. You can restore them or permanently
					remove them.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<p className="text-xs text-gray-500">
				{items.length} item{items.length !== 1 ? "s" : ""} in trash
			</p>

			<div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
				{items.map((item) => (
					<div
						key={item.id}
						className="flex items-center justify-between p-4 hover:bg-gray-50/50 group transition-colors"
					>
						<div className="flex items-center gap-4 min-w-0">
							<div className="h-10 w-14 bg-gray-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200">
								{item.thumbnail_url ? (
									/* biome-ignore lint/performance/noImgElement: Dynamic canvas thumbnails from external URLs */
									<img
										src={item.thumbnail_url}
										alt={item.name || "Canvas preview"}
										className="w-full h-full object-cover opacity-50"
										loading="lazy"
									/>
								) : (
									<Trash2 size={18} className="text-gray-400" />
								)}
							</div>
							<div className="min-w-0">
								<h3 className="font-medium text-gray-900 truncate">
									{item.name || "Untitled"}
								</h3>
								<p className="text-xs text-gray-500">
									Deleted {formatDeletedDate(item.deleted_at)}
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								type="button"
								onClick={() => handleRestore(item.id)}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-violet-600 hover:bg-violet-50 transition-colors"
								title="Restore"
							>
								<RotateCcw size={14} />
								Restore
							</button>
							<button
								type="button"
								onClick={() => setPurgeConfirmId(item.id)}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
								title="Delete forever"
							>
								<Trash2 size={14} />
								Delete Forever
							</button>
						</div>
					</div>
				))}
			</div>

			{/* Purge Confirmation Modal */}
			{purgeConfirmId && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					{/* Backdrop */}
					<div
						className="absolute inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => setPurgeConfirmId(null)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setPurgeConfirmId(null);
						}}
						role="button"
						tabIndex={0}
						aria-label="Close dialog"
					/>

					{/* Modal */}
					<div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95">
						<button
							type="button"
							onClick={() => setPurgeConfirmId(null)}
							className="absolute right-4 top-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
						>
							<X size={18} />
						</button>

						<div className="flex flex-col items-center text-center">
							<div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
								<Trash2 className="w-7 h-7 text-red-600" />
							</div>

							<h3 className="text-lg font-semibold text-gray-900 mb-2">
								Delete forever?
							</h3>
							<p className="text-sm text-gray-500 mb-6 max-w-xs">
								This action is{" "}
								<strong className="text-gray-700">
									permanent and irreversible
								</strong>
								. The item will be completely removed from the database and
								cannot be recovered.
							</p>

							<div className="flex gap-3 w-full">
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => setPurgeConfirmId(null)}
								>
									Cancel
								</Button>
								<button
									type="button"
									onClick={() => handlePurge(purgeConfirmId)}
									className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
								>
									Delete Forever
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
