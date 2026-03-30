// ============================================================
// TRADEX — ADMIN JS
// assets/js/admin.js
// ============================================================

import { supabase, requireAdmin } from './supabase.js';
import { formatMoney, formatDateTime, timeAgo } from './utils.js';

// ── SHARED ADMIN INIT ─────────────────────────────────────
export async function initAdminShell() {
  const result = await requireAdmin();
  if (!result) return null;

  const { session, profile } = result;
  const name     = profile.full_name || 'Admin';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sidebarUserName', name);
  set('sidebarUserRole', 'Administrator');
  set('sidebarAvatar',   initials);
  set('topbarUserName',  name.split(' ')[0]);
  set('topbarAvatar',    initials);

  // Logout
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await supabase.auth.signOut(); } catch {}
      window.location.href = '../login.html';
    });
  });

  return result;
}

// ── ADMIN DASHBOARD ───────────────────────────────────────
export async function initAdminDashboard() {
  const result = await initAdminShell();
  if (!result) return;

  await Promise.all([
    loadDashboardStats(),
    loadPendingDeposits(),
    loadPendingWithdrawals(),
    loadRecentUsers(),
  ]);
}

async function loadDashboardStats() {
  try {
    // Parallel queries
    const [usersRes, depositsRes, withdrawalsRes, investmentsRes, walletsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('deposits').select('id, amount, status'),
      supabase.from('withdrawals').select('id, amount, status'),
      supabase.from('investments').select('id, amount, status'),
      supabase.from('wallets').select('balance, total_deposited, total_profit, total_withdrawn'),
    ]);

    const totalUsers     = usersRes.count || 0;
    const deposits       = depositsRes.data  || [];
    const withdrawals    = withdrawalsRes.data || [];
    const investments    = investmentsRes.data || [];
    const wallets        = walletsRes.data || [];

    const pendingDeposits    = deposits.filter(d => d.status === 'pending').length;
    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;
    const activeInvestments  = investments.filter(i => i.status === 'active' || i.status === 'matured').length;
    const totalDeposited     = wallets.reduce((s, w) => s + Number(w.total_deposited), 0);
    const totalProfit        = wallets.reduce((s, w) => s + Number(w.total_profit), 0);
    const totalWithdrawn     = wallets.reduce((s, w) => s + Number(w.total_withdrawn), 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('statTotalUsers',        totalUsers.toLocaleString());
    set('statPendingDeposits',   pendingDeposits);
    set('statPendingWithdrawals',pendingWithdrawals);
    set('statActiveInvestments', activeInvestments);
    set('statTotalDeposited',    formatMoney(totalDeposited));
    set('statTotalProfit',       formatMoney(totalProfit));
    set('statTotalWithdrawn',    formatMoney(totalWithdrawn));

    // Alert badges
    const depositAlertEl = document.getElementById('depositAlert');
    if (depositAlertEl) {
      depositAlertEl.textContent = pendingDeposits;
      depositAlertEl.style.display = pendingDeposits > 0 ? 'flex' : 'none';
    }
    const withdrawalAlertEl = document.getElementById('withdrawalAlert');
    if (withdrawalAlertEl) {
      withdrawalAlertEl.textContent = pendingWithdrawals;
      withdrawalAlertEl.style.display = pendingWithdrawals > 0 ? 'flex' : 'none';
    }

  } catch (e) { console.warn('Stats error:', e?.message); }
}

async function loadPendingDeposits() {
  const container = document.getElementById('pendingDepositsList');
  const emptyEl   = document.getElementById('pendingDepositsEmpty');
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from('deposits')
      .select('*, profiles!deposits_user_id_fkey(full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;

    if (!data?.length) {
      if (emptyEl) emptyEl.classList.remove('d-none');
      container.innerHTML = '';
      return;
    }
    if (emptyEl) emptyEl.classList.add('d-none');

    container.innerHTML = data.map(d => `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">${d.profiles?.full_name || 'Unknown'}</div>
          <div class="admin-row-sub">${d.profiles?.email || ''} · ${timeAgo(d.created_at)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3);flex-shrink:0;">
          <span style="font-family:var(--font-display);font-weight:800;color:var(--text);font-size:var(--text-sm);">${formatMoney(d.amount)}</span>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-success btn-xs" onclick="approveDeposit('${d.id}',this)">Approve</button>
            <button class="btn btn-danger btn-xs"  onclick="rejectDeposit('${d.id}',this)">Reject</button>
          </div>
        </div>
      </div>
    `).join('');

  } catch (e) { console.warn('Pending deposits error:', e?.message); }
}

async function loadPendingWithdrawals() {
  const container = document.getElementById('pendingWithdrawalsList');
  const emptyEl   = document.getElementById('pendingWithdrawalsEmpty');
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*, profiles!withdrawals_user_id_fkey(full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;

    if (!data?.length) {
      if (emptyEl) emptyEl.classList.remove('d-none');
      container.innerHTML = '';
      return;
    }
    if (emptyEl) emptyEl.classList.add('d-none');

    container.innerHTML = data.map(w => `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">${w.profiles?.full_name || 'Unknown'}</div>
          <div class="admin-row-sub">${w.method} · ${timeAgo(w.created_at)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3);flex-shrink:0;">
          <span style="font-family:var(--font-display);font-weight:800;color:var(--accent);font-size:var(--text-sm);">${formatMoney(w.amount)}</span>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-success btn-xs" onclick="approveWithdrawal('${w.id}',this)">Approve</button>
            <button class="btn btn-danger btn-xs"  onclick="rejectWithdrawal('${w.id}',this)">Reject</button>
          </div>
        </div>
      </div>
    `).join('');

  } catch (e) { console.warn('Pending withdrawals error:', e?.message); }
}

async function loadRecentUsers() {
  const container = document.getElementById('recentUsersList');
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, kyc_status, created_at, is_active')
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) throw error;

    container.innerHTML = (data || []).map(u => `
      <div class="admin-row">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div class="avatar avatar-sm" style="background:var(--gradient-navy);color:white;font-size:12px;">
            ${(u.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
          </div>
          <div class="admin-row-info">
            <div class="admin-row-name">${u.full_name || 'Unknown'}</div>
            <div class="admin-row-sub">${u.email} · ${timeAgo(u.created_at)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <span class="badge ${u.kyc_status === 'verified' ? 'badge-success' : u.kyc_status === 'rejected' ? 'badge-error' : 'badge-warning'}" style="font-size:10px;">
            ${u.kyc_status}
          </span>
          <span class="badge ${u.is_active ? 'badge-success' : 'badge-error'}" style="font-size:10px;">
            ${u.is_active ? 'Active' : 'Suspended'}
          </span>
        </div>
      </div>
    `).join('');

  } catch (e) { console.warn('Recent users error:', e?.message); }
}

// ── VIEW DEPOSIT IMAGE ────────────────────────────────────
window.viewDepositImage = async function(imageRef) {
  try {
    let filePath = imageRef;

    // If it's a full Supabase storage URL, extract just the file path
    // Old format: https://xxx.supabase.co/storage/v1/object/public/gift-card-images/userId/timestamp.jpg
    if (imageRef.startsWith('http')) {
      const marker = '/gift-card-images/';
      const idx = imageRef.indexOf(marker);
      if (idx !== -1) {
        filePath = imageRef.substring(idx + marker.length);
      } else {
        // Unknown URL format — try opening directly in new tab
        window.open(imageRef, '_blank');
        return;
      }
    }

    // Generate signed URL (works for both old and new deposits)
    const { data, error } = await supabase.storage
      .from('gift-card-images')
      .createSignedUrl(filePath, 3600);

    if (error) throw error;

    const imageUrl = data.signedUrl;

    // Remove any existing modal
    document.getElementById('adminImageModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'adminImageModal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.94);
      z-index:9999;display:flex;align-items:center;justify-content:center;
      flex-direction:column;gap:16px;padding:20px;
    `;
    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;max-width:600px;">
        <span style="color:white;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;">
          🎁 Gift Card Image
        </span>
        <button onclick="document.getElementById('adminImageModal').remove()"
          style="background:rgba(255,255,255,0.15);border:none;color:white;width:40px;height:40px;
                 border-radius:50%;cursor:pointer;font-size:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ✕
        </button>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;">
        <img src="${imageUrl}"
          style="max-width:100%;max-height:65vh;border-radius:12px;object-fit:contain;
                 box-shadow:0 8px 40px rgba(0,0,0,0.6);display:block;"
        />
      </div>
      <a href="${imageUrl}" download="gift-card.jpg" target="_blank"
        style="background:#B22234;color:white;padding:13px 32px;border-radius:10px;
               text-decoration:none;font-size:15px;font-weight:700;
               display:flex;align-items:center;gap:10px;flex-shrink:0;">
        ⬇ Download Image
      </a>
      <span style="color:rgba(255,255,255,0.35);font-size:11px;">Tap outside or ✕ to close</span>
    `;

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

  } catch (e) {
    showAdminToast('Error', 'Could not load image: ' + (e?.message || 'Unknown error'), 'error');
  }
};
window.approveDeposit = async function(id, btn) {
  await reviewDeposit(id, 'approved', btn);
};

window.rejectDeposit = async function(id, btn) {
  const note = prompt('Reason for rejection (optional):') || 'Invalid gift card.';
  await reviewDeposit(id, 'rejected', btn, note);
};

async function reviewDeposit(id, status, btn, note = null) {
  const row = btn?.closest('.admin-row');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('deposits')
      .update({ status, admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    if (row) row.style.opacity = '0.4';
    showAdminToast(`Deposit ${status}`, `Deposit has been ${status}.`, status === 'approved' ? 'success' : 'error');
    setTimeout(() => { if (row) row.remove(); }, 800);

  } catch (e) {
    showAdminToast('Error', e?.message || 'Action failed.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = status === 'approved' ? 'Approve' : 'Reject'; }
  }
}

window.approveWithdrawal = async function(id, btn) {
  await reviewWithdrawal(id, 'approved', btn);
};

window.rejectWithdrawal = async function(id, btn) {
  const note = prompt('Reason for rejection (optional):') || 'Request rejected by admin.';
  await reviewWithdrawal(id, 'rejected', btn, note);
};

async function reviewWithdrawal(id, status, btn, note = null) {
  const row = btn?.closest('.admin-row');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('withdrawals')
      .update({ status, admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    if (row) row.style.opacity = '0.4';
    showAdminToast(`Withdrawal ${status}`, `Withdrawal has been ${status}.`, status === 'approved' ? 'success' : 'error');
    setTimeout(() => { if (row) row.remove(); }, 800);

  } catch (e) {
    showAdminToast('Error', e?.message || 'Action failed.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = status === 'approved' ? 'Approve' : 'Reject'; }
  }
}

// ── USERS PAGE ────────────────────────────────────────────
export async function initAdminUsers() {
  const result = await initAdminShell();
  if (!result) return;
  await loadUsersTable();
  initUserSearch();
}

async function loadUsersTable(search = '') {
  const tbody  = document.getElementById('usersTableBody');
  const countEl = document.getElementById('usersCount');
  if (!tbody) return;

  try {
    let query = supabase
      .from('profiles')
      .select('*, wallets(balance, total_deposited, total_profit)')
      .order('created_at', { ascending: false });

    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    if (countEl) countEl.textContent = data?.length || 0;

    tbody.innerHTML = (data || []).map(u => {
      const wallet = u.wallets;
      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="avatar avatar-xs" style="background:var(--gradient-navy);color:white;font-size:10px;">
                ${(u.full_name || 'U').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div>
                <div style="font-weight:600;font-size:var(--text-sm);color:var(--text);">${u.full_name || '—'}</div>
                <div style="font-size:var(--text-xs);color:var(--text-muted);">${u.email}</div>
              </div>
            </div>
          </td>
          <td style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:700;">${formatMoney(wallet?.balance || 0)}</td>
          <td style="font-size:var(--text-sm);">${formatMoney(wallet?.total_deposited || 0)}</td>
          <td style="font-size:var(--text-sm);color:var(--success);">${formatMoney(wallet?.total_profit || 0)}</td>
          <td>
            <span class="badge ${u.kyc_status === 'verified' ? 'badge-success' : u.kyc_status === 'rejected' ? 'badge-error' : 'badge-warning'}" style="font-size:10px;">${u.kyc_status}</span>
          </td>
          <td>
            <span class="badge ${u.is_active ? 'badge-success' : 'badge-error'}" style="font-size:10px;">${u.is_active ? 'Active' : 'Suspended'}</span>
          </td>
          <td style="font-size:var(--text-xs);color:var(--text-muted);">${timeAgo(u.created_at)}</td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-outline btn-xs" onclick="viewUserWallet('${u.id}','${u.full_name}')">Wallet</button>
              <button class="btn btn-xs ${u.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleUserActive('${u.id}',${u.is_active},this)">
                ${u.is_active ? 'Suspend' : 'Activate'}
              </button>
              <button class="btn btn-xs ${u.kyc_status === 'verified' ? 'btn-outline' : 'btn-primary'}" onclick="verifyKyc('${u.id}',this)">
                ${u.kyc_status === 'verified' ? 'KYC ✓' : 'Verify KYC'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (e) { console.warn('Users load error:', e?.message); }
}

function initUserSearch() {
  let timer;
  document.getElementById('userSearch')?.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => loadUsersTable(e.target.value.trim()), 400);
  });
}

window.toggleUserActive = async function(userId, isActive, btn) {
  btn.disabled = true;
  try {
    const { error } = await supabase.from('profiles').update({ is_active: !isActive }).eq('id', userId);
    if (error) throw error;
    showAdminToast('Updated', `User ${isActive ? 'suspended' : 'activated'}.`, 'success');
    await loadUsersTable();
  } catch (e) {
    showAdminToast('Error', e?.message, 'error');
    btn.disabled = false;
  }
};

window.verifyKyc = async function(userId, btn) {
  btn.disabled = true;
  try {
    const { error } = await supabase.from('profiles').update({ kyc_status: 'verified' }).eq('id', userId);
    if (error) throw error;
    showAdminToast('KYC Verified', 'User KYC has been verified.', 'success');
    await loadUsersTable();
  } catch (e) {
    showAdminToast('Error', e?.message, 'error');
    btn.disabled = false;
  }
};

window.viewUserWallet = async function(userId, name) {
  try {
    const { data } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
    if (!data) return;
    alert(`Wallet — ${name}\n\nBalance: ${formatMoney(data.balance)}\nBonus: ${formatMoney(data.bonus)}\nDeposited: ${formatMoney(data.total_deposited)}\nInvested: ${formatMoney(data.total_invested)}\nProfit: ${formatMoney(data.total_profit)}\nWithdrawn: ${formatMoney(data.total_withdrawn)}`);
  } catch (e) { showAdminToast('Error', e?.message, 'error'); }
};

// ── DEPOSITS PAGE ─────────────────────────────────────────
export async function initAdminDeposits() {
  const result = await initAdminShell();
  if (!result) return;
  await loadDepositsTable('pending');
  initDepositTabs();
}

async function loadDepositsTable(status = 'pending') {
  const tbody = document.getElementById('depositsTableBody');
  if (!tbody) return;

  try {
    let query = supabase
      .from('deposits')
      .select('*, profiles!deposits_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query.limit(50);
    if (error) throw error;

    const countEl = document.getElementById('depositsCount');
    if (countEl) countEl.textContent = data?.length || 0;

    tbody.innerHTML = (data || []).map(d => `
      <tr>
        <td>
          <div style="font-weight:600;font-size:var(--text-sm);color:var(--text);">${d.profiles?.full_name || '—'}</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.profiles?.email || ''}</div>
        </td>
        <td style="font-family:var(--font-display);font-weight:800;font-size:var(--text-sm);white-space:nowrap;">${formatMoney(d.amount)}</td>
        <td>
          <div style="font-family:monospace;font-size:var(--text-xs);color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.card_number || ''}">${d.card_number || '—'}</div>
        </td>
        <td>
          ${d.card_image_url
            ? `<button class="btn btn-outline btn-xs" onclick="viewDepositImage('${d.card_image_url}')">
                <i data-lucide="image" style="width:12px;height:12px"></i> View
               </button>`
            : '<span style="color:var(--text-faint);font-size:var(--text-xs);">No image</span>'
          }
        </td>
        <td>
          <span class="badge ${d.status === 'approved' ? 'badge-success' : d.status === 'rejected' ? 'badge-error' : 'badge-warning'}" style="font-size:10px;white-space:nowrap;">
            ${d.status}
          </span>
        </td>
        <td style="font-size:var(--text-xs);color:var(--text-muted);white-space:nowrap;">${formatDateTime(d.created_at)}</td>
        <td>
          ${d.status === 'pending' ? `
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-success btn-xs" onclick="approveDeposit('${d.id}',this)">Approve</button>
              <button class="btn btn-danger btn-xs"  onclick="rejectDeposit('${d.id}',this)">Reject</button>
            </div>
          ` : `<span style="font-size:var(--text-xs);color:var(--text-muted);">${d.admin_note || '—'}</span>`}
        </td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();

  } catch (e) { console.warn('Deposits load error:', e?.message); }
}

function initDepositTabs() {
  document.querySelectorAll('[data-deposit-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-deposit-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadDepositsTable(btn.dataset.depositTab);
    });
  });
}

// ── WITHDRAWALS PAGE ──────────────────────────────────────
export async function initAdminWithdrawals() {
  const result = await initAdminShell();
  if (!result) return;
  await loadWithdrawalsTable('pending');
  initWithdrawalTabs();
}

async function loadWithdrawalsTable(status = 'pending') {
  const tbody = document.getElementById('withdrawalsTableBody');
  if (!tbody) return;

  try {
    let query = supabase
      .from('withdrawals')
      .select('*, profiles!withdrawals_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query.limit(50);
    if (error) throw error;

    const countEl = document.getElementById('withdrawalsCount');
    if (countEl) countEl.textContent = data?.length || 0;

    tbody.innerHTML = (data || []).map(w => `
      <tr>
        <td>
          <div style="font-weight:600;font-size:var(--text-sm);">${w.profiles?.full_name || '—'}</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);">${w.profiles?.email || ''}</div>
        </td>
        <td style="font-family:var(--font-display);font-weight:800;font-size:var(--text-sm);color:var(--accent);">${formatMoney(w.amount)}</td>
        <td style="font-size:var(--text-sm);">${w.method || '—'}</td>
        <td style="font-size:var(--text-xs);font-family:monospace;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${w.wallet_address || '—'}</td>
        <td>
          <span class="badge ${w.status === 'approved' ? 'badge-success' : w.status === 'rejected' ? 'badge-error' : 'badge-warning'}" style="font-size:10px;">${w.status}</span>
        </td>
        <td style="font-size:var(--text-xs);color:var(--text-muted);">${formatDateTime(w.created_at)}</td>
        <td>
          ${w.status === 'pending' ? `
            <div style="display:flex;gap:6px;">
              <button class="btn btn-success btn-xs" onclick="approveWithdrawal('${w.id}',this)">Approve</button>
              <button class="btn btn-danger btn-xs"  onclick="rejectWithdrawal('${w.id}',this)">Reject</button>
            </div>
          ` : `<span style="font-size:var(--text-xs);color:var(--text-muted);">${w.admin_note || '—'}</span>`}
        </td>
      </tr>
    `).join('');

  } catch (e) { console.warn('Withdrawals load error:', e?.message); }
}

function initWithdrawalTabs() {
  document.querySelectorAll('[data-withdrawal-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-withdrawal-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadWithdrawalsTable(btn.dataset.withdrawalTab);
    });
  });
}

// ── SETTINGS PAGE ─────────────────────────────────────────
export async function initAdminSettings() {
  const result = await initAdminShell();
  if (!result) return;
  await loadSettings();
  initSettingsForm();
}

async function loadSettings() {
  try {
    const { data, error } = await supabase.from('platform_settings').select('*');
    if (error) throw error;

    (data || []).forEach(s => {
      const el = document.getElementById(`setting_${s.key}`);
      if (el) el.value = s.value;
    });
  } catch (e) { console.warn('Settings load error:', e?.message); }
}

function initSettingsForm() {
  document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveSettingsBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      const keys = ['site_name', 'deposit_email', 'min_withdrawal', 'maintenance_mode', 'referral_bonus_usd', 'support_email'];
      for (const key of keys) {
        const el = document.getElementById(`setting_${key}`);
        if (!el) continue;
        await supabase.from('platform_settings').update({ value: el.value }).eq('key', key);
      }
      showAdminToast('Settings Saved', 'Platform settings updated successfully.', 'success');
    } catch (e) {
      showAdminToast('Error', e?.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Settings'; }
    }
  });
}

// ── TOAST ─────────────────────────────────────────────────
export function showAdminToast(title, message, type = 'info') {
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
