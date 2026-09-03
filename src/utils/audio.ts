/**
 * High-quality procedural Web Audio synthesizer for soothing aquatic sound effects
 * and relaxing ambient reef background music.
 *
 * Uses zero external audio files — 100% pure Web Audio oscillators and filters:
 * - Deep calm ocean swell (warm filtered ocean wash)
 * - Ethereal ambient musical pad chords (calming, gentle evolving oceanic harmony)
 * - Occasional gentle water chimes (sunlight glistening through the water column)
 * - Subtle occasional rising bubbles (soft ascending water droplets moving to the surface)
 * - Nibble and celebration sound effects with full global mute toggle
 */

export type SoundMode = 'off' | 'spa' | 'carwash';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let ambientGain: GainNode | null = null;
let carwashGain: GainNode | null = null;

let soundMode: SoundMode = 'spa';
let lastSoundTime = 0;
let noteIndex = 0;

// Ambient (Spa) loop handles & state
let isAmbientRunning = false;
let ambientTimer: NodeJS.Timeout | null = null;
let bubbleTimer: NodeJS.Timeout | null = null;
let chimeTimer: NodeJS.Timeout | null = null;
let oceanNoiseSource: AudioBufferSourceNode | null = null;
let oceanGainNode: GainNode | null = null;
let oceanLfoTimer: NodeJS.Timeout | null = null;

// Carwash groove handles & state
let isCarwashRunning = false;
let carwashSchedulerTimer: NodeJS.Timeout | null = null;
let carwashNextStepTime = 0;
let carwashStepIndex = 0;

// Gentle pentatonic aquatic scale frequencies for parasite nibbles
const PENTATONIC_FREQS = [587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

// Peaceful oceanic ambient chord progressions (open, warm voicings)
const AMBIENT_CHORDS = [
  // Dadd9: D3, A3, F#4, E5
  [146.83, 220.0, 369.99, 659.25],
  // Gmaj7: G2, D3, B3, F#4
  [98.0, 146.83, 246.94, 369.99],
  // Bm7: B2, F#3, D4, A4
  [123.47, 185.0, 293.66, 440.0],
  // Aadd9: A2, E3, C#4, B4
  [110.0, 164.81, 277.18, 493.88],
];
let chordIndex = 0;

// Gentle high chimes (light on water)
const CHIME_FREQS = [587.33, 739.99, 880.0, 987.77, 1174.66, 1318.51];

// Initialize sound preference from localStorage if present
if (typeof window !== 'undefined') {
  try {
    const savedMode = localStorage.getItem('reef_sound_mode') as SoundMode | null;
    if (savedMode === 'off' || savedMode === 'spa' || savedMode === 'carwash') {
      soundMode = savedMode;
    } else {
      const savedLegacy = localStorage.getItem('reef_sound_enabled');
      if (savedLegacy === 'false') {
        soundMode = 'off';
      } else {
        soundMode = 'spa';
      }
    }
  } catch {}
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();

    // Master output bus
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(soundMode !== 'off' ? 1.0 : 0.0, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    // Sound effects bus (parasite nibbles, celebration)
    sfxGain = audioCtx.createGain();
    sfxGain.gain.setValueAtTime(0.75, audioCtx.currentTime);
    sfxGain.connect(masterGain);

    // Ambient background bus (relaxing spa soundscape)
    ambientGain = audioCtx.createGain();
    ambientGain.gain.setValueAtTime(0.28, audioCtx.currentTime);
    ambientGain.connect(masterGain);

    // Carwash upbeat background bus (groovy bass & rhythm)
    carwashGain = audioCtx.createGain();
    carwashGain.gain.setValueAtTime(0.28, audioCtx.currentTime);
    carwashGain.connect(masterGain);
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

/**
 * Returns current sound mode ('off' | 'spa' | 'carwash')
 */
export function getSoundMode(): SoundMode {
  return soundMode;
}

/**
 * Returns whether any sound is enabled
 */
export function isSoundEnabled(): boolean {
  return soundMode !== 'off';
}

/**
 * Changes sound mode ('off', 'spa', or 'carwash')
 */
export function setSoundMode(mode: SoundMode) {
  soundMode = mode;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('reef_sound_mode', mode);
      localStorage.setItem('reef_sound_enabled', mode !== 'off' ? 'true' : 'false');
    } catch {}
  }

  const ctx = getAudioContext();
  if (ctx && masterGain) {
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(mode !== 'off' ? 1.0 : 0.0, now + 0.12);
  }

  if (mode === 'off') {
    stopAmbientSoundscape();
    stopCarwashGroove();
  } else if (mode === 'spa') {
    stopCarwashGroove();
    startAmbientSoundscape();
  } else if (mode === 'carwash') {
    stopAmbientSoundscape();
    startCarwashGroove();
  }
}

/**
 * Legacy toggle compatibility
 */
export function setSoundEnabled(enabled: boolean) {
  setSoundMode(enabled ? 'spa' : 'off');
}

export function toggleSound(): boolean {
  setSoundMode(soundMode === 'off' ? 'spa' : 'off');
  return soundMode !== 'off';
}

/**
 * Initializes or unlocks the AudioContext on user interaction
 */
export function initAudioOnInteraction() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (soundMode === 'spa' && !isAmbientRunning) {
    startAmbientSoundscape();
  } else if (soundMode === 'carwash' && !isCarwashRunning) {
    startCarwashGroove();
  }
}

// Auto-attach interaction listeners to guarantee audio unlock in all modern browsers
if (typeof window !== 'undefined') {
  const unlockEvents = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'];
  const unlockHandler = () => {
    initAudioOnInteraction();
  };
  unlockEvents.forEach((evt) => {
    window.addEventListener(evt, unlockHandler, { passive: true });
  });
}

/* =========================================================================
 * AMBIENT REEF MUSIC & SOUNDSCAPE ENGINE
 * ========================================================================= */

/**
 * Starts the soothing ambient background music and reef elements (swell, bubbles, chimes)
 */
export function startAmbientSoundscape() {
  if (isAmbientRunning || soundMode !== 'spa') return;
  const ctx = getAudioContext();
  if (!ctx || !ambientGain) return;

  isAmbientRunning = true;

  // 1. Deep Oceanic Swell (Filtered underwater breath)
  startOceanSwell(ctx, ambientGain);

  // 2. Play first ambient musical pad chord immediately, then schedule next
  playNextAmbientChord(ctx, ambientGain);

  // 3. Start occasional rising bubbles schedule
  scheduleNextBubbleCluster(ctx, ambientGain);

  // 4. Start occasional gentle water chime schedule
  scheduleNextChime(ctx, ambientGain);
}

/**
 * Halts all ambient background sounds and timers
 */
export function stopAmbientSoundscape() {
  isAmbientRunning = false;

  if (ambientTimer) {
    clearTimeout(ambientTimer);
    ambientTimer = null;
  }
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
  if (chimeTimer) {
    clearTimeout(chimeTimer);
    chimeTimer = null;
  }
  if (oceanLfoTimer) {
    clearInterval(oceanLfoTimer);
    oceanLfoTimer = null;
  }

  if (oceanNoiseSource) {
    try {
      oceanNoiseSource.stop();
      oceanNoiseSource.disconnect();
    } catch {}
    oceanNoiseSource = null;
  }
}

/**
 * Generates an organic pink-noise buffer for deep underwater ocean swell
 */
function createOceanNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const bufferSize = sampleRate * 4;
  const buffer = ctx.createBuffer(2, bufferSize, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.76160 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035;
      b6 = white * 0.115926;
    }
  }
  return buffer;
}

function startOceanSwell(ctx: AudioContext, dest: GainNode) {
  try {
    const buffer = createOceanNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    // Deep underwater lowpass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(190, ctx.currentTime);
    filter.Q.value = 1.6;

    oceanGainNode = ctx.createGain();
    oceanGainNode.gain.setValueAtTime(0.04, ctx.currentTime);

    src.connect(filter);
    filter.connect(oceanGainNode);
    oceanGainNode.connect(dest);

    src.start();
    oceanNoiseSource = src;

    // Slow gentle ocean breath modulation (every 9s swell)
    let swellPhase = 0;
    oceanLfoTimer = setInterval(() => {
      if (!isAmbientRunning || !oceanGainNode || !audioCtx) return;
      swellPhase += 0.08;
      const targetGain = 0.035 + (Math.sin(swellPhase) * 0.5 + 0.5) * 0.045;
      const now = audioCtx.currentTime;
      oceanGainNode.gain.linearRampToValueAtTime(targetGain, now + 0.5);
    }, 500);
  } catch {}
}

/**
 * Plays a relaxing ambient pad chord with soft attack, long sustain, and gentle release
 */
function playNextAmbientChord(ctx: AudioContext, dest: GainNode) {
  if (!isAmbientRunning) return;

  const chord = AMBIENT_CHORDS[chordIndex % AMBIENT_CHORDS.length];
  chordIndex = (chordIndex + 1) % AMBIENT_CHORDS.length;

  const now = ctx.currentTime;
  const chordDuration = 9.0; // 9 seconds per chord, gentle overlap
  const attack = 3.0;
  const release = 3.5;

  // Dedicated filter for this pad chord to keep it warm and non-intrusive
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.setValueAtTime(650, now);
  padFilter.Q.value = 1.0;
  padFilter.connect(dest);

  chord.forEach((freq) => {
    // Dual detuned sine oscillators for warm oceanic chorus
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(freq * 0.998, now);
    osc2.frequency.setValueAtTime(freq * 1.002, now);

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(0.028, now + attack);
    voiceGain.gain.setValueAtTime(0.028, now + chordDuration - release);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + chordDuration);

    osc1.connect(voiceGain);
    osc2.connect(voiceGain);
    voiceGain.connect(padFilter);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + chordDuration + 0.1);
    osc2.stop(now + chordDuration + 0.1);
  });

  // Schedule the next chord with an overlap for seamless meditative transitions
  ambientTimer = setTimeout(() => {
    playNextAmbientChord(ctx, dest);
  }, (chordDuration - 2.5) * 1000);
}

/**
 * Occasional gentle high chime (sunlight through the water)
 */
function scheduleNextChime(ctx: AudioContext, dest: GainNode) {
  if (!isAmbientRunning) return;

  const delayMs = 6000 + Math.random() * 7000; // Every 6 to 13 seconds
  chimeTimer = setTimeout(() => {
    if (!isAmbientRunning) return;
    playSingleChime(ctx, dest);
    scheduleNextChime(ctx, dest);
  }, delayMs);
}

function playSingleChime(ctx: AudioContext, dest: GainNode) {
  const now = ctx.currentTime;
  const freq = CHIME_FREQS[Math.floor(Math.random() * CHIME_FREQS.length)];

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.038, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, now);

  osc.connect(gain);
  gain.connect(filter);
  filter.connect(dest);

  osc.start(now);
  osc.stop(now + 2.3);
}

/**
 * Subtle occasional rising bubbles moving to the surface
 * Generates a soft, realistic cluster of 2 to 4 ascending water bubbles
 */
function scheduleNextBubbleCluster(ctx: AudioContext, dest: GainNode) {
  if (!isAmbientRunning) return;

  // Occasional: Every 7 to 15 seconds
  const delayMs = 7000 + Math.random() * 8000;
  bubbleTimer = setTimeout(() => {
    if (!isAmbientRunning) return;
    playBubbleCluster(ctx, dest);
    scheduleNextBubbleCluster(ctx, dest);
  }, delayMs);
}

function playBubbleCluster(ctx: AudioContext, dest: GainNode) {
  // 2 to 4 bubbles per cluster
  const bubbleCount = 2 + Math.floor(Math.random() * 3);
  let currentDelay = 0;

  for (let i = 0; i < bubbleCount; i++) {
    setTimeout(() => {
      if (!isAmbientRunning || !audioCtx) return;
      playSingleBubble(audioCtx, dest);
    }, currentDelay);
    currentDelay += 140 + Math.random() * 180;
  }
}

/**
 * Synthesizes a single delicate water bubble popping/rising toward the surface
 */
function playSingleBubble(ctx: AudioContext, dest: GainNode) {
  const now = ctx.currentTime;
  const baseFreq = 360 + Math.random() * 220; // 360 - 580 Hz
  const endFreq = baseFreq * (1.7 + Math.random() * 0.8); // Rising pitch chirp
  const duration = 0.055 + Math.random() * 0.025; // 55 - 80 ms

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration * 0.7);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.065, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(baseFreq * 1.5, now);
  filter.Q.value = 2.5;

  osc.connect(gain);
  gain.connect(filter);
  filter.connect(dest);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/* =========================================================================
 * CARWASH GROOVE MUSIC ENGINE (UPBEAT, FUNKY 70s REEF-WASH SOUNDTRACK)
 * ========================================================================= */

// 115 BPM: 16th note step = ~130.4ms
const CARWASH_BPM = 115;
const CARWASH_STEP_DUR = 60 / CARWASH_BPM / 4;

interface BassNote {
  freq: number;
  dur: number;
  accent?: boolean;
}

// 64-step (4 bars) infectious funk slap-bass groove in D-minor / Dorian
// D1=36.71, D2=73.42, E2=82.41, F2=87.31, G2=98.00, G#2=103.83, A2=110.00, C3=130.81, D3=146.83
const CARWASH_BASS_PATTERN: Record<number, BassNote> = {
  // Bar 1: Punchy root D2, slap syncopation, chromatic walk to A2, octave drop and pop
  0: { freq: 73.42, dur: 0.18, accent: true },
  2: { freq: 73.42, dur: 0.10 },
  3: { freq: 87.31, dur: 0.11 }, // F2
  4: { freq: 73.42, dur: 0.15 }, // D2
  6: { freq: 98.00, dur: 0.12 }, // G2
  8: { freq: 103.83, dur: 0.10 }, // G#2 chromatic blues slide
  9: { freq: 110.00, dur: 0.18, accent: true }, // A2
  12: { freq: 73.42, dur: 0.14 }, // D2
  14: { freq: 130.81, dur: 0.13 }, // C3 pop

  // Bar 2: Slap octave leap, chromatic funk turnaround
  16: { freq: 73.42, dur: 0.18, accent: true },
  18: { freq: 146.83, dur: 0.12, accent: true }, // D3 slap octave!
  20: { freq: 130.81, dur: 0.13 }, // C3
  22: { freq: 110.00, dur: 0.14 }, // A2
  24: { freq: 98.00, dur: 0.18, accent: true }, // G2
  26: { freq: 87.31, dur: 0.13 }, // F2
  28: { freq: 73.42, dur: 0.15 }, // D2
  30: { freq: 65.41, dur: 0.13 }, // C2 slide

  // Bar 3: Driving groove with D3 pop hook
  32: { freq: 73.42, dur: 0.18, accent: true },
  34: { freq: 73.42, dur: 0.10 },
  35: { freq: 87.31, dur: 0.11 },
  36: { freq: 98.00, dur: 0.13 },
  38: { freq: 110.00, dur: 0.18, accent: true },
  40: { freq: 130.81, dur: 0.12 },
  42: { freq: 146.83, dur: 0.13, accent: true }, // D3
  44: { freq: 130.81, dur: 0.12 },
  46: { freq: 110.00, dur: 0.13 },

  // Bar 4: Funky breakdown & fill turnaround
  48: { freq: 98.00, dur: 0.14, accent: true }, // G2
  50: { freq: 87.31, dur: 0.12 }, // F2
  52: { freq: 98.00, dur: 0.13 }, // G2
  54: { freq: 103.83, dur: 0.10 }, // G#2
  55: { freq: 110.00, dur: 0.16, accent: true }, // A2
  58: { freq: 130.81, dur: 0.11 }, // C3
  60: { freq: 146.83, dur: 0.14, accent: true }, // D3
  62: { freq: 110.00, dur: 0.12 }, // A2
};

// Clavinet/Guitar funk rhythm chords: Dm9 [174.61, 220, 261.63, 329.63] and G9 [174.61, 246.94, 293.66, 329.63]
const CARWASH_CHORD_DM9 = [174.61, 220.0, 261.63, 329.63];
const CARWASH_CHORD_G9 = [174.61, 246.94, 293.66, 329.63];
const CARWASH_CHORD_PATTERN: Record<number, number[]> = {
  4: CARWASH_CHORD_DM9,
  7: CARWASH_CHORD_DM9,
  10: CARWASH_CHORD_DM9,
  13: CARWASH_CHORD_G9,
  14: CARWASH_CHORD_G9,
  20: CARWASH_CHORD_DM9,
  23: CARWASH_CHORD_DM9,
  26: CARWASH_CHORD_G9,
  30: CARWASH_CHORD_G9,
  36: CARWASH_CHORD_DM9,
  39: CARWASH_CHORD_DM9,
  42: CARWASH_CHORD_DM9,
  45: CARWASH_CHORD_G9,
  46: CARWASH_CHORD_G9,
  52: CARWASH_CHORD_DM9,
  54: CARWASH_CHORD_DM9,
  58: CARWASH_CHORD_G9,
  60: CARWASH_CHORD_DM9,
};

// Funky brass horn hook in Bars 3 & 4
const CARWASH_HORN_PATTERN: Record<number, { freq: number; dur: number }> = {
  36: { freq: 440.0, dur: 0.2 }, // A4
  38: { freq: 523.25, dur: 0.2 }, // C5
  40: { freq: 587.33, dur: 0.38 }, // D5 (punchy hook!)
  44: { freq: 523.25, dur: 0.18 }, // C5
  46: { freq: 440.0, dur: 0.18 }, // A4
  48: { freq: 392.0, dur: 0.2 }, // G4
  50: { freq: 349.23, dur: 0.2 }, // F4
  52: { freq: 293.66, dur: 0.32 }, // D4
  56: { freq: 349.23, dur: 0.18 }, // F4
  58: { freq: 392.0, dur: 0.18 }, // G4
  60: { freq: 440.0, dur: 0.34 }, // A4
};

export function startCarwashGroove() {
  if (isCarwashRunning || soundMode !== 'carwash') return;
  const ctx = getAudioContext();
  if (!ctx || !carwashGain) return;

  isCarwashRunning = true;
  carwashStepIndex = 0;
  carwashNextStepTime = ctx.currentTime + 0.05;

  runCarwashScheduler();
  carwashSchedulerTimer = setInterval(() => {
    runCarwashScheduler();
  }, 35);
}

export function stopCarwashGroove() {
  isCarwashRunning = false;
  if (carwashSchedulerTimer) {
    clearInterval(carwashSchedulerTimer);
    carwashSchedulerTimer = null;
  }
}

function runCarwashScheduler() {
  if (!isCarwashRunning || soundMode !== 'carwash') return;
  const ctx = getAudioContext();
  if (!ctx || !carwashGain) return;

  const lookAhead = 0.15;
  while (carwashNextStepTime < ctx.currentTime + lookAhead) {
    scheduleCarwashStep(ctx, carwashGain, carwashStepIndex, carwashNextStepTime);
    carwashStepIndex = (carwashStepIndex + 1) % 64;
    carwashNextStepTime += CARWASH_STEP_DUR;
  }
}

function scheduleCarwashStep(ctx: AudioContext, dest: GainNode, step: number, time: number) {
  // 1. Kick drum: 4-on-the-floor with funk offbeat hits
  const isKick =
    step === 0 ||
    step === 6 ||
    step === 8 ||
    step === 10 ||
    step === 16 ||
    step === 22 ||
    step === 24 ||
    step === 32 ||
    step === 38 ||
    step === 40 ||
    step === 48 ||
    step === 54 ||
    step === 56;
  if (isKick) {
    playCarwashKick(ctx, dest, time);
  }

  // 2. Snare / Clap on beats 2 and 4
  const isSnare =
    step === 4 ||
    step === 12 ||
    step === 20 ||
    step === 28 ||
    step === 36 ||
    step === 44 ||
    step === 52 ||
    step === 60;
  if (isSnare) {
    playCarwashSnare(ctx, dest, time);
  }

  // 3. Hi-hat: Driving 16th notes with open sizzle on the "&" of beats
  const isOpenHat = step % 4 === 2;
  playCarwashHat(ctx, dest, time, isOpenHat);

  // 4. Bassline: Slap and envelope-filtered auto-wah funk bass
  const bass = CARWASH_BASS_PATTERN[step];
  if (bass) {
    playCarwashBass(ctx, dest, time, bass.freq, bass.dur, bass.accent);
  }

  // 5. Clavinet / Funk Guitar Chops
  const chord = CARWASH_CHORD_PATTERN[step];
  if (chord) {
    playCarwashChords(ctx, dest, time, chord);
  }

  // 6. Upbeat Horn / Synth Brass Hook (Bars 3 & 4)
  const horn = CARWASH_HORN_PATTERN[step];
  if (horn) {
    playCarwashHorn(ctx, dest, time, horn.freq, horn.dur);
  }

  // 7. Playful Carwash Water-Spray Jet / Bubble Swoosh on turnaround bars
  if (step === 28 || step === 60) {
    playCarwashWaterSpray(ctx, dest, time);
  }
}

function playCarwashKick(ctx: AudioContext, dest: GainNode, time: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(148, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.085);

  gain.gain.setValueAtTime(0.36, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.15);
}

function playCarwashSnare(ctx: AudioContext, dest: GainNode, time: number) {
  const dur = 0.12;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1250, time);
  filter.Q.value = 1.6;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  // Snappy triangle tone body
  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(185, time);
  tone.frequency.exponentialRampToValueAtTime(85, time + 0.06);
  const toneGain = ctx.createGain();
  toneGain.gain.setValueAtTime(0.14, time);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);

  tone.connect(toneGain);
  toneGain.connect(dest);

  noise.start(time);
  noise.stop(time + dur);
  tone.start(time);
  tone.stop(time + 0.075);
}

function playCarwashHat(ctx: AudioContext, dest: GainNode, time: number, open: boolean) {
  const dur = open ? 0.07 : 0.032;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(open ? 6800 : 8800, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(open ? 0.16 : 0.08, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(time);
  noise.stop(time + dur + 0.01);
}

function playCarwashBass(
  ctx: AudioContext,
  dest: GainNode,
  time: number,
  freq: number,
  dur: number,
  accent = false
) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc2.type = 'sawtooth';

  osc1.frequency.setValueAtTime(freq, time);
  osc2.frequency.setValueAtTime(freq * 1.002, time);

  // Auto-wah resonant filter sweep (that iconic 70s carwash bass punch!)
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = accent ? 4.0 : 3.0;

  const startCutoff = accent ? 1350 : 950;
  const endCutoff = 200;
  filter.frequency.setValueAtTime(startCutoff, time);
  filter.frequency.exponentialRampToValueAtTime(endCutoff, time + dur * 0.85);

  const gain1 = ctx.createGain();
  gain1.gain.value = 0.32;
  const gain2 = ctx.createGain();
  gain2.gain.value = 0.09; // subtle sawtooth rasp

  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0.0001, time);
  voiceGain.gain.linearRampToValueAtTime(accent ? 0.34 : 0.26, time + 0.008);
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc1.connect(gain1);
  osc2.connect(gain2);
  gain1.connect(filter);
  gain2.connect(filter);
  filter.connect(voiceGain);
  voiceGain.connect(dest);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + dur + 0.02);
  osc2.stop(time + dur + 0.02);
}

function playCarwashChords(ctx: AudioContext, dest: GainNode, time: number, freqs: number[]) {
  const dur = 0.09;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1400, time);
  filter.Q.value = 2.4;
  filter.connect(dest);

  freqs.forEach((f) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.04, time + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(filter);

    osc.start(time);
    osc.stop(time + dur + 0.02);
  });
}

function playCarwashHorn(
  ctx: AudioContext,
  dest: GainNode,
  time: number,
  freq: number,
  dur: number
) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';

  osc1.frequency.setValueAtTime(freq * 0.997, time);
  osc2.frequency.setValueAtTime(freq * 1.003, time);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(850, time);
  filter.frequency.linearRampToValueAtTime(2200, time + 0.035);
  filter.frequency.exponentialRampToValueAtTime(1100, time + dur);
  filter.Q.value = 1.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.075, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(filter);
  filter.connect(dest);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + dur + 0.02);
  osc2.stop(time + dur + 0.02);
}

function playCarwashWaterSpray(ctx: AudioContext, dest: GainNode, time: number) {
  const dur = 0.26;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1800, time);
  filter.frequency.exponentialRampToValueAtTime(4500, time + dur * 0.5);
  filter.frequency.exponentialRampToValueAtTime(1400, time + dur);
  filter.Q.value = 3.2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.065, time + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  src.start(time);
  src.stop(time + dur + 0.02);
}

/* =========================================================================
 * SOUND EFFECTS (SFX)
 * ========================================================================= */

/**
 * Plays a soft, soothing aquatic droplet / bubble chime when a parasite is nibbled.
 * Features a gentle attack, warm lowpass filtering, and warm harmonic bell-like ring.
 */
export function playNibbleSound() {
  if (soundMode === 'off') return;
  const ctx = getAudioContext();
  if (!ctx || !sfxGain) return;

  if (ctx.state === 'suspended') {
    ctx.resume().then(() => playNibbleSoundDirect(ctx)).catch(() => {});
    return;
  }

  playNibbleSoundDirect(ctx);
}

function playNibbleSoundDirect(ctx: AudioContext) {
  if (soundMode === 'off' || !sfxGain) return;
  const now = ctx.currentTime;
  // Rate-limit consecutive pops slightly to prevent cacophony (min 35ms apart)
  if (now - lastSoundTime < 0.035) {
    return;
  }
  lastSoundTime = now;

  // Cycle through soothing pentatonic notes with slight organic detuning
  const baseFreq = PENTATONIC_FREQS[noteIndex % PENTATONIC_FREQS.length];
  noteIndex = (noteIndex + 1) % PENTATONIC_FREQS.length;
  const detune = (Math.random() - 0.5) * 12;
  const targetFreq = baseFreq + detune;

  // Master gain for this voice - comfortable volume (0.22 peak), soft decay
  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0.0001, now);
  voiceGain.gain.linearRampToValueAtTime(0.22, now + 0.008); // 8ms soft attack
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16); // 160ms soothing decay

  // Warm underwater lowpass filter to create an organic water-chime feel
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, now);
  filter.frequency.exponentialRampToValueAtTime(1200, now + 0.16);
  filter.Q.value = 1.4;

  // Primary sine oscillator (droplet / bubble frequency sweep)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(targetFreq * 0.85, now);
  osc1.frequency.exponentialRampToValueAtTime(targetFreq * 1.18, now + 0.025);
  osc1.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.16);

  // Subtle second harmonic for glass-like water resonance
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(targetFreq * 2.01, now);
  const osc2Gain = ctx.createGain();
  osc2Gain.gain.setValueAtTime(0.05, now);
  osc2Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

  // Connect graph to SFX bus
  osc1.connect(voiceGain);
  osc2.connect(osc2Gain);
  osc2Gain.connect(voiceGain);
  voiceGain.connect(filter);
  filter.connect(sfxGain);

  // Trigger sound
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.18);
  osc2.stop(now + 0.18);
}

/**
 * Plays a short, subtle celebratory aquatic chime when a client fish has been fully cleaned.
 * Features an ascending, warm water-bell chord (G5 -> C6 -> E6 -> G6) with gentle decay and sparkle.
 */
export function playFishCleanedCelebrationSound() {
  if (soundMode === 'off') return;
  const ctx = getAudioContext();
  if (!ctx || !sfxGain) return;

  if (ctx.state === 'suspended') {
    ctx.resume().then(() => playFishCleanedCelebrationDirect(ctx)).catch(() => {});
    return;
  }

  playFishCleanedCelebrationDirect(ctx);
}

function playFishCleanedCelebrationDirect(ctx: AudioContext) {
  if (soundMode === 'off' || !sfxGain) return;
  const now = ctx.currentTime;

  // Gentle 4-note ascending aquatic celebration chord (G5 - C6 - E6 - G6)
  const notes = [
    { freq: 783.99, time: 0.0, dur: 0.38, gain: 0.14 },
    { freq: 1046.5, time: 0.09, dur: 0.42, gain: 0.16 },
    { freq: 1318.51, time: 0.18, dur: 0.46, gain: 0.18 },
    { freq: 1567.98, time: 0.27, dur: 0.52, gain: 0.15 },
  ];

  // Master warm lowpass filter to maintain the organic underwater character
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3800, now);
  filter.frequency.exponentialRampToValueAtTime(1800, now + 0.8);
  filter.Q.value = 1.0;
  filter.connect(sfxGain);

  notes.forEach(({ freq, time, dur, gain }) => {
    const noteStart = now + time;

    // Primary bell sine wave
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq * 0.96, noteStart);
    osc1.frequency.exponentialRampToValueAtTime(freq, noteStart + 0.025);

    // Delicate upper sparkle overtone
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.004, noteStart);

    // Individual note envelope: 12ms soft attack, soothing decay
    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0.0001, noteStart);
    noteGain.gain.linearRampToValueAtTime(gain, noteStart + 0.012);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + dur);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.0001, noteStart);
    overtoneGain.gain.linearRampToValueAtTime(gain * 0.22, noteStart + 0.01);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + dur * 0.65);

    osc1.connect(noteGain);
    osc2.connect(overtoneGain);
    overtoneGain.connect(noteGain);
    noteGain.connect(filter);

    osc1.start(noteStart);
    osc2.start(noteStart);
    osc1.stop(noteStart + dur);
    osc2.stop(noteStart + dur);
  });
}

