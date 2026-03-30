// ============================================================
// TRADEX — WITHDRAW JS
// assets/js/withdraw.js
// ============================================================

import { supabase, requireAuth, getProfile, getWallet } from './supabase.js';
import { formatMoney, formatDate, timeAgo } from './utils.js';

// ── STATE ─────────────────────────────────────────────────
let currentUser   = null;
let currentWallet = null;

const MIN_WITHDRAWAL = 20;

const METHODS = [
  { id: 'bitcoin',      label: 'Bitcoin',       icon: 'bitcoin',       placeholder: 'Enter your BTC wallet address' },
  { id: 'usdt_trc20',   label: 'USDT (TRC20)',  icon: 'circle-dollar-sign', placeholder: 'Enter your USDT TRC20 address' },
  { id: 'usdt_erc20',   label: 'USDT (ERC20)',  icon: 'circle-dollar-sign', placeholder: 'Enter your USDT ERC20 address' },
  { id: 'bank',         label: 'Bank Transfer', icon: 'landmark',      placeholder: 'Account number, routing number, bank name' },
];

// ── INIT ──────────────────────────────────────────────────
export async function initWithdraw() {
  const session = await requireAuth();
  if (!session) return;
  currentUser = session.user;

  await loadUserData();
  renderMethodCards();
  renderRecentWithdrawals();
  initForm();
  initLogout();
}

// ── LOAD USER DATA ────────────────────────────────────────
async function loadUserData() {
  try {
    currentWallet = await getWallet(currentUser.id);
    renderBalances();
  } catch (e) {
    console.warn('Wallet load error:', e?.message);
  }

  try {
    const profile = await getProfile(currentUser.id);
    const name     = profile?.full_name || 'Investor';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const firstName = name.split(' ')[0];

    const els = {
      sidebarUserName:  document.getElementById('sidebarUserName'),
      sidebarUserRole:  document.getElementById('sidebarUserRole'),
      sidebarAvatar:    document.getElementById('sidebarAvatar'),
      topbarUserName:   document.getElementById('topbarUserName'),
      topbarAvatar:     document.getElementById('topbarAvatar'),
    };
    if (els.sidebarUserName)  els.sidebarUserName.textContent  = name;
    if (els.sidebarUserRole)  els.sidebarUserRole.textContent  = profile?.role === 'admin' ? 'Administrator' : 'Investor';
    if (els.sidebarAvatar)    els.sidebarAvatar.textContent    = initials;
    if (els.topbarUserName)   els.topbarUserName.textContent   = firstName;
    if (els.topbarAvatar)     els.topbarAvatar.textContent     = initials;
  } catch (e) {
    console.warn('Profile load error:', e?.message);
  }
}

// ── RENDER BALANCES ───────────────────────────────────────
function renderBalances() {
  const balance = currentWallet?.balance || 0;
  const bonus   = currentWallet?.bonus   || 0;
  const total   = balance + bonus;

  const balanceEl  = document.getElementById('availableBalance');
  const bonusEl    = document.getElementById('bonusBalance');
  const totalEl    = document.getElementById('totalWithdrawable');
  const chipEl     = document.getElementById('walletBalanceChip');
  const maxBtn     = document.getElementById('maxAmountBtn');

  if (balanceEl) balanceEl.textContent = formatMoney(balance);
  if (bonusEl)   bonusEl.textContent   = formatMoney(bonus);
  if (totalEl)   totalEl.textContent   = formatMoney(total);
  if (chipEl)    chipEl.textContent    = formatMoney(balance);

  // Max button sets amount to full balance
  maxBtn?.addEventListener('click', () => {
    const amountEl = document.getElementById('withdrawAmount');
    if (amountEl) {
      amountEl.value = balance.toFixed(2);
      amountEl.dispatchEvent(new Event('input'));
    }
  });

  // Update min withdrawal hint
  const minEl = document.getElementById('minWithdrawal');
  if (minEl) minEl.textContent = formatMoney(MIN_WITHDRAWAL);
}

// ── RENDER METHOD CARDS ───────────────────────────────────
function renderMethodCards() {
  const container = document.getElementById('methodCards');
  if (!container) return;

  container.innerHTML = METHODS.map(m => `
    <div class="method-card" data-method="${m.id}" onclick="selectMethod('${m.id}')">
      <div class="method-icon">
        <i data-lucide="${m.icon}" style="width:22px;height:22px"></i>
      </div>
      <div class="method-label">${m.label}</div>
      <div class="method-check">
        <i data-lucide="check" style="width:13px;height:13px"></i>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

// ── SELECT METHOD ─────────────────────────────────────────
window.selectMethod = function(methodId) {
  const method = METHODS.find(m => m.id === methodId);
  if (!method) return;

  // Update card selection
  document.querySelectorAll('.method-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.method === methodId);
  });

  // Update address input
  const addressInput   = document.getElementById('walletAddress');
  const addressLabel   = document.getElementById('addressLabel');
  const addressSection = document.getElementById('addressSection');

  if (addressInput)   addressInput.placeholder = method.placeholder;
  if (addressLabel)   addressLabel.textContent  = method.id === 'bank'
    ? 'Bank Account Details'
    : `${method.label} Address`;
  if (addressSection) addressSection.classList.remove('d-none');
  if (addressInput)   addressInput.focus();

  // Store selected method
  document.getElementById('selectedMethod').value = methodId;
};

// ── RENDER RECENT WITHDRAWALS ─────────────────────────────
async function renderRecentWithdrawals() {
  const container = document.getElementById('recentWithdrawals');
  const emptyEl   = document.getElementById('withdrawalsEmpty');
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!data?.length) {
      if (emptyEl) emptyEl.classList.remove('d-none');
      return;
    }

    if (emptyEl) emptyEl.classList.add('d-none');

    const statusMap = {
      pending:  { cls: 'badge-warning', label: 'Pending' },
      approved: { cls: 'badge-success', label: 'Approved' },
      rejected: { cls: 'badge-error',   label: 'Rejected' },
    };

    container.innerHTML = data.map(w => {
      const s = statusMap[w.status] || statusMap.pending;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-4) 0;border-bottom:1px solid var(--border-light);">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <div style="width:38px;height:38px;border-radius:var(--radius-md);background:var(--surface-2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i data-lucide="arrow-up-circle" style="width:18px;height:18px;color:var(--accent)"></i>
            </div>
            <div>
              <div style="font-size:var(--text-sm);font-weight:600;color:var(--text);">
                ${w.method?.replace('_', ' ').toUpperCase()}
              </div>
              <div style="font-size:var(--text-xs);color:var(--text-muted);">${timeAgo(w.created_at)}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:800;color:var(--accent);">
              -${formatMoney(w.amount)}
            </div>
            <span class="badge ${s.cls}" style="font-size:10px;">${s.label}</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();

  } catch (e) {
    console.warn('Withdrawals load error:', e?.message);
  }
}

// ── FORM ──────────────────────────────────────────────────
function initForm() {
  const form      = document.getElementById('withdrawForm');
  const submitBtn = document.getElementById('withdrawSubmitBtn');
  const amountEl  = document.getElementById('withdrawAmount');

  if (!form) return;

  // Live amount validation feedback
  amountEl?.addEventListener('input', () => {
    const val     = parseFloat(amountEl.value) || 0;
    const balance = currentWallet?.balance || 0;
    const feeEl   = document.getElementById('feeDisplay');
    const netEl   = document.getElementById('netDisplay');
    const warnEl  = document.getElementById('amountWarn');

    if (feeEl) feeEl.textContent = formatMoney(0);
    if (netEl) netEl.textContent = val > 0 ? formatMoney(val) : '$0.00';

    if (warnEl) {
      if (val > 0 && val < MIN_WITHDRAWAL) {
        warnEl.textContent = `Minimum withdrawal is ${formatMoney(MIN_WITHDRAWAL)}`;
        warnEl.classList.remove('d-none');
      } else if (val > balance) {
        warnEl.textContent = `Insufficient balance. Available: ${formatMoney(balance)}`;
        warnEl.classList.remove('d-none');
      } else {
        warnEl.classList.add('d-none');
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount        = parseFloat(document.getElementById('withdrawAmount')?.value) || 0;
    const methodId      = document.getElementById('selectedMethod')?.value;
    const walletAddress = document.getElementById('walletAddress')?.value.trim();
    const balance       = currentWallet?.balance || 0;
    const method        = METHODS.find(m => m.id === methodId);

    // Validate
    if (!methodId) {
      showToast('Select Method', 'Please select a withdrawal method.', 'warning');
      return;
    }
    if (!amount || amount < MIN_WITHDRAWAL) {
      showToast('Invalid Amount', `Minimum withdrawal is ${formatMoney(MIN_WITHDRAWAL)}.`, 'warning');
      return;
    }
    if (amount > balance) {
      showToast('Insufficient Balance', `Your available balance is ${formatMoney(balance)}.`, 'error');
      return;
    }
    if (!walletAddress) {
      showToast('Address Required', 'Please enter your withdrawal address or bank details.', 'warning');
      return;
    }

    // Loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner spinner-sm" style="border-top-color:white;margin-right:8px;"></span>
      <span>Submitting...</span>
    `;

    try {
      const { error } = await supabase
        .from('withdrawals')
        .insert({
          user_id:        currentUser.id,
          amount,
          method:         method?.label || methodId,
          wallet_address: walletAddress,
          status:         'pending',
        });

      if (error) throw error;

      // Show success
      document.getElementById('withdrawFormWrap')?.classList.add('d-none');
      document.getElementById('withdrawSuccess')?.classList.remove('d-none');

      // Update amount shown on success screen
      const successAmountEl = document.getElementById('successAmount');
      if (successAmountEl) successAmountEl.textContent = formatMoney(amount);

      const successMethodEl = document.getElementById('successMethod');
      if (successMethodEl) successMethodEl.textContent = method?.label || methodId;

    } catch (err) {
      console.error('Withdraw error:', err);
      showToast('Failed', err?.message || 'Something went wrong. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <i data-lucide="arrow-up-circle" style="width:18px;height:18px"></i>
        <span>Submit Withdrawal</span>
      `;
      if (window.lucide) lucide.createIcons();
    }
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
