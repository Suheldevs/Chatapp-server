import express from "express";
import http from "http";
import socketConfig from "./socket.js";
import cors from "cors";
const app = express();
const server = http.createServer(app);

app.use(cors());

app.get("/", (req, res) => {
  res.send("Server running");
});

socketConfig(server);

server.listen(3000, () => {
  console.log("Server listening on 3000");
});


