import { HttpError } from "@repo/http-core";
import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export const globalErrorHandler = (
	err: Error,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	console.error(err);

	if (err instanceof HttpError) {
		res.status(err.statusCode).json({
			success: false,
			message: err.message,
		});
		return;
	}

	res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
		success: false,
		message: "Internal Server Error",
	});
};
