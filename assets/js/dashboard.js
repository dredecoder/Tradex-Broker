// ============================================================
// TRADEX — DASHBOARD JS
// assets/js/dashboard.js
// ============================================================

import { supabase, requireAuth, getProfile, getWallet } from './supabase.js';
import { formatMoney, formatDate, timeAgo, getPlanTierColor, getPlanTierEmoji } from './utils.js';

// ── LOGOUT (inline — avoids circular import with auth.js) ─
async function logout() {
  try { await supabase.auth.signOut(); } catch {}
  window.location.href = '../login.html';
}

// ── STATE ─────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let currentWallet  = null;
let investments    = [];
let transactions   = [];
let notifications  = [];
let countdownTimers = {};

// ── INIT ──────────────────────────────────────────────────
export async function initDashboard() {
  const session = await requireAuth();
  if (!session) return;

  currentUser = session.user;

  // Load each section independently — one failure won't kill the rest
  await loadProfile();
  await loadWallet();
  await loadInvestments();
  await loadTransactions();
  await loadNotifications();

  renderAll();
  startCountdowns();
  subscribeToRealtime();
  initLogout();
}

// ── LOADERS ───────────────────────────────────────────────
async function loadProfile() {
  try {
    currentProfile = await getProfile(currentUser.id);
    renderProfile();
  } catch (err) {
    console.warn('Profile load error:', err?.message || err);
  }
}

async function loadWallet() {
  try {
    currentWallet = await getWallet(currentUser.id);
    renderWallet();
  } catch (err) {
    console.warn('Wallet load error:', err?.message || err);
  }
}

async function loadInvestments() {
  try {
    const { data, error } = await supabase
      .from('investments')
      .select('*, investment_plans(name, tier, payout_amount, deposit_amount)')
      .eq('user_id', currentUser.id)
      .in('status', ['active', 'matured'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    investments = data || [];
    renderInvestments();
  } catch (err) {
    console.warn('Investments load error:', err?.message || err);
    investments = [];
    renderInvestments();
  }
}

async function loadTransactions() {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) throw error;
    transactions = data || [];
    renderTransactions();
  } catch (err) {
    console.warn('Transactions load error:', err?.message || err);
    transactions = [];
    renderTransactions();
  }
}

async function loadNotifications() {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    notifications = data || [];
    renderNotifications();
  } catch (err) {
    console.warn('Notifications load error:', err?.message || err);
    notifications = [];
    renderNotifications();
  }
}

// ── RENDERERS ─────────────────────────────────────────────

function renderProfile() {
  if (!currentProfile) return;
  const name     = currentProfile.full_name || 'Investor';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const firstName = name.split(' ')[0];

  // Sidebar user
  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarRole = document.getElementById('sidebarUserRole');
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  if (sidebarName)   sidebarName.textContent   = name;
  if (sidebarRole)   sidebarRole.textContent   = currentProfile.role === 'admin' ? 'Administrator' : 'Investor';
  if (sidebarAvatar) sidebarAvatar.textContent = initials;

  // Topbar
  const topbarName   = document.getElementById('topbarUserName');
  const topbarAvatar = document.getElementById('topbarAvatar');
  if (topbarName)   topbarName.textContent   = firstName;
  if (topbarAvatar) topbarAvatar.textContent = initials;

  // Welcome
  const welcomeEl = document.getElementById('welcomeName');
  if (welcomeEl) welcomeEl.textContent = firstName;

  // KYC badge
  const kycBadge = document.getElementById('kycBadge');
  if (kycBadge) {
    const kycMap = {
      pending:  { cls: 'badge-warning', text: 'KYC Pending' },
      verified: { cls: 'badge-success', text: 'KYC Verified' },
      rejected: { cls: 'badge-error',   text: 'KYC Rejected' },
    };
    const k = kycMap[currentProfile.kyc_status] || kycMap.pending;
    kycBadge.className = `badge ${k.cls}`;
    kycBadge.textContent = k.text;
  }
}

function renderWallet() {
  if (!currentWallet) return;

  animateCounter('statBalance',   currentWallet.balance,         true);
  animateCounter('statBonus',     currentWallet.bonus,           true);
  animateCounter('statInvested',  currentWallet.total_invested,  true);
  animateCounter('statProfit',    currentWallet.total_profit,    true);
}

function animateCounter(id, target, isMoney = false) {
  const el = document.getElementById(id);
  if (!el) return;

  const duration = 1200;
  const start    = performance.now();
  const from     = 0;

  function update(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value    = from + (target - from) * ease;

    el.textContent = isMoney ? formatMoney(value) : Math.round(value).toLocaleString();

    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function renderInvestments() {
  const container = document.getElementById('investmentsList');
  const emptyEl   = document.getElementById('investmentsEmpty');
  const countEl   = document.getElementById('activeInvestCount');

  if (!container) return;

  if (countEl) countEl.textContent = investments.length;

  if (!investments.length) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('d-none');
    return;
  }

  if (emptyEl) emptyEl.classList.add('d-none');

  container.innerHTML = investments.map(inv => {
    const plan       = inv.investment_plans;
    const tierColor  = getPlanTierColor(plan?.tier);
    const tierEmoji  = getPlanTierEmoji(plan?.tier);
    const endDate    = new Date(inv.end_date);
    const startDate  = new Date(inv.start_date);
    const now        = new Date();
    const totalMs    = endDate - startDate;
    const elapsedMs  = Math.max(0, now - startDate);
    const progressPct= Math.min(100, (elapsedMs / totalMs) * 100).toFixed(1);

    // Current projected value (linear interpolation)
    const currentValue = inv.amount + ((inv.payout_amount - inv.amount) * (elapsedMs / totalMs));
    const cappedValue  = Math.min(currentValue, inv.payout_amount);

    const isMatured = inv.status === 'matured' || now >= endDate;

    return `
      <div class="investment-card" data-id="${inv.id}">
        <div class="inv-header">
          <div class="inv-plan-info">
            <div class="inv-tier-icon" style="background:${tierColor}22; border:1px solid ${tierColor}44;">
              <span>${tierEmoji}</span>
            </div>
            <div>
              <div class="inv-plan-name">${plan?.name || 'Plan'}</div>
              <div class="inv-date">Started ${formatDate(inv.start_date)}</div>
            </div>
          </div>
          <div class="inv-status-badge">
            ${isMatured
              ? '<span class="badge badge-warning"><span class="status-dot matured" style="margin:0"></span> Maturing</span>'
              : '<span class="badge badge-success"><span class="status-dot active" style="margin:0"></span> Active</span>'
            }
          </div>
        </div>

        <div class="inv-amounts">
          <div class="inv-amount-col">
            <div class="inv-amount-label">Invested</div>
            <div class="inv-amount-val">${formatMoney(inv.amount)}</div>
          </div>
          <div class="inv-arrow">→</div>
          <div class="inv-amount-col">
            <div class="inv-amount-label">Current Value</div>
            <div class="inv-amount-val success" id="invValue_${inv.id}">${formatMoney(cappedValue)}</div>
          </div>
          <div class="inv-arrow">→</div>
          <div class="inv-amount-col">
            <div class="inv-amount-label">Payout</div>
            <div class="inv-amount-val accent">${formatMoney(inv.payout_amount)}</div>
          </div>
        </div>

        <div class="inv-progress-section">
          <div class="inv-progress-header">
            <span class="inv-progress-label">Progress</span>
            <span class="inv-progress-pct" id="invPct_${inv.id}">${progressPct}%</span>
          </div>
          <div class="progress-bar" style="height:8px;">
            <div class="progress-fill" id="invBar_${inv.id}"
              style="width:${progressPct}%; background: linear-gradient(90deg, ${tierColor}, #4ade80);">
            </div>
          </div>
        </div>

        <div class="inv-countdown" id="invCountdown_${inv.id}" data-end="${inv.end_date}">
          ${isMatured
            ? `<div class="countdown-matured">
                <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--success)"></i>
                <span>Plan matured — payout processing soon</span>
               </div>`
            : `<div class="countdown-grid">
                <div class="countdown-unit"><span class="cdown-val" data-unit="days">--</span><span class="cdown-lbl">Days</span></div>
                <div class="countdown-sep">:</div>
                <div class="countdown-unit"><span class="cdown-val" data-unit="hours">--</span><span class="cdown-lbl">Hrs</span></div>
                <div class="countdown-sep">:</div>
                <div class="countdown-unit"><span class="cdown-val" data-unit="mins">--</span><span class="cdown-lbl">Mins</span></div>
                <div class="countdown-sep">:</div>
                <div class="countdown-unit"><span class="cdown-val" data-unit="secs">--</span><span class="cdown-lbl">Secs</span></div>
               </div>`
          }
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderTransactions() {
  const tbody   = document.getElementById('txTableBody');
  const emptyEl = document.getElementById('txEmpty');

  if (!tbody) return;

  if (!transactions.length) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('d-none');
    return;
  }

  if (emptyEl) emptyEl.classList.add('d-none');

  tbody.innerHTML = transactions.map(tx => {
    const typeMap = {
      deposit:    { icon: 'arrow-down-circle', cls: 'badge-success',  label: 'Deposit' },
      withdrawal: { icon: 'arrow-up-circle',   cls: 'badge-accent',   label: 'Withdrawal' },
      profit:     { icon: 'trending-up',        cls: 'badge-primary',  label: 'Profit' },
      bonus:      { icon: 'gift',               cls: 'badge-warning',  label: 'Bonus' },
      referral:   { icon: 'users',              cls: 'badge-neutral',  label: 'Referral' },
    };

    const statusMap = {
      pending:  'badge-warning',
      approved: 'badge-success',
      rejected: 'badge-error',
    };

    const t = typeMap[tx.type]   || typeMap.deposit;
    const s = statusMap[tx.status] || 'badge-neutral';
    const isCredit = ['deposit','profit','bonus','referral'].includes(tx.type);

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:8px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i data-lucide="${t.icon}" style="width:16px;height:16px;color:var(--text-muted)"></i>
            </div>
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--text);">${t.label}</div>
              <div class="td-ref">#${tx.reference || tx.id.slice(0,8).toUpperCase()}</div>
            </div>
          </div>
        </td>
        <td class="td-amount ${isCredit ? 'positive' : 'negative'}">
          ${isCredit ? '+' : '-'}${formatMoney(tx.amount)}
        </td>
        <td><span class="badge ${s} status-dot ${tx.status}">${tx.status}</span></td>
        <td style="font-size:12px;color:var(--text-muted);">${timeAgo(tx.created_at)}</td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderNotifications() {
  const list    = document.getElementById('notifList');
  const countEl = document.getElementById('notifCount');
  const unread  = notifications.filter(n => !n.is_read).length;

  if (countEl) {
    countEl.textContent = unread > 0 ? (unread > 9 ? '9+' : unread) : '';
    countEl.style.display = unread > 0 ? 'flex' : 'none';
  }

  if (!list) return;

  if (!notifications.length) {
    list.innerHTML = `
      <div class="empty-state" style="padding:32px 16px;">
        <i data-lucide="bell-off" style="width:32px;height:32px;color:var(--border-strong);margin:0 auto 12px;display:block;"></i>
        <div class="empty-title" style="font-size:14px;">No notifications</div>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" onclick="markNotifRead('${n.id}')">
      <div class="notif-dot" style="background:${n.is_read ? 'transparent' : 'var(--accent)'}"></div>
      <div class="notif-text">
        <div class="notif-msg"><strong>${n.title}</strong> — ${n.message}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// ── COUNTDOWNS ────────────────────────────────────────────
function startCountdowns() {
  // Clear existing
  Object.values(countdownTimers).forEach(clearInterval);
  countdownTimers = {};

  investments.forEach(inv => {
    if (inv.status === 'matured') return;

    const endDate   = new Date(inv.end_date);
    const startDate = new Date(inv.start_date);
    const totalMs   = endDate - startDate;

    countdownTimers[inv.id] = setInterval(() => {
      const now       = new Date();
      const remaining = endDate - now;

      if (remaining <= 0) {
        clearInterval(countdownTimers[inv.id]);
        // Reload to show matured state
        loadInvestments();
        return;
      }

      // Countdown
      const days  = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins  = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const secs  = Math.floor((remaining % (1000 * 60)) / 1000);

      const container = document.getElementById(`invCountdown_${inv.id}`);
      if (container) {
        const dEl = container.querySelector('[data-unit="days"]');
        const hEl = container.querySelector('[data-unit="hours"]');
        const mEl = container.querySelector('[data-unit="mins"]');
        const sEl = container.querySelector('[data-unit="secs"]');
        if (dEl) dEl.textContent = String(days).padStart(2, '0');
        if (hEl) hEl.textContent = String(hours).padStart(2, '0');
        if (mEl) mEl.textContent = String(mins).padStart(2, '0');
        if (sEl) sEl.textContent = String(secs).padStart(2, '0');
      }

      // Progress bar + percentage
      const elapsed    = Math.max(0, now - startDate);
      const pct        = Math.min(100, (elapsed / totalMs) * 100).toFixed(1);
      const barEl      = document.getElementById(`invBar_${inv.id}`);
      const pctEl      = document.getElementById(`invPct_${inv.id}`);
      if (barEl) barEl.style.width = `${pct}%`;
      if (pctEl) pctEl.textContent = `${pct}%`;

      // Current value
      const currentVal = inv.amount + ((inv.payout_amount - inv.amount) * (elapsed / totalMs));
      const valEl      = document.getElementById(`invValue_${inv.id}`);
      if (valEl) valEl.textContent = formatMoney(Math.min(currentVal, inv.payout_amount));

    }, 1000);
  });
}

// ── MARK NOTIFICATION READ ────────────────────────────────
window.markNotifRead = async function(id) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  const n = notifications.find(n => n.id === id);
  if (n) n.is_read = true;
  renderNotifications();
};

// ── MARK ALL READ ─────────────────────────────────────────
window.markAllNotifsRead = async function() {
  await supabase.from('notifications')
    .update({ is_read: true })
    .eq('user_id', currentUser.id)
    .eq('is_read', false);
  notifications.forEach(n => n.is_read = true);
  renderNotifications();
};

// ── REALTIME SUBSCRIPTIONS ────────────────────────────────
function subscribeToRealtime() {
  // Wallet changes (balance updates)
  supabase.channel('wallet-changes')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'wallets',
      filter: `user_id=eq.${currentUser.id}`
    }, (payload) => {
      currentWallet = payload.new;
      renderWallet();
    })
    .subscribe();

  // New notifications
  supabase.channel('notif-changes')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_id=eq.${currentUser.id}`
    }, (payload) => {
      notifications.unshift(payload.new);
      renderNotifications();
      showToast(payload.new.title, payload.new.message, payload.new.type || 'info');
    })
    .subscribe();

  // Investment status changes
  supabase.channel('investment-changes')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'investments',
      filter: `user_id=eq.${currentUser.id}`
    }, () => {
      loadInvestments();
      loadWallet();
    })
    .subscribe();
}

// ── RENDER ALL ────────────────────────────────────────────
function renderAll() {
  renderProfile();
  renderWallet();
  renderInvestments();
  renderTransactions();
  renderNotifications();
  if (window.lucide) lucide.createIcons();
}

// ── LOGOUT ────────────────────────────────────────────────
function initLogout() {
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await logout();
    });
  });
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(title, message, type = 'info') {
  const icons = { success:'check-circle', error:'x-circle', warning:'alert-triangle', info:'info' };
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i data-lucide="${icons[type]}" class="toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">
      <i data-lucide="x" style="width:14px;height:14px"></i>
    </button>`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 5000);
}
