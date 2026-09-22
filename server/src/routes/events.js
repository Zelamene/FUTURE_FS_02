import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../utils/errors.js";
import {
  addConnection,
  removeConnection,
  getConnectionCount,
  MAX_CONNECTIONS,
} from "../realtime/broadcaster.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (getConnectionCount() >= MAX_CONNECTIONS) {
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests, please try again later",
        },
      });
    }

    res.set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(": connected\n\n");

    addConnection(res);

    req.on("close", () => {
      removeConnection(res);
    });
  })
);

export default router;
