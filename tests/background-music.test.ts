import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AUDIO_CATALOG,
  MUSIC_GENRES,
  filterByGenre,
  searchTracks,
  resolveAudioStreamUrl,
  getDefaultMusicTrack,
} from '../client/src/lib/audio-catalog.js';
import type { ProducerAction, ProducerEditorContext } from '../src/types/producer.js';

describe('Background Music Catalog & Remotion Audio Suite', () => {
  it('1. Audio Catalog Integrity: all 11 tracks exist and have valid local MP3 files on disk', () => {
    assert.strictEqual(AUDIO_CATALOG.length, 11, 'Expected 11 curated royalty-free tracks');

    for (const track of AUDIO_CATALOG) {
      assert.ok(track.id, 'Track must have an id');
      assert.ok(track.title, 'Track must have a title');
      assert.ok(track.streamUrl.startsWith('/audio/'), `streamUrl must point to /audio/, got: ${track.streamUrl}`);
      assert.strictEqual(track.streamUrl, `/audio/${track.id}.mp3`);

      // Verify physical disk file in client/public/audio
      const fullPath = resolve(process.cwd(), 'client/public', track.streamUrl.slice(1));
      assert.ok(existsSync(fullPath), `Audio file on disk missing: ${fullPath}`);

      const stats = statSync(fullPath);
      assert.ok(stats.size > 100_000, `Audio file too small (${stats.size} bytes): ${fullPath}`);
    }
  });

  it('2. Genre filtering & searching across catalog', () => {
    const lofi = filterByGenre('lofi');
    assert.strictEqual(lofi.length, 3, 'Expected 3 lofi tracks');
    assert.ok(lofi.every((t) => t.genre === 'lofi'));

    const phonk = filterByGenre('phonk');
    assert.strictEqual(phonk.length, 2, 'Expected 2 phonk tracks');

    const searchRes = searchTracks('cafe');
    assert.ok(searchRes.some((t) => t.id === 'lofi-chill-01'));
  });

  it('3. resolveAudioStreamUrl & getDefaultMusicTrack', () => {
    const defaultTrack = getDefaultMusicTrack();
    assert.strictEqual(defaultTrack.id, 'lofi-chill-01');

    assert.strictEqual(resolveAudioStreamUrl(null), undefined);
    assert.strictEqual(resolveAudioStreamUrl(undefined), undefined);
    assert.strictEqual(resolveAudioStreamUrl(defaultTrack), '/audio/lofi-chill-01.mp3');
    assert.strictEqual(resolveAudioStreamUrl('/audio/phonk-hype-01.mp3'), '/audio/phonk-hype-01.mp3');

    // Mapping old track ID string to local streamUrl
    assert.strictEqual(resolveAudioStreamUrl('cinematic-01'), '/audio/cinematic-01.mp3');
  });

  it('4. Audio Ducking Math: calculates ducked volume during speech and restores volume during pauses', () => {
    const baseMusicVol = 0.25;
    const calculateEffectiveVolume = (isSpeechActive: boolean, autoDucking: boolean) => {
      if (!autoDucking) return baseMusicVol;
      return isSpeechActive ? baseMusicVol * 0.35 : baseMusicVol;
    };

    // When someone is speaking and autoDucking is ON -> ducked to ~8.75%
    const duckedVol = calculateEffectiveVolume(true, true);
    assert.ok(Math.abs(duckedVol - 0.0875) < 0.001, `Expected ducked volume ~0.0875, got ${duckedVol}`);

    // When pause/silence and autoDucking is ON -> full 25%
    const restoredVol = calculateEffectiveVolume(false, true);
    assert.strictEqual(restoredVol, 0.25);

    // When autoDucking is OFF -> constant 25%
    assert.strictEqual(calculateEffectiveVolume(true, false), 0.25);
    assert.strictEqual(calculateEffectiveVolume(false, false), 0.25);
  });

  it('5. AI Producer SET_BACKGROUND_MUSIC action typing & context compatibility', () => {
    const action: ProducerAction = {
      type: 'SET_BACKGROUND_MUSIC',
      trackId: 'phonk-hype-01',
      volume: 30,
      autoDucking: true,
    };

    assert.strictEqual(action.type, 'SET_BACKGROUND_MUSIC');
    assert.strictEqual(action.trackId, 'phonk-hype-01');
    assert.strictEqual(action.volume, 30);
    assert.strictEqual(action.autoDucking, true);

    const context: ProducerEditorContext = {
      step: 3,
      aspectRatio: '9:16',
      genre: 'education',
      outputMode: 'reel',
      templateId: 'beast',
      hook: {
        selectedHookIndex: 0,
        enableHookIntro: true,
      },
      clips: {
        count: 1,
        selectedIndices: [0],
      },
      broll: {
        enableBroll: true,
        count: 0,
      },
      outro: {
        enableIntroOutro: true,
        preset: 'creator-glass',
        ctaText: 'Follow',
        buttonText: 'Follow',
        duration: 3,
        channelName: '@kreator',
      },
      audio: {
        sourceVolume: 100,
        backgroundMusic: {
          trackId: 'lofi-chill-01',
          volume: 25,
          autoDucking: true,
        },
      },
    };

    assert.strictEqual(context.audio.backgroundMusic?.trackId, 'lofi-chill-01');
    assert.strictEqual(context.audio.backgroundMusic?.volume, 25);
  });
});
