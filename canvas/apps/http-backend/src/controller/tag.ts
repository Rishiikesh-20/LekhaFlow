import { HttpError, JSONResponse } from "@repo/http-core";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
	assignTagService,
	createTagService,
	deleteTagService,
	getCanvasTagsService,
	getTagsService,
	unassignTagService,
	updateTagService,
} from "../services/tag.js";

// Inline schemas to avoid @repo/common build‑order issues
const CreateTagSchema = z.object({
	name: z.string().min(1, "Tag name is required").max(30),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code (e.g. #FF0000)")
		.optional()
		.default("#6D28D9"),
});

const UpdateTagSchema = z.object({
	name: z.string().min(1).max(30).optional(),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code")
		.optional(),
});

const AssignTagSchema = z.object({
	tagId: z.string().min(1, "Tag ID is required"),
});

export const getTags = async (_req: Request, res: Response) => {
	const tags = await getTagsService();

	return JSONResponse(res, StatusCodes.OK, "Tags retrieved successfully", {
		tags,
	});
};

export const createTag = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const parsedData = CreateTagSchema.safeParse(req.body);
	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	const tag = await createTagService(parsedData.data);

	return JSONResponse(res, StatusCodes.CREATED, "Tag created successfully", {
		tag,
	});
};

export const updateTag = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const tagId = req.params.tagId as string;
	if (!tagId) {
		throw new HttpError("Tag ID is required", StatusCodes.BAD_REQUEST);
	}

	const parsedData = UpdateTagSchema.safeParse(req.body);
	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	const tag = await updateTagService(tagId, parsedData.data);

	return JSONResponse(res, StatusCodes.OK, "Tag updated successfully", {
		tag,
	});
};

export const deleteTag = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const tagId = req.params.tagId as string;
	if (!tagId) {
		throw new HttpError("Tag ID is required", StatusCodes.BAD_REQUEST);
	}

	await deleteTagService(tagId);

	return JSONResponse(res, StatusCodes.OK, "Tag deleted successfully");
};

export const assignTag = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const roomId = req.params.roomId as string;
	if (!roomId) {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}

	const parsedData = AssignTagSchema.safeParse(req.body);
	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	await assignTagService(roomId, parsedData.data.tagId);

	return JSONResponse(
		res,
		StatusCodes.CREATED,
		"Tag assigned to canvas successfully",
	);
};

export const unassignTag = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const roomId = req.params.roomId as string;
	const tagId = req.params.tagId as string;
	if (!roomId || !tagId) {
		throw new HttpError(
			"Room ID and Tag ID are required",
			StatusCodes.BAD_REQUEST,
		);
	}

	await unassignTagService(roomId, tagId);

	return JSONResponse(
		res,
		StatusCodes.OK,
		"Tag removed from canvas successfully",
	);
};

export const getCanvasTags = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const roomId = req.params.roomId as string;
	if (!roomId) {
		throw new HttpError("Room ID is required", StatusCodes.BAD_REQUEST);
	}

	const tags = await getCanvasTagsService(roomId);

	return JSONResponse(
		res,
		StatusCodes.OK,
		"Canvas tags retrieved successfully",
		{ tags },
	);
};
