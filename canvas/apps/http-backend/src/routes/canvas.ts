import type { Router as RouterType } from "express";
import { Router } from "express";
import {
	createCanvas,
	deleteCanvas,
	duplicateCanvas,
	getCanvas,
	getCanvases,
	getRecentCanvases,
	searchCanvases,
	toggleArchiveCanvas,
	touchCanvasAccess,
	updateCanvas,
	updateThumbnail,
} from "../controller/canvas";
import { authMiddleware } from "../middleware/auth";
export const canvasRouter: RouterType = Router();

canvasRouter.get("/", authMiddleware, getCanvases);
canvasRouter.get("/search", authMiddleware, searchCanvases);
canvasRouter.get("/recent", authMiddleware, getRecentCanvases);
canvasRouter.get("/:roomId", authMiddleware, getCanvas);
canvasRouter.post("/create-canvas", authMiddleware, createCanvas);
canvasRouter.put("/:roomId", authMiddleware, updateCanvas);
canvasRouter.patch("/:roomId/touch", authMiddleware, touchCanvasAccess);
canvasRouter.put("/:roomId/thumbnail", authMiddleware, updateThumbnail);
canvasRouter.delete("/:roomId", authMiddleware, deleteCanvas);
canvasRouter.post("/:roomId/duplicate", authMiddleware, duplicateCanvas);
canvasRouter.patch("/:roomId/archive", authMiddleware, toggleArchiveCanvas);
