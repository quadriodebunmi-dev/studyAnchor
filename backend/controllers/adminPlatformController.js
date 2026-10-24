import mongoose from "mongoose";
import User from "../models/User.js";
import School from "../models/School.js";
import Course from "../models/Course.js";
import Material from "../models/Material.js";
import Room from "../models/Room.js";
import RoomPost from "../models/RoomPost.js";
import RoomReport from "../models/RoomReport.js";
import RoomQuizAttempt from "../models/RoomQuizAttempt.js";
import AIUsage from "../models/AIUsage.js";
import PointTransaction from "../models/PointTransaction.js";
import StudyActivity from "../models/StudyActivity.js";
import Entitlement from "../models/Entitlement.js";
import Payment from "../models/Payment.js";
import AuditLog from "../models/AuditLog.js";
import Announcement from "../models/Announcement.js";
import PlatformSetting from "../models/PlatformSetting.js";
import { PLATFORM } from "../config/platform.js";
import { paginate } from "../utils/pagination.js";
import { audit } from "../utils/audit.js";
import bcrypt from "bcryptjs";
import { canChangeRole, validateSettingsPatch, EDITABLE_SETTINGS, validateUserEdit } from "../utils/adminGuards.js";
import { applyOverrides, refreshSettings } from "../utils/settings.js";
import { reversePoints } from "../utils/rewards.js";
import { notifyUser, notifyMany } from "../utils/notify.js";
import { purgeRoom } from "./roomController.js";
import { toObjectId } from "../utils/objectId.js";

const DAY = 24 * 3600 * 1000;
const since = (days) => new Date(Date.now() - days * DAY);
const clean = (v, n) => String(v ?? "").trim().slice(0, n);

// GET /api/admin/metrics
// "Active user" = someone who made an authenticated request in the window
// (User.lastActiveAt, refreshed at most hourly). Cheap counts only — no full scans into memory.
export async function metrics(req, res, next) {
  try {
    const d7 = since(7), d30 = since(30);
    const [
      users, students, reps, admins, independent, suspended, newUsers7, active7, active30,
      schools, courses, materialsByStatus, rooms, activeRooms, publicRooms, posts7,
      quizAttempts30, aiByFeature, studyDays7, pointsAwarded7, subs, paymentsByStatus, revenue,
    ] = await Promise.all([
      User.countDocuments(), User.countDocuments({ role: "student" }), User.countDocuments({ role: "rep" }), User.countDocuments({ role: "admin" }),
      User.countDocuments({ learnerType: "independent" }), User.countDocuments({ suspended: true }), User.countDocuments({ createdAt: { $gte: d7 } }),
      User.countDocuments({ lastActiveAt: { $gte: d7 } }), User.countDocuments({ lastActiveAt: { $gte: d30 } }),
      School.countDocuments(), Course.countDocuments(), Material.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Room.countDocuments(), Room.countDocuments({ lastActivityAt: { $gte: d7 } }), Room.countDocuments({ visibility: "public" }), RoomPost.countDocuments({ createdAt: { $gte: d7 } }),
      RoomQuizAttempt.countDocuments({ status: "submitted", submittedAt: { $gte: d30 } }),
      AIUsage.aggregate([{ $match: { createdAt: { $gte: d30 } } }, { $group: { _id: { f: "$feature", s: "$status" }, n: { $sum: 1 } } }]),
      StudyActivity.aggregate([{ $match: { createdAt: { $gte: d7 } } }, { $group: { _id: "$user" } }, { $count: "n" }]),
      PointTransaction.aggregate([{ $match: { createdAt: { $gte: d7 }, points: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: "$points" } } }]),
      Entitlement.countDocuments({ status: "active", expiresAt: { $gt: new Date() } }),
      Payment.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Payment.aggregate([{ $match: { status: "success", paidAt: { $gte: d30 } } }, { $group: { _id: "$currency", amountMinor: { $sum: "$amountMinor" }, n: { $sum: 1 } } }]),
    ]);
    const ai = {};
    for (const r of aiByFeature) { ai[r._id.f] ||= { ok: 0, error: 0 }; ai[r._id.f][r._id.s === "ok" ? "ok" : "error"] += r.n; }
    res.json({
      users: { total: users, students, reps, admins, independent, suspended, newLast7Days: newUsers7, activeLast7Days: active7, activeLast30Days: active30 },
      content: { schools, courses, materials: Object.fromEntries(materialsByStatus.map((r) => [r._id || "unknown", r.n])) },
      rooms: { total: rooms, public: publicRooms, activeLast7Days: activeRooms, postsLast7Days: posts7, quizSubmissionsLast30Days: quizAttempts30 },
      engagement: { learnersStudiedLast7Days: studyDays7[0]?.n || 0, pointsAwardedLast7Days: pointsAwarded7[0]?.total || 0 },
      ai: { last30Days: ai },
      billing: {
        activeSubscribers: subs,
        payments: Object.fromEntries(paymentsByStatus.map((r) => [r._id, r.n])),
        revenueLast30Days: revenue.map((r) => ({ currency: r._id, amountMinor: r.amountMinor, payments: r.n })),
      },
      definitions: { active: "A signed-in user who made at least one request in the period." },
    });
  } catch (err) { next(err); }
}

// GET /api/admin/users/:id — no password hashes or reset tokens, ever
export async function userDetail(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "User not found." });
    const user = await User.findById(req.params.id).select("-password -passwordResetToken -passwordResetExpires -notificationPrefs").populate("schoolId", "name").lean();
    if (!user) return res.status(404).json({ message: "User not found." });
    const [uploads, rooms, ents, payments] = await Promise.all([
      Material.countDocuments({ uploadedBy: user._id }), Room.countDocuments({ creator: user._id }),
      Entitlement.find({ user: user._id }).sort({ expiresAt: -1 }).limit(5).lean(),
      Payment.find({ user: user._id }).sort({ createdAt: -1 }).limit(5).select("reference planSnapshot.name amountMinor currency status createdAt").lean(),
    ]);
    res.json({ user, counts: { uploads, roomsCreated: rooms }, entitlements: ents, payments });
  } catch (err) { next(err); }
}

// PUT /api/admin/users/:id — edit any user's profile details.
// Role, suspension and points keep their own guarded actions. Every change is audited
// (field names with old -> new values; passwords are never recorded).
const EDIT_FIELDS = ["name", "email", "matricNumber", "department", "level", "semester", "session", "schoolId", "learnerType", "timezone", "leaderboardVisibility", "showSchoolOnLeaderboard", "isEmailVerified", "repCourses", "repType", "repStatus", "repNote", "rejectionReason"];
export async function updateUser(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "User not found." });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const v = validateUserEdit(req.body);
    if (!v.ok) return res.status(400).json({ message: v.errors[0], errors: v.errors });
    const { patch, unset } = v;

    // Independent learners have no school, department, level, semester or session.
    if (patch.learnerType === "independent") {
      for (const k of ["schoolId", "department", "level", "semester", "session"]) { delete patch[k]; if (!unset.includes(k)) unset.push(k); }
    }
    if (patch.schoolId) {
      if (!mongoose.isValidObjectId(patch.schoolId) || !(await School.exists({ _id: patch.schoolId }))) return res.status(400).json({ message: "Select a valid school." });
    }
    if (patch.email && patch.email !== user.email && (await User.exists({ email: patch.email, _id: { $ne: user._id } }))) {
      return res.status(409).json({ message: "Another account already uses that email." });
    }
    if (patch.matricNumber && patch.matricNumber !== user.matricNumber && (await User.exists({ matricNumber: patch.matricNumber, _id: { $ne: user._id } }))) {
      return res.status(409).json({ message: "Another account already uses that matric number." });
    }

    const changes = {};
    const show = (x) => (x && typeof x === "object" ? String(x._id ?? x) : x ?? null);
    for (const [k, val] of Object.entries(patch)) {
      if (!EDIT_FIELDS.includes(k)) continue;
      if (String(show(user[k]) ?? "") !== String(val ?? "")) { changes[k] = { from: show(user[k]), to: val }; user[k] = val; }
    }
    for (const k of unset) {
      if (!EDIT_FIELDS.includes(k)) continue;
      if (user[k] !== undefined && user[k] !== null && user[k] !== "") { changes[k] = { from: show(user[k]), to: null }; user[k] = undefined; }
    }
    const passwordChanged = Boolean(v.newPassword);
    if (passwordChanged) {
      user.password = await bcrypt.hash(v.newPassword, 10);
      user.passwordResetToken = undefined; user.passwordResetExpires = undefined;
    }
    if (!Object.keys(changes).length && !passwordChanged) return res.json({ message: "Nothing to change.", changed: [] });

    await user.save();
    const fields = [...Object.keys(changes), ...(passwordChanged ? ["password"] : [])];
    audit(req, "user.edit", { targetType: "user", targetId: user._id, summary: `Edited ${user.name}: ${fields.join(", ")}`, meta: { fields, changes } });
    notifyUser(user._id, { category: "system", type: "account_edited", title: "An administrator updated your account details", body: passwordChanged ? "Your password was reset too — sign in with the new one." : "Check your profile if anything looks wrong.", link: "/profile", dedupeKey: `edit:${user._id}:${Date.now()}` });

    const fresh = await User.findById(user._id).select("-password -passwordResetToken -passwordResetExpires -notificationPrefs").populate("schoolId", "name").lean();
    res.json({ user: fresh, changed: fields });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: "That email or matric number is already in use." });
    next(err);
  }
}

// POST /api/admin/users/:id/role  { role }
export async function changeRole(req, res, next) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });
    const adminCount = await User.countDocuments({ role: "admin" });
    const check = canChangeRole({ actor: req.user, target, newRole: req.body?.role, adminCount });
    if (!check.ok) return res.status(400).json({ message: check.message });
    const from = target.role;
    target.role = req.body.role;
    // Becoming a rep still needs approval; becoming a student/admin clears any pending rep state.
    if (target.role === "rep" && !target.repStatus) target.repStatus = "pending";
    await target.save();
    audit(req, "user.role_change", { targetType: "user", targetId: target._id, summary: `${target.name}: ${from} → ${target.role}`, meta: { from, to: target.role } });
    notifyUser(target._id, { category: "system", type: "role_changed", title: "Your account role changed", body: `You are now a ${target.role}.`, link: "/", dedupeKey: `role:${target._id}:${target.role}:${Date.now()}` });
    res.json({ user: { _id: target._id, name: target.name, role: target.role, repStatus: target.repStatus } });
  } catch (err) { next(err); }
}

// GET /api/admin/audit?action=&page=
export async function listAudit(req, res, next) {
  try {
    const filter = {};
    if (req.query.action) filter.action = new RegExp(`^${String(req.query.action).replace(/[^a-z._-]/gi, "")}`);
    const { items, pagination } = await paginate(AuditLog, filter, req.query, { populate: [["actor", "name"]], defaultLimit: 30, lean: true });
    res.json({ entries: items, pagination });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Moderation: room reports, rooms
// ---------------------------------------------------------------------------

// GET /api/admin/room-reports?status=open
export async function listRoomReports(req, res, next) {
  try {
    const filter = { status: ["open", "resolved", "dismissed"].includes(req.query.status) ? req.query.status : "open" };
    const { items, pagination } = await paginate(RoomReport, filter, req.query, {
      populate: [["room", "name visibility"], ["post", "content author removedAt"], ["reportedBy", "name"]], defaultLimit: 15, lean: true,
    });
    res.json({ reports: items.map((r) => ({ _id: r._id, reason: r.reason, status: r.status, createdAt: r.createdAt, room: r.room, reportedBy: r.reportedBy?.name, post: r.post ? { _id: r.post._id, content: r.post.removedAt ? "[removed]" : r.post.content, author: r.post.author } : null })), pagination });
  } catch (err) { next(err); }
}

// POST /api/admin/room-reports/:id/resolve  { action: "remove" | "dismiss" }
export async function resolveRoomReport(req, res, next) {
  try {
    const report = await RoomReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });
    const action = req.body?.action === "remove" ? "remove" : "dismiss";
    if (action === "remove") {
      await RoomPost.updateOne({ _id: report.post, removedAt: { $exists: false } }, { $set: { removedAt: new Date(), removedBy: req.user._id, removalReason: "Removed by an administrator", content: "[removed]" } });
      await RoomReport.updateMany({ post: report.post, status: "open" }, { $set: { status: "resolved", resolvedBy: req.user._id, resolvedAt: new Date() } });
    } else {
      report.status = "dismissed"; report.resolvedBy = req.user._id; report.resolvedAt = new Date();
      await report.save();
    }
    audit(req, `room_report.${action}`, { targetType: "room_report", targetId: report._id, summary: action === "remove" ? "Removed a reported message" : "Dismissed a message report" });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// GET /api/admin/rooms?search=
export async function listRooms(req, res, next) {
  try {
    const search = clean(req.query.search, 60);
    const filter = search ? { name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } : {};
    const { items, pagination } = await paginate(Room, filter, req.query, { sort: { lastActivityAt: -1 }, populate: [["creator", "name"]], defaultLimit: 15, lean: true });
    res.json({ rooms: items.map((r) => ({ _id: r._id, name: r.name, visibility: r.visibility, memberCount: r.memberCount, creator: r.creator?.name, lastActivityAt: r.lastActivityAt, createdAt: r.createdAt })), pagination });
  } catch (err) { next(err); }
}

// DELETE /api/admin/rooms/:id
export async function adminDeleteRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id).select("name");
    if (!room) return res.status(404).json({ message: "Room not found." });
    await purgeRoom(room._id);
    audit(req, "room.delete", { targetType: "room", targetId: room._id, summary: `Deleted room "${room.name}"` });
    res.json({ message: "Room deleted." });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Points investigation
// ---------------------------------------------------------------------------

// GET /api/admin/points/top?hours=24 — who earned the most recently (a starting point for spotting abuse)
export async function topEarners(req, res, next) {
  try {
    const hours = Math.min(24 * 30, Math.max(1, parseInt(req.query.hours, 10) || 24));
    const rows = await PointTransaction.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - hours * 3600 * 1000) }, points: { $gt: 0 } } },
      { $group: { _id: "$user", points: { $sum: "$points" }, awards: { $sum: 1 } } },
      { $sort: { points: -1 } }, { $limit: 25 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } }, { $unwind: "$u" },
      { $project: { points: 1, awards: 1, name: "$u.name", email: "$u.email", suspended: "$u.suspended" } },
    ]);
    res.json({ hours, entries: rows });
  } catch (err) { next(err); }
}

// GET /api/admin/users/:id/points
export async function userPoints(req, res, next) {
  try {
    const { items, pagination } = await paginate(PointTransaction, { user: toObjectId(req.params.id) }, req.query, { defaultLimit: 25, lean: true, select: "points reason sourceType key createdAt" });
    res.json({ transactions: items, pagination });
  } catch (err) { next(err); }
}

// POST /api/admin/points/reverse  { key, reason }
export async function reverse(req, res, next) {
  try {
    const key = clean(req.body?.key, 200);
    const reason = clean(req.body?.reason, 160);
    if (!key || reason.length < 3) return res.status(400).json({ message: "Give the transaction and a reason." });
    const r = await reversePoints({ key, reason, actorId: req.user._id });
    if (!r.reversed) return res.status(409).json({ message: r.message });
    const tx = await PointTransaction.findOne({ key });
    audit(req, "points.reverse", { targetType: "user", targetId: tx?.user, summary: `Reversed ${-r.points} points`, meta: { key, reason } });
    if (tx) notifyUser(tx.user, { category: "achievements", type: "points_reversed", title: "Some points were removed", body: reason, link: "/progress", dedupeKey: `reversal:${key}` });
    res.json({ ok: true, points: r.points });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

const AUDIENCES = ["all", "students", "reps", "independent", "school"];

export function audienceFilter(a) {
  const base = { suspended: { $ne: true }, role: { $ne: "admin" } };
  switch (a.audience) {
    case "students": return { ...base, role: "student" };
    case "reps": return { ...base, role: "rep" };
    case "independent": return { ...base, learnerType: "independent" };
    case "school": return { ...base, schoolId: a.schoolId };
    default: return base;
  }
}

export async function listAnnouncements(req, res, next) {
  try {
    const { items, pagination } = await paginate(Announcement, {}, req.query, { populate: [["createdBy", "name"]], defaultLimit: 15, lean: true });
    res.json({ announcements: items, pagination });
  } catch (err) { next(err); }
}

function readAnnouncement(b) {
  const errors = [];
  const title = clean(b?.title, 120), body = clean(b?.body, 1500);
  if (title.length < 3) errors.push("Give the announcement a title.");
  if (body.length < 3) errors.push("Write the announcement.");
  const audience = AUDIENCES.includes(b?.audience) ? b.audience : "all";
  let schoolId;
  if (audience === "school") { if (!mongoose.isValidObjectId(b?.schoolId)) errors.push("Choose a school."); else schoolId = b.schoolId; }
  let expiresAt;
  if (b?.expiresAt) { expiresAt = new Date(b.expiresAt); if (Number.isNaN(expiresAt.getTime())) errors.push("Expiry date isn't valid."); }
  return { errors, value: { title, body, audience, schoolId, expiresAt } };
}

export async function createAnnouncement(req, res, next) {
  try {
    const { errors, value } = readAnnouncement(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const a = await Announcement.create({ ...value, createdBy: req.user._id });
    audit(req, "announcement.create", { targetType: "announcement", targetId: a._id, summary: a.title });
    res.status(201).json({ announcement: a });
  } catch (err) { next(err); }
}

export async function updateAnnouncement(req, res, next) {
  try {
    const a = await Announcement.findById(req.params.id);
    if (!a) return res.status(404).json({ message: "Announcement not found." });
    if (a.status !== "draft") return res.status(409).json({ message: "Published announcements can't be edited. Archive it and write a new one." });
    const { errors, value } = readAnnouncement({ ...a.toObject(), ...req.body });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    Object.assign(a, value);
    await a.save();
    res.json({ announcement: a });
  } catch (err) { next(err); }
}

// POST /api/admin/announcements/:id/publish — sends the notification exactly once
export async function publishAnnouncement(req, res, next) {
  try {
    const a = await Announcement.findOneAndUpdate({ _id: req.params.id, status: "draft" }, { $set: { status: "published", publishedAt: new Date() } }, { new: true });
    if (!a) return res.status(409).json({ message: "That announcement isn't a draft." });
    const ids = (await User.find(audienceFilter(a)).select("_id").lean()).map((u) => u._id);
    const sent = await notifyMany(ids, {
      category: "announcements", type: "announcement", title: a.title, body: a.body.slice(0, 380), link: "/notifications", dedupeKey: `announcement:${a._id}`,
    });
    await Announcement.updateOne({ _id: a._id }, { $set: { notifiedCount: sent } });
    audit(req, "announcement.publish", { targetType: "announcement", targetId: a._id, summary: a.title, meta: { audience: a.audience, recipients: ids.length } });
    res.json({ announcement: { ...a.toObject(), notifiedCount: sent }, recipients: ids.length });
  } catch (err) { next(err); }
}

export async function archiveAnnouncement(req, res, next) {
  try {
    const a = await Announcement.findByIdAndUpdate(req.params.id, { $set: { status: "archived" } }, { new: true });
    if (!a) return res.status(404).json({ message: "Announcement not found." });
    audit(req, "announcement.archive", { targetType: "announcement", targetId: a._id, summary: a.title });
    res.json({ announcement: a });
  } catch (err) { next(err); }
}

// GET /api/announcements/active — for the in-app banner (any signed-in user)
export async function activeAnnouncements(req, res, next) {
  try {
    const u = req.user;
    const now = new Date();
    const rows = await Announcement.find({ status: "published", $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] }).sort({ publishedAt: -1 }).limit(10).lean();
    const mine = rows.filter((a) => a.audience === "all" || (a.audience === "students" && u.role === "student") || (a.audience === "reps" && u.role === "rep")
      || (a.audience === "independent" && u.learnerType === "independent") || (a.audience === "school" && u.schoolId && String(u.schoolId) === String(a.schoolId)));
    res.json({ announcements: mine.slice(0, 3).map((a) => ({ _id: a._id, title: a.title, body: a.body, publishedAt: a.publishedAt })) });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Runtime settings (whitelisted, bounded)
// ---------------------------------------------------------------------------

const readable = () => Object.fromEntries(EDITABLE_SETTINGS.map((k) => [k, k.split(".").reduce((o, p) => o?.[p], PLATFORM)]));

export async function getSettings(req, res, next) {
  try {
    await refreshSettings(true);
    res.json({ settings: readable(), editable: EDITABLE_SETTINGS });
  } catch (err) { next(err); }
}

// PUT /api/admin/settings  { rewards: { goalCompleted: 20 }, ... }
export async function updateSettings(req, res, next) {
  try {
    const v = validateSettingsPatch(req.body);
    if (!v.ok) return res.status(400).json({ message: v.errors[0], errors: v.errors });
    const doc = await PlatformSetting.findOne({ key: "overrides" });
    const merged = { ...(doc?.value || {}), ...v.flat };
    await PlatformSetting.findOneAndUpdate({ key: "overrides" }, { $set: { value: merged, updatedBy: req.user._id } }, { upsert: true });
    applyOverrides(v.flat);
    audit(req, "settings.update", { targetType: "settings", summary: `Changed ${Object.keys(v.flat).join(", ")}`, meta: v.flat });
    res.json({ settings: readable() });
  } catch (err) { next(err); }
}
