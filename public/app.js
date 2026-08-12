/* Viral Clip Studio — frontend logic. */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = {
    templates: [],
    currentJob: null,
  };

  /* ---------- Utilities ---------- */
  function esc(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtViews(n) {
    if (n == null || Number.isNaN(n)) return '';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}rb`;
    return String(n);
  }

  function fmtDuration(sec) {
    if (sec == null || Number.isNaN(sec)) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function extractVideoId(input) {
    // Handle full URL or raw video ID
    if (input.startsWith('http')) {
      const match = input.match(/[?&]v=([^&]+)/);
      return match ? match[1] : null;
    }
    // Assume it's a video ID
    return input.length >= 10 ? input : null;
  }

  let toastTimer = null;
  function toast(message, type = '') {
    const el = $('#toast');
    el.textContent = message;
    el.className = `toast ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  function setProgress(section, visible, pct = 0, label = '') {
    const wrap = $(`#${section}-progress`);
    if (!wrap) return;
    wrap.classList.toggle('hidden', !visible);
    if (!visible) return;
    $(`#${section}-progress-fill`).style.width = `${pct}%`;
    if (label) $(`#${section}-progress-label`).textContent = label;
  }

  function setStageStatus(stageId, status) {
    const stage = $(`.stage[data-stage="${stageId}"]`);
    if (!stage) return;
    const icon = stage.querySelector('.stage-icon');
    const statusEl = stage.querySelector('.stage-status');
    if (status === 'pending') {
      icon.textContent = '⏳';
      statusEl.textContent = 'Menunggu';
      stage.classList.remove('active', 'done', 'error');
    } else if (status === 'running') {
      icon.textContent = '🔄';
      statusEl.textContent = 'Proses…';
      stage.classList.add('active');
      stage.classList.remove('done', 'error');
    } else if (status === 'done') {
      icon.textContent = '✅';
      statusEl.textContent = 'Selesai';
      stage.classList.add('done');
      stage.classList.remove('active', 'error');
    } else if (status === 'error') {
      icon.textContent = '❌';
      statusEl.textContent = 'Gagal';
      stage.classList.add('error');
      stage.classList.remove('active', 'done');
    }
  }

  async function apiGet(path) {
    const res = await fetch(path);
    if (!res.ok) {
      const msg = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(msg);
    }
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const msg = data?.message || data?.data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function downloadFile(url, fallbackName) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackName || '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- Tabs ---------- */
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tab.dataset.tab}`));
      if (tab.dataset.tab === 'history') loadHistory();
      if (tab.dataset.tab === 'rights') resetRightsView();
    });
  });

  /* ---------- Status Pill ---------- */
  async function checkHealth() {
    const pill = $('#status-pill');
    const text = $('#status-text');
    try {
      await apiGet('/api/health');
      pill.className = 'status-pill online';
      text.textContent = 'Online';
    } catch {
      pill.className = 'status-pill offline';
      text.textContent = 'Offline';
    }
  }

  /* ---------- Templates ---------- */
  async function loadTemplates() {
    try {
      const res = await apiGet('/api/templates');
      state.templates = Array.isArray(res) ? res : res?.templates || [];
      const sel = $('#transform-template');
      sel.innerHTML = '<option value="">(default)</option>' +
        state.templates.map((t) => `<option value="${esc(t.id)}">${esc(t.name || t.id)}</option>`).join('');
    } catch { /* templates optional */ }
  }

  /* ---------- Transform Pipeline ---------- */
  $('#btn-transform').addEventListener('click', async () => {
    const url = $('#transform-url').value.trim();
    if (!url) {
      toast('Masukkan URL YouTube dulu', 'error');
      $('#transform-url').focus();
      return;
    }

    const btn = $('#btn-transform');
    btn.disabled = true;
    $('#transform-results').classList.add('hidden');
    $('#transform-error').classList.add('hidden');
    $('#transform-stages').classList.remove('hidden');

    // Reset stages
    ['transcript', 'angle', 'script', 'tts', 'plan', 'render'].forEach(s => setStageStatus(s, 'pending'));
    setProgress('transform', true, 5, 'Memulai transformasi…');

    try {
      const videoId = extractVideoId(url);
      const body = {
        url,
        template: $('#transform-template').value || undefined,
        engine: $('#transform-engine').value || 'ffmpeg-template',
        language: $('#transform-language').value || 'id',
        voice: $('#transform-voice').value || undefined,
        channelName: $('#transform-channel').value.trim() || undefined,
        rightsGate: $('#transform-rights-gate').checked,
        qualityCheck: $('#transform-quality-check').checked,
      };

      setStageStatus('transcript', 'running');
      setProgress('transform', true, 15, 'Mengunduh video & transkripsi (Whisper)…');

      setStageStatus('angle', 'running');
      setProgress('transform', true, 30, 'Analisis angle viral dengan AI…');

      setStageStatus('script', 'running');
      setProgress('transform', true, 45, 'Menulis script orisinal…');

      setStageStatus('tts', 'running');
      setProgress('transform', true, 60, 'Synthesis TTS (narasi)…');

      setStageStatus('plan', 'running');
      setProgress('transform', true, 75, 'Membuat video plan…');

      setStageStatus('render', 'running');
      setProgress('transform', true, 90, 'Rendering video…');

      const data = await apiPost('/api/transform', body);

      setProgress('transform', false);
      setStageStatus('render', 'done');
      renderTransformResult(data);
    } catch (error) {
      setProgress('transform', false);
      $('#transform-error').classList.remove('hidden');
      $('#transform-error-msg').textContent = error.message;
    } finally {
      btn.disabled = false;
    }
  });

  function renderTransformResult(data) {
    const list = $('#transform-list');
    list.innerHTML = '';

    const result = data.result || data;
    if (!result) {
      toast('Tidak ada hasil transform', 'error');
      return;
    }

    // Show stages as done
    ['transcript', 'angle', 'script', 'tts', 'plan', 'render'].forEach(s => setStageStatus(s, 'done'));

    // Create result card
    const card = document.createElement('div');
    card.className = 'transform-result';

    const videoUrl = result.outputVideo || '';
    const narrationUrl = result.narration?.outputPath || '';
    const scriptData = result.script || {};
    const angleData = result.angle || {};

    card.innerHTML = `
      <div class="transform-head">
        <div class="transform-video">
          ${videoUrl ? `<video src="${esc(videoUrl)}" controls preload="metadata"></video>` : '<div class="video-placeholder">🎬</div>'}
        </div>
        <div class="transform-info">
          <div class="transform-title">✨ Transform Berhasil</div>
          <div class="transform-meta">
            ${result.jobId ? `<span class="chip">Job: ${esc(result.jobId.slice(0, 8))}…</span>` : ''}
            ${result.duration ? `<span class="chip">${fmtDuration(result.duration)}</span>` : ''}
            ${result.engine ? `<span class="chip">${esc(result.engine)}</span>` : ''}
          </div>
          ${scriptData.title ? `<div class="transform-script-title">${esc(scriptData.title)}</div>` : ''}
          ${angleData.selectedAngle ? `<div class="transform-angle">Angle: ${esc(angleData.selectedAngle.title || angleData.selectedAngle.id)}</div>` : ''}
          <div class="transform-actions">
            ${videoUrl ? `<button class="btn ghost small" data-action="download" data-url="${esc(videoUrl)}" data-name="transformed.mp4">⬇️ Unduh MP4</button>` : ''}
            ${narrationUrl ? `<button class="btn ghost small" data-action="download" data-url="${esc(narrationUrl)}" data-name="narration.mp3">🔊 Unduh MP3</button>` : ''}
            ${videoUrl ? `<button class="btn ghost small" data-action="copy" data-url="${esc(videoUrl)}">🔗 Salin</button>` : ''}
          </div>
        </div>
      </div>
      ${scriptData.sections?.length ? `
      <div class="transform-script">
        <div class="script-header">📝 Script</div>
        ${scriptData.sections.map(s => `
          <div class="script-section">
            <span class="section-badge ${esc(s.type)}">${esc(s.type)}</span>
            <span class="section-text">${esc(s.text)}</span>
          </div>
        `).join('')}
      </div>` : ''}
      ${angleData.candidates?.length ? `
      <div class="transform-angles">
        <div class="angles-header">💡 Angle Candidates</div>
        ${angleData.candidates.slice(0, 3).map(a => `
          <div class="angle-item ${a.id === angleData.selectedAngleId ? 'selected' : ''}">
            <div class="angle-score">${a.score || '?'}</div>
            <div class="angle-title">${esc(a.title || a.id)}</div>
            ${a.id === angleData.selectedAngleId ? '<span class="angle-badge">✓ Selected</span>' : ''}
          </div>
        `).join('')}
      </div>` : ''}
    `;

    list.appendChild(card);
    $('#transform-results').classList.remove('hidden');
    $('#transform-meta').textContent = '1 job selesai';
    toast('Transformasi berhasil!', 'success');
  }

  /* ---------- Rights & Quality ---------- */
  function resetRightsView() {
    $('#rights-result').classList.add('hidden');
    $('#quality-result').classList.add('hidden');
  }

  $('#btn-check-rights').addEventListener('click', async () => {
    const videoId = $('#rights-video-id').value.trim();
    if (!videoId) {
      toast('Masukkan Video ID', 'error');
      return;
    }

    try {
      const data = await apiGet(`/api/rights/${videoId}`);
      $('#rights-result').classList.remove('hidden');
      $('#rights-meta').textContent = `Video: ${videoId}`;
      renderRightsResult(data);
    } catch (error) {
      toast(`Rights check failed: ${error.message}`, 'error');
    }
  });

  function renderRightsResult(data) {
    const content = $('#rights-content');
    content.innerHTML = '';

    const status = data.status || 'UNKNOWN';
    const statusColor = status === 'AUTHORIZED' || status === 'LICENSED' || status === 'CC' || status === 'PD'
      ? 'var(--green)' : status === 'REJECTED' ? 'var(--accent)' : 'var(--accent-2)';

    const card = document.createElement('div');
    card.className = 'rights-card';
    card.innerHTML = `
      <div class="rights-header">
        <div class="rights-status" style="color: ${statusColor}">${status}</div>
        <div class="rights-source">${esc(data.sourceId || '')}</div>
      </div>
      <div class="rights-details">
        ${data.approvedBy ? `<div class="rights-field"><span class="field-label">Approved by:</span> <span class="field-value">${esc(data.approvedBy)}</span></div>` : ''}
        ${data.approvedAt ? `<div class="rights-field"><span class="field-label">Approved at:</span> <span class="field-value">${esc(new Date(data.approvedAt).toLocaleString('id-ID'))}</span></div>` : ''}
        ${data.notes ? `<div class="rights-field"><span class="field-label">Notes:</span> <span class="field-value">${esc(data.notes)}</span></div>` : ''}
      </div>
      <div class="rights-actions">
        <button class="btn ghost small" data-action="approve" data-id="${esc(data.sourceId)}">✅ Approve</button>
        <button class="btn ghost small" data-action="reject" data-id="${esc(data.sourceId)}">❌ Reject</button>
      </div>
    `;
    content.appendChild(card);
    $('#rights-meta').textContent = data.canPublish ? '✓ Dapat dipublikasikan' : '⚠️ Perlu review';
  }

  $('#btn-check-quality').addEventListener('click', async () => {
    const videoId = $('#rights-video-id').value.trim();
    if (!videoId) {
      toast('Masukkan Video ID', 'error');
      return;
    }

    try {
      const data = await apiPost('/api/quality-check', { videoId });
      $('#quality-result').classList.remove('hidden');
      $('#quality-meta').textContent = `Video: ${videoId}`;
      renderQualityResult(data);
    } catch (error) {
      toast(`Quality check failed: ${error.message}`, 'error');
    }
  });

  function renderQualityResult(data) {
    const content = $('#quality-content');
    content.innerHTML = '';

    const status = data.status || 'UNKNOWN';
    const statusColor = status === 'PASS' ? 'var(--green)' : 'var(--accent)';

    const card = document.createElement('div');
    card.className = 'quality-card';
    card.innerHTML = `
      <div class="quality-header">
        <div class="quality-status" style="color: ${statusColor}">${status}</div>
        ${data.videoPath ? `<div class="quality-path">${esc(data.videoPath)}</div>` : ''}
      </div>
      <div class="quality-checks">
        ${(data.checks || []).map(check => `
          <div class="quality-check ${check.passed ? 'passed' : 'failed'}">
            <span class="check-icon">${check.passed ? '✅' : '❌'}</span>
            <span class="check-name">${esc(check.name)}</span>
            ${check.warning ? `<span class="check-warning">${esc(check.warning)}</span>` : ''}
            ${check.metadata ? `<span class="check-metadata">${esc(JSON.stringify(check.metadata))}</span>` : ''}
          </div>
        `).join('')}
      </div>
      ${data.warnings?.length ? `<div class="quality-warnings">⚠️ ${data.warnings.join(', ')}</div>` : ''}
      ${data.failures?.length ? `<div class="quality-failures">❌ ${data.failures.join(', ')}</div>` : ''}
    `;
    content.appendChild(card);
  }

  /* ---------- History ---------- */
  async function loadHistory() {
    const list = $('#history-list');
    try {
      const res = await fetch('/api/history');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.clips || data || [];
      if (!items.length) {
        list.innerHTML = '<p class="muted">Belum ada riwayat.</p>';
        return;
      }
      list.innerHTML = items.slice().reverse().map((c) => `
        <div class="history-item">
          <div>
            <div class="h-title">${esc(c.title || c.video || 'Transform')}</div>
            <div class="h-meta">${esc(c.video || c.outputVideo || '')}</div>
          </div>
          <div style="display:flex;gap:6px">
            ${c.outputVideo ? `<button class="btn ghost small" data-action="download" data-url="${esc(c.outputVideo)}">⬇️</button>` : ''}
          </div>
        </div>`).join('');
    } catch {
      list.innerHTML = '<p class="muted">Tidak bisa membaca riwayat.</p>';
    }
  }

  /* ---------- Delegated actions ---------- */
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const { action, url, id, name } = btn.dataset;

    if (action === 'copy') {
      if (url) {
        copyText(url).then((ok) => {
          if (ok) toast('Disalin ke clipboard ✓', 'success');
          else toast('Gagal menyalin — coba manual', 'error');
        });
      }
    } else if (action === 'download') {
      downloadFile(url, name);
    } else if (action === 'approve') {
      updateRights(id, 'AUTHORIZED');
    } else if (action === 'reject') {
      updateRights(id, 'REJECTED');
    }
  });

  async function updateRights(videoId, status) {
    try {
      await apiPost(`/api/rights/${videoId}`, { status, updatedBy: 'web-ui' });
      toast(`Rights updated to ${status}`, 'success');
      // Refresh rights view if visible
      if (!$('#rights-result').classList.contains('hidden')) {
        const data = await apiGet(`/api/rights/${videoId}`);
        renderRightsResult(data);
      }
    } catch (error) {
      toast(`Failed to update rights: ${error.message}`, 'error');
    }
  }

  function copyText(text) {
    return new Promise((resolve) => {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          () => resolve(true),
          () => resolve(copyTextLegacy(text)),
        );
      } else {
        resolve(copyTextLegacy(text));
      }
    });
  }

  function copyTextLegacy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  /* ---------- Init ---------- */
  checkHealth();
  loadTemplates();
})();
