import express from "express";
import { listEvents, upcomingEvents, createEvent, updateEvent, deleteEvent } from "../controllers/calendarController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, roomWriteLimiter } from "../middleware/rateLimitMiddleware.js";
import { trimInputs } from "../middleware/trimInputs.js";

const router = express.Router();
router.use(authMiddleware, userLimiter);

router.get("/", listEvents);
router.get("/upcoming", upcomingEvents);
router.post("/", roomWriteLimiter, trimInputs, createEvent);
router.put("/:id", roomWriteLimiter, trimInputs, updateEvent);
router.delete("/:id", roomWriteLimiter, deleteEvent);

export default router;
