import React from 'react';
import type { ViralClip } from '../../../types';

interface HookCtaBannerProps {
  selectedClip: ViralClip | undefined;
  selectedClipIndex: number | null;
  hooksCount: number;
  generatingHooks: boolean;
  onTriggerHookCta: () => void;
  onScrollToHookSection: () => void;
}

export const HookCtaBanner: React.FC<HookCtaBannerProps> = ({
  selectedClip,
  selectedClipIndex,
  hooksCount,
  generatingHooks,
  onTriggerHookCta,
  onScrollToHookSection,
}) => {
  if (selectedClipIndex === null || !selectedClip) return null;

  return (
    <div className="hook-cta-banner">
      <div className="hook-cta-content">
        <div className="hook-cta-pill">
          <span className="hook-cta-pill-icon">🔥</span>
          <span>Optimasi Viralitas • Klip #{selectedClipIndex + 1}</span>
        </div>
        <h3 className="hook-cta-title">
          {hooksCount > 0
            ? '5 Hook Alternatif Siap Dipilih!'
            : 'Ingin Detik 0–3 Klip Ini Lebih Menghentak?'}
        </h3>
        <p className="hook-cta-desc">
          {hooksCount > 0
            ? `5 Variasi hook pembuka AI untuk "${selectedClip.title}" sudah siap. Pilih salah satu di bawah.`
            : 'Hasilkan 5 variasi kalimat pembuka alternatif AI (gaya kontroversial, rasa penasaran, atau fakta mengejutkan) dengan thumbnail footage.'}
        </p>
      </div>
      <div className="hook-cta-action" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-hook-pulse"
          disabled={generatingHooks}
          onClick={() => {
            if (hooksCount > 0) {
              onScrollToHookSection();
            } else {
              onTriggerHookCta();
            }
          }}
        >
          {generatingHooks ? (
            <>⏳ Meracik 5 Hook Alternatif AI...</>
          ) : hooksCount > 0 ? (
            <>🎯 Lihat 5 Hook Alternatif ↓</>
          ) : (
            <>⚡ Buat 5 Hook Alternatif AI</>
          )}
        </button>
      </div>
    </div>
  );
};
