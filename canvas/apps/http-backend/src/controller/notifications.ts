import type { Request, Response } from "express";
import { createServiceClient } from "../supabase.server";

export const getNotifications = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const userId = req.user?.id;
	if (!userId) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	try {
		const supabase = createServiceClient();
		const { data, error } = await supabase
			.from("notifications")
			.select("*, actor:users!notifications_actor_id_fkey(id, name, email)")
			.eq("user_id", userId)
			.order("created_at", { ascending: false })
			.limit(50);

		if (error) throw error;

		res.json({ notifications: data });
	} catch (error) {
		console.error("Error fetching notifications:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

export const createNotification = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const actorId = req.user?.id;
	if (!actorId) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	const { userId, type, content, canvasId } = req.body;

	if (!userId || !type || !content) {
		res.status(400).json({ message: "Missing required fields" });
		return;
	}

	try {
		const supabase = createServiceClient();
		const { data, error } = await supabase
			.from("notifications")
			.insert({
				user_id: userId,
				actor_id: actorId,
				type,
				content,
				canvas_id: canvasId,
				is_read: false,
			})
			.select()
			.single();

		if (error) throw error;

		res.json({ notification: data });
	} catch (error) {
		console.error("Error creating notification:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

export const markAsRead = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const userId = req.user?.id;
	const { id } = req.params;

	if (!userId || !id) {
		res.status(400).json({ message: "Invalid request" });
		return;
	}

	try {
		const supabase = createServiceClient();
		const { error } = await supabase
			.from("notifications")
			.update({ is_read: true })
			.eq("id", id)
			.eq("user_id", userId);

		if (error) throw error;

		res.json({ success: true });
	} catch (error) {
		console.error("Error marking notification as read:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

export const markAllAsRead = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const userId = req.user?.id;

	if (!userId) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	try {
		const supabase = createServiceClient();
		const { error } = await supabase
			.from("notifications")
			.update({ is_read: true })
			.eq("user_id", userId)
			.eq("is_read", false);

		if (error) throw error;

		res.json({ success: true });
	} catch (error) {
		console.error("Error marking all notifications as read:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};
