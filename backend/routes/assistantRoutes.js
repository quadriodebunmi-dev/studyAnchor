import express from "express";
import { chat, chatStream } from "../controllers/assistantController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, chatLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();
router.post("/chat", authMiddleware, userLimiter, chatLimiter, chat);
router.post("/chat/stream", authMiddleware, userLimiter, chatLimiter, chatStream);
export default router;
