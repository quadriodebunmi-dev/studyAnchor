// Who may see and change calendar events. Pure functions, so the rules are easy to test
// and every endpoint asks the same questions.

export const EVENT_TYPES = ["exam", "test", "assignment", "class", "registration", "holiday", "deadline", "other"];
export const LEVELS = [100, 200, 300, 400, 500, 600];

const idOf = (v) => String(v?._id ?? v ?? "");

/** May this person publish events to a whole school (or the platform)? */
export const canPublishSchoolEvents = (user) =>
  Boolean(user) && (user.role === "admin" || (user.role === "rep" && user.repStatus === "active"));

/** Mongo filter for "events this person may see". */
export function visibleEventsFilter(user) {
  const branches = [
    { scope: "personal", createdBy: user._id },
    { scope: "school", createdBy: user._id }, // what a rep published stays visible to them, whoever it targets
    { scope: "school", schoolId: null },      // platform-wide dates from an admin (null also matches a missing field)
  ];

  if (user.role === "admin") {
    branches.push({ scope: "school" }); // admins see every school's shared events (never other people's personal ones)
  } else if (user.schoolId) {
    const and = [];
    // Blank department / level means "everyone at the school".
    const dept = [{ department: "" }, { department: null }];
    if (user.department) dept.push({ department: user.department });
    and.push({ $or: dept });
    const lvl = [{ level: null }];
    if (user.level) lvl.push({ level: user.level });
    and.push({ $or: lvl });
    branches.push({ scope: "school", schoolId: user.schoolId, $and: and });
  }
  return { $or: branches };
}

/** The same rule for one already-loaded event. */
export function canViewEvent(user, event) {
  if (!user || !event) return false;
  if (event.scope === "personal") return idOf(event.createdBy) === idOf(user._id);
  if (idOf(event.createdBy) === idOf(user._id)) return true;
  if (!event.schoolId) return true;
  if (user.role === "admin") return true;
  if (!user.schoolId || idOf(user.schoolId) !== idOf(event.schoolId)) return false;
  if (event.department && event.department !== user.department) return false;
  if (event.level && Number(event.level) !== Number(user.level)) return false;
  return true;
}

/** Creators change their own events; admins can change any shared one. */
export function canEditEvent(user, event) {
  if (!user || !event) return false;
  if (idOf(event.createdBy) === idOf(user._id)) return true;
  return user.role === "admin" && event.scope === "school";
}
