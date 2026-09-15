import React from 'react';

interface SubtitleTemplatePickerProps {
  templateId: string;
  setTemplateId: (id: string) => void;
}

export const SubtitleTemplatePicker: React.FC<SubtitleTemplatePickerProps> = ({
  templateId,
  setTemplateId,
}) => {
  return (
    <div className="input-group">
      <label className="label-main">Pilih Template Subtitle Karaoke</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        <div
          className="card"
          style={{
            border: templateId === 'beast' ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: templateId === 'beast' ? 'var(--bg-card-selected)' : 'var(--bg-card)',
            cursor: 'pointer',
            padding: '18px',
            borderRadius: 'var(--radius-md)',
          }}
          onClick={() => setTemplateId('beast')}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ice)', marginBottom: '6px' }}>
            🌟 Pop Dinamis (Gaya MrBeast)
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Teks tebal dengan sorotan kata per kata berwarna kuning &amp; cyan yang bergerak lincah menarik perhatian penonton.
          </p>
        </div>

        <div
          className="card"
          style={{
            border: templateId === 'hormozi' ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: templateId === 'hormozi' ? 'var(--bg-card-selected)' : 'var(--bg-card)',
            cursor: 'pointer',
            padding: '18px',
            borderRadius: 'var(--radius-md)',
          }}
          onClick={() => setTemplateId('hormozi')}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
            ⬛ Kotak Kontras Tegas (Gaya Hormozi)
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Huruf impact tebal dengan latar belakang kotak hitam pekat yang kontras tinggi dan sangat nyaman dibaca.
          </p>
        </div>

        <div
          className="card"
          style={{
            border: templateId === 'clean' ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: templateId === 'clean' ? 'var(--bg-card-selected)' : 'var(--bg-card)',
            cursor: 'pointer',
            padding: '18px',
            borderRadius: 'var(--radius-md)',
          }}
          onClick={() => setTemplateId('clean')}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
            ✨ Modern Elegan Minimalis
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Tipografi bersih dan elegan dengan bayangan lembut, cocok untuk konten podcast, edukasi, dan wawasan bisnis.
          </p>
        </div>
      </div>
    </div>
  );
};
