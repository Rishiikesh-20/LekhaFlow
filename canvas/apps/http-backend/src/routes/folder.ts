import type { Router as RouterType } from "express";
import { Router } from "express";
import {
    createFolder,
    deleteFolder,
    getFolderBreadcrumb,
    getFolderContents,
    moveCanvas,
    moveFolder,
} from "../controller/folder";
import { authMiddleware } from "../middleware/auth";

export const folderRouter: RouterType = Router();

folderRouter.post("/", authMiddleware, createFolder);
folderRouter.get("/contents", authMiddleware, getFolderContents);
folderRouter.get("/:folderId/breadcrumb", authMiddleware, getFolderBreadcrumb);
folderRouter.delete("/:folderId", authMiddleware, deleteFolder);
folderRouter.put("/:folderId/move", authMiddleware, moveFolder);
folderRouter.put("/move-canvas/:canvasId", authMiddleware, moveCanvas);
