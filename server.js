import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { chatModel } from "./chat.schema.js";

export const app = express();
app.use(cors());

export const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 🔹 Track users per room
const usersInRoom = {};

io.on("connection", (socket) => {
  console.log("Connection is established");

  // ... inside io.on('connection')
socket.on("typing", (data) => {
    // Broadcast to everyone in the room EXCEPT the person typing
    socket.broadcast.to(data.room).emit("displayTyping", {
        username: socket.username
    });
});

socket.on("stopTyping", (data) => {
    socket.broadcast.to(data.room).emit("removeTyping");
});

  // JOIN
  socket.on("join", ({ username, room }) => {
    socket.username = username;
    socket.room = room;

    socket.join(room);

    // initialize room if not exists
    if (!usersInRoom[room]) {
      usersInRoom[room] = [];
    }

    // add user
    usersInRoom[room].push(username);

    // send updated user list
    io.to(room).emit("updateUserList", usersInRoom[room]);

    // welcome message
    socket.emit("message", {
      text: `Welcome, ${username}!`
    });

    socket.broadcast.to(room).emit("message", {
      text: `${username} has joined the room`
    });
  });

  // SEND MESSAGE
  socket.on("sendMessage", async ({ username, message, room }) => {
    const chat = new chatModel({
      username,
      text: message,
      room
    });

    await chat.save();

    io.to(room).emit("message", {
      username,
      text: message
    });
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const room = socket.room;
    const username = socket.username;

    if (room && usersInRoom[room]) {
      // remove user
      usersInRoom[room] = usersInRoom[room].filter(
        (user) => user !== username
      );

      // update user list
      io.to(room).emit("updateUserList", usersInRoom[room]);

      socket.broadcast.to(room).emit("message", {
        text: `${username} has left the room`
      });
    }

    console.log("Connection is disconnected");
  });
});
