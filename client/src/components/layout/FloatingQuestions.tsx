import React, { useState } from 'react';

export const FloatingQuestions: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-dim)',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: 'var(--radius-full)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000,
          transition: 'all 0.2s ease',
        }}
        onClick={() => setOpen(!open)}
        title="Bantuan & Panduan Cepat"
      >
        <span>💬</span>
        <span>Bantuan & Panduan</span>
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '76px',
            right: '24px',
            width: '360px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            boxShadow: '0 20px 48px rgba(0,0,0,0.65)',
            zIndex: 1001,
            color: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>✨</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#ffffff' }}>
                Panduan Singkat
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Tutup"
            >
              ✕
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '13px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>1.</span>
              <div>
                <strong style={{ color: '#ffffff' }}>Masukkan Video:</strong> Tempel tautan YouTube atau pilih video lokal berdurasi panjang.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>2.</span>
              <div>
                <strong style={{ color: '#ffffff' }}>Analisis Potensi Viral:</strong> AI mendeteksi hook 3 detik awal, alur cerita, dan memberi skor retensi (0-100).
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>3.</span>
              <div>
                <strong style={{ color: '#ffffff' }}>Kustomisasi Tampilan:</strong> Pilih template subtitle karaoke beranimasi, aktifkan B-roll dinamis, dan beri kartu outro.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>4.</span>
              <div>
                <strong style={{ color: '#ffffff' }}>Unduh & Ekspor:</strong> Render master video 1080x1920 60FPS yang siap tayang di Shorts, Reels, & TikTok.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
