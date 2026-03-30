// ============================================================
// TRADEX — PORTFOLIO JS
// assets/js/portfolio.js
// ============================================================

import { supabase, requireAuth, getProfile, getWallet } from './supabase.js';
import { formatMoney, formatDate, timeAgo, getPlanTierColor, getPlanTierEmoji } from './utils.js';

// ── STATE ─────────────────────────────────────────────────
let currentUser    = null;
let currentWallet  = null;
let allInvestments = [];
let countdownTimers = {};

// ── INIT ──────────────────────────────────────────────────
export async function initPortfolio() {
  const session = await requireAuth();
  if (!session) return;
  currentUser = session.user;

  await loadUserData();
  await loadInvestments();

  renderStats();
  renderInvestments('all');
  startCountdowns();
  initTabs();
  initLogout();
}

// ── LOAD USER DATA ────────────────────────────────────────
async function loadUserData() {
  try {
    currentWallet = await getWallet(currentUser.id);
  } catch (e) { console.warn('Wallet error:', e?.message); }

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

// ── LOAD INVESTMENTS ──────────────────────────────────────
async function loadInvestments() {
  try {
    const { data, error } = await supabase
      .from('investments')
      .select('*, investment_plans(name, tier, deposit_amount, payout_amount)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    allInvestments = data || [];
  } catch (e) {
    console.warn('Investments error:', e?.message);
    allInvestments = [];
  }
}

// ── RENDER STATS ──────────────────────────────────────────
function renderStats() {
  const active    = allInvestments.filter(i => i.status === 'active' || i.status === 'matured');
  const completed = allInvestments.filter(i => i.status === 'paid');
  const totalInv  = allInvestments.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = completed.reduce((s, i) => s + Number(i.payout_amount), 0);
  const totalProfit = completed.reduce((s, i) => s + (Number(i.payout_amount) - Number(i.amount)), 0);

  // Animated counters
  animateCounter('statTotalInvested', totalInv,    true);
  animateCounter('statTotalProfit',   totalProfit, true);
  animateCounter('statActivePlans',   active.length, false);
  animateCounter('statCompleted',     completed.length, false);

  // Wallet stats
  animateCounter('statBalance',       currentWallet?.balance       || 0, true);
  animateCounter('statTotalWithdrawn',currentWallet?.total_withdrawn || 0, true);
}

function animateCounter(id, target, isMoney) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 1200;
  const start    = performance.now();
  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);
    const value    = target * ease;
    el.textContent = isMoney ? formatMoney(value) : Math.round(value).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ── TABS ──────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.portfolio-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.portfolio-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderInvestments(tab.dataset.filter);
    });
  });
}

// ── RENDER INVESTMENTS ────────────────────────────────────
function renderInvestments(filter = 'all') {
  const container = document.getElementById('investmentsList');
  const emptyEl   = document.getElementById('portfolioEmpty');
  const countEl   = document.getElementById('filteredCount');

  if (!container) return;

  // Clear existing countdowns
  Object.values(countdownTimers).forEach(clearInterval);
  countdownTimers = {};

  const filtered = filter === 'all'
    ? allInvestments
    : allInvestments.filter(i => {
        if (filter === 'active')    return i.status === 'active' || i.status === 'matured';
        if (filter === 'completed') return i.status === 'paid';
        if (filter === 'cancelled') return i.status === 'cancelled';
        return true;
      });

  if (countEl) countEl.textContent = filtered.length;

  if (!filtered.length) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('d-none');
    return;
  }

  if (emptyEl) emptyEl.classList.add('d-none');

  container.innerHTML = filtered.map(inv => buildInvestmentCard(inv)).join('');

  if (window.lucide) lucide.createIcons();
  startCountdowns(filtered);
}

// ── BUILD INVESTMENT CARD ─────────────────────────────────
function buildInvestmentCard(inv) {
  const plan       = inv.investment_plans;
  const tierColor  = getPlanTierColor(plan?.tier);
  const tierEmoji  = getPlanTierEmoji(plan?.tier);
  const endDate    = new Date(inv.end_date);
  const startDate  = new Date(inv.start_date);
  const now        = new Date();
  const totalMs    = endDate - startDate;
  const elapsedMs  = Math.max(0, now - startDate);
  const progressPct= Math.min(100, (elapsedMs / totalMs) * 100).toFixed(1);
  const currentVal = inv.amount + ((inv.payout_amount - inv.amount) * (elapsedMs / totalMs));
  const cappedVal  = Math.min(currentVal, inv.payout_amount);
  const profit     = Number(inv.payout_amount) - Number(inv.amount);
  const isActive   = inv.status === 'active' || inv.status === 'matured';
  const isPaid     = inv.status === 'paid';
  const isMatured  = inv.status === 'matured' || now >= endDate;

  const statusMap = {
    active:    '<span class="status-dot active">Active</span>',
    matured:   '<span class="status-dot matured">Maturing</span>',
    paid:      '<span class="status-dot paid">Paid Out</span>',
    cancelled: '<span class="badge badge-neutral">Cancelled</span>',
  };

  return `
    <div class="portfolio-card animate-fade-in-up" data-id="${inv.id}">
      <div class="portfolio-card-header">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div class="portfolio-tier-icon" style="background:${tierColor}22;border:1px solid ${tierColor}44;">
            <span style="font-size:22px;">${tierEmoji}</span>
          </div>
          <div>
            <div class="portfolio-plan-name">${plan?.name || 'Plan'}</div>
            <div class="portfolio-plan-date">Started ${formatDate(inv.start_date)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          ${statusMap[inv.status] || ''}
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:4px;">
            ${isPaid ? `Paid ${formatDate(inv.paid_at || inv.end_date)}` : `Ends ${formatDate(inv.end_date)}`}
          </div>
        </div>
      </div>

      <!-- Amount breakdown -->
      <div class="portfolio-amounts">
        <div class="portfolio-amt-col">
          <div class="portfolio-amt-label">Invested</div>
          <div class="portfolio-amt-val">${formatMoney(inv.amount)}</div>
        </div>
        <div class="portfolio-amt-col">
          <div class="portfolio-amt-label">${isActive ? 'Current Value' : 'Final Payout'}</div>
          <div class="portfolio-amt-val success" id="portVal_${inv.id}">
            ${isActive ? formatMoney(cappedVal) : formatMoney(inv.payout_amount)}
          </div>
        </div>
        <div class="portfolio-amt-col">
          <div class="portfolio-amt-label">Profit</div>
          <div class="portfolio-amt-val" style="color:var(--success);">+${formatMoney(profit)}</div>
        </div>
        <div class="portfolio-amt-col">
          <div class="portfolio-amt-label">ROI</div>
          <div class="portfolio-amt-val" style="color:var(--success);">
            +${(((inv.payout_amount - inv.amount) / inv.amount) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      ${isActive ? `
        <!-- Progress -->
        <div class="portfolio-progress-section">
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
            <span style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);">Progress</span>
            <span style="font-size:var(--text-sm);font-weight:800;color:var(--success);" id="portPct_${inv.id}">${progressPct}%</span>
          </div>
          <div class="progress-bar" style="height:8px;">
            <div class="progress-fill" id="portBar_${inv.id}"
              style="width:${progressPct}%;background:linear-gradient(90deg,${tierColor},#4ade80);transition:width 1s ease;">
            </div>
          </div>
        </div>

        <!-- Countdown or matured -->
        <div class="portfolio-countdown" id="portCountdown_${inv.id}" data-end="${inv.end_date}">
          ${isMatured
            ? `<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:var(--space-3);background:var(--success-bg);border-radius:var(--radius-md);">
                <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--success)"></i>
                <span style="font-size:var(--text-sm);font-weight:600;color:var(--success);">Plan matured — payout processing soon</span>
               </div>`
            : `<div class="countdown-strip">
                <div class="cdown-box">
                  <span class="cdown-num" data-unit="days">--</span>
                  <span class="cdown-lbl">Days</span>
                </div>
                <span class="cdown-colon">:</span>
                <div class="cdown-box">
                  <span class="cdown-num" data-unit="hours">--</span>
                  <span class="cdown-lbl">Hrs</span>
                </div>
                <span class="cdown-colon">:</span>
                <div class="cdown-box">
                  <span class="cdown-num" data-unit="mins">--</span>
                  <span class="cdown-lbl">Min</span>
                </div>
                <span class="cdown-colon">:</span>
                <div class="cdown-box">
                  <span class="cdown-num" data-unit="secs">--</span>
                  <span class="cdown-lbl">Sec</span>
                </div>
               </div>`
          }
        </div>
      ` : ''}

      ${isPaid ? `
        <div style="display:flex;align-items:center;gap:8px;padding:var(--space-3) var(--space-4);background:var(--success-bg);border:1px solid var(--success-border);border-radius:var(--radius-md);">
          <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--success)"></i>
          <span style="font-size:var(--text-sm);font-weight:600;color:var(--success);">
            ${formatMoney(inv.payout_amount)} paid to your wallet
          </span>
        </div>
      ` : ''}
    </div>
  `;
}

// ── COUNTDOWNS ────────────────────────────────────────────
function startCountdowns(investments = allInvestments) {
  Object.values(countdownTimers).forEach(clearInterval);
  countdownTimers = {};

  investments.forEach(inv => {
    if (inv.status !== 'active') return;

    const endDate  = new Date(inv.end_date);
    const startDate = new Date(inv.start_date);
    const totalMs  = endDate - startDate;

    countdownTimers[inv.id] = setInterval(() => {
      const now       = new Date();
      const remaining = endDate - now;

      if (remaining <= 0) {
        clearInterval(countdownTimers[inv.id]);
        loadInvestments().then(() => {
          renderInvestments(document.querySelector('.portfolio-tab.active')?.dataset.filter || 'all');
        });
        return;
      }

      const days  = Math.floor(remaining / 86400000);
      const hours = Math.floor((remaining % 86400000) / 3600000);
      const mins  = Math.floor((remaining % 3600000)  / 60000);
      const secs  = Math.floor((remaining % 60000)    / 1000);

      const container = document.getElementById(`portCountdown_${inv.id}`);
      if (container) {
        const get = (u) => container.querySelector(`[data-unit="${u}"]`);
        if (get('days'))  get('days').textContent  = String(days).padStart(2,'0');
        if (get('hours')) get('hours').textContent = String(hours).padStart(2,'0');
        if (get('mins'))  get('mins').textContent  = String(mins).padStart(2,'0');
        if (get('secs'))  get('secs').textContent  = String(secs).padStart(2,'0');
      }

      // Update progress + value
      const elapsed  = Math.max(0, now - startDate);
      const pct      = Math.min(100, (elapsed / totalMs) * 100).toFixed(1);
      const currVal  = Number(inv.amount) + ((Number(inv.payout_amount) - Number(inv.amount)) * (elapsed / totalMs));

      const barEl = document.getElementById(`portBar_${inv.id}`);
      const pctEl = document.getElementById(`portPct_${inv.id}`);
      const valEl = document.getElementById(`portVal_${inv.id}`);
      if (barEl) barEl.style.width = `${pct}%`;
      if (pctEl) pctEl.textContent = `${pct}%`;
      if (valEl) valEl.textContent = formatMoney(Math.min(currVal, inv.payout_amount));

    }, 1000);
  });
}

// ── LOGOUT ────────────────────────────────────────────────
function initLogout() {
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await supabase.auth.signOut(); } catch {}
      window.location.href = '/login.html';
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
