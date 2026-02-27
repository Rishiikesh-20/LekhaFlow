import "./env.js";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
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

app.use("/api/v1", router);

app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
