// ============================================================
// TRADEX — DEPOSIT JS
// assets/js/deposit.js
// ============================================================

import { supabase, requireAuth, getProfile, getWallet } from './supabase.js';
import { formatMoney } from './utils.js';

// ── STATE ─────────────────────────────────────────────────
let currentUser   = null;
let currentWallet = null;
let selectedPlan  = null;
let uploadedImageUrl = null;

const PLANS = [
  { tier: 'bronze',   name: 'Bronze',   amount: 150,   payout: 2000  },
  { tier: 'silver',   name: 'Silver',   amount: 200,   payout: 4000  },
  { tier: 'gold',     name: 'Gold',     amount: 300,   payout: 6000  },
  { tier: 'platinum', name: 'Platinum', amount: 400,   payout: 8000  },
  { tier: 'diamond',  name: 'Diamond',  amount: 500,   payout: 10000 },
  { tier: 'heroic',   name: 'Heroic',   amount: 1000,  payout: 20000 },
];

const TIER_COLORS = {
  bronze:   '#cd7f32',
  silver:   '#aaa9ad',
  gold:     '#ffd700',
  platinum: '#e5e4e2',
  diamond:  '#b9f2ff',
  heroic:   '#c084fc',
};

const TIER_EMOJI = {
  bronze: '🥉', silver: '🥈', gold: '🥇',
  platinum: '💎', diamond: '💠', heroic: '🏆',
};

// ── INIT ──────────────────────────────────────────────────
export async function initDeposit() {
  const session = await requireAuth();
  if (!session) return;
  currentUser = session.user;

  try {
    currentWallet = await getWallet(currentUser.id);
  } catch (e) {
    console.warn('Wallet load error:', e?.message);
  }

  try {
    const profile = await getProfile(currentUser.id);
    const name = profile?.full_name?.split(' ')[0] || 'Investor';
    const initials = (profile?.full_name || 'TX').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
    const sidebarName   = document.getElementById('sidebarUserName');
    const sidebarRole   = document.getElementById('sidebarUserRole');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const topbarName    = document.getElementById('topbarUserName');
    const topbarAvatar  = document.getElementById('topbarAvatar');
    if (sidebarName)   sidebarName.textContent   = profile?.full_name || 'Investor';
    if (sidebarRole)   sidebarRole.textContent   = profile?.role === 'admin' ? 'Administrator' : 'Investor';
    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (topbarName)    topbarName.textContent    = name;
    if (topbarAvatar)  topbarAvatar.textContent  = initials;
  } catch (e) {
    console.warn('Profile load error:', e?.message);
  }

  renderWalletBalance();
  renderPlanCards();
  initFileUpload();
  initForm();
  initLogout();
}

// ── RENDER WALLET BALANCE ─────────────────────────────────
function renderWalletBalance() {
  const el = document.getElementById('walletBalance');
  if (el) el.textContent = formatMoney(currentWallet?.balance || 0);
}

// ── RENDER PLAN CARDS ─────────────────────────────────────
function renderPlanCards() {
  const container = document.getElementById('planCards');
  if (!container) return;

  container.innerHTML = PLANS.map(plan => `
    <div class="plan-select-card" data-tier="${plan.tier}" data-amount="${plan.amount}" onclick="selectPlan('${plan.tier}')">
      <div class="plan-select-icon" style="background:${TIER_COLORS[plan.tier]}22;border:1px solid ${TIER_COLORS[plan.tier]}44;">
        <span>${TIER_EMOJI[plan.tier]}</span>
      </div>
      <div class="plan-select-name">${plan.name}</div>
      <div class="plan-select-deposit">Deposit <strong>${formatMoney(plan.amount)}</strong></div>
      <div class="plan-select-arrow">↓</div>
      <div class="plan-select-payout">${formatMoney(plan.payout)}</div>
      <div class="plan-select-label">in 7 days</div>
      <div class="plan-select-check">
        <i data-lucide="check" style="width:14px;height:14px"></i>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

// ── SELECT PLAN ───────────────────────────────────────────
window.selectPlan = function(tier) {
  selectedPlan = PLANS.find(p => p.tier === tier);
  if (!selectedPlan) return;

  // Update UI selection state
  document.querySelectorAll('.plan-select-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.tier === tier);
  });

  // Update amount input display
  const amountEl   = document.getElementById('depositAmount');
  const planNameEl = document.getElementById('selectedPlanName');
  const planPayEl  = document.getElementById('selectedPlanPayout');
  const summaryEl  = document.getElementById('planSummary');

  if (amountEl)   amountEl.value = selectedPlan.amount;
  if (planNameEl) planNameEl.textContent = `${TIER_EMOJI[tier]} ${selectedPlan.name} Plan`;
  if (planPayEl)  planPayEl.textContent = `You receive ${formatMoney(selectedPlan.payout)} in 7 days`;
  if (summaryEl)  summaryEl.classList.remove('d-none');

  // Scroll to form
  document.getElementById('depositFormSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ── FILE UPLOAD ───────────────────────────────────────────
function initFileUpload() {
  const dropzone   = document.getElementById('cardImageDropzone');
  const fileInput  = document.getElementById('cardImageInput');
  const preview    = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  const removeBtn  = document.getElementById('removeImage');
  const uploadText = document.getElementById('uploadText');

  if (!dropzone || !fileInput) return;

  // Click to browse
  dropzone.addEventListener('click', () => fileInput.click());

  // Drag over
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });

  // File selected
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleImageFile(file);
  });

  // Remove image
  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    uploadedImageUrl = null;
    fileInput.value  = '';
    if (preview)    preview.classList.add('d-none');
    if (uploadText) uploadText.classList.remove('d-none');
  });

  function handleImageFile(file) {
    // Validate type
    if (!file.type.startsWith('image/')) {
      showToast('Invalid File', 'Please upload an image file (JPG, PNG, etc.)', 'error');
      return;
    }
    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('File Too Large', 'Image must be under 5MB.', 'error');
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) previewImg.src = e.target.result;
      if (preview)    preview.classList.remove('d-none');
      if (uploadText) uploadText.classList.add('d-none');
    };
    reader.readAsDataURL(file);

    // Store file reference for upload on submit
    window._pendingCardImage = file;
  }
}

// ── UPLOAD IMAGE TO SUPABASE STORAGE ─────────────────────
async function uploadCardImage(file) {
  const ext      = file.name.split('.').pop().toLowerCase();
  const fileName = `${currentUser.id}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('gift-card-images')
    .upload(fileName, file, { upsert: true, contentType: file.type });

  if (error) throw error;

  // Return the file path — admin will generate signed URLs to view
  return fileName;
}

// ── GET SIGNED URL FOR VIEWING (called by admin) ──────────
export async function getSignedImageUrl(filePath) {
  const { data, error } = await supabase.storage
    .from('gift-card-images')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}

// ── FORM SUBMIT ───────────────────────────────────────────
function initForm() {
  const form      = document.getElementById('depositForm');
  const submitBtn = document.getElementById('depositSubmitBtn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate plan selected
    if (!selectedPlan) {
      showToast('Select a Plan', 'Please select an investment plan first.', 'warning');
      document.getElementById('planCards')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Validate card number
    const cardNumber = document.getElementById('cardNumber')?.value.trim();
    if (!cardNumber || cardNumber.length < 10) {
      showToast('Card Number Required', 'Please enter your Apple Gift Card number.', 'warning');
      return;
    }

    // Validate image
    if (!window._pendingCardImage) {
      showToast('Image Required', 'Please upload a photo of your scratched gift card.', 'warning');
      return;
    }

    // Set loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner spinner-sm" style="border-top-color:white;margin-right:8px;"></span>
      <span>Submitting...</span>
    `;

    try {
      // Upload image
      showToast('Uploading', 'Uploading your gift card image...', 'info');
      const imageUrl = await uploadCardImage(window._pendingCardImage);

      // Insert deposit record
      const { error } = await supabase
        .from('deposits')
        .insert({
          user_id:        currentUser.id,
          amount:         selectedPlan.amount,
          card_number:    cardNumber,
          card_image_url: imageUrl,
          status:         'pending',
        });

      if (error) throw error;

      // Show success screen
      document.getElementById('depositFormWrap')?.classList.add('d-none');
      document.getElementById('depositSuccess')?.classList.remove('d-none');

      // Clear pending file
      window._pendingCardImage = null;

    } catch (err) {
      console.error('Deposit error:', err);
      showToast('Submission Failed', err?.message || 'Something went wrong. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <i data-lucide="send" style="width:18px;height:18px"></i>
        <span>Submit Deposit</span>
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
      window.location.href = '../login.html';
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
