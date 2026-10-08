import express from "express";
import {
  listPendingReps, approveRep, rejectRep, listUsers, toggleSuspendUser,
  listAllMaterials, removeMaterial, listPendingMaterials, listReports, resolveReport,
  getActivityLog, getPlatformAnalytics,
} from "../controllers/adminController.js";
import { approveMaterial, rejectMaterial } from "../controllers/materialController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import { userLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();
router.use(authMiddleware, adminMiddleware, userLimiter);

router.get("/reps/pending", listPendingReps);
router.post("/reps/:id/approve", approveRep);
router.post("/reps/:id/reject", rejectRep);
router.get("/users", listUsers);
router.post("/users/:id/suspend", toggleSuspendUser);
router.get("/materials", listAllMaterials);
router.get("/materials/pending", listPendingMaterials);
router.post("/materials/:id/approve", approveMaterial);
router.post("/materials/:id/reject", rejectMaterial);
router.delete("/materials/:id", removeMaterial);
router.get("/reports", listReports);
router.post("/reports/:id/resolve", resolveReport);
router.get("/activity-log", getActivityLog);
router.get("/analytics", getPlatformAnalytics);

export default router;
