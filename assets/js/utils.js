// ============================================================
// TRADEX — UTILS JS
// assets/js/utils.js
// Shared helper functions used across all pages
// ============================================================

// ── MONEY FORMATTING ─────────────────────────────────────
export function formatMoney(amount, decimals = 2) {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(amount));
}

// ── DATE FORMATTING ───────────────────────────────────────
export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
    ...options
  }).format(new Date(dateStr));
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month:  'short',
    day:    'numeric',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// ── TIME AGO ─────────────────────────────────────────────
export function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const now  = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

// ── COUNTDOWN OBJECT ─────────────────────────────────────
export function getCountdown(endDateStr) {
  const end       = new Date(endDateStr);
  const now       = new Date();
  const remaining = Math.max(0, end - now);

  return {
    days:    Math.floor(remaining / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    mins:    Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)),
    secs:    Math.floor((remaining % (1000 * 60)) / 1000),
    expired: remaining <= 0,
    totalMs: remaining,
  };
}

// ── PLAN TIER COLORS ─────────────────────────────────────
export function getPlanTierColor(tier) {
  const map = {
    bronze:   '#cd7f32',
    silver:   '#aaa9ad',
    gold:     '#ffd700',
    platinum: '#e5e4e2',
    diamond:  '#b9f2ff',
    heroic:   '#c084fc',
  };
  return map[tier?.toLowerCase()] || '#1B4F8A';
}

export function getPlanTierEmoji(tier) {
  const map = {
    bronze:   '🥉',
    silver:   '🥈',
    gold:     '🥇',
    platinum: '💎',
    diamond:  '💠',
    heroic:   '🏆',
  };
  return map[tier?.toLowerCase()] || '📈';
}

// ── TRUNCATE TEXT ─────────────────────────────────────────
export function truncate(str, maxLen = 30) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ── CAPITALIZE ───────────────────────────────────────────
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── DEBOUNCE ─────────────────────────────────────────────
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── COPY TO CLIPBOARD ────────────────────────────────────
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── GET INITIALS ─────────────────────────────────────────
export function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── THEME ─────────────────────────────────────────────────
export function getTheme() {
  return localStorage.getItem('tradex-theme') || 'light';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('tradex-theme', theme);
}

export function toggleTheme() {
  const current = getTheme();
  const next    = current === 'light' ? 'dark' : 'light';
  setTheme(next);
  if (window.lucide) lucide.createIcons();
  return next;
}
