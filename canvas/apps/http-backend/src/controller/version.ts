import { SaveVersionSchema } from "@repo/common";
import { HttpError, JSONResponse } from "@repo/http-core";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
	deleteVersionService,
	getVersionService,
	getVersionsService,
	saveVersionService,
} from "../services/version.js";

export const saveVersion = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { roomId } = req.params;
	if (!roomId) {
		throw new HttpError("Canvas ID is required", StatusCodes.BAD_REQUEST);
	}

	const parsed = SaveVersionSchema.safeParse(req.body);
	if (!parsed.success) {
		throw new HttpError(
			"Validation Failed: " +
				(parsed.error.issues[0]?.message ?? "Invalid input"),
			StatusCodes.BAD_REQUEST,
		);
	}

	const { name, snapshot } = parsed.data;
	const version = await saveVersionService({
		canvasId: roomId as string,
		name,
		snapshot,
		userId: req.user.id,
	});

	return JSONResponse(res, StatusCodes.CREATED, "Version saved successfully", {
		version,
	});
};

export const getVersions = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { roomId } = req.params;
	if (!roomId) {
		throw new HttpError("Canvas ID is required", StatusCodes.BAD_REQUEST);
	}

	const versions = await getVersionsService(roomId as string);

	return JSONResponse(res, StatusCodes.OK, "Versions retrieved successfully", {
		versions,
	});
};

export const getVersion = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { versionId } = req.params;
	if (!versionId) {
		throw new HttpError("Version ID is required", StatusCodes.BAD_REQUEST);
	}

	const version = await getVersionService(versionId as string);
	if (!version) {
		throw new HttpError("Version not found", StatusCodes.NOT_FOUND);
	}

	return JSONResponse(res, StatusCodes.OK, "Version retrieved successfully", {
		version,
	});
};

export const deleteVersion = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { versionId } = req.params;
	if (!versionId) {
		throw new HttpError("Version ID is required", StatusCodes.BAD_REQUEST);
	}

	await deleteVersionService(versionId as string, req.user.id);

	return JSONResponse(res, StatusCodes.OK, "Version deleted successfully");
};
