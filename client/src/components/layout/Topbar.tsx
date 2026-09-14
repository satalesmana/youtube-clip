import React from 'react';

interface TopbarProps {
  breadcrumb: string;
  isOnline: boolean | null;
  onToggleMobileSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  breadcrumb,
  isOnline,
  onToggleMobileSidebar,
}) => {
  return (
    <header className="opus-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="btn-mobile-sidebar"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle menu"
        >
          Menu
        </button>
        <div className="topbar-breadcrumb">
          <span>Studio</span>
          <span>/</span>
          <strong>{breadcrumb}</strong>
        </div>
      </div>

      <div className="topbar-right">
        <div
          className={`status-pill ${
            isOnline === true ? 'online' : isOnline === false ? 'offline' : ''
          }`}
          id="status-pill"
        >
          <span className="dot"></span>
          <span>
            {isOnline === true
              ? 'Sistem Siap'
              : isOnline === false
              ? 'Terputus'
              : 'Memeriksa...'}
          </span>
        </div>
      </div>
    </header>
  );
};
