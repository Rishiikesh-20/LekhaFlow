"use client";

import { Clock, Eye, Plus, RotateCcw, Tag, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase.client";
import { useCanvasStore } from "../../store/canvas-store";

// ============================================================================
// TYPES
// ============================================================================

interface CanvasVersion {
	id: string;
	canvas_id: string;
	name: string;
	snapshot: string; // JSON stringified element map
	creator_id: string | null;
	created_at: string | null;
}

interface SnapshotElement {
	id: string;
	type: string;
	x?: number;
	y?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function relativeTime(ts: string | null): string {
	if (!ts) return "Unknown";
	const diff = Date.now() - new Date(ts).getTime();
	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return new Date(ts).toLocaleDateString();
}

function parseSnapshot(snapshot: string): SnapshotElement[] {
	try {
		const parsed = JSON.parse(snapshot);
		// snapshot is a Record<string, CanvasElement>, values may have isDeleted
		return Object.values(parsed).filter(
			(el) => el && !(el as { isDeleted?: boolean }).isDeleted,
		) as SnapshotElement[];
	} catch {
		return [];
	}
}

function elementTypeLabel(type: string): string {
	const map: Record<string, string> = {
		rectangle: "Rectangle",
		ellipse: "Ellipse",
		diamond: "Diamond",
		line: "Line",
		arrow: "Arrow",
		freedraw: "Drawing",
		text: "Text",
	};
	return map[type] || type;
}

// ============================================================================
// SAVE VERSION MODAL
// ============================================================================

interface SaveModalProps {
	onSave: (name: string) => Promise<void>;
	onClose: () => void;
	saving: boolean;
}

function SaveVersionModal({ onSave, onClose, saving }: SaveModalProps) {
	const [name, setName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		await onSave(trimmed);
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center"
			style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
		>
			<div
				className="w-[calc(100vw-32px)] sm:w-[380px] rounded-2xl p-6"
				style={{
					background: "#fff",
					boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
				}}
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-5">
					<div className="flex items-center gap-2.5">
						<div
							className="w-8 h-8 rounded-[10px] flex items-center justify-center"
							style={{
								background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
								boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
							}}
						>
							<Tag size={14} className="text-white" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-gray-800 m-0">
								Save Version
							</h3>
							<p className="text-[11px] text-gray-400 m-0">
								Freeze the current canvas state
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer hover:bg-gray-100 transition-colors"
					>
						<X size={16} className="text-gray-500" />
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="version-name"
							className="text-[12px] font-medium text-gray-600"
						>
							Version name
						</label>
						<input
							id="version-name"
							ref={inputRef}
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder='e.g. "Draft 1", "Client Approval"'
							maxLength={100}
							className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-all"
							style={{
								border: "1.5px solid rgba(124,58,237,0.25)",
								background: "rgba(124,58,237,0.03)",
							}}
							onFocus={(e) => {
								e.target.style.borderColor = "#7c3aed";
								e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)";
							}}
							onBlur={(e) => {
								e.target.style.borderColor = "rgba(124,58,237,0.25)";
								e.target.style.boxShadow = "none";
							}}
						/>
					</div>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							disabled={saving}
							className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all border"
							style={{
								background: "transparent",
								color: "#6b7280",
								borderColor: "#e5e7eb",
							}}
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={saving || !name.trim()}
							className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all border-none"
							style={{
								background:
									saving || !name.trim()
										? "#c4b5fd"
										: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
								boxShadow:
									saving || !name.trim()
										? "none"
										: "0 4px 12px rgba(124,58,237,0.3)",
							}}
						>
							{saving ? "Saving…" : "Save Version"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ============================================================================
// VERSION PREVIEW MODAL
// ============================================================================

interface PreviewModalProps {
	version: CanvasVersion;
	onClose: () => void;
}

function VersionPreviewModal({ version, onClose }: PreviewModalProps) {
	const elements = parseSnapshot(version.snapshot);

	const typeCounts = elements.reduce<Record<string, number>>((acc, el) => {
		const t = elementTypeLabel(el.type);
		acc[t] = (acc[t] ?? 0) + 1;
		return acc;
	}, {});

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center"
			style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
		>
			<div
				className="w-[calc(100vw-32px)] sm:w-[480px] max-h-[80vh] rounded-2xl flex flex-col overflow-hidden"
				style={{
					background: "#fff",
					boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
				}}
			>
				{/* Header */}
				<div
					className="flex items-center justify-between px-6 py-4 flex-shrink-0"
					style={{ borderBottom: "1px solid #f3f4f6" }}
				>
					<div>
						<h3 className="text-sm font-bold text-gray-800 m-0">
							{version.name}
						</h3>
						<p className="text-[11px] text-gray-400 m-0 mt-0.5">
							Saved {relativeTime(version.created_at)} · {elements.length}{" "}
							element
							{elements.length !== 1 ? "s" : ""}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer hover:bg-gray-100 transition-colors"
					>
						<X size={16} className="text-gray-500" />
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto px-6 py-4">
					{elements.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<p className="text-sm text-gray-500">
								This version has no canvas elements.
							</p>
						</div>
					) : (
						<>
							{/* Type summary chips */}
							<div className="flex flex-wrap gap-2 mb-4">
								{Object.entries(typeCounts).map(([type, count]) => (
									<span
										key={type}
										className="px-2.5 py-1 rounded-full text-[11px] font-medium"
										style={{
											background: "rgba(124,58,237,0.08)",
											color: "#7c3aed",
										}}
									>
										{count}× {type}
									</span>
								))}
							</div>

							{/* Element list */}
							<div className="flex flex-col gap-1">
								{elements.map((el, i) => (
									<div
										key={el.id || i}
										className="flex items-center gap-3 px-3 py-2 rounded-lg"
										style={{ background: "#f9fafb" }}
									>
										<div
											className="w-2 h-2 rounded-full flex-shrink-0"
											style={{ background: "#7c3aed" }}
										/>
										<span className="text-[12px] text-gray-700 font-medium">
											{elementTypeLabel(el.type)}
										</span>
										{el.x !== undefined && el.y !== undefined && (
											<span className="text-[11px] text-gray-400 ml-auto">
												({Math.round(el.x)}, {Math.round(el.y)})
											</span>
										)}
									</div>
								))}
							</div>
						</>
					)}
				</div>

				<div
					className="px-6 py-3 flex-shrink-0"
					style={{ borderTop: "1px solid #f3f4f6" }}
				>
					<p className="text-[11px] text-gray-400 text-center m-0">
						This is a read-only preview of the frozen snapshot.
					</p>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// VERSIONS PANEL
// ============================================================================

interface VersionsPanelProps {
	token: string | null | undefined;
	onRestore?: (snapshot: Record<string, unknown>) => void;
}

export function VersionsPanel({ token, onRestore }: VersionsPanelProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [versions, setVersions] = useState<CanvasVersion[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [showSaveModal, setShowSaveModal] = useState(false);
	const [previewVersion, setPreviewVersion] = useState<CanvasVersion | null>(
		null,
	);
	const [restoreTarget, setRestoreTarget] = useState<CanvasVersion | null>(
		null,
	);
	const [restoring, setRestoring] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const roomId = useCanvasStore((s) => s.roomId);
	const elements = useCanvasStore((s) => s.elements);

	const HTTP_URL =
		process.env.NEXT_PUBLIC_HTTP_URL ?? "https://lekhaflow.rishiikesh.me";

	// ── Fetch auth token from Supabase session if not passed as prop ──
	const getToken = useCallback(async (): Promise<string | null> => {
		if (token) return token;
		const { data } = await supabase.auth.getSession();
		return data.session?.access_token ?? null;
	}, [token]);

	// ── Load versions list ──
	const loadVersions = useCallback(async () => {
		if (!roomId) return;
		setLoading(true);
		setError(null);
		try {
			const t = await getToken();
			const res = await fetch(`${HTTP_URL}/api/v1/canvas/${roomId}/versions`, {
				headers: { Authorization: `Bearer ${t}` },
			});
			const json = await res.json();
			if (res.ok) {
				setVersions(json.data?.versions ?? []);
			} else {
				setError(json.message ?? "Failed to load versions");
			}
		} catch {
			setError("Network error");
		} finally {
			setLoading(false);
		}
	}, [roomId, HTTP_URL, getToken]);

	// Load versions when panel opens
	useEffect(() => {
		if (isOpen) {
			void loadVersions();
		}
	}, [isOpen, loadVersions]);

	// ── Save current canvas state as a new version ──
	const handleSave = async (name: string) => {
		if (!roomId) return;
		setSaving(true);
		setError(null);
		try {
			// Serialize the current element Map to a JSON object
			const snapshot: Record<string, unknown> = {};
			elements.forEach((el, id) => {
				snapshot[id] = el;
			});

			const t = await getToken();
			const res = await fetch(`${HTTP_URL}/api/v1/canvas/${roomId}/versions`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${t}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name, snapshot: JSON.stringify(snapshot) }),
			});
			const json = await res.json();
			if (res.ok) {
				setShowSaveModal(false);
				await loadVersions();
			} else {
				setError(json.message ?? "Failed to save version");
			}
		} catch {
			setError("Network error while saving");
		} finally {
			setSaving(false);
		}
	};

	// ── Delete a version ──
	const handleDelete = async (versionId: string) => {
		if (!roomId) return;
		setError(null);
		try {
			const t = await getToken();
			const res = await fetch(
				`${HTTP_URL}/api/v1/canvas/${roomId}/versions/${versionId}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${t}` },
				},
			);
			if (res.ok) {
				setVersions((prev) => prev.filter((v) => v.id !== versionId));
			} else {
				const json = await res.json();
				setError(json.message ?? "Failed to delete version");
			}
		} catch {
			setError("Network error while deleting");
		}
	};

	// ── Restore canvas to a saved version ──
	const handleRestore = async (version: CanvasVersion) => {
		if (!onRestore) return;
		setRestoring(true);
		setError(null);
		try {
			const snapshot = JSON.parse(version.snapshot) as Record<string, unknown>;
			onRestore(snapshot);
			setRestoreTarget(null);
			setIsOpen(false);
		} catch {
			setError("Failed to parse version snapshot");
		} finally {
			setRestoring(false);
		}
	};

	return (
		<>
			{/* Toggle Button — bottom-left, above the Activity button */}
			<button
				type="button"
				onClick={() => setIsOpen((o) => !o)}
				title="Named Versions"
				className="fixed left-4 bottom-28 z-30 w-10 h-10 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all hover:scale-105"
				style={{
					background: isOpen ? "#7c3aed" : "rgba(255,255,255,0.9)",
					color: isOpen ? "#fff" : "#6b7280",
					boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
					backdropFilter: "blur(12px)",
				}}
			>
				<Clock size={18} />
				{/* Badge */}
				{versions.length > 0 && !isOpen && (
					<span
						className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
						style={{ background: "#7c3aed" }}
					>
						{versions.length > 9 ? "9+" : versions.length}
					</span>
				)}
			</button>

			{/* Sidebar Panel — slides from the left, below activity sidebar */}
			<div
				className="fixed top-0 left-0 h-full z-40 flex flex-col transition-transform duration-300 ease-out"
				style={{
					width: "min(300px, 100vw)",
					transform: isOpen ? "translateX(0)" : "translateX(-100%)",
					background: "rgba(255,255,255,0.97)",
					backdropFilter: "blur(20px)",
					borderRight: "1px solid rgba(0,0,0,0.06)",
					boxShadow: isOpen ? "8px 0 32px rgba(0,0,0,0.08)" : "none",
				}}
			>
				{/* Header */}
				<div
					className="flex items-center justify-between px-5 py-4 flex-shrink-0"
					style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
				>
					<div className="flex items-center gap-2.5">
						<div
							className="w-8 h-8 rounded-[10px] flex items-center justify-center"
							style={{
								background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
								boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
							}}
						>
							<Clock size={14} className="text-white" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-gray-800 m-0">Versions</h3>
							<p className="text-[11px] text-violet-500 m-0 font-medium">
								{versions.length} saved snapshot
								{versions.length !== 1 ? "s" : ""}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => setShowSaveModal(true)}
							title="Save current version"
							className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer flex items-center justify-center transition-colors hover:bg-violet-50"
							style={{ color: "#7c3aed" }}
						>
							<Plus size={16} />
						</button>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer flex items-center justify-center hover:bg-gray-100 transition-colors"
						>
							<X size={16} className="text-gray-500" />
						</button>
					</div>
				</div>

				{/* Error banner */}
				{error && (
					<div
						className="mx-3 mt-2 px-3 py-2 rounded-lg text-[12px] text-red-700 flex-shrink-0"
						style={{ background: "rgba(239,68,68,0.08)" }}
					>
						{error}
					</div>
				)}

				{/* Version List */}
				<div className="flex-1 overflow-y-auto px-3 py-2">
					{loading ? (
						<div className="flex flex-col gap-2 pt-2">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="h-14 rounded-xl animate-pulse"
									style={{ background: "rgba(124,58,237,0.06)" }}
								/>
							))}
						</div>
					) : versions.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-center px-6">
							<div
								className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
								style={{ background: "rgba(124,58,237,0.08)" }}
							>
								<Clock size={24} className="text-violet-400" />
							</div>
							<p className="text-sm font-medium text-gray-500 mb-1">
								No versions yet
							</p>
							<p className="text-xs text-gray-400 mb-4">
								Click + to save the current canvas as a named version.
							</p>
							<button
								type="button"
								onClick={() => setShowSaveModal(true)}
								className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90"
								style={{
									background:
										"linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
									boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
								}}
							>
								Save First Version
							</button>
						</div>
					) : (
						<div className="flex flex-col gap-1 pt-1">
							{versions.map((version) => (
								<div
									key={version.id}
									className="group flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-50"
								>
									{/* Version dot */}
									<div
										className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
										style={{
											background: "#7c3aed",
											boxShadow: "0 0 6px rgba(124,58,237,0.4)",
										}}
									/>

									{/* Info */}
									<div className="flex-1 min-w-0">
										<p className="text-[13px] font-semibold text-gray-800 m-0 truncate">
											{version.name}
										</p>
										<p className="text-[11px] text-gray-400 m-0 mt-0.5">
											{relativeTime(version.created_at)}
										</p>
									</div>

									{/* Actions — show on hover */}
									<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
										{onRestore && (
											<button
												type="button"
												onClick={() => setRestoreTarget(version)}
												title="Restore this version"
												className="p-1 rounded-lg bg-transparent border-none cursor-pointer hover:bg-amber-50 transition-colors"
												style={{ color: "#d97706" }}
											>
												<RotateCcw size={13} />
											</button>
										)}
										<button
											type="button"
											onClick={() => setPreviewVersion(version)}
											title="Preview"
											className="p-1 rounded-lg bg-transparent border-none cursor-pointer hover:bg-violet-50 transition-colors"
											style={{ color: "#7c3aed" }}
										>
											<Eye size={13} />
										</button>
										<button
											type="button"
											onClick={() => void handleDelete(version.id)}
											title="Delete"
											className="p-1 rounded-lg bg-transparent border-none cursor-pointer hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
										>
											<Trash2 size={13} />
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Save Modal */}
			{showSaveModal && (
				<SaveVersionModal
					onSave={handleSave}
					onClose={() => setShowSaveModal(false)}
					saving={saving}
				/>
			)}

			{/* Preview Modal */}
			{previewVersion && (
				<VersionPreviewModal
					version={previewVersion}
					onClose={() => setPreviewVersion(null)}
				/>
			)}

			{/* Restore Confirmation Modal */}
			{restoreTarget && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center"
					style={{
						background: "rgba(0,0,0,0.5)",
						backdropFilter: "blur(4px)",
					}}
				>
					<div
						className="w-[calc(100vw-32px)] sm:w-[400px] rounded-2xl p-6"
						style={{
							background: "#fff",
							boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
						}}
					>
						{/* Header */}
						<div className="flex items-center gap-3 mb-4">
							<div
								className="w-10 h-10 rounded-xl flex items-center justify-center"
								style={{
									background: "rgba(217,119,6,0.1)",
								}}
							>
								<RotateCcw size={18} style={{ color: "#d97706" }} />
							</div>
							<div>
								<h3 className="text-sm font-bold text-gray-800 m-0">
									Restore Version
								</h3>
								<p className="text-[11px] text-gray-400 m-0">
									This action cannot be undone
								</p>
							</div>
						</div>

						{/* Warning message */}
						<div
							className="p-3 rounded-xl mb-5 text-[13px] text-amber-800"
							style={{ background: "rgba(217,119,6,0.08)" }}
						>
							<p className="m-0 mb-1 font-semibold">
								Restore &ldquo;{restoreTarget.name}&rdquo;?
							</p>
							<p className="m-0 text-[12px] text-amber-700">
								All current canvas elements will be replaced with the elements
								from this saved version. All connected users will see the change
								immediately.
							</p>
						</div>

						{/* Actions */}
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setRestoreTarget(null)}
								disabled={restoring}
								className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all border"
								style={{
									background: "transparent",
									color: "#6b7280",
									borderColor: "#e5e7eb",
								}}
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => void handleRestore(restoreTarget)}
								disabled={restoring}
								className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all border-none"
								style={{
									background: restoring
										? "#fbbf24"
										: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
									boxShadow: restoring
										? "none"
										: "0 4px 12px rgba(217,119,6,0.3)",
								}}
							>
								{restoring ? "Restoring…" : "Restore"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
