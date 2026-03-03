import type { Router as RouterType } from "express";
import { Router } from "express";
import { authRouter } from "./auth";
import { canvasRouter } from "./canvas";
import { folderRouter } from "./folder";
import { versionRouter } from "./version";

export const router: RouterType = Router();

router.use("/auth", authRouter);
router.use("/canvas", canvasRouter);
router.use("/folder", folderRouter);
// Version routes are nested: /api/v1/canvas/:roomId/versions
router.use("/canvas/:roomId/versions", versionRouter);
