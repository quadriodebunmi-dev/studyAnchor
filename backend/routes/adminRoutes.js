import express from "express";
import {
  listPendingReps, approveRep, rejectRep, listUsers, toggleSuspendUser,
  listAllMaterials, removeMaterial, listPendingMaterials, listReports, resolveReport,
  getActivityLog, getPlatformAnalytics,
} from "../controllers/adminController.js";
import { approveMaterial, rejectMaterial } from "../controllers/materialController.js";
import {
  metrics, userDetail, updateUser, changeRole, listAudit, listRoomReports, resolveRoomReport, listRooms, adminDeleteRoom,
  topEarners, userPoints, reverse, listAnnouncements, createAnnouncement, updateAnnouncement, publishAnnouncement, archiveAnnouncement,
  getSettings, updateSettings,
} from "../controllers/adminPlatformController.js";
import {
  getSubscriptionConfig, updateSubscriptionConfig, listPayments, paymentSummary, revokeEntitlement,
} from "../controllers/adminBillingController.js";
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

// Phase H — platform administration
router.get("/metrics", metrics);
router.get("/users/:id", userDetail);
router.put("/users/:id", updateUser);
router.post("/users/:id/role", changeRole);
router.get("/users/:id/points", userPoints);
router.get("/audit", listAudit);
router.get("/room-reports", listRoomReports);
router.post("/room-reports/:id/resolve", resolveRoomReport);
router.get("/rooms", listRooms);
router.delete("/rooms/:id", adminDeleteRoom);
router.get("/points/top", topEarners);
router.post("/points/reverse", reverse);
router.get("/announcements", listAnnouncements);
router.post("/announcements", createAnnouncement);
router.put("/announcements/:id", updateAnnouncement);
router.post("/announcements/:id/publish", publishAnnouncement);
router.post("/announcements/:id/archive", archiveAnnouncement);
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

// Phase I — subscriptions & payments
router.get("/subscriptions", getSubscriptionConfig);
router.put("/subscriptions", updateSubscriptionConfig);
router.get("/payments", listPayments);
router.get("/payments/summary", paymentSummary);
router.post("/entitlements/:id/revoke", revokeEntitlement);

export default router;
