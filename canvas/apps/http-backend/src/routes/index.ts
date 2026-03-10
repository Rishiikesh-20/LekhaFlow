import type { Router as RouterType } from "express";
import { Router } from "express";
import { authRouter } from "./auth";
import { canvasRouter } from "./canvas";
import { folderRouter } from "./folder";
import { notificationRouter } from "./notifications";
import { rbacRouter } from "./rbac";
import { tagRouter } from "./tag";
import { trashRouter } from "./trash";
import { versionRouter } from "./version";

export const router: RouterType = Router();

router.use("/auth", authRouter);
router.use("/canvas", canvasRouter);
router.use("/folder", folderRouter);
router.use("/tag", tagRouter);
router.use("/trash", trashRouter);
router.use("/notifications", notificationRouter);
router.use("/rbac", rbacRouter);
// Version routes are nested: /api/v1/canvas/:roomId/versions
router.use("/canvas/:roomId/versions", versionRouter);
