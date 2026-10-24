import api from "./api.js";

// ---- Snap a Question
export const extractSnap = (file) => {
  const fd = new FormData();
  fd.append("image", file);
  return api.post("/study/snap/extract", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
export const answerSnap = (snapId, text) => api.post(`/study/snap/${snapId}/answer`, { text }).then((r) => r.data);
export const answerTypedQuestion = (text) => api.post("/study/snap/answer-text", { text }).then((r) => r.data);
export const snapHistory = (params) => api.get("/study/snap/history", { params }).then((r) => r.data);
export const deleteSnap = (id) => api.delete(`/study/snap/${id}`).then((r) => r.data);

// ---- Flashcards
export const getMaterialTopics = (materialId) => api.post("/study/flashcards/topics", { materialId }).then((r) => r.data);
export const generateFlashcards = (data) => api.post("/study/flashcards/generate", data).then((r) => r.data.deck);
export const listDecks = (params) => api.get("/study/flashcards", { params }).then((r) => r.data);
export const getDeck = (id) => api.get(`/study/flashcards/${id}`).then((r) => r.data);
export const renameDeck = (id, title) => api.put(`/study/flashcards/${id}`, { title }).then((r) => r.data);
export const deleteDeck = (id) => api.delete(`/study/flashcards/${id}`).then((r) => r.data);
export const addCard = (id, card) => api.post(`/study/flashcards/${id}/cards`, card).then((r) => r.data);
export const updateCard = (id, cardId, patch) => api.put(`/study/flashcards/${id}/cards/${cardId}`, patch).then((r) => r.data);
export const deleteCard = (id, cardId) => api.delete(`/study/flashcards/${id}/cards/${cardId}`).then((r) => r.data);

// ---- Mock exams
export const generateExam = (data) => api.post("/study/exams/generate", data).then((r) => r.data);
export const listExams = (params) => api.get("/study/exams", { params }).then((r) => r.data);
export const getExam = (id) => api.get(`/study/exams/${id}`).then((r) => r.data);
export const deleteExam = (id) => api.delete(`/study/exams/${id}`).then((r) => r.data);
export const startExam = (id) => api.post(`/study/exams/${id}/attempts`).then((r) => r.data);
export const getExamAttempt = (attemptId) => api.get(`/study/exams/attempts/${attemptId}`).then((r) => r.data);
export const saveExamAnswers = (attemptId, answers) => api.put(`/study/exams/attempts/${attemptId}/answers`, { answers }).then((r) => r.data);
export const checkExamAnswer = (attemptId, questionId) => api.post(`/study/exams/attempts/${attemptId}/check`, { questionId }).then((r) => r.data);
export const submitExam = (attemptId, answers) => api.post(`/study/exams/attempts/${attemptId}/submit`, { answers }).then((r) => r.data);
export const adjustTheoryMarks = (attemptId, body) => api.put(`/study/exams/attempts/${attemptId}/theory-marks`, body).then((r) => r.data);
export const examHistory = (params) => api.get("/study/exams/attempts", { params }).then((r) => r.data);
export const examAnalytics = () => api.get("/study/exams/analytics").then((r) => r.data);
