import type { Router as RouterType } from "express";
import { Router } from "express";
import {
	createCanvas,
	deleteCanvas,
	duplicateCanvas,
	getCanvas,
	getCanvases,
	getRecentCanvases,
	getStarredCanvases,
	searchCanvases,
	toggleArchiveCanvas,
	toggleStar,
	touchCanvasAccess,
	updateCanvas,
	updateThumbnail,
} from "../controller/canvas";
import { assignTag, getCanvasTags, unassignTag } from "../controller/tag";
import { authMiddleware } from "../middleware/auth";
export const canvasRouter: RouterType = Router();

canvasRouter.get("/", authMiddleware, getCanvases);
canvasRouter.get("/search", authMiddleware, searchCanvases);
canvasRouter.get("/recent", authMiddleware, getRecentCanvases);
canvasRouter.get("/starred", authMiddleware, getStarredCanvases);
canvasRouter.get("/:roomId", authMiddleware, getCanvas);
canvasRouter.post("/create-canvas", authMiddleware, createCanvas);
canvasRouter.put("/:roomId", authMiddleware, updateCanvas);
canvasRouter.patch("/:roomId/touch", authMiddleware, touchCanvasAccess);
canvasRouter.put("/:roomId/thumbnail", authMiddleware, updateThumbnail);
canvasRouter.patch("/:roomId/star", authMiddleware, toggleStar);
canvasRouter.patch("/:roomId/archive", authMiddleware, toggleArchiveCanvas);
canvasRouter.delete("/:roomId", authMiddleware, deleteCanvas);
canvasRouter.post("/:roomId/duplicate", authMiddleware, duplicateCanvas);

// Canvas-scoped tag routes
canvasRouter.get("/:roomId/tags", authMiddleware, getCanvasTags);
canvasRouter.post("/:roomId/tags", authMiddleware, assignTag);
canvasRouter.delete("/:roomId/tags/:tagId", authMiddleware, unassignTag);
