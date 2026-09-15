import React from 'react';

interface StudioProgressBarProps {
  show: boolean;
  progressPct?: number;
  progressLabel?: string;
}

export const StudioProgressBar: React.FC<StudioProgressBarProps> = ({
  show,
  progressPct = 0,
  progressLabel = '',
}) => {
  if (!show) return null;

  const displayPct = progressPct || 45;

  return (
    <div className="progress">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${displayPct}%`, transition: 'width 0.3s ease' }}
        />
      </div>
      <div className="progress-status-row">
        <span>Sedang Memproses: {progressLabel || 'Menganalisis audio dan framing video...'}</span>
        <span>{Math.round(displayPct)}%</span>
      </div>
    </div>
  );
};
