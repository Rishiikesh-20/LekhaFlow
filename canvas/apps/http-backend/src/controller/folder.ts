import {
	CreateFolderSchema,
	MoveCanvasSchema,
	MoveFolderSchema,
} from "@repo/common";
import { HttpError, JSONResponse } from "@repo/http-core";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
	createFolderService,
	deleteFolderService,
	getFolderBreadcrumbService,
	getFolderContentsService,
	moveCanvasToFolderService,
	moveFolderService,
} from "../services/folder.js";

export const createFolder = async (req: Request, res: Response) => {
	const parsedData = CreateFolderSchema.safeParse(req.body);

	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { name, parentId } = parsedData.data;
	const folder = await createFolderService({
		name,
		ownerId: req.user.id,
		parentId,
	});

	return JSONResponse(res, StatusCodes.CREATED, "Folder created successfully", {
		folder,
	});
};

export const getFolderContents = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const folderId = (req.query.folderId as string) || null;
	const sortBy = (req.query.sortBy as string) || undefined;
	const order = (req.query.order as string) || undefined;
	const contents = await getFolderContentsService(
		req.user.id,
		folderId,
		sortBy,
		order,
	);

	return JSONResponse(
		res,
		StatusCodes.OK,
		"Folder contents retrieved successfully",
		contents,
	);
};

export const getFolderBreadcrumb = async (req: Request, res: Response) => {
	const folderId = req.params.folderId as string;

	if (!folderId) {
		throw new HttpError("Folder ID is required", StatusCodes.BAD_REQUEST);
	}

	const breadcrumb = await getFolderBreadcrumbService(folderId);

	return JSONResponse(
		res,
		StatusCodes.OK,
		"Breadcrumb retrieved successfully",
		{ breadcrumb },
	);
};

export const deleteFolder = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const folderId = req.params.folderId as string;
	if (!folderId) {
		throw new HttpError("Folder ID is required", StatusCodes.BAD_REQUEST);
	}

	await deleteFolderService(folderId, req.user.id);

	return JSONResponse(res, StatusCodes.OK, "Folder deleted successfully");
};

export const moveFolder = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const folderId = req.params.folderId as string;
	if (!folderId) {
		throw new HttpError("Folder ID is required", StatusCodes.BAD_REQUEST);
	}

	const parsedData = MoveFolderSchema.safeParse(req.body);
	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	await moveFolderService(folderId, parsedData.data.parentId, req.user.id);

	return JSONResponse(res, StatusCodes.OK, "Folder moved successfully");
};

export const moveCanvas = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const canvasId = req.params.canvasId as string;
	if (!canvasId) {
		throw new HttpError("Canvas ID is required", StatusCodes.BAD_REQUEST);
	}

	const parsedData = MoveCanvasSchema.safeParse(req.body);
	if (!parsedData.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsedData.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	await moveCanvasToFolderService(
		canvasId,
		parsedData.data.folderId,
		req.user.id,
	);

	return JSONResponse(res, StatusCodes.OK, "Canvas moved successfully");
};
