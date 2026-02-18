import { Server } from "socket.io";
import redis from "./redis.js";

export default function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
  });

  /* ───────────── HELPERS ───────────── */

  async function getAllOnlineUsers() {
    const keys = await redis.keys("user:*:sockets");
    return keys.map(k => k.split(":")[1]);
  }

  async function emitToUser(userId, event, payload) {
    const sockets = await redis.sMembers(`user:${userId}:sockets`);
    for (const sid of sockets) {
      io.to(sid).emit(event, payload);
    }
  }

  /* ───────────── CONNECTION ───────────── */

  io.on("connection", async (socket) => {
    const userId = socket.handshake.auth?.userId;
    console.log("✅ New client:", socket.id, "User:", userId);

    if (!userId) {
      socket.disconnect();
      return;
    }

    /* store socket */
    await redis.sAdd(`user:${userId}:sockets`, socket.id);

    const allUsers = await getAllOnlineUsers();

    socket.broadcast.emit("user_connected", userId);
    socket.emit("all_users", allUsers);

    /* ───────────── GLOBAL CHAT ───────────── */

    socket.on("chat_message", async ({ message }) => {
      if (!message) return;

      const payload = {
        message,
        sender: userId,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        timestamp: Date.now(),
      };

      io.emit("chat_message", payload);
    });

    /* ───────────── GET USERS ───────────── */

    socket.on("get_users", async () => {
      const users = await getAllOnlineUsers();
      socket.emit("all_users", users);
    });

    /* ───────────── PRIVATE MESSAGE ───────────── */

    socket.on("private_message", async (data) => {
      const toUserId = String(data?.toUserId || "");
      const message = String(data?.message || "");

      if (!toUserId || !message) return;

      const payload = {
        message,
        sender: userId,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        timestamp: Date.now(),
      };

      // send to ALL devices of target user
      await emitToUser(toUserId, "private_message", payload);

      // send back to sender (all his devices)
      await emitToUser(userId, "private_message", {
        ...payload,
        type: "sent",
      });
    });

    /* ───────────── TYPING ───────────── */

    socket.on("typing", async ({ toUserId, typing }) => {
      if (!toUserId) return;

      await emitToUser(toUserId, "typing", {
        sender: userId,
        typing,
      });
    });

    /* ───────────── DISCONNECT ───────────── */

    socket.on("disconnect", async () => {
      await redis.sRem(`user:${userId}:sockets`, socket.id);

      const remaining = await redis.sCard(`user:${userId}:sockets`);
      if (remaining === 0) {
        socket.broadcast.emit("user_disconnected", userId);
      }
    });

    /* ───────────── ACK ───────────── */

    socket.emit("connected", {
      userId,
      message: "Connected successfully",
    });
  });

  console.log("🚀 Socket.IO server initialized");
  return io;
}
