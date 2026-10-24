import crypto from "crypto";
import mongoose from "mongoose";
import Room from "../models/Room.js";
import RoomMember from "../models/RoomMember.js";
import RoomPost from "../models/RoomPost.js";
import RoomReport from "../models/RoomReport.js";
import RoomEvent from "../models/RoomEvent.js";
import RoomQuiz from "../models/RoomQuiz.js";
import RoomQuizQuestion from "../models/RoomQuizQuestion.js";
import RoomQuizAttempt from "../models/RoomQuizAttempt.js";
import Course from "../models/Course.js";
import Material from "../models/Material.js";
import User from "../models/User.js";
import { PLATFORM } from "../config/platform.js";
import { MOOD_VALUES, can, canSeeRoom, decideJoin, canActOnMember, isActive } from "../utils/roomPermissions.js";
import { canAccessSchool, canViewMaterial } from "../utils/materialAccess.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";
import { escapeRegex } from "../utils/regex.js";
import { notifyUsers, notifyUser } from "../utils/notify.js";
import { awardRoomCreated } from "../utils/rewards.js";
import { logRoomEvent } from "../utils/roomEvents.js";
import { emitToRoom, evictFromRoom } from "../utils/realtime.js";

const idStr = (v) => String(v?._id ?? v ?? "");
const clean = (v, n) => String(v ?? "").trim().slice(0, n);
const newInviteCode = () => crypto.randomBytes(5).toString("hex");

// ---------------------------------------------------------------------------
// Serializers — the only shapes that leave the server.
// ---------------------------------------------------------------------------

function roomView(room, membership, { detailed = false } = {}) {
  const m = membership && !membership.synthetic ? membership : null;
  const privileged = can.moderate(membership);
  const out = {
    _id: room._id,
    name: room.name,
    topic: room.topic,
    description: room.description,
    mood: room.mood,
    visibility: room.visibility,
    joinPolicy: room.joinPolicy,
    audience: room.audience,
    department: room.department,
    memberCount: room.memberCount,
    lastActivityAt: room.lastActivityAt,
    createdAt: room.createdAt,
    creator: room.creator?.name ? { _id: room.creator._id, name: room.creator.name } : { _id: idStr(room.creator) },
    myStatus: m?.status ?? (membership?.synthetic ? "active" : null),
    myRole: isActive(membership) ? membership.role : null,
  };
  if (room.courseId?.code) out.course = { _id: room.courseId._id, code: room.courseId.code, title: room.courseId.title };
  else if (room.courseId) out.course = { _id: idStr(room.courseId) };
  if (detailed && room.materialId?.title && isActive(membership)) out.material = { _id: room.materialId._id, title: room.materialId.title };
  // The invite code is a bearer credential for asking in: only people who can approve requests see it.
  if (privileged && room.visibility === "private") out.inviteCode = room.inviteCode;
  return out;
}

const ROOM_POPULATE = [["creator", "name"], ["courseId", "code title"], ["materialId", "title"]];
const populateRoom = (q) => { for (const p of ROOM_POPULATE) q = q.populate(...p); return q; };

async function validateAcademicLinks(user, { courseId, materialId, department }) {
  const out = {};
  if (department) out.department = clean(department, 80);
  if (courseId) {
    if (!mongoose.isValidObjectId(courseId)) return { error: "Choose a valid course." };
    const course = await Course.findById(courseId).select("schoolId");
    if (!course) return { error: "That course doesn't exist." };
    if (!canAccessSchool(user, course.schoolId) || (user.role !== "admin" && !user.schoolId)) return { error: "You can only link a course from your own school." };
    out.courseId = course._id;
    out.schoolId = course.schoolId;
  }
  if (materialId) {
    if (!mongoose.isValidObjectId(materialId)) return { error: "Choose a valid material." };
    const material = await Material.findById(materialId).select("uploadedBy visibility status schoolId");
    if (!material || !canViewMaterial(user, material)) return { error: "You can only link a material you can access." };
    // A private material would be advertised to the whole room.
    if (material.visibility === "private") return { error: "Private materials can't be linked to a room. Share the material with your class first." };
    out.materialId = material._id;
  }
  return { value: out };
}

// ---------------------------------------------------------------------------
// Membership helpers (idempotent — safe against double-clicks and retries)
// ---------------------------------------------------------------------------

async function activateMember(room, userId, { role = "member", invitedBy } = {}) {
  try {
    const doc = await RoomMember.findOneAndUpdate(
      { room: room._id, user: userId, status: { $ne: "active" } },
      { $set: { status: "active", role, joinedAt: new Date(), ...(invitedBy ? { invitedBy } : {}) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await Room.updateOne({ _id: room._id }, { $inc: { memberCount: 1 }, $set: { lastActivityAt: new Date() } });
    return { created: true, doc };
  } catch (err) {
    if (err?.code === 11000) return { created: false }; // already active
    throw err;
  }
}

async function dropMember(room, userId, wasActive) {
  await RoomMember.deleteOne({ room: room._id, user: userId });
  if (wasActive) await Room.updateOne({ _id: room._id, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
  evictFromRoom(idStr(room._id), idStr(userId));
}

async function moderatorIds(roomId) {
  const rows = await RoomMember.find({ room: roomId, status: "active", role: { $in: ["owner", "moderator"] } }).select("user");
  return rows.map((r) => r.user);
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

// GET /api/rooms?q=&mood=&page=  — public rooms this user may discover.
export async function discoverRooms(req, res, next) {
  try {
    const user = req.user;
    const { page, limit, skip } = parsePageParams(req.query, { defaultLimit: 12, maxLimit: 40 });
    const filter = { visibility: "public", archivedAt: { $exists: false } };
    if (user.role !== "admin") {
      filter.$and = [{ $or: user.schoolId ? [{ audience: "everyone" }, { audience: "school", schoolId: user.schoolId }] : [{ audience: "everyone" }] }];
    }
    const q = clean(req.query.q, 60);
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      (filter.$and ||= []).push({ $or: [{ name: rx }, { topic: rx }, { description: rx }, { department: rx }] });
    }
    if (MOOD_VALUES.includes(req.query.mood)) filter.mood = req.query.mood;
    if (mongoose.isValidObjectId(req.query.courseId)) filter.courseId = req.query.courseId;

    // Rooms the caller is banned from never appear.
    const banned = await RoomMember.find({ user: user._id, status: "banned" }).select("room");
    if (banned.length) filter._id = { $nin: banned.map((b) => b.room) };

    const [rooms, total] = await Promise.all([
      populateRoom(Room.find(filter).sort({ lastActivityAt: -1, _id: -1 }).skip(skip).limit(limit)),
      Room.countDocuments(filter),
    ]);
    const memberships = await RoomMember.find({ user: user._id, room: { $in: rooms.map((r) => r._id) } });
    const byRoom = new Map(memberships.map((m) => [idStr(m.room), m]));
    res.json({ rooms: rooms.map((r) => roomView(r, byRoom.get(idStr(r._id)))), pagination: pageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

// GET /api/rooms/mine?filter=all|created|joined
export async function myRooms(req, res, next) {
  try {
    const { page, limit, skip } = parsePageParams(req.query, { defaultLimit: 12, maxLimit: 40 });
    const mf = { user: req.user._id, status: "active" };
    if (req.query.filter === "created") mf.role = "owner";
    else if (req.query.filter === "joined") mf.role = { $ne: "owner" };
    const [rows, total] = await Promise.all([
      RoomMember.find(mf).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit),
      RoomMember.countDocuments(mf),
    ]);
    const rooms = await populateRoom(Room.find({ _id: { $in: rows.map((r) => r.room) } }));
    const byId = new Map(rooms.map((r) => [idStr(r._id), r]));
    const items = rows.map((m) => (byId.has(idStr(m.room)) ? roomView(byId.get(idStr(m.room)), m) : null)).filter(Boolean);
    res.json({ rooms: items, pagination: pageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

// GET /api/rooms/invitations
export async function myInvitations(req, res, next) {
  try {
    const rows = await RoomMember.find({ user: req.user._id, status: "invited" }).sort({ updatedAt: -1 }).limit(50);
    const rooms = await populateRoom(Room.find({ _id: { $in: rows.map((r) => r.room) } }));
    const byId = new Map(rooms.map((r) => [idStr(r._id), r]));
    res.json({
      invitations: rows.filter((m) => byId.has(idStr(m.room))).map((m) => ({ ...roomView(byId.get(idStr(m.room)), m), invitedAt: m.updatedAt })),
    });
  } catch (err) { next(err); }
}

// POST /api/rooms
export async function createRoom(req, res, next) {
  try {
    const user = req.user;
    const name = clean(req.body.name, 80);
    if (name.length < 3) return res.status(400).json({ message: "Give the room a name (at least 3 characters)." });
    const mood = MOOD_VALUES.includes(req.body.mood) ? req.body.mood : "revision";
    const visibility = req.body.visibility === "private" ? "private" : "public";
    // Private rooms are always approval-based; public ones can be open or approval.
    const joinPolicy = visibility === "private" || req.body.joinPolicy === "approval" ? "approval" : "open";

    let audience = req.body.audience === "school" ? "school" : "everyone";
    if (audience === "school" && !user.schoolId) {
      return res.status(400).json({ message: "Only students in a school can make a school-only room." });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await Room.countDocuments({ creator: user._id, createdAt: { $gte: since } });
    if (recent >= PLATFORM.rooms.maxRoomsCreatedPerDay) {
      return res.status(429).json({ message: `You can create up to ${PLATFORM.rooms.maxRoomsCreatedPerDay} rooms a day.` });
    }

    const links = await validateAcademicLinks(user, req.body);
    if (links.error) return res.status(400).json({ message: links.error });

    const room = await Room.create({
      name, mood, visibility, joinPolicy, audience,
      topic: clean(req.body.topic, 80),
      description: clean(req.body.description, 600),
      creator: user._id,
      schoolId: audience === "school" ? user.schoolId : links.value.schoolId || user.schoolId || undefined,
      department: links.value.department || "",
      courseId: links.value.courseId,
      materialId: links.value.materialId,
      inviteCode: visibility === "private" ? newInviteCode() : undefined,
      memberCount: 1,
    });
    await RoomMember.create({ room: room._id, user: user._id, role: "owner", status: "active", joinedAt: new Date() });
    awardRoomCreated(user._id, room._id).catch(() => {});

    const full = await populateRoom(Room.findById(room._id));
    res.status(201).json({ room: roomView(full, { status: "active", role: "owner", user: user._id }, { detailed: true }) });
  } catch (err) { next(err); }
}

// GET /api/rooms/code/:code — what a private-room invite link shows before you ask to join.
export async function previewByCode(req, res, next) {
  try {
    const code = clean(req.params.code, 40);
    const room = code ? await populateRoom(Room.findOne({ inviteCode: code })) : null;
    if (!room) return res.status(404).json({ message: "That invite link isn't valid any more." });
    const membership = await RoomMember.findOne({ room: room._id, user: req.user._id });
    if (membership?.status === "banned") return res.status(404).json({ message: "That invite link isn't valid any more." });
    // Preview only: no members, posts or quizzes.
    const v = roomView(room, membership);
    delete v.inviteCode;
    res.json({ room: v });
  } catch (err) { next(err); }
}

// GET /api/rooms/:roomId
export async function getRoom(req, res, next) {
  try {
    const { room, membership, user } = { room: req.room, membership: req.membership, user: req.user };
    if (!canSeeRoom(room, user, membership)) return res.status(404).json({ message: "Room not found." });
    const full = await populateRoom(Room.findById(room._id));
    const view = roomView(full, membership, { detailed: true });
    view.canViewContent = can.viewContent(membership);
    if (can.moderate(membership)) view.pendingRequests = await RoomMember.countDocuments({ room: room._id, status: "pending" });
    res.json({ room: view });
  } catch (err) { next(err); }
}

// PUT /api/rooms/:roomId (owner)
export async function updateRoom(req, res, next) {
  try {
    const room = req.room;
    const b = req.body;
    if (b.name !== undefined) {
      const name = clean(b.name, 80);
      if (name.length < 3) return res.status(400).json({ message: "Give the room a name (at least 3 characters)." });
      room.name = name;
    }
    if (b.topic !== undefined) room.topic = clean(b.topic, 80);
    if (b.description !== undefined) room.description = clean(b.description, 600);
    if (MOOD_VALUES.includes(b.mood)) room.mood = b.mood;
    if (b.visibility === "public" || b.visibility === "private") {
      room.visibility = b.visibility;
      if (b.visibility === "private") {
        room.joinPolicy = "approval";
        if (!room.inviteCode) room.inviteCode = newInviteCode();
      }
    }
    if (room.visibility === "public" && (b.joinPolicy === "open" || b.joinPolicy === "approval")) room.joinPolicy = b.joinPolicy;
    if (b.audience === "everyone" || b.audience === "school") {
      if (b.audience === "school" && !room.schoolId && !req.user.schoolId) return res.status(400).json({ message: "A school-only room needs a school." });
      room.audience = b.audience;
      if (b.audience === "school" && !room.schoolId) room.schoolId = req.user.schoolId;
    }
    if (b.regenerateInviteCode && room.visibility === "private") room.inviteCode = newInviteCode();
    await room.save();
    logRoomEvent(room._id, "room_updated", { actor: req.user._id, text: "Room settings were updated." });
    emitToRoom(idStr(room._id), "room:updated", { _id: room._id });
    const full = await populateRoom(Room.findById(room._id));
    res.json({ room: roomView(full, req.membership, { detailed: true }) });
  } catch (err) { next(err); }
}

/** Deletes a room and everything that belongs to it. Shared by the owner's and the admin's delete. */
export async function purgeRoom(roomId) {
  emitToRoom(idStr(roomId), "room:deleted", { _id: roomId });
  const quizIds = (await RoomQuiz.find({ room: roomId }).select("_id")).map((q) => q._id);
  await Promise.all([
    RoomMember.deleteMany({ room: roomId }),
    RoomPost.deleteMany({ room: roomId }),
    RoomReport.deleteMany({ room: roomId }),
    RoomEvent.deleteMany({ room: roomId }),
    RoomQuizQuestion.deleteMany({ quiz: { $in: quizIds } }),
    RoomQuizAttempt.deleteMany({ quiz: { $in: quizIds } }),
    RoomQuiz.deleteMany({ room: roomId }),
  ]);
  await Room.deleteOne({ _id: roomId });
}

// DELETE /api/rooms/:roomId (owner)
export async function deleteRoom(req, res, next) {
  try {
    await purgeRoom(req.room._id);
    res.json({ message: "Room deleted." });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Joining, leaving, invitations, requests
// ---------------------------------------------------------------------------

// POST /api/rooms/:roomId/join   body: { inviteCode? }
export async function joinRoom(req, res, next) {
  try {
    const { room, user } = req;
    const membership = req.membership?.synthetic ? null : req.membership;
    const decision = decideJoin({
      room, user, membership,
      inviteCode: clean(req.body?.inviteCode, 40),
      memberCount: room.memberCount, maxMembers: PLATFORM.rooms.maxMembers,
    });

    switch (decision.outcome) {
      case "denied": return res.status(403).json({ message: decision.reason });
      case "already": return res.json({ status: "active", message: "You're already in this room." });
      case "pending": return res.json({ status: "pending", message: "Your request is waiting for approval." });
      case "joined":
      case "accepted": {
        const { created } = await activateMember(room, user._id);
        if (created) {
          logRoomEvent(room._id, "member_joined", { actor: user._id, subject: user._id, text: `${user.name} joined the room.` });
          emitToRoom(idStr(room._id), "member:joined", { user: { _id: user._id, name: user.name } });
        }
        return res.json({ status: "active", message: "Welcome to the room!" });
      }
      case "requested": {
        try {
          await RoomMember.findOneAndUpdate(
            { room: room._id, user: user._id },
            { $set: { status: "pending", role: "member" } },
            { upsert: true, setDefaultsOnInsert: true }
          );
        } catch (err) { if (err?.code !== 11000) throw err; }
        notifyUsers(await moderatorIds(room._id), {
          category: "rooms", type: "room_join_request",
          title: `${user.name} wants to join ${room.name}`, body: "Review the request in the room's Members tab.",
          link: `/rooms/${room._id}?tab=members`, dedupeKey: `room:${room._id}:request:${user._id}`,
        });
        return res.status(202).json({ status: "pending", message: "Request sent. You'll be notified when it's approved." });
      }
      default: return res.status(400).json({ message: "Couldn't join this room." });
    }
  } catch (err) { next(err); }
}

// POST /api/rooms/:roomId/leave  — also cancels a pending request / declines an invite.
export async function leaveRoom(req, res, next) {
  try {
    const m = req.membership?.synthetic ? null : req.membership;
    if (!m) return res.json({ message: "You're not in this room." });
    if (m.role === "owner") {
      return res.status(400).json({ message: "Room owners can't leave. Delete the room instead." });
    }
    await dropMember(req.room, req.user._id, m.status === "active");
    if (m.status === "active") {
      logRoomEvent(req.room._id, "member_left", { actor: req.user._id, text: `${req.user.name} left the room.` });
    }
    res.json({ message: "You left the room." });
  } catch (err) { next(err); }
}

// POST /api/rooms/:roomId/invitation  body: { accept: boolean }
export async function respondToInvitation(req, res, next) {
  try {
    const m = req.membership;
    if (!m || m.status !== "invited") return res.status(404).json({ message: "No invitation found." });
    if (req.body?.accept) {
      if (req.room.memberCount >= PLATFORM.rooms.maxMembers) return res.status(403).json({ message: "This room is full." });
      const { created } = await activateMember(req.room, req.user._id);
      if (created) logRoomEvent(req.room._id, "member_joined", { actor: req.user._id, subject: req.user._id, text: `${req.user.name} joined the room.` });
      return res.json({ status: "active" });
    }
    await dropMember(req.room, req.user._id, false);
    res.json({ status: "declined" });
  } catch (err) { next(err); }
}

// POST /api/rooms/:roomId/invite  body: { email }  (owner / moderator)
export async function inviteToRoom(req, res, next) {
  try {
    const email = clean(req.body?.email, 200).toLowerCase();
    if (!email) return res.status(400).json({ message: "Enter the person's email." });
    // Same answer whether or not the account exists, so this can't be used to probe who has one.
    const generic = { message: "If that person has a Study Anchor account, they've been invited." };
    const target = await User.findOne({ email, suspended: { $ne: true } }).select("name");
    if (!target || idStr(target._id) === idStr(req.user._id)) return res.json(generic);

    const existing = await RoomMember.findOne({ room: req.room._id, user: target._id });
    if (existing?.status === "banned" || existing?.status === "active") return res.json(generic);
    if (existing?.status === "pending") {
      await activateMember(req.room, target._id, { invitedBy: req.user._id });
    } else {
      try {
        await RoomMember.findOneAndUpdate(
          { room: req.room._id, user: target._id },
          { $set: { status: "invited", role: "member", invitedBy: req.user._id } },
          { upsert: true, setDefaultsOnInsert: true }
        );
      } catch (err) { if (err?.code !== 11000) throw err; }
    }
    notifyUser(target._id, {
      category: "rooms", type: "room_invitation",
      title: `${req.user.name} invited you to ${req.room.name}`, body: "Open the invitation to accept or decline.",
      link: `/rooms?tab=invitations`, dedupeKey: `room:${req.room._id}:invite:${target._id}:${Math.floor(Date.now() / 86400000)}`,
    });
    res.json(generic);
  } catch (err) { next(err); }
}

// GET /api/rooms/:roomId/requests (owner / moderator)
export async function listRequests(req, res, next) {
  try {
    const rows = await RoomMember.find({ room: req.room._id, status: "pending" }).sort({ createdAt: 1 }).limit(100).populate("user", "name department level");
    res.json({ requests: rows.filter((r) => r.user).map((r) => ({ user: { _id: r.user._id, name: r.user.name }, requestedAt: r.createdAt })) });
  } catch (err) { next(err); }
}

// POST /api/rooms/:roomId/requests/:userId/:decision  (approve | reject)
export async function decideRequest(req, res, next) {
  try {
    const { userId, decision } = req.params;
    if (!mongoose.isValidObjectId(userId) || !["approve", "reject"].includes(decision)) return res.status(400).json({ message: "Invalid request." });
    const row = await RoomMember.findOne({ room: req.room._id, user: userId, status: "pending" });
    if (!row) return res.status(404).json({ message: "That request is no longer pending." });

    if (decision === "approve") {
      if (req.room.memberCount >= PLATFORM.rooms.maxMembers) return res.status(403).json({ message: "This room is full." });
      const { created } = await activateMember(req.room, userId);
      if (created) {
        logRoomEvent(req.room._id, "member_joined", { actor: req.user._id, subject: userId, text: "A new member joined." });
        notifyUser(userId, { category: "rooms", type: "room_request_approved", title: `You're in! Welcome to ${req.room.name}`, link: `/rooms/${req.room._id}`, dedupeKey: `room:${req.room._id}:approved:${userId}` });
      }
    } else {
      await RoomMember.deleteOne({ _id: row._id });
      notifyUser(userId, { category: "rooms", type: "room_request_declined", title: `Your request to join ${req.room.name} wasn't approved`, link: `/rooms`, dedupeKey: `room:${req.room._id}:declined:${userId}:${Math.floor(Date.now() / 86400000)}` });
    }
    res.json({ message: decision === "approve" ? "Member approved." : "Request declined." });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

// GET /api/rooms/:roomId/members
export async function listMembers(req, res, next) {
  try {
    const { page, limit, skip } = parsePageParams(req.query, { defaultLimit: 50, maxLimit: 100 });
    const filter = { room: req.room._id, status: "active" };
    const [rows, total] = await Promise.all([
      RoomMember.find(filter).sort({ role: 1, joinedAt: 1, _id: 1 }).skip(skip).limit(limit).populate("user", "name avatarUrl"),
      RoomMember.countDocuments(filter),
    ]);
    const rank = { owner: 0, moderator: 1, member: 2 };
    const members = rows.filter((r) => r.user)
      .map((r) => ({ user: { _id: r.user._id, name: r.user.name, avatarUrl: r.user.avatarUrl || "" }, role: r.role, joinedAt: r.joinedAt }))
      .sort((a, b) => rank[a.role] - rank[b.role]);
    res.json({ members, pagination: pageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

// PUT /api/rooms/:roomId/members/:userId  body: { role: "moderator" | "member" }  (owner)
export async function setMemberRole(req, res, next) {
  try {
    const { userId } = req.params;
    const role = req.body?.role;
    if (!mongoose.isValidObjectId(userId) || !["moderator", "member"].includes(role)) return res.status(400).json({ message: "Choose moderator or member." });
    const target = await RoomMember.findOne({ room: req.room._id, user: userId, status: "active" });
    if (!target) return res.status(404).json({ message: "That person isn't a member." });
    if (target.role === "owner") return res.status(400).json({ message: "The owner's role can't be changed." });
    if (target.role !== role) {
      target.role = role;
      await target.save();
      logRoomEvent(req.room._id, "role_changed", { actor: req.user._id, subject: userId, text: role === "moderator" ? "A member became a moderator." : "A moderator became a member." });
      if (role === "moderator") {
        notifyUser(userId, { category: "rooms", type: "room_role_changed", title: `You're now a moderator of ${req.room.name}`, link: `/rooms/${req.room._id}`, dedupeKey: `room:${req.room._id}:mod:${userId}:${Math.floor(Date.now() / 86400000)}` });
      }
    }
    res.json({ message: "Role updated." });
  } catch (err) { next(err); }
}

// DELETE /api/rooms/:roomId/members/:userId?ban=true  (owner / moderator)
export async function removeMember(req, res, next) {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid member." });
    const target = await RoomMember.findOne({ room: req.room._id, user: userId });
    if (!target) return res.status(404).json({ message: "That person isn't in this room." });
    if (!canActOnMember(req.membership, target)) return res.status(403).json({ message: "You can't remove that person." });

    const wasActive = target.status === "active";
    if (req.query.ban === "true") {
      target.status = "banned";
      await target.save();
      if (wasActive) await Room.updateOne({ _id: req.room._id, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
      evictFromRoom(idStr(req.room._id), userId);
    } else {
      await dropMember(req.room, userId, wasActive);
    }
    if (wasActive) logRoomEvent(req.room._id, "member_removed", { actor: req.user._id, subject: userId, text: "A member was removed." });
    res.json({ message: "Member removed." });
  } catch (err) { next(err); }
}

// GET /api/rooms/:roomId/activity
export async function roomActivity(req, res, next) {
  try {
    const events = await RoomEvent.find({ room: req.room._id }).sort({ createdAt: -1 }).limit(30).select("type text createdAt").lean();
    res.json({ events });
  } catch (err) { next(err); }
}
