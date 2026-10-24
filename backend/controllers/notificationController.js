import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { NOTIFICATION_CATEGORIES, ALWAYS_ON } from "../utils/notify.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";

// GET /api/notifications?page=&unread=true
export async function listNotifications(req, res, next) {
  try {
    const { page, limit, skip } = parsePageParams(req.query, { defaultLimit: 20, maxLimit: 50 });
    const filter = { user: req.user._id };
    if (req.query.unread === "true") filter.readAt = { $exists: false };
    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).select("-dedupeKey -data").lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, readAt: { $exists: false } }),
    ]);
    res.json({ notifications: items, unread, pagination: pageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

// GET /api/notifications/unread-count — cheap; polled when sockets aren't available
export async function unreadCount(req, res, next) {
  try {
    res.json({ unread: await Notification.countDocuments({ user: req.user._id, readAt: { $exists: false } }) });
  } catch (err) { next(err); }
}

// POST /api/notifications/:id/read
export async function markRead(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Notification not found." });
    // Scoped to the caller, so one user can never touch another's notifications.
    await Notification.updateOne({ _id: req.params.id, user: req.user._id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// POST /api/notifications/read-all
export async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany({ user: req.user._id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// GET /api/notifications/preferences
export async function getPreferences(req, res, next) {
  try {
    const stored = req.user.notificationPrefs || new Map();
    const prefs = Object.entries(NOTIFICATION_CATEGORIES).map(([key, label]) => ({
      key, label, locked: ALWAYS_ON.has(key), enabled: ALWAYS_ON.has(key) ? true : stored.get?.(key) !== false,
    }));
    res.json({ preferences: prefs });
  } catch (err) { next(err); }
}

// PUT /api/notifications/preferences  body: { rooms: false, ... }
export async function updatePreferences(req, res, next) {
  try {
    const set = {};
    for (const [key, value] of Object.entries(req.body || {})) {
      if (!(key in NOTIFICATION_CATEGORIES) || ALWAYS_ON.has(key) || typeof value !== "boolean") continue;
      set[`notificationPrefs.${key}`] = value;
    }
    if (Object.keys(set).length) await User.updateOne({ _id: req.user._id }, { $set: set });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
