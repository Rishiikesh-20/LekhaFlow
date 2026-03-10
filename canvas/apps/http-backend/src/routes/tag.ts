import type { Router as RouterType } from "express";
import { Router } from "express";
import { createTag, deleteTag, getTags, updateTag } from "../controller/tag";
import { authMiddleware } from "../middleware/auth";

export const tagRouter: RouterType = Router();

tagRouter.get("/", authMiddleware, getTags);
tagRouter.post("/", authMiddleware, createTag);
tagRouter.put("/:tagId", authMiddleware, updateTag);
tagRouter.delete("/:tagId", authMiddleware, deleteTag);
