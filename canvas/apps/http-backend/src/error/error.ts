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

	// Use both instanceof and name check to guard against module-deduplication
	// issues in test environments where the same package may be loaded twice.
	if (err instanceof HttpError || err.name === "HttpError") {
		res.status((err as HttpError).statusCode).json({
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
