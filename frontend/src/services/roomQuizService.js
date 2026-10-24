import api from "./api.js";

const base = (roomId, quizId = "") => `/rooms/${roomId}/quizzes${quizId ? `/${quizId}` : ""}`;

export const listQuizzes = (roomId) => api.get(base(roomId)).then((r) => r.data.quizzes);
export const getQuiz = (roomId, quizId) => api.get(base(roomId, quizId)).then((r) => r.data);
export const createQuiz = (roomId, data) => api.post(base(roomId), data).then((r) => r.data.quiz);
export const updateQuiz = (roomId, quizId, data) => api.put(base(roomId, quizId), data).then((r) => r.data.quiz);
export const deleteQuiz = (roomId, quizId) => api.delete(base(roomId, quizId)).then((r) => r.data);

// manager
export const getQuizForManager = (roomId, quizId) => api.get(`${base(roomId, quizId)}/manage`).then((r) => r.data);
export const previewQuiz = (roomId, quizId) => api.get(`${base(roomId, quizId)}/preview`).then((r) => r.data);
export const addQuestion = (roomId, quizId, q) => api.post(`${base(roomId, quizId)}/questions`, q).then((r) => r.data);
export const updateQuestion = (roomId, quizId, qid, q) => api.put(`${base(roomId, quizId)}/questions/${qid}`, q).then((r) => r.data);
export const deleteQuestion = (roomId, quizId, qid) => api.delete(`${base(roomId, quizId)}/questions/${qid}`).then((r) => r.data);
export const approveQuestion = (roomId, quizId, qid = "all") => api.post(`${base(roomId, quizId)}/questions/${qid}/approve`).then((r) => r.data);
export const generateQuestions = (roomId, quizId, data) => api.post(`${base(roomId, quizId)}/questions/generate`, data).then((r) => r.data);
export const publishQuiz = (roomId, quizId) => api.post(`${base(roomId, quizId)}/publish`).then((r) => r.data.quiz);
export const unpublishQuiz = (roomId, quizId) => api.post(`${base(roomId, quizId)}/unpublish`).then((r) => r.data.quiz);
export const closeQuiz = (roomId, quizId) => api.post(`${base(roomId, quizId)}/close`).then((r) => r.data.quiz);
export const releaseResults = (roomId, quizId) => api.post(`${base(roomId, quizId)}/release`).then((r) => r.data.quiz);
export const getParticipation = (roomId, quizId) => api.get(`${base(roomId, quizId)}/participation`).then((r) => r.data);
export const getAttemptForGrading = (roomId, quizId, attemptId) => api.get(`${base(roomId, quizId)}/attempts/${attemptId}`).then((r) => r.data);
export const gradeAttempt = (roomId, quizId, attemptId, grades) => api.put(`${base(roomId, quizId)}/attempts/${attemptId}/grade`, { grades }).then((r) => r.data);
export const aiGradeAttempt = (roomId, quizId, attemptId) => api.post(`${base(roomId, quizId)}/attempts/${attemptId}/ai-grade`).then((r) => r.data);
export const confirmAiGrades = (roomId, quizId, attemptId) => api.post(`${base(roomId, quizId)}/attempts/${attemptId}/confirm-ai`).then((r) => r.data);

// member
export const startAttempt = (roomId, quizId) => api.post(`${base(roomId, quizId)}/attempts`).then((r) => r.data);
export const saveAnswers = (roomId, quizId, answers) => api.put(`${base(roomId, quizId)}/attempts/mine/answers`, { answers }).then((r) => r.data);
export const submitAttempt = (roomId, quizId, answers) => api.post(`${base(roomId, quizId)}/attempts/mine/submit`, { answers }).then((r) => r.data);
export const getMyResult = (roomId, quizId) => api.get(`${base(roomId, quizId)}/results/mine`).then((r) => r.data);
export const getLeaderboard = (roomId, quizId) => api.get(`${base(roomId, quizId)}/leaderboard`).then((r) => r.data);
