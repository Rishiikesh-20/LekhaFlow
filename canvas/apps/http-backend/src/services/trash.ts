import { HttpError } from "@repo/http-core";
import type { Tables } from "@repo/supabase";
import { StatusCodes } from "http-status-codes";
import { createServiceClient } from "../supabase.server";

const serviceClient = createServiceClient();

export const getTrashService = async (
	userId: string,
): Promise<Tables<"canvases">[]> => {
	const { data, error } = await serviceClient
		.from("canvases")
		.select("*")
		.eq("owner_id", userId)
		.eq("is_deleted", true)
		.order("deleted_at", { ascending: false });

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data || [];
};

export const restoreCanvasService = async (
	canvasId: string,
	userId: string,
): Promise<void> => {
	// Verify canvas exists, is deleted, and belongs to user
	const { data: canvas } = await serviceClient
		.from("canvases")
		.select("id")
		.eq("id", canvasId)
		.eq("owner_id", userId)
		.eq("is_deleted", true)
		.maybeSingle();

	if (!canvas) {
		throw new HttpError("Item not found in trash", StatusCodes.NOT_FOUND);
	}

	const { error } = await serviceClient
		.from("canvases")
		.update({ is_deleted: false, deleted_at: null })
		.eq("id", canvasId)
		.eq("owner_id", userId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const purgeCanvasService = async (
	canvasId: string,
	userId: string,
): Promise<void> => {
	// Verify canvas exists, is deleted, and belongs to user
	const { data: canvas } = await serviceClient
		.from("canvases")
		.select("id")
		.eq("id", canvasId)
		.eq("owner_id", userId)
		.eq("is_deleted", true)
		.maybeSingle();

	if (!canvas) {
		throw new HttpError("Item not found in trash", StatusCodes.NOT_FOUND);
	}

	const { error } = await serviceClient
		.from("canvases")
		.delete()
		.eq("id", canvasId)
		.eq("owner_id", userId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};
