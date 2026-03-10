import type { Router as RouterType } from "express";
import { Router } from "express";
import {
	assignRole,
	getMyRole,
	getRoles,
	getUserRoles,
	removeRole,
} from "../controller/rbac";
import { authMiddleware } from "../middleware/auth";

export const rbacRouter: RouterType = Router();

// Middleware: Authenticate all RBAC routes
rbacRouter.use(authMiddleware);

// Get all system roles
rbacRouter.get("/roles", getRoles);

// Get all user-role assignments
rbacRouter.get("/user-roles", getUserRoles);

// Get current user's role
rbacRouter.get("/my-role", getMyRole);

// Assign a role to a user (admin only)
rbacRouter.post("/assign", assignRole);

// Remove a role from a user (admin only)
rbacRouter.delete("/remove", removeRole);
