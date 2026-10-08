import api from "./api.js";

// The conversation lives on the client; the whole thread is sent each turn.
// `materialId` (optional) grounds the answer in one material's content.
export async function sendChatMessage(messages, materialId) {
  const res = await api.post("/assistant/chat", { messages, materialId });
  return res.data.reply;
}
