/** Prefer touch UI on phones / coarse pointers. */
export function prefersTouch() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  const touchPoints = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  return Boolean(coarse || (touchPoints && window.innerWidth < 900));
}

/**
 * On-screen controls for mobile:
 * left stick = move, right pad = look, buttons = punch / block / sprint.
 */
export class TouchControls {
  constructor(player) {
    this.player = player;
    this.root = document.getElementById('touch-controls');
    this.stick = document.getElementById('touch-stick');
    this.knob = document.getElementById('touch-stick-knob');
    this.lookPad = document.getElementById('touch-look');
    this.btnLeft = document.getElementById('touch-punch-l');
    this.btnRight = document.getElementById('touch-punch-r');
    this.btnBlock = document.getElementById('touch-block');
    this.btnSprint = document.getElementById('touch-sprint');

    this.enabled = false;
    this.moveX = 0;
    this.moveY = 0;
    this.sprint = false;
    this.blocking = false;

    this._stickId = null;
    this._lookId = null;
    this._stickCenter = { x: 0, y: 0 };
    this._lookLast = { x: 0, y: 0 };
    this._maxRadius = 48;

    if (!this.root) return;

    this.#bindStick();
    this.#bindLook();
    this.#bindButtons();
  }

  setActive(active) {
    this.enabled = active;
    this.player.touchEnabled = active;
    if (!this.root) return;
    this.root.classList.toggle('hidden', !active);
    if (!active) this.#resetStick();
  }

  #bindStick() {
    const el = this.stick;
    if (!el) return;

    const onStart = (e) => {
      if (!this.enabled || this._stickId != null) return;
      const t = e.changedTouches[0];
      this._stickId = t.identifier;
      const rect = el.getBoundingClientRect();
      this._stickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      this._maxRadius = Math.min(rect.width, rect.height) * 0.38;
      this.#updateStick(t.clientX, t.clientY);
      e.preventDefault();
    };

    const onMove = (e) => {
      if (this._stickId == null) return;
      const t = [...e.changedTouches].find((c) => c.identifier === this._stickId);
      if (!t) return;
      this.#updateStick(t.clientX, t.clientY);
      e.preventDefault();
    };

    const onEnd = (e) => {
      if (this._stickId == null) return;
      const ended = [...e.changedTouches].some((c) => c.identifier === this._stickId);
      if (!ended) return;
      this.#resetStick();
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
  }

  #updateStick(x, y) {
    let dx = x - this._stickCenter.x;
    let dy = y - this._stickCenter.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, this._maxRadius);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    this.moveX = dx / this._maxRadius;
    this.moveY = dy / this._maxRadius;
    this.player.touchMoveX = this.moveX;
    this.player.touchMoveY = this.moveY;
    if (this.knob) {
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  #resetStick() {
    this._stickId = null;
    this.moveX = 0;
    this.moveY = 0;
    this.player.touchMoveX = 0;
    this.player.touchMoveY = 0;
    if (this.knob) this.knob.style.transform = 'translate(0, 0)';
  }

  #bindLook() {
    const el = this.lookPad;
    if (!el) return;

    const onStart = (e) => {
      if (!this.enabled || this._lookId != null) return;
      const t = e.changedTouches[0];
      this._lookId = t.identifier;
      this._lookLast = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    };

    const onMove = (e) => {
      if (this._lookId == null || this.player.knocked) return;
      const t = [...e.changedTouches].find((c) => c.identifier === this._lookId);
      if (!t) return;
      const dx = t.clientX - this._lookLast.x;
      const dy = t.clientY - this._lookLast.y;
      this._lookLast = { x: t.clientX, y: t.clientY };
      // Match mouse look: pitch -= movementY
      this.player.yaw -= dx * 0.0034;
      this.player.pitch -= dy * 0.003;
      this.player.pitch = Math.max(-1.2, Math.min(1.2, this.player.pitch));
      e.preventDefault();
    };

    const onEnd = (e) => {
      if (this._lookId == null) return;
      const ended = [...e.changedTouches].some((c) => c.identifier === this._lookId);
      if (ended) this._lookId = null;
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
  }

  #bindButtons() {
    const hold = (btn, onDown, onUp) => {
      if (!btn) return;
      const down = (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        btn.classList.add('active');
        onDown();
      };
      const up = (e) => {
        e.preventDefault();
        btn.classList.remove('active');
        onUp?.();
      };
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('touchcancel', up, { passive: false });
    };

    hold(
      this.btnLeft,
      () => {
        if (this.player.alive && !this.player.knocked) this.player.tryPunch(-1);
      },
      null,
    );
    hold(
      this.btnRight,
      () => {
        if (this.player.alive && !this.player.knocked) this.player.tryPunch(1);
      },
      null,
    );
    hold(
      this.btnBlock,
      () => {
        this.blocking = true;
        this.player.touchBlock = true;
      },
      () => {
        this.blocking = false;
        this.player.touchBlock = false;
      },
    );
    hold(
      this.btnSprint,
      () => {
        this.sprint = true;
        this.player.touchSprint = true;
      },
      () => {
        this.sprint = false;
        this.player.touchSprint = false;
      },
    );
  }
}
