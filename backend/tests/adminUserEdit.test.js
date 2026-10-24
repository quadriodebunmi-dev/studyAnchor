import test from "node:test";
import assert from "node:assert/strict";
import { validateUserEdit } from "../utils/adminGuards.js";

test("accepts valid edits, normalises email and clears blank optional fields", () => {
  const r = validateUserEdit({ name: "  Ada Obi ", email: " ADA@Example.com ", level: "300", department: "", session: "2025/2026", leaderboardVisibility: "anonymous", isEmailVerified: true });
  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, { name: "Ada Obi", email: "ada@example.com", level: 300, session: "2025/2026", leaderboardVisibility: "anonymous", isEmailVerified: true });
  assert.deepEqual(r.unset, ["department"]);
  assert.equal(r.newPassword, null);
});

test("only touches fields that were sent", () => {
  const r = validateUserEdit({ timezone: "Africa/Lagos" });
  assert.deepEqual(r.patch, { timezone: "Africa/Lagos" });
  assert.deepEqual(r.unset, []);
});

test("rejects bad values with clear messages", () => {
  const r = validateUserEdit({ name: "A", email: "nope", level: 999, session: "2025/2030", semester: "Third", timezone: "Mars/Base", leaderboardVisibility: "everyone", repType: "x", newPassword: "123" });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 9);
});

test("role, points and suspension cannot be edited through this path", () => {
  const r = validateUserEdit({ role: "admin", points: 99999, suspended: true, password: "x", name: "Ok Name" });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.patch), ["name"]);
});

test("a valid new password is returned separately, never in the patch", () => {
  const r = validateUserEdit({ newPassword: "s3cret!" });
  assert.equal(r.newPassword, "s3cret!");
  assert.deepEqual(r.patch, {});
});
