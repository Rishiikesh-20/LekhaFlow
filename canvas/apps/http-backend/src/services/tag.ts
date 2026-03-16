import { HttpError } from "@repo/http-core";
import type { Tables } from "@repo/supabase";
import { StatusCodes } from "http-status-codes";
import { createServiceClient } from "../supabase.server";

const serviceClient = createServiceClient();

export const getTagsService = async (): Promise<Tables<"tags">[]> => {
	const { data, error } = await serviceClient
		.from("tags")
		.select("*")
		.order("name", { ascending: true });

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data || [];
};

export const createTagService = async (params: {
	name: string;
	color?: string;
}): Promise<Tables<"tags">> => {
	const { name, color } = params;

	const { data, error } = await serviceClient
		.from("tags")
		.insert({ name, color: color ?? "#6D28D9" })
		.select()
		.single();

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data;
};

export const updateTagService = async (
	tagId: string,
	update: { name?: string; color?: string },
): Promise<Tables<"tags">> => {
	const updateFields: Record<string, string | undefined> = {};
	if (update.name !== undefined) updateFields.name = update.name;
	if (update.color !== undefined) updateFields.color = update.color;

	const { data, error } = await serviceClient
		.from("tags")
		.update(updateFields)
		.eq("id", tagId)
		.select()
		.single();

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data;
};

export const deleteTagService = async (tagId: string): Promise<void> => {
	// Delete join-table rows first (in case there's no ON DELETE CASCADE)
	await serviceClient.from("tags_on_canvases").delete().eq("tag_id", tagId);

	const { error } = await serviceClient.from("tags").delete().eq("id", tagId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const assignTagService = async (
	canvasId: string,
	tagId: string,
): Promise<void> => {
	const { error } = await serviceClient
		.from("tags_on_canvases")
		.upsert(
			{ canvas_id: canvasId, tag_id: tagId },
			{ onConflict: "canvas_id,tag_id" },
		);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const unassignTagService = async (
	canvasId: string,
	tagId: string,
): Promise<void> => {
	const { error } = await serviceClient
		.from("tags_on_canvases")
		.delete()
		.eq("canvas_id", canvasId)
		.eq("tag_id", tagId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const getCanvasTagsService = async (
	canvasId: string,
): Promise<Tables<"tags">[]> => {
	const { data, error } = await serviceClient
		.from("tags_on_canvases")
		.select("tags(*)")
		.eq("canvas_id", canvasId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	// Flatten: each row is { tags: { id, name, color } }
	return (data || [])
		.map((row) => (row as unknown as { tags: Tables<"tags"> | null }).tags)
		.filter((t): t is Tables<"tags"> => t !== null);
};
