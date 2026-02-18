#!/usr/bin/env node
import { io } from "socket.io-client";
import readline from "readline";

// Support: node terminal-client.js [serverUrl] userId  ya  node terminal-client.js userId
const [, , serverUrlArg, userIdArg] = process.argv;
const SERVER_URL = userIdArg ? (serverUrlArg || "http://localhost:3000") : "http://localhost:3000";
const userId = userIdArg || serverUrlArg;

if (!userId) {
  console.log("Usage:");
  console.log("  node terminal-client.js <userId>");
  console.log("  node terminal-client.js <server-url> <userId>");
  process.exit(1);
}

const socket = io(SERVER_URL, {
  auth: { userId }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let onlineUsers = [];
let selectedUser = null;

/* ───────── UI ───────── */

function clear() {
  console.clear();
}

function header() {
  console.log("====================================");
  console.log(" Terminal Chat Client");
  console.log(" Server:", SERVER_URL);
  console.log(" User:", userId);
  console.log("====================================\n");
}

function help() {
  console.log(`
Commands:
/users   refresh users
/switch  change user
/clr     clear screen
/quit    exit
`);
}

/* ───────── SOCKET ───────── */

socket.on("connect", () => {
  clear();
  header();
  console.log("Connected ✅\n");
  socket.emit("get_users");
});

socket.on("all_users", (users) => {
  onlineUsers = users.filter(u => u !== userId);

  if (!onlineUsers.length) {
    console.log("No other users online");
    help();
    chatPrompt();
    return;
  }
  selectUser();
});

socket.on("private_message", ({ sender, message, type }) => {
  if (type !== "sent") {
    console.log(`\n${sender}: ${message}`);
    chatPrompt();
  }
});

/* ───────── USER SELECT ───────── */

function selectUser() {
  clear();
  header();
  console.log("Online users:");

  onlineUsers.forEach((u, i) => {
    console.log(`${i + 1}) ${u}`);
  });

  rl.question("\nSelect user number: ", (num) => {
    const idx = Number(num) - 1;
    if (!onlineUsers[idx]) return selectUser();

    selectedUser = onlineUsers[idx];
    clear();
    header();
    console.log(`Chatting with ${selectedUser}`);
    help();
    chatPrompt();
  });
}

/* ───────── CHAT ───────── */

function chatPrompt() {
  rl.question("> ", (text) => {
    if (!text.trim()) return chatPrompt();

    switch (text) {
      case "/quit":
        process.exit(0);

      case "/clr":
        clear();
        header();
        console.log(`Chatting with ${selectedUser}`);
        help();
        return chatPrompt();

      case "/users":
      case "/switch":
        selectedUser = null;
        socket.emit("get_users");
        return;

      default:
        socket.emit("private_message", {
          toUserId: selectedUser,
          message: text
        });
        return chatPrompt();
    }
  });
}
