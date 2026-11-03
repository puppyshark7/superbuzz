/* ═══════════════════════════════════════════════════════════════════════════
   SuperBuzz — Synthesized Sound Effects (no external audio files needed)
   ═══════════════════════════════════════════════════════════════════════════ */

const SoundFX = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function playTone(freq, duration, type = 'sine', volume = 0.3) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      gain.gain.setValueAtTime(volume, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration);
    } catch (e) { /* audio not available */ }
  }

  return {
    buzzerOpen() {
      playTone(880, 0.15, 'sine', 0.25);
      setTimeout(() => playTone(1100, 0.15, 'sine', 0.25), 100);
    },
    buzzIn() {
      playTone(600, 0.08, 'square', 0.35);
      setTimeout(() => playTone(800, 0.12, 'square', 0.35), 60);
    },
    correct() {
      playTone(523, 0.12, 'sine', 0.3);
      setTimeout(() => playTone(659, 0.12, 'sine', 0.3), 100);
      setTimeout(() => playTone(784, 0.2, 'sine', 0.3), 200);
    },
    incorrect() {
      playTone(300, 0.3, 'sawtooth', 0.2);
    },
    lockout() {
      playTone(200, 0.15, 'square', 0.15);
    },
    nextQuestion() {
      playTone(440, 0.08, 'sine', 0.2);
      setTimeout(() => playTone(554, 0.08, 'sine', 0.2), 80);
      setTimeout(() => playTone(659, 0.1, 'sine', 0.2), 160);
    },
  };
})();
