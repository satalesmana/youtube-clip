import React, { useState, useEffect } from 'react';
import type { TransformResult } from '../../../types';

interface Step4OutputProps {
  step: number;
  setStep: (step: number) => void;
  transformResult: TransformResult | null;
  transformError: string | null;
  runningTransform?: boolean;
  progressPct?: number;
  progressLabel?: string;
  onRegenerateVideo?: () => void;
  onOpenCaptionModal: (videoId: string, title: string) => void;
}

export const Step4Output: React.FC<Step4OutputProps> = ({
  step,
  setStep,
  transformResult,
  transformError,
  runningTransform = false,
  progressPct = 0,
  progressLabel = '',
  onRegenerateVideo,
  onOpenCaptionModal,
}) => {
  const [lastRenderedAt, setLastRenderedAt] = useState<string | null>(null);

  useEffect(() => {
    if (transformResult) {
      const now = new Date();
      setLastRenderedAt(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }
  }, [transformResult?.outputVideo, transformResult?.videoUrl]);
  return (
    <div className={`card ${step !== 4 ? 'hidden' : ''}`}>
      <div className="card-head">
        <div className="card-head-title">
          <h2>4. Video Berhasil Dirender &amp; Siap Pakai</h2>
          <span className="head-badge" style={{ background: '#10B981', color: '#ffffff' }}>✓ Selesai Dirender</span>
          {lastRenderedAt && (
            <span
              style={{
                fontSize: '11.5px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              Update: {lastRenderedAt}
            </span>
          )}
        </div>
        <p className="muted">
          Video format 1080x1920 60fps telah siap dipublikasikan ke YouTube Shorts, Instagram Reels, dan TikTok.
        </p>
      </div>

      {transformError && (
        <div
          className="card"
          style={{
            borderColor: '#EF4444',
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#FCA5A5',
            marginBottom: '18px',
            padding: '16px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <strong style={{ display: 'block', color: '#EF4444', marginBottom: '4px' }}>
                ⚠️ Kendala saat rendering Remotion:
              </strong>
              <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5 }}>{transformError}</p>
            </div>
            {onRegenerateVideo && (
              <button
                type="button"
                className="btn secondary"
                disabled={runningTransform}
                onClick={onRegenerateVideo}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  borderColor: '#EF4444',
                  color: '#FCA5A5',
                  padding: '8px 16px',
                  fontSize: '13px',
                }}
              >
                🔄 Coba Render Ulang
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress Box during Re-render */}
      {runningTransform && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(56, 189, 248, 0.3)',
                  borderTopColor: '#38BDF8',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#BAE6FD' }}>
                {progressLabel || 'Sedang merender ulang video Remotion...'}
              </span>
            </div>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#38BDF8' }}>
              {progressPct}%
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(5, progressPct)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38BDF8 0%, #818CF8 100%)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            ⚡ Menggunakan aset video, transkrip, dan audio narasi yang sudah tersimpan untuk pengujian instan.
          </p>
        </div>
      )}

      {transformResult ? (() => {
        const rawVideo = transformResult.videoUrl || transformResult.outputVideo;
        const videoSrc = typeof rawVideo === 'string'
          ? rawVideo
          : (rawVideo as { url?: string } | undefined)?.url || '';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <div
              style={{
                maxWidth: '340px',
                width: '100%',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: '#000',
                boxShadow: 'var(--shadow-lg)',
                position: 'relative',
                opacity: runningTransform ? 0.65 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              <video
                key={videoSrc}
                src={videoSrc}
                controls
                autoPlay
                playsInline
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              {runningTransform && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    color: '#ffffff',
                  }}
                >
                  <span
                    style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid rgba(255, 255, 255, 0.3)',
                      borderTopColor: '#38BDF8',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Merender Remotion...</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
              <a
                href={videoSrc}
                download
                className="btn primary"
                style={{ textDecoration: 'none' }}
              >
                ⬇ Unduh Master Video (MP4)
              </a>

              {onRegenerateVideo && (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={runningTransform}
                  onClick={onRegenerateVideo}
                  style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(217, 119, 6, 0.22) 100%)',
                    borderColor: 'rgba(245, 158, 11, 0.45)',
                    color: '#FDE68A',
                    fontWeight: 600,
                  }}
                  title="Render ulang Remotion dengan konfigurasi saat ini untuk menguji perubahan kode render tanpa mengulang dari awal"
                >
                  {runningTransform ? (
                    <>
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid rgba(253, 230, 138, 0.3)',
                          borderTopColor: '#FDE68A',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                      Sedang Merender Ulang...
                    </>
                  ) : (
                    <>
                      🔄 Render Ulang Video (Remotion)
                    </>
                  )}
                </button>
              )}

              {transformResult.videoId && (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={runningTransform}
                  onClick={() => onOpenCaptionModal(transformResult.videoId!, transformResult.title)}
                >
                  📱 Buat Caption Media Sosial
                </button>
              )}

              <button
                type="button"
                className="btn ghost"
                disabled={runningTransform}
                onClick={() => setStep(3)}
                title="Kembali ke Langkah 3 untuk menyesuaikan preset subtitle atau naskah tanpa mengulang dari awal"
              >
                ✏️ Ubah Gaya di Langkah 3
              </button>

              <button
                type="button"
                className="btn ghost"
                disabled={runningTransform}
                onClick={() => setStep(1)}
              >
                + Proses Video Baru
              </button>
            </div>

            {/* Remotion Developer Helper Note */}
            <div
              style={{
                marginTop: '4px',
                padding: '12px 18px',
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px dashed rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12.5px',
                color: '#FDE68A',
                maxWidth: '620px',
                textAlign: 'center',
                lineHeight: 1.55,
              }}
            >
              💡 <strong>Mode Pengujian Remotion:</strong> Klik <em>&quot;Render Ulang Video (Remotion)&quot;</em> untuk langsung memproses ulang render setelah Anda mengubah komponen/styling Remotion (seperti <code>Caption.tsx</code> atau layout) tanpa harus mengulang proses download atau transkripsi dari awal.
            </div>
          </div>
        ); })() : (
          <div className="empty-recent-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <p>Belum ada hasil render. Selesaikan Langkah 3 dan klik tombol render untuk memulai pembuatan video.</p>
            {onRegenerateVideo && (
              <button
                type="button"
                className="btn primary"
                disabled={runningTransform}
                onClick={onRegenerateVideo}
              >
                {runningTransform ? '⏳ Sedang Merender...' : '🚀 Mulai Render Video'}
              </button>
            )}
          </div>
        )}
    </div>
  );
};
