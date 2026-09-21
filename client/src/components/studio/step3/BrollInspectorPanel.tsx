import React, { useState, useRef } from 'react';
import type { BrollAssetItem, BrollPlacementItem } from '../../../types';
import { formatTimecode } from '../studioUtils';
import { api } from '../../../services/api';

interface BrollInspectorPanelProps {
  brollPlacements: BrollPlacementItem[];
  loadingBroll: boolean;
  brollError: string | null;
  onRefreshSuggestions: () => void;
  onTogglePlacement: (index: number) => void;
  onUpdatePlacement: (index: number, updates: Partial<BrollPlacementItem>) => void;
  onRemovePlacement: (index: number) => void;
  onAddPlacement: (placement: BrollPlacementItem) => void;
}

export const BrollInspectorPanel: React.FC<BrollInspectorPanelProps> = ({
  brollPlacements,
  loadingBroll,
  brollError,
  onRefreshSuggestions,
  onTogglePlacement,
  onUpdatePlacement,
  onRemovePlacement,
  onAddPlacement,
}) => {
  // Modal states
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BrollAssetItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Video preview modal state
  const [previewAsset, setPreviewAsset] = useState<{ asset: BrollAssetItem; cueQuery: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const openPreviewModal = (asset: BrollAssetItem, cueQuery: string) => {
    setPreviewAsset({ asset, cueQuery });
    setPreviewLoading(true);
    setPreviewError(null);
  };

  // Manual Add state
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualStart, setManualStart] = useState('0');
  const [manualEnd, setManualEnd] = useState('4');
  const [manualQuery, setManualQuery] = useState('');
  const [addingLoading, setAddingLoading] = useState(false);

  const activeCount = brollPlacements.filter((p) => p.enabled !== false).length;

  const handleOpenReplace = (idx: number) => {
    const placement = brollPlacements[idx];
    setReplacingIndex(idx);
    setSearchQuery(placement?.cue.query || '');
    setSearchResults(placement?.candidates || []);
    setSearchError(null);
  };

  const handleSearchFootage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.searchBrollFootage(q, { minDuration: 2, maxResults: 8 });
      setSearchResults(res.assets);
      if (res.assets.length === 0) {
        setSearchError(`Tidak ditemukan footage untuk kata kunci "${q}".`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mencari footage.';
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectReplacement = (asset: BrollAssetItem) => {
    if (replacingIndex === null) return;
    onUpdatePlacement(replacingIndex, { asset });
    setReplacingIndex(null);
  };

  const handleAddManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = parseFloat(manualStart);
    const end = parseFloat(manualEnd);
    const query = manualQuery.trim();

    if (isNaN(start) || isNaN(end) || end <= start) {
      alert('Waktu akhir harus lebih besar dari waktu awal.');
      return;
    }
    if (!query) {
      alert('Ketik kata kunci visual B-roll.');
      return;
    }

    setAddingLoading(true);
    try {
      const res = await api.searchBrollFootage(query, { minDuration: end - start, maxResults: 4 });
      if (res.assets.length === 0) {
        alert(`Tidak menemukan video footage untuk kata kunci "${query}". Coba kata kunci umum seperti: technology, finance, nature.`);
        return;
      }

      const chosen = res.assets[0];
      onAddPlacement({
        id: `manual-${Date.now()}`,
        cue: { start, end, query },
        asset: chosen,
        candidates: res.assets,
        enabled: true,
      });

      setShowAddModal(false);
      setManualQuery('');
    } catch (err) {
      alert('Gagal menambahkan B-roll: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setAddingLoading(false);
    }
  };

  return (
    <div
      className="broll-inspector-panel"
      style={{
        marginTop: '16px',
        background: 'rgba(17, 24, 34, 0.75)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '16px 18px',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: '14px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🎞️</span>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
              Visual B-Roll Cutaway Inspector
            </h4>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '999px',
                background: activeCount > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.08)',
                color: activeCount > 0 ? '#10B981' : 'var(--text-muted)',
                fontWeight: 600,
                border: activeCount > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {activeCount} Aktif / {brollPlacements.length} Terdeteksi
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Pratinjau visual footage yang akan disisipkan ke video output. Anda dapat meninjau gerakan video, mematikan/menyalakan klip, atau mengganti dengan footage lain.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn ghost"
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={loadingBroll}
            onClick={onRefreshSuggestions}
            title="Analisis ulang dialog dan cari footage baru"
          >
            {loadingBroll ? '⏳ Memindai…' : '✨ Pindai Ulang'}
          </button>
          <button
            type="button"
            className="btn outline"
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowAddModal(true)}
          >
            + Tambah B-Roll
          </button>
        </div>
      </div>

      {brollError && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: '14px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#FCA5A5',
            fontSize: '12px',
          }}
        >
          ⚠️ {brollError}
        </div>
      )}

      {/* Empty State */}
      {brollPlacements.length === 0 && !loadingBroll && (
        <div
          style={{
            textAlign: 'center',
            padding: '28px 16px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '8px',
            border: '1px dashed var(--border)',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎬</div>
          <p style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: 500, margin: '0 0 4px' }}>
            Belum ada footage B-Roll yang terdaftar
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>
            Pindai dialog video untuk mendeteksi momen visual yang cocok disisipkan B-roll footage.
          </p>
          <button
            type="button"
            className="btn primary"
            style={{ fontSize: '12.5px', padding: '8px 16px' }}
            onClick={onRefreshSuggestions}
          >
            ✨ Deteksi B-Roll Sekarang
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loadingBroll && brollPlacements.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: '18px', marginBottom: '6px' }}>⏳</div>
          <p style={{ fontSize: '12.5px', color: 'var(--ice)' }}>
            Menganalisis dialog & mencari footage video relevan…
          </p>
        </div>
      )}

      {/* Multi-select info bar (matching Step 2 clip recommendation style) */}
      {brollPlacements.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            marginBottom: '16px',
            background: 'rgba(50, 130, 184, 0.08)',
            border: '1px solid rgba(50, 130, 184, 0.2)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            color: '#94A3B8',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            💡 <strong style={{ color: '#BBE1FA' }}>Klik kartu B-roll untuk memilih</strong>
            <span>(B-roll terpilih akan disisipkan ke video master)</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeCount > 0 && (
              <span style={{ color: '#A3E635', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {activeCount} dari {brollPlacements.length} B-roll dipilih
              </span>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn ghost small"
                style={{ fontSize: '11px', padding: '3px 8px', height: 'auto' }}
                onClick={() => {
                  brollPlacements.forEach((p, i) => {
                    if (p.enabled === false) onTogglePlacement(i);
                  });
                }}
                title="Aktifkan semua B-roll"
              >
                Pilih Semua
              </button>
              {activeCount > 0 && (
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', color: '#EF4444' }}
                  onClick={() => {
                    brollPlacements.forEach((p, i) => {
                      if (p.enabled !== false) onTogglePlacement(i);
                    });
                  }}
                  title="Matikan semua pilihan B-roll"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* B-Roll Cards Grid */}
      {brollPlacements.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '14px',
          }}
        >
          {brollPlacements.map((placement, idx) => {
            const isEnabled = placement.enabled !== false;
            const duration = (placement.cue.end - placement.cue.start).toFixed(1);

            return (
              <BrollPlacementCard
                key={placement.id || `broll-${idx}`}
                index={idx}
                placement={placement}
                isEnabled={isEnabled}
                duration={duration}
                onToggle={() => onTogglePlacement(idx)}
                onOpenReplace={() => handleOpenReplace(idx)}
                onRemove={() => onRemovePlacement(idx)}
                onPreview={() => openPreviewModal(placement.asset, placement.cue.query)}
              />
            );
          })}
        </div>
      )}

      {/* REPLACE FOOTAGE MODAL */}
      {replacingIndex !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setReplacingIndex(null)}
        >
          <div
            style={{
              background: '#111822',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#FFFFFF', fontWeight: 600 }}>
                  🔄 Pilih Footage Pengganti B-Roll
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Slot: {formatTimecode(brollPlacements[replacingIndex]?.cue.start || 0)} -{' '}
                  {formatTimecode(brollPlacements[replacingIndex]?.cue.end || 0)}
                </p>
              </div>
              <button
                type="button"
                className="btn ghost"
                style={{ padding: '4px 8px', fontSize: '14px' }}
                onClick={() => setReplacingIndex(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {/* Search Bar */}
              <form onSubmit={handleSearchFootage} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kata kunci footage (contoh: crypto, office, crowd, mountain)…"
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
                <button
                  type="submit"
                  className="btn primary"
                  disabled={searching}
                  style={{ fontSize: '12.5px', padding: '8px 16px' }}
                >
                  {searching ? '🔍 Mencari…' : 'Cari'}
                </button>
              </form>

              {searchError && (
                <div
                  style={{
                    padding: '8px 12px',
                    marginBottom: '14px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#FCA5A5',
                    fontSize: '12px',
                  }}
                >
                  ⚠️ {searchError}
                </div>
              )}

              {/* Footage Candidates Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: '12px',
                }}
              >
                {searchResults.map((asset, aIdx) => {
                  const isCurrent = asset.downloadUrl === brollPlacements[replacingIndex]?.asset.downloadUrl;

                  return (
                    <div
                      key={asset.id || aIdx}
                      style={{
                        background: isCurrent ? 'rgba(50, 130, 184, 0.18)' : 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        border: isCurrent ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          aspectRatio: '16/9',
                          background: '#000',
                          cursor: 'pointer',
                        }}
                        onClick={() => openPreviewModal(asset, searchQuery)}
                      >
                        <img
                          src={asset.previewUrl}
                          alt="Broll thumbnail"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '4px',
                            right: '6px',
                            fontSize: '10px',
                            background: 'rgba(0,0,0,0.7)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        >
                          {asset.durationSeconds.toFixed(1)}s
                        </div>
                        <div
                          style={{
                            position: 'absolute',
                            top: '4px',
                            left: '6px',
                            fontSize: '9.5px',
                            background: 'rgba(15, 76, 117, 0.8)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            color: 'var(--ice)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {asset.source}
                        </div>
                      </div>

                      <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          ID: {asset.id.slice(0, 12)}…
                        </div>
                        <button
                          type="button"
                          className={isCurrent ? 'btn ghost' : 'btn primary'}
                          style={{
                            width: '100%',
                            fontSize: '11.5px',
                            padding: '6px',
                            fontWeight: 600,
                          }}
                          disabled={isCurrent}
                          onClick={() => handleSelectReplacement(asset)}
                        >
                          {isCurrent ? '✓ Sedang Digunakan' : 'Gunakan Ini'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ADD B-ROLL MODAL */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: '#111822',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '480px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#FFFFFF', fontWeight: 600 }}>
                ➕ Tambah Sisipan B-Roll Manual
              </h3>
              <button
                type="button"
                className="btn ghost"
                style={{ padding: '4px 8px', fontSize: '14px' }}
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddManualSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Waktu Mulai (detik)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={manualStart}
                    onChange={(e) => setManualStart(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#fff',
                      fontSize: '13px',
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Waktu Selesai (detik)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={manualEnd}
                    onChange={(e) => setManualEnd(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#fff',
                      fontSize: '13px',
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Konsep Visual / Kata Kunci Pencarian
                </label>
                <input
                  type="text"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  placeholder="Contoh: technology coding, stock market, crowd cheering…"
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={addingLoading}
                >
                  {addingLoading ? '🔍 Mencari Footage…' : 'Cari & Tambahkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL VIDEO PREVIEW MODAL */}
      {previewAsset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setPreviewAsset(null)}
        >
          <div
            style={{
              background: '#0D131A',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              maxWidth: '640px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>▶️</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                  Pratinjau B-Roll: &quot;{previewAsset.cueQuery}&quot;
                </span>
              </div>
              <button
                type="button"
                className="btn ghost"
                style={{ padding: '2px 6px', fontSize: '13px' }}
                onClick={() => setPreviewAsset(null)}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                background: '#000',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '260px',
                position: 'relative',
              }}
            >
              {previewLoading && !previewError && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.7)',
                    zIndex: 2,
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      border: '3px solid rgba(255,255,255,0.2)',
                      borderTopColor: 'var(--accent, #00ADB5)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#ccc' }}>Memuat video pratinjau...</span>
                </div>
              )}

              {previewError ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', maxWidth: '460px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={previewAsset.asset.previewUrl}
                    alt={previewAsset.cueQuery}
                    style={{ width: '200px', height: '112px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <div style={{ fontSize: '13px', color: '#ff6b6b', fontWeight: 600 }}>⚠️ {previewError}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Sumber video remote tidak dapat diputar langsung oleh browser. Anda tetap dapat menggunakan footage ini atau memilih alternatif lain.
                  </div>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={() => {
                      setPreviewError(null);
                      setPreviewLoading(true);
                    }}
                  >
                    🔄 Coba Muat Ulang
                  </button>
                </div>
              ) : (
                <video
                  key={resolveBrollVideoUrl(previewAsset.asset)}
                  src={resolveBrollVideoUrl(previewAsset.asset)}
                  controls
                  autoPlay
                  playsInline
                  loop
                  onLoadStart={() => setPreviewLoading(true)}
                  onLoadedData={() => {
                    setPreviewLoading(false);
                    setPreviewError(null);
                  }}
                  onCanPlay={() => setPreviewLoading(false)}
                  onError={() => {
                    setPreviewLoading(false);
                    setPreviewError('Video tidak dapat diputar. Sumber video tidak merespons atau format tidak didukung.');
                  }}
                  style={{ maxHeight: '60vh', width: '100%', objectFit: 'contain' }}
                />
              )}
            </div>
            <div
              style={{
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
              }}
            >
              <span>Sumber: {previewAsset.asset.source.toUpperCase()}</span>
              <span>Durasi: {previewAsset.asset.durationSeconds.toFixed(1)} detik</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Normalizes B-roll video playback URL, ensuring local stock files and direct video URLs work seamlessly. */
export function resolveBrollVideoUrl(asset: BrollAssetItem): string {
  if (asset.downloadUrl?.startsWith('/stock-broll/')) {
    return asset.downloadUrl;
  }
  if (asset.source === 'local' || asset.downloadUrl?.includes('commondatastorage.googleapis.com')) {
    return `/stock-broll/${asset.id}.mp4`;
  }
  if (asset.downloadUrl && !asset.downloadUrl.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i)) {
    return asset.downloadUrl;
  }
  return `/stock-broll/${asset.id}.mp4`;
}

interface BrollPlacementCardProps {
  index: number;
  placement: BrollPlacementItem;
  isEnabled: boolean;
  duration: string;
  onToggle: () => void;
  onOpenReplace: () => void;
  onRemove: () => void;
  onPreview: () => void;
}

const BrollPlacementCard: React.FC<BrollPlacementCardProps> = ({
  index,
  placement,
  isEnabled,
  duration,
  onToggle,
  onOpenReplace,
  onRemove,
  onPreview,
}) => {
  const [hovering, setHovering] = useState(false);
  const [hoverError, setHoverError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleMouseEnter = () => {
    setHovering(true);
    setHoverError(false);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className={`opus-clip-card ${isEnabled ? 'selected' : ''}`}
      onClick={onToggle}
      style={{
        padding: '10px 10px 14px',
        opacity: isEnabled ? 1 : 0.72,
        transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 16:9 Video Preview Frame */}
      <div
        className="opus-clip-preview"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#090D12',
          cursor: 'pointer',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        title="Klik untuk pratinjau penuh video B-roll"
      >
        {/* Ambient blurred background */}
        <div
          className="opus-clip-bg-blur"
          style={{
            backgroundImage: `url(${placement.asset.previewUrl})`,
          }}
        />

        {/* Poster Image */}
        <img
          src={placement.asset.previewUrl}
          alt={placement.cue.query}
          className="opus-clip-thumbnail"
          style={{
            display: hovering && !hoverError ? 'none' : 'block',
          }}
        />

        {/* Hover Silent Video Preview */}
        <video
          ref={videoRef}
          src={resolveBrollVideoUrl(placement.asset)}
          muted
          playsInline
          loop
          preload="metadata"
          className="opus-clip-video-element"
          style={{
            display: hovering && !hoverError ? 'block' : 'none',
          }}
          onError={() => setHoverError(true)}
        />

        {/* Top Badges (Selected Pill & Live Hover Status) */}
        <div className="opus-clip-top-badges">
          {isEnabled ? (
            <div className="opus-clip-selected-badge">
              <span style={{ fontWeight: 800, fontSize: '11px' }}>✓</span>
              <span>B-Roll #{index + 1} Terpilih</span>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.72)',
                color: '#94A3B8',
                fontSize: '10.5px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '9999px',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>○</span>
              <span>Dilewati</span>
            </div>
          )}
          {hovering && !hoverError && (
            <div className="opus-clip-live-badge">
              <span className="live-dot" />
              <span>Preview</span>
            </div>
          )}
        </div>

        {/* Bottom-Right Time Range Badge */}
        <div className="opus-clip-time-badge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>{duration}s</span>
          <span className="badge-divider">•</span>
          <span className="badge-range">{formatTimecode(placement.cue.start)} - {formatTimecode(placement.cue.end)}</span>
        </div>

        {/* Interactive Play/Preview Button Overlay */}
        <div
          className={`opus-clip-play-overlay ${hovering ? 'is-playing' : ''}`}
          style={{ opacity: hovering ? 1 : 0.35 }}
        >
          <div className="opus-clip-play-circle" title="Buka Pratinjau Penuh">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
        </div>
      </div>

      {/* Card Info & Visual Query */}
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
            Visual Cue #{index + 1}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {placement.cue.mood && (
              <span
                style={{
                  fontSize: '9.5px',
                  background: 'rgba(255, 255, 255, 0.07)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: '#CBD5E1',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.4px',
                }}
              >
                {placement.cue.mood}
              </span>
            )}
            <span
              style={{
                fontSize: '9.5px',
                background: 'rgba(50, 130, 184, 0.15)',
                color: '#BBE1FA',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {placement.asset.source || 'pexels'}
            </span>
          </div>
        </div>

        <h4
          style={{
            margin: '4px 0 0',
            fontSize: '13px',
            fontWeight: 600,
            color: isEnabled ? '#FFFFFF' : '#94A3B8',
            textTransform: 'capitalize',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={placement.cue.query}
        >
          &quot;{placement.cue.query}&quot;
        </h4>
      </div>

      {/* Action Buttons: Pilih B-Roll, Ganti & Hapus */}
      <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
        <button
          type="button"
          className={`btn ${isEnabled ? 'primary' : 'ghost'} small`}
          style={{
            flex: 1,
            fontWeight: 700,
            fontSize: '11.5px',
            padding: '7px 10px',
            ...(isEnabled
              ? {
                  background: '#A3E635',
                  color: '#000000',
                  borderColor: '#A3E635',
                  boxShadow: '0 2px 8px rgba(163, 230, 53, 0.3)',
                }
              : {
                  color: '#94A3B8',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isEnabled ? `✓ B-Roll #${index + 1} Terpilih` : 'Pilih B-Roll Ini'}
        </button>
        <button
          type="button"
          className="btn ghost small"
          title="Ganti footage dengan alternatif lain"
          style={{
            padding: '6px 10px',
            fontSize: '11.5px',
            color: '#BBE1FA',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenReplace();
          }}
        >
          🔄 Ganti
        </button>
        <button
          type="button"
          className="btn ghost small"
          title="Hapus B-roll ini"
          style={{
            padding: '6px 8px',
            fontSize: '11.5px',
            color: '#EF4444',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
};
