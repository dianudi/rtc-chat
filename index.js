import http from "node:http";
import { WebSocketServer } from "ws";
import fs from "node:fs";
import path from "node:path";

const server = http.createServer((req, res) => {
  const filePath = path.join("dist", req.url === "/" ? "index.html" : req.url.replace(/^\//, ""));
  const extname = path.extname(filePath);
  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  const contentType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        // File not found, serve index.html untuk SPA (Single Page Application)
        if (req.url.startsWith("/api")) {
          res.writeHead(404);
          res.end("Not Found");
        } else {
          fs.readFile(path.join(__dirname, "dist", "index.html"), (err, content) => {
            if (err) {
              res.writeHead(500);
              res.end("Error loading index.html");
            } else {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(content, "utf-8");
            }
          });
        }
      } else {
        res.writeHead(500);
        res.end("Server Error: " + err.code);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

const wss = new WebSocketServer({ server });
const users = new Map();

function sendTo(ws, message) {
  ws.send(JSON.stringify(message));
}

function broadcastUserList() {
  const userList = [...users.keys()];
  users.forEach((ws, username) => {
    const otherUsers = userList.filter((user) => user !== username);
    sendTo(ws, { type: "userList", users: otherUsers });
  });
}

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    const recipient = users.get(data.to || data.to_username);

    switch (data.type) {
      case "join":
        users.set(data.username, ws);
        ws.username = data.username;
        broadcastUserList();
        break;

      case "offer":
        if (recipient) {
          sendTo(recipient, { type: "offer", offer: data.offer, from: ws.username });
        }
        break;

      case "answer":
        if (recipient) {
          sendTo(recipient, { type: "answer", answer: data.answer, from: ws.username });
        }
        break;

      case "iceCandidate":
        if (recipient) {
          sendTo(recipient, { type: "iceCandidate", candidate: data.candidate, from: ws.username });
        }
        break;

      default:
        console.info(`Unsupported message type: ${data.type}`);
        break;
    }
  });

  ws.on("close", () => {
    if (ws.username) {
      users.delete(ws.username);
      broadcastUserList();
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    if (ws.username) {
      users.delete(ws.username);
      broadcastUserList();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}`);
});
