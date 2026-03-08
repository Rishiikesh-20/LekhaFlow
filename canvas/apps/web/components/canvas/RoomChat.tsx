"use client";

import { MessageSquare, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase.client";
import { useCanvasStore } from "../../store/canvas-store";

interface ChatMessage {
	id: string;
	canvas_id: string;
	user_id: string;
	content: string;
	created_at: string;
	users?: {
		name: string;
		avatar_url: string;
	};
}

export function RoomChat() {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [newMessage, setNewMessage] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const { roomId } = useCanvasStore();
	const [currentUser, setCurrentUser] = useState<{
		id: string;
		email?: string;
		user_metadata?: Record<string, unknown>;
	} | null>(null);

	// Get current user
	useEffect(() => {
		const getUser = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (session) {
				setCurrentUser(session.user);
			}
		};
		getUser();
	}, []);

	// Fetch messages and subscribe to new ones
	useEffect(() => {
		if (!roomId || !isOpen) return;

		const fetchMessages = async () => {
			const { data, error } = await supabase
				.from("room_chat")
				.select("*, users(name, avatar_url)")
				.eq("canvas_id", roomId)
				.order("created_at", { ascending: true });

			if (!error && data) {
				setMessages(data);
			} else if (error) {
				console.error("Failed to load messages:", error);
				// Don't show alert on fetch failure - just log it
			}
		};

		fetchMessages();

		// Subscribe to new messages
		const channel = supabase
			.channel(`chat_${roomId}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "room_chat",
					filter: `canvas_id=eq.${roomId}`,
				},
				async (payload: { new: Record<string, unknown> }) => {
					// Fetch the user info for the new message
					const { data: userData } = await supabase
						.from("users")
						.select("name, avatar_url")
						.eq("id", payload.new.user_id)
						.single();

					const newMsg = {
						...payload.new,
						users: userData || { name: "Unknown", avatar_url: "" },
					} as ChatMessage;

					setMessages((prev) => [...prev, newMsg]);
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [roomId, isOpen]);

	// Auto-scroll to bottom
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const sendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newMessage.trim() || !currentUser || !roomId) return;

		const { error } = await supabase.from("room_chat").insert([
			{
				canvas_id: roomId,
				user_id: currentUser.id,
				content: newMessage.trim(),
			},
		]);

		if (!error) {
			setNewMessage("");
		} else {
			console.error("Failed to send message:", error);

			// Show helpful error message
			if (error.code === "42P01") {
				alert(
					"Chat table not found. Please run the room_chat.sql migration in your Supabase dashboard.",
				);
			} else {
				alert(`Failed to send message: ${error.message || "Unknown error"}`);
			}
		}
	};

	return (
		<>
			{/* Chat Toggle Button */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={`absolute bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-colors border-none cursor-pointer flex items-center justify-center ${
					isOpen
						? "bg-violet-600 text-white"
						: "bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200"
				}`}
				title="Room Chat"
			>
				<MessageSquare size={20} />
			</button>

			{/* Chat Sidebar */}
			{isOpen && (
				<div className="absolute right-4 bottom-16 z-50 w-80 h-[450px] bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 flex flex-col animate-scale-in flex-shrink-0">
					{/* Header */}
					<div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
						<div className="flex items-center gap-2">
							<MessageSquare size={16} className="text-violet-600" />
							<span className="font-semibold text-gray-800">Room Chat</span>
						</div>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors border-none bg-transparent cursor-pointer"
						>
							<X size={16} />
						</button>
					</div>

					{/* Messages Area */}
					<div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-gray-50/50">
						{messages.length === 0 ? (
							<div className="h-full flex flex-col items-center justify-center text-gray-400">
								<MessageSquare size={32} className="mb-2 opacity-50" />
								<p className="text-sm">No messages yet.</p>
								<p className="text-xs mt-1">Say hello to the room!</p>
							</div>
						) : (
							messages.map((msg) => {
								const isMe = msg.user_id === currentUser?.id;
								return (
									<div
										key={msg.id}
										className={`flex flex-col max-w-[85%] ${
											isMe ? "items-end ml-auto" : "items-start"
										}`}
									>
										<span className="text-[10px] text-gray-400 mb-1 px-1">
											{isMe ? "You" : msg.users?.name || "Unknown"}
										</span>
										<div
											className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words ${
												isMe
													? "bg-violet-600 text-white rounded-tr-sm"
													: "bg-gray-100 text-gray-800 rounded-tl-sm ring-1 ring-inset ring-gray-200"
											}`}
										>
											{msg.content}
										</div>
									</div>
								);
							})
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Input Area */}
					<div className="p-3 bg-white border-t border-gray-100 rounded-b-2xl shrink-0">
						<form onSubmit={sendMessage} className="flex gap-2">
							<input
								type="text"
								value={newMessage}
								onChange={(e) => setNewMessage(e.target.value)}
								placeholder="Type a message..."
								className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-sans"
							/>
							<button
								type="submit"
								disabled={!newMessage.trim()}
								className="p-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-none cursor-pointer flex items-center justify-center"
							>
								<Send size={16} />
							</button>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
