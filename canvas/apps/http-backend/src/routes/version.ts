import type { Router as RouterType } from "express";
import { Router } from "express";
import {
	deleteVersion,
	getVersion,
	getVersions,
	saveVersion,
} from "../controller/version.js";
import { authMiddleware } from "../middleware/auth.js";

export const versionRouter: RouterType = Router({ mergeParams: true });

versionRouter.get("/", authMiddleware, getVersions);
versionRouter.post("/", authMiddleware, saveVersion);
versionRouter.get("/:versionId", authMiddleware, getVersion);
versionRouter.delete("/:versionId", authMiddleware, deleteVersion);
