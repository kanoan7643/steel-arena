import * as THREE from 'three';
import { COLLIDE_RADIUS } from './config.js';

/**
 * Player + dedicated first-person viewmodel scene.
 * Arms live in viewScene (not on the world camera) so they always render.
 */
export class Player {
  constructor(worldCamera) {
    this.camera = worldCamera;
    this.yaw = 0;
    this.pitch = 0;
    this.position = new THREE.Vector3(0, 1.65, 4.5);
    this.velocity = new THREE.Vector3();
    this.speed = 6.2;
    this.sprintMul = 1.55;
    this.hp = 100;
    this.maxHp = 100;
    this.damageMul = 1;
    this.blocking = false;
    this.punchCooldown = 0;
    this.invuln = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.alive = true;
    this.knocked = false;
    this.knockT = 0;
    this.visible = false;

    this.keys = new Set();
    this.pointerLocked = false;
    this.touchEnabled = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchBlock = false;
    this.touchSprint = false;

    // --- Separate viewmodel pass (always drawn on top) ---
    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(55, 1, 0.01, 5);
    this.viewCamera.position.set(0, 0, 0);

    this.viewScene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xffe0c8, 1.4);
    key.position.set(0.4, 0.8, 1);
    this.viewScene.add(key);

    this.arms = new THREE.Group();
    this.viewScene.add(this.arms);

    this.leftArm = this.#makeArm(-1);
    this.rightArm = this.#makeArm(1);
    this.arms.add(this.leftArm, this.rightArm);

    this.punchAnim = { t: 0, side: 0, active: false, hit: false, zone: 'body' };
    this.blockBlend = 0;
    this.hitbox = new THREE.Sphere(new THREE.Vector3(), 0.45);
    this.punchSwingSfx = false;
    this.radius = COLLIDE_RADIUS * 0.48;

    this._onKeyDown = (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => this.#onMouseMove(e);
    this._onMouseDown = (e) => this.#onMouseDown(e);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);

    // Start in rest pose
    for (const arm of [this.leftArm, this.rightArm]) {
      this.#applyPose(arm, arm.userData.rest);
    }
  }

  /** Call after main world render */
  renderViewmodel(renderer) {
    if (!this.visible) return;
    const size = new THREE.Vector2();
    renderer.getSize(size);
    this.viewCamera.aspect = size.x / Math.max(1, size.y);
    this.viewCamera.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.autoClear = false;
    renderer.render(this.viewScene, this.viewCamera);
    renderer.autoClear = true;
  }

  #makeArm(side) {
    const g = new THREE.Group();

    // MeshBasicMaterial = always bright, ignores world lighting/fog
    const steel = new THREE.MeshBasicMaterial({ color: 0xc8d4e0 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x5a6570 });
    const accent = new THREE.MeshBasicMaterial({ color: 0xff5a2a });

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.35), dark);
    upper.position.set(side * 0.02, 0.06, 0.2);
    g.add(upper);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.55), steel);
    forearm.position.set(0, 0.02, -0.12);
    g.add(forearm);

    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.36), steel);
    gauntlet.position.set(0, 0.02, -0.48);
    g.add(gauntlet);

    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.12), accent);
    knuckle.position.set(0, 0.14, -0.64);
    g.add(knuckle);

    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.16), steel);
      finger.position.set(-0.12 + i * 0.08, 0.02, -0.76);
      g.add(finger);
    }

    g.userData.side = side;
    // Parked wide so center FOV stays clear
    g.userData.rest = {
      pos: new THREE.Vector3(side * 0.78, -0.52, -0.48),
      rot: new THREE.Euler(0.6, side * 0.38, side * 0.28),
    };
    g.userData.block = {
      pos: new THREE.Vector3(side * 0.34, -0.14, -0.6),
      rot: new THREE.Euler(-1.0, side * 0.5, side * 0.1),
    };
    return g;
  }

  #applyPose(arm, pose) {
    arm.position.copy(pose.pos);
    arm.rotation.set(pose.rot.x, pose.rot.y, pose.rot.z);
  }

  #mix(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return {
      pos: new THREE.Vector3(
        a.pos.x + (b.pos.x - a.pos.x) * t,
        a.pos.y + (b.pos.y - a.pos.y) * t,
        a.pos.z + (b.pos.z - a.pos.z) * t,
      ),
      rot: new THREE.Euler(
        a.rot.x + (b.rot.x - a.rot.x) * t,
        a.rot.y + (b.rot.y - a.rot.y) * t,
        a.rot.z + (b.rot.z - a.rot.z) * t,
      ),
    };
  }

  enablePointerLock(canvas) {
    canvas.addEventListener('click', () => {
      if (this.touchEnabled) return;
      if (!this.pointerLocked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
  }

  /** Desktop: pointer lock. Mobile: touch overlay drives look / move. */
  get controlsActive() {
    return this.touchEnabled || this.pointerLocked;
  }

  #onMouseMove(e) {
    if (this.touchEnabled || !this.pointerLocked || this.knocked) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch -= e.movementY * 0.002;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
  }

  #onMouseDown(e) {
    if (this.touchEnabled || !this.pointerLocked || !this.alive || this.knocked) return;
    if (e.button === 0) this.tryPunch(-1);
    if (e.button === 2) this.tryPunch(1);
  }

  getAimZone() {
    // Mouse look uses pitch -= movementY, so look-down = negative pitch
    if (this.pitch > 0.22) return 'head';
    if (this.pitch < -0.42) return 'legs';
    return 'body';
  }

  /** Punch style tied to aim: head=uppercut, body=straight, legs=hook */
  getPunchStyle() {
    const zone = this.getAimZone();
    if (zone === 'head') return 'uppercut';
    if (zone === 'legs') return 'hook';
    return 'straight';
  }

  tryPunch(side) {
    if (this.punchCooldown > 0 || this.blocking || this.punchAnim.active) return false;
    const zone = this.getAimZone();
    const style = zone === 'head' ? 'uppercut' : zone === 'legs' ? 'hook' : 'straight';
    // Different cadence per style so they feel distinct
    const dur = style === 'straight' ? 0.42 : style === 'uppercut' ? 0.62 : 0.58;
    this.punchAnim = {
      t: 0,
      side,
      active: true,
      hit: false,
      zone,
      style,
      dur,
    };
    this.punchCooldown = dur + 0.08;
    this.punchSwingSfx = true;
    this.#setPunchFrame(side, 0);
    return true;
  }

  /** 4-pose arcs — paths are intentionally very different */
  #punchPoses(side, style) {
    if (style === 'uppercut') {
      // Drop low → scoop up through the chin line
      return [
        {
          pos: new THREE.Vector3(side * 0.7, -0.78, -0.45),
          rot: new THREE.Euler(1.4, side * 0.15, side * 0.7),
        },
        {
          pos: new THREE.Vector3(side * 0.35, -0.45, -0.55),
          rot: new THREE.Euler(0.55, side * 0.1, side * 0.55),
        },
        {
          pos: new THREE.Vector3(side * 0.12, 0.28, -0.68),
          rot: new THREE.Euler(-1.55, side * 0.05, side * 0.25),
        },
        {
          pos: new THREE.Vector3(side * 0.55, -0.2, -0.5),
          rot: new THREE.Euler(-0.2, side * 0.25, side * 0.15),
        },
      ];
    }
    if (style === 'hook') {
      // Wide horizontal swing from outside → across
      return [
        {
          pos: new THREE.Vector3(side * 0.95, -0.22, -0.25),
          rot: new THREE.Euler(0.2, side * 1.1, side * 0.9),
        },
        {
          pos: new THREE.Vector3(side * 0.7, -0.18, -0.55),
          rot: new THREE.Euler(0.1, side * 0.55, side * 1.15),
        },
        {
          pos: new THREE.Vector3(side * 0.08, -0.2, -0.72),
          rot: new THREE.Euler(0.05, side * -0.35, side * 1.25),
        },
        {
          pos: new THREE.Vector3(side * 0.55, -0.4, -0.4),
          rot: new THREE.Euler(0.45, side * 0.2, side * 0.4),
        },
      ];
    }
    // Straight: chamber by cheek, pistons forward on a flat line (Y almost fixed)
    return [
      {
        pos: new THREE.Vector3(side * 0.42, -0.12, -0.22),
        rot: new THREE.Euler(0.05, side * 0.15, 0),
      },
      {
        pos: new THREE.Vector3(side * 0.28, -0.1, -0.55),
        rot: new THREE.Euler(-0.05, side * 0.08, 0),
      },
      {
        pos: new THREE.Vector3(side * 0.1, -0.08, -1.05),
        rot: new THREE.Euler(-0.08, 0, 0),
      },
      {
        pos: new THREE.Vector3(side * 0.5, -0.35, -0.45),
        rot: new THREE.Euler(0.4, side * 0.25, side * 0.15),
      },
    ];
  }

  #setPunchFrame(side, phase) {
    const arm = side < 0 ? this.leftArm : this.rightArm;
    const other = side < 0 ? this.rightArm : this.leftArm;
    const style = this.punchAnim.style || 'straight';
    const poses = this.#punchPoses(side, style);
    const rest = arm.userData.rest;

    // Timing differs: straight snaps out fast; uppercut/hook linger on the arc
    let pose;
    if (style === 'straight') {
      if (phase < 0.12) pose = this.#mix(rest, poses[0], phase / 0.12);
      else if (phase < 0.28) pose = this.#mix(poses[0], poses[2], (phase - 0.12) / 0.16);
      else if (phase < 0.55) pose = poses[2];
      else pose = this.#mix(poses[2], poses[3], (phase - 0.55) / 0.45);
    } else if (style === 'uppercut') {
      if (phase < 0.2) pose = this.#mix(rest, poses[0], phase / 0.2);
      else if (phase < 0.4) pose = this.#mix(poses[0], poses[1], (phase - 0.2) / 0.2);
      else if (phase < 0.55) pose = this.#mix(poses[1], poses[2], (phase - 0.4) / 0.15);
      else if (phase < 0.72) pose = poses[2];
      else pose = this.#mix(poses[2], poses[3], (phase - 0.72) / 0.28);
    } else {
      // hook — must pass through the wide side pose so it reads as a circle
      if (phase < 0.18) pose = this.#mix(rest, poses[0], phase / 0.18);
      else if (phase < 0.38) pose = this.#mix(poses[0], poses[1], (phase - 0.18) / 0.2);
      else if (phase < 0.52) pose = this.#mix(poses[1], poses[2], (phase - 0.38) / 0.14);
      else if (phase < 0.7) pose = poses[2];
      else pose = this.#mix(poses[2], poses[3], (phase - 0.7) / 0.3);
    }

    this.#applyPose(arm, pose);
    this.#applyPose(other, {
      pos: new THREE.Vector3(other.userData.side * 0.78, -0.52, -0.42),
      rot: new THREE.Euler(0.7, other.userData.side * 0.35, other.userData.side * 0.25),
    });
  }

  consumeSwingSfx() {
    if (!this.punchSwingSfx) return false;
    this.punchSwingSfx = false;
    return true;
  }

  getPunchPoint() {
    if (!this.punchAnim.active || this.punchAnim.hit) return null;
    const dur = this.punchAnim.dur || 0.55;
    const p = this.punchAnim.t / dur;
    // Hit while fist is at the impact hold for each style
    const style = this.punchAnim.style || 'straight';
    const inWindow =
      style === 'straight'
        ? p >= 0.28 && p <= 0.55
        : style === 'uppercut'
          ? p >= 0.5 && p <= 0.72
          : p >= 0.48 && p <= 0.7;
    if (!inWindow) return null;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const side = this.punchAnim.side;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    origin.addScaledVector(right, side * 0.15);
    origin.addScaledVector(dir, 1.6);
    const zone = this.punchAnim.zone;
    if (zone === 'head') origin.addScaledVector(up, 0.15);
    if (zone === 'legs') origin.addScaledVector(up, -0.3);
    const powerBase = zone === 'head' ? 18 : zone === 'legs' ? 11 : 14;
    return {
      point: origin,
      dir,
      side,
      zone,
      power: (powerBase + this.combo * 1.4) * this.damageMul,
    };
  }

  markPunchHit() {
    this.punchAnim.hit = true;
  }

  takeDamage(amount, opts = {}) {
    if (this.invuln > 0 || !this.alive || this.knocked) return { damage: 0, blocked: false };
    let dmg = amount;
    let blocked = false;
    if (this.blocking) {
      dmg *= 0.18;
      blocked = true;
    }
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = blocked ? 0.12 : 0.32;
    this.combo = 0;
    if (this.hp <= 0) {
      this.alive = false;
      this.beginKnockdown(opts.fromDir);
    }
    return { damage: dmg, blocked };
  }

  beginKnockdown(fromDir) {
    if (this.knocked) return;
    this.knocked = true;
    this.knockT = 0;
    this.blocking = false;
    this.punchAnim.active = false;
    this.knockDir = fromDir ? fromDir.clone() : new THREE.Vector3(0, 0, 1);
    this.knockDir.y = 0;
    if (this.knockDir.lengthSq() < 0.01) this.knockDir.set(0, 0, 1);
    this.knockDir.normalize();
  }

  applyDifficulty(diff) {
    this.damageMul = diff.playerDamageMul;
  }

  reset() {
    this.position.set(0, 1.65, 4.5);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.hp = this.maxHp;
    this.alive = true;
    this.knocked = false;
    this.knockT = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.blocking = false;
    this.blockBlend = 0;
    this.punchCooldown = 0;
    this.punchAnim.active = false;
    this.visible = true;
    this.keys.clear();
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchBlock = false;
    this.touchSprint = false;
    for (const arm of [this.leftArm, this.rightArm]) {
      this.#applyPose(arm, arm.userData.rest);
    }
  }

  separateFrom(enemyPos, enemyRadius) {
    const dx = this.position.x - enemyPos.x;
    const dz = this.position.z - enemyPos.z;
    const dist = Math.hypot(dx, dz);
    const minDist = this.radius + enemyRadius;
    if (dist < 0.0001) {
      this.position.x += minDist;
      return;
    }
    if (dist < minDist) {
      const push = (minDist - dist) / dist;
      this.position.x += dx * push;
      this.position.z += dz * push;
      const nx = dx / dist;
      const nz = dz / dist;
      const vn = this.velocity.x * nx + this.velocity.z * nz;
      if (vn < 0) {
        this.velocity.x -= vn * nx;
        this.velocity.z -= vn * nz;
      }
    }
  }

  update(dt, arenaRadius) {
    if (this.knocked) return this.#updateKnockdown(dt);
    if (!this.alive) return false;

    this.blocking = this.keys.has('Space') || this.touchBlock;
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.combo = 0;

    if (this.keys.has('KeyQ')) {
      this.keys.delete('KeyQ');
      this.tryPunch(-1);
    }
    if (this.keys.has('KeyE')) {
      this.keys.delete('KeyE');
      this.tryPunch(1);
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW')) wish.add(forward);
    if (this.keys.has('KeyS')) wish.sub(forward);
    if (this.keys.has('KeyD')) wish.add(right);
    if (this.keys.has('KeyA')) wish.sub(right);
    // Virtual stick: Y- = forward, X+ = strafe right
    if (this.touchEnabled && (Math.abs(this.touchMoveX) > 0.12 || Math.abs(this.touchMoveY) > 0.12)) {
      wish.addScaledVector(forward, -this.touchMoveY);
      wish.addScaledVector(right, this.touchMoveX);
    }
    if (wish.lengthSq() > 0) wish.normalize();

    const sprint =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprint;
    const speed = this.speed * (sprint ? this.sprintMul : 1) * (this.blocking ? 0.45 : 1);
    this.velocity.lerp(wish.multiplyScalar(speed), 1 - Math.pow(0.001, dt));
    this.position.addScaledVector(this.velocity, dt);

    const flat = new THREE.Vector2(this.position.x, this.position.z);
    const maxR = arenaRadius - 0.7;
    if (flat.length() > maxR) {
      flat.setLength(maxR);
      this.position.x = flat.x;
      this.position.z = flat.y;
      this.velocity.multiplyScalar(0.4);
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;

    this.#animateArms(dt);
    this.hitbox.center.set(this.position.x, this.position.y - 0.35, this.position.z);
    return false;
  }

  #updateKnockdown(dt) {
    this.knockT += dt;
    const t = Math.min(1, this.knockT / 1.55);
    this.position.addScaledVector(this.knockDir, 1.8 * dt * (1 - t));
    this.position.y = THREE.MathUtils.lerp(1.65, 0.35, this.#easeOut(t));
    this.pitch = THREE.MathUtils.lerp(this.pitch, 0.95, Math.min(1, dt * 3));
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = THREE.MathUtils.lerp(0, -0.55, this.#easeOut(t));
    for (const [arm, side] of [
      [this.leftArm, -1],
      [this.rightArm, 1],
    ]) {
      arm.position.set(side * 0.45, -0.5, -0.3);
      arm.rotation.set(1.0, side * 0.35, side * 0.7);
    }
    return this.knockT >= 1.85;
  }

  #easeOut(t) {
    return 1 - (1 - t) * (1 - t);
  }

  #animateArms(dt) {
    if (this.punchAnim.active) {
      this.punchAnim.t += dt;
      const dur = this.punchAnim.dur || 0.55;
      this.#setPunchFrame(this.punchAnim.side, Math.min(1, this.punchAnim.t / dur));
      if (this.punchAnim.t >= dur) this.punchAnim.active = false;
      return;
    }

    const targetBlock = this.blocking ? 1 : 0;
    this.blockBlend += (targetBlock - this.blockBlend) * Math.min(1, dt * (this.blocking ? 16 : 12));
    if (this.blocking && this.blockBlend > 0.85) this.blockBlend = 1;
    if (!this.blocking && this.blockBlend < 0.15) this.blockBlend = 0;

    const bob = Math.sin(performance.now() * 0.01) * 0.012;

    for (const arm of [this.leftArm, this.rightArm]) {
      const side = arm.userData.side;
      const rest = {
        pos: arm.userData.rest.pos.clone(),
        rot: arm.userData.rest.rot.clone(),
      };
      rest.pos.y += bob;

      const block =
        side < 0
          ? {
              pos: new THREE.Vector3(-0.32, -0.06, -0.64),
              rot: new THREE.Euler(-1.15, 0.6, 0.12),
            }
          : {
              pos: new THREE.Vector3(0.34, -0.1, -0.6),
              rot: new THREE.Euler(-1.0, -0.55, -0.15),
            };

      if (this.blockBlend >= 0.99) this.#applyPose(arm, block);
      else if (this.blockBlend <= 0.01) this.#applyPose(arm, rest);
      else this.#applyPose(arm, this.#mix(rest, block, this.blockBlend));
    }
  }

  registerHit() {
    this.combo += 1;
    this.comboTimer = 1.6;
  }
}
