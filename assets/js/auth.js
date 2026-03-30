// ============================================================
// TRADEX — AUTH JS
// assets/js/auth.js
// Handles: Register, Login, Logout, Password Reset
// ============================================================

import { supabase, redirectIfLoggedIn } from './supabase.js';

// ── TOAST HELPER (inline — no dependency) ─────────────────
function showToast(title, message, type = 'info') {
  const icons = {
    success: 'check-circle',
    error:   'x-circle',
    warning: 'alert-triangle',
    info:    'info',
  };

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
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ── SET BUTTON LOADING STATE ──────────────────────────────
function setLoading(btn, loading, originalText) {
  if (loading) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = '<span class="btn-text">' + originalText + '</span>';
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    if (btn.dataset.original) {
      btn.innerHTML = btn.dataset.original;
    }
    if (window.lucide) lucide.createIcons();
  }
}

// ── SHOW / HIDE FORM ERROR ────────────────────────────────
function setFieldError(fieldId, message) {
  const field   = document.getElementById(fieldId);
  const wrapper = field?.closest('.form-group');
  if (!wrapper) return;

  // Remove existing error
  wrapper.querySelector('.form-error')?.remove();
  field?.classList.remove('error');

  if (message) {
    field?.classList.add('error');
    const err = document.createElement('div');
    err.className = 'form-error';
    err.innerHTML = `<i data-lucide="alert-circle" style="width:12px;height:12px"></i> ${message}`;
    wrapper.appendChild(err);
    if (window.lucide) lucide.createIcons();
  }
}

function clearAllErrors() {
  document.querySelectorAll('.form-error').forEach(e => e.remove());
  document.querySelectorAll('.form-input.error').forEach(e => e.classList.remove('error'));
}

// ── PASSWORD STRENGTH ─────────────────────────────────────
function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8)              score++;
  if (/[A-Z]/.test(password))           score++;
  if (/[0-9]/.test(password))           score++;
  if (/[^A-Za-z0-9]/.test(password))    score++;

  if (score <= 1) return { label: 'Weak',   color: 'var(--error)',   width: '25%' };
  if (score === 2) return { label: 'Fair',   color: 'var(--warning)', width: '50%' };
  if (score === 3) return { label: 'Good',   color: 'var(--info)',    width: '75%' };
  return             { label: 'Strong', color: 'var(--success)', width: '100%' };
}

// ============================================================
// REGISTER
// ============================================================
export async function initRegister() {
  await redirectIfLoggedIn();

  const form        = document.getElementById('registerForm');
  const submitBtn   = document.getElementById('registerBtn');
  const passwordEl  = document.getElementById('password');
  const strengthBar = document.getElementById('strengthFill');
  const strengthLbl = document.getElementById('strengthLabel');
  const toggleBtns  = document.querySelectorAll('[data-toggle-password]');

  if (!form) return;

  // Password strength meter
  passwordEl?.addEventListener('input', () => {
    const val = passwordEl.value;
    if (!val) {
      if (strengthBar) strengthBar.style.width = '0%';
      if (strengthLbl) strengthLbl.textContent = '';
      return;
    }
    const strength = getPasswordStrength(val);
    if (strengthBar) {
      strengthBar.style.width = strength.width;
      strengthBar.style.background = strength.color;
    }
    if (strengthLbl) {
      strengthLbl.textContent = strength.label;
      strengthLbl.style.color = strength.color;
    }
  });

  // Toggle password visibility — handled by plain script in HTML
  // auth.js does NOT re-attach toggle to avoid duplicate listeners

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const fullName  = document.getElementById('fullName')?.value.trim();
    const email     = document.getElementById('email')?.value.trim();
    const password  = document.getElementById('password')?.value;
    const confirm   = document.getElementById('confirmPassword')?.value;
    const agreed    = document.getElementById('terms')?.checked;

    // Validate
    let hasError = false;

    if (!fullName || fullName.length < 2) {
      setFieldError('fullName', 'Please enter your full name');
      hasError = true;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('email', 'Please enter a valid email address');
      hasError = true;
    }
    if (!password || password.length < 8) {
      setFieldError('password', 'Password must be at least 8 characters');
      hasError = true;
    }
    if (password !== confirm) {
      setFieldError('confirmPassword', 'Passwords do not match');
      hasError = true;
    }
    if (!agreed) {
      showToast('Terms Required', 'Please agree to the Terms of Service to continue.', 'warning');
      hasError = true;
    }

    if (hasError) return;

    setLoading(submitBtn, true, 'Creating account...');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/login.html`
        }
      });

      if (error) throw error;

      // Show success screen
      document.getElementById('registerFormWrap')?.classList.add('d-none');
      document.getElementById('registerSuccess')?.classList.remove('d-none');

    } catch (err) {
      console.error('Register error:', err);
      const msg = err.message || 'Registration failed. Please try again.';

      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        setFieldError('email', 'This email is already registered. Try logging in.');
      } else {
        showToast('Registration Failed', msg, 'error');
      }
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

// ============================================================
// LOGIN
// ============================================================
export async function initLogin() {
  await redirectIfLoggedIn();

  const form      = document.getElementById('loginForm');
  const submitBtn = document.getElementById('loginBtn');
  const toggleBtn = document.querySelector('[data-toggle-password]');

  if (!form) return;

  // Toggle password visibility — handled by plain script in HTML
  // auth.js does NOT re-attach toggle to avoid duplicate listeners

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const email    = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const remember = document.getElementById('remember')?.checked;

    // Validate
    let hasError = false;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('email', 'Please enter a valid email address');
      hasError = true;
    }
    if (!password) {
      setFieldError('password', 'Please enter your password');
      hasError = true;
    }

    if (hasError) return;

    setLoading(submitBtn, true, 'Signing in...');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { user } = data;

      // Get profile to check role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_active, full_name')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Check if account is active
      if (!profile.is_active) {
        await supabase.auth.signOut();
        showToast('Account Suspended', 'Your account has been suspended. Contact support.', 'error');
        setLoading(submitBtn, false);
        return;
      }

      showToast('Welcome back!', `Good to see you, ${profile.full_name || 'Investor'}.`, 'success');

      // Redirect based on role
      setTimeout(() => {
        if (profile.role === 'admin') {
          window.location.href = '/admin/index.html';
        } else {
          window.location.href = '/dashboard/index.html';
        }
      }, 800);

    } catch (err) {
      console.error('Login error:', err);
      const msg = err.message || '';

      if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        showToast('Login Failed', 'Incorrect email or password. Please try again.', 'error');
        setFieldError('email', ' ');
        setFieldError('password', 'Incorrect email or password');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        showToast('Email Not Verified', 'Please check your inbox and verify your email first.', 'warning');
      } else {
        showToast('Login Failed', msg || 'Something went wrong. Please try again.', 'error');
      }
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

// ============================================================
// FORGOT PASSWORD
// ============================================================
export async function initForgotPassword() {
  const form      = document.getElementById('forgotForm');
  const submitBtn = document.getElementById('forgotBtn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const email = document.getElementById('email')?.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('email', 'Please enter a valid email address');
      return;
    }

    setLoading(submitBtn, true, 'Sending reset link...');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`
      });

      if (error) throw error;

      document.getElementById('forgotFormWrap')?.classList.add('d-none');
      document.getElementById('forgotSuccess')?.classList.remove('d-none');

    } catch (err) {
      showToast('Error', err.message || 'Failed to send reset email.', 'error');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

// ============================================================
// LOGOUT
// ============================================================
export async function logout() {
  try {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout error:', err);
    window.location.href = '/login.html';
  }
}
