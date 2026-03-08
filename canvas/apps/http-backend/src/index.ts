import "./env.js";
import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { globalErrorHandler } from "./error/error.js";
import { router } from "./routes/index.js";

const app = express();
const PORT = 8000;

app.use(express.json());
app.use(cors());

// Allow Private Network Access (required for Brave/Chrome fetching localhost→localhost)
app.use((_req: Request, res: Response, next: NextFunction) => {
	res.setHeader("Access-Control-Allow-Private-Network", "true");
	next();
});

// Health check endpoint (used by Docker & load balancers)
app.get("/health", (_req: Request, res: Response) => {
	res.status(200).json({
		status: "ok",
		service: "http-backend",
		timestamp: new Date().toISOString(),
	});
});

app.use("/api/v1", router);

app.use(globalErrorHandler);

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
