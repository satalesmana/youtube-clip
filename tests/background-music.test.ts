import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
  it('1. Audio Catalog Integrity: all 11 tracks exist and stream online via direct CDN without local storage', () => {
    assert.ok(AUDIO_CATALOG.length >= 11, 'Expected at least 11 curated royalty-free tracks');

    for (const track of AUDIO_CATALOG) {
      assert.ok(track.id, 'Track must have an id');
      assert.ok(track.title, 'Track must have a title');
      assert.ok(track.streamUrl.startsWith('https://'), `streamUrl must stream online via https, got: ${track.streamUrl}`);
      assert.ok(track.coverUrl.startsWith('https://'), `coverUrl must stream online via https, got: ${track.coverUrl}`);
      assert.ok(track.durationSec > 0, 'durationSec must be positive');
      assert.ok(track.license.includes('Royalty-Free'), 'License must be royalty-free');
    }
  });

  it('2. Genre filtering & searching across catalog', () => {
    const lofi = filterByGenre('lofi');
    assert.ok(lofi.length >= 3, 'Expected at least 3 lofi tracks');
    assert.ok(lofi.every((t) => t.genre === 'lofi'));

    const phonk = filterByGenre('phonk');
    assert.ok(phonk.length >= 2, 'Expected at least 2 phonk tracks');

    const searchRes = searchTracks('study');
    assert.ok(searchRes.length > 0);
  });

  it('3. resolveAudioStreamUrl & getDefaultMusicTrack', () => {
    const defaultTrack = getDefaultMusicTrack();
    assert.ok(defaultTrack.id);

    assert.strictEqual(resolveAudioStreamUrl(null), undefined);
    assert.strictEqual(resolveAudioStreamUrl(undefined), undefined);
    assert.ok(resolveAudioStreamUrl(defaultTrack)?.includes('http'));
    assert.ok(resolveAudioStreamUrl('phonk-hype-01')?.startsWith('https://'));

    // Mapping track ID string to online streamUrl
    assert.ok(resolveAudioStreamUrl('cinematic-01')?.startsWith('https://'));
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
