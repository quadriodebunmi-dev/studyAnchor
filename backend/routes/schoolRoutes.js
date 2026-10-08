import express from "express";
import {
  searchSchools, requestSchool, getSchoolStructure,
  listSchoolsAdmin, verifySchool, updateSchool, deleteSchool,
} from "../controllers/schoolController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import { schoolRequestLimiter, searchLimiter, userLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// Public — needed at signup, before a session exists.
router.get("/", searchLimiter, searchSchools);
router.post("/", schoolRequestLimiter, requestSchool);

// Admin — manage/verify schools (surfaced on the new Admin > Schools page).
router.get("/admin", authMiddleware, adminMiddleware, userLimiter, listSchoolsAdmin);
router.post("/:id/verify", authMiddleware, adminMiddleware, verifySchool);
router.put("/:id", authMiddleware, adminMiddleware, updateSchool);
router.delete("/:id", authMiddleware, adminMiddleware, deleteSchool);

router.get("/:id/structure", getSchoolStructure);

export default router;
