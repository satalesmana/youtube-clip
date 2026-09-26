// scripts/generate-all-tracks.cjs
const { note, renderTrackToMp3, SAMPLE_RATE } = require('./audio-synth-utils.cjs');

// --- Synthesis Helpers ---
function oscSine(freq, phase) {
  return Math.sin(2 * Math.PI * freq * phase);
}

function oscTriangle(freq, phase) {
  const p = (freq * phase) % 1;
  return 4 * Math.abs(p - 0.5) - 1;
}

function oscSaw(freq, phase) {
  const p = (freq * phase) % 1;
  return 2 * p - 1;
}

function noise() {
  return Math.random() * 2 - 1;
}

// Low-pass filtered noise for vinyl / tape ambience
let noiseState = 0;
function filteredNoise(cutoff = 0.05) {
  noiseState += cutoff * (noise() - noiseState);
  return noiseState;
}

// Exponential decay envelope
function expDecay(timeInNote, decayRate = 3) {
  return Math.exp(-decayRate * Math.max(0, timeInNote));
}

// Rhodes / E-Piano voice
function epianoVoice(freq, timeInNote) {
  if (timeInNote < 0) return 0;
  const env = Math.exp(-2.5 * timeInNote);
  const fundamental = oscSine(freq, timeInNote);
  const second = oscSine(freq * 2, timeInNote) * 0.35 * Math.exp(-4 * timeInNote);
  const third = oscSine(freq * 3, timeInNote) * 0.15 * Math.exp(-6 * timeInNote);
  const bell = oscSine(freq * 6.5, timeInNote) * 0.25 * Math.exp(-14 * timeInNote);
  const tremolo = 1 + 0.15 * Math.sin(2 * Math.PI * 4 * timeInNote);
  return (fundamental + second + third + bell) * env * tremolo;
}

// Synth Pluck Voice
function pluckVoice(freq, timeInNote) {
  if (timeInNote < 0) return 0;
  const env = Math.exp(-5 * timeInNote);
  const s1 = oscSaw(freq, timeInNote) * 0.5;
  const s2 = oscSaw(freq * 1.003, timeInNote) * 0.5;
  return (s1 + s2) * env;
}

// 808 Cowbell (Phonk iconic sound)
function phonkCowbell(freq, timeInNote) {
  if (timeInNote < 0) return 0;
  const env = Math.exp(-7 * timeInNote);
  const tone1 = oscTriangle(freq, timeInNote);
  const tone2 = oscTriangle(freq * 1.48, timeInNote) * 0.7;
  return (tone1 + tone2) * env;
}

// Kick drum synthesis
function kickDrum(timeInNote, is808 = false) {
  if (timeInNote < 0 || timeInNote > 0.6) return 0;
  const pitchDecay = is808 ? 18 : 35;
  const pitch = 45 + 130 * Math.exp(-pitchDecay * timeInNote);
  const ampDecay = is808 ? 3.5 : 8.0;
  const env = Math.exp(-ampDecay * timeInNote);
  const click = timeInNote < 0.008 ? noise() * (1 - timeInNote / 0.008) * 0.4 : 0;
  return oscSine(pitch, timeInNote) * env * 1.2 + click;
}

// Snare / Rimshot synthesis
function snareDrum(timeInNote, isRim = false) {
  if (timeInNote < 0 || timeInNote > 0.4) return 0;
  const bodyFreq = isRim ? 320 : 190;
  const bodyEnv = Math.exp(-18 * timeInNote);
  const tone = oscSine(bodyFreq, timeInNote) * bodyEnv * 0.5;
  const noiseEnv = Math.exp(isRim ? -22 * timeInNote : -12 * timeInNote);
  const snap = noise() * noiseEnv * (isRim ? 0.4 : 0.7);
  return tone + snap;
}

// Hi-Hat synthesis
function hiHat(timeInNote, isOpen = false) {
  const dur = isOpen ? 0.35 : 0.08;
  if (timeInNote < 0 || timeInNote > dur) return 0;
  const decay = isOpen ? 7 : 45;
  const env = Math.exp(-decay * timeInNote);
  const tone = (noise() * 0.8 + oscSine(8200, timeInNote) * 0.2) * env;
  return tone * 0.35;
}

// =============================================================================
// TRACK GENERATORS
// =============================================================================

// 1. LOFI CHILL 01: Café Memories (85 BPM)
function makeLofiChill01() {
  const bpm = 85;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  // Dm9, G13, Cmaj9, Am7
  const chords = [
    [note('D', 3), note('F', 3), note('A', 3), note('C', 4), note('E', 4)],
    [note('G', 2), note('F', 3), note('B', 3), note('E', 4), note('A', 4)],
    [note('C', 3), note('E', 3), note('G', 3), note('B', 3), note('D', 4)],
    [note('A', 2), note('G', 3), note('C', 4), note('E', 4), note('G', 4)],
  ];
  const bassNotes = [note('D', 2), note('G', 1), note('C', 2), note('A', 1)];

  return function (t) {
    const loopTime = t % (barSec * 4);
    const barIdx = Math.floor(loopTime / barSec) % 4;
    const timeInBar = loopTime % barSec;
    const beatInBar = timeInBar / beatSec;

    // Background vinyl warmth
    const vinyl = filteredNoise(0.03) * 0.035;

    // Chords
    const chordTime = timeInBar;
    let chordAudioL = 0;
    let chordAudioR = 0;
    const chord = chords[barIdx];
    for (let i = 0; i < chord.length; i++) {
      const pan = (i / (chord.length - 1)) * 0.6 - 0.3; // Stereo spread
      const voice = epianoVoice(chord[i], chordTime) * 0.18;
      chordAudioL += voice * (0.7 - pan);
      chordAudioR += voice * (0.7 + pan);
    }

    // Sub-bass
    const bassFreq = bassNotes[barIdx];
    const bass = oscSine(bassFreq, timeInBar) * Math.exp(-0.8 * timeInBar) * 0.28;

    // Drums: Kick on beat 0 and 2.5, Snare on beat 1 and 3, Hats every 0.5 beats with swing
    let drumL = 0;
    let drumR = 0;

    // Kicks
    const k1Time = timeInBar;
    const k2Time = timeInBar - beatSec * 2.5;
    if (k1Time >= 0 && k1Time < 0.5) {
      const k = kickDrum(k1Time) * 0.55;
      drumL += k;
      drumR += k;
    }
    if (k2Time >= 0 && k2Time < 0.5) {
      const k = kickDrum(k2Time) * 0.45;
      drumL += k;
      drumR += k;
    }

    // Snare
    const s1Time = timeInBar - beatSec * 1.0;
    const s2Time = timeInBar - beatSec * 3.0;
    if (s1Time >= 0 && s1Time < 0.4) {
      const s = snareDrum(s1Time, true) * 0.45;
      drumL += s;
      drumR += s;
    }
    if (s2Time >= 0 && s2Time < 0.4) {
      const s = snareDrum(s2Time, true) * 0.45;
      drumL += s;
      drumR += s;
    }

    // Hi-hats with swing
    for (let h = 0; h < 8; h++) {
      const swingOffset = h % 2 === 1 ? 0.04 : 0;
      const hTime = timeInBar - (h * 0.5 * beatSec + swingOffset);
      if (hTime >= 0 && hTime < 0.1) {
        const hat = hiHat(hTime) * (h % 2 === 0 ? 0.3 : 0.2);
        drumL += hat * 0.8;
        drumR += hat * 1.1;
      }
    }

    return [chordAudioL + bass + drumL + vinyl, chordAudioR + bass + drumR + vinyl];
  };
}

// 2. LOFI CHILL 02: Rainy Afternoon (78 BPM)
function makeLofiChill02() {
  const bpm = 78;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  // Fmaj7 -> Em7 -> Dm9 -> Cmaj7
  const chords = [
    [note('F', 3), note('A', 3), note('C', 4), note('E', 4)],
    [note('E', 3), note('G', 3), note('B', 3), note('D', 4)],
    [note('D', 3), note('F', 3), note('A', 3), note('C', 4), note('E', 4)],
    [note('C', 3), note('E', 3), note('G', 3), note('B', 3)],
  ];
  const bassNotes = [note('F', 2), note('E', 2), note('D', 2), note('C', 2)];

  return function (t) {
    const loopTime = t % (barSec * 4);
    const barIdx = Math.floor(loopTime / barSec) % 4;
    const timeInBar = loopTime % barSec;

    // Rainy texture
    const rain = (filteredNoise(0.04) * 0.03) + (filteredNoise(0.08) * 0.015);

    // Mellow Keys
    let chordL = 0;
    let chordR = 0;
    chords[barIdx].forEach((freq, idx) => {
      const v = epianoVoice(freq, timeInBar) * 0.16;
      chordL += v * (0.8 - idx * 0.1);
      chordR += v * (0.6 + idx * 0.1);
    });

    // Warm bass
    const bass = oscSine(bassNotes[barIdx], timeInBar) * Math.exp(-0.6 * timeInBar) * 0.26;

    // Gentle Drums
    let drumL = 0;
    let drumR = 0;
    const kTime = timeInBar;
    if (kTime >= 0 && kTime < 0.4) {
      const k = kickDrum(kTime) * 0.45;
      drumL += k;
      drumR += k;
    }
    const sTime = timeInBar - beatSec * 2.0;
    if (sTime >= 0 && sTime < 0.3) {
      const s = snareDrum(sTime, true) * 0.35;
      drumL += s;
      drumR += s;
    }
    for (let h = 0; h < 4; h++) {
      const ht = timeInBar - h * beatSec;
      if (ht >= 0 && ht < 0.1) {
        const hh = hiHat(ht) * 0.22;
        drumL += hh * 0.7;
        drumR += hh * 1.0;
      }
    }

    return [chordL + bass + drumL + rain, chordR + bass + drumR + rain];
  };
}

// 3. LOFI CHILL 03: Late Night Drive (92 BPM)
function makeLofiChill03() {
  const bpm = 92;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  // Bbmaj7 -> Am7 -> Gm7 -> C9
  const chords = [
    [note('Bb', 3), note('D', 4), note('F', 4), note('A', 4)],
    [note('A', 3), note('C', 4), note('E', 4), note('G', 4)],
    [note('G', 3), note('Bb', 3), note('D', 4), note('F', 4)],
    [note('C', 3), note('E', 3), note('Bb', 3), note('D', 4)],
  ];
  const bassNotes = [note('Bb', 1), note('A', 1), note('G', 1), note('C', 2)];

  return function (t) {
    const loopTime = t % (barSec * 4);
    const barIdx = Math.floor(loopTime / barSec) % 4;
    const timeInBar = loopTime % barSec;

    let chordL = 0, chordR = 0;
    chords[barIdx].forEach((freq, idx) => {
      const v = epianoVoice(freq, timeInBar) * 0.17;
      chordL += v * (0.75 - idx * 0.08);
      chordR += v * (0.65 + idx * 0.08);
    });

    const bass = oscSine(bassNotes[barIdx], timeInBar) * Math.exp(-0.7 * timeInBar) * 0.3;

    let drum = 0;
    if (timeInBar < 0.35) drum += kickDrum(timeInBar) * 0.5;
    if (timeInBar >= beatSec * 1.5 && timeInBar < beatSec * 1.5 + 0.35) {
      drum += kickDrum(timeInBar - beatSec * 1.5) * 0.4;
    }
    const snTime = timeInBar - beatSec * 2.0;
    if (snTime >= 0 && snTime < 0.35) drum += snareDrum(snTime) * 0.45;

    return [chordL + bass + drum, chordR + bass + drum];
  };
}

// 4. PHONK HYPE 01: Dark Drift (140 BPM)
function makePhonkHype01() {
  const bpm = 140;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  // Phonk Cowbell melody in F minor: F, Ab, G, F, C, Eb, D, Db
  const cowbellMelody = [
    note('F', 5), note('Ab', 5), note('G', 5), note('F', 5),
    note('C', 5), note('Eb', 5), note('D', 5), note('Db', 5)
  ];

  return function (t) {
    const loopTime = t % (barSec * 2);
    const timeInBar = loopTime % barSec;

    // Fast 16th-note Phonk melody step
    const step16 = Math.floor((loopTime / (beatSec / 4)) % 16);
    const timeInStep = (loopTime % (beatSec / 4));

    // Cowbell riff (plays on specific 16th steps)
    let leadL = 0, leadR = 0;
    if ([0, 3, 6, 8, 10, 12, 14].includes(step16)) {
      const noteFreq = cowbellMelody[step16 % cowbellMelody.length];
      const cb = phonkCowbell(noteFreq, timeInStep) * 0.35;
      leadL += cb * 0.8;
      leadR += cb * 1.2;
    }

    // Heavy distorted 808 Bass
    const bassStep = Math.floor(loopTime / barSec);
    const bassRoot = bassStep === 0 ? note('F', 1) : note('Db', 1);
    const rawBass = oscSine(bassRoot, loopTime) * 0.6;
    const drivenBass = Math.tanh(rawBass * 2.5) * 0.35; // saturated 808

    // Drums
    let drum = 0;
    // Hard Kick on 0, 1.5, 2.5
    [0, 1.5, 2.5].forEach((b) => {
      const kt = timeInBar - b * beatSec;
      if (kt >= 0 && kt < 0.25) drum += kickDrum(kt, true) * 0.7;
    });

    // Hard Snare on 2 and 4
    [1.0, 3.0].forEach((b) => {
      const st = timeInBar - b * beatSec;
      if (st >= 0 && st < 0.2) drum += snareDrum(st) * 0.6;
    });

    // Rapid Hi-Hats every 16th note
    const hat = hiHat(timeInStep) * 0.25;

    return [leadL + drivenBass + drum + hat, leadR + drivenBass + drum + hat];
  };
}

// 5. PHONK HYPE 02: Sigma Motivation (138 BPM)
function makePhonkHype02() {
  const bpm = 138;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  const melodyNotes = [note('A', 4), note('C', 5), note('E', 5), note('D', 5)];

  return function (t) {
    const loopTime = t % (barSec * 2);
    const timeInBar = loopTime % barSec;
    const beatIdx = Math.floor(timeInBar / beatSec);
    const timeInBeat = timeInBar % beatSec;

    // Arp synth lead
    const step16 = Math.floor((timeInBar / (beatSec / 2)) % 4);
    const timeInStep = timeInBar % (beatSec / 2);
    const lead = pluckVoice(melodyNotes[step16], timeInStep) * 0.3;

    // Pumping bass
    const bassTone = oscSine(note('A', 1), loopTime) * 0.4;
    const bassSidechain = Math.min(1, timeInBeat * 3.5); // sidechained to kick
    const bass = bassTone * bassSidechain * 0.5;

    // Drums
    let kick = 0;
    if (timeInBeat < 0.25) kick = kickDrum(timeInBeat, true) * 0.65;
    let snare = 0;
    if (beatIdx === 1 || beatIdx === 3) {
      snare = snareDrum(timeInBeat) * 0.55;
    }

    const hat = hiHat(timeInBar % (beatSec / 4)) * 0.22;

    return [lead * 0.8 + bass + kick + snare + hat, lead * 1.1 + bass + kick + snare + hat];
  };
}

// 6. CINEMATIC 01: Mysterious Revelation (72 BPM)
function makeCinematic01() {
  const bpm = 72;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  // C minor atmospheric chords: Cm -> Ab -> Fm -> G
  const chordRoots = [note('C', 2), note('Ab', 1), note('F', 1), note('G', 1)];
  const arpNotes = [note('C', 4), note('Eb', 4), note('G', 4), note('C', 5), note('G', 4), note('Eb', 4)];

  return function (t) {
    const loopTime = t % (barSec * 4);
    const barIdx = Math.floor(loopTime / barSec) % 4;
    const timeInBar = loopTime % barSec;

    // Deep low sub drone
    const droneFreq = chordRoots[barIdx];
    const drone = (oscSine(droneFreq, timeInBar) + oscTriangle(droneFreq * 2, timeInBar) * 0.3) * 0.3;

    // Slow mysterious piano arpeggio
    const arpIdx = Math.floor((timeInBar / (barSec / 6)) % 6);
    const arpTime = timeInBar % (barSec / 6);
    const arpVoice = epianoVoice(arpNotes[arpIdx], arpTime) * 0.22;

    // Heartbeat suspense pulse on beat 0 and 0.75
    let pulse = 0;
    const p1 = timeInBar;
    const p2 = timeInBar - beatSec * 0.75;
    if (p1 >= 0 && p1 < 0.4) pulse += oscSine(55, p1) * Math.exp(-6 * p1) * 0.4;
    if (p2 >= 0 && p2 < 0.4) pulse += oscSine(50, p2) * Math.exp(-8 * p2) * 0.3;

    return [drone * 0.9 + arpVoice * 0.7 + pulse, drone * 1.1 + arpVoice * 1.1 + pulse];
  };
}

// 7. CINEMATIC 02: Epic Tension Build (80 BPM)
function makeCinematic02() {
  const bpm = 80;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  const bassNotes = [note('D', 2), note('F', 2), note('G', 2), note('A', 2)];

  return function (t) {
    const loopTime = t % (barSec * 4);
    const barIdx = Math.floor(loopTime / barSec) % 4;
    const timeInBar = loopTime % barSec;

    // Ostinato pulse
    const ostStep = Math.floor((timeInBar / (beatSec / 4)) % 16);
    const ostTime = timeInBar % (beatSec / 4);
    const ostFreq = bassNotes[barIdx] * 4;
    const ost = pluckVoice(ostFreq, ostTime) * 0.25;

    // Heavy cinematic tom
    let tom = 0;
    const tTime = timeInBar % beatSec;
    if (tTime < 0.3) {
      tom = oscSine(75, tTime) * Math.exp(-7 * tTime) * 0.45;
    }

    const sub = oscSine(bassNotes[barIdx], timeInBar) * 0.28;

    return [ost * 0.8 + tom + sub, ost * 1.2 + tom + sub];
  };
}

// 8. UPBEAT TECH 01: Innovation Drive (128 BPM)
function makeUpbeatTech01() {
  const bpm = 128;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  // C -> G -> Am -> F
  const chords = [
    [note('C', 4), note('E', 4), note('G', 4)],
    [note('G', 3), note('B', 3), note('D', 4)],
    [note('A', 3), note('C', 4), note('E', 4)],
    [note('F', 3), note('A', 3), note('C', 4)],
  ];
  const bassNotes = [note('C', 2), note('G', 1), note('A', 1), note('F', 1)];

  return function (t) {
    const loopTime = t % (barSec * 4);
    const barIdx = Math.floor(loopTime / barSec) % 4;
    const timeInBar = loopTime % barSec;
    const beatTime = timeInBar % beatSec;
    const beatIdx = Math.floor(timeInBar / beatSec);

    // 16th-note synth pluck rhythm
    const step16 = Math.floor((timeInBar / (beatSec / 4)) % 16);
    const stepTime = timeInBar % (beatSec / 4);
    let chordAudio = 0;
    const c = chords[barIdx];
    const n = c[step16 % c.length];
    chordAudio = pluckVoice(n, stepTime) * 0.25;

    // 4-on-the-floor Kick
    let kick = 0;
    if (beatTime < 0.25) kick = kickDrum(beatTime) * 0.6;

    // Clap/Snare on beat 1 and 3
    let clap = 0;
    if (beatIdx === 1 || beatIdx === 3) {
      clap = snareDrum(beatTime, true) * 0.5;
    }

    // Offbeat Open Hi-Hat
    let hat = 0;
    const offbeatTime = beatTime - beatSec * 0.5;
    if (offbeatTime >= 0 && offbeatTime < 0.2) {
      hat = hiHat(offbeatTime, true) * 0.35;
    }

    // Bassline
    const bass = oscSine(bassNotes[barIdx], timeInBar) * 0.3 * Math.min(1, beatTime * 4);

    return [chordAudio * 0.9 + kick + clap + hat + bass, chordAudio * 1.1 + kick + clap + hat + bass];
  };
}

// 9. UPBEAT TECH 02: Digital Future (124 BPM)
function makeUpbeatTech02() {
  const bpm = 124;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  const arp = [note('D', 4), note('F#', 4), note('A', 4), note('D', 5)];

  return function (t) {
    const loopTime = t % (barSec * 2);
    const timeInBar = loopTime % barSec;
    const beatTime = timeInBar % beatSec;

    // Fast digital arp
    const stepIdx = Math.floor((timeInBar / (beatSec / 4)) % 4);
    const stepTime = timeInBar % (beatSec / 4);
    const lead = pluckVoice(arp[stepIdx], stepTime) * 0.28;

    let kick = 0;
    if (beatTime < 0.25) kick = kickDrum(beatTime) * 0.58;

    const clap = (timeInBar > beatSec * 1.0 && timeInBar < beatSec * 1.25) ||
                 (timeInBar > beatSec * 3.0 && timeInBar < beatSec * 3.25)
                 ? snareDrum(beatTime, true) * 0.45 : 0;

    const bass = oscSine(note('D', 2), loopTime) * 0.28;

    return [lead * 0.8 + kick + clap + bass, lead * 1.2 + kick + clap + bass];
  };
}

// 10. AMBIENT 01: Morning Light (65 BPM)
function makeAmbient01() {
  const bpm = 65;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  // Emaj7 -> Aadd9
  const chords = [
    [note('E', 3), note('G#', 3), note('B', 3), note('D#', 4)],
    [note('A', 2), note('E', 3), note('G#', 3), note('B', 3)],
  ];

  return function (t) {
    const loopTime = t % (barSec * 2);
    const barIdx = Math.floor(loopTime / barSec) % 2;
    const timeInBar = loopTime % barSec;

    let padL = 0, padR = 0;
    chords[barIdx].forEach((freq, idx) => {
      const v = epianoVoice(freq, timeInBar) * 0.2;
      padL += v * (0.8 - idx * 0.1);
      padR += v * (0.6 + idx * 0.1);
    });

    // Calming breeze ambience
    const breeze = filteredNoise(0.015) * 0.025;

    // Soft warm sub
    const sub = oscSine(chords[barIdx][0] / 2, timeInBar) * 0.25;

    return [padL + breeze + sub, padR + breeze + sub];
  };
}

// 11. AMBIENT 02: Quiet Forest (60 BPM)
function makeAmbient02() {
  const bpm = 60;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  const harpNotes = [note('G', 3), note('B', 3), note('D', 4), note('F#', 4), note('G', 4)];

  return function (t) {
    const loopTime = t % (barSec * 2);
    const timeInBar = loopTime % barSec;

    const step = Math.floor((timeInBar / (barSec / 5)) % 5);
    const stepTime = timeInBar % (barSec / 5);
    const harp = epianoVoice(harpNotes[step], stepTime) * 0.25;

    // Soft forest wind
    const forest = filteredNoise(0.02) * 0.02;
    const sub = oscSine(note('G', 1), timeInBar) * 0.2;

    return [harp * 0.7 + forest + sub, harp * 1.2 + forest + sub];
  };
}

// =============================================================================
// RUN BATCH GENERATION
// =============================================================================

async function run() {
  const tracks = [
    { file: 'lofi-chill-01.mp3', dur: 60, gen: makeLofiChill01() },
    { file: 'lofi-chill-02.mp3', dur: 60, gen: makeLofiChill02() },
    { file: 'lofi-chill-03.mp3', dur: 60, gen: makeLofiChill03() },
    { file: 'phonk-hype-01.mp3', dur: 60, gen: makePhonkHype01() },
    { file: 'phonk-hype-02.mp3', dur: 60, gen: makePhonkHype02() },
    { file: 'cinematic-01.mp3', dur: 60, gen: makeCinematic01() },
    { file: 'cinematic-02.mp3', dur: 60, gen: makeCinematic02() },
    { file: 'upbeat-tech-01.mp3', dur: 60, gen: makeUpbeatTech01() },
    { file: 'upbeat-tech-02.mp3', dur: 60, gen: makeUpbeatTech02() },
    { file: 'ambient-01.mp3', dur: 60, gen: makeAmbient01() },
    { file: 'ambient-02.mp3', dur: 60, gen: makeAmbient02() },
  ];

  console.log(`Starting generation of ${tracks.length} royalty-free background tracks...`);
  for (const t of tracks) {
    await renderTrackToMp3(t.file, t.dur, t.gen);
  }
  console.log('✨ All 11 tracks generated successfully in client/public/audio!');
}

run().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
