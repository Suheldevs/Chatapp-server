import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import socketConfig from "./socket.js";
import cors from "cors";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json()); 
app.get("/", (req, res) => {
  res.send("Server running");
});

socketConfig(server);

server.listen(3000, () => {
  console.log("Server listening on 3000");
});




app.post("/open-terminal", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).send("userId required");

  // Server URL detect karo - request headers se ya environment variable se
  const protocol = req.protocol || (req.headers['x-forwarded-proto'] || 'http');
  const host = req.get('host') || req.headers.host || 'localhost:3000';
  const serverUrl = process.env.SERVER_URL || `${protocol}://${host}`;

  const command = `node terminal-client.js ${serverUrl} ${userId}`;

  // Production/cloud server par terminal spawn nahi kar sakte
  // Local development ke liye hi spawn karo
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || process.env.ALLOW_TERMINAL_SPAWN === 'true';
  
  if (!isLocal) {
    // Production server - command return karo
    return res.json({ 
      success: true, 
      serverUrl,
      userId,
      command,
      message: 'Run this command on your local machine to open terminal',
      instructions: `Open terminal and run:\n${command}`
    });
  }

  // Local development - terminal spawn karo
  const opts = {
    cwd: __dirname,
    shell: true,
    detached: true,
    stdio: "ignore",
  };

  try {
    // Terminal client ko server URL aur userId dono pass karo
    // Format: node terminal-client.js <serverUrl> <userId>
    let childProcess;
    if (process.platform === "win32") {
      childProcess = spawn("cmd", ["/c", "start", '"Terminal Chat"', "node", "terminal-client.js", serverUrl, userId], opts);
    } else {
      childProcess = spawn("gnome-terminal", ["--", "node", "terminal-client.js", serverUrl, userId], opts);
    }

    childProcess.on('error', (err) => {
      console.error('Failed to spawn terminal:', err);
    });

    // Unref karo taaki parent process exit ho sake
    childProcess.unref();

    res.json({ success: true, serverUrl, userId, spawned: true });
  } catch (error) {
    console.error('Error spawning terminal:', error);
    res.json({ 
      success: false, 
      error: 'Failed to open terminal',
      serverUrl,
      userId,
      command
    });
  }
});

