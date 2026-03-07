/**
 * ============================================================================
 * LEKHAFLOW - HEADER COMPONENT
 * ============================================================================
 *
 * Modern header with hamburger menu, document title, and collaboration UI.
 */

"use client";

import {
	ArrowLeft,
	Check,
	Cloud,
	CloudOff,
	Copy,
	Download,
	FileText,
	FolderOpen,
	Image,
	Link2,
	Loader2,
	Mail,
	Menu,
	Plus,
	QrCode,
	Save,
	Settings,
	Share2,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.client";
import {
	useCanvasStore,
	useCollaboratorsArray,
} from "../../store/canvas-store";

// ============================================================================
// SIDEBAR MENU COMPONENT
// ============================================================================

interface SidebarMenuProps {
	isOpen: boolean;
	onClose: () => void;
	onClearCanvas?: () => void;
	onExport?: (format: "png" | "svg" | "json") => void;
	onImportJson?: () => void;
	onExportDocumentation?: () => void;
}

function SidebarMenu({
	isOpen,
	onClose,
	onClearCanvas,
	onExport,
	onImportJson,
	onExportDocumentation,
}: SidebarMenuProps) {
	return (
		<>
			{/* Backdrop */}
			{isOpen && (
				<button
					type="button"
					className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 border-none cursor-default transition-opacity duration-300"
					onClick={onClose}
					tabIndex={-1}
					aria-hidden="true"
				/>
			)}

			{/* Menu Card */}
			<div
				className={`fixed top-20 right-4 w-[300px] glass-card-elevated rounded-2xl z-50 max-h-[calc(100vh-100px)] flex flex-col transition-all duration-200 ease-out ${
					isOpen
						? "translate-y-0 scale-100 opacity-100 pointer-events-auto"
						: "-translate-y-2.5 scale-95 opacity-0 pointer-events-none"
				}`}
			>
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white rounded-t-2xl">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-[10px] flex items-center justify-center shadow-[0_4px_12px_rgba(139,92,246,0.3)]">
							<Menu size={18} className="text-white" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-gray-800 m-0">Menu</h3>
							<p className="text-[11px] text-violet-500 m-0 font-medium">
								Quick Actions
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer flex items-center justify-center hover:bg-gray-100 transition-colors"
					>
						<X size={18} className="text-gray-500" />
					</button>
				</div>

				{/* Menu Items */}
				<div className="flex-1 overflow-y-auto p-3">
					{/* File Section */}
					<div className="mb-4">
						<p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0">
							File
						</p>
						<div className="flex flex-col gap-1">
							<MenuItem icon={<Plus />} label="New Canvas" shortcut="Ctrl+N" />
							<MenuItem
								icon={<FolderOpen />}
								label="Open..."
								shortcut="Ctrl+O"
							/>
							<MenuItem icon={<Save />} label="Save" shortcut="Ctrl+S" />
						</div>
					</div>

					{/* Export Section */}
					<div className="mb-4">
						<p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0">
							Export
						</p>
						<div className="flex flex-col gap-1">
							<MenuItem
								icon={<Image />}
								label="Export as PNG"
								onClick={() => {
									onExport?.("png");
									onClose();
								}}
							/>
							<MenuItem
								icon={<FileText />}
								label="Export as SVG"
								onClick={() => {
									onExport?.("svg");
									onClose();
								}}
							/>
							<MenuItem
								icon={<Download />}
								label="Export as JSON"
								onClick={() => {
									onExport?.("json");
									onClose();
								}}
							/>
							<MenuItem
								icon={<FolderOpen />}
								label="Import JSON"
								shortcut="Ctrl+Shift+I"
								onClick={() => {
									onImportJson?.();
									onClose();
								}}
							/>
						</div>
					</div>

					{/* Documentation Section (Story 4) */}
					<div className="mb-4">
						<p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0">
							Documentation
						</p>
						<div className="flex flex-col gap-1">
							<MenuItem
								icon={<FileText />}
								label="Export Documentation"
								onClick={() => {
									onExportDocumentation?.();
									onClose();
								}}
							/>
						</div>
					</div>

					{/* Canvas Section */}
					<div>
						<p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0">
							Canvas
						</p>
						<div className="flex flex-col gap-1">
							<MenuItem
								icon={<Trash2 />}
								label="Clear Canvas"
								variant="danger"
								onClick={() => {
									if (onClearCanvas) {
										onClearCanvas();
									}
									onClose();
								}}
							/>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
					<div className="flex gap-2">
						<button
							type="button"
							className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-[10px] cursor-pointer transition-all hover:bg-gray-50 hover:border-violet-300 hover:text-violet-500"
						>
							<Settings size={16} />
							Settings
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

// ============================================================================
// MENU ITEM COMPONENT
// ============================================================================

interface MenuItemProps {
	icon: React.ReactNode;
	label: string;
	shortcut?: string;
	onClick?: () => void;
	variant?: "default" | "danger";
}

function MenuItem({
	icon,
	label,
	shortcut,
	onClick,
	variant = "default",
}: MenuItemProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold border-none cursor-pointer transition-all ${
				variant === "danger"
					? "bg-transparent text-red-500 hover:bg-red-50"
					: "bg-transparent text-gray-600 hover:bg-violet-50 hover:text-violet-600"
			}`}
		>
			<span
				className={`flex-shrink-0 ${variant === "danger" ? "text-red-500" : "text-violet-500"}`}
			>
				{React.cloneElement(
					icon as React.ReactElement,
					{ size: 18 } as React.Attributes,
				)}
			</span>
			<span className="flex-1 text-left">{label}</span>
			{shortcut && (
				<kbd className="px-2 py-0.5 text-[11px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded-md">
					{shortcut}
				</kbd>
			)}
		</button>
	);
}

// ============================================================================
// SHARE MODAL
// ============================================================================

interface ShareModalProps {
	isOpen: boolean;
	onClose: () => void;
	roomId: string | null;
}

function ShareModal({ isOpen, onClose, roomId }: ShareModalProps) {
	const [copied, setCopied] = useState(false);
	const shareUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/canvas/${roomId}`
			: "";

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Backdrop */}
			<button
				type="button"
				className="absolute inset-0 bg-black/50 backdrop-blur-sm border-none cursor-default"
				onClick={onClose}
				tabIndex={-1}
				aria-hidden="true"
			/>

			{/* Modal Card */}
			<div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-[540px] overflow-hidden animate-scale-in">
				{/* Gradient Header */}
				<div className="bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-600 p-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3.5">
							<div className="w-12 h-12 bg-white/20 rounded-[14px] flex items-center justify-center backdrop-blur-sm">
								<Share2 size={24} className="text-white" />
							</div>
							<div>
								<h2 className="text-xl font-bold text-white m-0">
									Share Canvas
								</h2>
								<p className="text-sm text-white/80 m-0">
									Collaborate in real-time
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="p-2.5 rounded-xl bg-transparent border-none cursor-pointer hover:bg-white/10 transition-colors"
						>
							<X size={20} className="text-white" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="p-6 flex flex-col gap-5">
					{/* Share Link */}
					<div>
						<p className="flex items-center gap-2 text-[13px] font-bold text-gray-700 mb-3">
							<Link2 size={16} className="text-violet-500" />
							Shareable Link
						</p>
						<div className="flex gap-2.5">
							<div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-[13px] text-gray-500 font-mono truncate">
								{shareUrl}
							</div>
							<button
								type="button"
								onClick={handleCopy}
								className={`px-6 py-3.5 rounded-xl font-bold border-none cursor-pointer flex items-center gap-2 transition-all text-sm text-white ${
									copied
										? "bg-emerald-500 shadow-[0_8px_24px_rgba(16,185,129,0.3)]"
										: "bg-gradient-to-r from-violet-500 to-violet-600 shadow-[0_8px_24px_rgba(139,92,246,0.35)] hover:-translate-y-px hover:shadow-[0_12px_32px_rgba(139,92,246,0.45)]"
								}`}
							>
								{copied ? (
									<>
										<Check size={16} />
										Copied!
									</>
								) : (
									<>
										<Copy size={16} />
										Copy
									</>
								)}
							</button>
						</div>
					</div>

					{/* Room Info Card */}
					<div className="bg-gradient-to-br from-violet-50 to-purple-100 border border-purple-200 rounded-2xl p-5">
						<div className="flex items-start justify-between">
							<div>
								<p className="text-[11px] font-bold text-violet-500 uppercase tracking-wider mb-1.5">
									Room ID
								</p>
								<p className="text-lg font-bold text-purple-900 font-mono">
									{roomId}
								</p>
							</div>
							<div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
								<QrCode size={24} className="text-violet-400" />
							</div>
						</div>
						<p className="text-[13px] text-violet-600 mt-3 leading-relaxed">
							Anyone with this link can view and edit in real-time
						</p>
					</div>

					{/* Quick Share Options */}
					<div className="flex gap-3">
						<button
							type="button"
							className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer text-[13px] font-semibold text-gray-600 transition-all hover:bg-gray-100 hover:border-violet-300 hover:text-violet-500"
						>
							<Mail size={16} />
							Email
						</button>
						<button
							type="button"
							onClick={handleCopy}
							className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer text-[13px] font-semibold text-gray-600 transition-all hover:bg-gray-100 hover:border-violet-300 hover:text-violet-500"
						>
							<Link2 size={16} />
							Copy Link
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// SAVING STATUS INDICATOR
// ============================================================================

export function SavingStatusIndicator() {
	const savingStatus = useCanvasStore((state) => state.savingStatus);

	// Don't show indicator in idle state
	if (savingStatus === "idle") return null;

	const config = {
		saving: {
			icon: <Loader2 size={14} className="animate-spin text-amber-500" />,
			text: "Saving...",
			textClass: "text-amber-600",
		},
		saved: {
			icon: <Cloud size={14} className="text-green-500" />,
			text: "Saved",
			textClass: "text-green-600",
		},
		error: {
			icon: <CloudOff size={14} className="text-red-500" />,
			text: "Save failed",
			textClass: "text-red-600",
		},
	}[savingStatus];

	if (!config) return null;

	return (
		<div
			className="glass-card px-3 py-2 flex items-center gap-1.5 rounded-lg flex-shrink-0"
			style={{ animation: "fade-in 0.2s ease-out" }}
		>
			{config.icon}
			<span className={`text-xs font-medium ${config.textClass}`}>
				{config.text}
			</span>
		</div>
	);
}

// ============================================================================
// HEADER LEFT (Menu & Title)
// ============================================================================

interface HeaderLeftProps {
	onClearCanvas?: () => void;
	onExport?: (format: "png" | "svg" | "json") => void;
	onImportJson?: () => void;
	onExportDocumentation?: () => void;
}

export function HeaderLeft({
	onClearCanvas,
	onExport,
	onImportJson,
	onExportDocumentation,
}: HeaderLeftProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [canvasName, setCanvasName] = useState("");
	const [roomId, setRoomId] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [updatedAt, setUpdatedAt] = useState<string | null>(null);

	const HTTP_URL = process.env.NEXT_PUBLIC_HTTP_URL || "http://localhost:8000";

	// Format date in a friendly way
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return "Yesterday";
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

	useEffect(() => {
		// Fetch session token and canvas data
		async function init() {
			// Get auth token
			const {
				data: { session },
			} = await supabase.auth.getSession();

			// Get roomId from URL
			const url = window.location.pathname;
			const match = url.match(/canvas\/([a-zA-Z0-9-]+)/);
			const id = match?.[1] ?? "";
			setRoomId(id);
			if (!id || !session) {
				setLoading(false);
				return;
			}

			// Fetch canvas data
			try {
				const res = await fetch(`${HTTP_URL}/api/v1/canvas/${id}`, {
					headers: {
						Authorization: `Bearer ${session.access_token}`,
					},
				});
				if (res.ok) {
					const json = await res.json();
					const canvas = json?.data?.canvas || json?.canvas;
					setCanvasName(canvas?.name || "");
					setUpdatedAt(canvas?.updated_at || null);
				}
			} catch {}
			setLoading(false);
		}
		init();
	}, [HTTP_URL]);

	const handleBlur = async () => {
		if (!roomId || !canvasName) return;

		// Get fresh session token
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return;

		setSaving(true);
		try {
			await fetch(`${HTTP_URL}/api/v1/canvas/${roomId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({ name: canvasName }),
			});
			// Update the timestamp after saving
			setUpdatedAt(new Date().toISOString());
		} catch (err) {
			console.error("Failed to save canvas name:", err);
		} finally {
			setSaving(false);
		}
	};

	const router = useRouter();

	// Hydrate isReadOnly from localStorage when roomId is known
	const setReadOnly = useCanvasStore((state) => state.setReadOnly);
	useEffect(() => {
		if (!roomId) return;
		try {
			const stored = localStorage.getItem(`lekhaflow-lock-${roomId}`);
			if (stored !== null) {
				const locked = JSON.parse(stored);
				if (typeof locked === "boolean") setReadOnly(locked);
			}
		} catch {}
	}, [roomId, setReadOnly]);

	return (
		<>
			{/* Header Left Row — flex container for back, menu, title, saving status */}
			<div
				className="absolute top-4 left-4 right-[180px] z-[var(--z-toolbar)] flex items-center gap-2"
				style={{ animation: "fade-in 0.3s ease-out" }}
			>
				{/* Back Button */}
				<button
					type="button"
					onClick={() => router.push("/")}
					title="Back to Dashboard"
					className="glass-card-elevated w-10 h-10 flex-shrink-0 rounded-xl cursor-pointer flex items-center justify-center border-none transition-all hover:bg-gray-50"
					style={{ boxShadow: "var(--shadow-md)" }}
				>
					<ArrowLeft size={18} className="text-gray-600" />
				</button>

				{/* Menu Button */}
				<button
					type="button"
					onClick={() => setMenuOpen(true)}
					title="Menu"
					className="glass-card-elevated w-10 h-10 flex-shrink-0 rounded-xl cursor-pointer flex items-center justify-center border-none transition-all hover:bg-gray-50"
					style={{ boxShadow: "var(--shadow-md)" }}
				>
					<Menu size={18} className="text-gray-600" />
				</button>

				{/* Canvas Name Card */}
				<div
					className="glass-card-elevated px-3 py-2 flex items-center gap-2 min-w-0 max-w-[280px] sm:max-w-[360px] flex-shrink"
					style={{ animation: "fade-in 0.3s ease-out 0.05s backwards" }}
				>
					{loading ? (
						<div className="flex items-center gap-2 text-gray-400">
							<div className="w-4 h-4 border-2 border-gray-300 border-t-violet-500 rounded-full animate-spin" />
							<span className="text-sm">Loading...</span>
						</div>
					) : (
						<>
							<input
								type="text"
								value={canvasName}
								onChange={(e) => setCanvasName(e.target.value)}
								onBlur={handleBlur}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.currentTarget.blur();
									}
								}}
								placeholder="Untitled Canvas"
								className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400 min-w-0"
								style={{ padding: 0 }}
							/>
							{saving && (
								<div className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin flex-shrink-0" />
							)}
							{!saving && updatedAt && (
								<span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 hidden sm:inline">
									{formatDate(updatedAt)}
								</span>
							)}
						</>
					)}
				</div>

				{/* Saving Status Indicator — inline in the flex row */}
				<SavingStatusIndicator />
			</div>

			{/* Sidebar Menu */}
			<SidebarMenu
				isOpen={menuOpen}
				onClose={() => setMenuOpen(false)}
				onClearCanvas={onClearCanvas}
				onExport={onExport}
				onImportJson={onImportJson}
				onExportDocumentation={onExportDocumentation}
			/>
		</>
	);
}

// ============================================================================
// HEADER RIGHT (Collaboration)
// ============================================================================

export function HeaderRight() {
	const { roomId } = useCanvasStore();
	const collaborators = useCollaboratorsArray();
	const [shareModalOpen, setShareModalOpen] = useState(false);

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	return (
		<>
			<div className="absolute top-4 right-4 z-[var(--z-toolbar)] flex items-center gap-2 sm:gap-3">
				{/* Collaborators - Simple Avatar Stack */}
				{collaborators.length > 0 && (
					<div className="flex items-center gap-2 glass-card px-3 py-2 rounded-full">
						<Users size={14} className="text-gray-400" />
						<div className="flex -space-x-2">
							{collaborators.slice(0, 3).map((collab, _index) => (
								<div
									key={collab.id}
									className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-white"
									style={{ backgroundColor: collab.color }}
									title={collab.name}
								>
									{getInitials(collab.name)}
								</div>
							))}
							{collaborators.length > 3 && (
								<div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 border-2 border-white">
									+{collaborators.length - 3}
								</div>
							)}
						</div>
					</div>
				)}

				{/* Share Button */}
				<button
					type="button"
					onClick={() => setShareModalOpen(true)}
					className="flex items-center gap-2 px-6 py-2.5 cursor-pointer border-none text-sm font-semibold transition-all"
					style={{
						borderRadius: "var(--radius-md)",
						background: "var(--color-accent)",
						color: "var(--color-text-on-accent)",
						boxShadow: "var(--shadow-accent-strong)",
						animation: "fade-in 0.3s ease-out 0.2s backwards",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = "var(--color-accent-hover)";
						e.currentTarget.style.transform = "translateY(-1px)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = "var(--color-accent)";
						e.currentTarget.style.transform = "translateY(0)";
					}}
				>
					<Share2 size={16} />
					Share
				</button>
			</div>

			{/* Share Modal */}
			<ShareModal
				isOpen={shareModalOpen}
				onClose={() => setShareModalOpen(false)}
				roomId={roomId}
			/>
		</>
	);
}
