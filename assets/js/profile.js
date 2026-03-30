// ============================================================
// TRADEX — PROFILE JS
// assets/js/profile.js
// ============================================================

import { supabase, requireAuth, getProfile, getWallet } from './supabase.js';
import { formatMoney, formatDate, copyToClipboard } from './utils.js';

// ── STATE ─────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let currentWallet  = null;

// ── INIT ──────────────────────────────────────────────────
export async function initProfile() {
  const session = await requireAuth();
  if (!session) return;
  currentUser = session.user;

  await Promise.all([ loadProfile(), loadWallet() ]);

  renderProfile();
  renderWallet();
  renderSidebar();

  initPersonalInfoForm();
  initPasswordForm();
  initAvatarUpload();
  initReferralCopy();
  initTabNav();
  initLogout();
}

// ── LOADERS ───────────────────────────────────────────────
async function loadProfile() {
  try {
    currentProfile = await getProfile(currentUser.id);
  } catch (e) { console.warn('Profile error:', e?.message); }
}

async function loadWallet() {
  try {
    currentWallet = await getWallet(currentUser.id);
  } catch (e) { console.warn('Wallet error:', e?.message); }
}

// ── RENDER SIDEBAR ────────────────────────────────────────
function renderSidebar() {
  if (!currentProfile) return;
  const name     = currentProfile.full_name || 'Investor';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sidebarUserName', name);
  set('sidebarUserRole', currentProfile.role === 'admin' ? 'Administrator' : 'Investor');
  set('sidebarAvatar',   initials);
  set('topbarUserName',  name.split(' ')[0]);
  set('topbarAvatar',    initials);
}

// ── RENDER PROFILE ────────────────────────────────────────
function renderProfile() {
  if (!currentProfile) return;

  const name     = currentProfile.full_name || 'Investor';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Avatar
  const avatarEl  = document.getElementById('profileAvatar');
  const avatarImg = document.getElementById('profileAvatarImg');
  if (currentProfile.avatar_url && avatarImg) {
    avatarImg.src = currentProfile.avatar_url;
    avatarImg.classList.remove('d-none');
    if (avatarEl) avatarEl.textContent = '';
  } else if (avatarEl) {
    avatarEl.textContent = initials;
  }

  // Hero info
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('heroName',     name);
  set('heroEmail',    currentProfile.email || '—');
  set('heroMember',   `Member since ${formatDate(currentProfile.created_at)}`);
  set('heroReferral', currentProfile.referral_code || '—');

  // KYC badge
  const kycEl = document.getElementById('heroKycBadge');
  if (kycEl) {
    const kycMap = {
      pending:  { cls: 'badge-warning', text: '⏳ KYC Pending'  },
      verified: { cls: 'badge-success', text: '✅ KYC Verified' },
      rejected: { cls: 'badge-error',   text: '❌ KYC Rejected' },
    };
    const k = kycMap[currentProfile.kyc_status] || kycMap.pending;
    kycEl.className   = `badge ${k.cls}`;
    kycEl.textContent = k.text;
  }

  // Personal info form fields
  const fields = {
    fieldFullName: currentProfile.full_name || '',
    fieldEmail:    currentProfile.email     || '',
    fieldPhone:    currentProfile.phone     || '',
    fieldCountry:  currentProfile.country   || '',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  // Settings toggles
  const twoFaEl = document.getElementById('twoFaToggle');
  if (twoFaEl) twoFaEl.checked = currentProfile.two_fa_enabled || false;

  // Account info tab
  set('infoEmail',     currentProfile.email           || '—');
  set('infoRole',      currentProfile.role            || 'user');
  set('infoKyc',       currentProfile.kyc_status      || 'pending');
  set('infoJoined',    formatDate(currentProfile.created_at));
  set('infoUpdated',   formatDate(currentProfile.updated_at));
  set('infoReferral',  currentProfile.referral_code   || '—');
  set('infoActive',    currentProfile.is_active ? 'Active' : 'Suspended');
}

// ── RENDER WALLET STATS ───────────────────────────────────
function renderWallet() {
  if (!currentWallet) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('walletBalance',    formatMoney(currentWallet.balance));
  set('walletDeposited',  formatMoney(currentWallet.total_deposited));
  set('walletInvested',   formatMoney(currentWallet.total_invested));
  set('walletProfit',     formatMoney(currentWallet.total_profit));
  set('walletWithdrawn',  formatMoney(currentWallet.total_withdrawn));
  set('walletBonus',      formatMoney(currentWallet.bonus));
}

// ── TAB NAVIGATION ────────────────────────────────────────
function initTabNav() {
  document.querySelectorAll('[data-tab-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tabBtn;

      // Update buttons
      document.querySelectorAll('[data-tab-btn]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update panels
      document.querySelectorAll('[data-tab-panel]').forEach(p => {
        p.classList.toggle('d-none', p.dataset.tabPanel !== target);
      });
    });
  });
}

// ── PERSONAL INFO FORM ────────────────────────────────────
function initPersonalInfoForm() {
  const form = document.getElementById('personalInfoForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fieldFullName')?.value.trim();
    const phone    = document.getElementById('fieldPhone')?.value.trim();
    const country  = document.getElementById('fieldCountry')?.value.trim();
    const btn      = document.getElementById('savePersonalBtn');

    if (!fullName) {
      showToast('Name Required', 'Please enter your full name.', 'warning');
      return;
    }

    setLoading(btn, true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone, country })
        .eq('id', currentUser.id);

      if (error) throw error;

      // Update local state
      currentProfile.full_name = fullName;
      currentProfile.phone     = phone;
      currentProfile.country   = country;

      renderSidebar();
      showToast('Profile Updated', 'Your personal information has been saved.', 'success');

    } catch (err) {
      showToast('Update Failed', err?.message || 'Could not update profile.', 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ── PASSWORD FORM ─────────────────────────────────────────
function initPasswordForm() {
  const form = document.getElementById('passwordForm');
  if (!form) return;

  // Toggle password visibility
  document.querySelectorAll('[data-toggle-password]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePassword);
      if (!input) return;
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.innerHTML = isText
        ? '<i data-lucide="eye-off" style="width:15px;height:15px"></i>'
        : '<i data-lucide="eye"     style="width:15px;height:15px"></i>';
      if (window.lucide) lucide.createIcons();
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const current  = document.getElementById('currentPassword')?.value;
    const newPass  = document.getElementById('newPassword')?.value;
    const confirm  = document.getElementById('confirmPassword')?.value;
    const btn      = document.getElementById('savePasswordBtn');

    if (!current) { showToast('Required', 'Enter your current password.', 'warning'); return; }
    if (!newPass || newPass.length < 8) { showToast('Too Short', 'New password must be at least 8 characters.', 'warning'); return; }
    if (newPass !== confirm) { showToast('Mismatch', 'New passwords do not match.', 'warning'); return; }

    setLoading(btn, true);

    try {
      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email:    currentProfile.email,
        password: current,
      });

      if (signInError) throw new Error('Current password is incorrect.');

      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;

      form.reset();
      showToast('Password Updated', 'Your password has been changed successfully.', 'success');

    } catch (err) {
      showToast('Failed', err?.message || 'Could not update password.', 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ── AVATAR UPLOAD ─────────────────────────────────────────
function initAvatarUpload() {
  const input    = document.getElementById('avatarInput');
  const changeBtn = document.getElementById('changeAvatarBtn');

  changeBtn?.addEventListener('click', () => input?.click());

  input?.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Invalid File', 'Please select an image file.', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Too Large', 'Avatar must be under 2MB.', 'error');
      return;
    }

    const uploadingEl = document.getElementById('avatarUploading');
    if (uploadingEl) uploadingEl.classList.remove('d-none');

    try {
      const ext      = file.name.split('.').pop();
      const path     = `${currentUser.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = urlData?.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      currentProfile.avatar_url = url;

      // Update avatar display
      const avatarEl  = document.getElementById('profileAvatar');
      const avatarImg = document.getElementById('profileAvatarImg');
      if (avatarImg) { avatarImg.src = url; avatarImg.classList.remove('d-none'); }
      if (avatarEl)  avatarEl.textContent = '';

      showToast('Avatar Updated', 'Your profile photo has been updated.', 'success');

    } catch (err) {
      showToast('Upload Failed', err?.message || 'Could not upload avatar.', 'error');
    } finally {
      if (uploadingEl) uploadingEl.classList.add('d-none');
      input.value = '';
    }
  });
}

// ── REFERRAL COPY ─────────────────────────────────────────
function initReferralCopy() {
  document.getElementById('copyReferralBtn')?.addEventListener('click', async () => {
    const code = currentProfile?.referral_code || '';
    const link = `${window.location.origin}/register.html?ref=${code}`;
    const ok   = await copyToClipboard(link);
    showToast(ok ? 'Copied!' : 'Failed', ok ? 'Referral link copied to clipboard.' : 'Could not copy.', ok ? 'success' : 'error');
  });
}

// ── HELPERS ───────────────────────────────────────────────
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = `<span class="spinner spinner-sm" style="border-top-color:white;margin-right:6px;"></span> Saving...`;
  } else {
    btn.disabled = false;
    if (btn.dataset.original) btn.innerHTML = btn.dataset.original;
    if (window.lucide) lucide.createIcons();
  }
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
