import StudyActivity from "../models/StudyActivity.js";
import { PLATFORM } from "../config/platform.js";
import { recordActivity, evaluateStreak } from "./activity.js";
import { awardCapped } from "./rewards.js";
import { localDay } from "./streaks.js";

// The glue between feature code and the points/streak engine. Every function is
// best-effort (never throws) and keyed so repeating the call is harmless.

const safe = (fn) => async (...args) => { try { return await fn(...args); } catch (err) { console.error("reward hook failed:", err.message); return null; } };

/** A flashcard was marked understood / needs-review. */
export const onFlashcardReviewed = safe(async ({ user, deckId, cardId }) => {
  const day = localDay(new Date(), user.timezone);
  const r = await recordActivity({ userId: user._id, type: "flashcards", sourceKey: `fc:${deckId}:${cardId}:${day}`, skipStreak: true });
  if (!r.created) return;
  const n = await StudyActivity.countDocuments({ user: user._id, day: r.day, type: "flashcards" });
  if (n === 5) await evaluateStreak(user._id, r.day); // the day just started to count
  const { flashcardsPer10Cards, flashcardsDailyCap } = PLATFORM.rewards;
  if (flashcardsPer10Cards > 0 && n % 10 === 0) {
    await awardCapped({
      userId: user._id, points: flashcardsPer10Cards, reason: "Reviewed 10 flashcards", sourceType: "flashcards",
      key: `flashcards:${user._id}:${r.day}:${n / 10}`, dailyCap: flashcardsDailyCap,
    });
  }
});

export const onMockExamSubmitted = safe(async ({ userId, attemptId, answered, total }) => {
  const { mockExamCompleted, mockExamDailyCap, mockExamMinAnsweredRatio } = PLATFORM.rewards;
  if (!total || answered / total < mockExamMinAnsweredRatio) return; // an empty submit isn't studying
  await recordActivity({ userId, type: "mock_exam", sourceKey: `exam:${attemptId}` });
  if (mockExamCompleted > 0) {
    await awardCapped({ userId, points: mockExamCompleted, reason: "Completed a mock exam", sourceType: "mock_exam", sourceId: attemptId, key: `mock_exam:${attemptId}`, dailyCap: mockExamDailyCap * mockExamCompleted });
  }
});

export const onPersonalQuizSubmitted = safe(async ({ userId, attemptId, total, answered }) => {
  const { personalQuizCompleted, personalQuizDailyCap, personalQuizMinQuestions } = PLATFORM.rewards;
  if (!total || answered / total < 0.5) return;
  await recordActivity({ userId, type: "personal_quiz", sourceKey: `pq:${attemptId}` });
  if (personalQuizCompleted > 0 && total >= personalQuizMinQuestions) {
    await awardCapped({ userId, points: personalQuizCompleted, reason: "Completed a quiz", sourceType: "personal_quiz", sourceId: attemptId, key: `personal_quiz:${attemptId}`, dailyCap: personalQuizDailyCap * personalQuizCompleted });
  }
});

export const onRoomQuizSubmitted = safe(async ({ userId, attemptId, answered, total }) => {
  if (!total || answered / total < PLATFORM.rewards.roomQuizMinAnsweredRatio) return;
  await recordActivity({ userId, type: "room_quiz", sourceKey: `rq:${attemptId}` });
});

export const onSnapAnswered = safe(async ({ userId, snapId }) => {
  await recordActivity({ userId, type: "snap", sourceKey: `snap:${snapId}` });
});

/** Room posts only earn points when the admin turns it on (default off — it invites spam). */
export const onRoomPost = safe(async ({ userId, postId, length }) => {
  const { roomPost, roomPostDailyCap, roomPostMinChars } = PLATFORM.rewards;
  if (!roomPost || length < roomPostMinChars) return;
  await awardCapped({ userId, points: roomPost, reason: "Contributed to a discussion", sourceType: "room_post", sourceId: postId, key: `room_post:${postId}`, dailyCap: roomPostDailyCap * roomPost });
});
