"use client";

import { Bell, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase.client";
import { useCanvasStore } from "../../store/canvas-store";

interface Notification {
	id: string;
	type: "mention" | "invite" | "system" | "comment";
	content: string;
	is_read: boolean;
	created_at: string;
	actor_id?: string;
	canvas_id?: string;
	actor?: { id: string; name: string };
}

export function NotificationBell() {
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const myId = useCanvasStore((state) => state.myIdentity?.id);

	// Load & Subscribe
	useEffect(() => {
		if (!myId) return;

		let mounted = true;

		const fetchNotifications = async () => {
			const { data, error } = await supabase
				.from("notifications")
				.select("id, type, content, is_read, created_at, actor_id, canvas_id")
				.eq("user_id", myId)
				.order("created_at", { ascending: false })
				.limit(20);

			if (error) {
				console.error("Failed to load notifications", error);
				return;
			}
			if (mounted && data) {
				setNotifications(data as Notification[]);
			}
		};

		fetchNotifications();

		// Subscribe to real-time changes
		const channel = supabase
			.channel("public:notifications")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "notifications",
					filter: `user_id=eq.${myId}`,
				},
				(_payload) => {
					fetchNotifications(); // Refresh on any change
				},
			)
			.subscribe();

		return () => {
			mounted = false;
			supabase.removeChannel(channel);
		};
	}, [myId]);

	// Close on outer click
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		if (isOpen) {
			document.addEventListener("mousedown", handleClick);
		}
		return () => document.removeEventListener("mousedown", handleClick);
	}, [isOpen]);

	const unreadCount = notifications.filter((n) => !n.is_read).length;

	const markAsRead = async (id: string) => {
		setNotifications((prev) =>
			prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
		);
		await supabase.from("notifications").update({ is_read: true }).eq("id", id);
	};

	const markAllAsRead = async () => {
		setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
		if (!myId) return;
		await supabase
			.from("notifications")
			.update({ is_read: true })
			.eq("user_id", myId)
			.eq("is_read", false);
	};

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center cursor-pointer transition-all hover:bg-gray-50 relative"
			>
				<Bell size={18} className="text-gray-600" />
				{unreadCount > 0 && (
					<span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
				)}
			</button>

			{isOpen && (
				<div className="absolute top-[calc(100%+8px)] right-0 w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[9999]">
					<div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
						<h3 className="text-sm font-bold text-gray-800 m-0">
							Notifications
						</h3>
						{unreadCount > 0 && (
							<button
								onClick={markAllAsRead}
								className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 cursor-pointer bg-transparent border-none flex items-center gap-1"
							>
								<Check size={12} />
								Mark all read
							</button>
						)}
					</div>
					<div className="max-h-[300px] overflow-y-auto">
						{notifications.length === 0 ? (
							<div className="p-6 text-center text-gray-400 text-sm">
								No notifications yet
							</div>
						) : (
							notifications.map((n) => (
								<div
									key={n.id}
									onClick={() => markAsRead(n.id)}
									className={`p-3 border-b border-gray-50 cursor-pointer transition-colors ${!n.is_read ? "bg-violet-50/30" : "hover:bg-gray-50"}`}
								>
									<div className="flex gap-2.5">
										<div
											className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${!n.is_read ? "bg-violet-500" : "bg-transparent"}`}
										/>
										<div>
											<p
												className={`text-[13px] m-0 ${!n.is_read ? "text-gray-900 font-semibold" : "text-gray-600"}`}
											>
												{n.content}
											</p>
											<p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">
												{new Date(n.created_at).toLocaleDateString()}
											</p>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
