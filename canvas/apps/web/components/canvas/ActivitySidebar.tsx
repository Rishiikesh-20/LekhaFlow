"use client";

import { Activity, Trash2, X } from "lucide-react";
import { useCanvasStore } from "../../store/canvas-store";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format a timestamp as a relative time string (e.g., "2s ago", "5m ago")
 */
function relativeTime(ts: number): string {
	const diff = Date.now() - ts;
	const seconds = Math.floor(diff / 1000);
	if (seconds < 5) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ago`;
}

/**
 * Map action to human-readable verb with color
 */
function actionConfig(action: "added" | "updated" | "deleted") {
	switch (action) {
		case "added":
			return { verb: "added", color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
		case "updated":
			return { verb: "updated", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" };
		case "deleted":
			return { verb: "deleted", color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
	}
}

// ============================================================================
// ACTIVITY SIDEBAR COMPONENT
// ============================================================================

export function ActivitySidebar() {
	const isOpen = useCanvasStore((s) => s.isActivitySidebarOpen);
	const setOpen = useCanvasStore((s) => s.setActivitySidebarOpen);
	const activityLog = useCanvasStore((s) => s.activityLog);
	const clearLog = useCanvasStore((s) => s.clearActivityLog);

	return (
		<>
			{/* Toggle Button — bottom-left so it doesn't conflict with the Style panel on the right */}
			<button
				type="button"
				onClick={() => setOpen(!isOpen)}
				title="Activity Log"
				className="fixed left-4 bottom-16 z-30 w-10 h-10 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all hover:scale-105"
				style={{
					background: isOpen
						? "var(--color-accent, #7c3aed)"
						: "rgba(255,255,255,0.9)",
					color: isOpen ? "#fff" : "#6b7280",
					boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
					backdropFilter: "blur(12px)",
				}}
			>
				<Activity size={18} />
				{/* Badge */}
				{activityLog.length > 0 && !isOpen && (
					<span
						className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
						style={{ background: "#7c3aed" }}
					>
						{activityLog.length > 9 ? "9+" : activityLog.length}
					</span>
				)}
			</button>

			{/* Sidebar Panel — slides in from the LEFT so it doesn't overlap with Style panel */}
			<div
				className="fixed top-0 left-0 h-full z-40 flex flex-col transition-transform duration-300 ease-out"
				style={{
					width: 300,
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
							<Activity size={16} className="text-white" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-gray-800 m-0">Activity</h3>
							<p className="text-[11px] text-violet-500 m-0 font-medium">
								{activityLog.length} event{activityLog.length !== 1 ? "s" : ""}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-1">
						{activityLog.length > 0 && (
							<button
								type="button"
								onClick={clearLog}
								title="Clear log"
								className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer flex items-center justify-center hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
							>
								<Trash2 size={14} />
							</button>
						)}
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer flex items-center justify-center hover:bg-gray-100 transition-colors"
						>
							<X size={16} className="text-gray-500" />
						</button>
					</div>
				</div>

				{/* Log Entries */}
				<div className="flex-1 overflow-y-auto px-3 py-2">
					{activityLog.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-center px-6">
							<div
								className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
								style={{ background: "rgba(124,58,237,0.08)" }}
							>
								<Activity size={24} className="text-violet-400" />
							</div>
							<p className="text-sm font-medium text-gray-500 mb-1">
								No activity yet
							</p>
							<p className="text-xs text-gray-400">
								Draw, add, or delete elements to see activity here.
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-1">
							{activityLog.map((entry) => {
								const cfg = actionConfig(entry.action);
								return (
									<div
										key={entry.id}
										className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-50"
										style={{ animation: "fade-in 0.25s ease-out" }}
									>
										{/* User Color Dot */}
										<div
											className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
											style={{
												backgroundColor: entry.userColor,
												boxShadow: `0 0 6px ${entry.userColor}40`,
											}}
										/>

										{/* Content */}
										<div className="flex-1 min-w-0">
											<p className="text-[13px] text-gray-700 m-0 leading-snug">
												<span className="font-semibold">{entry.userName}</span>{" "}
												<span
													className="font-medium px-1.5 py-0.5 rounded text-[11px]"
													style={{
														color: cfg.color,
														background: cfg.bg,
													}}
												>
													{cfg.verb}
												</span>{" "}
												a {entry.elementType}
											</p>
											<p className="text-[11px] text-gray-400 m-0 mt-0.5">
												{relativeTime(entry.timestamp)}
											</p>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
