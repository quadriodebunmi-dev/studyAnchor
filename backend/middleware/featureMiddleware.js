import { checkEntitlement } from "../utils/entitlements.js";

// Route guard for a feature that may be paid. 403 UPGRADE_REQUIRED tells the
// client to show the plans, not an error.
export const requireFeature = (featureKey) => async (req, res, next) => {
  try {
    const ent = await checkEntitlement(req.user, featureKey);
    if (!ent.allowed) return res.status(403).json({ code: ent.code, message: ent.message, feature: featureKey });
    req.featureAccess = ent.access;
    next();
  } catch (err) { next(err); }
};
