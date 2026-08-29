import * as THREE from "three";

export type VoxelBlock = "grass" | "dirt" | "stone" | "wood" | "leaves" | "crystal";
export type VoxelRuntimeState = {
  health: number;
  hunger: number;
  crystals: number;
  placed: number;
  defeated: number;
  selected: VoxelBlock;
  inventory: Record<VoxelBlock, number>;
  worldTime: number;
  position: [number, number, number];
  locked: boolean;
  message: string;
  completed: boolean;
};

type SaveData = Pick<VoxelRuntimeState, "health" | "hunger" | "crystals" | "placed" | "defeated" | "selected" | "inventory"> & {
  removed: string[];
  placedBlocks: Array<[string, VoxelBlock]>;
  position: [number, number, number];
};

type Enemy = { mesh: THREE.Mesh; health: number; phase: number };

const WORLD_SIZE = 32;
const REACH = 6;
const PLAYER_HEIGHT = 1.7;
const UP = new THREE.Vector3(0, 1, 0);
const BLOCKS: VoxelBlock[] = ["grass", "dirt", "stone", "wood", "leaves", "crystal"];

function key(x: number, y: number, z: number) { return `${x},${y},${z}`; }
function hash2(x: number, z: number) {
  let n = Math.imul(x + 374761393, 668265263) ^ Math.imul(z + 1274126177, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function makeBlockTexture(base: string, accent: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 75; i += 1) {
    const x = (Math.sin(seed * 41 + i * 17) * 10000) % 32;
    const y = (Math.sin(seed * 73 + i * 29) * 10000) % 32;
    ctx.globalAlpha = 0.16 + (i % 4) * 0.05;
    ctx.fillStyle = i % 3 === 0 ? accent : "#ffffff";
    ctx.fillRect(Math.abs(x), Math.abs(y), 1 + (i % 3), 1 + ((i + 1) % 2));
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class VoxelSandboxRuntime {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(72, 1, 0.05, 180);
  private readonly raycaster = new THREE.Raycaster();
  private readonly blocks = new Map<string, VoxelBlock>();
  private readonly baseBlocks = new Map<string, VoxelBlock>();
  private readonly removed = new Set<string>();
  private readonly placedBlocks = new Map<string, VoxelBlock>();
  private readonly meshes = new Map<VoxelBlock, THREE.InstancedMesh>();
  private readonly instanceKeys = new Map<VoxelBlock, string[]>();
  private readonly enemies: Enemy[] = [];
  private readonly keys = new Set<string>();
  private readonly clock = new THREE.Clock();
  private readonly sun = new THREE.DirectionalLight("#fff4d0", 2.2);
  private readonly moon = new THREE.DirectionalLight("#9fc3ff", 0.35);
  private readonly hemi = new THREE.HemisphereLight("#aee7ff", "#182314", 1.25);
  private readonly saveKey: string;
  private frame = 0;
  private disposed = false;
  private yaw = Math.PI;
  private pitch = -0.12;
  private velocityY = 0;
  private grounded = false;
  private mobileMove = new THREE.Vector2();
  private damageCooldown = 0;
  private spawnGrace = 8;
  private powerCooldown = 0;
  private state: VoxelRuntimeState = {
    health: 10,
    hunger: 10,
    crystals: 0,
    placed: 0,
    defeated: 0,
    selected: "dirt",
    inventory: { grass: 0, dirt: 8, stone: 0, wood: 0, leaves: 0, crystal: 0 },
    worldTime: 0.22,
    position: [0, 0, 0],
    locked: false,
    message: "点击画面进入 · WASD 移动 · 鼠标观察 · 左键采掘 · 右键放置 · Q 能量脉冲",
    completed: false,
  };
  private readonly onState: (state: VoxelRuntimeState) => void;
  private readonly onEnd: (result: { won: boolean; score: number }) => void;

  constructor(canvas: HTMLCanvasElement, projectId: string, onState: (state: VoxelRuntimeState) => void, onEnd: (result: { won: boolean; score: number }) => void) {
    this.onState = onState;
    this.onEnd = onEnd;
    this.saveKey = `operone:voxel:v2:${projectId}`;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene.fog = new THREE.FogExp2("#8fd4e7", 0.018);
    this.scene.add(this.hemi, this.sun, this.moon);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -26;
    this.sun.shadow.camera.right = 26;
    this.sun.shadow.camera.top = 26;
    this.sun.shadow.camera.bottom = -26;
    this.buildWorld();
    this.restore();
    this.rebuildWorldMeshes();
    this.buildEnemies();
    this.bind(canvas);
    this.resize(canvas.clientWidth, canvas.clientHeight);
    this.emit();
    this.frame = requestAnimationFrame(this.tick);
  }

  private terrainHeight(x: number, z: number) {
    const waves = Math.sin(x * 0.28) * 1.2 + Math.cos(z * 0.23) * 1.15 + Math.sin((x + z) * 0.13) * 0.8;
    return Math.max(2, Math.min(7, 4 + Math.floor(waves + hash2(x, z) * 1.4)));
  }

  private setBase(x: number, y: number, z: number, type: VoxelBlock) {
    const k = key(x, y, z);
    this.baseBlocks.set(k, type);
    this.blocks.set(k, type);
  }

  private buildWorld() {
    for (let x = 0; x < WORLD_SIZE; x += 1) {
      for (let z = 0; z < WORLD_SIZE; z += 1) {
        const h = this.terrainHeight(x, z);
        for (let y = 0; y <= h; y += 1) {
          this.setBase(x, y, z, y === h ? "grass" : y >= h - 2 ? "dirt" : "stone");
        }
        const r = hash2(x * 7, z * 11);
        const awayFromSpawn = Math.hypot(x - WORLD_SIZE / 2, z - WORLD_SIZE / 2) > 4;
        if (awayFromSpawn && r > 0.91 && x > 2 && z > 2 && x < WORLD_SIZE - 2 && z < WORLD_SIZE - 2) {
          const trunk = 2 + Math.floor(hash2(x + 4, z + 9) * 2);
          for (let y = 1; y <= trunk; y += 1) this.setBase(x, h + y, z, "wood");
          for (let ox = -2; ox <= 2; ox += 1) for (let oz = -2; oz <= 2; oz += 1) for (let oy = trunk - 1; oy <= trunk + 1; oy += 1) {
            if (Math.abs(ox) + Math.abs(oz) + Math.abs(oy - trunk) <= 4) this.setBase(x + ox, h + oy, z + oz, "leaves");
          }
        } else if (awayFromSpawn && r > 0.82) {
          this.setBase(x, h + 1, z, "crystal");
        }
      }
    }
    const sx = Math.floor(WORLD_SIZE / 2);
    const sz = Math.floor(WORLD_SIZE / 2);
    const spawnH = this.terrainHeight(sx, sz);
    // Keep the first minute readable: the player never spawns inside a canopy.
    for (let x = sx - 3; x <= sx + 3; x += 1) for (let z = sz - 3; z <= sz + 3; z += 1) {
      for (let y = 0; y <= spawnH; y += 1) this.setBase(x, y, z, y === spawnH ? "grass" : y >= spawnH - 2 ? "dirt" : "stone");
      for (let y = spawnH + 1; y < spawnH + 8; y += 1) {
        const k = key(x, y, z);
        this.blocks.delete(k);
        this.baseBlocks.delete(k);
      }
    }
    for (const [x, z] of [[sx - 4, sz], [sx + 4, sz], [sx, sz - 4], [sx, sz + 4]]) {
      this.setBase(x!, this.terrainHeight(x!, z!) + 1, z!, "crystal");
    }
    this.camera.position.set(sx + 0.5, spawnH + PLAYER_HEIGHT + 0.2, sz + 0.5);
  }

  private materialFor(type: VoxelBlock) {
    const palette: Record<VoxelBlock, [string, string]> = {
      grass: ["#3f8d3a", "#8bd15e"], dirt: ["#77502f", "#b67a48"], stone: ["#72777d", "#afb5b9"],
      wood: ["#845024", "#d28a42"], leaves: ["#1e692d", "#52a34e"], crystal: ["#28c8ee", "#d6fbff"],
    };
    const [base, accent] = palette[type];
    return new THREE.MeshStandardMaterial({
      map: makeBlockTexture(base, accent, BLOCKS.indexOf(type) + 1),
      roughness: type === "crystal" ? 0.22 : 0.92,
      metalness: type === "crystal" ? 0.18 : 0,
      emissive: type === "crystal" ? new THREE.Color("#0aa8d0") : new THREE.Color("#000000"),
      emissiveIntensity: type === "crystal" ? 0.75 : 0,
    });
  }

  private isExposed(x: number, y: number, z: number) {
    return [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].some(([dx,dy,dz]) => !this.blocks.has(key(x + dx, y + dy, z + dz)));
  }

  private rebuildWorldMeshes() {
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes.clear();
    this.instanceKeys.clear();
    const byType = new Map<VoxelBlock, string[]>(BLOCKS.map((type) => [type, []]));
    for (const [k, type] of this.blocks) {
      const [x, y, z] = k.split(",").map(Number);
      if (this.isExposed(x!, y!, z!)) byType.get(type)!.push(k);
    }
    const matrix = new THREE.Matrix4();
    for (const type of BLOCKS) {
      const keys = byType.get(type)!;
      if (!keys.length) continue;
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.materialFor(type), keys.length);
      mesh.castShadow = type !== "leaves";
      mesh.receiveShadow = true;
      keys.forEach((k, index) => {
        const [x, y, z] = k.split(",").map(Number);
        matrix.makeTranslation(x! + 0.5, y! + 0.5, z! + 0.5);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.meshes.set(type, mesh);
      this.instanceKeys.set(type, keys);
      this.scene.add(mesh);
    }
  }

  private buildEnemies() {
    const geometry = new THREE.BoxGeometry(0.72, 1.15, 0.72);
    const material = new THREE.MeshStandardMaterial({ color: "#d9465f", roughness: 0.55, emissive: "#4a0914", emissiveIntensity: 0.5 });
    const spots = [[9, 8], [24, 10], [9, 24], [23, 23], [16, 5]];
    spots.forEach(([x, z], index) => {
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.position.set(x! + 0.5, this.terrainHeight(x!, z!) + 1.1, z! + 0.5);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.enemies.push({ mesh, health: 2, phase: index * 1.7 });
    });
  }

  private bind(canvas: HTMLCanvasElement) {
    canvas.addEventListener("click", this.onClick);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    document.addEventListener("pointerlockchange", this.onPointerLock);
    document.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onClick = (event: MouseEvent) => {
    const canvas = this.renderer.domElement;
    if (document.pointerLockElement !== canvas) {
      try {
        void canvas.requestPointerLock().catch(() => undefined);
      } catch {
        // Embedded/mobile browsers may reject pointer lock; touch and keyboard controls remain usable.
      }
      return;
    }
    if (event.button === 0) this.mine();
  };
  private onContextMenu = (event: MouseEvent) => { event.preventDefault(); this.place(); };
  private onPointerLock = () => { this.state.locked = document.pointerLockElement === this.renderer.domElement; this.emit(); };
  private onMouseMove = (event: MouseEvent) => {
    if (!this.state.locked) return;
    this.yaw -= event.movementX * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0022, -1.45, 1.45);
  };
  private onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code);
    if (event.code === "Space" && this.grounded) { this.velocityY = 7.2; this.grounded = false; }
    if (event.code === "KeyQ" || event.code === "KeyR") this.pulse();
    if (event.code === "KeyF") this.place();
    if (event.code.startsWith("Digit")) {
      const types: VoxelBlock[] = ["dirt", "stone", "wood", "grass", "leaves"];
      const selected = types[Number(event.code.slice(5)) - 1];
      if (selected) { this.state.selected = selected; this.emit(); }
    }
  };
  private onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };

  setMobileMove(x: number, z: number) { this.mobileMove.set(x, z); }
  nudge(x: number, z: number) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = forward.multiplyScalar(-z).add(right.multiplyScalar(x));
    if (move.lengthSq() > 1) move.normalize();
    this.moveHorizontal(move.x * 0.72, move.z * 0.72);
    this.emit();
  }
  rotate(dx: number, dy: number) {
    this.yaw -= dx * 0.012;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.012, -1.35, 1.35);
  }
  jump() { if (this.grounded) { this.velocityY = 7.2; this.grounded = false; } }
  select(type: VoxelBlock) { this.state.selected = type; this.emit(); }
  mineAction() { this.mine(); }
  placeAction() { this.place(); }
  pulseAction() { this.pulse(); }

  private target() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = REACH;
    const hits = this.raycaster.intersectObjects([...this.meshes.values()], false);
    const hit = hits[0];
    if (!hit || hit.instanceId === undefined) return null;
    const type = [...this.meshes.entries()].find(([, mesh]) => mesh === hit.object)?.[0];
    if (!type) return null;
    const blockKey = this.instanceKeys.get(type)?.[hit.instanceId];
    if (!blockKey) return null;
    const [x, y, z] = blockKey.split(",").map(Number) as [number, number, number];
    const normal = hit.face?.normal.clone() ?? UP.clone();
    return { type, blockKey, x, y, z, normal };
  }

  private mine() {
    const target = this.target();
    if (!target || target.y <= 0) { this.flash("这里无法采掘"); return; }
    this.blocks.delete(target.blockKey);
    if (this.baseBlocks.has(target.blockKey)) this.removed.add(target.blockKey);
    this.placedBlocks.delete(target.blockKey);
    this.state.inventory[target.type] += 1;
    if (target.type === "crystal") this.state.crystals += 1;
    this.flash(target.type === "crystal" ? "获得能量晶体 ✦" : `采集 ${target.type}`);
    this.rebuildWorldMeshes();
    this.save();
    this.checkComplete();
  }

  private place() {
    const target = this.target();
    const type = this.state.selected;
    if (!target) { this.flash("准星需要对准六米内的方块表面"); return; }
    if (this.state.inventory[type] <= 0) { this.flash("背包里没有可放置方块"); return; }
    const x = target.x + Math.round(target.normal.x);
    const y = target.y + Math.round(target.normal.y);
    const z = target.z + Math.round(target.normal.z);
    const k = key(x, y, z);
    if (this.blocks.has(k) || this.camera.position.distanceTo(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)) < 1.2) return;
    this.blocks.set(k, type);
    this.placedBlocks.set(k, type);
    this.removed.delete(k);
    this.state.inventory[type] -= 1;
    this.state.placed += 1;
    this.flash(`放置 ${type}`);
    this.rebuildWorldMeshes();
    this.save();
    this.checkComplete();
  }

  private pulse() {
    if (this.powerCooldown > 0) { this.flash(`脉冲冷却 ${this.powerCooldown.toFixed(1)}s`); return; }
    this.powerCooldown = 4;
    const origin = this.camera.position;
    let hits = 0;
    for (const enemy of this.enemies) {
      if (!enemy.mesh.visible || enemy.mesh.position.distanceTo(origin) > 7) continue;
      enemy.health -= 2;
      hits += 1;
      if (enemy.health <= 0) {
        enemy.mesh.visible = false;
        this.state.defeated += 1;
      }
    }
    this.flash(hits ? `能量脉冲命中 ${hits} 个敌人` : "能量脉冲释放");
    this.save();
    this.checkComplete();
  }

  private collides(x: number, y: number, z: number) {
    const radius = 0.28;
    for (const px of [x - radius, x + radius]) for (const pz of [z - radius, z + radius]) {
      for (const py of [y - PLAYER_HEIGHT + 0.08, y - 0.2, y]) {
        if (this.blocks.has(key(Math.floor(px), Math.floor(py), Math.floor(pz)))) return true;
      }
    }
    return false;
  }

  private moveHorizontal(dx: number, dz: number) {
    const current = this.camera.position;
    const nx = THREE.MathUtils.clamp(current.x + dx, 0.35, WORLD_SIZE - 0.35);
    const nz = THREE.MathUtils.clamp(current.z + dz, 0.35, WORLD_SIZE - 0.35);
    const blockedX = this.collides(nx, current.y, current.z);
    const blockedZ = this.collides(current.x, current.y, nz);
    if (!blockedX) current.x = nx;
    if (!blockedZ) current.z = nz;
    if ((blockedX || blockedZ) && this.grounded && !this.collides(nx, current.y + 1.05, nz)) {
      current.y += 1.05;
      current.x = nx;
      current.z = nz;
      this.velocityY = 0;
    }
  }

  private updatePlayer(dt: number) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const moveZ = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) - this.mobileMove.y;
    const moveX = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0) + this.mobileMove.x;
    const move = forward.multiplyScalar(moveZ).add(right.multiplyScalar(moveX));
    if (move.lengthSq() > 1) move.normalize();
    const speed = this.keys.has("ShiftLeft") ? 6.6 : 4.5;
    this.moveHorizontal(move.x * speed * dt, move.z * speed * dt);
    this.velocityY -= 20 * dt;
    const ny = this.camera.position.y + this.velocityY * dt;
    if (this.collides(this.camera.position.x, ny, this.camera.position.z)) {
      if (this.velocityY < 0) this.grounded = true;
      this.velocityY = 0;
    } else {
      this.camera.position.y = ny;
      this.grounded = false;
    }
    if (this.camera.position.y < 0) {
      const x = Math.floor(WORLD_SIZE / 2), z = Math.floor(WORLD_SIZE / 2);
      this.camera.position.set(x + 0.5, this.terrainHeight(x, z) + PLAYER_HEIGHT + 0.2, z + 0.5);
      this.state.health = Math.max(1, this.state.health - 2);
    }
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  private updateEnemies(dt: number, elapsed: number) {
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    this.spawnGrace = Math.max(0, this.spawnGrace - dt);
    for (const enemy of this.enemies) {
      if (!enemy.mesh.visible) continue;
      const delta = new THREE.Vector3().subVectors(this.camera.position, enemy.mesh.position);
      delta.y = 0;
      const dist = delta.length();
      if (dist < 9 && dist > 0.9) {
        delta.normalize();
        enemy.mesh.position.addScaledVector(delta, dt * 1.15);
      }
      const floor = this.terrainHeight(Math.floor(enemy.mesh.position.x), Math.floor(enemy.mesh.position.z));
      enemy.mesh.position.y = floor + 1.05 + Math.sin(elapsed * 3 + enemy.phase) * 0.08;
      enemy.mesh.rotation.y += dt * 0.8;
      if (dist < 1.15 && this.damageCooldown <= 0 && this.spawnGrace <= 0) {
        this.damageCooldown = 1;
        this.state.health -= 1;
        this.flash("受到暗影生物攻击");
        if (this.state.health <= 0) this.finish(false);
      }
    }
  }

  private updateLighting(elapsed: number) {
    this.state.worldTime = (0.22 + elapsed / 150) % 1;
    const angle = this.state.worldTime * Math.PI * 2;
    const daylight = THREE.MathUtils.clamp(Math.sin(angle) * 0.85 + 0.35, 0.08, 1);
    this.sun.position.set(Math.cos(angle) * 32, Math.sin(angle) * 34, 18);
    this.moon.position.copy(this.sun.position).multiplyScalar(-1);
    this.sun.intensity = daylight * 2.4;
    this.moon.intensity = (1 - daylight) * 0.75;
    this.hemi.intensity = 0.28 + daylight;
    const sky = new THREE.Color("#091426").lerp(new THREE.Color("#86d7ee"), daylight);
    this.scene.background = sky;
    (this.scene.fog as THREE.FogExp2).color.copy(sky);
  }

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.powerCooldown = Math.max(0, this.powerCooldown - dt);
    this.updatePlayer(dt);
    this.updateEnemies(dt, elapsed);
    this.updateLighting(elapsed);
    this.renderer.render(this.scene, this.camera);
    if (Math.floor(elapsed * 4) !== Math.floor((elapsed - dt) * 4)) this.emit();
    this.frame = requestAnimationFrame(this.tick);
  };

  private flash(message: string) {
    this.state.message = message;
    this.emit();
  }

  private checkComplete() {
    if (!this.state.completed && this.state.crystals >= 3 && this.state.placed >= 4 && this.state.defeated >= 3) {
      this.state.completed = true;
      this.flash("前线基地已建立！世界核心重新点亮。");
      window.setTimeout(() => this.finish(true), 900);
    }
  }

  private finish(won: boolean) {
    if (this.disposed) return;
    this.state.completed = won;
    this.emit();
    this.onEnd({ won, score: this.state.crystals * 120 + this.state.placed * 60 + this.state.defeated * 180 + this.state.health * 25 });
  }

  private emit() {
    this.state.position = this.camera.position.toArray().map((value) => Number(value.toFixed(2))) as [number, number, number];
    const snapshot: VoxelRuntimeState = { ...this.state, inventory: { ...this.state.inventory } };
    this.onState(snapshot);
    (window as unknown as { __VOXEL_QA__?: unknown }).__VOXEL_QA__ = {
      position: this.camera.position.toArray().map((value) => Number(value.toFixed(2))),
      crystals: snapshot.crystals,
      placed: snapshot.placed,
      defeated: snapshot.defeated,
      health: snapshot.health,
      locked: snapshot.locked,
      completed: snapshot.completed,
      runtime: "three-voxel-sandbox",
      inventory: snapshot.inventory,
      powerCooldown: Number(this.powerCooldown.toFixed(2)),
      message: snapshot.message,
    };
  }

  private save() {
    const data: SaveData = {
      health: this.state.health, hunger: this.state.hunger, crystals: this.state.crystals, placed: this.state.placed,
      defeated: this.state.defeated, selected: this.state.selected, inventory: this.state.inventory,
      removed: [...this.removed], placedBlocks: [...this.placedBlocks], position: this.camera.position.toArray() as [number, number, number],
    };
    try { localStorage.setItem(this.saveKey, JSON.stringify(data)); } catch { /* storage is optional */ }
  }

  private restore() {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<SaveData>;
      for (const k of data.removed ?? []) { this.blocks.delete(k); this.removed.add(k); }
      for (const [k, type] of data.placedBlocks ?? []) { if (BLOCKS.includes(type)) { this.blocks.set(k, type); this.placedBlocks.set(k, type); } }
      if (data.inventory) this.state.inventory = { ...this.state.inventory, ...data.inventory };
      for (const field of ["hunger", "crystals", "placed", "defeated"] as const) if (typeof data[field] === "number") this.state[field] = data[field]!;
      if (typeof data.health === "number") this.state.health = data.health > 0 ? Math.min(10, data.health) : 10;
      if (data.selected && BLOCKS.includes(data.selected)) this.state.selected = data.selected;
      if (data.position?.length === 3) this.camera.position.fromArray(data.position);
      this.state.message = "已恢复上次世界进度";
    } catch { /* corrupted local save starts fresh */ }
  }

  resize(width: number, height: number) {
    if (width < 2 || height < 2) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.save();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("click", this.onClick);
    canvas.removeEventListener("contextmenu", this.onContextMenu);
    document.removeEventListener("pointerlockchange", this.onPointerLock);
    document.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    this.renderer.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => { const map = (material as THREE.MeshStandardMaterial).map; map?.dispose(); material.dispose(); });
    });
  }
}
