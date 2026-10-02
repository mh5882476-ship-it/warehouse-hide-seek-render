# Game Plan: Warehouse Hide & Seek — Stage 3

## Risk Tasks

### 1. Third-person camera + mobile camera drag
- **Why isolated:** A following camera must stay smooth while the player moves in camera-relative directions and mobile pointer drags adjust yaw/pitch.
- **Approach:** Use a Babylon FreeCamera with a damped follow offset around the player; movement vectors are derived from camera yaw; canvas pointer events emit camera deltas.
- **Verify:** Dragging the canvas or camera area rotates the view smoothly; WASD/joystick movement follows the rotated camera direction without snapping.

## Main Build
- **Scope:** Single-player procedural warehouse map with walls, floor, beams, shelves, crates, workbench, third-person player avatar, movement, crouch state, camera drag and mobile joystick. Stage 2 adds a camera-facing seeker spotlight, exponential fog, lower ambient fill, simple AABB obstacle collision, and hide-in-cover interaction. Stage 3 adds a Node.js Socket.io server, room-code lobby, authoritative room state, Seeker/Hider roles, 60-second hiding phase, seeking phase, round timeout, tag event, and remote player avatars.
- **Assets needed:** Procedural Babylon meshes; visual target reference defines navy/teal warehouse surfaces, rust-orange accents and amber lighting.
- **Verify:**
  - Player responds to WASD/arrow input and virtual joystick.
  - Third-person camera remains behind/above player and can be dragged.
  - Crouch button changes player stance and speed.
  - Seeker flashlight follows camera forward direction and illuminates the dark aisles.
  - Player cannot walk through crates, shelves, or workbench bounds.
  - Approaching a hideable crate exposes the hide action; `E` or the mobile action button toggles cover state.
  - HUD is readable on desktop and touch layouts do not overlap.
  - Capacitor packaging remains out of scope for this stage.
  - Two Socket.io clients can create/join the same room, receive role assignment and room-state broadcasts, and receive remote transform updates.
  - The first player is Seeker; subsequent players are Hiders; a second player starts the 60-second Hiding phase.
  - The production-shaped Node server starts cleanly and the client displays connected room/roster state.
  - Native Capacitor packaging remains out of scope.
  - No browser console errors or TypeScript errors.
