import type { CreateCanvasType } from "@repo/common";
import { HttpError } from "@repo/http-core";
import type { Tables } from "@repo/supabase";
import { StatusCodes } from "http-status-codes";
import { createServiceClient } from "../supabase.server";

const getClient = () => createServiceClient();

const generateSlug = (name: string): string => {
	const base = name
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_-]+/g, "-");
	return `${base}-${Date.now()}`;
};

export const createCanvasService = async (
	params: CreateCanvasType & { userId: string },
): Promise<Tables<"canvases">> => {
	const { name, isPublic, folderId, userId } = params;

	const slug = generateSlug(name);
	const { data, error } = await createServiceClient()
		.from("canvases")
		.insert({
			name,
			slug,
			owner_id: userId,
			is_public: isPublic,
			data: null,
			folder_id: folderId ?? null,
		})
		.select()
		.single();
	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data;
};

export const getCanvasesService = async (
	userId: string,
): Promise<Tables<"canvases">[]> => {
	// 1. Get canvases owned by the user
	const { data: ownedCanvases, error: ownedError } = await getClient()
		.from("canvases")
		.select("*")
		.eq("owner_id", userId)
		.eq("is_deleted", false)
		.order("updated_at", { ascending: false });

	if (ownedError) {
		throw new HttpError(ownedError.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	// 2. Get canvas IDs this user has accessed (but doesn't own) via activity_logs
	const { data: accessLogs } = await getClient()
		.from("activity_logs")
		.select("canvas_id")
		.eq("user_id", userId)
		.eq("action", "accessed");

	const accessedCanvasIds = [
		...new Set(
			(accessLogs || [])
				.map((log) => log.canvas_id)
				.filter((id) => !ownedCanvases?.some((c) => c.id === id)),
		),
	];

	let sharedCanvases: Tables<"canvases">[] = [];
	if (accessedCanvasIds.length > 0) {
		const { data: shared } = await getClient()
			.from("canvases")
			.select("*")
			.in("id", accessedCanvasIds)
			.eq("is_deleted", false)
			.order("updated_at", { ascending: false });

		sharedCanvases = shared || [];
	}

	// 3. Merge: owned first, then shared
	return [...(ownedCanvases || []), ...sharedCanvases];
};

export const getCanvasService = async (
	canvasId: string,
): Promise<Tables<"canvases"> | null> => {
	const { data, error } = await getClient()
		.from("canvases")
		.select("*")
		.eq("id", canvasId)
		.eq("is_deleted", false)
		.maybeSingle();

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data;
};

export const updateCanvasService = async (
	canvasId: string,
	update: { name?: string; data?: string; thumbnail_url?: string },
	userId: string,
): Promise<void> => {
	const updateFields: Record<string, string | undefined> = {};
	if (update.name !== undefined) updateFields.name = update.name;
	if (update.data !== undefined) updateFields.data = update.data;
	if (update.thumbnail_url !== undefined)
		updateFields.thumbnail_url = update.thumbnail_url;

	const { error } = await getClient()
		.from("canvases")
		.update(updateFields)
		.eq("id", canvasId)
		.eq("owner_id", userId);
	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const deleteCanvasService = async (
	canvasId: string,
	userId: string,
): Promise<void> => {
	const { error } = await getClient()
		.from("canvases")
		.update({ is_deleted: true, deleted_at: new Date().toISOString() })
		.eq("id", canvasId)
		.eq("owner_id", userId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const syncUserService = async (user: {
	id: string;
	email: string;
	name: string;
	avatar_url: string | null;
}): Promise<Tables<"users">> => {
	const { data, error } = await getClient()
		.from("users")
		.upsert(
			{
				id: user.id,
				email: user.email,
				name: user.name,
				avatar_url: user.avatar_url,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "id" },
		)
		.select()
		.single();

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data;
};

export interface SearchCanvasesOptions {
	q?: string;
	sortBy?: "createdAt" | "title";
	order?: "asc" | "desc";
	page?: number;
	limit?: number;
	tagId?: string;
}

export const searchCanvasesService = async (
	userId: string,
	options: SearchCanvasesOptions,
): Promise<{
	canvases: Tables<"canvases">[];
	total: number;
	page: number;
	limit: number;
}> => {
	const {
		q = "",
		sortBy = "createdAt",
		order = "desc",
		page = 1,
		limit = 20,
		tagId,
	} = options;

	const ascending = order === "asc";
	const orderColumn = sortBy === "title" ? "name" : "created_at";

	// If tagId filter is active, resolve which canvas IDs have that tag
	let tagFilteredIds: string[] | null = null;
	if (tagId) {
		const { data: tagRows } = await getClient()
			.from("tags_on_canvases")
			.select("canvas_id")
			.eq("tag_id", tagId);

		tagFilteredIds = (tagRows || []).map((r) => r.canvas_id);
		if (tagFilteredIds.length === 0) {
			// No canvases have this tag — return empty
			return { canvases: [], total: 0, page, limit };
		}
	}

	// If no search query, return all canvases with sorting & pagination
	if (!q.trim()) {
		let countQuery = getClient()
			.from("canvases")
			.select("*", { count: "exact", head: true })
			.eq("owner_id", userId)
			.eq("is_deleted", false);

		if (tagFilteredIds) {
			countQuery = countQuery.in("id", tagFilteredIds);
		}

		const { count } = await countQuery;

		const total = count ?? 0;
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		let dataQuery = getClient()
			.from("canvases")
			.select("*")
			.eq("owner_id", userId)
			.eq("is_deleted", false)
			.order(orderColumn, { ascending })
			.range(from, to);

		if (tagFilteredIds) {
			dataQuery = dataQuery.in("id", tagFilteredIds);
		}

		const { data, error } = await dataQuery;

		if (error) {
			throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
		}

		return { canvases: data || [], total, page, limit };
	}

	// Search by name (ILIKE)
	const { data: nameMatches, error: nameError } = await getClient()
		.from("canvases")
		.select("*")
		.eq("owner_id", userId)
		.eq("is_deleted", false)
		.ilike("name", `%${q}%`);

	if (nameError) {
		throw new HttpError(nameError.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	// Search by tag name via junction table
	const { data: tagMatches, error: tagError } = await getClient()
		.from("tags_on_canvases")
		.select("canvas_id, tags!inner(name)")
		.ilike("tags.name", `%${q}%`);

	if (tagError) {
		throw new HttpError(tagError.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	// Get canvas IDs from tag matches not already in name matches
	const tagCanvasIds = [
		...new Set(
			(tagMatches || [])
				.map((t: { canvas_id: string }) => t.canvas_id)
				.filter((id: string) => !(nameMatches || []).some((c) => c.id === id)),
		),
	];

	let tagCanvases: Tables<"canvases">[] = [];
	if (tagCanvasIds.length > 0) {
		const { data: tagCanvasData } = await getClient()
			.from("canvases")
			.select("*")
			.in("id", tagCanvasIds)
			.eq("owner_id", userId)
			.eq("is_deleted", false);

		tagCanvases = tagCanvasData || [];
	}

	// Merge and deduplicate
	let allCanvases = [...(nameMatches || []), ...tagCanvases];

	// Apply tagId filter if active (intersection with tag-based search results)
	if (tagFilteredIds) {
		const idSet = new Set(tagFilteredIds);
		allCanvases = allCanvases.filter((c) => idSet.has(c.id));
	}

	// Sort
	allCanvases.sort((a, b) => {
		let cmp: number;
		if (sortBy === "title") {
			cmp = (a.name || "").localeCompare(b.name || "");
		} else {
			cmp =
				new Date(a.created_at || 0).getTime() -
				new Date(b.created_at || 0).getTime();
		}
		return ascending ? cmp : -cmp;
	});

	// Paginate
	const total = allCanvases.length;
	const from = (page - 1) * limit;
	const paginatedCanvases = allCanvases.slice(from, from + limit);

	return { canvases: paginatedCanvases, total, page, limit };
};

export const getRecentCanvasesService = async (
	userId: string,
	limit = 5,
): Promise<Tables<"canvases">[]> => {
	const { data, error } = await getClient()
		.from("canvases")
		.select("*")
		.eq("owner_id", userId)
		.eq("is_deleted", false)
		.not("last_accessed_at", "is", null)
		.order("last_accessed_at", { ascending: false })
		.limit(limit);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return data || [];
};

export const touchCanvasAccessService = async (
	canvasId: string,
	userId: string,
): Promise<void> => {
	try {
		await getClient()
			.from("canvases")
			.update({ last_accessed_at: new Date().toISOString() })
			.eq("id", canvasId)
			.eq("owner_id", userId);
	} catch (err) {
		// Fire-and-forget: log but don't throw
		console.error(
			"[touchCanvasAccess] Failed to update last_accessed_at:",
			err,
		);
	}
};
