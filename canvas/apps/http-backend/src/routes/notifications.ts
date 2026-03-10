import type { Router as RouterType } from "express";
import { Router } from "express";
import {
	createNotification,
	getNotifications,
	markAllAsRead,
	markAsRead,
} from "../controller/notifications";
import { authMiddleware } from "../middleware/auth";

export const notificationRouter: RouterType = Router();

// Middleware: Authenticate all notification routes
notificationRouter.use(authMiddleware);

// Get my notifications
notificationRouter.get("/", getNotifications);

// Create a new notification (e.g. mention)
notificationRouter.post("/", createNotification);

// Mark a specific notification as read
notificationRouter.put("/:id/read", markAsRead);

// Mark all notifications as read
notificationRouter.put("/read-all", markAllAsRead);
