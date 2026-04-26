import { supabase } from './supabase.js';
import { showScreen, showToast } from './utils.js';

/**
 * Initialize auth UI event listeners
 */
export function initAuth(onAuthSuccess) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const authError = document.getElementById('auth-error');

  // Tab switching
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.style.display = '';
    signupForm.style.display = 'none';
    authError.classList.remove('show');
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.style.display = '';
    loginForm.style.display = 'none';
    authError.classList.remove('show');
  });

  function showError(msg) {
    authError.textContent = msg;
    authError.classList.add('show');
  }

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.textContent = 'Entrando...';
    authError.classList.remove('show');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    btn.disabled = false;
    btn.textContent = 'Entrar';

    if (error) {
      showError(error.message === 'Invalid login credentials'
        ? 'Email ou senha incorretos'
        : error.message);
      return;
    }

    onAuthSuccess();
  });

  // Signup
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const btn = document.getElementById('signup-btn');

    if (password.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Criando conta...';
    authError.classList.remove('show');

    const siteUrl = window.location.origin;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${siteUrl}/`,
      },
    });

    btn.disabled = false;
    btn.textContent = 'Criar Conta';

    if (error) {
      showError(error.message);
      return;
    }

    showToast('Conta criada!', 'Bem-vindo ao ListMais', '🎉');
    onAuthSuccess();
  });
}

/**
 * Logout
 */
export async function logout() {
  await supabase.auth.signOut();
  showScreen('auth-screen');
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get user profile
 */
export async function getUserProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}
