import React from 'react';

interface AiProducerTriggerProps {
  isOpen: boolean;
  hasMessages: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export const AiProducerTrigger: React.FC<AiProducerTriggerProps> = ({
  isOpen,
  hasMessages,
  isLoading,
  onClick,
}) => {
  const [hovered, setHovered] = React.useState(false);

  const buttonStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '80px',   /* di atas tombol Bantuan & Panduan (bottom: 24px + ~44px tinggi tombol + 12px gap) */
    right: '24px',
    zIndex: 1002,     /* lebih tinggi dari FloatingQuestions (1000) dan popup-nya (1001) */
    background: 'linear-gradient(135deg, #0F4C75, #3282B8)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: hovered
      ? '0 0 32px rgba(50, 130, 184, 0.55)'
      : 'var(--shadow-glow)',
    transform: hovered ? 'scale(1.02)' : 'scale(1)',
    transition: 'all 0.2s ease',
    animation: isLoading ? 'ai-producer-pulse 1.6s ease-in-out infinite' : 'none',
    whiteSpace: 'nowrap',
  };

  return (
    <button
      type="button"
      style={buttonStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isOpen ? 'Tutup AI Producer' : 'Buka AI Producer'}
      aria-label={isOpen ? 'Tutup AI Producer' : 'Buka AI Producer'}
    >
      {isOpen ? '✕ Tutup' : '✨ AI Producer'}

      {/* Green dot indicator — only shown when there are messages and drawer is closed */}
      {hasMessages && !isOpen && (
        <span
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'var(--success)',
            border: '2px solid #0A0E14',
            animation: 'ai-producer-dot-pulse 2s infinite',
            display: 'block',
          }}
        />
      )}
    </button>
  );
};
