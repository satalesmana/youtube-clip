import { runCommand } from './exec.js';
import type { Logger } from './logger.js';
import type { HighlightClip } from '../types/highlight.js';

export interface DetectAudioSpikesOptions {
  binaryPath?: string;
  audioPath: string;
  totalDurationSeconds?: number;
  minClipSeconds?: number;
  maxClipSeconds?: number;
  topN?: number;
  minGapSeconds?: number;
  genre?: string;
  logger?: Logger;
}

interface AudioSample {
  time: number;
  loudness: number;
}

/**
 * Scans an audio file using FFmpeg's ebur128 loudness filter to detect
 * intense volume spikes (such as crowd roar / commentator screams during goals).
 * Used as a zero-transcript fallback for sports match highlights and high-energy content.
 */
export async function detectAudioSpikes(options: DetectAudioSpikesOptions): Promise<HighlightClip[]> {
  const {
    binaryPath = 'ffmpeg',
    audioPath,
    totalDurationSeconds,
    minClipSeconds = 15,
    maxClipSeconds = 60,
    topN = 5,
    minGapSeconds = 40,
    genre = 'match-highlight',
    logger,
  } = options;

  logger?.info({ audioPath, genre }, 'Analyzing audio loudness profile for energy spikes');

  const samples: AudioSample[] = [];

  try {
    const { stderr, stdout } = await runCommand(
      binaryPath,
      [
        '-nostats',
        '-i',
        audioPath,
        '-filter_complex',
        'ebur128=metadata=1',
        '-f',
        'null',
        '-',
      ],
      { logger },
    );

    const output = `${stdout}\n${stderr}`;
    // Match ebur128 output format: t: 15.2   M: -18.4
    const regex = /t:\s*([\d.]+)\s+M:\s*([-\d.]+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(output)) !== null) {
      const time = parseFloat(match[1]);
      const loudness = parseFloat(match[2]);
      if (Number.isFinite(time) && Number.isFinite(loudness) && loudness > -65) {
        samples.push({ time, loudness });
      }
    }
  } catch (err) {
    logger?.warn({ err, audioPath }, 'FFmpeg ebur128 loudness analysis failed; using uniform fallback');
  }

  const duration = totalDurationSeconds && totalDurationSeconds > 0
    ? totalDurationSeconds
    : (samples.at(-1)?.time ?? 120);

  // If we collected samples, detect peaks based on volume spikes
  if (samples.length >= 10) {
    const sortedLoudness = [...samples].map((s) => s.loudness).sort((a, b) => a - b);
    const medianLoudness = sortedLoudness[Math.floor(sortedLoudness.length / 2)] ?? -28;

    // Find local peaks: point louder than neighbors within +/- 3.5 seconds
    const candidatePeaks: { time: number; loudness: number; spike: number }[] = [];

    for (let i = 0; i < samples.length; i++) {
      const curr = samples[i];
      const windowStart = curr.time - 3.5;
      const windowEnd = curr.time + 3.5;

      let isLocalMax = true;
      for (let j = Math.max(0, i - 35); j < Math.min(samples.length, i + 35); j++) {
        const neighbor = samples[j];
        if (neighbor.time >= windowStart && neighbor.time <= windowEnd) {
          if (neighbor.loudness > curr.loudness) {
            isLocalMax = false;
            break;
          }
        }
      }

      const spike = curr.loudness - medianLoudness;
      // Candidate must be a local peak and noticeably louder than median
      if (isLocalMax && spike >= 2.5) {
        candidatePeaks.push({ time: curr.time, loudness: curr.loudness, spike });
      }
    }

    // Sort candidate peaks by loudness descending
    candidatePeaks.sort((a, b) => b.loudness - a.loudness);

    // Pick top non-overlapping peaks
    const selectedPeaks: { time: number; loudness: number; spike: number }[] = [];
    for (const peak of candidatePeaks) {
      const tooClose = selectedPeaks.some((p) => Math.abs(p.time - peak.time) < minGapSeconds);
      if (!tooClose) {
        selectedPeaks.push(peak);
        if (selectedPeaks.length >= topN) break;
      }
    }

    // Sort chronologically for natural viewing order
    selectedPeaks.sort((a, b) => a.time - b.time);

    if (selectedPeaks.length > 0) {
      logger?.info({ peakCount: selectedPeaks.length }, 'Detected audio energy peaks for highlight clips');

      return selectedPeaks.map((peak, idx) => {
        // Goal action: lead-up (-15s) + action/celebration (+20s) = ~35s
        const rawStart = Math.max(0, peak.time - 15);
        const rawEnd = Math.min(duration, peak.time + 20);
        let start = Math.round(rawStart);
        let end = Math.round(rawEnd);

        if (end - start < minClipSeconds) {
          end = Math.min(duration, start + minClipSeconds);
        }
        if (end - start > maxClipSeconds) {
          end = start + maxClipSeconds;
        }

        const mm = Math.floor(peak.time / 60);
        const ss = Math.floor(peak.time % 60).toString().padStart(2, '0');
        const timeStr = `${mm}:${ss}`;

        const isSports = genre === 'match-highlight' || genre === 'sports';
        const title = isSports
          ? `⚽ Gol / Momen Krusial (${timeStr})`
          : `🔥 Puncak Keseruan (${timeStr})`;
        const reason = isSports
          ? `Lonjakan sorakan penonton stadion tertinggi terdeteksi di menit ${timeStr} (+${peak.spike.toFixed(1)} dB).`
          : `Lonjakan intensitas suara paling signifikan terdeteksi di menit ${timeStr}.`;
        const hook = isSports
          ? `Detik-detik gol mendebarkan di menit ${timeStr}!`
          : `Momen paling intens di menit ${timeStr}!`;

        const score = Math.min(98, Math.max(80, Math.round(85 + (peak.spike * 1.5) - idx)));

        return {
          start,
          end,
          score,
          title,
          reason,
          hook,
          peak: Number(peak.time.toFixed(2)),
        };
      });
    }
  }

  // Fallback: Uniform smart grid if no peaks were detected or audio had no dynamics
  logger?.info({ duration }, 'Generating uniform time-grid candidate clips as fallback');
  const clipCount = Math.min(topN, Math.max(2, Math.floor(duration / 60)));
  const step = duration / (clipCount + 1);
  const clips: HighlightClip[] = [];

  for (let i = 1; i <= clipCount; i++) {
    const center = i * step;
    const clipDur = Math.min(maxClipSeconds, Math.max(minClipSeconds, 30));
    const start = Math.max(0, Math.round(center - clipDur / 2));
    const end = Math.min(duration, start + clipDur);

    const mm = Math.floor(center / 60);
    const ss = Math.floor(center % 60).toString().padStart(2, '0');
    const timeStr = `${mm}:${ss}`;

    clips.push({
      start,
      end,
      score: 85 - i * 2,
      title: `🎬 Cuplikan Pertandingan #${i} (${timeStr})`,
      reason: `Klip cuplikan terpilih dari segmen menit ${timeStr}.`,
      hook: `Tonton cuplikan di menit ${timeStr}!`,
      peak: Number(center.toFixed(2)),
    });
  }

  return clips;
}
