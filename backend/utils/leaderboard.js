// Pure leaderboard helpers. Ranking is by points; equal points share a rank
// and the next rank skips ("1, 2, 2, 4"), like the quiz leaderboard.

export function rankByPoints(entries) {
  const sorted = [...entries].sort((a, b) => b.points - a.points || String(a.id).localeCompare(String(b.id)));
  let lastPoints = null;
  let lastRank = 0;
  return sorted.map((e, i) => {
    const rank = e.points === lastPoints ? lastRank : i + 1;
    lastPoints = e.points;
    lastRank = rank;
    return { ...e, rank };
  });
}

/** "Ada Obi" -> "Ada O." — enough to recognise a classmate, not enough to identify a stranger. */
export function publicName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Learner";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export const VISIBILITY = ["public", "anonymous", "hidden"];

/** What a leaderboard row may show for a user's privacy setting. null = excluded. */
export function leaderboardIdentity(user) {
  const v = VISIBILITY.includes(user.leaderboardVisibility) ? user.leaderboardVisibility : "public";
  if (v === "hidden") return null;
  if (v === "anonymous") return { name: "Anonymous learner", school: undefined };
  return { name: publicName(user.name), school: user.showSchoolOnLeaderboard ? user.schoolName : undefined };
}

export const isLeaderboardEligible = (user) =>
  Boolean(user) && !user.suspended && ["student", "rep"].includes(user.role) && (user.leaderboardVisibility || "public") !== "hidden";
