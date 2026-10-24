import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, roomWriteLimiter } from "../middleware/rateLimitMiddleware.js";
import { listPlans, myBilling, checkout, verifyPayment, webhook } from "../controllers/billingController.js";

const router = express.Router();

// Paystack -> us. No login; authenticated by the HMAC signature over the raw body
// (server.js keeps `req.rawBody` for this path).
router.post("/webhook", webhook);

router.use(authMiddleware, userLimiter);
router.get("/plans", listPlans);
router.get("/me", myBilling);
router.post("/checkout", roomWriteLimiter, checkout);
router.get("/verify/:reference", verifyPayment);

export default router;
