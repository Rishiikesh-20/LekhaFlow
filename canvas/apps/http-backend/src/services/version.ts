import { HttpError } from "@repo/http-core";
import type { Tables } from "@repo/supabase";
import { StatusCodes } from "http-status-codes";
import { createServiceClient } from "../supabase.server.js";

const serviceClient = createServiceClient();

export const saveVersionService = async (params: {
	canvasId: string;
	name: string;
	snapshot: string;
	userId: string;
}): Promise<Tables<"canvas_versions">> => {
	const { canvasId, name, snapshot, userId } = params;

	const { data, error } = await serviceClient
		.from("canvas_versions")
		.insert({
			canvas_id: canvasId,
			name,
			snapshot,
			creator_id: userId,
		})
		.select()
		.single();

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data;
};

export const getVersionsService = async (
	canvasId: string,
): Promise<Tables<"canvas_versions">[]> => {
	const { data, error } = await serviceClient
		.from("canvas_versions")
		.select("*")
		.eq("canvas_id", canvasId)
		.order("created_at", { ascending: false });

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data ?? [];
};

export const getVersionService = async (
	versionId: string,
): Promise<Tables<"canvas_versions"> | null> => {
	const { data, error } = await serviceClient
		.from("canvas_versions")
		.select("*")
		.eq("id", versionId)
		.maybeSingle();

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data;
};

export const deleteVersionService = async (
	versionId: string,
	userId: string,
): Promise<void> => {
	// Only allow the creator to delete
	const { error } = await serviceClient
		.from("canvas_versions")
		.delete()
		.eq("id", versionId)
		.eq("creator_id", userId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};
