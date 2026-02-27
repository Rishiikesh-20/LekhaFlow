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
			code: err.statusCode,
			message: err.message,
		});
		return;
	}

	res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
		code: StatusCodes.INTERNAL_SERVER_ERROR,
		message: "Internal Server Error",
	});
};
