#!/usr/bin/env node
import { io } from "socket.io-client";
import readline from "readline";

const [, , serverUrl, userId] = process.argv;

if (!serverUrl || !userId) {
  console.log("Usage: connect <server-url> <userId>");
  process.exit(1);
}

const socket = io(serverUrl, {
  auth: { userId }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.clear();
console.log("🔗 Connected to:", serverUrl);
console.log("👤 User:", userId);
console.log("Type /quit to exit\n");

socket.on("private_message", (msg) => {
  console.log(`\n${msg.sender}: ${msg.message}`);
  prompt();
});

socket.on("chat_message", (msg) => {
  console.log(`\n🌍 ${msg.sender}: ${msg.message}`);
  prompt();
});

function prompt() {
  rl.question("> ", (text) => {
    if (text === "/quit") process.exit(0);

    socket.emit("chat_message", {
      message: text,
    });

    prompt();
  });
}

prompt();
