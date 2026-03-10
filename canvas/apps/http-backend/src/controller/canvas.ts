import {
	CreateCanvasSchema,
	CreateInviteSchema,
	JoinCanvasSchema,
	ToggleStarSchema,
	UpdateCanvasSchema,
} from "@repo/common";
import { HttpError, JSONResponse } from "@repo/http-core";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
	createCanvasService,
	createInviteService,
	deleteCanvasService,
	duplicateCanvasService,
	getCanvasesService,
	getCanvasService,
	getRecentCanvasesService,
	getStarredCanvasesService,
	joinCanvasService,
	searchCanvasesService,
	toggleArchiveCanvasService,
	toggleStarService,
	touchCanvasAccessService,
	updateCanvasService,
	uploadCanvasThumbnailService,
} from "../services/canvas.js";

export const createCanvas = async (req: Request, res: Response) => {
	console.log("Request Body:", req.body);
	const parsedData = CreateCanvasSchema.safeParse(req.body);

	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	const { name, isPublic } = parsedData.data;
	const folderId =
		"folderId" in parsedData.data
			? ((parsedData.data as Record<string, unknown>).folderId as
					| string
					| null
					| undefined)
			: null;
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}
	const userId = req.user.id;

	const newCanvas = await createCanvasService({
		name,
		isPublic,
		folderId,
		userId,
	});

	return JSONResponse(res, StatusCodes.CREATED, "Canvas created successfully", {
		roomId: newCanvas.id,
		slug: newCanvas.slug,
	});
};

export const updateCanvas = async (req: Request, res: Response) => {
	const { roomId } = req.params;
	const parsedData = UpdateCanvasSchema.safeParse(req.body);

	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	if (!roomId || typeof roomId !== "string") {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}

	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}
	const userId = req.user.id;

	const { name, data, thumbnail_url } = parsedData.data;

	await updateCanvasService(roomId, { name, data, thumbnail_url }, userId);

	return JSONResponse(res, StatusCodes.OK, "Canvas updated successfully");
};

export const getCanvases = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const userId = req.user.id;
	const canvases = await getCanvasesService(userId);

	return JSONResponse(res, StatusCodes.OK, "Canvases retrieved successfully", {
		canvases,
	});
};

export const getCanvas = async (req: Request, res: Response) => {
	const roomId = req.params.roomId as string;
	if (!roomId) {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}

	const canvas = await getCanvasService(roomId);
	if (!canvas) {
		throw new HttpError("Canvas not found", StatusCodes.NOT_FOUND);
	}

	return JSONResponse(res, StatusCodes.OK, "Canvas retrieved successfully", {
		canvas,
	});
};

export const deleteCanvas = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const roomId = req.params.roomId as string;
	if (!roomId) {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}

	await deleteCanvasService(roomId, req.user.id);

	return JSONResponse(res, StatusCodes.OK, "Canvas deleted successfully");
};

export const searchCanvases = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const q = (req.query.q as string) || "";
	const sortByParam = (req.query.sortBy as string) || "createdAt";
	const orderParam = (req.query.order as string) || "desc";
	const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
	const limit = Math.min(
		100,
		Math.max(1, parseInt(req.query.limit as string, 10) || 20),
	);
	const tagId = (req.query.tagId as string) || undefined;

	// Validate sortBy
	const sortBy: "createdAt" | "title" =
		sortByParam === "title" ? "title" : "createdAt";

	// Validate order
	const order: "asc" | "desc" = orderParam === "asc" ? "asc" : "desc";

	const isArchived = req.query.isArchived === "true";

	const result = await searchCanvasesService(req.user.id, {
		q,
		sortBy,
		order,
		page,
		limit,
		isArchived,
		tagId,
	});

	return JSONResponse(
		res,
		StatusCodes.OK,
		"Search results retrieved successfully",
		result,
	);
};

export const getRecentCanvases = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	try {
		const canvases = await getRecentCanvasesService(req.user.id);

		return JSONResponse(
			res,
			StatusCodes.OK,
			"Recent canvases retrieved successfully",
			{
				canvases,
			},
		);
	} catch (error) {
		throw new HttpError(
			"Failed to retrieve recent canvases: " +
				(error instanceof Error ? error.message : "Unknown error"),
			StatusCodes.INTERNAL_SERVER_ERROR,
		);
	}
};

export const touchCanvasAccess = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { roomId } = req.params;
	if (!roomId || typeof roomId !== "string") {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}

	// Fire-and-forget: don't await
	touchCanvasAccessService(roomId, req.user.id);

	res.status(StatusCodes.NO_CONTENT).end();
};

export const createInviteLink = async (req: Request, _res: Response) => {
	const { roomId } = req.params;
	if (!roomId || typeof roomId !== "string") {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const parsedData = CreateInviteSchema.safeParse(req.body);

	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	const userId = req.user.id;
	const { role } = parsedData.data;

	const { inviteLink } = await createInviteService(roomId, role, userId);

	return JSONResponse(
		_res,
		StatusCodes.CREATED,
		"Invite link generated successfully",
		{
			inviteLink,
		},
	);
};

export const updateThumbnail = async (req: Request, res: Response) => {
	const roomId = req.params.roomId;
	if (!roomId || typeof roomId !== "string") {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { thumbnail_url } = req.body;
	if (!thumbnail_url) {
		throw new HttpError("thumbnail_url is required", StatusCodes.BAD_REQUEST);
	}

	const publicUrl = await uploadCanvasThumbnailService(
		roomId,
		thumbnail_url,
		req.user.id,
	);

	return JSONResponse(res, StatusCodes.OK, "Thumbnail uploaded successfully", {
		thumbnail_url: publicUrl,
	});
};

export const duplicateCanvas = async (req: Request, res: Response) => {
	const roomId = req.params.roomId;
	if (!roomId || typeof roomId !== "string") {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const copy = await duplicateCanvasService(roomId, req.user.id);

	return JSONResponse(
		res,
		StatusCodes.CREATED,
		"Canvas duplicated successfully",
		{
			canvas: copy,
		},
	);
};

export const joinCanvasWithLink = async (req: Request, _res: Response) => {
	const { roomId } = req.params;
	if (!roomId || typeof roomId !== "string") {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const parsedData = JoinCanvasSchema.safeParse(req.body);

	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	const userId = req.user.id;
	const { token } = parsedData.data;

	const result = await joinCanvasService(token, userId);

	// ensure the token corresponds to the requested canvas
	if (result.roomId !== roomId) {
		throw new HttpError(
			"Token does not correspond to this canvas",
			StatusCodes.BAD_REQUEST,
		);
	}

	return JSONResponse(_res, StatusCodes.OK, "Successfully joined canvas", {
		role: result.role,
	});
};

export const toggleArchiveCanvas = async (req: Request, res: Response) => {
	const roomId = req.params.roomId;
	if (!roomId || typeof roomId !== "string") {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { isArchived } = req.body;
	if (typeof isArchived !== "boolean") {
		throw new HttpError(
			"isArchived (boolean) is required",
			StatusCodes.BAD_REQUEST,
		);
	}

	await toggleArchiveCanvasService(roomId, req.user.id, isArchived);

	return JSONResponse(
		res,
		StatusCodes.OK,
		`Canvas ${isArchived ? "archived" : "unarchived"} successfully`,
	);
};

export const toggleStar = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { roomId } = req.params;
	if (!roomId || typeof roomId !== "string") {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}

	const parsedData = ToggleStarSchema.safeParse(req.body);
	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	await toggleStarService(roomId, req.user.id, parsedData.data.isStarred);

	return JSONResponse(
		res,
		StatusCodes.OK,
		parsedData.data.isStarred ? "Canvas starred" : "Canvas unstarred",
	);
};

export const getStarredCanvases = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const canvases = await getStarredCanvasesService(req.user.id);

	return JSONResponse(
		res,
		StatusCodes.OK,
		"Starred canvases retrieved successfully",
		{ canvases },
	);
};
