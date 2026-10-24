// Duplicate detection for schools and departments.
//
// A plain "same name, ignoring case" check misses the obvious cases:
//   - "Lens University , Ilemona"  vs  "lens university"
//   - "Medical Laboratory Science (MLS)"  vs  "MLS"
//   - "Medical  Laboratory Science"  vs  "medical laboratory science."
// so names are reduced to a comparable key first, and departments can carry a
// short name ("MLS") that counts as the same department too.

const STOP_WORDS = new Set(["of", "and", "the", "in", "for"]);

/** Lowercase, strip accents/punctuation, collapse whitespace, drop a leading "the". */
export function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ");
}

/** "Medical Laboratory Science" -> "mls". Empty when there are fewer than two meaningful words. */
export function acronymOf(name) {
  const words = normalizeKey(name).split(" ").filter((w) => w && !STOP_WORDS.has(w));
  return words.length >= 2 ? words.map((w) => w[0]).join("") : "";
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

/** Every key a school name can be known by: full name, without a ", city" tail, without "(brackets)". */
export function schoolKeys(name) {
  const raw = String(name ?? "");
  const keys = new Set();
  keys.add(normalizeKey(raw));
  keys.add(normalizeKey(raw.split(",")[0]));
  keys.add(normalizeKey(raw.replace(/\(.*?\)/g, " ")));
  keys.add(normalizeKey(raw.replace(/\(.*?\)/g, " ").split(",")[0]));
  keys.delete("");
  return keys;
}

export function normalizeDomain(domain) {
  return String(domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/**
 * Finds an existing school that is the same as { name, domain }.
 * `schools` is a list of { _id, name, domain }; `excludeId` skips one row (for edits).
 */
export function findDuplicateSchool(schools, { name, domain }, excludeId) {
  const wanted = schoolKeys(name);
  const wantedDomain = normalizeDomain(domain);
  for (const s of schools) {
    if (excludeId && String(s._id) === String(excludeId)) continue;
    if (wantedDomain && normalizeDomain(s.domain) === wantedDomain) return { school: s, reason: "domain" };
    for (const key of schoolKeys(s.name)) {
      if (wanted.has(key)) return { school: s, reason: "name" };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

/**
 * Splits "Medical Laboratory Science (MLS)" / "Medical Laboratory Science 'MLS'"
 * into { name: "Medical Laboratory Science", shortName: "MLS" }. An explicit
 * shortName always wins over one embedded in the name.
 */
export function parseDepartmentInput(rawName, rawShortName) {
  let name = String(rawName ?? "").trim().replace(/\s+/g, " ");
  let shortName = String(rawShortName ?? "").trim().replace(/\s+/g, " ");

  const trailing = name.match(/^(.*?)[\s,\-–—]*(?:\(([^()]{1,20})\)|["'‘’“”]([^"'‘’“”]{1,20})["'‘’“”])\s*$/);
  if (trailing && trailing[1].trim()) {
    const embedded = (trailing[2] || trailing[3] || "").trim();
    name = trailing[1].trim();
    if (!shortName) shortName = embedded;
  }
  return { name, shortName: shortName ? shortName.toUpperCase().slice(0, 20) : "" };
}

/**
 * Finds an existing department that is the same as { name, shortName }.
 * `departments` must already be limited to the same school. Matches when:
 *   - the names are the same,
 *   - what was typed equals the other's short name ("MLS" vs "... (MLS)"),
 *   - what was typed is the other's initials ("MLS" vs "Medical Laboratory Science"), or
 *   - the full name's initials equal a department that is itself named "MLS".
 * Initials are never compared with initials, so "Computer Science" and
 * "Chemical Science" stay distinct departments.
 */
export function findDuplicateDepartment(departments, { name, shortName }, excludeId) {
  const nameKey = normalizeKey(name);
  const shortKey = normalizeKey(shortName);
  const nameInitials = acronymOf(name);

  for (const d of departments) {
    if (excludeId && String(d._id) === String(excludeId)) continue;
    const dName = normalizeKey(d.name);
    const dShort = normalizeKey(d.shortName);
    const dInitials = acronymOf(d.name);

    const same =
      (nameKey && (nameKey === dName || nameKey === dShort || nameKey === dInitials)) ||
      (shortKey && (shortKey === dName || shortKey === dShort || shortKey === dInitials)) ||
      (nameInitials && nameInitials === dName);
    if (same) return d;
  }
  return null;
}

export const departmentLabel = (d) => (d.shortName ? `${d.name} (${d.shortName})` : d.name);
