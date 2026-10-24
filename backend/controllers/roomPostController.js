import mongoose from "mongoose";
import Room from "../models/Room.js";
import RoomPost from "../models/RoomPost.js";
import RoomReport from "../models/RoomReport.js";
import RoomMember from "../models/RoomMember.js";
import { PLATFORM } from "../config/platform.js";
import { can } from "../utils/roomPermissions.js";
import { emitToRoom } from "../utils/realtime.js";
import { notifyUser, notifyUsers } from "../utils/notify.js";
import { onRoomPost } from "../utils/rewardHooks.js";
import { validateChatAttachment } from "../utils/uploadValidation.js";
import { uploadChatMedia, deleteChatMedia } from "../utils/cloudinaryUpload.js";

const idStr = (v) => String(v?._id ?? v ?? "");
// Plain text only; control characters are stripped. The UI renders it as text, never HTML.
const sanitize = (v) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

function postView(p, viewerId, membership) {
  const removed = Boolean(p.removedAt);
  return {
    _id: p._id,
    room: p.room,
    parent: p.parent || null,
    author: p.author?.name ? { _id: p.author._id, name: p.author.name } : { _id: idStr(p.author), name: "Member" },
    content: removed ? "" : p.content,
    attachment: !removed && p.attachment?.url
      ? {
          kind: p.attachment.kind, url: p.attachment.url, mime: p.attachment.mime,
          bytes: p.attachment.bytes, width: p.attachment.width, height: p.attachment.height,
          durationSec: p.attachment.durationSec,
        }
      : null,
    removed,
    removalReason: removed && can.moderate(membership) ? p.removalReason : undefined,
    replyCount: p.replyCount || 0,
    editedAt: p.editedAt || null,
    createdAt: p.createdAt,
    mine: idStr(p.author) === idStr(viewerId),
  };
}

// GET /api/rooms/:roomId/posts?before=<postId>&limit=
export async function listPosts(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { room: req.room._id, parent: null };
    if (mongoose.isValidObjectId(req.query.before)) filter._id = { $lt: req.query.before };
    const rows = await RoomPost.find(filter).sort({ _id: -1 }).limit(limit + 1).populate("author", "name");
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    res.json({
      posts: page.map((p) => postView(p, req.user._id, req.membership)),
      hasMore,
      nextBefore: hasMore ? idStr(page[page.length - 1]._id) : null,
    });
  } catch (err) { next(err); }
}

// GET /api/rooms/:roomId/posts/:postId/replies?after=<postId>
export async function listReplies(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.postId)) return res.status(404).json({ message: "Post not found." });
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = { room: req.room._id, parent: req.params.postId };
    if (mongoose.isValidObjectId(req.query.after)) filter._id = { $gt: req.query.after };
    const rows = await RoomPost.find(filter).sort({ _id: 1 }).limit(limit + 1).populate("author", "name");
    const hasMore = rows.length > limit;
    res.json({ replies: rows.slice(0, limit).map((p) => postView(p, req.user._id, req.membership)), hasMore });
  } catch (err) { next(err); }
}

const attachmentLabel = (a) => (a?.kind === "audio" ? "🎤 Voice message" : a?.kind === "image" ? "📷 Photo" : "");

// POST /api/rooms/:roomId/posts
//   JSON:      { content, parent? }
//   multipart: content?, parent?, file (one photo OR one sound)
export async function createPost(req, res, next) {
  let uploaded = null;
  try {
    const content = sanitize(req.body?.content);
    const file = req.file || null;
    if (!content && !file) return res.status(400).json({ message: "Write something or attach a photo or sound." });
    if (content.length > PLATFORM.rooms.postMaxChars) {
      return res.status(400).json({ message: `Messages can be up to ${PLATFORM.rooms.postMaxChars} characters.` });
    }

    let parent = null;
    if (req.body?.parent) {
      if (!mongoose.isValidObjectId(req.body.parent)) return res.status(400).json({ message: "Invalid reply target." });
      parent = await RoomPost.findOne({ _id: req.body.parent, room: req.room._id });
      if (!parent || parent.removedAt) return res.status(404).json({ message: "That message is no longer available." });
      if (parent.parent) return res.status(400).json({ message: "Replies go on the original message." });
    }

    // Validate by the file's real bytes (never the client's mimetype), then store it.
    let attachment;
    if (file) {
      const check = validateChatAttachment(file, PLATFORM.rooms.attachmentMaxBytes);
      if (!check.ok) return res.status(400).json({ message: check.message });
      try {
        uploaded = await uploadChatMedia(file.buffer, { roomId: idStr(req.room._id), kind: check.attachmentKind });
      } catch (err) {
        console.error("Chat media upload failed:", err.message);
        return res.status(502).json({ message: "Couldn't upload that file. Please try again." });
      }
      const dur = Number(uploaded.duration ?? req.body?.durationSec);
      attachment = {
        kind: check.attachmentKind,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        mime: check.mime,
        bytes: uploaded.bytes || file.size,
        width: uploaded.width || undefined,
        height: uploaded.height || undefined,
        durationSec: Number.isFinite(dur) && dur > 0 ? Math.min(Math.round(dur), 600) : undefined,
      };
    }

    const post = await RoomPost.create({ room: req.room._id, author: req.user._id, parent: parent?._id || null, content, ...(attachment ? { attachment } : {}) });
    const ops = [Room.updateOne({ _id: req.room._id }, { $set: { lastActivityAt: new Date() } })];
    if (parent) ops.push(RoomPost.updateOne({ _id: parent._id }, { $inc: { replyCount: 1 } }));
    await Promise.all(ops);

    // Don't assign onto the document (the path is an ObjectId and would be re-cast, losing the name).
    const view = postView({ ...post.toObject(), author: { _id: req.user._id, name: req.user.name } }, req.user._id, req.membership);
    // Other members get the same shape minus the "mine" flag, which each client recomputes.
    emitToRoom(idStr(req.room._id), "post:new", { post: { ...view, mine: false } });

    onRoomPost({ userId: req.user._id, postId: post._id, length: content.length });
    if (parent && idStr(parent.author) !== idStr(req.user._id)) {
      notifyUser(parent.author, {
        category: "rooms", type: "room_reply",
        title: `${req.user.name} replied to you in ${req.room.name}`, body: (content || attachmentLabel(attachment)).slice(0, 120),
        link: `/rooms/${req.room._id}`, dedupeKey: `reply:${post._id}`,
      });
    }
    res.status(201).json({ post: view });
  } catch (err) {
    // Don't leave an orphaned upload behind if saving the message failed.
    if (uploaded?.public_id) deleteChatMedia(uploaded.public_id, uploaded.resourceType === "video" ? "audio" : "image");
    next(err);
  }
}

// PUT /api/rooms/:roomId/posts/:postId  (author only)
export async function editPost(req, res, next) {
  try {
    const content = sanitize(req.body?.content);
    if (content.length > PLATFORM.rooms.postMaxChars) return res.status(400).json({ message: "Enter a message up to " + PLATFORM.rooms.postMaxChars + " characters." });
    const post = await RoomPost.findOne({ _id: req.params.postId, room: req.room._id }).populate("author", "name");
    if (!post || post.removedAt) return res.status(404).json({ message: "Message not found." });
    if (!content && !post.attachment?.url) return res.status(400).json({ message: "Enter a message up to " + PLATFORM.rooms.postMaxChars + " characters." });
    if (idStr(post.author) !== idStr(req.user._id)) return res.status(403).json({ message: "You can only edit your own messages." });
    post.content = content;
    post.editedAt = new Date();
    await post.save();
    const view = postView(post, req.user._id, req.membership);
    emitToRoom(idStr(req.room._id), "post:edited", { post: { ...view, mine: false } });
    res.json({ post: view });
  } catch (err) { next(err); }
}

// DELETE /api/rooms/:roomId/posts/:postId  (author, or owner/moderator)
export async function removePost(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.postId)) return res.status(404).json({ message: "Message not found." });
    const post = await RoomPost.findOne({ _id: req.params.postId, room: req.room._id });
    if (!post) return res.status(404).json({ message: "Message not found." });
    const isAuthor = idStr(post.author) === idStr(req.user._id);
    if (!isAuthor && !can.moderate(req.membership)) return res.status(403).json({ message: "You can't remove this message." });
    if (!post.removedAt) {
      post.removedAt = new Date();
      post.removedBy = req.user._id;
      post.removalReason = isAuthor ? "Deleted by author" : "Removed by a moderator";
      post.content = "[removed]"; // the original text is not kept
      const media = post.attachment?.url ? { id: post.attachment.publicId, kind: post.attachment.kind } : null;
      post.attachment = undefined; // the photo/sound is not kept either
      await post.save();
      if (media) deleteChatMedia(media.id, media.kind); // best effort, don't block the response
      if (post.parent) await RoomPost.updateOne({ _id: post.parent, replyCount: { $gt: 0 } }, { $inc: { replyCount: -1 } });
      await RoomReport.updateMany({ post: post._id, status: "open" }, { $set: { status: "resolved", resolvedBy: req.user._id, resolvedAt: new Date() } });
    }
    emitToRoom(idStr(req.room._id), "post:removed", { postId: post._id, parent: post.parent });
    res.json({ message: "Message removed." });
  } catch (err) { next(err); }
}

// POST /api/rooms/:roomId/posts/:postId/report  body: { reason }
export async function reportPost(req, res, next) {
  try {
    const reason = sanitize(req.body?.reason).slice(0, 300);
    if (reason.length < 3) return res.status(400).json({ message: "Tell us briefly what's wrong." });
    const post = await RoomPost.findOne({ _id: req.params.postId, room: req.room._id });
    if (!post || post.removedAt) return res.status(404).json({ message: "Message not found." });
    if (idStr(post.author) === idStr(req.user._id)) return res.status(400).json({ message: "You can't report your own message." });
    try {
      await RoomReport.create({ room: req.room._id, post: post._id, reportedBy: req.user._id, reason });
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ message: "You've already reported this message." });
      throw err;
    }
    const mods = await RoomMember.find({ room: req.room._id, status: "active", role: { $in: ["owner", "moderator"] } }).select("user");
    notifyUsers(mods.map((m) => m.user), {
      category: "rooms", type: "room_post_reported", title: `A message was reported in ${req.room.name}`,
      link: `/rooms/${req.room._id}?tab=moderation`, dedupeKey: `postreport:${post._id}`,
    });
    res.status(201).json({ message: "Thanks — a moderator will take a look." });
  } catch (err) { next(err); }
}

// GET /api/rooms/:roomId/reports  (owner / moderator)
export async function listReports(req, res, next) {
  try {
    const rows = await RoomReport.find({ room: req.room._id, status: "open" }).sort({ createdAt: -1 }).limit(50).populate("post", "content author removedAt attachment").populate("reportedBy", "name");
    res.json({
      reports: rows.filter((r) => r.post && !r.post.removedAt).map((r) => ({
        _id: r._id, reason: r.reason, createdAt: r.createdAt, reportedBy: r.reportedBy?.name || "A member",
        post: { _id: r.post._id, content: r.post.content, attachment: r.post.attachment?.url ? { kind: r.post.attachment.kind, url: r.post.attachment.url } : null },
      })),
    });
  } catch (err) { next(err); }
}

// POST /api/rooms/:roomId/reports/:reportId/dismiss  (owner / moderator)
export async function dismissReport(req, res, next) {
  try {
    const report = await RoomReport.findOneAndUpdate(
      { _id: req.params.reportId, room: req.room._id, status: "open" },
      { $set: { status: "dismissed", resolvedBy: req.user._id, resolvedAt: new Date() } }
    );
    if (!report) return res.status(404).json({ message: "Report not found." });
    res.json({ message: "Report dismissed." });
  } catch (err) { next(err); }
}
