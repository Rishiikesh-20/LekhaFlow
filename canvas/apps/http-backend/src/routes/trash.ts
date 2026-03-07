import type { Router as RouterType } from "express";
import { Router } from "express";
import {
	getTrash,
	purgeTrashItem,
	restoreTrashItem,
} from "../controller/trash";
import { authMiddleware } from "../middleware/auth";

export const trashRouter: RouterType = Router();

trashRouter.get("/", authMiddleware, getTrash);
trashRouter.patch("/restore/:id", authMiddleware, restoreTrashItem);
trashRouter.delete("/purge/:id", authMiddleware, purgeTrashItem);
