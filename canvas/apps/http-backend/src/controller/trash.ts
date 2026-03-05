import { HttpError, JSONResponse } from "@repo/http-core";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
	getTrashService,
	purgeCanvasService,
	restoreCanvasService,
} from "../services/trash.js";

export const getTrash = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const items = await getTrashService(req.user.id);

	return JSONResponse(
		res,
		StatusCodes.OK,
		"Trash items retrieved successfully",
		{
			items,
		},
	);
};

export const restoreTrashItem = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { id } = req.params;
	if (!id || typeof id !== "string") {
		throw new HttpError("Item ID is required", StatusCodes.BAD_REQUEST);
	}

	await restoreCanvasService(id, req.user.id);

	return JSONResponse(res, StatusCodes.OK, "Item restored successfully");
};

export const purgeTrashItem = async (req: Request, res: Response) => {
	if (!req.user) {
		throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
	}

	const { id } = req.params;
	if (!id || typeof id !== "string") {
		throw new HttpError("Item ID is required", StatusCodes.BAD_REQUEST);
	}

	await purgeCanvasService(id, req.user.id);

	return JSONResponse(
		res,
		StatusCodes.OK,
		"Item permanently deleted successfully",
	);
};
