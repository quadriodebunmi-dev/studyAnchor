import express from "express";
import {
  searchDepartments, requestDepartment,
  listDepartmentsAdmin, verifyDepartment, updateDepartment, deleteDepartment,
} from "../controllers/departmentController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import { departmentRequestLimiter, searchLimiter, userLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// Public — needed at signup (before a session exists), and used again by
// signed-in students/reps picking or requesting their department on their
// profile or a course form.
router.get("/", searchLimiter, searchDepartments);
router.post("/", departmentRequestLimiter, requestDepartment);

// Admin — manage/verify departments (mirrors Admin > Schools).
router.get("/admin", authMiddleware, adminMiddleware, userLimiter, listDepartmentsAdmin);
router.post("/:id/verify", authMiddleware, adminMiddleware, verifyDepartment);
router.put("/:id", authMiddleware, adminMiddleware, updateDepartment);
router.delete("/:id", authMiddleware, adminMiddleware, deleteDepartment);

export default router;
