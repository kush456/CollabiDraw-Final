import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import roomsRouter from "./routes/rooms";
import http from "http";
import { Server } from "socket.io";
import { setupSocketServer } from "./socket/socketServer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.VITE_FRONTEND_PROD_URL || "https://collabidraw.vercel.app", // your frontend
    methods: ["GET", "POST"],
    credentials: true
  },
});

setupSocketServer(io);

app.use(cors());
// Quick fix in your backend index.js/app.js
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ Health check route (public)
app.get("/", (_, res) => {
  res.send("Backend is running on port " + PORT);
});

// ✅ All /rooms routes
app.use("/rooms", roomsRouter);

// Use server.listen instead of app.listen for Socket.IO
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO server is ready`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});