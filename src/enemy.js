import * as THREE from 'three';
import { COLLIDE_RADIUS } from './config.js';

/** World Y of body parts (head is clearly above torso). */
const ZONE_Y = {
  head: 2.15,
  body: 1.25,
  legs: 0.45,
};

export class Enemy {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.speed = 2.4;
    this.damageMul = 0.65;
    this.attackDelay = [1.35, 2.1];
    this.blockChance = 0.22;
    this.proactiveBlock = 0.003;
    this.attackTimer = 1.8;
    this.stun = 0;
    this.invuln = 0;
    this.state = 'chase';
    this.attackProgress = 0;
    this.attackConnected = false;
    this.attackSide = 1;
    this.attackZone = 'body';
    this.blocking = false;
    this.blockZone = 'high';
    this.blockTimer = 0;
    this.knocked = false;
    this.knockT = 0;
    this.parts = {};
    this.radius = COLLIDE_RADIUS * 0.52;

    this.#buildBody();
    this.reset();
  }

  #buildBody() {
    const steel = new THREE.MeshStandardMaterial({
      color: 0x8b97a5,
      metalness: 0.92,
      roughness: 0.28,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x2a323c,
      metalness: 0.7,
      roughness: 0.4,
    });
    const hot = new THREE.MeshStandardMaterial({
      color: 0xff5a2a,
      emissive: 0xff3a10,
      emissiveIntensity: 0.8,
      metalness: 0.3,
      roughness: 0.35,
    });

    // Torso — shorter so head sits clearly on top
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.55, 6, 12), steel);
    this.torso.position.y = 1.2;
    this.torso.castShadow = true;
    this.torso.userData.part = 'body';
    this.root.add(this.torso);

    // Head — raised above shoulders
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), dark);
    this.head.position.y = 2.05;
    this.head.castShadow = true;
    this.head.userData.part = 'head';
    this.root.add(this.head);

    this.visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.08), hot);
    this.visor.position.set(0, 2.08, 0.2);
    this.root.add(this.visor);

    // Neck connector so head reads as top
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.18, 8), dark);
    neck.position.y = 1.78;
    this.root.add(neck);

    this.leftArm = this.#arm(-1, steel, hot);
    this.rightArm = this.#arm(1, steel, hot);
    this.root.add(this.leftArm, this.rightArm);

    this.hip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.35), dark);
    this.hip.position.y = 0.78;
    this.hip.userData.part = 'body';
    this.root.add(this.hip);

    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.55, 4, 8), steel);
      leg.position.set(side * 0.18, 0.38, 0);
      leg.castShadow = true;
      leg.userData.part = 'legs';
      this.root.add(leg);
      this.legs.push(leg);
    }

    this.#refreshPartBoxes();
  }

  #arm(side, steel, hot) {
    const g = new THREE.Group();
    g.position.set(side * 0.52, 1.45, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.48, 4, 8), steel);
    upper.rotation.z = side * 0.4;
    upper.position.set(side * 0.08, -0.14, 0);
    g.add(upper);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.38), hot);
    fist.position.set(side * 0.22, -0.58, 0.15);
    fist.name = 'fist';
    g.add(fist);
    g.userData.side = side;
    g.userData.restRot = new THREE.Euler(0.25, 0, side * 0.25);
    g.userData.restPos = g.position.clone();
    g.rotation.copy(g.userData.restRot);
    return g;
  }

  #refreshPartBoxes() {
    const o = this.root.position;
    this.parts = {
      head: new THREE.Sphere(new THREE.Vector3(o.x, o.y + ZONE_Y.head, o.z), 0.42),
      body: new THREE.Sphere(new THREE.Vector3(o.x, o.y + ZONE_Y.body, o.z), 0.52),
      legs: new THREE.Sphere(new THREE.Vector3(o.x, o.y + ZONE_Y.legs, o.z), 0.46),
    };
  }

  applyDifficulty(diff) {
    this.speed = diff.enemySpeed;
    this.damageMul = diff.enemyDamageMul;
    this.attackDelay = diff.enemyAttackDelay;
    this.blockChance = diff.enemyBlockChance;
    this.proactiveBlock = diff.enemyProactiveBlock;
    this.maxHp = diff.enemyHp;
    this.hp = diff.enemyHp;
  }

  reset() {
    this.root.position.set(0, 0, -3.2);
    this.hp = this.maxHp;
    this.alive = true;
    this.knocked = false;
    this.knockT = 0;
    this.attackTimer = this.attackDelay[0];
    this.stun = 0;
    this.invuln = 0;
    this.state = 'chase';
    this.attackProgress = 0;
    this.attackConnected = false;
    this.blocking = false;
    this.blockTimer = 0;
    this.root.visible = true;
    this.root.rotation.set(0, 0, 0);
    this.root.scale.set(1, 1, 1);
    this.torso.position.y = 1.2;
    this.head.position.y = 2.05;
    this.visor.position.y = 2.08;
    this.#resetArms();
    for (const leg of this.legs) {
      leg.rotation.set(0, 0, 0);
      leg.position.y = 0.38;
      leg.position.z = 0;
    }
  }

  #resetArms() {
    for (const arm of [this.leftArm, this.rightArm]) {
      arm.rotation.copy(arm.userData.restRot);
      arm.position.copy(arm.userData.restPos);
    }
  }

  resolvePunch(punch) {
    if (!this.alive || this.knocked) return null;

    const hit = this.#pickPart(punch);
    if (!hit) return null;

    const guarded = this.#isGuarding(hit.zone);
    if (guarded) {
      this.invuln = 0.1;
      return {
        damage: 0,
        blocked: true,
        zone: hit.zone,
        point: hit.point,
      };
    }

    if (this.invuln > 0) return null;

    const mul = hit.zone === 'head' ? 1.4 : hit.zone === 'legs' ? 0.85 : 1;
    const amount = punch.power * mul;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = 0.18;
    this.stun = hit.zone === 'head' ? 0.45 : 0.28;
    this.blocking = false;
    this.blockTimer = 0;
    this.state = 'stun';
    if (punch.dir) this.root.position.addScaledVector(punch.dir, hit.zone === 'head' ? 0.4 : 0.28);

    if (this.hp <= 0) {
      this.alive = false;
      this.beginKnockdown(punch.dir);
    }

    return {
      damage: amount,
      blocked: false,
      zone: hit.zone,
      point: hit.point,
    };
  }

  #pickPart(punch) {
    this.#refreshPartBoxes();
    const preferred = punch.zone;

    // Prefer the aimed zone by vertical proximity + preferred bias
    let best = null;
    let bestScore = Infinity;
    for (const zone of ['head', 'body', 'legs']) {
      const sphere = this.parts[zone];
      const dist = punch.point.distanceTo(sphere.center);
      const reach = sphere.radius + (zone === preferred ? 0.45 : 0.18);
      if (dist > reach) continue;
      const score = dist + (zone === preferred ? -0.35 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { zone, point: sphere.center.clone() };
      }
    }

    if (best) return best;

    const body = this.parts.body;
    if (punch.point.distanceTo(body.center) < 1.25) {
      return {
        zone: preferred,
        point: new THREE.Vector3(body.center.x, this.root.position.y + ZONE_Y[preferred], body.center.z),
      };
    }
    return null;
  }

  #isGuarding(zone) {
    if (!this.blocking || this.stun > 0) return false;
    if (this.blockZone === 'high' && (zone === 'head' || zone === 'body')) return true;
    if (this.blockZone === 'low' && (zone === 'body' || zone === 'legs')) return true;
    return false;
  }

  beginKnockdown(fromDir) {
    if (this.knocked) return;
    this.knocked = true;
    this.knockT = 0;
    this.blocking = false;
    this.state = 'dead';
    this.knockDir = fromDir ? fromDir.clone() : new THREE.Vector3(0, 0, 1);
    this.knockDir.y = 0;
    if (this.knockDir.lengthSq() < 0.01) this.knockDir.set(0, 0, -1);
    this.knockDir.normalize();
  }

  /** Push this enemy away from player on XZ */
  separateFrom(playerPos, playerRadius) {
    if (this.knocked) return;
    const dx = this.root.position.x - playerPos.x;
    const dz = this.root.position.z - playerPos.z;
    const dist = Math.hypot(dx, dz);
    const minDist = this.radius + playerRadius;
    if (dist < 0.0001) {
      this.root.position.x += minDist;
      return;
    }
    if (dist < minDist) {
      const push = (minDist - dist) * 0.55 / dist;
      this.root.position.x += dx * push;
      this.root.position.z += dz * push;
    }
  }

  update(dt, playerPos, arenaRadius, playerPunching, playerAimZone) {
    if (this.knocked) {
      return { attackHit: null, knockDone: this.#updateKnockdown(dt) };
    }
    if (!this.alive) return { attackHit: null, knockDone: false };

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.blockTimer = Math.max(0, this.blockTimer - dt);

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.root.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const dir = dist > 0.001 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);
    this.facing = Math.atan2(dir.x, dir.z);
    this.root.rotation.y = this.facing;

    let attackHit = null;

    if (this.stun > 0) {
      this.state = 'stun';
      this.blocking = false;
      this.#resetArms();
    } else if (this.state === 'attack') {
      attackHit = this.#updateAttack(dt, dist, dir);
    } else if (this.state === 'block') {
      this.#poseBlock();
      if (this.blockTimer <= 0) {
        this.blocking = false;
        this.state = 'chase';
        this.#resetArms();
      }
    } else {
      this.#updateChase(dt, dist, dir, playerPunching, playerAimZone);
    }

    const flat = new THREE.Vector2(this.root.position.x, this.root.position.z);
    const maxR = arenaRadius - 0.9;
    if (flat.length() > maxR) {
      flat.setLength(maxR);
      this.root.position.x = flat.x;
      this.root.position.z = flat.y;
    }

    this.#refreshPartBoxes();
    return { attackHit, knockDone: false };
  }

  #updateChase(dt, dist, dir, playerPunching, playerAimZone) {
    this.state = 'chase';
    this.blocking = false;

    if (playerPunching && dist < 2.5 && Math.random() < this.blockChance) {
      this.state = 'block';
      this.blocking = true;
      this.blockTimer = 0.5 + Math.random() * 0.2;
      this.blockZone = playerAimZone === 'legs' ? 'low' : 'high';
      this.#poseBlock();
      return;
    }

    if (dist < 2.2 && this.attackTimer > 0.4 && Math.random() < this.proactiveBlock) {
      this.state = 'block';
      this.blocking = true;
      this.blockTimer = 0.55;
      this.blockZone = Math.random() < 0.65 ? 'high' : 'low';
      this.#poseBlock();
      return;
    }

    const fightDist = 1.75;
    if (dist > fightDist + 0.15) {
      this.root.position.addScaledVector(dir, this.speed * dt);
    } else if (dist < fightDist - 0.2) {
      this.root.position.addScaledVector(dir, -2.0 * dt);
    } else if (this.attackTimer <= 0) {
      this.state = 'attack';
      this.attackProgress = 0;
      this.attackConnected = false;
      this.attackSide = Math.random() < 0.5 ? -1 : 1;
      this.attackZone = Math.random() < 0.22 ? 'head' : Math.random() < 0.3 ? 'legs' : 'body';
    } else {
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      this.root.position.addScaledVector(side, Math.sin(performance.now() * 0.002) * 1.2 * dt);
    }

    const bob = Math.sin(performance.now() * 0.01) * 0.025;
    this.torso.position.y = 1.2 + bob;
    this.head.position.y = 2.05 + bob;
    this.visor.position.y = 2.08 + bob;
    this.#resetArms();
  }

  #poseBlock() {
    const high = this.blockZone === 'high';
    for (const arm of [this.leftArm, this.rightArm]) {
      const side = arm.userData.side;
      if (high) {
        // Big cross-guard covering head + upper chest
        arm.rotation.set(-1.6, side * 0.7, side * 0.9);
        arm.position.set(side * 0.12, 1.95, 0.55);
      } else {
        // Low wall across the gut
        arm.rotation.set(-0.7, side * 0.35, side * 0.95);
        arm.position.set(side * 0.18, 1.2, 0.6);
      }
    }
  }

  #updateAttack(dt, dist, dir) {
    this.attackProgress += dt;
    const t = this.attackProgress;
    const arm = this.attackSide < 0 ? this.leftArm : this.rightArm;
    const other = this.attackSide < 0 ? this.rightArm : this.leftArm;
    const side = arm.userData.side;

    // Other arm pulls back into a loaded guard
    other.rotation.set(-0.4, other.userData.side * 0.3, other.userData.side * 0.4);
    other.position.set(other.userData.side * 0.45, 1.4, -0.1);

    let k;
    if (t < 0.12) k = 0; // wind-up hold
    else if (t < 0.22) k = (t - 0.12) / 0.1;
    else if (t < 0.36) k = 1;
    else k = Math.max(0, 1 - (t - 0.36) / 0.2);
    const e = k * k * (3 - 2 * k);

    const liftY = this.attackZone === 'head' ? 0.45 : this.attackZone === 'legs' ? -0.55 : 0.05;
    // Wind-up then thrust
    if (t < 0.12) {
      arm.rotation.set(0.6, side * 0.4, side * 0.5);
      arm.position.set(side * 0.65, 1.25, -0.25);
    } else {
      arm.rotation.set(-1.7 * e, side * 0.1, side * (-0.2 * e));
      arm.position.set(side * (0.55 - 0.35 * e), 1.45 + liftY * e, -0.2 + 1.05 * e);
    }

    let attackHit = null;
    if (!this.attackConnected && t > 0.18 && t < 0.34 && dist < 2.2) {
      this.attackConnected = true;
      const y = ZONE_Y[this.attackZone];
      const base =
        this.attackZone === 'head' ? 15 : this.attackZone === 'legs' ? 9 : 12;
      attackHit = {
        damage: (base + Math.random() * 3) * this.damageMul,
        zone: this.attackZone,
        point: this.root.position.clone().add(dir.clone().multiplyScalar(0.9)).setY(y),
        fromDir: dir.clone().negate(),
      };
    }

    if (t >= 0.58) {
      this.state = 'chase';
      this.attackProgress = 0;
      this.attackConnected = false;
      this.#resetArms();
      const [lo, hi] = this.attackDelay;
      this.attackTimer = lo + Math.random() * (hi - lo);
    }
    return attackHit;
  }

  #updateKnockdown(dt) {
    this.knockT += dt;
    const t = Math.min(1, this.knockT / 1.4);

    this.root.position.addScaledVector(this.knockDir, 2.2 * dt * (1 - t));
    this.root.position.y = 0;
    this.root.rotation.x = THREE.MathUtils.lerp(0, -Math.PI * 0.5, this.#easeOut(Math.min(1, t * 1.15)));
    this.root.rotation.z = Math.sin(this.knockT * 6) * 0.08 * (1 - t);

    this.leftArm.rotation.set(-0.4, -0.8, -1.2);
    this.rightArm.rotation.set(-0.4, 0.8, 1.2);
    this.leftArm.position.set(-0.7, 1.1, 0.2);
    this.rightArm.position.set(0.7, 1.1, 0.2);
    for (const [i, leg] of this.legs.entries()) {
      leg.rotation.x = -0.6;
      leg.position.z = -0.15;
      leg.rotation.z = (i === 0 ? -1 : 1) * 0.25;
    }

    if (t > 0.85) {
      this.root.position.y = THREE.MathUtils.lerp(this.root.position.y, 0.15, dt * 8);
    }

    return this.knockT >= 2.0;
  }

  #easeOut(t) {
    return 1 - (1 - t) * (1 - t);
  }
}
