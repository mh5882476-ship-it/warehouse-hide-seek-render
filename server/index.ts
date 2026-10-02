import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const HIDING_MS = Number(process.env.HIDING_MS || 60_000);
const SEEKING_MS = Number(process.env.SEEKING_MS || 180_000);

type Role = "seeker" | "hider";
type Phase = "lobby" | "hiding" | "seeking" | "finished";
type Player = { id: string; name: string; role: Role; x: number; y: number; z: number; yaw: number; hidden: boolean; caught: boolean };
type Room = { code: string; players: Map<string, Player>; phase: Phase; phaseEndsAt: number | null; round: number; winner?: "seeker" | "hiders"; resultReason?: "time" | "caught"; timer?: NodeJS.Timeout };

const rooms = new Map<string, Room>();
const makeCode = () => { let code = ""; do { code = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (rooms.has(code)); return code; };
const publicRoom = (room: Room) => ({ code: room.code, phase: room.phase, phaseEndsAt: room.phaseEndsAt, round: room.round, winner: room.winner, resultReason: room.resultReason, players: Array.from(room.players.values()).map(({ id, name, role, x, y, z, yaw, hidden, caught }) => ({ id, name, role, x, y, z, yaw, hidden, caught })) });
const broadcast = (room: Room) => io.to(room.code).emit("room-state", publicRoom(room));

function startHiding(room: Room) {
  if (room.players.size < 2 || room.phase === "hiding" || room.phase === "seeking") return;
  room.phase = "hiding";
  room.round += 1;
  room.phaseEndsAt = Date.now() + HIDING_MS;
  room.winner = undefined;
  room.resultReason = undefined;
  room.players.forEach((player) => { player.caught = false; player.hidden = false; });
  broadcast(room);
  room.timer = setTimeout(() => startSeeking(room), HIDING_MS);
}
function startSeeking(room: Room) {
  if (!rooms.has(room.code)) return;
  room.phase = "seeking";
  room.phaseEndsAt = Date.now() + SEEKING_MS;
  broadcast(room);
  room.timer = setTimeout(() => finishRound(room, "time"), SEEKING_MS);
}
function finishRound(room: Room, reason: "time" | "caught") {
  if (!rooms.has(room.code)) return;
  room.phase = "finished";
  room.phaseEndsAt = null;
  room.winner = reason === "caught" ? "seeker" : "hiders";
  room.resultReason = reason;
  broadcast(room);
  room.timer = setTimeout(() => { if (room.players.size > 0) { room.phase = "lobby"; room.round += 1; broadcast(room); } }, 7_000);
}
function leaveRoom(socketId: string) {
  for (const code of Array.from(rooms.keys())) {
    const room = rooms.get(code);
    if (!room) continue;
    if (!room.players.has(socketId)) continue;
    room.players.delete(socketId);
    if (room.players.size === 0) { if (room.timer) clearTimeout(room.timer); rooms.delete(code); return; }
    if (!Array.from(room.players.values()).some((player) => player.role === "seeker")) {
      const next = room.players.values().next().value as Player | undefined;
      if (next) next.role = "seeker";
    }
    broadcast(room);
    return;
  }
}

io.on("connection", (socket) => {
  socket.on("create-room", ({ name }: { name?: string }) => {
    const code = makeCode();
    joinRoom(socket, code, name);
  });
  socket.on("join-room", ({ code, name }: { code?: string; name?: string }) => {
    const normalized = String(code || "").trim().toUpperCase();
    if (!rooms.has(normalized)) return socket.emit("room-error", "Room not found. Create a new room first.");
    joinRoom(socket, normalized, name);
  });
  socket.on("player-transform", (transform: { x: number; y: number; z: number; yaw: number; hidden: boolean }) => {
    const room = Array.from(rooms.values()).find((candidate) => candidate.players.has(socket.id));
    const player = room?.players.get(socket.id);
    if (!room || !player || room.phase === "finished") return;
    player.x = Number(transform.x) || 0; player.y = Number(transform.y) || 0; player.z = Number(transform.z) || 0; player.yaw = Number(transform.yaw) || 0; player.hidden = Boolean(transform.hidden);
    socket.to(room.code).emit("player-transform", { ...player });
  });
  socket.on("tag-player", ({ targetId }: { targetId?: string }) => {
    const room = Array.from(rooms.values()).find((candidate) => candidate.players.has(socket.id));
    const seeker = room?.players.get(socket.id);
    const target = targetId ? room?.players.get(targetId) : undefined;
    if (!room || !seeker || !target || seeker.role !== "seeker" || room.phase !== "seeking" || target.role !== "hider" || target.caught) return;
    const distance = Math.hypot(seeker.x - target.x, seeker.z - target.z);
    if (distance > 2.5) return;
    target.caught = true; target.hidden = false;
    broadcast(room);
    if (!Array.from(room.players.values()).some((player) => player.role === "hider" && !player.caught)) finishRound(room, "caught");
  });
  socket.on("disconnect", () => leaveRoom(socket.id));
});

function joinRoom(socket: import("socket.io").Socket, code: string, name?: string) {
  const room = rooms.get(code) || { code, players: new Map(), phase: "lobby" as Phase, phaseEndsAt: null, round: 0 };
  if (room.players.size >= 6) return socket.emit("room-error", "This room is full (maximum 6 players).");
  if (!rooms.has(code)) rooms.set(code, room);
  const role: Role = room.players.size === 0 ? "seeker" : "hider";
  room.players.set(socket.id, { id: socket.id, name: String(name || `Player ${room.players.size + 1}`).slice(0, 16), role, x: 0, y: 0.86, z: 2, yaw: 0, hidden: false, caught: false });
  socket.join(code);
  socket.emit("room-joined", { id: socket.id, code });
  broadcast(room);
  startHiding(room);
}

const staticPath = process.env.NODE_ENV === "production" ? path.resolve(__dirname, "public") : path.resolve(__dirname, "..", "dist", "public");
app.use(express.static(staticPath));
app.get("*", (_req, res) => res.sendFile(path.join(staticPath, "index.html")));

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Warehouse Hide & Seek server running on http://localhost:${port}`));
