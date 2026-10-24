import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeKey, acronymOf, findDuplicateSchool, parseDepartmentInput, findDuplicateDepartment,
} from "../utils/dedupe.js";

test("normalizeKey ignores case, punctuation, spacing and a leading 'the'", () => {
  assert.equal(normalizeKey("  The  Lens   University. "), "lens university");
  assert.equal(normalizeKey("Université"), "universite");
});

test("acronymOf skips filler words and needs two real words", () => {
  assert.equal(acronymOf("Medical Laboratory Science"), "mls");
  assert.equal(acronymOf("Department of Computer Science"), "dcs");
  assert.equal(acronymOf("Law"), "");
});

test("school: 'lens university , ilemona' then 'lens university' is a duplicate", () => {
  const schools = [{ _id: "1", name: "lens university , ilemona" }];
  assert.ok(findDuplicateSchool(schools, { name: "lens university" }));
  assert.ok(findDuplicateSchool(schools, { name: "Lens University" }));
  assert.ok(findDuplicateSchool(schools, { name: "LENS  UNIVERSITY, Ilemona" }));
  assert.equal(findDuplicateSchool(schools, { name: "Lens Polytechnic" }), null);
});

test("school: same website domain is a duplicate; editing a school ignores itself", () => {
  const schools = [{ _id: "1", name: "Lens University", domain: "lens.edu.ng" }];
  assert.equal(findDuplicateSchool(schools, { name: "Other", domain: "https://www.lens.edu.ng/" }).reason, "domain");
  assert.equal(findDuplicateSchool(schools, { name: "Lens University" }, "1"), null);
});

test("parseDepartmentInput pulls an abbreviation out of brackets or quotes", () => {
  assert.deepEqual(parseDepartmentInput("Medical Laboratory Science (MLS)"), { name: "Medical Laboratory Science", shortName: "MLS" });
  assert.deepEqual(parseDepartmentInput("Medical Laboratory Science 'MLS'"), { name: "Medical Laboratory Science", shortName: "MLS" });
  assert.deepEqual(parseDepartmentInput("Medical Laboratory Science", "mls"), { name: "Medical Laboratory Science", shortName: "MLS" });
  assert.deepEqual(parseDepartmentInput("MLS"), { name: "MLS", shortName: "" });
});

test("department: adding 'MLS' after 'Medical Laboratory Science' (MLS) is blocked", () => {
  const withShort = [{ _id: "1", name: "Medical Laboratory Science", shortName: "MLS" }];
  assert.ok(findDuplicateDepartment(withShort, parseDepartmentInput("MLS")));
  assert.ok(findDuplicateDepartment(withShort, parseDepartmentInput("mls")));
  assert.ok(findDuplicateDepartment(withShort, parseDepartmentInput("medical laboratory science")));
});

test("department: 'MLS' is blocked even when the short name was never saved", () => {
  const noShort = [{ _id: "1", name: "Medical Laboratory Science" }];
  assert.ok(findDuplicateDepartment(noShort, parseDepartmentInput("MLS")));
});

test("department: full name is blocked when the existing one is named 'MLS'", () => {
  assert.ok(findDuplicateDepartment([{ _id: "1", name: "MLS" }], parseDepartmentInput("Medical Laboratory Science")));
});

test("department: different departments with the same initials stay distinct", () => {
  const existing = [{ _id: "1", name: "Computer Science", shortName: "CS" }];
  assert.equal(findDuplicateDepartment(existing, parseDepartmentInput("Chemical Science")), null);
  assert.equal(findDuplicateDepartment(existing, parseDepartmentInput("Chemistry")), null);
});
