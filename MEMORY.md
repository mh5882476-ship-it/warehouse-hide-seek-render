# Memory

- Stage 1 is intentionally single-player only.
- Babylon Engine is guarded against React StrictMode double-mount in `GameCanvas.tsx`.
- Input is semantic: keyboard listeners plus custom window events from the touch UI.
- The scene uses procedural meshes so it remains lightweight for later Capacitor wrapping.
- Stage 2 is now implemented: camera-attached seeker spotlight, fog, low ambient fill, obstacle AABB collision, and proximity hide interaction.
- Hide interaction uses `E` on desktop and a contextual mobile button; player meshes disappear while hidden and can be restored from cover.
- Stage 3 multiplayer, room lobby and Socket.io are implemented; Stage 4 Capacitor packaging remains intentionally deferred.
- Stage 3 is now implemented with `server/index.ts` using in-memory rooms and Socket.io events: create/join room, room-state, player-transform and tag-player.
- First player in a room is Seeker; later players are Hiders. A second player starts Hiding for 60 seconds, then Seeking for 180 seconds; caught-all or timeout finishes the round.
- Client lobby connects with `socket.io-client`, renders roster/role/phase/timer, and scene renders remote avatars from synchronized transforms.
- Dev Vite preview is intentionally Vite-only, so its lobby can show SOCKET OFFLINE. The built Node server was separately smoke-tested on port 3100 with two websocket clients and showed SOCKET ONLINE.
- For always-on production multiplayer, run the built Node server on persistent hosting rather than a static-only preview.
