import { Engine, Scene, Vector3, Color3, HemisphericLight, DirectionalLight, PointLight, SpotLight, MeshBuilder, StandardMaterial, FreeCamera, ShadowGenerator, GlowLayer } from "@babylonjs/core";

export type GameHandle = { scene: Scene; dispose: () => void };
type TouchMove = { x: number; y: number };

type GameInput = {
  forward: number;
  right: number;
  crouching: boolean;
  hidden: boolean;
  cameraYaw: number;
  cameraPitch: number;
};

const input: GameInput = { forward: 0, right: 0, crouching: false, hidden: false, cameraYaw: 0.35, cameraPitch: 0.18 };

function mat(scene: Scene, name: string, color: Color3, roughness = 0.78) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.12, 0.12, 0.12);
  material.roughness = roughness;
  return material;
}

function box(scene: Scene, name: string, size: { w: number; h: number; d: number }, pos: Vector3, material: StandardMaterial) {
  const mesh = MeshBuilder.CreateBox(name, { width: size.w, height: size.h, depth: size.d }, scene);
  mesh.position = pos;
  mesh.material = material;
  mesh.receiveShadows = true;
  return mesh;
}

function createShelf(scene: Scene, x: number, z: number, metal: StandardMaterial, wood: StandardMaterial) {
  const group = MeshBuilder.CreateBox(`shelf-${x}-${z}`, { width: 0.1, height: 2.7, depth: 0.1 }, scene);
  group.position = new Vector3(x, 1.35, z);
  group.material = metal;
  for (const dz of [-1.15, 0, 1.15]) {
    box(scene, "shelf-board", { w: 2.4, h: 0.1, d: 0.65 }, new Vector3(x, 0.28 + (dz + 1.15) * 0.52, z), wood);
  }
  for (const dx of [-1.15, 1.15]) {
    for (const y of [0.25, 1.35, 2.55]) box(scene, "shelf-post", { w: 0.1, h: 2.7, d: 0.1 }, new Vector3(x + dx, 1.35, z), metal);
  }
  return group;
}

function createPlayer(scene: Scene, bodyMat: StandardMaterial, skinMat: StandardMaterial) {
  const root = MeshBuilder.CreateBox("player-root", { width: 0.62, height: 1.72, depth: 0.42 }, scene);
  root.position = new Vector3(0, 0.86, 2.0);
  root.isVisible = false;
  const body = MeshBuilder.CreateBox("player-body", { width: 0.62, height: 0.88, depth: 0.42 }, scene);
  body.parent = root;
  body.position.y = -0.18;
  body.material = bodyMat;
  const head = MeshBuilder.CreateSphere("player-head", { diameter: 0.48, segments: 16 }, scene);
  head.parent = root;
  head.position.y = 0.52;
  head.material = skinMat;
  const cap = MeshBuilder.CreateCylinder("player-cap", { diameter: 0.54, height: 0.12, tessellation: 16 }, scene);
  cap.parent = root;
  cap.position.y = 0.78;
  cap.material = bodyMat;
  const legMat = mat(scene, "player-jeans", new Color3(0.06, 0.12, 0.19));
  for (const x of [-0.18, 0.18]) {
    const leg = MeshBuilder.CreateBox("player-leg", { width: 0.16, height: 0.66, depth: 0.2 }, scene);
    leg.parent = root;
    leg.position = new Vector3(x, -0.96, 0);
    leg.material = legMat;
  }
  return root;
}

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color3(0.035, 0.055, 0.075).toColor4(1);
  scene.ambientColor = new Color3(0.045, 0.06, 0.08);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.018;
  scene.fogColor = new Color3(0.035, 0.05, 0.07);

  const floorMat = mat(scene, "concrete-floor", new Color3(0.24, 0.28, 0.29));
  const wallMat = mat(scene, "warehouse-walls", new Color3(0.18, 0.23, 0.26));
  const metalMat = mat(scene, "painted-steel", new Color3(0.26, 0.38, 0.42));
  const woodMat = mat(scene, "aged-wood", new Color3(0.48, 0.26, 0.13));
  const crateMat = mat(scene, "crate-orange", new Color3(0.62, 0.3, 0.14));
  const accentMat = mat(scene, "safety-yellow", new Color3(0.85, 0.45, 0.08));
  const bodyMat = mat(scene, "player-hoodie", new Color3(0.65, 0.08, 0.045));
  const skinMat = mat(scene, "player-skin", new Color3(0.62, 0.38, 0.22));

  box(scene, "floor", { w: 22, h: 0.2, d: 18 }, new Vector3(0, -0.1, 0), floorMat);
  box(scene, "back-wall", { w: 22, h: 5.2, d: 0.25 }, new Vector3(0, 2.5, -9), wallMat);
  box(scene, "left-wall", { w: 0.25, h: 5.2, d: 18 }, new Vector3(-11, 2.5, 0), wallMat);
  box(scene, "right-wall", { w: 0.25, h: 5.2, d: 18 }, new Vector3(11, 2.5, 0), wallMat);
  box(scene, "front-wall", { w: 22, h: 5.2, d: 0.25 }, new Vector3(0, 2.5, 9), wallMat);

  for (const x of [-8, -4, 0, 4, 8]) {
    box(scene, "ceiling-beam", { w: 0.22, h: 0.22, d: 17.5 }, new Vector3(x, 5, 0), metalMat);
  }
  for (const z of [-6, 0, 6]) {
    const lamp = MeshBuilder.CreateBox("ceiling-lamp", { width: 2.6, height: 0.08, depth: 0.42 }, scene);
    lamp.position = new Vector3(0, 4.84, z);
    const lampMat = mat(scene, `lamp-${z}`, new Color3(0.95, 0.56, 0.18), 0.22);
    lamp.material = lampMat;
    const light = new HemisphericLight(`warm-lamp-${z}`, new Vector3(0, -1, 0), scene);
    light.intensity = 0.34;
    light.diffuse = new Color3(1, 0.52, 0.24);
    light.groundColor = new Color3(0.04, 0.05, 0.08);
  }

  for (const [x, z] of [[-5, -3], [4, -2], [-1, 5]] as number[][]) {
    const fill = new PointLight(`fill-light-${x}-${z}`, new Vector3(x, 4, z), scene);
    fill.diffuse = new Color3(1, 0.46, 0.2);
    fill.specular = new Color3(0.2, 0.16, 0.1);
    fill.intensity = 0.8;
    fill.range = 10;
  }

  createShelf(scene, -7, -2.5, metalMat, woodMat);
  createShelf(scene, 6.7, -3.2, metalMat, woodMat);
  createShelf(scene, 6.7, 3.5, metalMat, woodMat);
  for (const p of [
    [-7.8, 0.55, 5.8, 1.4, 1.1, 1.3], [-6.2, 0.35, 5.8, 1.1, 0.7, 1.1],
    [2.8, 0.45, -5.8, 1.7, 0.9, 1.4], [4.5, 0.9, -5.5, 1.2, 1.8, 1.2],
    [-2.7, 0.35, 1.3, 1.2, 0.7, 1.2], [3.0, 0.35, 3.5, 1.5, 0.7, 1.1],
  ] as number[][]) box(scene, "hiding-crate", { w: p[3], h: p[4], d: p[5] }, new Vector3(p[0], p[1], p[2]), crateMat);
  box(scene, "workbench", { w: 4.2, h: 0.22, d: 0.85 }, new Vector3(-2.8, 1.35, -5.9), woodMat);
  for (const x of [-4.6, -1.0]) box(scene, "bench-leg", { w: 0.18, h: 1.35, d: 0.18 }, new Vector3(x, 0.67, -5.9), metalMat);
  box(scene, "yellow-marking", { w: 7.5, h: 0.025, d: 0.08 }, new Vector3(0, 0.02, 7.7), accentMat);

  const sun = new DirectionalLight("warehouse-sun", new Vector3(-0.25, -1, 0.35), scene);
  sun.position = new Vector3(4, 8, 2);
  sun.intensity = 0.72;
  sun.diffuse = new Color3(0.6, 0.72, 0.8);
  const shadows = new ShadowGenerator(1024, sun);
  shadows.useBlurExponentialShadowMap = true;

  const player = createPlayer(scene, bodyMat, skinMat);
  player.getChildMeshes().forEach((mesh) => shadows.addShadowCaster(mesh));
  const camera = new FreeCamera("third-person-camera", new Vector3(0, 3.5, 8), scene);
  camera.minZ = 0.05;
  camera.fov = 0.92;
  scene.activeCamera = camera;
  const remotePlayers = new Map<string, ReturnType<typeof createPlayer>>();
  const remoteRoles = new Map<string, string>();
  const remoteBodyMat = mat(scene, "remote-hider", new Color3(0.08, 0.38, 0.42));
  const remoteSkinMat = mat(scene, "remote-skin", new Color3(0.45, 0.3, 0.2));
  let localPlayerId: string | null = null;
  const ensureRemote = (id: string, role: string) => {
    if (remotePlayers.has(id)) return remotePlayers.get(id)!;
    const avatar = createPlayer(scene, role === "seeker" ? bodyMat : remoteBodyMat, remoteSkinMat);
    avatar.position = new Vector3(0, 0.86, 0);
    remotePlayers.set(id, avatar);
    return avatar;
  };
  const onRemoteState = (event: Event) => {
    const detail = (event as CustomEvent<{ localId: string; players: Array<{ id: string; role: string; x: number; y: number; z: number; yaw: number; hidden: boolean; caught: boolean }> }>).detail;
    localPlayerId = detail.localId;
    const present = new Set<string>();
    detail.players.forEach((remote) => {
      if (remote.id === localPlayerId) return;
      present.add(remote.id);
      remoteRoles.set(remote.id, remote.role);
      const avatar = ensureRemote(remote.id, remote.role);
      avatar.position.set(remote.x, remote.y, remote.z);
      avatar.rotation.y = remote.yaw;
      avatar.getChildMeshes().forEach((mesh) => { mesh.isVisible = !remote.hidden && !remote.caught; });
    });
    remotePlayers.forEach((avatar, id) => { if (!present.has(id)) { avatar.dispose(); remotePlayers.delete(id); } });
    remoteRoles.forEach((_role, id) => { if (!present.has(id)) remoteRoles.delete(id); });
  };
  const onRemoteTransform = (event: Event) => {
    const remote = (event as CustomEvent<{ id: string; role: string; x: number; y: number; z: number; yaw: number; hidden: boolean; caught: boolean }>).detail;
    if (remote.id === localPlayerId) return;
    const avatar = ensureRemote(remote.id, remote.role);
    remoteRoles.set(remote.id, remote.role);
    avatar.position.set(remote.x, remote.y, remote.z);
    avatar.rotation.y = remote.yaw;
    avatar.getChildMeshes().forEach((mesh) => { mesh.isVisible = !remote.hidden && !remote.caught; });
  };
  window.addEventListener("hide-seek:remote-state", onRemoteState);
  window.addEventListener("hide-seek:remote-transform", onRemoteTransform);

  const flashlight = new SpotLight("seeker-flashlight", camera.position.clone(), new Vector3(0, -0.12, -1), Math.PI / 4.2, 2.2, scene);
  flashlight.parent = camera;
  flashlight.intensity = 5.5;
  flashlight.range = 17;
  flashlight.diffuse = new Color3(0.72, 0.86, 1);
  flashlight.specular = new Color3(0.45, 0.55, 0.7);
  flashlight.shadowEnabled = true;
  flashlight.shadowMinZ = 0.1;
  flashlight.shadowMaxZ = 18;

  const collisionBoxes = [
    { x: -7.8, z: 5.8, hw: 0.82, hd: 0.78 }, { x: -6.2, z: 5.8, hw: 0.68, hd: 0.68 },
    { x: 2.8, z: -5.8, hw: 0.98, hd: 0.82 }, { x: 4.5, z: -5.5, hw: 0.72, hd: 0.72 },
    { x: -2.7, z: 1.3, hw: 0.72, hd: 0.72 }, { x: 3.0, z: 3.5, hw: 0.82, hd: 0.68 },
    { x: -2.8, z: -5.9, hw: 2.2, hd: 0.6 },
    { x: -7, z: -2.5, hw: 1.35, hd: 0.62 }, { x: 6.7, z: -3.2, hw: 1.35, hd: 0.62 }, { x: 6.7, z: 3.5, hw: 1.35, hd: 0.62 },
  ];
  const hideSpots = [
    { x: -7.8, z: 5.8, label: "crate stack" }, { x: -6.2, z: 5.8, label: "crate stack" },
    { x: 2.8, z: -5.8, label: "cargo crate" }, { x: -2.7, z: 1.3, label: "cover crate" }, { x: 3, z: 3.5, label: "cover crate" },
  ];
  let nearbyHideSpot = false;
  let previousNearby = false;
  let previousHidden = false;
  const setPlayerVisible = (visible: boolean) => player.getChildMeshes().forEach((mesh) => { mesh.isVisible = visible; });
  const emitInteraction = (nearby: boolean, hidden: boolean) => {
    if (nearby !== previousNearby || hidden !== previousHidden) {
      window.dispatchEvent(new CustomEvent("hide-seek:interaction", { detail: { nearby, hidden } }));
      previousNearby = nearby;
      previousHidden = hidden;
    }
  };

  const glow = new GlowLayer("small-accent-glow", scene);
  glow.intensity = 0.18;
  const cameraState = { yaw: input.cameraYaw, pitch: input.cameraPitch };
  let disposed = false;

  const onKeyDown = (event: KeyboardEvent) => {
    if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift", "e", "E"].includes(event.key)) event.preventDefault();
    if (event.key === "w" || event.key === "ArrowUp") input.forward = 1;
    if (event.key === "s" || event.key === "ArrowDown") input.forward = -1;
    if (event.key === "a" || event.key === "ArrowLeft") input.right = -1;
    if (event.key === "d" || event.key === "ArrowRight") input.right = 1;
    if (event.key === "Shift") input.crouching = true;
    if (event.key === "e" || event.key === "E") window.dispatchEvent(new CustomEvent("hide-seek:action"));
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (["w", "s", "ArrowUp", "ArrowDown"].includes(event.key)) input.forward = 0;
    if (["a", "d", "ArrowLeft", "ArrowRight"].includes(event.key)) input.right = 0;
    if (event.key === "Shift") input.crouching = false;
  };
  const onTouchMove = (event: Event) => {
    const detail = (event as CustomEvent<TouchMove>).detail;
    input.right = Math.max(-1, Math.min(1, detail.x));
    input.forward = Math.max(-1, Math.min(1, detail.y));
  };
  const onTouchEnd = () => { input.right = 0; input.forward = 0; };
  const onCameraDrag = (event: Event) => {
    const detail = (event as CustomEvent<{ dx: number; dy: number }>).detail;
    cameraState.yaw += detail.dx * 0.006;
    cameraState.pitch = Math.max(-0.05, Math.min(0.48, cameraState.pitch + detail.dy * 0.004));
  };
  const onCrouch = () => { input.crouching = !input.crouching; };
  const onInteract = () => {
    if (!nearbyHideSpot && !input.hidden) return;
    input.hidden = !input.hidden;
    setPlayerVisible(!input.hidden);
    input.crouching = input.hidden;
    emitInteraction(nearbyHideSpot, input.hidden);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("hide-seek:move", onTouchMove);
  window.addEventListener("hide-seek:move-end", onTouchEnd);
  window.addEventListener("hide-seek:camera", onCameraDrag);
  window.addEventListener("hide-seek:crouch", onCrouch);
  window.addEventListener("hide-seek:interact", onInteract);

  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let syncElapsed = 0;
  let currentTagTarget = "";
  const pointerDown = (event: PointerEvent) => { dragging = true; previousX = event.clientX; previousY = event.clientY; };
  const pointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    window.dispatchEvent(new CustomEvent("hide-seek:camera", { detail: { dx: event.clientX - previousX, dy: event.clientY - previousY } }));
    previousX = event.clientX; previousY = event.clientY;
  };
  const pointerUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerUp);

  scene.onBeforeRenderObservable.add(() => {
    if (disposed) return;
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
    cameraState.yaw += (input.cameraYaw - cameraState.yaw) * 0.06;
    const speed = input.crouching ? 1.5 : 3.1;
    const forward = new Vector3(Math.sin(cameraState.yaw), 0, Math.cos(cameraState.yaw));
    const right = new Vector3(Math.cos(cameraState.yaw), 0, -Math.sin(cameraState.yaw));
    const direction = forward.scale(input.forward).add(right.scale(input.right));
    if (direction.lengthSquared() > 0.02 && !input.hidden) {
      direction.normalize();
      const next = player.position.add(direction.scale(speed * dt));
      const blocked = collisionBoxes.some((obstacle) => Math.abs(next.x - obstacle.x) < obstacle.hw + 0.34 && Math.abs(next.z - obstacle.z) < obstacle.hd + 0.28);
      if (!blocked) player.position.copyFrom(next);
      player.rotation.y = Math.atan2(direction.x, direction.z);
    }
    player.position.x = Math.max(-9.6, Math.min(9.6, player.position.x));
    player.position.z = Math.max(-7.7, Math.min(7.7, player.position.z));
    const targetHeight = input.crouching ? 0.56 : 0.86;
    player.scaling.y += (targetHeight / 0.86 - player.scaling.y) * 0.18;
    const closest = hideSpots.reduce((best, spot) => {
      const distance = Math.hypot(player.position.x - spot.x, player.position.z - spot.z);
      return distance < best.distance ? { distance, spot } : best;
    }, { distance: Infinity, spot: hideSpots[0] });
    nearbyHideSpot = closest.distance < 2.05;
    emitInteraction(nearbyHideSpot, input.hidden);
    const distance = 5.8;
    const cameraTarget = player.position.add(new Vector3(0, 0.65, 0));
    const cameraOffset = new Vector3(Math.sin(cameraState.yaw) * distance, 2.4 + cameraState.pitch * 2, Math.cos(cameraState.yaw) * distance);
    const desired = cameraTarget.add(cameraOffset);
    camera.position = Vector3.Lerp(camera.position, desired, 1 - Math.pow(0.0005, dt));
    camera.setTarget(cameraTarget);
    let nearestTarget = "";
    let nearestDistance = 2.5;
    remotePlayers.forEach((avatar, id) => {
      if (remoteRoles.get(id) !== "hider") return;
      const distance = Math.hypot(player.position.x - avatar.position.x, player.position.z - avatar.position.z);
      if (distance < nearestDistance) { nearestDistance = distance; nearestTarget = id; }
    });
    if (nearestTarget !== currentTagTarget) {
      currentTagTarget = nearestTarget;
      window.dispatchEvent(new CustomEvent("hide-seek:tag-target", { detail: { targetId: nearestTarget } }));
    }
    syncElapsed += dt;
    if (syncElapsed > 0.08) {
      syncElapsed = 0;
      window.dispatchEvent(new CustomEvent("hide-seek:local-transform", { detail: { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.rotation.y, hidden: input.hidden } }));
    }
  });

  return {
    scene,
    dispose: () => {
      disposed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("hide-seek:move", onTouchMove);
      window.removeEventListener("hide-seek:move-end", onTouchEnd);
      window.removeEventListener("hide-seek:camera", onCameraDrag);
      window.removeEventListener("hide-seek:crouch", onCrouch);
      window.removeEventListener("hide-seek:interact", onInteract);
      window.removeEventListener("hide-seek:remote-state", onRemoteState);
      window.removeEventListener("hide-seek:remote-transform", onRemoteTransform);
      remotePlayers.forEach((avatar) => avatar.dispose());
      remotePlayers.clear();
      remoteRoles.clear();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      scene.dispose();
    },
  };
}
