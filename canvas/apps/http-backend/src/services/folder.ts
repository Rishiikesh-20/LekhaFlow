import { HttpError } from "@repo/http-core";
import type { Tables } from "@repo/supabase";
import { StatusCodes } from "http-status-codes";
import { createServiceClient } from "../supabase.server";

const getClient = () => createServiceClient();

export const createFolderService = async (params: {
	name: string;
	ownerId: string;
	parentId?: string | null;
}): Promise<Tables<"folders">> => {
	const { name, ownerId, parentId } = params;

	// If parentId is provided, verify it exists and belongs to the user
	if (parentId) {
		const { data: parentFolder } = await getClient()
			.from("folders")
			.select("id")
			.eq("id", parentId)
			.eq("owner_id", ownerId)
			.maybeSingle();

		if (!parentFolder) {
			throw new HttpError("Parent folder not found", StatusCodes.NOT_FOUND);
		}
	}

	const { data, error } = await getClient()
		.from("folders")
		.insert({
			name,
			owner_id: ownerId,
			parent_id: parentId ?? null,
		})
		.select()
		.single();

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data;
};

export const getFolderContentsService = async (
	ownerId: string,
	folderId?: string | null,
	sortBy?: string,
	order?: string,
): Promise<{
	folders: Tables<"folders">[];
	canvases: Tables<"canvases">[];
}> => {
	// Get child folders
	let folderQuery = getClient()
		.from("folders")
		.select("*")
		.eq("owner_id", ownerId)
		.order("name", { ascending: true });

	if (folderId) {
		folderQuery = folderQuery.eq("parent_id", folderId);
	} else {
		folderQuery = folderQuery.is("parent_id", null);
	}

	const { data: folders, error: folderError } = await folderQuery;

	if (folderError) {
		throw new HttpError(folderError.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	// Determine canvas sort column and direction
	const orderColumn =
		sortBy === "title"
			? "name"
			: sortBy === "createdAt"
				? "created_at"
				: "updated_at";
	const ascending = order === "asc";

	// Get child canvases
	let canvasQuery = getClient()
		.from("canvases")
		.select("*")
		.eq("owner_id", ownerId)
		.eq("is_deleted", false)
		.order(orderColumn, { ascending });

	if (folderId) {
		canvasQuery = canvasQuery.eq("folder_id", folderId);
	} else {
		canvasQuery = canvasQuery.is("folder_id", null);
	}

	const { data: canvases, error: canvasError } = await canvasQuery;

	if (canvasError) {
		throw new HttpError(canvasError.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return {
		folders: folders || [],
		canvases: canvases || [],
	};
};

export const getFolderBreadcrumbService = async (
	folderId: string,
): Promise<{ id: string; name: string }[]> => {
	const breadcrumb: { id: string; name: string }[] = [];
	let currentId: string | null = folderId;

	// Walk up the parent chain (max 20 levels to prevent infinite loops)
	let depth = 0;
	while (currentId && depth < 20) {
		const {
			data: folder,
		}: { data: { id: string; name: string; parent_id: string | null } | null } =
			await getClient()
				.from("folders")
				.select("id, name, parent_id")
				.eq("id", currentId)
				.maybeSingle();

		if (!folder) break;

		breadcrumb.unshift({ id: folder.id, name: folder.name });
		currentId = folder.parent_id;
		depth++;
	}

	return breadcrumb;
};

export const deleteFolderService = async (
	folderId: string,
	ownerId: string,
): Promise<void> => {
	// Verify folder exists and belongs to user
	const { data: folder } = await getClient()
		.from("folders")
		.select("id")
		.eq("id", folderId)
		.eq("owner_id", ownerId)
		.maybeSingle();

	if (!folder) {
		throw new HttpError("Folder not found", StatusCodes.NOT_FOUND);
	}

	// Recursively collect all descendant folder IDs
	const allFolderIds = await collectDescendantFolderIds(folderId);
	allFolderIds.push(folderId);

	// Soft-delete all canvases in these folders
	const { error: canvasError } = await getClient()
		.from("canvases")
		.update({ is_deleted: true })
		.in("folder_id", allFolderIds)
		.eq("owner_id", ownerId);

	if (canvasError) {
		throw new HttpError(canvasError.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	// Delete all folders (deepest first to respect FK constraints)
	// We delete in reverse order (children before parents)
	for (const id of allFolderIds.reverse()) {
		const { error } = await getClient()
			.from("folders")
			.delete()
			.eq("id", id)
			.eq("owner_id", ownerId);

		if (error) {
			throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
		}
	}
};

async function collectDescendantFolderIds(parentId: string): Promise<string[]> {
	const { data: children } = await getClient()
		.from("folders")
		.select("id")
		.eq("parent_id", parentId);

	if (!children || children.length === 0) return [];

	const descendantIds: string[] = [];
	for (const child of children) {
		descendantIds.push(child.id);
		const grandchildren = await collectDescendantFolderIds(child.id);
		descendantIds.push(...grandchildren);
	}

	return descendantIds;
}

export const moveFolderService = async (
	folderId: string,
	newParentId: string | null,
	ownerId: string,
): Promise<void> => {
	// Verify folder exists and belongs to user
	const { data: folder } = await getClient()
		.from("folders")
		.select("id")
		.eq("id", folderId)
		.eq("owner_id", ownerId)
		.maybeSingle();

	if (!folder) {
		throw new HttpError("Folder not found", StatusCodes.NOT_FOUND);
	}

	// Prevent moving a folder into itself
	if (newParentId === folderId) {
		throw new HttpError(
			"Cannot move a folder into itself",
			StatusCodes.BAD_REQUEST,
		);
	}

	// Check for circular reference: walk up from newParentId to see if folderId appears
	if (newParentId) {
		let currentId: string | null = newParentId;
		let depth = 0;
		while (currentId && depth < 20) {
			if (currentId === folderId) {
				throw new HttpError(
					"Cannot move a folder into its own subfolder (circular reference)",
					StatusCodes.BAD_REQUEST,
				);
			}

			const { data: parent }: { data: { parent_id: string | null } | null } =
				await getClient()
					.from("folders")
					.select("parent_id")
					.eq("id", currentId)
					.maybeSingle();

			if (!parent) break;
			currentId = parent.parent_id;
			depth++;
		}
	}

	const { error } = await getClient()
		.from("folders")
		.update({ parent_id: newParentId })
		.eq("id", folderId)
		.eq("owner_id", ownerId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const moveCanvasToFolderService = async (
	canvasId: string,
	folderId: string | null,
	ownerId: string,
): Promise<void> => {
	// If moving to a folder, verify the folder exists and belongs to user
	if (folderId) {
		const { data: folder } = await getClient()
			.from("folders")
			.select("id")
			.eq("id", folderId)
			.eq("owner_id", ownerId)
			.maybeSingle();

		if (!folder) {
			throw new HttpError("Target folder not found", StatusCodes.NOT_FOUND);
		}
	}

	const { error } = await getClient()
		.from("canvases")
		.update({ folder_id: folderId })
		.eq("id", canvasId)
		.eq("owner_id", ownerId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};
