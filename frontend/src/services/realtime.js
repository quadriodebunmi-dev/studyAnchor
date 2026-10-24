// Thin Socket.IO wrapper. Realtime is an enhancement: every screen works over
// plain REST, and when the server has no socket support (e.g. serverless) the
// connection simply never opens and callers fall back to polling.
let socket = null;
let loading = null;

function socketUrl() {
  const explicit = import.meta.env.VITE_SOCKET_URL;
  if (explicit) return explicit;
  const api = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
  return api.replace(/\/api\/?$/, "");
}

export async function getSocket() {
  const token = localStorage.getItem("study-anchor-token");
  if (!token) return null;
  if (socket) return socket;
  if (!loading) {
    loading = import("socket.io-client")
      .then(({ io }) => {
        socket = io(socketUrl(), {
          auth: (cb) => cb({ token: localStorage.getItem("study-anchor-token") }),
          reconnectionAttempts: 5,
          timeout: 6000,
        });
        socket.on("connect_error", () => {}); // stay quiet; REST polling covers us
        return socket;
      })
      .catch(() => null);
  }
  return loading;
}

export function closeSocket() {
  socket?.close();
  socket = null;
  loading = null;
}

/** Subscribes to events; returns an unsubscribe function. Safe if sockets are unavailable. */
export async function subscribe(events) {
  const s = await getSocket();
  if (!s) return () => {};
  for (const [name, fn] of Object.entries(events)) s.on(name, fn);
  return () => { for (const [name, fn] of Object.entries(events)) s.off(name, fn); };
}

/** Joins a room's channel (server verifies membership). Resolves to a leave function. */
export async function joinRoomChannel(roomId) {
  const s = await getSocket();
  if (!s) return () => {};
  const join = () => s.emit("room:join", { roomId });
  if (s.connected) join();
  s.on("connect", join); // re-join after a reconnect
  return () => { s.off("connect", join); s.emit("room:leave", { roomId }); };
}

export const isSocketConnected = () => Boolean(socket?.connected);
