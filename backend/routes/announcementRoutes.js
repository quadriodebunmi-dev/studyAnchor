import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter } from "../middleware/rateLimitMiddleware.js";
import { activeAnnouncements } from "../controllers/adminPlatformController.js";

const router = express.Router();
router.use(authMiddleware, userLimiter);
router.get("/active", activeAnnouncements);
export default router;
