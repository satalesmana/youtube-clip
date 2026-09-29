import React, { useState, useEffect, useRef } from 'react';
import type { useAiProducer } from '../../hooks/useAiProducer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiProducerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  producer: ReturnType<typeof useAiProducer>;
  currentStep: number;
  videoTitle?: string;
  templateId: string;
  aspectRatio: string;
}

// ---------------------------------------------------------------------------
// Default quick chips (shown before any chat)
// ---------------------------------------------------------------------------

const DEFAULT_CHIPS = [
  '🔥 Bikin hook lebih viral',
  '🎨 Ganti subtitle ke MrBeast',
  '📱 Ubah ke 9:16 portrait',
  '🚀 Render video sekarang',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated three-dot loading indicator */
const LoadingDots: React.FC = () => (
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="ai-producer-loading-dot"
        style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'var(--text-sub)',
          animationDelay: `${i * 0.2}s`,
        }}
      />
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AiProducerDrawer: React.FC<AiProducerDrawerProps> = ({
  isOpen,
  onClose,
  producer,
  currentStep,
  videoTitle: _videoTitle,
  templateId,
  aspectRatio,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [chipHover, setChipHover] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [producer.messages, producer.isLoading]);

  // Auto-focus textarea when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 320);
      document.body.classList.add('ai-producer-open');
    } else {
      document.body.classList.remove('ai-producer-open');
    }
    return () => {
      document.body.classList.remove('ai-producer-open');
    };
  }, [isOpen]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || producer.isLoading) return;
    producer.sendMessage(trimmed);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (chip: string) => {
    producer.sendMessage(chip);
  };

  // Determine which chips to show
  const chipsToShow =
    producer.messages.length === 0
      ? DEFAULT_CHIPS
      : producer.suggestedQuestions.length > 0
        ? producer.suggestedQuestions
        : [];

  // =========================================================================
  // Styles
  // =========================================================================

  const drawerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100vh',
    width: 'min(380px, 100vw)',
    background: 'var(--bg-card)',
    borderLeft: '1px solid var(--border)',
    boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
    zIndex: 1100, // Higher than FloatingQuestions (1000) so the drawer is never covered
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s ease',
    pointerEvents: isOpen ? 'all' : 'none',
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  };

  const headerLeftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text)',
  };

  const statusBadgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'var(--success-dim)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 'var(--radius-full)',
    padding: '2px 8px',
    fontSize: '10px',
    color: 'var(--success)',
    fontWeight: 500,
  };

  const closeBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-sub)',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
  };

  const contextPillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-dim)',
    borderRadius: 'var(--radius-full)',
    padding: '4px 12px',
    fontSize: '11px',
    color: 'var(--text-sub)',
    marginTop: '4px',
  };

  const appliedBadgesContainerStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: 'var(--accent-dim)',
    borderBottom: '1px solid var(--border-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  };

  const badgesRowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    flex: 1,
  };

  const badgePillStyle: React.CSSProperties = {
    background: 'var(--accent)',
    color: 'white',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: 'var(--radius-full)',
    fontWeight: 500,
  };

  const undoBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border-focus)',
    color: 'var(--text-muted)',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    marginLeft: '8px',
    flexShrink: 0,
  };

  const messagesAreaStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const welcomeStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  };

  const errorBannerStyle: React.CSSProperties = {
    background: 'var(--danger-dim)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    color: 'var(--danger)',
    fontSize: '12px',
    flexShrink: 0,
  };

  const chipsContainerStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderTop: '1px solid var(--border-dim)',
    flexShrink: 0,
  };

  const chipsRowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  };

  const chipStyle = (chip: string): React.CSSProperties => ({
    background: chipHover === chip ? 'var(--bg-card-hover)' : 'var(--bg-panel)',
    border: chipHover === chip ? '1px solid var(--border-focus)' : '1px solid var(--border)',
    color: chipHover === chip ? 'var(--text)' : 'var(--text-muted)',
    fontSize: '11px',
    padding: '5px 10px',
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  const inputAreaStyle: React.CSSProperties = {
    borderTop: '1px solid var(--border)',
    padding: '12px 16px',
    flexShrink: 0,
  };

  const inputRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
  };

  const textareaStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    fontSize: '13px',
    lineHeight: 1.5,
    resize: 'none',
    minHeight: '40px',
    maxHeight: '120px',
    flex: 1,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
  };

  const sendBtnStyle: React.CSSProperties = {
    background: producer.isLoading || !inputValue.trim() ? 'var(--accent)' : 'var(--accent)',
    opacity: producer.isLoading || !inputValue.trim() ? 0.4 : 1,
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    width: '36px',
    height: '36px',
    fontSize: '16px',
    cursor: producer.isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.15s ease',
  };

  const resetBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-sub)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '4px 0',
    marginTop: '6px',
    display: 'block',
    width: '100%',
    textAlign: 'center',
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div style={drawerStyle} aria-hidden={!isOpen}>

      {/* ---- HEADER ---- */}
      <div style={headerStyle}>
        <div style={headerRowStyle}>
          <div style={headerLeftStyle}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>🤖</span>
            <span style={titleStyle}>AI Producer</span>
            <div style={statusBadgeStyle}>
              <span className="ai-producer-online-dot" />
              <span>Synced</span>
            </div>
          </div>
          <button
            type="button"
            style={closeBtnStyle}
            onClick={onClose}
            aria-label="Tutup AI Producer"
          >
            ✕
          </button>
        </div>

        {/* Context pill */}
        <span style={contextPillStyle}>
          Step {currentStep} • {aspectRatio} • {templateId.toUpperCase()}
        </span>
      </div>

      {/* ---- APPLIED BADGES ---- */}
      {producer.appliedBadges.length > 0 && (
        <div style={appliedBadgesContainerStyle}>
          <div style={badgesRowStyle}>
            {producer.appliedBadges.map((badge) => (
              <span key={badge} style={badgePillStyle}>
                {badge}
              </span>
            ))}
          </div>
          <button type="button" style={undoBtnStyle} onClick={() => producer.undo()}>
            ↩ Undo
          </button>
        </div>
      )}

      {/* ---- MESSAGES AREA ---- */}
      <div className="ai-producer-messages" style={messagesAreaStyle}>

        {/* Welcome message (empty state) */}
        {producer.messages.length === 0 && !producer.isLoading && (
          <div style={welcomeStyle}>
            <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>🤖</span>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
              Halo! Saya AI Producer
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-sub)', lineHeight: 1.6, maxWidth: '260px' }}>
              Ceritakan apa yang ingin Anda ubah di video ini. Contoh: &ldquo;Ganti subtitle ke MrBeast&rdquo;, &ldquo;Tambah B-Roll&rdquo;, atau &ldquo;Bikin hook lebih viral&rdquo;.
            </p>
          </div>
        )}

        {/* Chat bubbles */}
        {producer.messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              {/* Label */}
              <span
                style={{
                  fontSize: '10px',
                  color: isUser ? 'var(--text-sub)' : 'var(--accent)',
                  marginBottom: '3px',
                  textAlign: isUser ? 'right' : 'left',
                }}
              >
                {isUser ? 'Anda' : 'AI Producer'}
              </span>

              {/* Bubble */}
              <div
                style={{
                  background: isUser ? 'var(--accent)' : 'var(--bg-panel)',
                  color: isUser ? 'white' : 'var(--text)',
                  border: isUser ? 'none' : '1px solid var(--border)',
                  borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  padding: '8px 12px',
                  maxWidth: isUser ? '85%' : '90%',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        })}

        {/* Loading bubble */}
        {producer.isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '10px', color: 'var(--accent)', marginBottom: '3px' }}>
              AI Producer
            </span>
            <div
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                borderRadius: '12px 12px 12px 2px',
                padding: '10px 14px',
                fontSize: '13px',
              }}
            >
              <LoadingDots />
            </div>
          </div>
        )}

        {/* Error banner */}
        {producer.error && (
          <div style={errorBannerStyle}>
            ⚠️ {producer.error}
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* ---- QUICK CHIPS ---- */}
      {chipsToShow.length > 0 && (
        <div style={chipsContainerStyle}>
          <p style={{ fontSize: '10px', color: 'var(--text-sub)', marginBottom: '6px' }}>
            Saran cepat
          </p>
          <div style={chipsRowStyle}>
            {chipsToShow.map((chip) => (
              <button
                key={chip}
                type="button"
                style={chipStyle(chip)}
                onMouseEnter={() => setChipHover(chip)}
                onMouseLeave={() => setChipHover(null)}
                onClick={() => handleChipClick(chip)}
                disabled={producer.isLoading}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- CHAT INPUT ---- */}
      <div style={inputAreaStyle}>
        <div style={inputRowStyle}>
          <textarea
            ref={textareaRef}
            style={textareaStyle}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Instruksikan AI Producer..."
            disabled={producer.isLoading}
            rows={1}
            onFocus={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = 'var(--border-focus)';
            }}
            onBlur={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = 'var(--border)';
            }}
          />
          <button
            type="button"
            style={sendBtnStyle}
            onClick={handleSend}
            disabled={producer.isLoading || !inputValue.trim()}
            aria-label="Kirim pesan"
          >
            ➤
          </button>
        </div>

        {/* Reset button */}
        {producer.messages.length > 0 && (
          <button
            type="button"
            style={resetBtnStyle}
            onClick={() => producer.clearMessages()}
          >
            🗑️ Reset percakapan
          </button>
        )}
      </div>
    </div>
  );
};
