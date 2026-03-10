import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { createServiceClient } from "../supabase.server";

/**
 * Get all roles in the system
 */
export const getRoles = async (_req: Request, res: Response): Promise<void> => {
	try {
		const supabase = createServiceClient();
		const { data, error } = await supabase
			.from("roles")
			.select("*")
			.order("level", { ascending: false });

		if (error) throw error;

		res.json({ roles: data });
	} catch (error) {
		console.error("Error fetching roles:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

/**
 * Get all user-role assignments
 */
export const getUserRoles = async (
	_req: Request,
	res: Response,
): Promise<void> => {
	try {
		const supabase = createServiceClient();
		const { data, error } = await supabase
			.from("user_roles")
			.select("user_id, role_id, users(name, email), roles(*)");

		if (error) throw error;

		res.json({ userRoles: data });
	} catch (error) {
		console.error("Error fetching user roles:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

/**
 * Check if the requesting user is an admin
 */
async function isAdmin(userId: string): Promise<boolean> {
	const supabase = createServiceClient();
	const { data } = await supabase
		.from("user_roles")
		.select("roles(name, level)")
		.eq("user_id", userId)
		.single();

	// data.roles could be an object or array depending on the query
	const rolesData = data?.roles as { name?: string } | null;
	return rolesData?.name === "admin";
}

/**
 * Assign a role to a user (admin only)
 */
export const assignRole = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const userId = req.user?.id;
	if (!userId) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	// Check if requester is admin
	if (!(await isAdmin(userId))) {
		res.status(403).json({ message: "Only admins can assign roles" });
		return;
	}

	const { targetUserId, roleId } = req.body;

	if (!targetUserId || !roleId) {
		res
			.status(400)
			.json({ message: "Missing required fields: targetUserId, roleId" });
		return;
	}

	try {
		const supabase = createServiceClient();

		// First, remove any existing role for this user
		await supabase.from("user_roles").delete().eq("user_id", targetUserId);

		// Then assign the new role
		const { data, error } = await supabase
			.from("user_roles")
			.insert({
				user_id: targetUserId,
				role_id: roleId,
				assigned_by: userId,
			})
			.select()
			.single();

		if (error) throw error;

		res.status(StatusCodes.OK).json({
			message: "Role assigned successfully",
			data: { userRole: data },
		});
	} catch (error) {
		console.error("Error assigning role:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

/**
 * Remove a role from a user (admin only)
 */
export const removeRole = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const userId = req.user?.id;
	if (!userId) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	// Check if requester is admin
	if (!(await isAdmin(userId))) {
		res.status(403).json({ message: "Only admins can remove roles" });
		return;
	}

	const { targetUserId } = req.body;

	if (!targetUserId) {
		res.status(400).json({ message: "Missing required field: targetUserId" });
		return;
	}

	try {
		const supabase = createServiceClient();
		const { error } = await supabase
			.from("user_roles")
			.delete()
			.eq("user_id", targetUserId);

		if (error) throw error;

		res.status(StatusCodes.OK).json({ message: "Role removed successfully" });
	} catch (error) {
		console.error("Error removing role:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

/**
 * Get the current user's role
 */
export const getMyRole = async (req: Request, res: Response): Promise<void> => {
	const userId = req.user?.id;
	if (!userId) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	try {
		const supabase = createServiceClient();
		const { data, error } = await supabase
			.from("user_roles")
			.select("role_id, roles(*)")
			.eq("user_id", userId)
			.single();

		if (error) {
			// User may not have a role yet
			res.json({ role: null });
			return;
		}

		res.json({ role: data.roles });
	} catch (error) {
		console.error("Error fetching user role:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};
