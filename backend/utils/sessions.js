// Academic sessions are stored as free-text strings like "2025/2026" so the
// backend never needs updating just because a new session starts. This just
// validates the shape rather than maintaining a hardcoded whitelist.
const SESSION_PATTERN = /^\d{4}\/\d{4}$/;

export function isValidSession(session) {
  if (!session || typeof session !== "string") return false;
  if (!SESSION_PATTERN.test(session)) return false;
  const [start, end] = session.split("/").map(Number);
  return end === start + 1;
}

// A handful of sensible defaults for seed data / dropdowns if the frontend
// doesn't supply its own list.
export function defaultSessionOptions(count = 5) {
  const now = new Date();
  // Nigerian academic sessions typically start around September.
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const y = startYear - i;
    sessions.push(`${y}/${y + 1}`);
  }
  return sessions;
}
