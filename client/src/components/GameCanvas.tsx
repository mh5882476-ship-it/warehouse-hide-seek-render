import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";

type Phase = "lobby" | "hiding" | "seeking" | "finished";
type PlayerState = { id: string; name: string; role: "seeker" | "hider"; x: number; y: number; z: number; yaw: number; hidden: boolean; caught: boolean };
type RoomState = { code: string; phase: Phase; phaseEndsAt: number | null; round: number; winner?: "seeker" | "hiders"; resultReason?: "time" | "caught"; players: PlayerState[] };

function emitMove(x: number, y: number) { window.dispatchEvent(new CustomEvent("hide-seek:move", { detail: { x, y } })); }

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const [crouching, setCrouching] = useState(false);
  const [nearbyHideSpot, setNearbyHideSpot] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myId, setMyId] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const tagTargetRef = useRef("");
  const myRoleRef = useRef<"seeker" | "hider" | undefined>(undefined);
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickActive = useRef(false);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => { setConnected(true); setError(""); });
    socket.on("connect_error", () => { setConnected(false); setError("Realtime server is not connected in this preview."); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("room-joined", ({ id, code }: { id: string; code: string }) => { setMyId(id); setRoomInput(code); setError(""); });
    socket.on("room-error", (message: string) => setError(message));
    socket.on("room-state", (state: RoomState) => {
      setRoom(state);
      const mine = state.players.find((player) => player.id === myId || player.id === socket.id);
      if (mine) { setMyId(mine.id); setHidden(mine.hidden); }
      window.dispatchEvent(new CustomEvent("hide-seek:remote-state", { detail: { localId: mine?.id || socket.id, players: state.players } }));
    });
    socket.on("player-transform", (player: PlayerState) => window.dispatchEvent(new CustomEvent("hide-seek:remote-transform", { detail: player })));
    const onLocalTransform = (event: Event) => { const detail = (event as CustomEvent<{ x: number; y: number; z: number; yaw: number; hidden: boolean }>).detail; socket.emit("player-transform", detail); };
    const onInteraction = (event: Event) => { const detail = (event as CustomEvent<{ nearby: boolean; hidden: boolean }>).detail; setNearbyHideSpot(detail.nearby); setHidden(detail.hidden); };
    const onTagTarget = (event: Event) => { const targetId = (event as CustomEvent<{ targetId: string }>).detail.targetId; tagTargetRef.current = targetId; if (myRoleRef.current === "seeker") setNearbyHideSpot(Boolean(targetId)); };
    const onAction = () => {
      if (myRoleRef.current === "seeker" && tagTargetRef.current) socket.emit("tag-player", { targetId: tagTargetRef.current });
      else window.dispatchEvent(new CustomEvent("hide-seek:interact"));
    };
    window.addEventListener("hide-seek:local-transform", onLocalTransform);
    window.addEventListener("hide-seek:interaction", onInteraction);
    window.addEventListener("hide-seek:tag-target", onTagTarget);
    window.addEventListener("hide-seek:action", onAction);
    return () => { window.removeEventListener("hide-seek:local-transform", onLocalTransform); window.removeEventListener("hide-seek:interaction", onInteraction); window.removeEventListener("hide-seek:tag-target", onTagTarget); window.removeEventListener("hide-seek:action", onAction); socket.disconnect(); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    let handle: GameHandle | null = null;
    createGameScene(engine, canvas).then((created) => { handle = created; engine.runRenderLoop(() => created.scene.render()); });
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); handle?.dispose(); engine.dispose(); startedRef.current = false; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!room?.phaseEndsAt) return setSecondsLeft(null);
      setSecondsLeft(Math.max(0, Math.ceil((room.phaseEndsAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [room?.phaseEndsAt]);

  const updateJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const radius = rect.width * 0.34;
    emitMove(Math.max(-1, Math.min(1, dx / radius)), Math.max(-1, Math.min(1, -dy / radius)));
    const knob = joystickRef.current.firstElementChild as HTMLElement | null;
    if (knob) knob.style.transform = `translate(${Math.max(-radius, Math.min(radius, dx))}px, ${Math.max(-radius, Math.min(radius, dy))}px)`;
    joystickActive.current = true;
  };
  const endJoystick = () => { joystickActive.current = false; emitMove(0, 0); const knob = joystickRef.current?.firstElementChild as HTMLElement | null; if (knob) knob.style.transform = "translate(0, 0)"; };
  const toggleCrouch = () => { setCrouching((value) => !value); window.dispatchEvent(new CustomEvent("hide-seek:crouch")); };
  const triggerAction = () => window.dispatchEvent(new CustomEvent("hide-seek:action"));
  const join = (create: boolean) => { setError(""); const displayName = name.trim() || "Player"; if (create) socketRef.current?.emit("create-room", { name: displayName }); else socketRef.current?.emit("join-room", { code: roomInput, name: displayName }); };
  const phaseLabel = room?.phase === "hiding" ? "HIDERS DEPLOY" : room?.phase === "seeking" ? "SEEKER ACTIVE" : room?.phase === "finished" ? "ROUND COMPLETE" : "WAITING ROOM";
  const myPlayer = room?.players.find((player) => player.id === myId);
  myRoleRef.current = myPlayer?.role;

  return (
    <div className="game-shell">
      <canvas ref={canvasRef} className="game-canvas" style={{ touchAction: "none" }} />
      <div className="game-ui">
        <div className="brand-lockup"><span className="eyebrow">MULTIPLAYER / TRAINING MAP</span><h1>Warehouse <i>Hide & Seek</i></h1></div>
        <div className="objective-card"><span className={`status-dot ${connected ? "connected" : ""}`} /><div><small>ROUND {String(room?.round || 0).padStart(2, "0")} / {phaseLabel}</small><strong>{room ? `${room.players.length}/6 OPERATORS · ${secondsLeft ?? "—"}s` : "Connect to a room"}</strong></div><span className="torch-mark">◉</span></div>
        {room && <div className="room-pill"><span>ROOM</span><b>{room.code}</b><small>{myPlayer?.role === "seeker" ? "SEEKER" : "HIDER"}</small></div>}
        {room && <div className="player-list">{room.players.map((player) => <div className="player-row" key={player.id}><span className={`role-dot ${player.role}`} /><span>{player.name}{player.id === myId ? " · YOU" : ""}</span><b>{player.caught ? "CAUGHT" : player.role.toUpperCase()}</b></div>)}</div>}
        <div className="control-hint"><span className="key-chip">W A S D</span><span>move</span><span className="key-chip">DRAG</span><span>camera</span><span className="key-chip">E</span><span>{myPlayer?.role === "seeker" ? "tag" : "hide"}</span></div>
        <div className="mobile-controls">
          <div ref={joystickRef} className="joystick" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); updateJoystick(e); }} onPointerMove={(e) => joystickActive.current && updateJoystick(e)} onPointerUp={endJoystick} onPointerCancel={endJoystick}><div className="joystick-knob" /></div>
          <button className={`crouch-button ${crouching ? "active" : ""}`} onPointerDown={toggleCrouch}><span className="crouch-icon">⌄</span><span>{crouching ? "CROUCHED" : "HIDE / CROUCH"}</span></button>
          {nearbyHideSpot && <button className={`interact-button ${hidden ? "active" : ""}`} onPointerDown={triggerAction}><span>✦</span><b>{myPlayer?.role === "seeker" ? "TAG HIDER" : hidden ? "EXIT COVER" : "HIDE HERE"}</b></button>}
        </div>
        <div className="bottom-bar"><span className="live-dot" /><span>{connected ? "SOCKET ONLINE" : "SOCKET OFFLINE"}</span><span className="bar-divider" /><span>{room ? `ROOM ${room.code}` : "CREATE OR JOIN A ROOM"}</span></div>
        {room?.phase === "finished" && <div className="result-overlay"><div className="result-card"><span className="eyebrow">ROUND {String(room.round).padStart(2, "0")} COMPLETE</span><h2>{room.winner === "seeker" ? "Seeker wins" : "Hiders survive"}</h2><p>{room.resultReason === "caught" ? "Every hider was found before the clock ran out." : "The hiding timer expired. The warehouse stays quiet."}</p><div className="result-stats"><span><b>{room.players.filter((player) => player.caught).length}</b> caught</span><span><b>{room.players.length}</b> operators</span></div></div></div>}
        {!room && <div className="lobby-overlay"><div className="lobby-card"><div className="lobby-kicker"><span className="live-dot" /> {connected ? "REALTIME LINK READY" : "CONNECTING TO REALTIME"}</div><h2>Enter the <i>warehouse</i></h2><p>Join a room with 2–6 players. The first operator becomes Seeker; everyone else hides.</p><label>CALLSIGN<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Nightwatch" maxLength={16} /></label><label>ROOM CODE<input value={roomInput} onChange={(event) => setRoomInput(event.target.value.toUpperCase())} placeholder="AB12" maxLength={4} /></label><div className="lobby-actions"><button onClick={() => join(true)}>CREATE ROOM</button><button className="secondary" onClick={() => join(false)}>JOIN ROOM</button></div>{error && <div className="lobby-error">{error}</div>}<small className="lobby-note">Room state is server-authoritative · 60s hiding phase</small></div></div>}
      </div>
    </div>
  );
}
