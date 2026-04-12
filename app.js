/* ============================================================
   VIRALSCRIBE — app.js
   Frontend logic: onboarding, tabs, API calls, copy, toast
   ============================================================ */

'use strict';

// ── STATE ──────────────────────────────────────────────────────
const state = {
  niches: [],
  activeTab: 'youtube',
  ytTone: 'conversational',
  igTone: 'conversational',
  ptPlatform: 'YouTube',
  lastYtPayload: null,
  lastIgPayload: null,
  lastPtPayload: null,
};

// ── ONBOARDING ─────────────────────────────────────────────────
function initOnboarding() {
  const saved = localStorage.getItem('vs_niches');
  if (saved) {
    try {
      state.niches = JSON.parse(saved);
      renderProfileTags();
      return;
    } catch {
      localStorage.removeItem('vs_niches');
    }
  }
  showOnboarding();
}

function showOnboarding() {
  document.getElementById('onboarding-overlay').classList.remove('hidden');

  // Wire niche buttons
  document.querySelectorAll('.niche-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
    });
  });

  document.getElementById('onboarding-confirm').addEventListener('click', confirmOnboarding);
}

function confirmOnboarding() {
  const selected = [...document.querySelectorAll('.niche-btn.selected')]
    .map(btn => btn.dataset.niche);

  if (selected.length === 0) {
    // Allow skipping — just close
    document.getElementById('onboarding-overlay').classList.add('hidden');
    return;
  }

  state.niches = selected;
  localStorage.setItem('vs_niches', JSON.stringify(selected));
  document.getElementById('onboarding-overlay').classList.add('hidden');
  renderProfileTags();
}

function renderProfileTags() {
  const container = document.getElementById('profile-tags');
  container.innerHTML = '';
  state.niches.forEach(n => {
    const span = document.createElement('span');
    span.className = 'profile-tag';
    span.textContent = n;
    container.appendChild(span);
  });
}

// ── PROFILE PANEL ──────────────────────────────────────────────
function initProfile() {
  const btn   = document.getElementById('profile-btn');
  const panel = document.getElementById('profile-panel');
  const edit  = document.getElementById('edit-profile-btn');

  btn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });

  edit.addEventListener('click', () => {
    panel.classList.add('hidden');
    // Reset selections to current saved niches
    document.querySelectorAll('.niche-btn').forEach(b => {
      b.classList.toggle('selected', state.niches.includes(b.dataset.niche));
    });
    document.getElementById('onboarding-overlay').classList.remove('hidden');
    // Re-bind confirm (remove old listener first)
    const confirmBtn = document.getElementById('onboarding-confirm');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', confirmOnboarding);
  });
}

// ── TABS ───────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === state.activeTab) return;

      // Update buttons
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update sections
      document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
      const section = document.getElementById(`tab-${tab}`);
      section.classList.remove('hidden');

      state.activeTab = tab;
    });
  });
}

// ── TONE SELECTORS ─────────────────────────────────────────────
function initToneSelectors() {
  // YouTube tones
  document.querySelectorAll('#yt-tone-selector .tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#yt-tone-selector .tone-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ytTone = btn.dataset.tone;
    });
  });

  // Instagram tones
  document.querySelectorAll('#ig-tone-selector .tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ig-tone-selector .tone-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.igTone = btn.dataset.tone;
    });
  });

  // Posting time platform
  document.querySelectorAll('#pt-platform-selector .tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pt-platform-selector .tone-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ptPlatform = btn.dataset.platform;
    });
  });
}

// ── API CALL ───────────────────────────────────────────────────
async function callAPI(endpoint, payload) {
  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  return res.json();
}

// ── SKELETON HELPERS ───────────────────────────────────────────
function showSkeleton(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideSkeleton(id) {
  document.getElementById(id).classList.add('hidden');
}
function showOutput(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideOutput(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── CHAR COUNT ─────────────────────────────────────────────────
function updateCharCount(textId, countId, limit) {
  const text  = document.getElementById(textId).textContent.trim();
  const count = text.length;
  const el    = document.getElementById(countId);
  el.textContent = `${count.toLocaleString()} / ${limit.toLocaleString()}`;
  el.classList.toggle('over', count > limit);
}

// ── YOUTUBE ────────────────────────────────────────────────────
function initYouTube() {
  const generateBtn = document.getElementById('yt-generate-btn');
  const regenBtn    = document.getElementById('yt-regen-btn');

  generateBtn.addEventListener('click', () => runYouTube(false));
  regenBtn.addEventListener('click',    () => runYouTube(true));
}

async function runYouTube(isRegen) {
  const desc = document.getElementById('yt-description').value.trim();
  if (!desc) { showToast('Please enter a video description.'); return; }

  const keywords = document.getElementById('yt-keywords').value.trim();
  const payload  = {
    description: desc,
    tone: state.ytTone,
    keywords,
    niches: state.niches,
  };

  state.lastYtPayload = payload;

  hideOutput('yt-output');
  showSkeleton('yt-skeleton');

  try {
    const data = await callAPI('youtube', payload);
    hideSkeleton('yt-skeleton');

    setText('yt-desc-text',     data.description || '');
    setText('yt-tags-text',     data.tags        || '');
    setText('yt-hashtags-text', data.hashtags    || '');

    updateCharCount('yt-desc-text',  'yt-desc-count',  5000);
    updateCharCount('yt-tags-text',  'yt-tags-count',  500);

    showOutput('yt-output');
  } catch (err) {
    hideSkeleton('yt-skeleton');
    showToast(`Error: ${err.message}`);
  }
}

// ── INSTAGRAM ──────────────────────────────────────────────────
function initInstagram() {
  document.getElementById('ig-generate-btn').addEventListener('click', () => runInstagram(false));
  document.getElementById('ig-regen-btn').addEventListener('click',    () => runInstagram(true));
}

async function runInstagram(isRegen) {
  const desc = document.getElementById('ig-description').value.trim();
  if (!desc) { showToast('Please enter a post description.'); return; }

  const payload = {
    description: desc,
    tone: state.igTone,
    niches: state.niches,
  };

  state.lastIgPayload = payload;

  hideOutput('ig-output');
  showSkeleton('ig-skeleton');

  try {
    const data = await callAPI('instagram', payload);
    hideSkeleton('ig-skeleton');

    setText('ig-caption-text',  data.caption  || '');
    setText('ig-hashtags-text', data.hashtags || '');
    setText('ig-keywords-text', data.keywords || '');

    showOutput('ig-output');
  } catch (err) {
    hideSkeleton('ig-skeleton');
    showToast(`Error: ${err.message}`);
  }
}

// ── POSTING TIME ───────────────────────────────────────────────
function initPostingTime() {
  document.getElementById('pt-generate-btn').addEventListener('click', () => runPostingTime(false));
  document.getElementById('pt-regen-btn').addEventListener('click',    () => runPostingTime(true));
}

async function runPostingTime(isRegen) {
  const region      = document.getElementById('pt-region').value;
  const contentType = document.getElementById('pt-content-type').value.trim();

  const payload = {
    platform: state.ptPlatform,
    region,
    contentType,
    niches: state.niches,
  };

  state.lastPtPayload = payload;

  hideOutput('pt-output');
  showSkeleton('pt-skeleton');

  try {
    const data = await callAPI('posting-time', payload);
    hideSkeleton('pt-skeleton');

    setText('pt-slots-text', data.timeSlots    || '');
    setText('pt-notes-text', data.strategyNotes || '');

    showOutput('pt-output');
  } catch (err) {
    hideSkeleton('pt-skeleton');
    showToast(`Error: ${err.message}`);
  }
}

// ── COPY ───────────────────────────────────────────────────────
function initCopyButtons() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;

    const targetId = btn.dataset.target;
    const el = document.getElementById(targetId);
    if (!el) return;

    const text = el.textContent.trim();
    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      btn.textContent = '✓ Copied';
      showToast('Copied to clipboard');
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = btn.textContent.replace('✓ Copied', getOriginalCopyLabel(targetId));
      }, 2000);
    });
  });
}

function getOriginalCopyLabel(id) {
  const map = {
    'yt-desc-text':     'Copy Description',
    'yt-tags-text':     'Copy Tags',
    'yt-hashtags-text': 'Copy Hashtags',
    'ig-caption-text':  'Copy Caption',
    'ig-hashtags-text': 'Copy Hashtags',
    'ig-keywords-text': 'Copy Keywords',
    'pt-slots-text':    'Copy Time Slots',
    'pt-notes-text':    'Copy Notes',
  };
  return map[id] || 'Copy';
}

// ── TOAST ──────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 200);
  }, 2200);
}

// ── HELPERS ────────────────────────────────────────────────────
function setText(id, value) {
  document.getElementById(id).textContent = value;
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initOnboarding();
  initProfile();
  initTabs();
  initToneSelectors();
  initYouTube();
  initInstagram();
  initPostingTime();
  initCopyButtons();
});
