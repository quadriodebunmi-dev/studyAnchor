import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter } from "../middleware/rateLimitMiddleware.js";
import { listNotifications, unreadCount, markRead, markAllRead, getPreferences, updatePreferences } from "../controllers/notificationController.js";

const router = express.Router();
router.use(authMiddleware, userLimiter);

router.get("/", listNotifications);
router.get("/unread-count", unreadCount);
router.get("/preferences", getPreferences);
router.put("/preferences", updatePreferences);
router.post("/read-all", markAllRead);
router.post("/:id/read", markRead);

export default router;
