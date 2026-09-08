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

  function fmtDate(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function fmtDateTime(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
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

  /* ---------- Blur Watermark toggle ---------- */
  $('#transform-blur-watermark')?.addEventListener('change', function () {
    const opts = $('#blur-watermark-options');
    if (this.checked) {
      opts?.classList.remove('hidden');
    } else {
      opts?.classList.add('hidden');
    }
  });

  /* Hide positions group when mode is 'auto' (AI detects automatically) */
  $('#transform-blur-mode')?.addEventListener('change', function () {
    const posGroup = $('#blur-positions-group');
    if (this.value === 'auto') {
      posGroup?.classList.add('hidden');
    } else {
      posGroup?.classList.remove('hidden');
    }
  });

  /* ---------- Caption Platforms toggle & selectors ---------- */
  $('#transform-generate-captions')?.addEventListener('change', function () {
    const opts = $('#caption-platforms-options');
    if (this.checked) {
      opts?.classList.remove('hidden');
    } else {
      opts?.classList.add('hidden');
    }
  });

  $('#btn-select-all-platforms')?.addEventListener('click', () => {
    $$('#caption-platforms .chip-toggle').forEach((c) => c.classList.add('active'));
  });

  $('#btn-deselect-all-platforms')?.addEventListener('click', () => {
    $$('#caption-platforms .chip-toggle').forEach((c) => c.classList.remove('active'));
  });

  function getSelectedCaptionPlatforms() {
    const isEnabled = $('#transform-generate-captions')?.checked ?? true;
    if (!isEnabled) return [];
    return $$('#caption-platforms .chip-toggle.active')
      .map((c) => c.dataset.platform)
      .filter(Boolean);
  }

  /* ---------- Caption Credit Presets & Input ---------- */
  const creditInput = $('#transform-caption-credit');
  const creditStatus = $('#caption-credit-status');
  const btnCreditShort = $('#btn-credit-preset-short');
  const btnCreditUrl = $('#btn-credit-preset-url');
  const btnCreditNone = $('#btn-credit-preset-none');

  function updateCreditPresetUI() {
    const val = creditInput ? creditInput.value.trim() : '';
    btnCreditShort?.classList.toggle('active', val === '📹 Credit: @{channel}');
    btnCreditUrl?.classList.toggle('active', val === '🎬 Source: {channel} | {url}');
    btnCreditNone?.classList.toggle('active', val === '');

    if (creditStatus) {
      if (!val) {
        creditStatus.textContent = 'Nonaktif';
        creditStatus.style.color = 'var(--muted, #8a8f98)';
      } else {
        creditStatus.textContent = 'Aktif';
        creditStatus.style.color = 'var(--blue, #4d9fff)';
      }
    }
  }

  btnCreditShort?.addEventListener('click', () => {
    if (creditInput) creditInput.value = '📹 Credit: @{channel}';
    updateCreditPresetUI();
  });

  btnCreditUrl?.addEventListener('click', () => {
    if (creditInput) creditInput.value = '🎬 Source: {channel} | {url}';
    updateCreditPresetUI();
  });

  btnCreditNone?.addEventListener('click', () => {
    if (creditInput) creditInput.value = '';
    updateCreditPresetUI();
  });

  creditInput?.addEventListener('input', updateCreditPresetUI);

  function getCaptionCreditTemplate() {
    const isEnabled = $('#transform-generate-captions')?.checked ?? true;
    if (!isEnabled) return undefined;
    const input = $('#transform-caption-credit');
    return input ? input.value : undefined;
  }

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
  $('#transform-lang')?.addEventListener('change', refreshVoiceOptions);

  /* ---------- Hook Recommendation (Plan M) ---------- */
  const hookState = { selected: null };

  /** Builds one playable preview <video> element (or a placeholder). */
  function buildPreviewVideo(previewUrl, label) {
    if (!previewUrl) return '';
    const cacheBusted = previewUrl + (previewUrl.includes('?') ? '&' : '?') + '_v=' + Date.now();
    return `<video class="preview-video" src="${esc(cacheBusted)}" controls preload="metadata" ${label ? `aria-label="${esc(label)}"` : ''}></video>`;
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
      const tag = hook.headline?.tag || '';
      const spoken = hook.spokenHook?.text || '';
      const srcDur = hook.source ? (hook.source.end - hook.source.start) : 0;
      const duration = hook.finalDurationSeconds ?? (srcDur > 0 ? srcDur : hook.spokenHook?.duration);
      const score = hook.rankScore ?? hook.score?.final;
      const style = hook.style || '';

      item.innerHTML =
        buildPreviewVideo(hook.previewUrl, `Preview hook ${hook.rank}`) +
        `<div class="hook-rank">${hook.rank}</div>` +
        `<div class="hook-body">` +
          `${tag ? `<div class="hook-tag" style="display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;background:rgba(255,225,53,0.18);color:#ffe135;margin-bottom:4px;border:1px solid rgba(255,225,53,0.3)">${esc(tag)}</div>` : ''}` +
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
        if (hookState.selected) {
          toast(`Hook #${hook.rank} dipakai untuk transform`, 'success');
          if (scriptState && scriptState.active && scriptState.sections?.length > 0) {
            const hookIdx = scriptState.sections.findIndex((s) => s.type === 'hook');
            const hookText = hookState.selected.spokenHook?.text || hookState.selected.headline?.text || '';
            if (hookIdx !== -1 && hookText) {
              scriptState.sections[hookIdx].text = hookText;
              scriptState.sections[hookIdx].spokenText = hookText;
              renderScriptSections();
              updateScriptMeta();
            }
          }
        }
      };
      item.addEventListener('click', select);
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
      list.appendChild(item);
    });
  }

  /**
   * Fast design testing: Re-renders preview MP4s using the latest Remotion
   * composition code without re-running any LLM calls.
   */
  async function rerenderHooks() {
    const url = $('#transform-url').value.trim();
    if (!url) {
      toast('Masukkan URL YouTube dulu', 'error');
      $('#transform-url').focus();
      return;
    }
    const btn = $('#btn-rerender-hooks');
    if (!btn) return;
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '⏳ Rendering preview…';

    try {
      const data = await apiPost('/api/hooks/rerender', {
        youtubeUrl: url,
        candidateId: 0,
      });
      renderHooks(data);
      toast('Preview video hook berhasil di-render ulang dengan desain terbaru!', 'success');
    } catch (error) {
      toast(`Gagal render ulang: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
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
    const selectedClip = [...clipState.selected.values()][0];
    
    if (selectedClip) {
      $('#hook-list').innerHTML = `<p class="muted small">Men-generate hook untuk klip terpilih (mulai ${fmtDuration(selectedClip.start)}), accuracy guard, scoring & ranking…</p>`;
    } else {
      $('#hook-list').innerHTML = '<p class="muted small">Men-generate 10-15 kandidat, accuracy guard, scoring & ranking…</p>';
    }

    try {
      hookState.selected = null;
      const data = await apiPost('/api/hooks/generate', {
        youtubeUrl: url,
        candidateId: 0,
        ...(selectedClip ? { startTime: selectedClip.start } : {}),
        language: $('#transform-lang').value || 'auto',
        sttProvider: $('#transform-stt-provider').value || undefined,
        genre: $('#transform-genre')?.value || undefined,
        customPrompt: $('#transform-custom-prompt')?.value.trim() || undefined,
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
  $('#btn-rerender-hooks')?.addEventListener('click', rerenderHooks);

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

  function updateClipSelectionUI() {
    const selectedCount = clipState.selected.size;
    const summary = $('#clip-selection-summary');
    const chipsWrap = $('#clip-selected-chips');
    const countEl = $('#clip-selected-count');
    const totalDurEl = $('#clip-total-duration');

    if (summary) {
      summary.classList.toggle('hidden', selectedCount === 0);
    }

    if (countEl) countEl.textContent = String(selectedCount);

    let totalSec = 0;
    const selectedArray = [...clipState.selected.entries()]; // [[clipId, info], ...]

    if (chipsWrap) {
      chipsWrap.innerHTML = '';
      selectedArray.forEach(([clipId, info], index) => {
        const order = index + 1;
        const dur = info.durationSeconds ?? (info.end - info.start);
        totalSec += dur;
        const chip = document.createElement('span');
        chip.className = 'clip-selected-chip';
        chip.innerHTML =
          `<span class="chip-order">${order}</span>` +
          `<span class="chip-title" title="${esc(info.title || `Klip #${order}`)}">${esc(info.title || `Klip #${order}`)}</span>` +
          `<span class="chip-time">(${fmtDuration(info.start)}–${fmtDuration(info.end)})</span>` +
          `<span class="chip-remove" title="Hapus klip ini">✕</span>`;
        chip.querySelector('.chip-remove')?.addEventListener('click', (e) => {
          e.stopPropagation();
          clipState.selected.delete(clipId);
          updateClipSelectionUI();
          toast(`Klip #${order} dihapus dari pilihan reel`, '');
        });
        chipsWrap.appendChild(chip);
      });
    }

    if (totalDurEl) totalDurEl.textContent = `${totalSec.toFixed(1)}s`;

    // Update each clip card in the list
    $$('.clip-item').forEach((item) => {
      const clipId = item.dataset.clipId;
      const order = selectedArray.findIndex(([id]) => id === clipId) + 1;
      const isSel = order > 0;
      item.classList.toggle('selected', isSel);

      let badge = item.querySelector('.clip-order-badge');
      if (isSel) {
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'clip-order-badge';
          const headline = item.querySelector('.hook-headline');
          headline?.parentElement?.insertBefore(badge, headline);
        }
        badge.innerHTML = `🎬 Urutan #${order}`;
      } else if (badge) {
        badge.remove();
      }

      const hint = item.querySelector('.hook-clear-hint');
      if (hint) {
        hint.textContent = isSel ? `✅ Dipilih (#${order})` : 'pilih';
      }
    });
  }

  function renderClips(data) {
    const list = $('#clip-list');
    const clips = data?.clips ?? [];
    list.innerHTML = '';
    $('#clip-meta').textContent =
      `${data.candidateCount ?? 0} kandidat · Top-${clips.length}` +
      (data.cached ? ' · 📦 hasil tersimpan (tanpa regenerate)' : '');

    if (clips.length === 0) {
      list.innerHTML = '<p class="muted small">Tidak ada klip viral ditemukan. Coba ulangi lagi.</p>';
      updateClipSelectionUI();
      return;
    }

    clips.forEach((clip) => {
      const isSelected = clipState.selected.has(clip.id);
      const order = isSelected ? [...clipState.selected.keys()].indexOf(clip.id) + 1 : 0;
      const item = document.createElement('div');
      item.className = 'hook-item clip-item' + (isSelected ? ' selected' : '');
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      item.dataset.clipId = clip.id;

      item.innerHTML =
        buildPreviewVideo(clip.previewUrl, `Preview klip ${clip.rank}`) +
        `<div class="hook-rank">${clip.rank}</div>` +
        `<div class="hook-body">` +
          (isSelected ? `<div class="clip-order-badge">🎬 Urutan #${order}</div>` : '') +
          `<div class="hook-headline">${esc(clip.title)}</div>` +
          `<div class="hook-spoken">“${esc(clip.hook)}”</div>` +
          `<div class="hook-meta-row">` +
            `<span class="hook-score">${Math.round(clip.score)}/100</span>` +
            `<span class="hook-time">sumber ${fmtDuration(clip.start)}–${fmtDuration(clip.end)}</span>` +
            `<span class="hook-time">⏱ ${clip.durationSeconds.toFixed(1)}s</span>` +
          `</div>` +
        `</div>` +
        `<span class="hook-clear-hint">${isSelected ? `✅ Dipilih (#${order})` : 'pilih'}</span>`;

      const toggle = () => {
        if (clipState.selected.has(clip.id)) {
          clipState.selected.delete(clip.id);
        } else {
          clipState.selected.set(clip.id, {
            start: clip.start,
            end: clip.end,
            title: clip.title,
            durationSeconds: clip.durationSeconds,
          });
        }
        updateClipSelectionUI();
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

    updateClipSelectionUI();
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
      updateClipSelectionUI();
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
    updateClipSelectionUI();
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

  /* ---------- Transcript Editor ---------- */
  const transcriptState = {
    videoId: null,
    sourceUrl: '',
    language: 'id',
    segments: [],
    originalTexts: [],
    filterQuery: '',
  };

  function updateTranscriptMeta() {
    const totalSec = transcriptState.segments.length > 0
      ? transcriptState.segments[transcriptState.segments.length - 1].end
      : 0;

    const modifiedCount = transcriptState.segments.filter(
      (seg, i) => seg.text !== (transcriptState.originalTexts[i] ?? seg.text),
    ).length;

    const badge = $('#transcript-count-badge');
    if (badge) badge.textContent = `${transcriptState.segments.length} Segmen`;

    const chipVideoId = $('#chip-video-id');
    const chipDuration = $('#chip-duration');
    const chipSegments = $('#chip-segments');
    const chipLanguage = $('#chip-language');
    const chipModified = $('#chip-modified');

    if (chipVideoId) chipVideoId.textContent = `🏷️ Video: ${transcriptState.videoId || '—'}`;
    if (chipDuration) chipDuration.textContent = `⏱️ Durasi: ${fmtDuration(totalSec)}`;
    if (chipSegments) chipSegments.textContent = `📝 ${transcriptState.segments.length} Segmen`;
    if (chipLanguage) chipLanguage.textContent = `🌐 STT: ${transcriptState.language?.toUpperCase() || 'AUTO'}`;

    if (chipModified) {
      if (modifiedCount > 0) {
        chipModified.textContent = `✏️ ${modifiedCount} segmen diubah`;
        chipModified.classList.remove('hidden');
      } else {
        chipModified.classList.add('hidden');
      }
    }
  }

  function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(48, textarea.scrollHeight)}px`;
  }

  function renderTranscriptSegments() {
    const list = $('#transcript-segment-list');
    if (!list) return;
    list.innerHTML = '';

    if (transcriptState.segments.length === 0) {
      list.innerHTML = '<div class="transcript-loading muted">Belum ada segmen transkrip yang dimuat.</div>';
      return;
    }

    const query = transcriptState.filterQuery.trim().toLowerCase();
    const filterOnly = $('#transcript-filter-only')?.checked ?? true;
    const clearSearchBtn = $('#btn-clear-search');
    const matchCountEl = $('#transcript-match-count');

    let matchedCount = 0;
    const itemsToRender = [];

    transcriptState.segments.forEach((seg, idx) => {
      const isMatched = query ? seg.text.toLowerCase().includes(query) : false;
      if (isMatched) matchedCount++;
      const isModified = seg.text !== (transcriptState.originalTexts[idx] ?? seg.text);

      if (!query || !filterOnly || isMatched) {
        itemsToRender.push({ seg, idx, isMatched, isModified });
      }
    });

    if (clearSearchBtn) {
      clearSearchBtn.classList.toggle('hidden', !query);
    }

    if (matchCountEl) {
      if (query) {
        matchCountEl.textContent = `🎯 ${matchedCount} cocok`;
        matchCountEl.classList.remove('hidden');
      } else {
        matchCountEl.classList.add('hidden');
      }
    }

    if (query && itemsToRender.length === 0) {
      list.innerHTML = `
        <div class="transcript-loading muted">
          <p>🔍 Tidak ada segmen yang mengandung kata <strong>"${esc(query)}"</strong>.</p>
          <button type="button" class="btn small ghost" style="margin-top:8px;" id="btn-reset-search-view">✕ Bersihkan Filter Pencarian</button>
        </div>
      `;
      $('#btn-reset-search-view')?.addEventListener('click', () => {
        $('#transcript-search').value = '';
        transcriptState.filterQuery = '';
        renderTranscriptSegments();
      });
      return;
    }

    itemsToRender.forEach(({ seg, idx, isMatched, isModified }) => {
      const card = document.createElement('div');
      card.className = 'transcript-segment-card' +
        (isMatched ? ' matched' : '') +
        (isModified ? ' is-modified' : '');
      card.dataset.idx = String(idx);

      const wordsCount = seg.text.trim().split(/\s+/).filter(Boolean).length;
      const durationSec = (seg.end - seg.start).toFixed(1);

      card.innerHTML = `
        <div class="segment-meta-header">
          <span class="segment-time-badge">${fmtDuration(seg.start)} ➔ ${fmtDuration(seg.end)}</span>
          <div class="segment-meta-right">
            <span class="segment-index-badge">#${idx + 1} (${durationSec}s · ${wordsCount} kata)</span>
            ${isModified ? '<span class="segment-modified-tag">✏️ Diedit</span>' : ''}
          </div>
        </div>
        <textarea class="segment-textarea" data-idx="${idx}" placeholder="Teks segmen...">${esc(seg.text)}</textarea>
      `;

      const textarea = card.querySelector('textarea');
      textarea.addEventListener('input', (e) => {
        transcriptState.segments[idx].text = e.target.value;
        const nowModified = e.target.value !== (transcriptState.originalTexts[idx] ?? e.target.value);
        card.classList.toggle('is-modified', nowModified);
        autoResizeTextarea(e.target);
        updateTranscriptMeta();
      });

      // Auto size initial height
      setTimeout(() => autoResizeTextarea(textarea), 0);

      list.appendChild(card);
    });
  }

  async function loadTranscript(force = false) {
    const url = $('#transform-url').value.trim();
    if (!url) {
      toast('Masukkan URL YouTube terlebih dahulu', 'error');
      $('#transform-url').focus();
      return;
    }

    const btn = $('#btn-open-transcript');
    const panel = $('#transcript-panel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const list = $('#transcript-segment-list');
    if (list) list.innerHTML = '<div class="transcript-loading muted">🎙️ Mengambil & memproses transkrip audio video…</div>';

    if (btn) btn.disabled = true;

    try {
      const sttProvider = $('#transform-stt-provider')?.value || undefined;
      const params = new URLSearchParams({
        youtubeUrl: url,
        ...(sttProvider ? { sttProvider } : {}),
        ...(force ? { force: 'true' } : {}),
      });

      const res = await apiGet(`/api/transcript?${params.toString()}`);
      if (!res.success || !res.transcript) {
        throw new Error('Gagal memuat transkrip');
      }

      transcriptState.videoId = res.videoId;
      transcriptState.sourceUrl = res.transcript.sourceUrl || url;
      transcriptState.language = res.transcript.language || 'id';
      transcriptState.segments = (res.transcript.segments || []).map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text,
        words: s.words,
      }));
      transcriptState.originalTexts = transcriptState.segments.map((s) => s.text);

      updateTranscriptMeta();
      renderTranscriptSegments();
      toast(res.cached ? 'Transkrip dimuat dari penyimpanan' : 'Transkrip baru berhasil diproses', 'success');
      const statusEl = $('#transcript-quick-status');
      if (statusEl) statusEl.textContent = `✅ Transkrip siap (${transcriptState.segments.length} segmen)`;
    } catch (err) {
      if (list) list.innerHTML = `<div class="transcript-loading muted" style="color:var(--accent)">⚠️ Gagal memuat transkrip: ${esc(err.message)}</div>`;
      toast(`Gagal memuat transkrip: ${err.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function saveTranscript() {
    if (!transcriptState.videoId || transcriptState.segments.length === 0) {
      toast('Belum ada transkrip yang dimuat', 'error');
      return;
    }

    const btnSaveTop = $('#btn-save-transcript');
    const btnSaveBottom = $('#btn-save-transcript-bottom');
    if (btnSaveTop) btnSaveTop.disabled = true;
    if (btnSaveBottom) btnSaveBottom.disabled = true;

    try {
      const payload = {
        videoId: transcriptState.videoId,
        language: transcriptState.language,
        segments: transcriptState.segments,
      };

      await apiPost('/api/transcript/update', payload);
      transcriptState.originalTexts = transcriptState.segments.map((s) => s.text);
      updateTranscriptMeta();
      renderTranscriptSegments();
      toast('✅ Transkrip berhasil disimpan!', 'success');
      const statusEl = $('#transcript-quick-status');
      if (statusEl) statusEl.textContent = '✅ Transkrip diperbarui & tersimpan';
    } catch (err) {
      toast(`Gagal menyimpan transkrip: ${err.message}`, 'error');
    } finally {
      if (btnSaveTop) btnSaveTop.disabled = false;
      if (btnSaveBottom) btnSaveBottom.disabled = false;
    }
  }

  function handleReplaceAll() {
    const findWord = $('#transcript-find')?.value;
    const replaceWord = $('#transcript-replace')?.value ?? '';

    if (!findWord) {
      toast('Masukkan kata salah (typo) yang ingin dicari', 'error');
      $('#transcript-find')?.focus();
      return;
    }

    let count = 0;
    transcriptState.segments.forEach((seg) => {
      if (seg.text.includes(findWord)) {
        const occurrences = seg.text.split(findWord).length - 1;
        count += occurrences;
        seg.text = seg.text.replaceAll(findWord, replaceWord);
      }
    });

    updateTranscriptMeta();
    renderTranscriptSegments();
    if (count > 0) {
      toast(`Berhasil mengganti ${count} kata "${findWord}" dengan "${replaceWord}"`, 'success');
    } else {
      toast(`Kata "${findWord}" tidak ditemukan dalam transkrip`, '');
    }
  }

  $('#btn-open-transcript')?.addEventListener('click', () => loadTranscript(false));
  $('#btn-reload-transcript')?.addEventListener('click', () => loadTranscript(true));
  $('#btn-close-transcript')?.addEventListener('click', () => $('#transcript-panel')?.classList.add('hidden'));
  $('#btn-save-transcript')?.addEventListener('click', saveTranscript);
  $('#btn-save-transcript-bottom')?.addEventListener('click', saveTranscript);
  $('#btn-replace-all')?.addEventListener('click', handleReplaceAll);
  $('#btn-clear-search')?.addEventListener('click', () => {
    const searchInput = $('#transcript-search');
    if (searchInput) searchInput.value = '';
    transcriptState.filterQuery = '';
    renderTranscriptSegments();
  });
  $('#transcript-filter-only')?.addEventListener('change', () => {
    renderTranscriptSegments();
  });
  $('#transcript-search')?.addEventListener('input', (e) => {
    transcriptState.filterQuery = e.target.value;
    const findInput = $('#transcript-find');
    if (findInput && (!findInput.value || findInput.dataset.autoFilled === 'true')) {
      findInput.value = e.target.value.trim();
      findInput.dataset.autoFilled = 'true';
    }
    renderTranscriptSegments();
  });
  /* ---------- Script & Narration Editor ---------- */
  const scriptState = {
    active: false,
    language: 'id',
    sections: [],
    audioUrl: null,
    synthesized: null,
  };

  function getScriptVoiceFingerprint() {
    const provider = $('#transform-tts-provider')?.value || '';
    const voice = $('#transform-voice')?.value || '';
    const rate = $('#transform-tts-rate')?.value || '';
    const lang = scriptState.language || $('#transform-lang')?.value || 'id';
    const content = scriptState.sections.map((s) => `${s.type}:${(s.text || '').trim()}:${(s.spokenText || '').trim()}`).join('|||');
    return `${provider}|${voice}|${rate}|${lang}|${content}`;
  }

  const SCRIPT_SECTION_TYPES = [
    { value: 'hook', label: '🪝 Hook (Pembuka)' },
    { value: 'context', label: '📖 Context (Latar Belakang)' },
    { value: 'commentary', label: '💭 Commentary (Komentar)' },
    { value: 'analysis', label: '📊 Analysis (Analisis)' },
    { value: 'supporting', label: '💡 Supporting (Pendukung)' },
    { value: 'conclusion', label: '🎯 Conclusion (Penutup)' },
  ];

  function updateScriptMeta() {
    const totalWords = scriptState.sections.reduce((sum, s) => sum + s.text.trim().split(/\s+/).filter(Boolean).length, 0);
    const estDuration = Math.max(10, Math.round(totalWords / 2.5));

    const badge = $('#script-section-count-badge');
    if (badge) badge.textContent = `${scriptState.sections.length} Seksi`;

    const chipSections = $('#chip-script-sections');
    const chipWords = $('#chip-script-words');
    const chipDuration = $('#chip-script-duration');
    const chipVoice = $('#chip-script-voice');
    const chipStatus = $('#chip-script-status');

    if (chipSections) chipSections.textContent = `📑 ${scriptState.sections.length} Seksi`;
    if (chipWords) chipWords.textContent = `💬 ~${totalWords} kata`;
    if (chipDuration) chipDuration.textContent = `⏱️ Est. ${estDuration}s`;
    if (chipVoice) {
      const voice = $('#transform-voice')?.value || $('#transform-tts-provider')?.value || 'TTS';
      chipVoice.textContent = `🎙️ ${voice}`;
    }
    if (chipStatus) {
      chipStatus.textContent = scriptState.active ? '✅ Naskah Kustom Aktif' : '🤖 Auto LLM';
      chipStatus.classList.toggle('chip-modified', scriptState.active);
    }
  }

  function renderScriptSections() {
    const container = $('#script-sections-container');
    if (!container) return;
    container.innerHTML = '';

    if (scriptState.sections.length === 0) {
      container.innerHTML = '<div class="script-loading muted">Belum ada seksi naskah. Klik "Draf Naskah AI" untuk memulai.</div>';
      return;
    }

    scriptState.sections.forEach((section, idx) => {
      const card = document.createElement('div');
      card.className = 'script-section-card';
      card.dataset.idx = String(idx);

      const wordsCount = section.text.trim().split(/\s+/).filter(Boolean).length;
      const estSec = Math.max(1, Math.round(wordsCount / 2.5));

      const typeOptionsHtml = SCRIPT_SECTION_TYPES.map(
        (t) => `<option value="${t.value}" ${t.value === section.type ? 'selected' : ''}>${t.label}</option>`
      ).join('');

      card.innerHTML = `
        <div class="script-section-head">
          <div style="display:flex;align-items:center;gap:8px;">
            <select class="script-section-type-select" data-idx="${idx}">
              ${typeOptionsHtml}
            </select>
            <span class="muted small">#${idx + 1} · ${wordsCount} kata (~${estSec}s)</span>
          </div>
          <div class="script-section-actions">
            <button type="button" class="section-action-btn" data-action="move-up" data-idx="${idx}" title="Pindah ke atas" ${idx === 0 ? 'disabled style="opacity:0.4"' : ''}>⬆️</button>
            <button type="button" class="section-action-btn" data-action="move-down" data-idx="${idx}" title="Pindah ke bawah" ${idx === scriptState.sections.length - 1 ? 'disabled style="opacity:0.4"' : ''}>⬇️</button>
            <button type="button" class="section-action-btn btn-delete" data-action="delete" data-idx="${idx}" title="Hapus seksi">🗑️</button>
          </div>
        </div>
        <div style="margin-top:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span class="small muted" style="font-weight:600;">📺 Teks Layar (Subtitle Visual):</span>
          </div>
          <textarea class="script-section-textarea" data-idx="${idx}" placeholder="Tulis narasi untuk subtitle visual (misal: Tottenham menghabiskan 226 juta pound)...">${esc(section.text)}</textarea>
        </div>
        <div style="margin-top:6px;">
          <details style="border-radius:6px;background:rgba(255,255,255,0.03);padding:6px 10px;border:1px solid rgba(255,255,255,0.08);">
            <summary style="cursor:pointer;font-size:12px;color:var(--text-muted, #aaa);font-weight:500;user-select:none;">
              🗣️ Pelafalan Suara TTS: <span style="font-style:italic;opacity:0.8;">${section.spokenText ? 'kustom aktif' : 'otomatis (terbilang angka & fonetik)'}</span>
            </summary>
            <div style="margin-top:6px;">
              <textarea class="script-section-spoken-textarea" data-idx="${idx}" style="width:100%;min-height:50px;font-size:13px;border-radius:4px;padding:6px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);color:inherit;box-sizing:border-box;font-family:inherit;" placeholder="Teks yang dibaca audio TTS (misal: Tot-nem menghabiskan dua ratus dua puluh enam juta paund)... Kosongkan untuk auto-normalisasi.">${esc(section.spokenText || '')}</textarea>
            </div>
          </details>
        </div>
      `;

      const select = card.querySelector('.script-section-type-select');
      select.addEventListener('change', (e) => {
        scriptState.sections[idx].type = e.target.value;
      });

      const textarea = card.querySelector('.script-section-textarea');
      textarea.addEventListener('input', (e) => {
        scriptState.sections[idx].text = e.target.value;
        autoResizeTextarea(e.target);
        updateScriptMeta();
      });

      const spokenTextarea = card.querySelector('.script-section-spoken-textarea');
      if (spokenTextarea) {
        spokenTextarea.addEventListener('input', (e) => {
          scriptState.sections[idx].spokenText = e.target.value.trim() || undefined;
          autoResizeTextarea(e.target);
        });
      }

      setTimeout(() => {
        autoResizeTextarea(textarea);
        if (spokenTextarea) autoResizeTextarea(spokenTextarea);
      }, 0);

      container.appendChild(card);
    });

    // Wire action buttons
    container.querySelectorAll('.section-action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const idx = Number(e.currentTarget.dataset.idx);
        if (action === 'delete') {
          scriptState.sections.splice(idx, 1);
          if (scriptState.sections.length === 0) scriptState.active = false;
          renderScriptSections();
          updateScriptMeta();
        } else if (action === 'move-up' && idx > 0) {
          const temp = scriptState.sections[idx];
          scriptState.sections[idx] = scriptState.sections[idx - 1];
          scriptState.sections[idx - 1] = temp;
          renderScriptSections();
          updateScriptMeta();
        } else if (action === 'move-down' && idx < scriptState.sections.length - 1) {
          const temp = scriptState.sections[idx];
          scriptState.sections[idx] = scriptState.sections[idx + 1];
          scriptState.sections[idx + 1] = temp;
          renderScriptSections();
          updateScriptMeta();
        }
      });
    });
  }

  async function generateDraftScript() {
    const url = $('#transform-url').value.trim();
    if (!url) {
      toast('Masukkan URL YouTube terlebih dahulu', 'error');
      $('#transform-url').focus();
      return;
    }

    const btn = $('#btn-gen-script');
    if (btn) btn.disabled = true;
    const panel = $('#script-editor-panel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const container = $('#script-sections-container');
    if (container) container.innerHTML = '<div class="script-loading muted">🤖 AI sedang menyusun draf naskah narasi orisinal (tanpa TTS)…</div>';

    try {
      const body = {
        youtubeUrl: url,
        language: $('#transform-lang')?.value || 'auto',
        sttProvider: $('#transform-stt-provider')?.value || undefined,
        genre: $('#transform-genre')?.value || undefined,
        customPrompt: $('#transform-custom-prompt')?.value.trim() || undefined,
        ...(clipState.selected.size > 0 ? { selectedClips: [...clipState.selected.values()] } : {}),
        ...(hookState.selected ? {
          sourceRange: {
            start: hookState.selected.source?.start ?? 0,
            end: hookState.selected.source?.end ?? 30,
          },
          hookTitle: hookState.selected.headline?.text,
          hookTag: hookState.selected.headline?.tag,
          hookHighlightWords: hookState.selected.headline?.highlightWords,
          customHook: hookState.selected.spokenHook?.text || hookState.selected.headline?.text,
        } : {}),
      };

      const res = await apiPost('/api/scripts/draft', body);
      const scriptData = res.script || {};

      if (!scriptData.sections?.length) {
        throw new Error('Draf naskah kosong dari server.');
      }

      scriptState.active = true;
      scriptState.language = scriptData.language || 'id';
      scriptState.audioUrl = null;
      $('#script-audio-preview')?.classList.add('hidden');

      scriptState.sections = scriptData.sections.map((s) => ({
        type: s.type || 'context',
        text: s.text || '',
        spokenText: s.spokenText || undefined,
        sourceQuote: s.sourceQuote,
        evidence: s.evidence,
        beatId: s.beatId,
      }));

      updateScriptMeta();
      renderScriptSections();
      toast('✅ Draf naskah AI siap! Silakan review & edit teks. Klik "Tes Suara TTS" jika ingin mendengarkan audio.', 'success');
      const statusEl = $('#script-quick-status');
      if (statusEl) statusEl.textContent = '✅ Draf naskah AI siap diedit';
    } catch (err) {
      if (container) container.innerHTML = `<div class="script-loading muted" style="color:var(--accent)">⚠️ Gagal membuat draf naskah: ${esc(err.message)}</div>`;
      toast(`Gagal membuat draf naskah: ${err.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function previewCustomTts() {
    const url = $('#transform-url').value.trim();
    if (!url) {
      toast('Masukkan URL YouTube terlebih dahulu', 'error');
      return;
    }

    if (scriptState.sections.length === 0) {
      toast('Belum ada seksi naskah untuk disuarakan', 'error');
      return;
    }

    const btn1 = $('#btn-preview-tts');
    const btn2 = $('#btn-preview-tts-bottom');
    if (btn1) btn1.disabled = true;
    if (btn2) btn2.disabled = true;
    toast('🔊 Menyintesis audio TTS untuk naskah…', 'info');

    try {
      const body = {
        youtubeUrl: url,
        ttsProvider: $('#transform-tts-provider')?.value || undefined,
        ttsVoice: $('#transform-voice')?.value || undefined,
        ttsRate: $('#transform-tts-rate')?.value || undefined,
        customScript: {
          language: scriptState.language || $('#transform-lang')?.value || 'id',
          sections: scriptState.sections,
        },
      };

      const res = await apiPost('/api/tts/synthesize', body);
      const narrationData = res.narration || {};

      if (narrationData.url) {
        scriptState.audioUrl = narrationData.url;
        scriptState.synthesized = {
          fingerprint: getScriptVoiceFingerprint(),
          narration: narrationData,
        };
        const player = $('#script-audio-player');
        const audioWrap = $('#script-audio-preview');
        const durLabel = $('#audio-preview-duration');
        if (player) {
          player.src = narrationData.url + '?_v=' + Date.now();
          player.play().catch(() => {});
        }
        if (durLabel) durLabel.textContent = `${fmtDuration(narrationData.durationSeconds || 0)} (${(narrationData.durationSeconds || 0).toFixed(1)}s)`;
        if (audioWrap) audioWrap.classList.remove('hidden');
        toast('🔊 Audio TTS siap diputar!', 'success');
      } else {
        toast('TTS selesai tapi tidak ada URL audio yang dikembalikan.', 'info');
      }
    } catch (err) {
      toast(`Gagal sintesis audio TTS: ${err.message}`, 'error');
    } finally {
      if (btn1) btn1.disabled = false;
      if (btn2) btn2.disabled = false;
    }
  }

  function addEmptyScriptSection() {
    scriptState.active = true;
    scriptState.sections.push({
      type: 'supporting',
      text: '',
    });
    renderScriptSections();
    updateScriptMeta();
    const lastTextarea = $('#script-sections-container .script-section-card:last-child textarea');
    if (lastTextarea) lastTextarea.focus();
  }

  function clearScriptEditor() {
    scriptState.active = false;
    scriptState.sections = [];
    scriptState.audioUrl = null;
    scriptState.synthesized = null;
    $('#script-editor-panel')?.classList.add('hidden');
    $('#script-audio-preview')?.classList.add('hidden');
    updateScriptMeta();
    const statusEl = $('#script-quick-status');
    if (statusEl) statusEl.textContent = 'Biarkan kosong jika ingin AI men-generate otomatis saat transformasi';
    toast('Editor naskah dibersihkan. Transformasi akan memakai auto LLM.', '');
  }

  $('#btn-gen-script')?.addEventListener('click', generateDraftScript);
  $('#btn-preview-tts')?.addEventListener('click', previewCustomTts);
  $('#btn-preview-tts-bottom')?.addEventListener('click', previewCustomTts);
  $('#btn-add-section')?.addEventListener('click', addEmptyScriptSection);
  $('#btn-add-section-bottom')?.addEventListener('click', addEmptyScriptSection);
  $('#btn-clear-script')?.addEventListener('click', clearScriptEditor);

  /* ---------- Research ---------- */
  // Preset chip event handlers in Research tab
  $$('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const kw = chip.dataset.keyword;
      const subs = chip.dataset.subs;
      if (kw) $('#res-keyword').value = kw;
      if (subs) $('#res-subreddits').value = subs;
      toast(`Preset "${chip.textContent.trim()}" diterapkan`, 'success');
      // Highlight briefly
      chip.classList.add('preset-active');
      setTimeout(() => chip.classList.remove('preset-active'), 1200);
    });
  });

  $('#btn-research').addEventListener('click', async () => {
    const btn = $('#btn-research');
    btn.disabled = true;
    $('#research-results').classList.add('hidden');
    $('#research-error').classList.add('hidden');
    setProgress('research', true, 12, '📡 Mengumpulkan sinyal dari RSS, Reddit, Trends & X…');

    try {
      const body = {
        max_trends: Number($('#res-max-trends').value) || 10,
        language: $('#res-language').value,
      };
      const keyword = $('#res-keyword').value.trim();
      if (keyword) body.keyword = keyword;
      const subs = $('#res-subreddits').value.trim();
      if (subs) body.subreddits = subs;

      const selectedProviders = $$('#res-providers .chip-toggle.active')
        .map((c) => c.dataset.provider)
        .filter(Boolean);
      if (selectedProviders.length > 0) body.providers = selectedProviders;

      setProgress('research', true, 45, '🤖 Menganalisis & merangking topik viral dengan AI…');
      const data = await apiPost('/api/research', body);
      setProgress('research', true, 90, '🎬 Menemukan rekomendasi video YouTube…');
      await new Promise((r) => setTimeout(r, 350));
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

    const countBadge = $('#research-count-badge');
    if (countBadge) {
      countBadge.textContent = `${trends.length} Topik`;
    }

    $('#research-meta').textContent =
      `${trends.length} topik dari ${data.signalCount ?? 0} sinyal` +
      (data.skippedSources?.length
        ? ` · dilewati: ${data.skippedSources.map((s) => s.source).join(', ')}`
        : '');

    if (trends.length === 0) {
      list.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
          <h3>Tidak Ada Topik Ditemukan</h3>
          <p class="muted">Coba ganti kata kunci pencarian atau aktifkan lebih banyak provider sinyal.</p>
        </div>`;
      $('#research-results').classList.remove('hidden');
      return;
    }

    trends.forEach((trend, idx) => {
      const card = document.createElement('div');
      card.className = 'trend-card';

      // Virality Score styling
      const score = Number(trend.score ?? 0);
      let scoreClass = 'score-high';
      let scoreEmoji = '🔥';
      if (score < 60) {
        scoreClass = 'score-low';
        scoreEmoji = '📈';
      } else if (score < 80) {
        scoreClass = 'score-mid';
        scoreEmoji = '⚡';
      }

      // Keywords list
      const kwList = (trend.keywords || '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const kwHtml = kwList.length
        ? `<div class="trend-keywords-wrap">
            <span class="kw-label">🏷️ Keyword:</span>
            <div class="trend-keywords-list">
              ${kwList.map((kw) => `<span class="trend-kw-chip" title="Gunakan keyword ini">${esc(kw)}</span>`).join('')}
            </div>
           </div>`
        : '';

      // Sources badges
      const sourcesSet = new Set((trend.sources || []).map((s) => s.source).filter(Boolean));
      const sourceIcons = {
        rss: '📰 RSS',
        reddit: '🤖 Reddit',
        trends: '📈 Trends',
        x: '🐦 X',
      };
      const sourceBadges = Array.from(sourcesSet)
        .map((src) => `<span class="trend-source-pill">${sourceIcons[src] || esc(src)}</span>`)
        .join('');

      // Topic date
      const topicDate = trend.publishedAt || data.generatedAt;
      const dateBadge = topicDate
        ? `<span class="trend-date-badge" title="Waktu konten/sinyal dibuat">📅 ${fmtDateTime(topicDate)}</span>`
        : '';

      // Videos grid
      const videos = trend.videos || [];
      const videosHtml = videos.length
        ? `<div class="trend-videos-container">
            <div class="trend-videos-header">
              <span class="trend-videos-title">🎬 Rekomendasi Video YouTube (${videos.length})</span>
              <span class="trend-videos-subtitle">Pilih video untuk ditransformasikan jadi klip 9:16</span>
            </div>
            <div class="videos-grid">
              ${videos.map((v) => `
                <div class="video-card">
                  <div class="video-card-thumb-wrap">
                    ${v.thumbnailUrl
                      ? `<img class="video-card-thumb" src="${esc(v.thumbnailUrl)}" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\\'video-card-placeholder\\\'>🎬</div>'">`
                      : `<div class="video-card-placeholder">🎬</div>`}
                    ${v.durationSeconds != null ? `<span class="video-card-duration">${fmtDuration(v.durationSeconds)}</span>` : ''}
                  </div>
                  <div class="video-card-body">
                    <div class="video-card-title" title="${esc(v.title)}">${esc(v.title)}</div>
                    <div class="video-card-meta">
                      ${v.channel ? `<span class="video-card-channel" title="${esc(v.channel)}">👤 ${esc(v.channel)}</span>` : ''}
                      ${v.publishedAt ? `<span class="video-card-date" title="Tanggal rilis video">📅 ${fmtDate(v.publishedAt)}</span>` : ''}
                      ${v.viewCount != null ? `<span class="video-card-views">👁️ ${fmtViews(v.viewCount)}</span>` : ''}
                    </div>
                    <div class="video-card-actions">
                      <button type="button" class="btn primary small" data-action="clip" data-url="${esc(v.url)}" title="Pakai video ini di tab Transform">
                        ⚡ Buat Klip
                      </button>
                      <button type="button" class="btn ghost small" data-action="copy" data-url="${esc(v.url)}" title="Salin URL YouTube">
                        📋 Salin
                      </button>
                      <a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" class="btn ghost small icon-only-btn" title="Buka di YouTube">
                        ↗️
                      </a>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`
        : `<div class="trend-no-videos">
            <p class="muted">Belum ada video YouTube yang otomatis cocok untuk topik ini.</p>
           </div>`;

      card.innerHTML = `
        <div class="trend-head">
          <div class="trend-rank">#${idx + 1}</div>
          <div class="trend-title-box">
            <div class="trend-title">${esc(trend.title)}</div>
            <div class="trend-meta-badges">
              <span class="trend-cat">${esc(trend.category || 'Trending')}</span>
              ${dateBadge}
              ${sourceBadges}
            </div>
          </div>
          <div class="score-badge ${scoreClass}">
            <span class="score-val">${scoreEmoji} ${score}</span>
            <span class="score-lbl">VIRAL SCORE</span>
          </div>
        </div>

        ${trend.summary ? `
          <div class="trend-summary-box">
            <div class="trend-summary-title">💡 Mengapa Topik Ini Viral:</div>
            <p class="trend-summary-text">${esc(trend.summary)}</p>
          </div>` : ''}

        ${kwHtml}
        ${videosHtml}
      `;

      list.appendChild(card);
    });

    // Add click handler for keyword chips to quickly populate search input
    $$('.trend-kw-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        $('#res-keyword').value = chip.textContent.trim();
        toast(`Keyword "${chip.textContent.trim()}" diset ke pencarian`, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    $('#research-results').classList.remove('hidden');
  }

  /* ---------- Transform Pipeline ---------- */
  async function runTransform(triggerBtn) {
    const url = $('#transform-url').value.trim();
    if (!url) {
      toast('Masukkan URL YouTube dulu', 'error');
      $('#transform-url').focus();
      return;
    }

    const btn = triggerBtn || $('#btn-transform');
    if (btn) btn.disabled = true;
    $('#transform-results').classList.add('hidden');
    $('#transform-error').classList.add('hidden');
    $('#transform-stages').classList.remove('hidden');

    // Reel mode needs at least one selected viral clip.
    if (($('#transform-output-mode')?.value || 'narration') === 'reel' && clipState.selected.size === 0) {
      if (btn) btn.disabled = false;
      toast('Mode Reel: pilih minimal 1 klip viral dulu (Step 4)', 'error');
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
      const outputMode = $('#transform-output-mode')?.value || 'narration';
      const generateCaptions = $('#transform-generate-captions')?.checked ?? true;
      const captionPlatforms = getSelectedCaptionPlatforms();
      const captionCreditTemplate = getCaptionCreditTemplate();

      // Mode Reel tidak memakai engine/STT/bahasa/TTS/channel/badge —
      // field tersebut hanya dikirim di mode Narasi.
      const body = outputMode === 'reel'
        ? {
            youtubeUrl: url,
            outputMode,
            selectedClips: [...clipState.selected.values()],
            dryRun: $('#transform-dry-run')?.checked || false,
            generateCaptions,
            ...(captionPlatforms.length > 0 ? { captionPlatforms } : {}),
            ...(captionCreditTemplate !== undefined ? { captionCreditTemplate } : {}),
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
        : (() => {
            const blurEnabled = $('#transform-blur-watermark')?.checked || false;
            const blurMode = $('#transform-blur-mode')?.value || 'preset';
            const selectedPositions = blurEnabled && blurMode === 'preset'
              ? $$('#blur-positions .chip-toggle.active').map((c) => c.dataset.position).filter(Boolean)
              : undefined;
            const blurWatermark = blurEnabled
              ? { enabled: true, mode: blurMode, ...(selectedPositions?.length ? { positions: selectedPositions } : {}) }
              : undefined;
            return {
              youtubeUrl: url,
              engine: 'remotion',
              language: $('#transform-lang').value || 'auto',
              sttProvider: $('#transform-stt-provider').value || undefined,
              ttsProvider: $('#transform-tts-provider').value || undefined,
              ttsVoice: $('#transform-voice').value || undefined,
              ttsRate: $('#transform-tts-rate')?.value || undefined,
              genre: $('#transform-genre')?.value || undefined,
              style: $('#transform-genre')?.value === 'sports' ? 'sports' : undefined,
              customPrompt: $('#transform-custom-prompt')?.value.trim() || undefined,
              hookBadge: $('#transform-hook-badge')?.value.trim() || undefined,
              channel: { name: $('#transform-channel').value.trim() || undefined },
              dryRun: $('#transform-dry-run')?.checked || false,
              generateCaptions,
              ...(captionPlatforms.length > 0 ? { captionPlatforms } : {}),
              ...(captionCreditTemplate !== undefined ? { captionCreditTemplate } : {}),
              ...(blurWatermark ? { blur_watermark: blurWatermark } : {}),
              ...(clipState.selected.size > 0
                ? { selectedClips: [...clipState.selected.values()] }
                : {}),
              ...(hookState.selected
                ? {
                    sourceRange: {
                      start: hookState.selected.source?.start ?? 0,
                      end: hookState.selected.source?.end ?? 30,
                    },
                    hookTitle: hookState.selected.headline?.text,
                    hookTag: hookState.selected.headline?.tag,
                    hookHighlightWords: hookState.selected.headline?.highlightWords,
                    customHook: hookState.selected.spokenHook?.text || hookState.selected.headline?.text,
                  }
                : {}),
              ...(scriptState.active && scriptState.sections.length > 0
                ? {
                    customScript: {
                      language: scriptState.language || $('#transform-lang')?.value || 'auto',
                      sections: scriptState.sections,
                    },
                  }
                : {}),
              ...(scriptState.active &&
              scriptState.synthesized &&
              scriptState.synthesized.fingerprint === getScriptVoiceFingerprint() &&
              scriptState.synthesized.narration?.outputPath
                ? {
                    existingNarration: {
                      outputPath: scriptState.synthesized.narration.outputPath,
                      durationSeconds: scriptState.synthesized.narration.durationSeconds,
                      sections: scriptState.synthesized.narration.sections,
                    },
                  }
                : {}),
            };
          })();

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
                setProgress('transform', false);
                $('#transform-error').classList.remove('hidden');
                $('#transform-error-msg').textContent = payload.message || 'Transform gagal';
              }
            } catch {
              // Non-JSON payload
            }
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
      if (btn) btn.disabled = false;
    }
  }

  $('#btn-transform').addEventListener('click', () => runTransform());

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

    const rawVideoUrl = result.outputVideo?.url || result.outputVideo || '';
    const videoUrl = rawVideoUrl
      ? rawVideoUrl + (rawVideoUrl.includes('?') ? '&' : '?') + '_v=' + Date.now()
      : '';
    const narrationUrl = result.narration?.url || '';
    const scriptData = result.script || {};
    const angleData = result.angle || {};
    const storyData = result.story || {};
    const planData = result.videoPlan || {};
    const isReel = result.outputMode === 'reel';

    // Build reel warning banners
    const reelWarnings = [];
    if (isReel) {
      const dropped = result.reel?.droppedClips ?? [];
      if (dropped.length > 0) {
        const names = dropped
          .map((c) => c.title ? `"${esc(c.title)}" (${fmtDuration(c.start)}–${fmtDuration(c.end)})` : `${fmtDuration(c.start)}–${fmtDuration(c.end)}`)
          .join(', ');
        reelWarnings.push(
          `⚠️ <strong>${dropped.length} klip dihapus</strong> karena overlap dengan hook intro atau klip lain: ${names}`,
        );
      }
      if (result.reel?.hookPreviewMissing) {
        reelWarnings.push(
          '⚠️ File preview hook intro tidak ditemukan di server — hook dipotong ulang dari video sumber.',
        );
      }
    }

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
            ${result.reel?.durationSeconds ? `<span class="chip">${fmtDuration(result.reel.durationSeconds)} · ${result.reel.clipCount} klip${result.reel.hasIntro ? ' + intro' : ''}</span>` : ''}
            ${result.reel?.usedHookIntro ? '<span class="chip">✅ Hook intro dipakai</span>' : ''}
            ${result.dryRun ? '<span class="chip">Dry Run</span>' : ''}
          </div>
          ${reelWarnings.length > 0 ? `<div class="reel-warnings">${reelWarnings.map((w) => `<div class="reel-warning">${w}</div>`).join('')}</div>` : ''}
          ${isReel
            ? (result.reel?.segments || []).map((s, i) => `
                <div class="transform-angle">Klip ${i + 1}: ${fmtDuration(s.start)}–${fmtDuration(s.end)} · ⏱ ${fmtDuration(s.end - s.start)}${s.kind === 'intro' ? ' (hook intro)' : ''}</div>`).join('')
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

    // Append Viral Captions Card
    if (result.captions) {
      const captionContext = {
        videoId: result.videoId,
        jobId: result.jobId,
        sourceTitle: result.angle?.title || result.videoId,
        genre: $('#transform-genre')?.value || undefined,
        customPrompt: $('#transform-custom-prompt')?.value.trim() || undefined,
        scriptText: result.script?.sections?.map((s) => s.text).join(' '),
      };
      const captionsCard = createViralCaptionsCard(result.captions, captionContext);
      card.appendChild(captionsCard);
    } else {
      // Provide on-demand caption generation button
      const captionSection = document.createElement('div');
      captionSection.className = 'viral-captions-placeholder';
      captionSection.style.marginTop = '14px';
      captionSection.innerHTML = `
        <button type="button" class="btn secondary small full" style="padding:10px;" id="btn-gen-captions-inline">
          📱 Generate Caption Viral (TikTok, Reels, Shorts, X, Threads, FB)
        </button>
      `;
      captionSection.querySelector('#btn-gen-captions-inline')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = '⏳ Menulis caption viral dengan AI…';
        try {
          const platforms = getSelectedCaptionPlatforms();
          const creditTemplate = getCaptionCreditTemplate();
          const res = await apiPost('/api/captions/generate', {
            videoId: result.videoId,
            jobId: result.jobId,
            tone: 'viral_hype',
            language: $('#transform-lang')?.value || 'auto',
            ...(platforms.length > 0 ? { platforms } : {}),
            ...(creditTemplate !== undefined ? { creditTemplate } : {}),
            customContext: {
              sourceTitle: result.angle?.title || result.videoId,
              genre: $('#transform-genre')?.value || undefined,
              customPrompt: $('#transform-custom-prompt')?.value.trim() || undefined,
              scriptText: result.script?.sections?.map((s) => s.text).join(' '),
              storyConcept: result.story?.concept,
              durationSeconds: result.videoPlan?.duration || result.reel?.durationSeconds,
            },
          });
          if (res.success && res.captions) {
            const cardEl = createViralCaptionsCard(res, {
              videoId: result.videoId,
              jobId: result.jobId,
              sourceTitle: result.angle?.title || result.videoId,
            });
            captionSection.replaceWith(cardEl);
            toast('Caption viral berhasil dibuat! 🚀', 'success');
          } else {
            throw new Error(res.message || 'Gagal membuat caption');
          }
        } catch (err) {
          toast(`Gagal membuat caption: ${err.message}`, 'error');
          btn.disabled = false;
          btn.textContent = '📱 Coba Lagi Generate Caption Viral';
        }
      });
      card.appendChild(captionSection);
    }

    list.appendChild(card);
    $('#transform-results').classList.remove('hidden');
    $('#transform-meta').textContent = '1 job selesai';

    // Toast dengan info klip yang dibuang jika ada
    if (isReel && (result.reel?.droppedClips?.length ?? 0) > 0) {
      toast(`Reel selesai — ${result.reel.droppedClips.length} klip dihapus karena overlap`, 'error');
    } else {
      toast('Transformasi berhasil!', 'success');
    }
  }

  /* ---------- Viral Captions UI Builder ---------- */
  const PLATFORM_META = {
    tiktok: {
      name: 'TikTok',
      icon: '🎵',
      sweetSpot: '50–150 kar (Search SEO + Comment Loop)',
      maxChar: 4000,
    },
    instagram: {
      name: 'Instagram Reels',
      icon: '📸',
      sweetSpot: '125 kar sebelum fold (Saves & Shares)',
      maxChar: 2200,
    },
    youtube_shorts: {
      name: 'YouTube Shorts',
      icon: '🔴',
      sweetSpot: 'Judul <70 kar (Search SEO Indexing)',
      maxChar: 5000,
    },
    x: {
      name: 'X (Twitter)',
      icon: '𝕏',
      sweetSpot: '<280 kar (Quote-Tweet & RT Bait)',
      maxChar: 280,
    },
    threads: {
      name: 'Threads',
      icon: '🧵',
      sweetSpot: 'Diskusi Komunitas & Balasan Panjang',
      maxChar: 500,
    },
    facebook: {
      name: 'Facebook Feed',
      icon: '👥',
      sweetSpot: '2–3 paragraf (Share ke Teman & Keluarga)',
      maxChar: 63206,
    },
    facebook_reels: {
      name: 'Facebook Reels',
      icon: '🎬',
      sweetSpot: 'Pendek & punchy (Discovery Non-Followers)',
      maxChar: 2200,
    },
  };

  function createViralCaptionsCard(captionData, ctx = {}) {
    const card = document.createElement('div');
    card.className = 'viral-captions-card';

    const captions = { ...captionData.captions };
    const availablePlatforms = Object.keys(captions).filter((p) => PLATFORM_META[p]);
    let currentPlatform = availablePlatforms.includes('tiktok')
      ? 'tiktok'
      : (availablePlatforms[0] || 'tiktok');
    let currentTone = captionData.tone || 'viral_hype';

    function renderContent() {
      const activePlatformList = availablePlatforms.length > 0 ? availablePlatforms : Object.keys(PLATFORM_META);
      if (!activePlatformList.includes(currentPlatform)) {
        currentPlatform = activePlatformList[0] || 'tiktok';
      }

      const pData = captions[currentPlatform] || {};
      const meta = PLATFORM_META[currentPlatform] || { name: currentPlatform, icon: '📱', maxChar: 2000, sweetSpot: '' };
      const formatted = pData.formattedCaption || '';
      const charCount = formatted.length;
      const isOver = currentPlatform === 'x' && charCount > 280;

      card.innerHTML = `
        <div class="captions-header">
          <div class="captions-title-group">
            <span class="captions-title">📱 Caption Viral Multi-Platform</span>
            <span class="captions-algo-badge">⚡ ALGORITMA 2026</span>
          </div>
          <div class="captions-controls">
            <select class="caption-tone-select" id="caption-tone-picker" title="Ubah Gaya Bahasa / Tone Copywriting">
              <option value="viral_hype" ${currentTone === 'viral_hype' ? 'selected' : ''}>⚡ Viral &amp; Hype</option>
              <option value="storytelling" ${currentTone === 'storytelling' ? 'selected' : ''}>📖 Storytelling</option>
              <option value="educational" ${currentTone === 'educational' ? 'selected' : ''}>💡 Edukasi &amp; Insight</option>
              <option value="controversial" ${currentTone === 'controversial' ? 'selected' : ''}>🔥 Debat / Diskusi</option>
              <option value="humorous" ${currentTone === 'humorous' ? 'selected' : ''}>😂 Lucu &amp; Santai</option>
            </select>
            <button type="button" class="btn small ghost" id="btn-regen-caption-tone" title="Generate ulang caption dengan tone yang dipilih">🔄 Generate Ulang</button>
          </div>
        </div>

        <div class="platform-tabs">
          ${activePlatformList.map((p) => {
            const m = PLATFORM_META[p] || { name: p, icon: '📱' };
            return `<button type="button" class="platform-tab ${currentPlatform === p ? 'active' : ''}" data-platform="${p}">${m.icon} ${m.name}</button>`;
          }).join('')}
        </div>

        ${pData.strategyExplanation ? `
        <div class="caption-strategy-box">
          <span class="caption-strategy-icon">💡</span>
          <div><strong>Strategi Algoritma:</strong> ${esc(pData.strategyExplanation)}</div>
        </div>` : ''}

        ${pData.title ? `
        <div class="caption-title-box">
          <div style="min-width:0;">
            <div class="muted small" style="font-size:11px;">📌 Rekomendasi Judul Video / Headline:</div>
            <div class="caption-title-text">${esc(pData.title)}</div>
          </div>
          <button type="button" class="btn small ghost" data-caption-action="copy-title" title="Salin judul saja">✏️ Salin Judul</button>
        </div>` : ''}

        <div class="caption-meta-row">
          <div class="caption-chips">
            <span class="caption-chip char-count ${isOver ? 'danger' : ''}" id="caption-char-indicator">
              📝 ${charCount} Karakter (${meta.sweetSpot})
            </span>
            ${pData.hashtags?.length ? `<span class="caption-chip">🏷️ ${pData.hashtags.length} Hashtag</span>` : ''}
            ${pData.recommendedAudioVibe ? `<span class="caption-chip">🔊 Audio: ${esc(pData.recommendedAudioVibe)}</span>` : ''}
          </div>
          ${pData.searchKeywords?.length ? `
          <div class="caption-chips">
            <span class="muted small">🔍 Target SEO:</span>
            ${pData.searchKeywords.slice(0, 3).map((k) => `<span class="caption-chip">${esc(k)}</span>`).join('')}
          </div>` : ''}
        </div>

        <textarea class="caption-textarea" id="caption-text-input" placeholder="Teks caption..." spellcheck="false">${esc(formatted)}</textarea>

        <div class="caption-actions">
          <div class="caption-actions-left">
            <button type="button" class="btn primary small" data-caption-action="copy-full">📋 Salin Caption Lengkap</button>
            ${pData.hashtags?.length ? `<button type="button" class="btn secondary small" data-caption-action="copy-hashtags">🏷️ Salin Hashtag</button>` : ''}
            ${pData.tags?.length ? `<button type="button" class="btn secondary small" data-caption-action="copy-tags">🏷️ Salin Search Tags</button>` : ''}
          </div>
          <span class="muted small" id="caption-copy-status">Siap upload ke ${meta.name}</span>
        </div>
      `;

      // Event Listeners inside card
      card.querySelectorAll('.platform-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          currentPlatform = tab.dataset.platform;
          renderContent();
        });
      });

      const toneSelect = card.querySelector('#caption-tone-picker');
      const btnRegenTone = card.querySelector('#btn-regen-caption-tone');

      const triggerRegenerate = async () => {
        const newTone = toneSelect?.value || currentTone;
        currentTone = newTone;
        if (btnRegenTone) {
          btnRegenTone.disabled = true;
          btnRegenTone.textContent = '⏳ Generating…';
        }
        try {
          const res = await apiPost('/api/captions/generate', {
            videoId: ctx.videoId || captionData.videoId,
            jobId: ctx.jobId || captionData.jobId,
            tone: newTone,
            language: $('#transform-lang')?.value || 'auto',
            refresh: true,
            ...(activePlatformList.length > 0 ? { platforms: activePlatformList } : {}),
            ...(getCaptionCreditTemplate() !== undefined ? { creditTemplate: getCaptionCreditTemplate() } : {}),
            customContext: {
              sourceTitle: ctx.sourceTitle || captionData.sourceTitle,
              genre: ctx.genre || $('#transform-genre')?.value,
              customPrompt: ctx.customPrompt || $('#transform-custom-prompt')?.value.trim() || undefined,
              scriptText: ctx.scriptText,
            },
          });
          if (res.success && res.captions) {
            Object.assign(captions, res.captions);
            toast(`Caption diperbarui dengan tone: ${newTone}! ✨`, 'success');
            renderContent();
          }
        } catch (err) {
          toast(`Gagal update caption: ${err.message}`, 'error');
          if (btnRegenTone) {
            btnRegenTone.disabled = false;
            btnRegenTone.textContent = '🔄 Generate Ulang';
          }
        }
      };

      toneSelect?.addEventListener('change', triggerRegenerate);
      btnRegenTone?.addEventListener('click', triggerRegenerate);

      const ta = card.querySelector('#caption-text-input');
      const charInd = card.querySelector('#caption-char-indicator');
      ta?.addEventListener('input', () => {
        const val = ta.value;
        if (captions[currentPlatform]) {
          captions[currentPlatform].formattedCaption = val;
        }
        if (charInd) {
          const isTooLong = currentPlatform === 'x' && val.length > 280;
          charInd.textContent = `📝 ${val.length} Karakter (${meta.sweetSpot})`;
          charInd.className = `caption-chip char-count ${isTooLong ? 'danger' : ''}`;
        }
      });

      card.querySelectorAll('[data-caption-action]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const act = btn.dataset.captionAction;
          if (act === 'copy-full') {
            const textToCopy = ta?.value || '';
            const ok = await copyText(textToCopy);
            if (ok) {
              toast(`Caption ${meta.name} disalin ke clipboard! 📋`, 'success');
            } else {
              toast('Gagal menyalin otomatis — silakan seleksi & salin manual', 'error');
            }
          } else if (act === 'copy-hashtags') {
            const tags = (pData.hashtags || []).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
            const ok = await copyText(tags);
            if (ok) toast('Hashtag disalin! 🏷️', 'success');
          } else if (act === 'copy-title') {
            const ok = await copyText(pData.title || '');
            if (ok) toast('Judul disalin! ✏️', 'success');
          } else if (act === 'copy-tags') {
            const tagsStr = (pData.tags || []).join(', ');
            const ok = await copyText(tagsStr);
            if (ok) toast('Search tags YouTube disalin! 🏷️', 'success');
          }
        });
      });
    }

    renderContent();
    return card;
  }

  /* ---------- Caption Modal for History Tab ---------- */
  async function openCaptionModal(videoId, title = '') {
    const modal = $('#caption-modal');
    const content = $('#modal-caption-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    content.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:28px;margin-bottom:10px;">📱</div>
        <div style="font-weight:700;font-size:16px;margin-bottom:6px;">Memuat Caption Viral…</div>
        <p class="muted small">Mengambil caption yang tersimpan atau menganalisis metadata video.</p>
      </div>
    `;

    try {
      // Try GET first
      let res = await fetch(`/api/captions?videoId=${encodeURIComponent(videoId)}`).then((r) => r.json()).catch(() => null);
      if (!res || !res.success || !res.captions) {
        // Generate on demand
        res = await apiPost('/api/captions/generate', {
          videoId,
          tone: 'viral_hype',
          customContext: {
            sourceTitle: title || `Video ${videoId}`,
          },
        });
      }

      if (res && res.success && res.captions) {
        content.innerHTML = '';
        const cardEl = createViralCaptionsCard(res, { videoId, sourceTitle: title });
        content.appendChild(cardEl);
      } else {
        throw new Error(res?.message || 'Tidak ada caption yang ditemukan');
      }
    } catch (err) {
      content.innerHTML = `
        <div class="card error-card" style="margin:0;">
          <h3>⚠️ Gagal Memuat Caption</h3>
          <p>${esc(err.message)}</p>
          <button type="button" class="btn secondary small" id="btn-retry-modal-caption" style="margin-top:10px;">🔄 Coba Lagi</button>
        </div>
      `;
      content.querySelector('#btn-retry-modal-caption')?.addEventListener('click', () => {
        openCaptionModal(videoId, title);
      });
    }
  }

  $('#btn-close-caption-modal')?.addEventListener('click', () => {
    $('#caption-modal')?.classList.add('hidden');
  });

  $('#caption-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      $('#caption-modal')?.classList.add('hidden');
    }
  });

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
        const vId = c.videoId || '';
        return `
        <div class="history-item">
          ${c.thumbnailUrl ? `<img class="h-thumb" src="${esc(c.thumbnailUrl)}" alt="" loading="lazy">` : ''}
          <div>
            <div class="h-title">${esc(c.title || c.video || 'Transform')}</div>
            <div class="h-meta">${esc(c.video || c.outputVideo || '')}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${vId ? `<button class="btn ghost small" data-action="view-caption" data-video-id="${esc(vId)}" data-title="${esc(c.title || '')}" title="Lihat/Buat Caption Viral (TikTok, Reels, Shorts)">📱 Caption</button>` : ''}
            ${clipUrl ? `<button class="btn ghost small" data-action="download" data-url="${esc(clipUrl)}" title="Unduh Video">⬇️</button>` : ''}
            ${clipUrl ? `<button class="btn ghost small" data-action="play" data-url="${esc(clipUrl)}" title="Putar Video">▶️</button>` : ''}
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
    const { action, url, id, name, videoId, title } = btn.dataset;

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
    } else if (action === 'view-caption') {
      if (videoId) {
        openCaptionModal(videoId, title);
      }
    } else if (action === 'clip') {
      if (url) {
        $('#transform-url').value = url;
        $$('.tab').find((t) => t.dataset.tab === 'transform')?.click();
        toast('URL dimasukkan — klik Mulai Transform', 'success');
      }
    }
  });

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
