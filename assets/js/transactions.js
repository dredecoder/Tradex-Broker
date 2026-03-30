// ============================================================
// TRADEX — TRANSACTIONS JS
// assets/js/transactions.js
// ============================================================

import { supabase, requireAuth, getProfile, getWallet } from './supabase.js';
import { formatMoney, formatDateTime, timeAgo } from './utils.js';

// ── STATE ─────────────────────────────────────────────────
let currentUser    = null;
let allTx          = [];
let filteredTx     = [];
let currentPage    = 1;
const PAGE_SIZE    = 15;
let activeFilter   = 'all';
let activeType     = 'all';
let searchQuery    = '';

// ── TX CONFIG ─────────────────────────────────────────────
const TX_CONFIG = {
  deposit:    { icon: 'arrow-down-circle', label: 'Deposit',    color: 'var(--success)', credit: true  },
  withdrawal: { icon: 'arrow-up-circle',   label: 'Withdrawal', color: 'var(--accent)',  credit: false },
  profit:     { icon: 'trending-up',       label: 'Profit',     color: 'var(--success)', credit: true  },
  bonus:      { icon: 'gift',              label: 'Bonus',      color: 'var(--warning)', credit: true  },
  referral:   { icon: 'users',             label: 'Referral',   color: 'var(--info)',    credit: true  },
};

const STATUS_CONFIG = {
  pending:  { cls: 'badge-warning', label: 'Pending'  },
  approved: { cls: 'badge-success', label: 'Approved' },
  rejected: { cls: 'badge-error',   label: 'Rejected' },
};

// ── INIT ──────────────────────────────────────────────────
export async function initTransactions() {
  const session = await requireAuth();
  if (!session) return;
  currentUser = session.user;

  await Promise.all([ loadUserData(), loadTransactions() ]);

  applyFilters();
  initFilters();
  initSearch();
  initExport();
  initLogout();
}

// ── LOAD USER DATA ────────────────────────────────────────
async function loadUserData() {
  try {
    const wallet = await getWallet(currentUser.id);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('statTotalDeposited',  formatMoney(wallet?.total_deposited  || 0));
    set('statTotalWithdrawn',  formatMoney(wallet?.total_withdrawn  || 0));
    set('statTotalProfit',     formatMoney(wallet?.total_profit     || 0));
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

// ── LOAD ALL TRANSACTIONS ─────────────────────────────────
async function loadTransactions() {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    allTx = data || [];

    // Update summary counts
    const totalEl = document.getElementById('totalTxCount');
    if (totalEl) totalEl.textContent = allTx.length;

  } catch (e) {
    console.warn('Transactions load error:', e?.message);
    allTx = [];
  }
}

// ── FILTERS ───────────────────────────────────────────────
function initFilters() {
  // Status tabs
  document.querySelectorAll('[data-status-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-status-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.statusFilter;
      currentPage  = 1;
      applyFilters();
    });
  });

  // Type filter
  const typeSelect = document.getElementById('typeFilter');
  typeSelect?.addEventListener('change', () => {
    activeType  = typeSelect.value;
    currentPage = 1;
    applyFilters();
  });
}

function initSearch() {
  const searchEl = document.getElementById('txSearch');
  let debounceTimer;
  searchEl?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = searchEl.value.trim().toLowerCase();
      currentPage = 1;
      applyFilters();
    }, 300);
  });
}

// ── APPLY ALL FILTERS + RENDER ────────────────────────────
function applyFilters() {
  filteredTx = allTx.filter(tx => {
    // Status filter
    if (activeFilter !== 'all' && tx.status !== activeFilter) return false;
    // Type filter
    if (activeType !== 'all' && tx.type !== activeType) return false;
    // Search
    if (searchQuery) {
      const ref  = (tx.reference || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const type = (tx.type || '').toLowerCase();
      if (!ref.includes(searchQuery) && !desc.includes(searchQuery) && !type.includes(searchQuery)) return false;
    }
    return true;
  });

  renderTable();
  renderPagination();
  updateFilterCounts();
}

// ── UPDATE FILTER COUNTS ──────────────────────────────────
function updateFilterCounts() {
  const counts = { all: allTx.length };
  ['pending', 'approved', 'rejected'].forEach(s => {
    counts[s] = allTx.filter(tx => tx.status === s).length;
  });

  document.querySelectorAll('[data-status-filter]').forEach(btn => {
    const countEl = btn.querySelector('.filter-count');
    if (countEl && counts[btn.dataset.statusFilter] !== undefined) {
      countEl.textContent = counts[btn.dataset.statusFilter];
    }
  });

  const resultEl = document.getElementById('resultCount');
  if (resultEl) resultEl.textContent = `${filteredTx.length} transaction${filteredTx.length !== 1 ? 's' : ''}`;
}

// ── RENDER TABLE ──────────────────────────────────────────
function renderTable() {
  const tbody  = document.getElementById('txTableBody');
  const emptyEl = document.getElementById('txEmpty');

  if (!tbody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filteredTx.slice(start, start + PAGE_SIZE);

  if (!filteredTx.length) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('d-none');
    return;
  }

  if (emptyEl) emptyEl.classList.add('d-none');

  tbody.innerHTML = page.map(tx => {
    const cfg    = TX_CONFIG[tx.type]     || TX_CONFIG.deposit;
    const scfg   = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
    const isCredit = cfg.credit;

    return `
      <tr class="tx-row animate-fade-in">
        <td>
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="tx-type-icon" style="background:${cfg.color}18;color:${cfg.color};">
              <i data-lucide="${cfg.icon}" style="width:16px;height:16px;"></i>
            </div>
            <div>
              <div style="font-size:var(--text-sm);font-weight:700;color:var(--text);">${cfg.label}</div>
              <div style="font-size:var(--text-xs);color:var(--text-muted);font-family:monospace;letter-spacing:0.04em;">
                #${tx.reference || tx.id.slice(0, 10).toUpperCase()}
              </div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:800;font-variant-numeric:tabular-nums;color:${isCredit ? 'var(--success)' : 'var(--accent)'};">
            ${isCredit ? '+' : '-'}${formatMoney(tx.amount)}
          </div>
        </td>
        <td>
          <span class="badge ${scfg.cls}" style="font-size:10px;">
            <span class="status-dot ${tx.status}" style="margin:0;padding:0;width:6px;height:6px;border-radius:50%;display:inline-block;"></span>
            ${scfg.label}
          </span>
        </td>
        <td>
          <div style="font-size:var(--text-xs);color:var(--text-secondary);">${formatDateTime(tx.created_at)}</div>
          <div style="font-size:11px;color:var(--text-faint);">${timeAgo(tx.created_at)}</div>
        </td>
        <td style="max-width:200px;">
          <div style="font-size:var(--text-xs);color:var(--text-muted);truncate;">${tx.description || '—'}</div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ── PAGINATION ────────────────────────────────────────────
function renderPagination() {
  const container = document.getElementById('pagination');
  if (!container) return;

  const totalPages = Math.ceil(filteredTx.length / PAGE_SIZE);

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  container.innerHTML = `
    <button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
      <i data-lucide="chevron-left" style="width:14px;height:14px"></i>
    </button>
    ${pages.map(p =>
      p === '...'
        ? `<span style="padding:0 8px;color:var(--text-muted);">…</span>`
        : `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="changePage(${p})">${p}</button>`
    ).join('')}
    <button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
      <i data-lucide="chevron-right" style="width:14px;height:14px"></i>
    </button>
  `;

  if (window.lucide) lucide.createIcons();
}

window.changePage = function(page) {
  const totalPages = Math.ceil(filteredTx.length / PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
  renderPagination();
  document.getElementById('txTableWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ── EXPORT CSV ────────────────────────────────────────────
function initExport() {
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    if (!filteredTx.length) {
      showToast('Nothing to export', 'No transactions match your current filter.', 'warning');
      return;
    }

    const headers = ['Reference', 'Type', 'Amount', 'Status', 'Description', 'Date'];
    const rows    = filteredTx.map(tx => [
      `#${tx.reference || tx.id.slice(0,10).toUpperCase()}`,
      TX_CONFIG[tx.type]?.label || tx.type,
      formatMoney(tx.amount),
      tx.status,
      tx.description || '',
      formatDateTime(tx.created_at),
    ]);

    const csv     = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob    = new Blob([csv], { type: 'text/csv' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `tradex-transactions-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Exported', `${filteredTx.length} transactions exported as CSV.`, 'success');
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
