import { useState } from 'react';
import { CaptionModal } from './components/history/CaptionModal';
import { HistoryView } from './components/history/HistoryView';
import { HomeView } from './components/home/HomeView';
import { FloatingQuestions } from './components/layout/FloatingQuestions';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { ResearchView } from './components/research/ResearchView';
import { StudioView } from './components/studio/StudioView';
import { useClipTransform } from './hooks/useClipTransform';
import { useHealth } from './hooks/useHealth';
import { useHistory } from './hooks/useHistory';
import { useViralResearch } from './hooks/useViralResearch';

const TAB_BREADCRUMBS: Record<string, string> = {
  home: 'Beranda',
  transform: 'Studio Pemotongan Klip',
  research: 'Radar Riset Tren Viral',
  history: 'Proyek Saya',
};

export function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Video preview player modal
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // Caption modal state
  const [captionModalData, setCaptionModalData] = useState<{ videoId: string; title: string } | null>(null);

  // Business logic hooks
  const { isOnline } = useHealth();
  const { history, loading: loadingHistory, refresh: refreshHistory } = useHistory();
  const research = useViralResearch();
  const transform = useClipTransform();

  const handleNavigateTab = (tab: string) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
    if (tab === 'history' || tab === 'home') {
      refreshHistory();
    }
  };

  const handleStartClipsFromUrl = async (targetUrl: string) => {
    transform.setUrl(targetUrl);
    setActiveTab('transform');
    try {
      await transform.startDownloadVideo(targetUrl);
    } catch {
      // Error handled in hook
    }
  };

  return (
    <div className="opus-app-shell">
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="opus-sidebar-backdrop open"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={mobileSidebarOpen ? 'opus-sidebar-open-wrap' : ''}>
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleNavigateTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main Content Wrapper */}
      <div className="opus-main-wrapper">
        <Topbar
          breadcrumb={TAB_BREADCRUMBS[activeTab] || 'WORKSPACE'}
          isOnline={isOnline}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        <main className="opus-main-content">
          {activeTab === 'home' && (
            <HomeView
              onStartClips={handleStartClipsFromUrl}
              onNavigateTab={handleNavigateTab}
              recentProjects={history}
              onPlayVideo={(url) => setPreviewVideoUrl(url)}
            />
          )}

          {activeTab === 'transform' && (
            <StudioView
              transform={transform}
              onOpenCaptionModal={(videoId, title) =>
                setCaptionModalData({ videoId, title })
              }
            />
          )}

          {activeTab === 'research' && (
            <ResearchView
              research={research}
              onSelectVideoForClip={handleStartClipsFromUrl}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              history={history}
              loading={loadingHistory}
              onOpenCaptionModal={(videoId, title) =>
                setCaptionModalData({ videoId, title })
              }
              onPlayVideo={(url) => setPreviewVideoUrl(url)}
              onNavigateTab={handleNavigateTab}
            />
          )}
        </main>

        <footer className="footer" style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-sub)' }}>
          <p>© {new Date().getFullYear()} Viral Clip Studio — Ditenagai AI & Remotion Engine (1080x1920 60FPS)</p>
        </footer>
      </div>

      {/* Floating Questions Help Pill */}
      <FloatingQuestions />

      {/* Caption Modal */}
      {captionModalData && (
        <CaptionModal
          videoId={captionModalData.videoId}
          videoTitle={captionModalData.title}
          onClose={() => setCaptionModalData(null)}
        />
      )}

      {/* Video Preview Modal */}
      {previewVideoUrl && (
        <div className="modal-backdrop" onClick={() => setPreviewVideoUrl(null)}>
          <div
            className="modal-window"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px', padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>🎬 Pratinjau Video Master</span>
              <button
                type="button"
                className="modal-close-btn"
                style={{ position: 'static', padding: '2px 8px' }}
                onClick={() => setPreviewVideoUrl(null)}
                title="Tutup"
              >
                ✕
              </button>
            </div>
            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
