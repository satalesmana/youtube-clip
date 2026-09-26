import type { SubtitleSize } from '../../../types';

interface SubtitleTemplatePickerProps {
  templateId: string;
  setTemplateId: (id: string) => void;
  subtitleSize?: SubtitleSize;
  setSubtitleSize?: (size: SubtitleSize) => void;
}

export const SubtitleTemplatePicker: React.FC<SubtitleTemplatePickerProps> = ({
  templateId,
  setTemplateId,
  subtitleSize,
  setSubtitleSize,
}) => {
  return (
    <div className="input-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <label className="label-main" style={{ margin: 0 }}>Pilih Template Subtitle Karaoke</label>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Gaya animasi kata per kata pada video</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px' }}>
        {/* 1. MrBeast Style */}
        <div
          className="card"
          style={{
            border: templateId === 'beast' ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: templateId === 'beast' ? 'var(--bg-card-selected)' : 'var(--bg-card)',
            cursor: 'pointer',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.18s ease',
          }}
          onClick={() => setTemplateId('beast')}
        >
          <div>
            {/* Visual simulation box */}
            <div className="sub-prev-container">
              <span className="sub-prev-badge-sim">9:16 PREVIEW</span>
              <div className="sub-prev-beast">
                <span className="sub-word-beast-white">INI</span>
                <span className="sub-word-beast-yellow">SANGAT</span>
                <span className="sub-word-beast-cyan">VIRAL!</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: templateId === 'beast' ? 'var(--ice)' : '#ffffff' }}>
                🌟 Pop Dinamis (MrBeast)
              </div>
              {templateId === 'beast' && (
                <span style={{ fontSize: '10.5px', fontWeight: 700, background: 'var(--accent)', color: '#0A0E14', padding: '1px 6px', borderRadius: '4px' }}>
                  ✓ Terpilih
                </span>
              )}
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
              Teks tebal dengan sorotan kata per kata kuning &amp; cyan yang bergerak lincah menarik perhatian penonton.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <span className="hts-meta-badge">Karaoke Pop</span>
            <span className="hts-meta-badge">Dual Neon Color</span>
            <span className="hts-meta-badge">Shorts &amp; Reels</span>
          </div>
        </div>

        {/* 2. Hormozi Style */}
        <div
          className="card"
          style={{
            border: templateId === 'hormozi' ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: templateId === 'hormozi' ? 'var(--bg-card-selected)' : 'var(--bg-card)',
            cursor: 'pointer',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.18s ease',
          }}
          onClick={() => setTemplateId('hormozi')}
        >
          <div>
            {/* Visual simulation box */}
            <div className="sub-prev-container">
              <span className="sub-prev-badge-sim">9:16 PREVIEW</span>
              <div className="sub-prev-hormozi">
                <span className="sub-word-hormozi-white">CARA DAPAT</span>
                <span className="sub-word-hormozi-yellow">1 MILYAR</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: templateId === 'hormozi' ? 'var(--ice)' : '#ffffff' }}>
                ⬛ Kotak Kontras (Hormozi)
              </div>
              {templateId === 'hormozi' && (
                <span style={{ fontSize: '10.5px', fontWeight: 700, background: 'var(--accent)', color: '#0A0E14', padding: '1px 6px', borderRadius: '4px' }}>
                  ✓ Terpilih
                </span>
              )}
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
              Huruf impact tebal dengan kotak hitam pekat yang kontras tinggi, sangat nyaman dibaca tanpa terganggu latar.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <span className="hts-meta-badge">Black Box</span>
            <span className="hts-meta-badge">High Contrast</span>
            <span className="hts-meta-badge">Bisnis &amp; Finansial</span>
          </div>
        </div>

        {/* 3. Clean Minimalist Style */}
        <div
          className="card"
          style={{
            border: templateId === 'clean' ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: templateId === 'clean' ? 'var(--bg-card-selected)' : 'var(--bg-card)',
            cursor: 'pointer',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.18s ease',
          }}
          onClick={() => setTemplateId('clean')}
        >
          <div>
            {/* Visual simulation box */}
            <div className="sub-prev-container">
              <span className="sub-prev-badge-sim">9:16 PREVIEW</span>
              <div className="sub-prev-clean">
                <span className="sub-word-clean-white">Rahasia sukses</span>
                <span className="sub-word-clean-green">bisnis modern</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: templateId === 'clean' ? 'var(--ice)' : '#ffffff' }}>
                ✨ Modern Elegan Minimalis
              </div>
              {templateId === 'clean' && (
                <span style={{ fontSize: '10.5px', fontWeight: 700, background: 'var(--accent)', color: '#0A0E14', padding: '1px 6px', borderRadius: '4px' }}>
                  ✓ Terpilih
                </span>
              )}
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
              Tipografi bersih dan elegan dengan bayangan lembut, cocok untuk konten podcast santai, edukasi, dan wawancara.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <span className="hts-meta-badge">Clean Fade</span>
            <span className="hts-meta-badge">Soft Shadow</span>
            <span className="hts-meta-badge">Podcast &amp; Edukasi</span>
          </div>
        </div>
      </div>

      {/* Subtitle Font Size Selector */}
      {setSubtitleSize && (
        <div style={{ marginTop: '16px', background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#FFFFFF' }}>
              Ukuran Font Subtitle
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Menyesuaikan proporsi font secara presisi
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { id: 'sm', label: 'Kecil (38px)', desc: 'Subtil & Rapi' },
              { id: 'md', label: 'Sedang (48px)', desc: 'Standar Optimal' },
              { id: 'lg', label: 'Besar (58px)', desc: 'Tebal & Catchy' },
              { id: 'xl', label: 'Ekstra (68px)', desc: 'Maksimal Impact' },
            ].map((s) => {
              const isSelected = (subtitleSize || 'md') === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSubtitleSize(s.id as 'sm' | 'md' | 'lg' | 'xl')}
                  style={{
                    background: isSelected ? 'var(--bg-card-selected)' : 'var(--bg-input)',
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? 'var(--ice)' : '#FFFFFF' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {s.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
