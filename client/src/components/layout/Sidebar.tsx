import React from 'react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
}) => {
  return (
    <aside className={`opus-sidebar ${collapsed ? 'collapsed' : ''}`} id="opus-sidebar">
      {/* Top Brand */}
      <div className="sidebar-top">
        <div
          className="sidebar-brand"
          onClick={() => onSelectTab('home')}
          title="Viral Clip Studio"
        >
          <div className="brand-icon-mark">✨</div>
          <div className="brand-name">
            Viral Clip <span>Studio</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Perluas menu' : 'Sembunyikan menu'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav" role="tablist">
        <button
          className={`sidebar-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onSelectTab('home')}
        >
          <span className="item-icon">🏠</span>
          <span className="item-text">Beranda</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'transform' ? 'active' : ''}`}
          onClick={() => onSelectTab('transform')}
        >
          <span className="item-icon">✂️</span>
          <span className="item-text">Studio Klip</span>
          <span className="sidebar-pill-badge">9:16</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'research' ? 'active' : ''}`}
          onClick={() => onSelectTab('research')}
        >
          <span className="item-icon">📡</span>
          <span className="item-text">Radar Tren Viral</span>
          <span className="sidebar-badge-new">Live</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => onSelectTab('history')}
        >
          <span className="item-icon">📁</span>
          <span className="item-text">Proyek Saya</span>
        </button>
      </nav>
    </aside>
  );
};
