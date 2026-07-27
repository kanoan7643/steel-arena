export class Sfx {
  constructor() {
    this.ctx = null;
    this._noise = null;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  #noiseBuf() {
    const ctx = this.ensure();
    if (this._noise) return this._noise;
    const len = ctx.sampleRate * 0.35;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  tone({
    freq = 220,
    dur = 0.12,
    type = 'square',
    gain = 0.04,
    slide = 0,
    filterFreq = 1800,
    delay = 0,
    attack = 0.004,
  }) {
    const ctx = this.ensure();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    }
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise({
    dur = 0.08,
    gain = 0.03,
    filterFreq = 1200,
    type = 'bandpass',
    delay = 0,
    Q = 0.8,
  }) {
    const ctx = this.ensure();
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.#noiseBuf();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    filter.type = type;
    filter.frequency.value = filterFreq;
    filter.Q.value = Q;
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Boxing end bell — metallic ring */
  bell(delay = 0) {
    const ctx = this.ensure();
    const t0 = ctx.currentTime + delay;
    const freqs = [830, 1245, 1660];
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 14;
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(0.055, t0 + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
      osc.connect(filter);
      filter.connect(amp);
      amp.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.2);
    }
    // Soft strike transient
    this.noise({ dur: 0.04, gain: 0.035, filterFreq: 2400, type: 'highpass', delay, Q: 0.5 });
  }

  /** Three rings — fight over */
  endBells(startAt = 0) {
    this.bell(startAt);
    this.bell(startAt + 0.55);
    this.bell(startAt + 1.1);
  }

  punch() {
    // Whoosh + glove thump
    this.noise({ dur: 0.07, gain: 0.04, filterFreq: 900, type: 'bandpass', Q: 1.2 });
    this.tone({ freq: 95, dur: 0.11, type: 'triangle', gain: 0.07, slide: -45, filterFreq: 700 });
    this.tone({ freq: 180, dur: 0.06, type: 'sawtooth', gain: 0.035, slide: -90, filterFreq: 1400 });
    this.tone({ freq: 48, dur: 0.14, type: 'sine', gain: 0.06, slide: -12, filterFreq: 220 });
  }

  hit() {
    // Heavy impact — 熱血 punch connect
    this.noise({ dur: 0.09, gain: 0.055, filterFreq: 550, type: 'lowpass', Q: 0.6 });
    this.noise({ dur: 0.05, gain: 0.04, filterFreq: 2800, type: 'highpass', Q: 0.4 });
    this.tone({ freq: 140, dur: 0.1, type: 'square', gain: 0.05, slide: -90, filterFreq: 900 });
    this.tone({ freq: 70, dur: 0.22, type: 'triangle', gain: 0.08, slide: -28, filterFreq: 480 });
    this.tone({ freq: 220, dur: 0.08, type: 'sawtooth', gain: 0.03, slide: -140, filterFreq: 1600, delay: 0.02 });
  }

  block() {
    // Steel clash
    this.noise({ dur: 0.05, gain: 0.04, filterFreq: 3200, type: 'bandpass', Q: 2.5 });
    this.tone({ freq: 420, dur: 0.07, type: 'square', gain: 0.035, slide: -80, filterFreq: 2200 });
    this.tone({ freq: 640, dur: 0.09, type: 'triangle', gain: 0.028, slide: -120, filterFreq: 3000, delay: 0.015 });
  }

  win() {
    // Rising fanfare sting, then three end bells
    this.tone({ freq: 392, dur: 0.14, type: 'sawtooth', gain: 0.04, filterFreq: 2200 });
    this.tone({ freq: 523, dur: 0.16, type: 'sawtooth', gain: 0.045, filterFreq: 2400, delay: 0.11 });
    this.tone({ freq: 659, dur: 0.22, type: 'triangle', gain: 0.05, filterFreq: 2600, delay: 0.22 });
    this.tone({ freq: 784, dur: 0.35, type: 'triangle', gain: 0.04, filterFreq: 2800, delay: 0.34 });
    this.noise({ dur: 0.12, gain: 0.025, filterFreq: 1800, type: 'bandpass', delay: 0.34, Q: 0.7 });
    // Three rings mark the fight is over
    this.endBells(0.7);
  }

  lose() {
    // Heavy fall sting, then three end bells
    this.tone({ freq: 180, dur: 0.28, type: 'sawtooth', gain: 0.05, slide: -90, filterFreq: 700 });
    this.tone({ freq: 110, dur: 0.4, type: 'triangle', gain: 0.055, slide: -50, filterFreq: 450, delay: 0.08 });
    this.tone({ freq: 70, dur: 0.5, type: 'sine', gain: 0.045, slide: -20, filterFreq: 250, delay: 0.16 });
    this.noise({ dur: 0.2, gain: 0.035, filterFreq: 400, type: 'lowpass', delay: 0.05, Q: 0.5 });
    this.endBells(0.7);
  }
}
