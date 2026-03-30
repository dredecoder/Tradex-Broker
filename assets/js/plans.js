// ============================================================
// TRADEX — PLANS JS
// assets/js/plans.js
// ============================================================

import { supabase, requireAuth, getProfile, getWallet } from './supabase.js';
import { formatMoney, timeAgo } from './utils.js';

// ── STATE ─────────────────────────────────────────────────
let currentUser   = null;
let currentWallet = null;
let dbPlans       = [];
let activeInvestments = [];

const PLANS_FALLBACK = [
  { id: 'bronze',   tier: 'bronze',   name: 'Bronze',   deposit_amount: 150,   payout_amount: 2000,  duration_days: 7, is_active: true, is_featured: false },
  { id: 'silver',   tier: 'silver',   name: 'Silver',   deposit_amount: 200,   payout_amount: 4000,  duration_days: 7, is_active: true, is_featured: false },
  { id: 'gold',     tier: 'gold',     name: 'Gold',     deposit_amount: 300,   payout_amount: 6000,  duration_days: 7, is_active: true, is_featured: true  },
  { id: 'platinum', tier: 'platinum', name: 'Platinum', deposit_amount: 400,   payout_amount: 8000,  duration_days: 7, is_active: true, is_featured: true  },
  { id: 'diamond',  tier: 'diamond',  name: 'Diamond',  deposit_amount: 500,   payout_amount: 10000, duration_days: 7, is_active: true, is_featured: true  },
  { id: 'heroic',   tier: 'heroic',   name: 'Heroic',   deposit_amount: 1000,  payout_amount: 20000, duration_days: 7, is_active: true, is_featured: false },
];

const TIER_COLORS = {
  bronze: '#cd7f32', silver: '#aaa9ad', gold: '#ffd700',
  platinum: '#e5e4e2', diamond: '#b9f2ff', heroic: '#c084fc',
};

const TIER_EMOJI = {
  bronze: '🥉', silver: '🥈', gold: '🥇',
  platinum: '💎', diamond: '💠', heroic: '🏆',
};

const TIER_BG = {
  bronze:   'rgba(205,127,50,0.12)',
  silver:   'rgba(170,169,173,0.12)',
  gold:     'rgba(255,215,0,0.12)',
  platinum: 'rgba(229,228,226,0.10)',
  diamond:  'rgba(185,242,255,0.10)',
  heroic:   'rgba(192,132,252,0.12)',
};

// ── INIT ──────────────────────────────────────────────────
export async function initPlans() {
  const session = await requireAuth();
  if (!session) return;
  currentUser = session.user;

  await Promise.all([
    loadUserData(),
    loadPlans(),
    loadActiveInvestments(),
  ]);

  renderPlans();
  renderActiveInvestments();
  initInvestModal();
  initLogout();
}

// ── LOAD USER DATA ────────────────────────────────────────
async function loadUserData() {
  try {
    currentWallet = await getWallet(currentUser.id);
    const balEl = document.getElementById('walletBalanceChip');
    if (balEl) balEl.textContent = formatMoney(currentWallet?.balance || 0);
  } catch (e) { console.warn('Wallet error:', e?.message); }

  try {
    const profile = await getProfile(currentUser.id);
    const name     = profile?.full_name || 'Investor';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const firstName = name.split(' ')[0];
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('sidebarUserName', name);
    set('sidebarUserRole', profile?.role === 'admin' ? 'Administrator' : 'Investor');
    set('sidebarAvatar',   initials);
    set('topbarUserName',  firstName);
    set('topbarAvatar',    initials);
  } catch (e) { console.warn('Profile error:', e?.message); }
}

// ── LOAD PLANS FROM SUPABASE ──────────────────────────────
async function loadPlans() {
  try {
    const { data, error } = await supabase
      .from('investment_plans')
      .select('*')
      .eq('is_active', true)
      .order('deposit_amount', { ascending: true });

    if (error) throw error;
    dbPlans = data?.length ? data : PLANS_FALLBACK;
  } catch (e) {
    console.warn('Plans load error:', e?.message);
    dbPlans = PLANS_FALLBACK;
  }
}

// ── LOAD ACTIVE INVESTMENTS ───────────────────────────────
async function loadActiveInvestments() {
  try {
    const { data, error } = await supabase
      .from('investments')
      .select('*, investment_plans(name, tier)')
      .eq('user_id', currentUser.id)
      .in('status', ['active', 'matured'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    activeInvestments = data || [];
  } catch (e) {
    console.warn('Investments error:', e?.message);
    activeInvestments = [];
  }
}

// ── RENDER PLAN CARDS ─────────────────────────────────────
function renderPlans() {
  const container = document.getElementById('plansGrid');
  if (!container) return;

  const balance = currentWallet?.balance || 0;

  container.innerHTML = dbPlans.map(plan => {
    const tier      = plan.tier?.toLowerCase() || 'bronze';
    const color     = TIER_COLORS[tier]  || '#1B4F8A';
    const emoji     = TIER_EMOJI[tier]   || '📈';
    const bg        = TIER_BG[tier]      || 'rgba(27,79,138,0.10)';
    const roi       = (((plan.payout_amount - plan.deposit_amount) / plan.deposit_amount) * 100).toFixed(0);
    const canAfford = balance >= plan.deposit_amount;
    const isActive  = activeInvestments.some(inv => inv.investment_plans?.tier === tier);

    return `
      <div class="plan-card-full ${plan.is_featured ? 'featured' : ''}" data-plan-id="${plan.id}">
        ${plan.is_featured ? `<div class="plan-badge-top">Most Popular</div>` : ''}

        <!-- Tier icon -->
        <div class="plan-card-icon" style="background:${bg};border:1px solid ${color}33;">
          <span style="font-size:32px;">${emoji}</span>
        </div>

        <!-- Name & duration -->
        <div class="plan-card-name">${plan.name}</div>
        <div class="plan-card-duration">
          <i data-lucide="clock" style="width:12px;height:12px"></i>
          ${plan.duration_days} day return cycle
        </div>

        <!-- ROI badge -->
        <div class="plan-roi-badge" style="background:${bg};color:${color};border:1px solid ${color}44;">
          +${roi}% ROI
        </div>

        <div class="plan-divider-line"></div>

        <!-- Amounts -->
        <div class="plan-amounts">
          <div class="plan-amount-col">
            <div class="plan-amount-label">You Invest</div>
            <div class="plan-amount-val">${formatMoney(plan.deposit_amount)}</div>
          </div>
          <div class="plan-amount-arrow" style="color:${color};">→</div>
          <div class="plan-amount-col">
            <div class="plan-amount-label">You Receive</div>
            <div class="plan-amount-val success">${formatMoney(plan.payout_amount)}</div>
          </div>
        </div>

        <!-- Features -->
        <div class="plan-features-list">
          <div class="plan-feature-item">
            <i data-lucide="check-circle" style="width:14px;height:14px;color:var(--success)"></i>
            Instant plan activation
          </div>
          <div class="plan-feature-item">
            <i data-lucide="check-circle" style="width:14px;height:14px;color:var(--success)"></i>
            Auto payout to wallet
          </div>
          <div class="plan-feature-item">
            <i data-lucide="check-circle" style="width:14px;height:14px;color:var(--success)"></i>
            ${plan.duration_days}-day guaranteed return
          </div>
          <div class="plan-feature-item">
            <i data-lucide="check-circle" style="width:14px;height:14px;color:var(--success)"></i>
            Stack with other plans
          </div>
        </div>

        <!-- CTA Button -->
        ${isActive
          ? `<div class="btn btn-outline btn-full" style="cursor:default;opacity:0.7;">
               <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--success)"></i>
               Currently Active
             </div>`
          : canAfford
            ? `<button class="btn ${plan.is_featured ? 'btn-accent' : 'btn-primary'} btn-full invest-btn"
                 onclick="openInvestModal('${plan.id}')"
                 data-plan-id="${plan.id}">
                 <i data-lucide="trending-up" style="width:16px;height:16px"></i>
                 Invest ${formatMoney(plan.deposit_amount)}
               </button>`
            : `<button class="btn btn-outline btn-full" onclick="showDepositPrompt(${plan.deposit_amount})">
                 <i data-lucide="arrow-down-circle" style="width:16px;height:16px"></i>
                 Deposit ${formatMoney(plan.deposit_amount)} First
               </button>`
        }

        ${!canAfford && !isActive
          ? `<div style="margin-top:var(--space-2);font-size:11px;color:var(--text-faint);text-align:center;">
               You need ${formatMoney(plan.deposit_amount - balance)} more
             </div>`
          : ''
        }
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ── RENDER ACTIVE INVESTMENTS ─────────────────────────────
function renderActiveInvestments() {
  const container = document.getElementById('activeInvestList');
  const emptyEl   = document.getElementById('activeInvestEmpty');
  const countEl   = document.getElementById('activeCount');

  if (countEl) countEl.textContent = activeInvestments.length;

  if (!container) return;

  if (!activeInvestments.length) {
    if (emptyEl) emptyEl.classList.remove('d-none');
    return;
  }

  if (emptyEl) emptyEl.classList.add('d-none');

  container.innerHTML = activeInvestments.map(inv => {
    const tier     = inv.investment_plans?.tier || 'bronze';
    const color    = TIER_COLORS[tier] || '#1B4F8A';
    const emoji    = TIER_EMOJI[tier]  || '📈';
    const end      = new Date(inv.end_date);
    const now      = new Date();
    const start    = new Date(inv.start_date);
    const totalMs  = end - start;
    const elapsed  = Math.max(0, now - start);
    const pct      = Math.min(100, (elapsed / totalMs) * 100).toFixed(1);
    const isMatured = inv.status === 'matured' || now >= end;

    return `
      <div class="active-inv-row">
        <div style="display:flex;align-items:center;gap:var(--space-3);flex:1;min-width:0;">
          <div style="width:40px;height:40px;border-radius:var(--radius-md);background:${color}22;border:1px solid ${color}44;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
            ${emoji}
          </div>
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:var(--text-sm);color:var(--text);">${inv.investment_plans?.name || 'Plan'}</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted);">${formatMoney(inv.amount)} → ${formatMoney(inv.payout_amount)}</div>
            <div class="progress-bar" style="height:4px;margin-top:6px;width:140px;">
              <div class="progress-fill" style="width:${pct}%;background:linear-gradient(90deg,${color},#4ade80);"></div>
            </div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          ${isMatured
            ? `<span class="badge badge-warning">Maturing</span>`
            : `<span class="badge badge-success">${pct}%</span>`
          }
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:4px;">${isMatured ? 'Payout soon' : 'In progress'}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── INVEST MODAL ──────────────────────────────────────────
function initInvestModal() {
  const modal     = document.getElementById('investModal');
  const overlay   = document.getElementById('investModalOverlay');
  const closeBtn  = document.getElementById('investModalClose');
  const confirmBtn= document.getElementById('investConfirmBtn');

  closeBtn?.addEventListener('click',  closeInvestModal);
  overlay?.addEventListener('click',   closeInvestModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeInvestModal();
  });

  confirmBtn?.addEventListener('click', async () => {
    const planId = confirmBtn.dataset.planId;
    if (!planId) return;

    const plan    = dbPlans.find(p => p.id === planId);
    const balance = currentWallet?.balance || 0;

    if (!plan) return;
    if (balance < plan.deposit_amount) {
      showToast('Insufficient Balance', `You need ${formatMoney(plan.deposit_amount - balance)} more. Please deposit first.`, 'error');
      closeInvestModal();
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spinner spinner-sm" style="border-top-color:white;margin-right:8px;"></span> Processing...`;

    try {
      const startDate = new Date();
      const endDate   = new Date(startDate.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from('investments')
        .insert({
          user_id:       currentUser.id,
          plan_id:       plan.id,
          amount:        plan.deposit_amount,
          payout_amount: plan.payout_amount,
          status:        'active',
          start_date:    startDate.toISOString(),
          end_date:      endDate.toISOString(),
        });

      if (error) throw error;

      closeInvestModal();
      showToast('Investment Active!', `Your ${plan.name} plan is live. Payout of ${formatMoney(plan.payout_amount)} in ${plan.duration_days} days.`, 'success');

      // Refresh data
      await Promise.all([loadActiveInvestments(), loadUserData()]);
      renderPlans();
      renderActiveInvestments();
      if (window.lucide) lucide.createIcons();

    } catch (err) {
      console.error('Invest error:', err);
      showToast('Failed', err?.message || 'Investment failed. Please try again.', 'error');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<i data-lucide="trending-up" style="width:18px;height:18px"></i> Confirm Investment`;
      if (window.lucide) lucide.createIcons();
    }
  });
}

window.openInvestModal = function(planId) {
  const plan    = dbPlans.find(p => p.id === planId);
  if (!plan) return;

  const tier    = plan.tier?.toLowerCase() || 'bronze';
  const emoji   = TIER_EMOJI[tier] || '📈';
  const balance = currentWallet?.balance || 0;
  const roi     = (((plan.payout_amount - plan.deposit_amount) / plan.deposit_amount) * 100).toFixed(0);

  // Populate modal
  document.getElementById('modalPlanEmoji').textContent  = emoji;
  document.getElementById('modalPlanName').textContent   = plan.name + ' Plan';
  document.getElementById('modalInvestAmt').textContent  = formatMoney(plan.deposit_amount);
  document.getElementById('modalPayoutAmt').textContent  = formatMoney(plan.payout_amount);
  document.getElementById('modalROI').textContent        = `+${roi}%`;
  document.getElementById('modalDuration').textContent   = `${plan.duration_days} days`;
  document.getElementById('modalBalance').textContent    = formatMoney(balance);
  document.getElementById('modalAfterBalance').textContent = formatMoney(balance - plan.deposit_amount);

  const confirmBtn = document.getElementById('investConfirmBtn');
  if (confirmBtn) {
    confirmBtn.dataset.planId = planId;
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `<i data-lucide="trending-up" style="width:18px;height:18px"></i> Confirm — Invest ${formatMoney(plan.deposit_amount)}`;
  }

  document.getElementById('investModalOverlay').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
};

function closeInvestModal() {
  document.getElementById('investModalOverlay')?.classList.add('hidden');
}

window.showDepositPrompt = function(amount) {
  showToast('Deposit Required', `You need to deposit ${formatMoney(amount)} first. Redirecting...`, 'info');
  setTimeout(() => { window.location.href = '../deposit/index.html'; }, 1500);
};

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
  const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
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
