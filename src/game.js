import * as THREE from 'three';
import { createArena } from './arena.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Sfx } from './sfx.js';
import { DIFFICULTIES } from './config.js';

const ZONE_LABEL = { head: '頭部', body: '軀幹', legs: '下盤' };
const STYLE_LABEL = { uppercut: '上鉤拳', straight: '直拳', hook: '下鉤拳' };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.ended = false;
    this.finishing = false;
    this.pendingResult = null;
    this.timeLeft = 99;
    this.round = 1;
    this.difficulty = DIFFICULTIES.easy;
    this.clock = new THREE.Clock();
    this.sfx = new Sfx();
    this.hitMarkerT = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a0f);
    this.scene.fog = new THREE.FogExp2(0x0a1018, 0.018);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 80);

    const hemi = new THREE.HemisphereLight(0xb8cce0, 0x1a1410, 0.75);
    this.scene.add(hemi);
    const fill = new THREE.AmbientLight(0x3a4658, 0.55);
    this.scene.add(fill);

    this.arena = createArena(this.scene);
    this.player = new Player(this.camera);
    this.player.enablePointerLock(canvas);
    this.enemy = new Enemy(this.scene);

    this.sparks = this.#createSparks();
    this.scene.add(this.sparks);

    this.ui = {
      title: document.getElementById('title-screen'),
      hud: document.getElementById('hud'),
      result: document.getElementById('result-screen'),
      resultTitle: document.getElementById('result-title'),
      resultSub: document.getElementById('result-sub'),
      playerHp: document.getElementById('player-hp'),
      enemyHp: document.getElementById('enemy-hp'),
      timer: document.getElementById('timer'),
      round: document.getElementById('round-text'),
      combo: document.getElementById('combo'),
      hitFlash: document.getElementById('hit-flash'),
      aimZone: document.getElementById('aim-zone'),
      hitMarker: document.getElementById('hit-marker'),
    };

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this._raf = null;
    this.#idlePreview();
  }

  #createSparks() {
    const count = 40;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xff8a4c,
      size: 0.08,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.userData = { life: 0, velocities: [] };
    return points;
  }

  #burstSparks(at, color = 0xff8a4c) {
    const pos = this.sparks.geometry.attributes.position;
    const velocities = [];
    this.sparks.material.color.setHex(color);
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        at.x + (Math.random() - 0.5) * 0.2,
        at.y + (Math.random() - 0.5) * 0.2,
        at.z + (Math.random() - 0.5) * 0.2,
      );
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4,
        ),
      );
    }
    pos.needsUpdate = true;
    this.sparks.userData.life = 0.35;
    this.sparks.userData.velocities = velocities;
    this.sparks.material.opacity = 1;
  }

  #idlePreview() {
    this.player.visible = false;
    this.camera.position.set(6.5, 3.2, 8.5);
    this.camera.lookAt(0, 1.2, 0);
    const tick = () => {
      if (this.running) return;
      const t = performance.now() * 0.00025;
      this.camera.position.x = Math.cos(t) * 9;
      this.camera.position.z = Math.sin(t) * 9;
      this.camera.position.y = 3.1 + Math.sin(t * 1.3) * 0.25;
      this.camera.lookAt(0, 1.2, 0);
      this.enemy.root.rotation.y = t * 0.8;
      this.renderer.autoClear = true;
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  #draw() {
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    // Second pass: first-person arms (own scene, always on top)
    this.player.renderViewmodel(this.renderer);
  }

  start() {
    this.sfx.ensure();
    this.ui.title.classList.add('hidden');
    this.ui.result.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.restart(false);
    this.canvas.requestPointerLock();
  }

  setDifficulty(id) {
    this.difficulty = DIFFICULTIES[id] || DIFFICULTIES.easy;
  }

  restart(requestLock = true) {
    cancelAnimationFrame(this._raf);
    this.ended = false;
    this.finishing = false;
    this.pendingResult = null;
    this.running = true;
    this.timeLeft = 99;
    this.round = 1;
    this.player.applyDifficulty(this.difficulty);
    this.enemy.applyDifficulty(this.difficulty);
    this.player.reset();
    this.enemy.reset();
    this.ui.result.classList.add('hidden');
    this.ui.title.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.round.textContent = `ROUND ${this.round}`;
    this.ui.hitMarker.classList.remove('show');
    this.clock.start();
    if (requestLock) this.canvas.requestPointerLock();
    this.#loop();
  }

  goToMenu() {
    cancelAnimationFrame(this._raf);
    this.ended = false;
    this.finishing = false;
    this.pendingResult = null;
    this.running = false;
    this.player.visible = false;
    this.player.blocking = false;
    this.player.punchAnim.active = false;
    document.exitPointerLock?.();
    this.ui.result.classList.add('hidden');
    this.ui.hud.classList.add('hidden');
    this.ui.title.classList.remove('hidden');
    this.enemy.reset();
    this.#idlePreview();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.player.viewCamera.aspect = w / Math.max(1, h);
    this.player.viewCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  #loop() {
    if (!this.running && !this.finishing) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.#update(dt);
    this.#draw();
    this._raf = requestAnimationFrame(() => this.#loop());
  }

  #update(dt) {
    if (this.ended) return;

    if (this.finishing) {
      const playerDone = this.player.knocked ? this.player.update(dt, this.arena.radius) : true;
      const enemyPack = this.enemy.knocked
        ? this.enemy.update(dt, this.player.position, this.arena.radius, false, 'body')
        : { knockDone: true };
      this.#updateSparks(dt);
      this.#syncHud();
      if (playerDone && enemyPack.knockDone) {
        this.#showResult();
      }
      return;
    }

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if (this.player.hp >= this.enemy.hp) {
        this.enemy.beginKnockdown(new THREE.Vector3(0, 0, 1));
        this.#beginFinish(true, '時間到 — 你靠血量壓制勝出。');
      } else {
        this.player.beginKnockdown(new THREE.Vector3(0, 0, 1));
        this.#beginFinish(false, '時間到 — 對手的鋼鐵更堅硬。');
      }
      return;
    }

    const playerPunching = this.player.punchAnim.active;
    const aimZone = this.player.getAimZone();
    this.player.update(dt, this.arena.radius);
    const { attackHit } = this.enemy.update(
      dt,
      this.player.position,
      this.arena.radius,
      playerPunching,
      aimZone,
    );

    // Body collision — cannot walk through each other
    if (!this.player.knocked && !this.enemy.knocked) {
      this.player.separateFrom(this.enemy.root.position, this.enemy.radius);
      this.enemy.separateFrom(this.player.position, this.player.radius);
      this.#clampToArena(this.player.position, 0.7);
      this.#clampToArena(this.enemy.root.position, 0.9);
      this.camera.position.copy(this.player.position);
    }

    const punch = this.player.getPunchPoint();
    if (punch && this.enemy.alive && !this.enemy.knocked) {
      const result = this.enemy.resolvePunch(punch);
      if (result) {
        this.player.markPunchHit();
        if (result.blocked) {
          this.sfx.block();
          this.#burstSparks(result.point, 0x9ec7ff);
          this.#showHitMarker('格擋!', true);
        } else if (result.damage > 0) {
          this.player.registerHit();
          this.sfx.hit();
          this.#burstSparks(result.point);
          this.camera.position.addScaledVector(punch.dir, -0.05);
          this.#showHitMarker(ZONE_LABEL[result.zone] || '命中');
        }
      }
    }

    if (attackHit && this.player.alive && !this.player.knocked) {
      const { damage, blocked } = this.player.takeDamage(attackHit.damage, {
        fromDir: attackHit.fromDir,
      });
      if (damage > 0 || blocked) {
        if (blocked) this.sfx.block();
        else {
          this.sfx.hit();
          this.ui.hitFlash.classList.add('on');
          setTimeout(() => this.ui.hitFlash.classList.remove('on'), 120);
        }
        this.#burstSparks(attackHit.point, blocked ? 0x9ec7ff : 0xff8a4c);
      }
    }

    if (this.player.consumeSwingSfx()) {
      this.sfx.punch();
      const style = this.player.punchAnim.style;
      if (style && STYLE_LABEL[style]) this.#showHitMarker(STYLE_LABEL[style]);
    }

    this.#updateSparks(dt);
    this.#syncHud();

    if (this.enemy.knocked && !this.finishing) {
      this.#beginFinish(true, '對手倒地。鐵籠為你喝采。');
    } else if (this.player.knocked && !this.finishing) {
      this.#beginFinish(false, '你被擊倒在鋼鐵地板上。');
    }
  }

  #beginFinish(won, sub) {
    this.finishing = true;
    this.pendingResult = { won, sub };
    this.player.blocking = false;
    this.player.punchAnim.active = false;
    if (won) this.sfx.win();
    else this.sfx.lose();
  }

  #showResult() {
    this.finishing = false;
    this.ended = true;
    this.running = false;
    document.exitPointerLock?.();
    const { won, sub } = this.pendingResult;
    this.ui.result.classList.remove('hidden');
    this.ui.resultTitle.textContent = won ? '勝利' : '敗北';
    this.ui.resultTitle.style.color = won ? '#ff5a2a' : '#8ea0b0';
    this.ui.resultSub.textContent = sub;
  }

  #showHitMarker(text, blocked = false) {
    this.ui.hitMarker.textContent = text;
    this.ui.hitMarker.classList.toggle('blocked', blocked);
    this.ui.hitMarker.classList.remove('show');
    void this.ui.hitMarker.offsetWidth;
    this.ui.hitMarker.classList.add('show');
    this.hitMarkerT = 0.55;
  }

  #clampToArena(pos, pad) {
    const flat = new THREE.Vector2(pos.x, pos.z);
    const maxR = this.arena.radius - pad;
    if (flat.length() > maxR) {
      flat.setLength(maxR);
      pos.x = flat.x;
      pos.z = flat.y;
    }
  }

  #updateSparks(dt) {
    if (this.hitMarkerT > 0) {
      this.hitMarkerT -= dt;
      if (this.hitMarkerT <= 0) this.ui.hitMarker.classList.remove('show');
    }
    if (this.sparks.userData.life <= 0) {
      this.sparks.material.opacity = 0;
      return;
    }
    this.sparks.userData.life -= dt;
    const pos = this.sparks.geometry.attributes.position;
    const vels = this.sparks.userData.velocities;
    for (let i = 0; i < pos.count; i++) {
      const v = vels[i];
      if (!v) continue;
      v.y -= 9 * dt;
      pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt);
    }
    pos.needsUpdate = true;
    this.sparks.material.opacity = Math.max(0, this.sparks.userData.life / 0.35);
  }

  #syncHud() {
    this.ui.playerHp.style.transform = `scaleX(${Math.max(0, this.player.hp / this.player.maxHp)})`;
    this.ui.enemyHp.style.transform = `scaleX(${Math.max(0, this.enemy.hp / this.enemy.maxHp)})`;
    this.ui.timer.textContent = String(Math.ceil(this.timeLeft)).padStart(2, '0');
    if (this.player.combo >= 2) {
      this.ui.combo.textContent = `${this.player.combo} HIT`;
      this.ui.combo.classList.add('show');
    } else {
      this.ui.combo.classList.remove('show');
    }

    if (!this.player.knocked && this.running) {
      const zone = this.player.getAimZone();
      const style = this.player.getPunchStyle();
      this.ui.aimZone.textContent = `${ZONE_LABEL[zone]} · ${STYLE_LABEL[style]}`;
      this.ui.aimZone.dataset.zone = zone;
    }
  }
}
