import { isValidEmail, isValidMatric, isValidPassword } from "./validators.js";
import { isValidSession } from "./sessions.js";
import { isValidTimeZone } from "./streaks.js";

// Pure admin-safety rules so dangerous operations are checked in one testable place.

const ROLES = ["student", "rep", "admin"];

/**
 * May `actor` change `target`'s role to `newRole`?
 *  - you can't change your own role (no accidental self-demotion / lock-out)
 *  - the last remaining admin can't be demoted
 *  - only valid roles
 */
export function canChangeRole({ actor, target, newRole, adminCount }) {
  if (!ROLES.includes(newRole)) return { ok: false, message: "Invalid role." };
  if (String(actor._id) === String(target._id)) return { ok: false, message: "You can't change your own role." };
  if (target.role === newRole) return { ok: false, message: `They're already a ${newRole}.` };
  if (target.role === "admin" && adminCount <= 1) return { ok: false, message: "You can't remove the last admin." };
  return { ok: true };
}

export function canSuspend({ actor, target }) {
  if (String(actor._id) === String(target._id)) return { ok: false, message: "You can't suspend yourself." };
  if (target.role === "admin") return { ok: false, message: "Admins can't be suspended." };
  return { ok: true };
}

// Settings an admin may change at runtime, with hard bounds so a typo can't
// hand out a million points or switch a limit off by accident.
const BOUNDS = {
  "rewards.flashcardsPer10Cards": [0, 50], "rewards.flashcardsDailyCap": [0, 200],
  "rewards.mockExamCompleted": [0, 100], "rewards.mockExamDailyCap": [0, 20],
  "rewards.personalQuizCompleted": [0, 100], "rewards.personalQuizDailyCap": [0, 20],
  "rewards.goalCompleted": [0, 500], "rewards.roomCreated": [0, 100], "rewards.roomCreatedDailyCap": [0, 20],
  "rewards.roomQuizParticipation": [0, 100], "rewards.roomPost": [0, 20], "rewards.roomPostDailyCap": [0, 50],
  "ai.dailyLimits.snap": [0, 1000], "ai.dailyLimits.flashcards": [0, 1000], "ai.dailyLimits.exams": [0, 500],
  "ai.dailyLimits.roomQuizGeneration": [0, 500], "ai.dailyLimits.theoryGrading": [0, 5000],
  "rooms.maxMembers": [2, 5000], "rooms.maxRoomsCreatedPerDay": [0, 100],
  "quizzes.maxQuestions": [1, 200], "goals.maxActive": [1, 50],
};
export const EDITABLE_SETTINGS = Object.keys(BOUNDS);

/** Flattens {rewards:{goalCompleted:20}} to {"rewards.goalCompleted":20} and validates every leaf. */
export function validateSettingsPatch(patch) {
  const flat = {};
  const errors = [];
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj || {})) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) walk(v, key);
      else flat[key] = v;
    }
  };
  walk(patch, "");
  for (const [key, v] of Object.entries(flat)) {
    const b = BOUNDS[key];
    if (!b) { errors.push(`"${key}" can't be changed here.`); continue; }
    if (!Number.isInteger(v) || v < b[0] || v > b[1]) errors.push(`"${key}" must be a whole number from ${b[0]} to ${b[1]}.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, flat };
}

// ---- Admin editing of a user's details ---------------------------------------
// Whitelist + validation only (no database). Returns:
//   { ok: true, patch, unset, newPassword }  patch = fields to set, unset = fields to clear
//   { ok: false, errors: [..] }
// Role, suspension and points are NOT editable here: they have their own audited,
// guarded actions (role change, suspend, points ledger).
const LEVELS = [100, 200, 300, 400, 500, 600];
const SEMESTERS = ["First Semester", "Second Semester"];
const str = (v, max) => String(v ?? "").trim().slice(0, max);

export function validateUserEdit(body = {}) {
  const patch = {}, unset = [], errors = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const blank = (v) => v === "" || v === null || v === undefined;

  if (has("name")) {
    const v = str(body.name, 100);
    if (v.length < 2) errors.push("Name must be at least 2 characters."); else patch.name = v;
  }
  if (has("email")) {
    const v = str(body.email, 200).toLowerCase();
    if (!isValidEmail(v)) errors.push("Enter a valid email address."); else patch.email = v;
  }
  if (has("matricNumber")) {
    if (blank(body.matricNumber)) unset.push("matricNumber");
    else if (!isValidMatric(str(body.matricNumber, 40))) errors.push("Enter a valid matric number.");
    else patch.matricNumber = str(body.matricNumber, 40);
  }
  if (has("department")) { if (blank(body.department)) unset.push("department"); else patch.department = str(body.department, 120); }
  if (has("level")) {
    if (blank(body.level)) unset.push("level");
    else if (!LEVELS.includes(Number(body.level))) errors.push("Level must be one of " + LEVELS.join(", ") + ".");
    else patch.level = Number(body.level);
  }
  if (has("semester")) {
    if (blank(body.semester)) unset.push("semester");
    else if (!SEMESTERS.includes(body.semester)) errors.push("Invalid semester."); else patch.semester = body.semester;
  }
  if (has("session")) {
    if (blank(body.session)) unset.push("session");
    else if (!isValidSession(str(body.session, 20))) errors.push("Enter a valid academic session, e.g. 2025/2026."); else patch.session = str(body.session, 20);
  }
  if (has("schoolId")) { if (blank(body.schoolId)) unset.push("schoolId"); else patch.schoolId = String(body.schoolId); }
  if (has("learnerType")) {
    if (!["school", "independent"].includes(body.learnerType)) errors.push("Invalid learner type."); else patch.learnerType = body.learnerType;
  }
  if (has("timezone")) {
    if (!isValidTimeZone(str(body.timezone, 60))) errors.push("Enter a valid time zone, e.g. Africa/Lagos."); else patch.timezone = str(body.timezone, 60);
  }
  if (has("leaderboardVisibility")) {
    if (!["public", "anonymous", "hidden"].includes(body.leaderboardVisibility)) errors.push("Invalid leaderboard visibility."); else patch.leaderboardVisibility = body.leaderboardVisibility;
  }
  for (const k of ["showSchoolOnLeaderboard", "isEmailVerified"]) if (has(k)) patch[k] = body[k] === true || body[k] === "true";
  if (has("repCourses")) patch.repCourses = str(body.repCourses, 300);
  if (has("repType")) { if (!["course", "class"].includes(body.repType)) errors.push("Invalid rep type."); else patch.repType = body.repType; }
  if (has("repStatus")) {
    if (blank(body.repStatus)) unset.push("repStatus");
    else if (!["pending", "active", "rejected"].includes(body.repStatus)) errors.push("Invalid rep status."); else patch.repStatus = body.repStatus;
  }
  if (has("repNote")) { if (blank(body.repNote)) unset.push("repNote"); else patch.repNote = str(body.repNote, 500); }
  if (has("rejectionReason")) { if (blank(body.rejectionReason)) unset.push("rejectionReason"); else patch.rejectionReason = str(body.rejectionReason, 300); }

  let newPassword = null;
  if (!blank(body.newPassword)) {
    if (!isValidPassword(body.newPassword)) errors.push("The new password must be at least 6 characters."); else newPassword = String(body.newPassword);
  }
  return errors.length ? { ok: false, errors } : { ok: true, patch, unset, newPassword };
}
