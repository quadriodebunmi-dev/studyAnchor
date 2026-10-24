import mongoose from "mongoose";
import SnapQuestion from "../models/SnapQuestion.js";
import { PLATFORM } from "../config/platform.js";
import { validateImageFile } from "../utils/uploadValidation.js";
import { readQuestionFromImage, solveQuestion } from "../utils/aiStudy.js";
import { recordAIUsage, respondToAIError } from "../utils/aiGuard.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";
import { onSnapAnswered } from "../utils/rewardHooks.js";

/* ------------------------------------------------------------------ *
 * DEBUG HELPERS
 * Turn off by setting SNAP_DEBUG=off in your .env (default is ON).
 * Remove this block and the dbg()/describeError() calls once fixed.
 * ------------------------------------------------------------------ */
const DEBUG = process.env.SNAP_DEBUG !== "off";

const dbg = (reqId, step, data) => {
  if (!DEBUG) return;
  const stamp = new Date().toISOString();
  if (data === undefined) console.log(`[snap:${reqId}] ${stamp} ${step}`);
  else console.log(`[snap:${reqId}] ${stamp} ${step}`, data);
};

// Pulls out everything useful from an SDK / axios / fetch style error.
const describeError = (err) => ({
  name: err?.name,
  message: err?.message,
  status: err?.status ?? err?.statusCode ?? err?.response?.status,
  code: err?.code,
  type: err?.type ?? err?.error?.type,
  providerBody: err?.error ?? err?.response?.data ?? err?.body,
  headers: err?.headers ?? err?.response?.headers,
  cause: err?.cause?.message ?? err?.cause,
  stack: err?.stack?.split("\n").slice(0, 6).join("\n"),
});

const newReqId = () => Math.random().toString(36).slice(2, 8);

// Step 1 — POST /api/study/snap/extract   (multipart: image)
// Reads the photo and returns the text so the learner can correct it BEFORE we
// answer. The image is processed in memory and never stored.
export async function extractQuestion(req, res, next) {
  const rid = newReqId();
  const t0 = Date.now();
  try {
    dbg(rid, "START extractQuestion", {
      userId: String(req.user?._id),
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"],
      hasFile: !!req.file,
      fileInfo: req.file && {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        sizeBytes: req.file.size,
        hasBuffer: !!req.file.buffer,
      },
      maxImageBytes: PLATFORM.ai?.maxImageBytes,
    });

    const check = validateImageFile(req.file, PLATFORM.ai.maxImageBytes);
    dbg(rid, "validateImageFile result", check);
    if (!check.ok) return res.status(400).json({ message: check.message });

    let read;
    const tAI = Date.now();
    try {
      dbg(rid, "calling readQuestionFromImage", { mime: check.mime, bytes: req.file.buffer.length });
      read = await readQuestionFromImage(req.file.buffer, check.mime);
      dbg(rid, `readQuestionFromImage OK in ${Date.now() - tAI}ms`, {
        isQuestion: read?.isQuestion,
        textLength: read?.text?.length,
        confidence: read?.confidence,
        notes: read?.notes,
      });
    } catch (err) {
      console.error(`[snap:${rid}] AI CALL FAILED after ${Date.now() - tAI}ms`, describeError(err));
      try { recordAIUsage(req.user._id, "snap", err); }
      catch (e) { console.error(`[snap:${rid}] recordAIUsage (error path) threw`, describeError(e)); }

      const handled = respondToAIError(err, res);
      dbg(rid, "respondToAIError", { handled, statusSent: res.statusCode, headersSent: res.headersSent });
      if (handled) return;
      throw err;
    }

    // Bookkeeping kept separate so a failure here is never mistaken for a provider outage.
    try { recordAIUsage(req.user._id, "snap"); }
    catch (e) { console.error(`[snap:${rid}] recordAIUsage (success path) threw`, describeError(e)); }

    if (!read || !read.isQuestion || !read.text) {
      dbg(rid, "UNREADABLE_IMAGE -> 422", read);
      return res.status(422).json({
        code: "UNREADABLE_IMAGE",
        message: "We couldn't read a question in that photo. Try again in good light, hold the camera steady and fill the frame with the question.",
        notes: read?.notes,
      });
    }

    const snap = await SnapQuestion.create({
      user: req.user._id,
      extractedText: read.text,
      questionText: read.text,
      readConfidence: read.confidence,
    });
    dbg(rid, "SnapQuestion saved", { snapId: String(snap._id) });

    res.status(201).json({
      snapId: snap._id, text: read.text, confidence: read.confidence, notes: read.notes,
      // Low confidence => the UI makes the learner check the text first.
      needsReview: read.confidence !== "high",
    });
    dbg(rid, `DONE 201 in ${Date.now() - t0}ms`);
  } catch (err) {
    console.error(`[snap:${rid}] UNHANDLED in extractQuestion after ${Date.now() - t0}ms`, describeError(err));
    next(err);
  }
}

// Step 2 — POST /api/study/snap/:snapId/answer   body: { text }  (the possibly corrected text)
export async function answerQuestion(req, res, next) {
  const rid = newReqId();
  const t0 = Date.now();
  try {
    dbg(rid, "START answerQuestion", { snapId: req.params.snapId, userId: String(req.user?._id), bodyKeys: Object.keys(req.body || {}) });

    if (!mongoose.isValidObjectId(req.params.snapId)) return res.status(404).json({ message: "Question not found." });
    const snap = await SnapQuestion.findOne({ _id: req.params.snapId, user: req.user._id });
    if (!snap) {
      dbg(rid, "snap not found for user");
      return res.status(404).json({ message: "Question not found." });
    }

    const text = String(req.body?.text ?? snap.questionText ?? "").trim().slice(0, 6000);
    if (text.length < 3) return res.status(400).json({ message: "Enter the question first." });

    let answer;
    const tAI = Date.now();
    try {
      dbg(rid, "calling solveQuestion", { textLength: text.length });
      answer = await solveQuestion({ text, student: req.user });
      dbg(rid, `solveQuestion OK in ${Date.now() - tAI}ms`);
    } catch (err) {
      console.error(`[snap:${rid}] solveQuestion FAILED after ${Date.now() - tAI}ms`, describeError(err));
      try { recordAIUsage(req.user._id, "snap", err); }
      catch (e) { console.error(`[snap:${rid}] recordAIUsage (error path) threw`, describeError(e)); }

      const handled = respondToAIError(err, res);
      dbg(rid, "respondToAIError", { handled, statusSent: res.statusCode, headersSent: res.headersSent });
      if (handled) return;
      throw err;
    }

    try { recordAIUsage(req.user._id, "snap"); }
    catch (e) { console.error(`[snap:${rid}] recordAIUsage (success path) threw`, describeError(e)); }

    snap.questionText = text;
    snap.status = "answered";
    snap.answer = answer;
    await snap.save();
    onSnapAnswered({ userId: req.user._id, snapId: snap._id });
    res.json({ snapId: snap._id, text, answer });
    dbg(rid, `DONE 200 in ${Date.now() - t0}ms`);
  } catch (err) {
    console.error(`[snap:${rid}] UNHANDLED in answerQuestion after ${Date.now() - t0}ms`, describeError(err));
    next(err);
  }
}

// POST /api/study/snap/answer-text — type a question instead of taking a photo
export async function answerTyped(req, res, next) {
  try {
    const text = String(req.body?.text || "").trim().slice(0, 6000);
    if (text.length < 3) return res.status(400).json({ message: "Enter the question first." });
    const snap = await SnapQuestion.create({ user: req.user._id, extractedText: "", questionText: text, readConfidence: "high" });
    req.params.snapId = String(snap._id);
    req.body = { text };
    return answerQuestion(req, res, next);
  } catch (err) {
    console.error("[snap] UNHANDLED in answerTyped", describeError(err));
    next(err);
  }
}

// GET /api/study/snap/history
export async function snapHistory(req, res, next) {
  try {
    const { page, limit, skip } = parsePageParams(req.query, { defaultLimit: 10, maxLimit: 30 });
    const filter = { user: req.user._id, status: "answered" };
    const [items, total] = await Promise.all([
      SnapQuestion.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      SnapQuestion.countDocuments(filter),
    ]);
    res.json({ history: items.map((s) => ({ _id: s._id, text: s.questionText, answer: s.answer, createdAt: s.createdAt })), pagination: pageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

// DELETE /api/study/snap/:snapId
export async function deleteSnap(req, res, next) {
  try {
    await SnapQuestion.deleteOne({ _id: req.params.snapId, user: req.user._id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}