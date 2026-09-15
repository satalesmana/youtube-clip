import React from 'react';
import type { useViralResearch } from '../../hooks/useViralResearch';

type ViralResearchHook = ReturnType<typeof useViralResearch>;

interface ResearchViewProps {
  research: ViralResearchHook;
  onSelectVideoForClip: (url: string) => void;
}

export const ResearchView: React.FC<ResearchViewProps> = ({
  research,
  onSelectVideoForClip,
}) => {
  const {
    keyword,
    setKeyword,
    subreddits,
    setSubreddits,
    maxTrends,
    setMaxTrends,
    language,
    setLanguage,
    providers,
    toggleProvider,
    applyPreset,
    topics,
    loading,
    error,
    runResearch,
  } = research;

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '0 24px 60px' }}>
      <div className="card">
        <div className="card-head">
          <div className="card-head-title">
            <h2>Radar Riset Tren &amp; Konten Viral</h2>
            <span className="head-badge">Multi-Source Signals</span>
          </div>
          <p className="muted">
            Kumpulkan sinyal multi-sumber dari Google Trends, Berita RSS, Reddit, dan X/Twitter untuk menemukan topik yang sedang ramai dibicarakan serta video YouTube siap klip.
          </p>
        </div>

        {/* Preset Pilihan Cepat */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ice)', display: 'block', marginBottom: '8px' }}>
            Pilihan Kategori Cepat:
          </span>
          <div className="preset-chips">
            <button
              type="button"
              className="preset-chip"
              onClick={() => applyPreset('teknologi AI kecerdasan buatan', 'technology,artificial,singularity')}
            >
              💡 Teknologi &amp; AI
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => applyPreset('sepak bola olahraga timnas highlight', 'soccer,sports')}
            >
              ⚽ Olahraga &amp; Bola
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => applyPreset('bisnis investasi pasar ekonomi crypto', 'finance,business,investing')}
            >
              📈 Bisnis &amp; Investasi
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => applyPreset('gaming update esports game viral', 'gaming,games')}
            >
              🎮 Gaming &amp; Esports
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => applyPreset('berita viral heboh trending indonesia', 'indonesia')}
            >
              🇮🇩 Trending Indonesia
            </button>
          </div>
        </div>

        <div className="research-controls">
          <div className="form-row">
            <div className="input-group">
              <label className="label-main">Maksimal Topik</label>
              <input
                type="number"
                min={1}
                max={25}
                value={maxTrends}
                onChange={(e) => setMaxTrends(Number(e.target.value))}
              />
            </div>
            <div className="input-group">
              <label className="label-main">Bahasa Analisis</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="auto">Deteksi Otomatis</option>
                <option value="id">Bahasa Indonesia (ID)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '14px' }}>
            <div className="input-group">
              <label className="label-main">Kata Kunci Spesifik (Opsional)</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Contoh: Timnas, Apple, AI, Crypto, Otomotif..."
              />
            </div>
            <div className="input-group">
              <label className="label-main">Target Subreddit (Opsional)</label>
              <input
                type="text"
                value={subreddits}
                onChange={(e) => setSubreddits(e.target.value)}
                placeholder="indonesia, technology, worldnews"
              />
            </div>
          </div>

          <div className="input-group" style={{ marginTop: '18px' }}>
            <label className="label-main">Sumber Sinyal Radar</label>
            <div className="provider-chips">
              <button
                type="button"
                className={`chip-toggle ${providers.includes('rss') ? 'active' : ''}`}
                onClick={() => toggleProvider('rss')}
              >
                📰 Berita RSS
              </button>
              <button
                type="button"
                className={`chip-toggle ${providers.includes('reddit') ? 'active' : ''}`}
                onClick={() => toggleProvider('reddit')}
              >
                🤖 Reddit Hot
              </button>
              <button
                type="button"
                className={`chip-toggle ${providers.includes('trends') ? 'active' : ''}`}
                onClick={() => toggleProvider('trends')}
              >
                📈 Google Trends
              </button>
              <button
                type="button"
                className={`chip-toggle ${providers.includes('x') ? 'active' : ''}`}
                onClick={() => toggleProvider('x')}
              >
                🐦 X (Twitter)
              </button>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button
              type="button"
              className="btn primary full"
              disabled={loading}
              onClick={() => runResearch()}
            >
              {loading ? '🔍 Sedang Memindai Sinyal Tren...' : '🔍 Jalankan Radar Riset Tren'}
            </button>
          </div>
        </div>

        {error && (
          <div className="card" style={{ marginTop: '16px', borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', color: '#FCA5A5' }}>
            <p>Terjadi kendala saat riset: {error}</p>
          </div>
        )}
      </div>

      {/* Results Section */}
      {topics.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <div className="section-technical-header">
            <h3>Topik Tren Terdeteksi</h3>
            <span className="tech-spec-label">{topics.length} Topik Ditemukan</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {topics.map((t, idx) => (
              <div key={idx} className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 6px' }}>
                      {idx + 1}. {t.topic}
                    </h4>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.55 }}>
                      {t.summary}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {t.sources?.map((src: any, sIdx) => {
                        const name = typeof src === 'string' ? src : src?.source || src?.name || 'RSS';
                        return (
                          <span key={sIdx} className="reason-pill">
                            Sumber: {name.toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="score-badge">
                    <span className="score-num">{Math.round(t.score)}</span>
                    <span className="score-lbl">Skor Tren</span>
                  </div>
                </div>

                {/* Sample Videos */}
                {t.sampleVideos && t.sampleVideos.length > 0 && (
                  <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ice)', display: 'block', marginBottom: '10px' }}>
                      Rekomendasi Video YouTube Terkait:
                    </span>
                    <div className="videos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                      {t.sampleVideos.map((v) => (
                        <div key={v.id} style={{ background: '#080C14', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {v.thumbnail && (
                            <img
                              src={v.thumbnail}
                              alt=""
                              style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                              loading="lazy"
                            />
                          )}
                          <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.title}
                          </span>
                          <button
                            type="button"
                            className="btn primary small"
                            onClick={() => onSelectVideoForClip(v.url)}
                          >
                            ⚡ Potong dari Video Ini
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
