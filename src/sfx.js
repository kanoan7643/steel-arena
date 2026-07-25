export class Sfx {
  constructor() {
    this.ctx = null;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone({ freq = 220, dur = 0.12, type = 'square', gain = 0.04, slide = 0, filterFreq = 1800 }) {
    const ctx = this.ensure();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  punch() {
    this.tone({ freq: 120, dur: 0.09, type: 'triangle', gain: 0.05, slide: -60, filterFreq: 900 });
    this.tone({ freq: 60, dur: 0.12, type: 'sawtooth', gain: 0.03, slide: -30, filterFreq: 400 });
  }

  hit() {
    this.tone({ freq: 180, dur: 0.08, type: 'square', gain: 0.045, slide: -100 });
    this.tone({ freq: 90, dur: 0.16, type: 'triangle', gain: 0.05, slide: -40, filterFreq: 700 });
  }

  block() {
    this.tone({ freq: 300, dur: 0.07, type: 'square', gain: 0.03, slide: -20, filterFreq: 1200 });
  }

  win() {
    this.tone({ freq: 440, dur: 0.15, type: 'triangle', gain: 0.04, slide: 80 });
    setTimeout(() => this.tone({ freq: 660, dur: 0.2, type: 'triangle', gain: 0.04 }), 120);
  }

  lose() {
    this.tone({ freq: 220, dur: 0.25, type: 'sawtooth', gain: 0.04, slide: -120, filterFreq: 600 });
  }
}
