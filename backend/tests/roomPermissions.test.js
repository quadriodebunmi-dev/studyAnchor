import test from "node:test";
import assert from "node:assert/strict";
import { can, canSeeRoom, decideJoin, canActOnMember, roleAtLeast } from "../utils/roomPermissions.js";

const active = (role, user = "u1") => ({ status: "active", role, user });
const publicRoom = { visibility: "public", joinPolicy: "open", audience: "everyone" };
const privateRoom = { visibility: "private", joinPolicy: "approval", inviteCode: "ABC123" };

test("non-members get no protected access", () => {
  assert.equal(can.viewContent(null), false);
  assert.equal(can.post(null), false);
  assert.equal(can.viewContent({ status: "pending", role: "member" }), false);
  assert.equal(can.viewContent({ status: "banned", role: "member" }), false);
  assert.equal(can.viewContent({ status: "invited", role: "member" }), false);
});

test("role capabilities", () => {
  assert.equal(can.post(active("member")), true);
  assert.equal(can.moderate(active("member")), false);
  assert.equal(can.moderate(active("moderator")), true);
  assert.equal(can.manageQuizzes(active("moderator")), true);
  assert.equal(can.manageQuizzes(active("member")), false);
  assert.equal(can.manageRoom(active("moderator")), false);
  assert.equal(can.manageRoom(active("owner")), true);
  assert.equal(can.deleteQuiz(active("moderator")), false);
  assert.equal(roleAtLeast({ status: "pending", role: "owner" }, "member"), false, "a pending row never grants a role");
});

test("private rooms are invisible to strangers; public rooms respect school audience", () => {
  const stranger = { _id: "x", role: "student" };
  assert.equal(canSeeRoom(privateRoom, stranger, null), false);
  assert.equal(canSeeRoom(privateRoom, stranger, { status: "invited" }), true);
  assert.equal(canSeeRoom(publicRoom, stranger, null), true);
  const schoolRoom = { ...publicRoom, audience: "school", schoolId: "s1" };
  assert.equal(canSeeRoom(schoolRoom, { schoolId: "s2" }, null), false);
  assert.equal(canSeeRoom(schoolRoom, { schoolId: "s1" }, null), true);
  assert.equal(canSeeRoom(schoolRoom, { role: "student" }, null), false, "independent learners can't see school-only rooms");
  assert.equal(canSeeRoom(publicRoom, stranger, { status: "banned" }), false);
});

test("joining: open public, approval public, private with and without code", () => {
  const user = { _id: "u9" };
  assert.equal(decideJoin({ room: publicRoom, user, membership: null }).outcome, "joined");
  assert.equal(decideJoin({ room: { ...publicRoom, joinPolicy: "approval" }, user, membership: null }).outcome, "requested");
  assert.equal(decideJoin({ room: privateRoom, user, membership: null }).outcome, "denied");
  assert.equal(decideJoin({ room: privateRoom, user, membership: null, inviteCode: "nope" }).outcome, "denied");
  assert.equal(decideJoin({ room: privateRoom, user, membership: null, inviteCode: "ABC123" }).outcome, "requested");
  assert.equal(decideJoin({ room: privateRoom, user, membership: { status: "invited" } }).outcome, "accepted");
  assert.equal(decideJoin({ room: publicRoom, user, membership: { status: "banned" } }).outcome, "denied");
  assert.equal(decideJoin({ room: publicRoom, user, membership: { status: "active" } }).outcome, "already");
  assert.equal(decideJoin({ room: publicRoom, user, membership: null, memberCount: 5, maxMembers: 5 }).outcome, "denied");
});

test("a private room's invite code never auto-joins", () => {
  assert.notEqual(decideJoin({ room: privateRoom, user: {}, membership: null, inviteCode: "ABC123" }).outcome, "joined");
});

test("member management hierarchy", () => {
  const owner = active("owner", "o");
  const mod = active("moderator", "m");
  const member = active("member", "u");
  assert.equal(canActOnMember(owner, mod), true);
  assert.equal(canActOnMember(mod, member), true);
  assert.equal(canActOnMember(mod, active("moderator", "m2")), false);
  assert.equal(canActOnMember(mod, owner), false);
  assert.equal(canActOnMember(member, active("member", "z")), false);
  assert.equal(canActOnMember(mod, mod), false, "no acting on yourself");
});
