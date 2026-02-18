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

  const opts = {
    cwd: __dirname,
    shell: true,
    detached: true,
    stdio: "ignore",
  };

  // argv: [node, "terminal-client.js", userId] — script relative rahe taaki client ko sahi argv mile
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", '"Terminal Chat"', "node", "terminal-client.js", userId], opts);
  } else {
    spawn("gnome-terminal", ["--", "node", "terminal-client.js", userId], opts);
  }

  res.json({ success: true });
});

