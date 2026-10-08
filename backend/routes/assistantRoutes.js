import express from "express";
import { chat } from "../controllers/assistantController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, chatLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();
router.post("/chat", authMiddleware, userLimiter, chatLimiter, chat);
export default router;
