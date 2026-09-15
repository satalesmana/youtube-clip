import React from 'react';
import type { DownloadedVideo, ViralClip, ViralHook } from '../../../types';

interface HookIntroStylingPanelProps {
  enableHookIntro: boolean;
  setEnableHookIntro: (val: boolean) => void;
  selectedHookIndex: number | null;
  hooks: ViralHook[];
  selectedClipIndices: number[];
  clips: ViralClip[];
  downloadedVideo: DownloadedVideo | null;
  customHookText: string;
  setCustomHookText: (text: string) => void;
  customHookTag: string;
  setCustomHookTag: (tag: string) => void;
}

const DEFAULT_TAG_OPTIONS = [
  '🔥 MOMEN VIRAL',
  '⚡ FAKTA MENGEJUTKAN',
  '🎯 DETIK KRUSIAL',
  '❓ TAHUKAH KAMU?',
];

export const HookIntroStylingPanel: React.FC<HookIntroStylingPanelProps> = ({
  enableHookIntro,
  setEnableHookIntro,
  selectedHookIndex,
  hooks,
  selectedClipIndices,
  clips,
  downloadedVideo,
  customHookText,
  setCustomHookText,
  customHookTag,
  setCustomHookTag,
}) => {
  const fallbackThumbnail =
    (selectedClipIndices.length > 0 && clips[selectedClipIndices[0]]?.thumbnailUrl) ||
    downloadedVideo?.thumbnailUrl ||
    (downloadedVideo?.videoId ? `https://img.youtube.com/vi/${downloadedVideo.videoId}/hqdefault.jpg` : '');

  const hookThumbnail =
    (selectedHookIndex !== null && hooks[selectedHookIndex]?.thumbnailUrl) ||
    (selectedHookIndex !== null && hooks[selectedHookIndex]?.previewUrl ? hooks[selectedHookIndex].previewUrl!.replace(/\.mp4(\?.*)?$/, '.jpg$1') : '') ||
    fallbackThumbnail;

  return (
    <div className="input-group" style={{ marginBottom: '26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="label-main" style={{ margin: 0 }}>🎨 Desain &amp; Edit Teks Hook Pembuka (0–3 Detik)</label>
          <span className="output-mode-badge" style={{ fontSize: '10.5px' }}>Tahap 3: Styling Video</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={enableHookIntro}
            onChange={(e) => setEnableHookIntro(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span style={{ color: enableHookIntro ? 'var(--ice)' : 'var(--text-muted)' }}>
            {enableHookIntro ? '✓ Intro Hook Aktif' : 'Intro Hook Nonaktif'}
          </span>
        </label>
      </div>

      {enableHookIntro ? (
        <div
          className="card"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {/* Thumbnail Preview Column */}
            <div style={{ width: '90px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ position: 'relative', width: '90px', height: '160px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
                <img
                  src={hookThumbnail}
                  alt="Hook Thumbnail"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    if (fallbackThumbnail && (e.target as HTMLImageElement).src !== fallbackThumbnail) {
                      (e.target as HTMLImageElement).src = fallbackThumbnail;
                    }
                  }}
                />
                <div style={{ position: 'absolute', bottom: '4px', left: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', borderRadius: '4px', padding: '2px 4px', fontSize: '9.5px', textAlign: 'center', color: '#fff', fontWeight: 600 }}>
                  Detik 0–3
                </div>
              </div>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Footage Pembuka
              </span>
            </div>

            {/* Edit Controls Column */}
            <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ice)' }}>
                    Kalimat Hook Kinetik di Layar:
                  </span>
                  {selectedHookIndex !== null && (
                    <span style={{ fontSize: '11.5px', color: 'var(--accent)' }}>
                      Terpilih dari Hook #{selectedHookIndex + 1} ({hooks[selectedHookIndex]?.hookType})
                    </span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={customHookText}
                  onChange={(e) => setCustomHookText(e.target.value)}
                  placeholder="Masukkan kalimat pembuka yang mengejutkan atau memicu rasa penasaran..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-input, #0c1017)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '13px',
                    lineHeight: '1.4',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: '6px' }}>
                  Pilih / Ubah Tag Kategori:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {DEFAULT_TAG_OPTIONS.map((tagOption) => (
                    <button
                      key={tagOption}
                      type="button"
                      className={`chip-toggle ${customHookTag === tagOption ? 'active' : ''}`}
                      style={{ fontSize: '11.5px', padding: '4px 10px' }}
                      onClick={() => setCustomHookTag(tagOption)}
                    >
                      {tagOption}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={customHookTag}
                    onChange={(e) => setCustomHookTag(e.target.value)}
                    placeholder="Tag kustom..."
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      color: '#fff',
                      width: '140px',
                    }}
                  />
                </div>
              </div>

              <div style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '11.5px', color: '#93C5FD' }}>
                💡 <strong>Proses Styling Remotion:</strong> Gaya tipografi kinetik untuk hook ini akan dirender secara terpadu oleh Remotion Engine bersamaan dengan template subtitle saat tombol Render ditekan.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 18px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
          Intro hook kinetik dinonaktifkan. Video akan langsung dimulai dari dialog klip pertama tanpa judul pembuka.
        </div>
      )}
    </div>
  );
};
