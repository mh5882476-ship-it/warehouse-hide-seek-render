# Assets

**Art direction:** Stylized realistic warehouse interior in deep navy shadows, dusty teal steel, rust-orange wood/crates and warm amber practical lamps. Third-person player is centered in clear aisles; HUD uses restrained amber accents and translucent dark panels.

## Reference
- `warehouse-hide-seek-reference.png` — generated visual target at `/home/ubuntu/webdev-static-assets/warehouse-hide-seek-reference.png`.
- Prompt: in-game third-person screenshot of a compact warehouse training map with player, shelves, crates, workbench, warm overhead lamps and mobile HUD. No flashlight or multiplayer UI.

## Runtime assets
- Geometry and materials are procedural Babylon.js meshes in `client/src/game/scene.ts`; no large binary assets are committed to the web project.
- Stage 2 lighting is procedural: camera-attached cool-white seeker spotlight, warm practical lights, exponential blue-black fog and restrained glow.
- Hideable furniture is represented by the procedural orange cargo crates and cover crates; interaction is proximity-based.
