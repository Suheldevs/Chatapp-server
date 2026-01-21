import { Server } from "socket.io";
import redis from "./redis.js";

export default function initSocket(server) {
  const io = new Server(server, {
    cors: { 
      origin: "*",
      methods: ["GET", "POST"]
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.handshake.auth?.userId;
    console.log("✅ New client connected:", socket.id, "UserID:", userId);
    
    if (!userId) {
      console.log("❌ No userId provided, disconnecting");
      return socket.disconnect();
    }

    // Store user connection
    await redis.hSet("connected_users", userId, socket.id);
    
    // Get all connected users
    const allUsers = await redis.hKeys("connected_users");
    console.log("📊 Total connected users:", allUsers.length);
    
    // Notify everyone about new user (except the new user itself)
    socket.broadcast.emit("user_connected", userId);
    
    // Send current users list to the new user
    socket.emit("all_users", allUsers);

    // 🔥 GLOBAL CHAT MESSAGES
    socket.on("chat_message", async (messageData) => {
      console.log("🌍 Global message from:", userId, "Message:", messageData.message);
      
      const payload = {
        ...messageData,
        sender: userId, // Use userId instead of socket.id
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };
      
      io.emit("chat_message", payload);
    });

    // 🔥 GET ALL USERS
    socket.on("get_users", async () => {
      console.log("📋 get_users event received from:", userId);
      const users = await redis.hKeys("connected_users");
      console.log("Connected users:", users);
      socket.emit("all_users", users);
    });

    // 🔥 PRIVATE MESSAGES
    socket.on("private_message", async ({ toUserId, message, sender, time }) => {
      console.log("🔒 Private message from:", userId, "to:", toUserId);
      
      const toSocketId = await redis.hGet("connected_users", toUserId);
      if (!toSocketId) {
        console.log("❌ Target user not found:", toUserId);
        socket.emit("error", { message: "User not connected" });
        return;
      }

      const payload = {
        message,
        sender: userId,
        time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };

      console.log("📤 Sending private message to:", toSocketId);
      io.to(toSocketId).emit("private_message", payload);
      
      // Also send back to sender for local storage
      socket.emit("private_message", {
        ...payload,
        type: 'sent'
      });
    });

    // 🔥 TYPING INDICATORS
    socket.on("typing", async ({ toUserId, typing }) => {
      console.log("⌨️ Typing event from:", userId, "to:", toUserId, "typing:", typing);
      
      const toSocketId = await redis.hGet("connected_users", toUserId);
      if (!toSocketId) return;

      io.to(toSocketId).emit("typing", {
        sender: userId,
        typing: typing
      });
    });

    // 🔥 USER DISCONNECTION
    socket.on("disconnect", async () => {
      console.log("❌ Client disconnected:", socket.id, "UserID:", userId);
      
      await redis.hDel("connected_users", userId);
      
      // Notify all other users about disconnection
      socket.broadcast.emit("user_disconnected", userId);
      
      // Get updated users list
      const remainingUsers = await redis.hKeys("connected_users");
      console.log("📊 Remaining users:", remainingUsers.length);
    });

    // 🔥 ERROR HANDLING
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    // 🔥 CONNECTION ACKNOWLEDGEMENT
    socket.emit("connected", {
      userId: userId,
      message: "Successfully connected to chat server"
    });
  });

  // Server-level events
  io.of("/").adapter.on("create-room", (room) => {
    console.log(`Room created: ${room}`);
  });

  io.of("/").adapter.on("join-room", (room, id) => {
    console.log(`Socket ${id} joined room ${room}`);
  });

  console.log("🚀 Socket.IO server initialized");
  return io;
}