// scripts/generate-audio-catalog.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const NOTE_OFFSETS = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
};

function note(name, octave = 4) {
  const match = name.match(/^([A-G][#b]?)(-?\d+)?$/);
  if (!match) return 440;
  const noteName = match[1];
  const oct = match[2] !== undefined ? parseInt(match[2], 10) : octave;
  const midi = 12 * (oct + 1) + (NOTE_OFFSETS[noteName] || 0);
  return midiToFreq(midi);
}

// Simple soft-knee limiter / clipper
function softClip(x) {
  return Math.tanh(x);
}

// Render audio generator to MP3 file via ffmpeg
function renderTrackToMp3(filename, durationSec, generatorFn) {
  return new Promise((resolve, reject) => {
    const totalSamples = Math.floor(SAMPLE_RATE * durationSec);
    const outputPath = path.resolve(__dirname, '../client/public/audio', filename);
    console.log(`Generating ${filename} (${durationSec}s)...`);

    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 's16le',
      '-ar', String(SAMPLE_RATE),
      '-ac', '2',
      '-i', 'pipe:0',
      '-c:a', 'libmp3lame',
      '-b:a', '192k',
      outputPath,
    ]);

    const chunkSize = 4096;
    let sampleIdx = 0;

    function writeChunk() {
      let canContinue = true;
      while (sampleIdx < totalSamples && canContinue) {
        const samplesToWrite = Math.min(chunkSize, totalSamples - sampleIdx);
        const buf = Buffer.alloc(samplesToWrite * 4);

        for (let j = 0; j < samplesToWrite; j++) {
          const currentSample = sampleIdx + j;
          const t = currentSample / SAMPLE_RATE;
          const [left, right] = generatorFn(t, currentSample, totalSamples);

          const clippedL = softClip(left);
          const clippedR = softClip(right);

          const intL = Math.max(-32768, Math.min(32767, Math.round(clippedL * 32000)));
          const intR = Math.max(-32768, Math.min(32767, Math.round(clippedR * 32000)));

          buf.writeInt16LE(intL, j * 4);
          buf.writeInt16LE(intR, j * 4 + 2);
        }

        sampleIdx += samplesToWrite;
        canContinue = ffmpeg.stdin.write(buf);
      }

      if (sampleIdx >= totalSamples) {
        ffmpeg.stdin.end();
      } else {
        ffmpeg.stdin.once('drain', writeChunk);
      }
    }

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Created: ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
    writeChunk();
  });
}

module.exports = { note, midiToFreq, renderTrackToMp3, softClip, SAMPLE_RATE };
