// ============================================================
// TRADEX — NOTIFICATIONS JS
// assets/js/notifications.js
// ============================================================

import { supabase, requireAuth, getProfile } from './supabase.js';
import { timeAgo, formatDateTime } from './utils.js';

// ── STATE ─────────────────────────────────────────────────
let currentUser     = null;
let notifications   = [];
let unreadCount     = 0;
let realtimeSub     = null;

// ── NOTIFICATION TYPE CONFIG ──────────────────────────────
const TYPE_CONFIG = {
  success: { icon: 'check-circle', color: 'var(--success)',  bg: 'var(--success-bg)'  },
  error:   { icon: 'x-circle',     color: 'var(--error)',    bg: 'var(--error-bg)'    },
  warning: { icon: 'alert-triangle',color: 'var(--warning)', bg: 'var(--warning-bg)'  },
  info:    { icon: 'info',          color: 'var(--info)',     bg: 'var(--info-bg)'     },
};

// ── INIT BELL (runs on every page) ────────────────────────
export async function initNotificationBell() {
  const session = await requireAuth().catch(() => null);
  if (!session) return;
  currentUser = session.user;

  await loadNotifications();
  renderBell();
  initBellDropdown();
  subscribeRealtime();
}

// ── INIT FULL PAGE ────────────────────────────────────────
export async function initNotificationsPage() {
  const session = await requireAuth();
  if (!session) return;
  currentUser = session.user;

  await loadUserMeta();
  await loadNotifications();
  renderPage();
  initPageActions();
  subscribeRealtime();
}

// ── LOAD NOTIFICATIONS ────────────────────────────────────
async function loadNotifications() {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    notifications = data || [];
    unreadCount   = notifications.filter(n => !n.is_read).length;
  } catch (e) {
    console.warn('Notifications load error:', e?.message);
  }
}

// ── LOAD USER META ────────────────────────────────────────
async function loadUserMeta() {
  try {
    const profile  = await getProfile(currentUser.id);
    const name     = profile?.full_name || 'Investor';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('sidebarUserName', name);
    set('sidebarUserRole', profile?.role === 'admin' ? 'Administrator' : 'Investor');
    set('sidebarAvatar',   initials);
    set('topbarUserName',  name.split(' ')[0]);
    set('topbarAvatar',    initials);
  } catch (e) { console.warn('Profile error:', e?.message); }
}

// ── RENDER BELL BADGE ─────────────────────────────────────
function renderBell() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ── BELL DROPDOWN ─────────────────────────────────────────
function initBellDropdown() {
  const bellBtn    = document.getElementById('notifBellBtn');
  const dropdown   = document.getElementById('notifDropdown');
  if (!bellBtn || !dropdown) return;

  bellBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');

    if (!isOpen) {
      renderDropdown();
      // Mark all as read when opened
      await markAllRead();
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== bellBtn) {
      dropdown.classList.add('hidden');
    }
  });
}

function renderDropdown() {
  const list = document.getElementById('notifDropdownList');
  if (!list) return;

  if (!notifications.length) {
    list.innerHTML = `
      <div style="padding:var(--space-8) var(--space-4);text-align:center;">
        <i data-lucide="bell-off" style="width:32px;height:32px;color:var(--text-faint);display:block;margin:0 auto var(--space-3);"></i>
        <div style="font-size:var(--text-sm);font-weight:600;color:var(--text-muted);">No notifications yet</div>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Show latest 6 in dropdown
  list.innerHTML = notifications.slice(0, 6).map(n => buildNotifItem(n, true)).join('');
  if (window.lucide) lucide.createIcons();
}

function buildNotifItem(n, compact = false) {
  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
  const dot = !n.is_read ? `<span style="width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px;"></span>` : '<span style="width:7px;height:7px;flex-shrink:0;"></span>';

  return `
    <div class="notif-item ${!n.is_read ? 'unread' : ''}" data-id="${n.id}"
      style="display:flex;align-items:flex-start;gap:10px;padding:${compact ? '12px 16px' : '14px 20px'};
             border-bottom:1px solid var(--border-light);cursor:pointer;transition:background 0.15s;
             background:${!n.is_read ? 'var(--surface-2)' : 'transparent'};"
      onmouseover="this.style.background='var(--surface-2)'"
      onmouseout="this.style.background='${!n.is_read ? 'var(--surface-2)' : 'transparent'}'">
      <div style="width:34px;height:34px;border-radius:var(--radius-md);background:${cfg.bg};
                  display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
        <i data-lucide="${cfg.icon}" style="width:16px;height:16px;color:${cfg.color};"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:${!n.is_read ? '700' : '600'};color:var(--text);
                    line-height:1.3;margin-bottom:3px;">${n.title}</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.5;">${n.message}</div>
        <div style="font-size:11px;color:var(--text-faint);margin-top:4px;">${timeAgo(n.created_at)}</div>
      </div>
      ${dot}
    </div>
  `;
}

// ── RENDER FULL PAGE ──────────────────────────────────────
function renderPage() {
  const container  = document.getElementById('notifPageList');
  const emptyEl    = document.getElementById('notifPageEmpty');
  const unreadEl   = document.getElementById('pageUnreadCount');
  const totalEl    = document.getElementById('pageTotalCount');

  if (unreadEl) unreadEl.textContent = unreadCount;
  if (totalEl)  totalEl.textContent  = notifications.length;

  if (!container) return;

  const activeFilter = document.querySelector('[data-notif-filter].active')?.dataset.notifFilter || 'all';
  const filtered = activeFilter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : activeFilter === 'read'
    ? notifications.filter(n => n.is_read)
    : notifications;

  if (!filtered.length) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('d-none');
    return;
  }

  if (emptyEl) emptyEl.classList.add('d-none');
  container.innerHTML = filtered.map(n => buildPageCard(n)).join('');
  if (window.lucide) lucide.createIcons();
}

function buildPageCard(n) {
  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
  return `
    <div class="notif-page-card ${!n.is_read ? 'unread' : ''}" data-id="${n.id}">
      <div class="notif-page-icon" style="background:${cfg.bg};border:1px solid ${cfg.color}33;">
        <i data-lucide="${cfg.icon}" style="width:20px;height:20px;color:${cfg.color};"></i>
      </div>
      <div class="notif-page-body">
        <div class="notif-page-title">${n.title}</div>
        <div class="notif-page-msg">${n.message}</div>
        <div class="notif-page-time">
          <i data-lucide="clock" style="width:11px;height:11px;"></i>
          ${timeAgo(n.created_at)} · ${formatDateTime(n.created_at)}
        </div>
      </div>
      ${!n.is_read ? `<span class="notif-unread-dot"></span>` : ''}
    </div>
  `;
}

// ── PAGE ACTIONS ──────────────────────────────────────────
function initPageActions() {
  // Filter tabs
  document.querySelectorAll('[data-notif-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-notif-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPage();
    });
  });

  // Mark all read button
  document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
    await markAllRead();
    await loadNotifications();
    renderPage();
    renderBell();
    showToast('Done', 'All notifications marked as read.', 'success');
  });

  // Clear all button
  document.getElementById('clearAllBtn')?.addEventListener('click', async () => {
    if (!confirm('Delete all notifications? This cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', currentUser.id);
      if (error) throw error;
      notifications = [];
      unreadCount   = 0;
      renderPage();
      renderBell();
      showToast('Cleared', 'All notifications deleted.', 'success');
    } catch (e) {
      showToast('Error', e?.message, 'error');
    }
  });
}

// ── MARK ALL READ ─────────────────────────────────────────
async function markAllRead() {
  const unread = notifications.filter(n => !n.is_read);
  if (!unread.length) return;

  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);

    notifications = notifications.map(n => ({ ...n, is_read: true }));
    unreadCount   = 0;
    renderBell();
  } catch (e) {
    console.warn('Mark read error:', e?.message);
  }
}

// ── REALTIME SUBSCRIPTION ─────────────────────────────────
function subscribeRealtime() {
  if (realtimeSub) supabase.removeChannel(realtimeSub);

  realtimeSub = supabase
    .channel(`notifications:${currentUser.id}`)
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'notifications',
      filter: `user_id=eq.${currentUser.id}`,
    }, (payload) => {
      const newNotif = payload.new;
      notifications.unshift(newNotif);
      unreadCount++;
      renderBell();

      // Re-render dropdown if open
      const dropdown = document.getElementById('notifDropdown');
      if (dropdown && !dropdown.classList.contains('hidden')) {
        renderDropdown();
      }

      // Re-render page if on notifications page
      const pageList = document.getElementById('notifPageList');
      if (pageList) renderPage();

      // Show toast for new notification
      showToast(newNotif.title, newNotif.message, newNotif.type);
    })
    .subscribe();
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(title, message, type = 'info') {
  const icons = { success:'check-circle', error:'x-circle', warning:'alert-triangle', info:'info' };
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <i data-lucide="${icons[type]}" class="toast-icon"></i>
    <div class="toast-content"><div class="toast-title">${title}</div><div class="toast-message">${message}</div></div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">
      <i data-lucide="x" style="width:14px;height:14px"></i>
    </button>`;
  c.appendChild(t);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 5000);
}
