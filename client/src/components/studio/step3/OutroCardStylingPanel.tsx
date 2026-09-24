import React, { useRef } from 'react';
import type { OutroPresetId } from '../../../types';
import {
  CLIENT_OUTRO_PRESETS,
  resolveClientOutroPreset,
} from '../../../lib/outro-presets';

export interface OutroCardStylingPanelProps {
  selectedPreset: OutroPresetId;
  onPresetChange: (preset: OutroPresetId) => void;
  ctaText: string;
  onCtaTextChange: (text: string) => void;
  buttonText: string;
  onButtonTextChange: (text: string) => void;
  duration: number;
  onDurationChange: (duration: number) => void;
  channelName?: string;
  onChannelNameChange?: (name: string) => void;
  logoUrl?: string | null;
  onLogoUrlChange?: (url: string | null) => void;
}

const DURATION_OPTIONS = [
  { value: 2, label: '2 Detik', desc: 'Cepat & Ringkas' },
  { value: 3, label: '3 Detik', desc: 'Standar Optimal' },
  { value: 4, label: '4 Detik', desc: 'Lebih Luang' },
  { value: 5, label: '5 Detik', desc: 'Maksimal Baca' },
];

export const OutroCardStylingPanel: React.FC<OutroCardStylingPanelProps> = ({
  selectedPreset,
  onPresetChange,
  ctaText,
  onCtaTextChange,
  buttonText,
  onButtonTextChange,
  duration,
  onDurationChange,
  channelName,
  onChannelNameChange,
  logoUrl,
  onLogoUrlChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentPreset = resolveClientOutroPreset(selectedPreset);

  const displayHandle = channelName ? channelName.replace(/^@/, '').trim() || 'kreator' : 'kreator';
  const effectiveCta = ctaText.trim() || currentPreset.defaultCtaText;
  const effectiveBtn = buttonText.trim() || currentPreset.defaultButtonText;

  const handleSelectPreset = (presetId: OutroPresetId) => {
    const p = resolveClientOutroPreset(presetId);
    onPresetChange(presetId);
    if (!ctaText || ctaText === currentPreset.defaultCtaText) {
      onCtaTextChange(p.defaultCtaText);
    }
    if (!buttonText || buttonText === currentPreset.defaultButtonText) {
      onButtonTextChange(p.defaultButtonText);
    }
  };

  const handleResetToDefault = () => {
    onCtaTextChange(currentPreset.defaultCtaText);
    onButtonTextChange(currentPreset.defaultButtonText);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: max 4MB
    if (file.size > 4 * 1024 * 1024) {
      alert('Ukuran file logo terlalu besar. Harap gunakan gambar di bawah 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && onLogoUrlChange) {
        onLogoUrlChange(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input value so user can re-select same file if needed
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    if (onLogoUrlChange) {
      onLogoUrlChange(null);
    }
  };

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '24px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🎯</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.3px' }}>
              Pilihan Preset Kartu Penutup (Outro CTA)
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--muted, #94A3B8)' }}>
            Kustomisasi nama channel, logo/avatar, teks ajakan, dan tombol aksi yang muncul di akhir video untuk memaksimalkan konversi penonton.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetToDefault}
          className="btn ghost"
          style={{ fontSize: '12px', padding: '6px 12px', height: 'auto', border: '1px solid var(--border)' }}
          title="Kembalikan teks CTA & tombol ke default preset"
        >
          🔄 Reset Teks Default
        </button>
      </div>

      {/* Channel Branding Row: Nama Channel & Logo Upload */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        {/* Field Nama Channel / Handle */}
        <div className="input-group" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="label-main" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Nama Channel / Handle
            </label>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              @{displayHandle}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid var(--border)',
                borderRight: 'none',
                padding: '9px 12px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--accent, #00F2FE)',
                borderTopLeftRadius: 'var(--radius-md, 8px)',
                borderBottomLeftRadius: 'var(--radius-md, 8px)',
              }}
            >
              @
            </span>
            <input
              type="text"
              value={channelName || ''}
              onChange={(e) => onChannelNameChange && onChannelNameChange(e.target.value)}
              placeholder="nama_channel_anda"
              maxLength={60}
              style={{
                flex: 1,
                boxSizing: 'border-box',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                borderTopRightRadius: 'var(--radius-md, 8px)',
                borderBottomRightRadius: 'var(--radius-md, 8px)',
                padding: '9px 12px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
              }}
            />
          </div>
        </div>

        {/* Upload Logo / Avatar Channel */}
        <div className="input-group" style={{ margin: 0 }}>
          <label className="label-main" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Logo / Avatar Channel
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Thumbnail Preview or Placeholder */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: logoUrl ? 'transparent' : 'rgba(255,255,255,0.08)',
                border: `2px solid ${logoUrl ? currentPreset.primaryColor : 'var(--border)'}`,
                boxShadow: logoUrl ? `0 0 10px ${currentPreset.glowColor}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Klik untuk memilih file logo"
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo Channel"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: '18px' }}>👤</span>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '12px', padding: '7px 14px', height: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>🖼️</span>
                <span>{logoUrl ? 'Ganti Logo' : 'Unggah Logo'}</span>
              </button>

              {logoUrl && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleRemoveLogo}
                  style={{ fontSize: '12px', padding: '7px 12px', height: 'auto', color: '#FF5C5C', border: '1px solid rgba(255,92,92,0.3)' }}
                  title="Hapus logo yang diunggah"
                >
                  ✕ Hapus
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Layout: Left Controls, Right Interactive Preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Preset Cards & Customizer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Preset Selector Grid */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--ice, #E2E8F0)', marginBottom: '10px' }}>
              Pilih Gaya Desain (6 Pilihan Preset)
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '10px',
              }}
            >
              {CLIENT_OUTRO_PRESETS.map((p) => {
                const isSelected = p.id === selectedPreset;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    style={{
                      cursor: 'pointer',
                      padding: '12px',
                      borderRadius: 'var(--radius-md, 12px)',
                      background: isSelected
                        ? 'rgba(255, 255, 255, 0.07)'
                        : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected
                        ? `2px solid ${p.primaryColor}`
                        : '1px solid var(--border)',
                      boxShadow: isSelected ? `0 0 16px ${p.glowColor}` : 'none',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '18px' }}>{p.icon}</span>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: p.primaryColor,
                          boxShadow: `0 0 8px ${p.primaryColor}`,
                        }}
                      />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#FFFFFF' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: p.primaryColor, fontWeight: 600 }}>{p.tagline}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted, #94A3B8)', lineHeight: 1.3, marginTop: '2px' }}>
                      {p.badgeLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA Headline Input */}
          <div className="input-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="label-main" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Teks Ajakan (Call To Action)
              </label>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {effectiveCta.length}/200 karakter
              </span>
            </div>
            <textarea
              rows={2}
              value={ctaText}
              onChange={(e) => onCtaTextChange(e.target.value)}
              placeholder={currentPreset.defaultCtaText}
              maxLength={200}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '10px 12px',
                color: '#FFFFFF',
                fontSize: '13px',
                resize: 'vertical',
                lineHeight: 1.4,
              }}
            />

            {/* Quick Suggestion Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                💡 Rekomendasi Cepat:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {currentPreset.quickCtas.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onCtaTextChange(q)}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '9999px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      color: '#E2E8F0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Button Text & Duration Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
            <div className="input-group" style={{ margin: 0 }}>
              <label className="label-main" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Teks Tombol Aksi
              </label>
              <input
                type="text"
                value={buttonText}
                onChange={(e) => onButtonTextChange(e.target.value)}
                placeholder={currentPreset.defaultButtonText}
                maxLength={60}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '9px 12px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                }}
              />
            </div>

            <div className="input-group" style={{ margin: 0 }}>
              <label className="label-main" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Durasi Kartu Penutup
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {DURATION_OPTIONS.map((d) => {
                  const isDurActive = duration === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => onDurationChange(d.value)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        fontSize: '11.5px',
                        fontWeight: isDurActive ? 700 : 500,
                        background: isDurActive ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.2)',
                        border: isDurActive ? `1.5px solid ${currentPreset.primaryColor}` : '1px solid var(--border)',
                        color: isDurActive ? '#FFFFFF' : 'var(--muted)',
                        borderRadius: 'var(--radius-md, 8px)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {d.value}s
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--ice)' }}>
              Live Visual Preview (WYSIWYG)
            </span>
            <span style={{ fontSize: '11px', color: currentPreset.primaryColor, fontWeight: 700 }}>
              {currentPreset.name} • {duration} Detik
            </span>
          </div>

          {/* Phone Frame Container */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '380px',
              borderRadius: '24px',
              overflow: 'hidden',
              background: '#07090E',
              border: '2px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '24px 20px',
            }}
          >
            {/* Ambient Background Simulation */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.92) 100%)`,
                backdropFilter: 'blur(10px)',
              }}
            />

            {/* Floating Card Mockup (100% WYSIWYG matching Remotion Outro.tsx) */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                maxWidth: '320px',
                backgroundColor: currentPreset.cardBg,
                border: currentPreset.cardBorder,
                borderTop: `3.5px solid ${currentPreset.primaryColor}`,
                borderRadius: '26px',
                padding: '24px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: currentPreset.glowColor ? `0 15px 40px rgba(0,0,0,0.8), 0 0 28px ${currentPreset.glowColor}` : '0 15px 40px rgba(0,0,0,0.8)',
                gap: '14px',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Badge Tag */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: currentPreset.primaryColor,
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                }}
              >
                <span>{currentPreset.badgeIcon}</span>
                <span>{currentPreset.badgeLabel}</span>
              </div>

              {/* Avatar Circle with Ring and Verified Badge */}
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${currentPreset.primaryColor}, ${currentPreset.accentColor})`,
                    padding: '3px',
                    boxShadow: `0 0 20px ${currentPreset.glowColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#1A202C',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`Logo @${displayHandle}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '20px', fontWeight: 900, color: '#FFFFFF' }}>
                        {displayHandle.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                {/* Verified icon */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: currentPreset.primaryColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: currentPreset.buttonTextColor,
                    fontSize: '12px',
                    fontWeight: 900,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.7)',
                  }}
                >
                  {selectedPreset === 'viral-neon' ? '⚡' : selectedPreset === 'comment-debate' ? '💬' : selectedPreset === 'subscribe-bell' ? '🔔' : selectedPreset === 'link-in-bio' ? '🔗' : '✓'}
                </div>
              </div>

              {/* Channel & CTA text */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '17px',
                    fontWeight: 900,
                    color: '#FFFFFF',
                    letterSpacing: '0.4px',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                  }}
                >
                  @{displayHandle}
                </span>
                <span
                  style={{
                    fontSize: '12.5px',
                    color: 'rgba(255, 255, 255, 0.85)',
                    lineHeight: 1.35,
                    maxWidth: '260px',
                  }}
                >
                  {effectiveCta}
                </span>
              </div>

              {/* Action Button Preview */}
              <div
                style={{
                  background: currentPreset.buttonGradient,
                  color: currentPreset.buttonTextColor,
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '0.5px',
                  padding: '10px 24px',
                  borderRadius: '9999px',
                  boxShadow: `0 0 20px ${currentPreset.glowColor}`,
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '4px',
                }}
              >
                <span>{effectiveBtn}</span>
              </div>
            </div>

            {/* Safe Zone Indicator Footer */}
            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                fontSize: '10.5px',
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.5px',
              }}
            >
              📐 Safe-zone 9:16 Video Canvas
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
