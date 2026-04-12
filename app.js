/* ============================================================
   VIRALSCRIBE 2.0 — app.js
   View router · Onboarding · API calls · Copy · Toast
   ============================================================ */

'use strict';

// ── STATE ──────────────────────────────────────────────────────
const S = {
  niches:     [],
  ytTone:     'Conversational',
  igTone:     'Conversational',
  ptPlatform: 'YouTube',
};

// ── VIEW ROUTER ────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });
  const el = document.getElementById(`view-${name}`);
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function initRouter() {
  // Feature cards on home
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('click', () => showView(card.dataset.view));
  });

  // Back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.back));
  });
}

// ── ONBOARDING ─────────────────────────────────────────────────
function initOnboarding() {
  const saved = localStorage.getItem('vs_niches');
  if (saved) {
    try {
      S.niches = JSON.parse(saved);
      renderNiches();
      return;
    } catch {
      localStorage.removeItem('vs_niches');
    }
  }
  openOnboarding();
}

function openOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  overlay.classList.remove('hidden');

  // Reflect currently saved niches
  document.querySelectorAll('.niche-btn').forEach(btn => {
    btn.classList.toggle('selected', S.niches.includes(btn.dataset.niche));
    btn.addEventListener('click', () => btn.classList.toggle('selected'), { once: false });
  });

  // Confirm
  const confirmBtn = document.getElementById('onboarding-confirm');
  const skipBtn    = document.getElementById('onboarding-skip');

  const confirm = () => {
    const chosen = [...document.querySelectorAll('.niche-btn.selected')]
      .map(b => b.dataset.niche);
    S.niches = chosen;
    localStorage.setItem('vs_niches', JSON.stringify(chosen));
    overlay.classList.add('hidden');
    renderNiches();
  };

  const skip = () => overlay.classList.add('hidden');

  // Clone to avoid stacking listeners
  replaceWithClone(confirmBtn, confirm);
  replaceWithClone(skipBtn, skip);
}

function replaceWithClone(el, handler) {
  const clone = el.cloneNode(true);
  el.parentNode.replaceChild(clone, el);
  clone.addEventListener('click', handler);
}

function renderNiches() {
  // Profile chip label
  const preview = document.getElementById('home-niche-preview');
  if (S.niches.length === 0) {
    preview.textContent = 'Your niches';
  } else if (S.niches.length <= 2) {
    preview.textContent = S.niches.join(', ');
  } else {
    preview.textContent = `${S.niches.slice(0, 2).join(', ')} +${S.niches.length - 2}`;
  }

  // Profile drawer tags
  const tagsEl = document.getElementById('profile-tags-home');
  tagsEl.innerHTML = '';
  if (S.niches.length === 0) {
    tagsEl.innerHTML = '<span style="font-size:13px;color:var(--text-dim)">No niches selected</span>';
    return;
  }
  S.niches.forEach(n => {
    const span = document.createElement('span');
    span.className = 'profile-tag';
    span.textContent = n;
    tagsEl.appendChild(span);
  });
}

// ── PROFILE CHIP & DRAWER ──────────────────────────────────────
function initProfile() {
  const chip   = document.getElementById('profile-chip-home');
  const drawer = document.getElementById('profile-drawer');
  const edit   = document.getElementById('edit-niches-btn');

  chip.addEventListener('click', e => {
    e.stopPropagation();
    drawer.classList.toggle('hidden');
  });

  document.addEventListener('click', () => drawer.classList.add('hidden'));
  drawer.addEventListener('click', e => e.stopPropagation());

  edit.addEventListener('click', () => {
    drawer.classList.add('hidden');
    openOnboarding();
  });
}

// ── PILL SELECTORS ─────────────────────────────────────────────
function initPills(groupId, stateKey) {
  document.querySelectorAll(`#${groupId} .pill`).forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll(`#${groupId} .pill`).forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      S[stateKey] = pill.dataset.tone || pill.dataset.platform;
    });
  });
}

// ── API CALL ───────────────────────────────────────────────────
async function callAPI(endpoint, payload) {
  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  return res.json();
}

// ── SKELETON / OUTPUT HELPERS ───────────────────────────────────
const show = id => document.getElementById(id).classList.remove('hidden');
const hide = id => document.getElementById(id).classList.add('hidden');

function setText(id, val) {
  document.getElementById(id).textContent = val || '';
}

function setCharBadge(badgeId, text, limit) {
  const el = document.getElementById(badgeId);
  if (!el) return;
  const len = (text || '').length;
  el.textContent = `${len.toLocaleString()} / ${limit.toLocaleString()}`;
  el.classList.toggle('over', len > limit);
}

// ── YOUTUBE ────────────────────────────────────────────────────
function initYouTube() {
  document.getElementById('yt-generate-btn').addEventListener('click', () => runYT());
  document.getElementById('yt-regen').addEventListener('click', () => runYT());
}

async function runYT() {
  const input = document.getElementById('yt-input').value.trim();
  if (!input) { showToast('Please describe your video first.'); return; }

  hide('yt-output');
  show('yt-skeleton');

  try {
    const data = await callAPI('youtube', {
      description: input,
      tone:        S.ytTone,
      niches:      S.niches,
    });

    hide('yt-skeleton');
    setText('yt-desc',     data.description);
    setText('yt-tags',     data.tags);
    setText('yt-hashtags', data.hashtags);
    setCharBadge('yt-desc-badge',  data.description, 5000);
    setCharBadge('yt-tags-badge',  data.tags,         500);
    show('yt-output');
    scrollToOutput('yt-output');
  } catch (err) {
    hide('yt-skeleton');
    showToast(`Error: ${err.message}`);
  }
}

// ── INSTAGRAM ──────────────────────────────────────────────────
function initInstagram() {
  document.getElementById('ig-generate-btn').addEventListener('click', () => runIG());
  document.getElementById('ig-regen').addEventListener('click', () => runIG());
}

async function runIG() {
  const input = document.getElementById('ig-input').value.trim();
  if (!input) { showToast('Please describe your post first.'); return; }

  hide('ig-output');
  show('ig-skeleton');

  try {
    const data = await callAPI('instagram', {
      description: input,
      tone:        S.igTone,
      niches:      S.niches,
    });

    hide('ig-skeleton');
    setText('ig-caption',  data.caption);
    setText('ig-hashtags', data.hashtags);
    setText('ig-keywords', data.keywords);
    show('ig-output');
    scrollToOutput('ig-output');
  } catch (err) {
    hide('ig-skeleton');
    showToast(`Error: ${err.message}`);
  }
}

// ── POSTING TIME ───────────────────────────────────────────────
function initPostingTime() {
  document.getElementById('pt-generate-btn').addEventListener('click', () => runPT());
  document.getElementById('pt-regen').addEventListener('click', () => runPT());
}

async function runPT() {
  const region = document.getElementById('pt-region').value;

  hide('pt-output');
  show('pt-skeleton');

  try {
    const data = await callAPI('posting-time', {
      platform: S.ptPlatform,
      region,
      niches:   S.niches,
    });

    hide('pt-skeleton');
    setText('pt-slots', data.timeSlots);
    setText('pt-notes', data.strategyNotes);
    show('pt-output');
    scrollToOutput('pt-output');
  } catch (err) {
    hide('pt-skeleton');
    showToast(`Error: ${err.message}`);
  }
}

// ── COPY ───────────────────────────────────────────────────────
function initCopy() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;

    const el = document.getElementById(btn.dataset.target);
    if (!el) return;

    navigator.clipboard.writeText(el.textContent.trim()).then(() => {
      btn.textContent = '✓ Copied';
      btn.classList.add('copied');
      showToast('Copied to clipboard');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(() => showToast('Could not copy. Please try manually.'));
  });
}

// ── TOAST ──────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 220);
  }, 2400);
}

// ── HELPERS ────────────────────────────────────────────────────
function scrollToOutput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initOnboarding();
  initProfile();
  initRouter();
  initPills('yt-tone-group',      'ytTone');
  initPills('ig-tone-group',      'igTone');
  initPills('pt-platform-group',  'ptPlatform');
  initYouTube();
  initInstagram();
  initPostingTime();
  initCopy();
});
