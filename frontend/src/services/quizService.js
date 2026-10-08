import api from "./api.js";

export async function generateQuiz(materialId, numQuestions, difficulty) {
  const res = await api.post("/quiz/generate", { materialId, numQuestions, difficulty });
  return res.data.quiz;
}

// Open-ended theory Q&A — returned with answers included, for self-study/copying.
export async function generateTheoryQuiz(materialId, numQuestions, difficulty) {
  const res = await api.post("/quiz/generate-theory", { materialId, numQuestions, difficulty });
  return res.data.quiz;
}

export async function submitQuiz(quizId, answers) {
  const res = await api.post(`/quiz/${quizId}/submit`, { answers });
  return res.data;
}

export async function myAttempts({ page, limit } = {}) {
  const res = await api.get("/quiz/attempts/mine", { params: { page, limit } });
  return res.data; // { attempts, pagination }
}

export async function myAnalytics() {
  const res = await api.get("/quiz/analytics/mine");
  return res.data;
}
