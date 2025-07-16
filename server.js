import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://drew-five.vercel.app",
    methods: ["GET", "POST"],
  },
});

const activeRooms = new Set();

function generateSimpleRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase(); // 6-character alphanumeric
}

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("create-room", () => {
    let roomId;
    do {
      roomId = generateSimpleRoomId();
    } while (activeRooms.has(roomId));

    activeRooms.add(roomId);
    socket.join(roomId);
    socket.emit("room-created", roomId);
    console.log(`${socket.id} created and joined room: ${roomId}`);
  });

  socket.on("join-room", (roomId) => {
    if (activeRooms.has(roomId)) {
      socket.join(roomId);
      console.log(`${socket.id} joined existing room: ${roomId}`);
      updateRoomMembers(roomId);
      socket.emit("room-joined", roomId);
    } else {
      socket.emit("room-error", "Room does not exist.");
    }
  });

  socket.on("drawing", ({ roomId, data }) => {
    socket.to(roomId).emit("drawing", data);
  });

  socket.on("add-text", ({ roomId, data }) => {
    socket.to(roomId).emit("add-text", data);
  });

  socket.on("disconnecting", () => {
    socket.rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        setTimeout(() => updateRoomMembers(roomId), 100);
      }
    });
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    cleanUpEmptyRooms();
  });

  function updateRoomMembers(roomId) {
    const members = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    io.to(roomId).emit("room-members", members);
  }

  function cleanUpEmptyRooms() {
    activeRooms.forEach((roomId) => {
      const members = io.sockets.adapter.rooms.get(roomId);
      if (!members || members.size === 0) {
        activeRooms.delete(roomId);
        console.log(`Room ${roomId} deleted because it's empty.`);
      }
    });
  }
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
