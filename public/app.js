/* Viral Clip Studio — frontend logic. */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = {
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

  let toastTimer = null;
  function toast(message, type = '') {
    const el = $('#toast');
    el.textContent = message;
    el.className = `toast ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  /**
   * Mengganti hanya teks utama tombol aksi, membiarkan elemen lain di dalam
   *nya (mis. badge STT) tetap utuh — pengganti `btn.textContent = ...` yang
   * akan menghapus seluruh isi tombol.
   */
  function setBtnText(btn, text) {
    btn.childNodes[0].textContent = text;
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

  /* ---------- Provider chip toggles ---------- */
  $$('.chip-toggle').forEach((chip) => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });

  /* ---------- TTS Provider → dynamic voice list ---------- */
  const TTS_VOICES = {
    'edge-tts': [
      { group: '🇮🇩 Indonesia', voices: [
        { value: 'id-ID-ArdiNeural', label: 'Ardi (ID, male)' },
        { value: 'id-ID-GadisNeural', label: 'Gadis (ID, female)' },
      ]},
      { group: '🇺🇸 English', voices: [
        { value: 'en-US-GuyNeural', label: 'Guy (EN, male)' },
        { value: 'en-US-AriaNeural', label: 'Aria (EN, female)' },
        { value: 'en-US-AndrewMultilingualNeural', label: 'Andrew (EN, multilingual)' },
        { value: 'en-GB-SoniaNeural', label: 'Sonia (GB, female)' },
      ]},
      { group: '🇯🇵 Japanese', voices: [
        { value: 'ja-JP-KeitaNeural', label: 'Keita (JP, male)' },
        { value: '  ja-JP-NanamiNeural', label: 'Nanami (JP, female)' },
      ]},
    ],
    'openai': [
      { group: 'OpenAI Voices', voices: [
        { value: 'alloy', label: 'Alloy (neutral)' },
        { value: 'echo', label: 'Echo (male)' },
        { value: 'fable', label: 'Fable (British)' },
        { value: 'onyx', label: 'Onyx (deep male)' },
        { value: 'nova', label: 'Nova (female)' },
        { value: 'shimmer', label: 'Shimmer (soft female)' },
      ]},
    ],
  };

  function refreshVoiceOptions() {
    const provider = $('#transform-tts-provider').value;
    const voiceSelect = $('#transform-voice');
    const prev = voiceSelect.value;
    voiceSelect.innerHTML = '';
    for (const group of (TTS_VOICES[provider] ?? [])) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.group;
      for (const v of group.voices) {
        const opt = document.createElement('option');
        opt.value = v.value;
        opt.textContent = v.label;
        optgroup.appendChild(opt);
      }
      voiceSelect.appendChild(optgroup);
    }
    // Restore previous selection if still available
    if (voiceSelect.querySelector(`option[value="${prev}"]`)) {
      voiceSelect.value = prev;
    }
  }

  $('#transform-tts-provider')?.addEventListener('change', refreshVoiceOptions);

  /* ---------- Hook Recommendation (Plan M) ---------- */
  const hookState = { selected: null };

  /** Builds one playable preview <video> element (or a placeholder). */
  function buildPreviewVideo(previewUrl, label) {
    if (!previewUrl) return '';
    return `<video class="preview-video" src="${esc(previewUrl)}" controls preload="metadata" ${label ? `aria-label="${esc(label)}"` : ''}></video>`;
  }

  function renderHooks(data) {
    const list = $('#hook-list');
    const hooks = data?.hooks ?? [];
    list.innerHTML = '';
    $('#hook-meta').textContent =
      `${data.candidateCount ?? 0} kandidat · ${data.rejectedCount ?? 0} ditolak accuracy guard · ` +
      `${data.duplicateCount ?? 0} duplikat dihapus · Top-${hooks.length}` +
      (data.cached ? ' · 📦 hasil tersimpan (tanpa regenerate)' : '');

    if (hooks.length === 0) {
      list.innerHTML = '<p class="muted small">Tidak ada hook yang lolos accuracy guard. Coba ulangi lagi.</p>';
      return;
    }

    hooks.forEach((hook) => {
      const item = document.createElement('div');
      item.className = 'hook-item' + (hookState.selected?.id === hook.id ? ' selected' : '');
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      item.dataset.hookId = hook.id;

      const headline = hook.headline?.text || '';
      const spoken = hook.spokenHook?.text || '';
      const duration = hook.spokenHook?.duration;
      const score = hook.rankScore ?? hook.score?.final;
      const style = hook.style || '';

      item.innerHTML =
        buildPreviewVideo(hook.previewUrl, `Preview hook ${hook.rank}`) +
        `<div class="hook-rank">${hook.rank}</div>` +
        `<div class="hook-body">` +
          `<div class="hook-headline">${esc(headline)}</div>` +
          `${spoken && spoken !== headline ? `<div class="hook-spoken">“${esc(spoken)}”</div>` : ''}` +
          `<div class="hook-meta-row">` +
            `<span class="hook-style">${esc(style)}</span>` +
            (score != null ? `<span class="hook-score">${Math.round(score)}/100</span>` : '') +
            `<span class="hook-time">sumber ${fmtDuration(hook.source?.start)}–${fmtDuration(hook.source?.end)}</span>` +
            (duration ? `<span class="hook-time">⏱ ${duration.toFixed(1)}s</span>` : '') +
          `</div>` +
        `</div>` +
        `<span class="hook-clear-hint">${hookState.selected?.id === hook.id ? '✅ Dipilih' : 'pilih'}</span>`;

      const select = () => {
        hookState.selected = hookState.selected?.id === hook.id ? null : hook;
        $$('.hook-item').forEach((el) => {
          const isSel = hookState.selected && el.dataset.hookId === hookState.selected.id;
          el.classList.toggle('selected', !!isSel);
          const hint = el.querySelector('.hook-clear-hint');
          if (hint) hint.textContent = isSel ? '✅ Dipilih' : 'pilih';
        });
        if (hookState.selected) toast(`Hook #${hook.rank} dipakai untuk transform`, 'success');
      };
      item.addEventListener('click', select);
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
      list.appendChild(item);
    });
  }

  /**
   * Generates hooks (or returns the saved result). With `refresh=true` the
   * server re-runs the full pipeline even when a saved result exists.
   */
  async function generateHooks(refresh = false) {
    const url = $('#transform-url').value.trim();
    if (!url) {
      toast('Masukkan URL YouTube dulu', 'error');
      $('#transform-url').focus();
      return;
    }
    const btn = $('#btn-gen-hooks');
    btn.disabled = true;
    setBtnText(btn, refresh ? '⏳ Men-generate ulang hook…' : '⏳ Men-generate hook…');
    $('#hook-panel').classList.remove('hidden');
    $('#hook-list').innerHTML = '<p class="muted small">Men-generate 10-15 kandidat, accuracy guard, scoring & ranking…</p>';

    try {
      hookState.selected = null;
      const data = await apiPost('/api/hooks/generate', {
        youtubeUrl: url,
        candidateId: 0,
        language: $('#transform-lang').value || 'auto',
        sttProvider: $('#transform-stt-provider').value || undefined,
        refresh,
      });
      renderHooks(data);
      toast(
        data.cached
          ? `${data.hooks?.length ?? 0} hook dimuat dari hasil tersimpan`
          : `${data.hooks?.length ?? 0} hook direkomendasikan`,
        'success',
      );
    } catch (error) {
      $('#hook-list').innerHTML = `<p class="muted small">❌ ${esc(error.message)}</p>`;
    } finally {
      btn.disabled = false;
      setBtnText(btn, '✨ Generate Hook Top-5');
    }
  }

  $('#btn-gen-hooks').addEventListener('click', () => generateHooks(false));
  $('#btn-regen-hooks')?.addEventListener('click', () => generateHooks(true));

  /** Hides the hook panel and drops any selection (URL changed / no cache). */
  function hideHookPanel() {
    hookState.selected = null;
    $('#hook-list').innerHTML = '';
    $('#hook-meta').textContent = '';
    $('#hook-panel').classList.add('hidden');
  }

  /**
   * Restore the hook panel after a page reload: fetches the saved result
   * from the server (GET /api/hooks) without triggering any pipeline run.
   * When the URL has no saved hooks (or is empty) the panel is hidden and
   * any stale selection from a previous video is cleared.
   */
  let restoreSeq = 0;
  async function restoreSavedHooks() {
    const url = $('#transform-url').value.trim();
    const seq = ++restoreSeq; // guards against out-of-order responses
    if (!url) {
      hideHookPanel();
      return;
    }
    try {
      const data = await apiGet(`/api/hooks?url=${encodeURIComponent(url)}&candidateId=0`);
      if (seq !== restoreSeq) return; // a newer URL change superseded this
      if (data?.hooks?.length) {
        hookState.selected = null; // never carry a selection across videos
        renderHooks(data);
        $('#hook-panel').classList.remove('hidden');
      } else {
        hideHookPanel();
      }
    } catch {
      if (seq !== restoreSeq) return;
      hideHookPanel(); // nothing saved for this video yet
    }
  }

  // Restore on load, and whenever the URL field changes (paste/edit).
  restoreSavedHooks();
  $('#transform-url')?.addEventListener('change', restoreSavedHooks);

  $('#btn-clear-hook').addEventListener('click', () => {
    hookState.selected = null;
    $$('.hook-item').forEach((el) => el.classList.remove('selected'));
    toast('Pilihan hook dibersihkan', '');
  });

  /* ---------- Viral Clip Recommendation (flow redesign step 3) ---------- */
  const clipState = { selected: new Map() };

  function renderClips(data) {
    const list = $('#clip-list');
    const clips = data?.clips ?? [];
    list.innerHTML = '';
    $('#clip-meta').textContent =
      `${data.candidateCount ?? 0} kandidat · Top-${clips.length}` +
      (data.cached ? ' · 📦 hasil tersimpan (tanpa regenerate)' : '');

    if (clips.length === 0) {
      list.innerHTML = '<p class="muted small">Tidak ada klip viral ditemukan. Coba ulangi lagi.</p>';
      return;
    }

    clips.forEach((clip) => {
      const isSelected = clipState.selected.has(clip.id);
      const item = document.createElement('div');
      item.className = 'hook-item clip-item' + (isSelected ? ' selected' : '');
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      item.dataset.clipId = clip.id;

      item.innerHTML =
        buildPreviewVideo(clip.previewUrl, `Preview klip ${clip.rank}`) +
        `<div class="hook-rank">${clip.rank}</div>` +
        `<div class="hook-body">` +
          `<div class="hook-headline">${esc(clip.title)}</div>` +
          `<div class="hook-spoken">“${esc(clip.hook)}”</div>` +
          `<div class="hook-meta-row">` +
            `<span class="hook-score">${Math.round(clip.score)}/100</span>` +
            `<span class="hook-time">sumber ${fmtDuration(clip.start)}–${fmtDuration(clip.end)}</span>` +
            `<span class="hook-time">⏱ ${clip.durationSeconds.toFixed(1)}s</span>` +
          `</div>` +
        `</div>` +
        `<span class="hook-clear-hint">${isSelected ? '✅ Dipilih' : 'pilih'}</span>`;

      const toggle = () => {
        if (clipState.selected.has(clip.id)) {
          clipState.selected.delete(clip.id);
        } else {
          clipState.selected.set(clip.id, { start: clip.start, end: clip.end, title: clip.title });
        }
        const nowSelected = clipState.selected.has(clip.id);
        item.classList.toggle('selected', nowSelected);
        const hint = item.querySelector('.hook-clear-hint');
        if (hint) hint.textContent = nowSelected ? '✅ Dipilih' : 'pilih';
        toast(
          clipState.selected.size > 0
            ? `${clipState.selected.size} klip dipilih untuk reel`
            : 'Pilihan klip dibersihkan',
          'success',
        );
      };
      item.addEventListener('click', toggle);
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      list.appendChild(item);
    });
  }

  async function generateClips(refresh = false) {
    const url = $('#transform-url').value.trim();
    if (!url) {
      toast('Masukkan URL YouTube dulu', 'error');
      $('#transform-url').focus();
      return;
    }
    const btn = $('#btn-gen-clips');
    btn.disabled = true;
    setBtnText(btn, refresh ? '⏳ Menganalisis ulang…' : '⏳ Menganalisis seluruh transkrip…');
    $('#clip-panel').classList.remove('hidden');
    $('#clip-list').innerHTML = '<p class="muted small">Menganalisis transkrip, mencari momen paling viral, dan merender preview…</p>';

    try {
      clipState.selected.clear();
      const data = await apiPost('/api/clips/recommend', {
        youtubeUrl: url,
        sttProvider: $('#transform-stt-provider').value || undefined,
        // Metadata klip (judul/alasan/hook) mengikuti bahasa output yang dipilih.
        language: $('#transform-lang')?.value || undefined,
        refresh,
      });
      renderClips(data);
      toast(
        data.cached
          ? `${data.clips?.length ?? 0} klip dimuat dari hasil tersimpan`
          : `${data.clips?.length ?? 0} klip viral direkomendasikan`,
        'success',
      );
    } catch (error) {
      $('#clip-list').innerHTML = `<p class="muted small">❌ ${esc(error.message)}</p>`;
    } finally {
      btn.disabled = false;
      setBtnText(btn, '🔥 Generate Klip Viral');
    }
  }

  $('#btn-gen-clips').addEventListener('click', () => generateClips(false));
  $('#btn-regen-clips')?.addEventListener('click', () => generateClips(true));

  /** Hides the clip panel and drops any selection (URL changed / no cache). */
  function hideClipPanel() {
    clipState.selected.clear();
    $('#clip-list').innerHTML = '';
    $('#clip-meta').textContent = '';
    $('#clip-panel').classList.add('hidden');
  }

  /**
   * Restore the clip panel after a page reload: fetches the saved result
   * from the server (GET /api/clips) without triggering any pipeline run.
   */
  let restoreClipsSeq = 0;
  async function restoreSavedClips() {
    const url = $('#transform-url').value.trim();
    const seq = ++restoreClipsSeq; // guards against out-of-order responses
    if (!url) {
      hideClipPanel();
      return;
    }
    try {
      const data = await apiGet(`/api/clips?url=${encodeURIComponent(url)}`);
      if (seq !== restoreClipsSeq) return; // a newer URL change superseded this
      if (data?.clips?.length) {
        clipState.selected.clear(); // never carry a selection across videos
        renderClips(data);
        $('#clip-panel').classList.remove('hidden');
      } else {
        hideClipPanel();
      }
    } catch {
      if (seq !== restoreClipsSeq) return;
      hideClipPanel(); // nothing saved for this video yet
    }
  }

  $('#transform-url')?.addEventListener('change', restoreSavedClips);

  $('#btn-clear-clips').addEventListener('click', () => {
    clipState.selected.clear();
    $$('.clip-item').forEach((el) => el.classList.remove('selected'));
    toast('Pilihan klip dibersihkan', '');
  });

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
      const keyword = $('#res-keyword').value.trim();
      if (keyword) body.keyword = keyword;
      const subs = $('#res-subreddits').value.trim();
      if (subs) body.subreddits = subs;

      const selectedProviders = $$('.chip-toggle.active').map((c) => c.dataset.provider);
      if (selectedProviders.length > 0) body.providers = selectedProviders;

      setProgress('research', true, 35, 'Menganalisis topik viral dengan AI…');
      const data = await apiPost('/api/research', body);
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

    // Reel mode needs at least one selected viral clip.
    if (($('#transform-output-mode')?.value || 'narration') === 'reel' && clipState.selected.size === 0) {
      btn.disabled = false;
      toast('Mode Reel: pilih minimal 1 klip viral dulu (Step 3)', 'error');
      $('#clip-panel').classList.remove('hidden');
      $('#clip-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const stages = ($('#transform-output-mode')?.value || 'narration') === 'reel'
      ? ['download', 'transcript', 'render']
      : ['download', 'transcript', 'angle', 'story', 'script', 'tts', 'plan', 'render'];
    const stagePct = { download: 10, transcript: 20, angle: 35, story: 45, script: 55, tts: 65, plan: 78, render: 90 };
    // Sembunyikan chip stage yang tidak dipakai mode terpilih (reel: hanya
    // download/transcript/render), lalu reset status chip aktif.
    $$('.stage[data-stage]').forEach((el) => el.classList.add('hidden'));
    stages.forEach(s => {
      $(`.stage[data-stage="${s}"]`)?.classList.remove('hidden');
      setStageStatus(s, 'pending');
    });
    setProgress('transform', true, 0, 'Menyiapkan…');

    try {
      const engine = $('#transform-engine')?.value || 'commentary';
      const template = engine === 'remotion'
        ? ($('#transform-style')?.value || 'commentary')
        : engine;
      const outputMode = $('#transform-output-mode')?.value || 'narration';
      // Mode Reel tidak memakai engine/STT/bahasa/TTS/channel/badge —
      // field tersebut hanya dikirim di mode Narasi.
      const body = outputMode === 'reel'
        ? {
            youtubeUrl: url,
            outputMode,
            selectedClips: [...clipState.selected.values()],
            dryRun: $('#transform-dry-run')?.checked || false,
            // Hook terpilih jadi intro reel; backend memangkas detik yang
            // tumpang tindih dengan klip agar tidak ada yang berulang.
            // Saat preview final (gaya clipper) tersedia, file itu dipakai
            // langsung sebagai pembuka reel — apa yang dilihat = hasilnya.
            ...(hookState.selected && hookState.selected.source
              ? { sourceRange: { start: hookState.selected.source.start, end: hookState.selected.source.end } }
              : {}),
            ...(hookState.selected && hookState.selected.previewPath
              ? { hookPreviewPath: hookState.selected.previewPath }
              : {}),
          }
        : {
            youtubeUrl: url,
            template,
            language: $('#transform-lang').value || 'auto',
            sttProvider: $('#transform-stt-provider').value || undefined,
            ttsProvider: $('#transform-tts-provider').value || undefined,
            ttsVoice: $('#transform-voice').value || undefined,
            hookBadge: $('#transform-hook-badge')?.value.trim() || undefined,
            channel: { name: $('#transform-channel').value.trim() || undefined },
            dryRun: $('#transform-dry-run')?.checked || false,
            ...(hookState.selected
              ? {
                  sourceRange: {
                    start: hookState.selected.source?.start ?? 0,
                    end: hookState.selected.source?.end ?? 30,
                  },
                  customHook: hookState.selected.spokenHook?.text || hookState.selected.headline?.text,
                }
              : {}),
          };

      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get('content-type') ?? '';

      // SSE stream: parse real-time stage events
      if (contentType.includes('text/event-stream')) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let prevStage = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (separated by double newline)
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            if (!part.trim()) continue;
            let eventName = '';
            let data = '';
            for (const line of part.split('\n')) {
              if (line.startsWith('event: ')) eventName = line.slice(7);
              else if (line.startsWith('data: ')) data = line.slice(6);
            }
            if (!eventName || !data) continue;

            try {
              const payload = JSON.parse(data);

              if (eventName === 'stage') {
                // Mark previous stage as done
                if (prevStage) setStageStatus(prevStage, 'done');
                if (payload.skipped) {
                  // Stage was skipped — source files already exist, mark done immediately
                  setStageStatus(payload.stage, 'done');
                  prevStage = null;
                  setProgress('transform', true, stagePct[payload.stage] ?? 50, 'Dilewati (file sudah ada)');
                } else {
                  prevStage = payload.stage;
                  setStageStatus(payload.stage, 'running');
                  setProgress('transform', true, stagePct[payload.stage] ?? 50, stageLabel(payload.stage));
                }
              } else if (eventName === 'result') {
                if (prevStage) setStageStatus(prevStage, 'done');
                setProgress('transform', false);
                renderTransformResult(payload);
              } else if (eventName === 'error') {
                if (prevStage) setStageStatus(prevStage, 'error');
                setProgress('transform', false);
                $('#transform-error').classList.remove('hidden');
                $('#transform-error-msg').textContent = payload.message;
              }
            } catch { /* malformed event */ }
          }
        }
        // Process any remaining buffer
        if (buffer.trim()) {
          let eventName = '', data = '';
          for (const line of buffer.split('\n')) {
            if (line.startsWith('event: ')) eventName = line.slice(7);
            else if (line.startsWith('data: ')) data = line.slice(6);
          }
          if (eventName === 'result' && data) {
            try {
              if (prevStage) setStageStatus(prevStage, 'done');
              setProgress('transform', false);
              renderTransformResult(JSON.parse(data));
            } catch { /* ignore */ }
          }
        }
      } else {
        // Fallback: regular JSON response (no SSE)
        stages.forEach(s => setStageStatus(s, 'running'));
        setProgress('transform', true, 50, 'Memproses…');
        let data = null;
        try { data = await res.json(); } catch { /* no body */ }
        if (!res.ok) {
          const msg = data?.message || data?.data?.message || `HTTP ${res.status}`;
          throw new Error(msg);
        }
        stages.forEach(s => setStageStatus(s, 'done'));
        setProgress('transform', false);
        renderTransformResult(data);
      }
    } catch (error) {
      setProgress('transform', false);
      $('#transform-error').classList.remove('hidden');
      $('#transform-error-msg').textContent = error.message;
    } finally {
      btn.disabled = false;
    }
  });

  function stageLabel(stage) {
    const labels = {
      download: 'Mengunduh video…',
      transcript: 'Transkripsi audio…',
      angle: 'Generate angle editorial…',
      story: 'Derive story beats…',
      script: 'Menulis script orisinal…',
      tts: 'Synthesize TTS narasi…',
      plan: 'Membangun video plan…',
      render: 'Rendering video…',
    };
    return labels[stage] ?? 'Memproses…';
  }

  function renderTransformResult(data) {
    const list = $('#transform-list');
    list.innerHTML = '';

    const result = data.result || data;
    if (!result) {
      toast('Tidak ada hasil transform', 'error');
      return;
    }

    const card = document.createElement('div');
    card.className = 'transform-result';

    const videoUrl = result.outputVideo?.url || result.outputVideo || '';
    const narrationUrl = result.narration?.url || '';
    const scriptData = result.script || {};
    const angleData = result.angle || {};
    const storyData = result.story || {};
    const planData = result.videoPlan || {};
    const isReel = result.outputMode === 'reel';

    card.innerHTML = `
      <div class="transform-head">
        <div class="transform-video">
          ${videoUrl ? `<video src="${esc(videoUrl)}" controls preload="metadata"></video>` : '<div class="video-placeholder">🎬</div>'}
        </div>
        <div class="transform-info">
          <div class="transform-title">${isReel ? '🎬 Reel Berhasil Dibuat' : '✨ Transformasi Berhasil'}</div>
          <div class="transform-meta">
            ${result.jobId ? `<span class="chip">Job: ${esc(result.jobId.slice(0, 8))}…</span>` : ''}
            ${planData.duration ? `<span class="chip">${fmtDuration(planData.duration)}</span>` : ''}
            ${result.reel?.durationSeconds ? `<span class="chip">${fmtDuration(result.reel.durationSeconds)} · ${result.reel.clipCount} klip</span>` : ''}
            ${result.dryRun ? '<span class="chip">Dry Run</span>' : ''}
          </div>
          ${isReel
            ? (result.reel?.segments || []).map((s, i) => `
                <div class="transform-angle">Klip ${i + 1}: ${fmtDuration(s.start)}–${fmtDuration(s.end)} dari sumber</div>`).join('')
            : ''}
          ${!isReel && angleData.title ? `<div class="transform-angle">Angle: ${esc(angleData.title)}</div>` : ''}
          ${!isReel && result.storyApplied === false ? '<div class="transform-angle" style="color:var(--muted)">⚠️ Story beats tidak diterapkan (analisis cerita gagal) — struktur video memakai pembagian merata</div>' : ''}
          ${!isReel && storyData.concept ? `<div class="transform-script-title" style="margin-top:6px;font-size:13px;color:var(--muted)">Concept: ${esc(storyData.concept)}</div>` : ''}
          <div class="transform-actions">
            ${videoUrl ? `<button class="btn ghost small" data-action="download" data-url="${esc(videoUrl)}" data-name="${isReel ? 'reel.mp4' : 'transformed.mp4'}">⬇️ Unduh MP4</button>` : ''}
            ${!isReel && narrationUrl ? `<button class="btn ghost small" data-action="download" data-url="${esc(narrationUrl)}" data-name="narration.mp3">🔊 Unduh MP3</button>` : ''}
            ${videoUrl ? `<button class="btn ghost small" data-action="copy" data-url="${esc(videoUrl)}">🔗 Salin</button>` : ''}
          </div>
        </div>
      </div>
      ${!isReel && scriptData.sections?.length ? `
      <div class="transform-script">
        <div class="script-header">📝 Script</div>
        ${scriptData.sections.map(s => `
          <div class="script-section">
            <span class="section-badge ${esc(s.type)}">${esc(s.type)}</span>
            <span class="section-text">${esc(s.text)}</span>
          </div>
        `).join('')}
      </div>` : ''}
      ${!isReel && storyData.beats?.length ? `
      <div class="transform-angles">
        <div class="angles-header">📖 Story Beats</div>
        ${storyData.beats.slice(0, 5).map(b => `
          <div class="angle-item">
            <div class="angle-score" style="font-size:11px">${esc(b.role || '?')}</div>
            <div class="angle-title">${esc(b.purpose || b.id)}</div>
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
      list.innerHTML = items.slice().reverse().map((c) => {
        const clipUrl = c.videoUrl || c.outputVideo || '';
        return `
        <div class="history-item">
          ${c.thumbnailUrl ? `<img class="h-thumb" src="${esc(c.thumbnailUrl)}" alt="" loading="lazy">` : ''}
          <div>
            <div class="h-title">${esc(c.title || c.video || 'Transform')}</div>
            <div class="h-meta">${esc(c.video || c.outputVideo || '')}</div>
          </div>
          <div style="display:flex;gap:6px">
            ${clipUrl ? `<button class="btn ghost small" data-action="download" data-url="${esc(clipUrl)}">⬇️</button>` : ''}
            ${clipUrl ? `<button class="btn ghost small" data-action="play" data-url="${esc(clipUrl)}">▶️</button>` : ''}
          </div>
        </div>`;
      }).join('');
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
    } else if (action === 'play') {
      if (url) {
        const player = $('#history-player');
        if (player) {
          player.src = url;
          player.classList.remove('hidden');
          player.play().catch(() => undefined);
        } else {
          window.open(url, '_blank');
        }
      }
    } else if (action === 'approve') {
      updateRights(id, 'AUTHORIZED');
    } else if (action === 'reject') {
      updateRights(id, 'REJECTED');
    } else if (action === 'clip') {
      if (url) {
        $('#transform-url').value = url;
        $$('.tab').find((t) => t.dataset.tab === 'transform')?.click();
        toast('URL dimasukkan — klik Mulai Transform', 'success');
      }
    }
  });

  async function updateRights(videoId, status) {
    try {
      await apiPost(`/api/rights/${videoId}`, { status, updatedBy: 'web-ui' });
      toast(`Rights updated to ${status}`, 'success');
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

  // Show/hide Remotion style selector based on engine selection
  const engineSelect = $('#transform-engine');
  const styleGroup = $('#remotion-style-group');
  if (engineSelect && styleGroup) {
    engineSelect.addEventListener('change', (e) => {
      const isRemotion = e.target.value === 'remotion';
      styleGroup.classList.toggle('hidden', !isRemotion);
    });
  }

  // Mesin Transkrip (STT) ↔ tombol aksi: setiap perubahan engine langsung
  // terlihat sebagai badge di samping Generate Hook / Generate Klip Viral /
  // Mulai Transformasi — ketiganya menranskrip audio dengan engine ini pada
  // download pertama, jadi pilihan harus aware sebelum tombol mana pun
  // ditekan. Badge "Auto (server)" tampil netral; engine eksplisit di-highlight.
  const STT_BADGE_LABELS = {
    '': 'Auto (server)',
    'faster-whisper': 'Faster Whisper',
    'whisper-cpp': 'Whisper.cpp',
    whisperx: 'WhisperX',
    openai: 'OpenAI',
  };
  const sttSelect = $('#transform-stt-provider');
  function syncSttBadges() {
    const value = sttSelect?.value ?? '';
    const label = STT_BADGE_LABELS[value] ?? value;
    $$('[data-stt-badge]').forEach((badge) => {
      badge.textContent = `🎙️ STT: ${label}`;
      badge.classList.toggle('stt-custom', value !== '');
    });
  }
  sttSelect?.addEventListener('change', syncSttBadges);
  syncSttBadges();

  // Mode Output: sembunyikan pengaturan khusus narasi (engine/bahasa/TTS/
  // channel/badge) saat mode Reel — reel menggabungkan footage langsung tanpa
  // LLM/TTS, jadi input tersebut tidak relevan. Dropdown STT TIDAK termasuk
  // di sini: ia berdiri sendiri di Step 2 karena juga dipakai Generate Hook
  // dan Generate Klip Viral (bukan milik mode Narasi saja).
  const outputModeSelect = $('#transform-output-mode');
  const narrationSettings = $('#narration-settings');
  const reelModeHint = $('#reel-mode-hint');
  const sttSection = $('#stt-engine-section');
  function applyOutputModeVisibility() {
    const isReel = (outputModeSelect?.value || 'narration') === 'reel';
    narrationSettings?.classList.toggle('hidden', isReel);
    reelModeHint?.classList.toggle('hidden', !isReel);
    sttSection?.classList.toggle('reel-irrelevant', isReel);
  }
  if (outputModeSelect) {
    outputModeSelect.addEventListener('change', applyOutputModeVisibility);
    applyOutputModeVisibility();
  }

  // Bahasa Output ↔ TTS Voice: saat bahasa diubah eksplisit (id/en), pindahkan
  // voice ke locale yang cocok sambil mempertahankan gender pilihan user.
  // "Auto" tidak menyentuh pilihan voice.
  const langSelect = $('#transform-lang');
  const voiceSelect = $('#transform-voice');
  const FEMALE_VOICE_RE = /gadis|aria|sonia|nanami/i;
  const VOICE_BY_LANG = {
    id: { male: 'id-ID-ArdiNeural', female: 'id-ID-GadisNeural' },
    en: { male: 'en-US-GuyNeural', female: 'en-US-AriaNeural' },
  };
  if (langSelect && voiceSelect) {
    langSelect.addEventListener('change', () => {
      const lang = langSelect.value;
      if (lang !== 'id' && lang !== 'en') return;
      const pair = VOICE_BY_LANG[lang];
      const isFemale = FEMALE_VOICE_RE.test(voiceSelect.value);
      voiceSelect.value = isFemale ? pair.female : pair.male;
    });
  }
})();
