import express from "express";
import {
  uploadMaterial, getMaterial, updateMaterial, deleteMaterial,
  downloadMaterial, downloadAllMaterials, toggleBookmark, myBookmarks, myMaterials, myUploads,
  searchMaterials, reportMaterial, pendingMaterials, approveMaterial, rejectMaterial,
} from "../controllers/materialController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { repApprovedMiddleware } from "../middleware/repApprovedMiddleware.js";
import { userLimiter, uploadLimiter, searchLimiter, downloadLimiter, zipLimiter, reportLimiter } from "../middleware/rateLimitMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();
router.use(authMiddleware, userLimiter);

// Stage 2.2 — students can upload too (forced into "pending" status server
// side), and active Course Reps can upload directly (auto-"approved").
// This replaces the old repApprovedMiddleware gate, which blocked students
// outright.
function studentOrRep(req, res, next) {
  if (req.user.role === "student") return next();
  if (req.user.role === "rep" && req.user.repStatus === "active") return next();
  return res.status(403).json({ message: "You must be a student or an approved Course Rep to upload." });
}

router.get("/search", searchLimiter, searchMaterials);
router.get("/bookmarks/mine", myBookmarks);
router.get("/mine", repApprovedMiddleware, myMaterials);
// Stage 2.2 — a student's own uploads (any status), for "My uploads".
router.get("/mine/student", myUploads);

// Stage 2.2 — rep-only pending queue + approve/reject actions.
router.get("/pending", repApprovedMiddleware, pendingMaterials);
router.post("/:id/approve", repApprovedMiddleware, approveMaterial);
router.post("/:id/reject", repApprovedMiddleware, rejectMaterial);

router.post("/download-all", zipLimiter, downloadAllMaterials);

// Stage 2.1 — multi-file upload (up to 10 files per request).
router.post("/", studentOrRep, uploadLimiter, upload.array("files", 10), uploadMaterial);

router.get("/:id", getMaterial);
// Owners (students included — e.g. deleting their own private upload) and admins;
// the controller enforces ownership.
router.put("/:id", updateMaterial);
router.delete("/:id", deleteMaterial);
router.post("/:id/download", downloadLimiter, downloadMaterial);
router.post("/:id/bookmark", toggleBookmark);
router.post("/:id/report", reportLimiter, reportMaterial);

export default router;
