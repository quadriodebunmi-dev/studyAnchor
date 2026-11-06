// Who may do what in a discussion room. Pure functions over a room document and
// the caller's membership row, so the rules are testable and every controller
// asks the same questions. The backend — never the UI — is the authority.

export const ROLE_RANK = { member: 1, moderator: 2, owner: 3 };
export const MOOD_VALUES = ["social", "revision", "brainstorming", "daily_study"];
export const MOOD_LABELS = { social: "Social", revision: "Revision", brainstorming: "Brainstorming", daily_study: "Daily Study" };

const idStr = (v) => String(v?._id ?? v ?? "");

export const isActive = (m) => m?.status === "active";
export const roleAtLeast = (m, min) => isActive(m) && (ROLE_RANK[m.role] || 0) >= ROLE_RANK[min];

export const can = {
  // Protected content (discussions, members, quizzes, results) is for active members only.
  viewContent: (m) => isActive(m),
  post: (m) => isActive(m),
  moderate: (m) => roleAtLeast(m, "moderator"),     // remove posts, review join requests, invite
  manageQuizzes: (m) => roleAtLeast(m, "moderator"), // edit/publish/grade ANY quiz in the room
  createQuiz: (m) => isActive(m),                    // any active member may create a quiz
  deleteQuiz: (m) => roleAtLeast(m, "owner"),
  manageRoom: (m) => roleAtLeast(m, "owner"),        // settings, roles, bans, delete
};

/** Did `userId` create this quiz? (accepts ids or populated docs) */
export const isQuizCreator = (quiz, userId) => Boolean(quiz) && idStr(quiz.creator) === idStr(userId);

/**
 * May this member manage (edit / publish / grade / see the key of) THIS quiz?
 * Owners and moderators manage every quiz; any other member manages only their own.
 */
export const canManageQuiz = (m, quiz, userId) => isActive(m) && (roleAtLeast(m, "moderator") || isQuizCreator(quiz, userId));

/**
 * May this member take THIS quiz? Members who can see the answer key because
 * they moderate someone else's quiz can't; the quiz's own creator can.
 */
export const canTakeQuiz = (m, quiz, userId) => isActive(m) && (!roleAtLeast(m, "moderator") || isQuizCreator(quiz, userId));

/**
 * Can this user even SEE that the room exists (discovery/preview)?
 *  - members always can
 *  - public rooms: everyone, unless the room is limited to one school
 *  - private rooms: members and invitees only (non-members need the invite code)
 */
export function canSeeRoom(room, user, membership) {
  if (!room) return false;
  if (user?.role === "admin") return true;
  if (isActive(membership) || membership?.status === "invited" || membership?.status === "pending") return true;
  if (membership?.status === "banned") return false;
  if (room.visibility !== "public") return false;
  if (room.audience === "school") return Boolean(user?.schoolId) && idStr(user.schoolId) === idStr(room.schoolId);
  return true;
}

/**
 * What happens when `user` asks to join?
 *   "joined"     became an active member
 *   "requested"  a pending request now awaits owner/moderator approval
 *   "accepted"   an existing invitation was accepted
 *   "already"    already an active member
 *   "pending"    request already waiting
 *   "denied"     reason in `reason`
 */
export function decideJoin({ room, user, membership, inviteCode, memberCount = 0, maxMembers = Infinity }) {
  if (membership?.status === "banned") return { outcome: "denied", reason: "You can't join this room." };
  if (isActive(membership)) return { outcome: "already" };
  if (memberCount >= maxMembers) return { outcome: "denied", reason: "This room is full." };

  if (membership?.status === "invited") return { outcome: "accepted" };
  if (membership?.status === "pending") return { outcome: "pending" };

  const codeOk = Boolean(inviteCode) && Boolean(room.inviteCode) && inviteCode === room.inviteCode;

  if (room.visibility === "public") {
    if (!canSeeRoom(room, user, membership)) return { outcome: "denied", reason: "This room isn't open to your school." };
    return room.joinPolicy === "open" ? { outcome: "joined" } : { outcome: "requested" };
  }
  // Private: you must hold the invite code; even then the owner/moderators approve.
  if (!codeOk) return { outcome: "denied", reason: "This room is private. You need an invitation or the invite link." };
  return { outcome: "requested" };
}

/** May `actor` change `target`'s role/status? Owners are untouchable; mods can't act on mods. */
export function canActOnMember(actorMembership, targetMembership) {
  if (!roleAtLeast(actorMembership, "moderator")) return false;
  if (!targetMembership) return false;
  if (targetMembership.role === "owner") return false;
  if (idStr(actorMembership.user) === idStr(targetMembership.user)) return false;
  if (targetMembership.role === "moderator") return roleAtLeast(actorMembership, "owner");
  return true;
}
