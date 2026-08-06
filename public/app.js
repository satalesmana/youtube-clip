/* Viral Clip Studio — frontend logic. */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = { templates: [] };

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

  async function api(path, body) {
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
    });
  });

  /* ---------- Server status ---------- */
  async function checkServer() {
    try {
      const res = await fetch('/api/research', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
      // Even an error response proves the server is up.
      const pill = $('#server-status');
      pill.classList.add('online');
      pill.classList.remove('offline');
      $('#status-text').textContent = res.ok ? 'online' : 'online';
    } catch {
      const pill = $('#server-status');
      pill.classList.add('offline');
      pill.classList.remove('online');
      $('#status-text').textContent = 'offline';
    }
  }

  /* ---------- Templates ---------- */
  async function loadTemplates() {
    try {
      const res = await fetch('/api/templates');
      if (!res.ok) return;
      const data = await res.json();
      state.templates = Array.isArray(data) ? data : data?.templates || [];
      const sel = $('#clip-template');
      sel.innerHTML = '<option value="">(default)</option>' +
        state.templates.map((t) => `<option value="${esc(t.id)}">${esc(t.name || t.id)}</option>`).join('');
    } catch { /* templates optional */ }
  }

  /* ---------- Research ---------- */
  $('#btn-research').addEventListener('click', async () => {
    const btn = $('#btn-research');
    btn.disabled = true;
    $('#research-results').classList.add('hidden');
    $('#research-error').classList.add('hidden');
    setProgress('research', true, 8, 'Mengumpulkan sinyal dari RSS, Reddit, Trends & X…');

    try {
      const body = {
        max_trends: Number($('#res-max-trends').value) || 10,
        language: $('#res-language').value,
      };
      const subs = $('#res-subreddits').value.trim();
      if (subs) body.subreddits = subs;

      setProgress('research', true, 35, 'Menganalisis topik viral dengan AI…');
      const data = await api('/api/research', body);
      setProgress('research', true, 90, 'Mencari video YouTube…');
      await new Promise((r) => setTimeout(r, 300));
      setProgress('research', false);
      renderResearch(data);
    } catch (error) {
      setProgress('research', false);
      $('#research-error').classList.remove('hidden');
      $('#research-error-msg').textContent = error.message;
    } finally {
      btn.disabled = false;
    }
  });

  function renderResearch(data) {
    const list = $('#research-list');
    const trends = data.trends || [];
    list.innerHTML = '';

    $('#research-meta').textContent =
      `${trends.length} topik dari ${data.signalCount ?? 0} sinyal` +
      (data.skippedSources?.length
        ? ` · dilewati: ${data.skippedSources.map((s) => s.source).join(', ')}`
        : '');

    trends.forEach((trend) => {
      const card = document.createElement('div');
      card.className = 'trend-card';

      const videos = (trend.videos || []).map((v) => `
        <div class="video-row">
          ${v.thumbnailUrl
            ? `<img class="video-thumb" src="${esc(v.thumbnailUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="video-thumb"></div>`}
          <div class="video-info">
            <div class="video-title" title="${esc(v.title)}">${esc(v.title)}</div>
            <div class="video-meta">${esc(v.channel || '')}${v.viewCount != null ? ` · ${fmtViews(v.viewCount)} views` : ''}${v.durationSeconds != null ? ` · ${fmtDuration(v.durationSeconds)}` : ''}</div>
          </div>
          <div class="video-actions">
            <button class="btn ghost small" data-action="clip" data-url="${esc(v.url)}">Buat Klip</button>
            <button class="btn ghost small" data-action="copy" data-url="${esc(v.url)}">Salin URL</button>
          </div>
        </div>`).join('') || '<p class="muted">Tidak ada video ditemukan.</p>';

      card.innerHTML = `
        <div class="trend-head">
          <div class="score-badge">${trend.score ?? 0}</div>
          <div style="flex:1; min-width:0">
            <div class="trend-title">${esc(trend.title)}</div>
            <span class="trend-cat">${esc(trend.category || 'other')}</span>
          </div>
        </div>
        ${trend.summary ? `<p class="trend-summary">${esc(trend.summary)}</p>` : ''}
        ${trend.keywords ? `<p class="trend-keywords">🔑 <code>${esc(trend.keywords)}</code></p>` : ''}
        <div class="videos">${videos}</div>`;

      list.appendChild(card);
    });

    $('#research-results').classList.remove('hidden');
  }

  /* ---------- Clip creation ---------- */
  $('#btn-clip').addEventListener('click', async () => {
    const url = $('#clip-url').value.trim();
    if (!url) {
      toast('Masukkan URL YouTube dulu', 'error');
      $('#clip-url').focus();
      return;
    }
    const btn = $('#btn-clip');
    btn.disabled = true;
    $('#clip-results').classList.add('hidden');
    $('#clip-error').classList.add('hidden');
    setProgress('clip', true, 5, 'Mengunduh video…');

    try {
      const body = { url };
      const template = $('#clip-template').value;
      if (template) body.template = template;
      const acting = $('#clip-acting').value;
      if (acting) body.acting_as = acting;
      const channel = {};
      if ($('#clip-channel-name').value.trim()) channel.name = $('#clip-channel-name').value.trim();
      if ($('#clip-channel-logo').value.trim()) channel.logo = $('#clip-channel-logo').value.trim();
      if (Object.keys(channel).length) body.channel = channel;

      setProgress('clip', true, 20, 'Mengekstrak audio & transkripsi (Whisper)…');
      const data = await api('/api/process', body);
      setProgress('clip', true, 85, 'Merender klip…');
      await new Promise((r) => setTimeout(r, 300));
      setProgress('clip', false);
      renderClips(data);
    } catch (error) {
      setProgress('clip', false);
      $('#clip-error').classList.remove('hidden');
      $('#clip-error-msg').textContent = error.message;
    } finally {
      btn.disabled = false;
    }
  });

  function renderClips(data) {
    const list = $('#clip-list');
    const clips = data.clips || [];
    list.innerHTML = '';

    $('#clip-meta').textContent = `${clips.length} klip${data.clipErrors?.length ? ` · ${data.clipErrors.length} gagal` : ''}`;

    clips.forEach((clip) => {
      const card = document.createElement('div');
      card.className = 'clip-card';
      const videoSrc = clip.video ? encodeURI(clip.video) : '';
      card.innerHTML = `
        <div class="clip-head">
          ${videoSrc ? `
          <div class="clip-video">
            <video src="${videoSrc}" controls preload="metadata"></video>
          </div>` : ''}
          <div class="clip-info">
            <div class="clip-title">${esc(clip.title || `Klip ${clip.id}`)}</div>
            ${clip.reason ? `<p class="clip-reason">${esc(clip.reason)}</p>` : ''}
            ${clip.hook ? `<p class="clip-hook">“${esc(clip.hook)}”</p>` : ''}
            <div class="clip-stats">
              ${clip.score != null ? `<span class="chip score">Score ${clip.score}</span>` : ''}
              ${clip.start != null && clip.end != null ? `<span class="chip">${fmtDuration(clip.start)} – ${fmtDuration(clip.end)}</span>` : ''}
              ${clip.duration != null ? `<span class="chip">${clip.duration.toFixed ? clip.duration.toFixed(1) : clip.duration}s</span>` : ''}
              ${clip.resolution ? `<span class="chip">${esc(clip.resolution)}</span>` : ''}
            </div>
            <div class="clip-actions">
              ${clip.video ? `<button class="btn ghost small" data-action="download" data-url="${esc(clip.video)}" data-name="clip-${esc(clip.id)}.mp4">⬇️ Unduh MP4</button>` : ''}
              ${clip.subtitle ? `<a class="btn ghost small" href="${esc(clip.subtitle)}" download>💬 Subtitle</a>` : ''}
              ${clip.thumbnail ? `<a class="btn ghost small" href="${esc(clip.thumbnail)}" download>🖼️ Thumbnail</a>` : ''}
              <button class="btn ghost small" data-action="copy" data-url="${esc(clip.video)}">🔗 Salin Path</button>
            </div>
          </div>
        </div>`;
      list.appendChild(card);
    });

    if (data.clipErrors?.length) {
      const errBox = document.createElement('div');
      errBox.className = 'card error-card';
      errBox.innerHTML = `<h3>⚠️ ${data.clipErrors.length} klip gagal render</h3>` +
        data.clipErrors.map((e) => `<p style="margin-top:6px">#${esc(e.index ?? '?')} [${esc(e.code || '')}] ${esc(e.message || '')}</p>`).join('');
      list.appendChild(errBox);
    }

    $('#clip-results').classList.remove('hidden');
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
        list.innerHTML = '<p class="muted">Belum ada klip.</p>';
        return;
      }
      list.innerHTML = items.slice().reverse().map((c) => `
        <div class="history-item">
          <div>
            <div class="h-title">${esc(c.title || c.video || 'Klip')}</div>
            <div class="h-meta">${esc(c.video || '')}</div>
          </div>
          <div style="display:flex;gap:6px">
            ${c.video ? `<button class="btn ghost small" data-action="download" data-url="${esc(c.video)}">⬇️</button>` : ''}
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
    const { action, url, name } = btn.dataset;

    if (action === 'copy') {
      if (url) {
        navigator.clipboard?.writeText(url).then(
          () => toast('Disalin ke clipboard ✓', 'success'),
          () => toast('Gagal menyalin', 'error'),
        );
      }
    } else if (action === 'clip') {
      if (url) {
        $('#clip-url').value = url;
        $$('.tab').find((t) => t.dataset.tab === 'clip')?.click();
        toast('URL dimasukkan — klik Buat Klip', 'success');
      }
    } else if (action === 'download') {
      downloadFile(url, name);
    }
  });

  /* ---------- Init ---------- */
  checkServer();
  loadTemplates();
  setInterval(checkServer, 15000);
})();
