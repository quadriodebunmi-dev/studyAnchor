import mongoose from "mongoose";
import CalendarEvent from "../models/CalendarEvent.js";
import Course from "../models/Course.js";
import School from "../models/School.js";
import { EVENT_TYPES, LEVELS, canPublishSchoolEvents, visibleEventsFilter, canEditEvent } from "../utils/calendarAccess.js";
import { notifyNewEvent } from "../utils/calendarReminders.js";

const MAX_PERSONAL_EVENTS = 500;
const MAX_RANGE_DAYS = 400;
const clean = (v, n) => String(v ?? "").trim().slice(0, n);
const idStr = (v) => String(v?._id ?? v ?? "");

function parseDate(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y < 2000 || y > 2100 ? null : d;
}

export function eventView(e, user) {
  return {
    _id: e._id,
    title: e.title,
    description: e.description,
    type: e.type,
    startsAt: e.startsAt,
    endsAt: e.endsAt || null,
    allDay: e.allDay,
    scope: e.scope,
    department: e.department || "",
    level: e.level || null,
    course: e.courseId?.code ? { _id: e.courseId._id, code: e.courseId.code, title: e.courseId.title } : null,
    createdBy: e.createdBy?.name ? { _id: e.createdBy._id, name: e.createdBy.name } : { _id: idStr(e.createdBy) },
    platformWide: e.scope === "school" && !e.schoolId,
    canEdit: canEditEvent(user, e),
  };
}

const POPULATE = [["courseId", "code title"], ["createdBy", "name"]];

// GET /api/calendar?from=&to=&type=&scope=all|personal|school
// Events that overlap [from, to] and that the caller may see, soonest first.
export async function listEvents(req, res, next) {
  try {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from === null || to === null) return res.status(400).json({ message: "from / to must be valid dates." });
    const start = from || new Date(Date.now() - 30 * 86400000);
    const end = to || new Date(start.getTime() + 180 * 86400000);
    if (end < start) return res.status(400).json({ message: "`to` must be after `from`." });
    if ((end - start) / 86400000 > MAX_RANGE_DAYS) return res.status(400).json({ message: `Ask for at most ${MAX_RANGE_DAYS} days at a time.` });

    const and = [
      visibleEventsFilter(req.user),
      // overlaps the window: starts inside it, or began earlier and runs into it
      { $or: [{ startsAt: { $gte: start, $lte: end } }, { startsAt: { $lt: start }, endsAt: { $gte: start } }] },
    ];
    if (req.query.type) {
      if (!EVENT_TYPES.includes(req.query.type)) return res.status(400).json({ message: "Unknown event type." });
      and.push({ type: req.query.type });
    }
    if (req.query.scope === "personal") and.push({ scope: "personal" });
    else if (req.query.scope === "school") and.push({ scope: "school" });

    const events = await CalendarEvent.find({ $and: and }).sort({ startsAt: 1, _id: 1 }).limit(500).populate(POPULATE);
    res.json({ events: events.map((e) => eventView(e, req.user)), from: start, to: end });
  } catch (err) { next(err); }
}

// GET /api/calendar/upcoming?limit=5  — the next few things coming up (dashboards).
export async function upcomingEvents(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
    const now = new Date();
    // Anything still running, or starting within the next 60 days. All-day events sit at UTC midnight,
    // so look back a day to keep "today" visible.
    const since = new Date(now.getTime() - 86400000);
    const events = await CalendarEvent.find({
      $and: [
        visibleEventsFilter(req.user),
        { $or: [{ startsAt: { $gte: since, $lte: new Date(now.getTime() + 60 * 86400000) } }, { startsAt: { $lt: since }, endsAt: { $gte: since } }] },
      ],
    }).sort({ startsAt: 1, _id: 1 }).limit(limit).populate(POPULATE);
    res.json({ events: events.map((e) => eventView(e, req.user)) });
  } catch (err) { next(err); }
}

// Reads and checks the fields shared by create and update. Returns { value } or { error }.
async function readEvent(user, body, { existing } = {}) {
  const v = {};
  const has = (k) => body[k] !== undefined;

  if (!existing || has("title")) {
    const title = clean(body.title, 120);
    if (title.length < 3) return { error: "Give the event a title (at least 3 characters)." };
    v.title = title;
  }
  if (has("description")) v.description = clean(body.description, 600);
  if (!existing || has("type")) {
    const type = body.type || "other";
    if (!EVENT_TYPES.includes(type)) return { error: "Choose a valid event type." };
    v.type = type;
  }
  if (has("allDay")) v.allDay = Boolean(body.allDay);

  if (!existing || has("startsAt")) {
    const d = parseDate(body.startsAt);
    if (!d) return { error: "Pick a valid start date." };
    v.startsAt = d;
  }
  if (has("endsAt")) {
    if (body.endsAt === null || body.endsAt === "") v.endsAt = null;
    else {
      const d = parseDate(body.endsAt);
      if (!d) return { error: "The end date isn't valid." };
      v.endsAt = d;
    }
  }
  const startsAt = v.startsAt || existing?.startsAt;
  const endsAt = v.endsAt === undefined ? existing?.endsAt : v.endsAt;
  if (endsAt && startsAt && endsAt < startsAt) return { error: "The event can't end before it starts." };

  if (has("level")) {
    if (body.level === null || body.level === "") v.level = undefined; // blank = everyone
    else if (LEVELS.includes(Number(body.level))) v.level = Number(body.level);
    else return { error: "Choose a valid level." };
  }
  if (has("department")) v.department = clean(body.department, 80);

  if (has("courseId")) {
    if (!body.courseId) v.courseId = null;
    else {
      const course = mongoose.isValidObjectId(body.courseId) ? await Course.findById(body.courseId).select("schoolId") : null;
      if (!course) return { error: "That course wasn't found." };
      const sameSchool = !course.schoolId || !user.schoolId || idStr(course.schoolId) === idStr(user.schoolId);
      if (user.role !== "admin" && !sameSchool) return { error: "Choose a course from your own school." };
      v.courseId = course._id;
    }
  }
  return { value: v };
}

// POST /api/calendar
export async function createEvent(req, res, next) {
  try {
    const user = req.user;
    const scope = req.body.scope === "school" ? "school" : "personal";
    if (scope === "school" && !canPublishSchoolEvents(user)) {
      return res.status(403).json({ message: "Only Course Reps and admins can add events for the whole class or school. Save it as a personal event instead." });
    }

    const { value, error } = await readEvent(user, req.body);
    if (error) return res.status(400).json({ message: error });

    const doc = { ...value, scope, createdBy: user._id };
    if (scope === "personal") {
      const count = await CalendarEvent.countDocuments({ scope: "personal", createdBy: user._id });
      if (count >= MAX_PERSONAL_EVENTS) return res.status(429).json({ message: `You can keep up to ${MAX_PERSONAL_EVENTS} personal events. Delete some old ones first.` });
      // Personal events never carry audience targeting.
      delete doc.department; delete doc.level;
    } else if (user.role === "admin") {
      // An admin picks a school, or leaves it blank for a platform-wide date.
      if (req.body.schoolId) {
        const school = mongoose.isValidObjectId(req.body.schoolId) ? await School.findById(req.body.schoolId).select("_id") : null;
        if (!school) return res.status(400).json({ message: "That school wasn't found." });
        doc.schoolId = school._id;
      }
    } else {
      if (!user.schoolId) return res.status(400).json({ message: "Join a school before adding events for your class." });
      doc.schoolId = user.schoolId;
    }

    const event = await CalendarEvent.create(doc);
    await event.populate(POPULATE);
    if (scope === "school") notifyNewEvent(event);
    res.status(201).json({ event: eventView(event, user) });
  } catch (err) { next(err); }
}

async function loadOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ message: "Event not found." }); return null; }
  const event = await CalendarEvent.findById(req.params.id);
  if (!event || (event.scope === "personal" && idStr(event.createdBy) !== idStr(req.user._id))) {
    res.status(404).json({ message: "Event not found." }); return null;
  }
  if (!canEditEvent(req.user, event)) { res.status(403).json({ message: "You can only change events you created." }); return null; }
  return event;
}

// PUT /api/calendar/:id
export async function updateEvent(req, res, next) {
  try {
    const event = await loadOwned(req, res); if (!event) return;
    const { value, error } = await readEvent(req.user, req.body, { existing: event });
    if (error) return res.status(400).json({ message: error });
    if (event.scope === "personal") { delete value.department; delete value.level; }

    const moved = value.startsAt && value.startsAt.getTime() !== event.startsAt.getTime();
    Object.assign(event, value);
    // A moved date may get its own reminder again.
    if (moved) event.remindedAt = undefined;
    await event.save();
    await event.populate(POPULATE);
    res.json({ event: eventView(event, req.user) });
  } catch (err) { next(err); }
}

// DELETE /api/calendar/:id
export async function deleteEvent(req, res, next) {
  try {
    const event = await loadOwned(req, res); if (!event) return;
    await event.deleteOne();
    res.json({ message: "Event deleted." });
  } catch (err) { next(err); }
}
