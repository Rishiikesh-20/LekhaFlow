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

	updateFields.updated_at = new Date().toISOString();

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
	isArchived?: boolean;
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
		isArchived = false,
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

		tagFilteredIds = (tagRows || []).map(
			(r: { canvas_id: string }) => r.canvas_id,
		);
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
			.eq("is_deleted", false)
			.eq("is_archived", isArchived);

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
			.eq("is_archived", isArchived)
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
		.eq("is_archived", isArchived)
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
			.eq("is_archived", isArchived)
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
	// 1. Get owned recent canvases
	const { data: ownedData, error: ownedError } = await getClient()
		.from("canvases")
		.select("*")
		.eq("owner_id", userId)
		.eq("is_deleted", false)
		.eq("is_archived", false)
		.not("last_accessed_at", "is", null)
		.order("last_accessed_at", { ascending: false })
		.limit(limit);

	if (ownedError) {
		throw new HttpError(ownedError.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	// 2. Get recently accessed shared canvases (non-critical — ignore failures)
	let sharedData: Tables<"canvases">[] = [];
	try {
		const { data: accessLogs } = await getClient()
			.from("activity_logs")
			.select("canvas_id")
			.eq("user_id", userId)
			.eq("action", "accessed")
			.order("created_at", { ascending: false });

		const recentSharedIds = [
			...new Set(
				(accessLogs || [])
					.map((log) => log.canvas_id)
					.filter((id) => !(ownedData || []).some((c) => c.id === id)),
			),
		].slice(0, limit);

		if (recentSharedIds.length > 0) {
			const { data: shared } = await getClient()
				.from("canvases")
				.select("*")
				.in("id", recentSharedIds)
				.eq("is_deleted", false)
				.not("last_accessed_at", "is", null);

			sharedData = shared || [];
		}
	} catch {
		// activity_logs query is non-critical; return only owned canvases
	}

	// 3. Merge, deduplicate (just in case), and sort globally
	const allRecent = [...(ownedData || []), ...sharedData];

	const dedupedMap = new Map<string, Tables<"canvases">>();
	for (const canvas of allRecent) {
		if (!dedupedMap.has(canvas.id)) {
			dedupedMap.set(canvas.id, canvas);
		}
	}

	const dedupedRecent = Array.from(dedupedMap.values());
	dedupedRecent.sort((a, b) => {
		return (
			new Date(b.last_accessed_at || 0).getTime() -
			new Date(a.last_accessed_at || 0).getTime()
		);
	});

	return dedupedRecent.slice(0, limit);
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

export const uploadCanvasThumbnailService = async (
	canvasId: string,
	base64Data: string,
	userId: string,
): Promise<string> => {
	// 1. Convert base64 to Buffer
	const base64Content = base64Data.includes(",")
		? base64Data.split(",")[1]
		: base64Data;
	if (!base64Content) {
		throw new HttpError("Invalid image data", StatusCodes.BAD_REQUEST);
	}
	const buffer = Buffer.from(base64Content, "base64");

	const filePath = `${userId}/${canvasId}.jpg`;
	const client = createServiceClient(); // use factory directly for consistency

	// 2. Upload to Supabase Storage
	const { error: uploadError } = await client.storage
		.from("thumbnails")
		.upload(filePath, buffer, {
			contentType: "image/jpeg",
			upsert: true,
		});

	if (uploadError) {
		// If bucket doesn't exist, try creating it
		if (
			uploadError.message.toLowerCase().includes("not found") ||
			uploadError.message.toLowerCase().includes("does not exist")
		) {
			try {
				await client.storage.createBucket("thumbnails", {
					public: true,
					allowedMimeTypes: ["image/jpeg", "image/png"],
				});
				// Retry upload
				const { error: retryError } = await client.storage
					.from("thumbnails")
					.upload(filePath, buffer, {
						contentType: "image/jpeg",
						upsert: true,
					});
				if (retryError) {
					throw new HttpError(
						retryError.message,
						StatusCodes.INTERNAL_SERVER_ERROR,
					);
				}
			} catch (err) {
				console.error("[uploadThumbnail] Bucket creation failed:", err);
				throw new HttpError(
					uploadError.message,
					StatusCodes.INTERNAL_SERVER_ERROR,
				);
			}
		} else {
			throw new HttpError(
				uploadError.message,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}

	// 3. Get public URL
	const {
		data: { publicUrl },
	} = client.storage.from("thumbnails").getPublicUrl(filePath);

	// 4. Update canvases table
	const { error: dbError } = await client
		.from("canvases")
		.update({
			thumbnail_url: publicUrl,
			updated_at: new Date().toISOString(),
		})
		.eq("id", canvasId)
		.eq("owner_id", userId);

	if (dbError) {
		throw new HttpError(dbError.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	return publicUrl;
};

export const duplicateCanvasService = async (
	canvasId: string,
	userId: string,
): Promise<Tables<"canvases">> => {
	const client = getClient();

	// 1. Fetch original canvas
	const { data: original, error: fetchError } = await client
		.from("canvases")
		.select("*")
		.eq("id", canvasId)
		.eq("owner_id", userId)
		.single();

	if (fetchError || !original) {
		throw new HttpError(
			fetchError?.message || "Canvas not found",
			StatusCodes.NOT_FOUND,
		);
	}

	// 2. Create new canvas with identical data but new name/id
	const newName = original.name ? `Copy of ${original.name}` : "Untitled Copy";
	const newSlug = generateSlug(newName);

	const { data: copy, error: createError } = await client
		.from("canvases")
		.insert({
			name: newName,
			slug: newSlug,
			owner_id: userId,
			data: original.data, // Deep copy of elements
			background_color: original.background_color,
			thumbnail_url: original.thumbnail_url,
			folder_id: original.folder_id,
			is_public: original.is_public,
		})
		.select()
		.single();

	if (createError || !copy) {
		throw new HttpError(
			createError?.message || "Failed to create copy",
			StatusCodes.INTERNAL_SERVER_ERROR,
		);
	}

	// 3. Optional: Copy tags if they exist
	const { data: originalTags } = await client
		.from("tags_on_canvases")
		.select("tag_id")
		.eq("canvas_id", canvasId);

	if (originalTags && originalTags.length > 0) {
		const tagInserts = originalTags.map((t) => ({
			canvas_id: copy.id,
			tag_id: t.tag_id,
		}));
		await client.from("tags_on_canvases").insert(tagInserts);
	}

	return copy;
};

export const toggleArchiveCanvasService = async (
	canvasId: string,
	userId: string,
	isArchived: boolean,
): Promise<void> => {
	const { error } = await getClient()
		.from("canvases")
		.update({ is_archived: isArchived })
		.eq("id", canvasId)
		.eq("owner_id", userId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const toggleStarService = async (
	canvasId: string,
	userId: string,
	isStarred: boolean,
): Promise<void> => {
	const { error } = await getClient()
		.from("canvases")
		.update({ is_starred: isStarred })
		.eq("id", canvasId)
		.eq("owner_id", userId);

	if (error) {
		throw new HttpError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}
};

export const getStarredCanvasesService = async (
	userId: string,
): Promise<
	Pick<
		Tables<"canvases">,
		"id" | "name" | "thumbnail_url" | "owner_id" | "updated_at" | "is_starred"
	>[]
> => {
	// First get all owned canvases that are starred
	const { data: ownedStarred, error: ownedError } = await getClient()
		.from("canvases")
		.select("id, name, thumbnail_url, owner_id, updated_at, is_starred")
		.eq("owner_id", userId)
		.eq("is_deleted", false)
		.eq("is_starred", true);

	if (ownedError) {
		throw new HttpError(ownedError.message, StatusCodes.INTERNAL_SERVER_ERROR);
	}

	// Get shared canvases that the user has interacted with and are starred
	// Since stars are global for now (per canvas, not per user-canvas relation)
	// We'll trust the access map. If star is user-specific, we'd need a different schema.
	// We assume `is_starred` is currently on the `canvases` table, so it's global for the canvas.
	const { data: accessLogs } = await getClient()
		.from("activity_logs")
		.select("canvas_id")
		.eq("user_id", userId);

	const accessedIds = [
		...new Set(
			(accessLogs || [])
				.map((log) => log.canvas_id)
				.filter((id) => !(ownedStarred || []).some((c) => c.id === id)),
		),
	];

	let sharedStarred: Pick<
		Tables<"canvases">,
		"id" | "name" | "thumbnail_url" | "owner_id" | "updated_at" | "is_starred"
	>[] = [];
	if (accessedIds.length > 0) {
		const { data: shared } = await getClient()
			.from("canvases")
			.select("id, name, thumbnail_url, owner_id, updated_at, is_starred")
			.in("id", accessedIds)
			.eq("is_deleted", false)
			.eq("is_starred", true);

		sharedStarred = shared || [];
	}

	const allStarred = [...(ownedStarred || []), ...sharedStarred];

	// Deduplicate just in case
	const dedupedMap = new Map<
		string,
		Pick<
			Tables<"canvases">,
			"id" | "name" | "thumbnail_url" | "owner_id" | "updated_at" | "is_starred"
		>
	>();
	for (const canvas of allStarred) {
		if (!dedupedMap.has(canvas.id)) {
			dedupedMap.set(canvas.id, canvas);
		}
	}

	const result = Array.from(dedupedMap.values());
	result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

	return result;
};
