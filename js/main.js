import { supabase } from './supabase.js';
import { showScreen, showToast, getInitials } from './utils.js';
import { initAuth, logout, getCurrentUser, getUserProfile } from './auth.js';
import { initHousehold, getUserHousehold, getHouseholdMembers, loadTemplate } from './household.js';
import { initRouter } from './router.js';
import { renderDashboard } from './dashboard.js';
import { initList, loadAndRender as loadList } from './list.js';
import { renderHistory, exportData } from './history.js';
import { loadNotifications, initNotificationPanel } from './notifications.js';
import { subscribeRealtime, renderOnlineMembers, unsubscribeAll } from './realtime.js';
import { resetList } from './items.js';

// App state
let currentUser = null;
let currentProfile = null;
let currentHousehold = null;
let householdMembers = [];

/**
 * Boot the application
 */
async function boot() {
  // Check existing session
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    currentUser = session.user;
    await checkHousehold();
  } else {
    showScreen('auth-screen');
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      currentHousehold = null;
      unsubscribeAll();
      showScreen('auth-screen');
    }
  });
}

/**
 * After auth success, check if user has a household
 */
async function checkHousehold() {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    showScreen('auth-screen');
    return;
  }

  currentProfile = await getUserProfile(currentUser.id);
  currentHousehold = await getUserHousehold(currentUser.id);

  if (currentHousehold) {
    await initApp();
  } else {
    showScreen('household-screen');
  }
}

/**
 * Initialize the main app after auth + household are ready
 */
async function initApp() {
  showScreen('app-screen');

  // Update sidebar info
  const name = currentProfile?.name || currentUser.email;
  document.getElementById('sidebar-user-name').textContent = name;
  document.getElementById('sidebar-avatar').textContent = getInitials(name);
  document.getElementById('sidebar-user-role').textContent =
    currentHousehold.userRole === 'admin' ? 'Administrador' : 'Membro';
  document.getElementById('sidebar-house-name').textContent = currentHousehold.name;

  // Load household members
  householdMembers = await getHouseholdMembers(currentHousehold.id);

  // Init modules
  initList(currentHousehold.id, currentUser.id);
  initNotificationPanel(currentUser.id);
  initSettings();

  // Init router with page load callbacks
  initRouter(async (page) => {
    switch (page) {
      case 'dashboard':
        await renderDashboard(currentHousehold.id);
        break;
      case 'list':
        await loadList();
        break;
      case 'history':
        await renderHistory(currentHousehold.id);
        break;
      case 'settings':
        renderSettings();
        break;
    }
  });

  // Load initial data
  await Promise.all([
    renderDashboard(currentHousehold.id),
    loadNotifications(currentUser.id),
  ]);

  // Subscribe to realtime
  subscribeRealtime(currentHousehold.id, currentUser.id, {
    onItemChange: async (payload) => {
      // Refresh list if on list page
      const currentHash = window.location.hash.replace('#', '') || 'dashboard';
      if (currentHash === 'list') {
        await loadList();
      } else if (currentHash === 'dashboard') {
        await renderDashboard(currentHousehold.id);
      }
    },
    onPresenceChange: (state) => {
      renderOnlineMembers(state, householdMembers);
    },
  });
}

/**
 * Settings page
 */
function initSettings() {
  // Copy invite code
  document.getElementById('copy-invite-btn').addEventListener('click', async () => {
    const code = currentHousehold.invite_code;
    try {
      await navigator.clipboard.writeText(code);
      showToast('Copiado!', 'Código de convite copiado', '📋');
    } catch {
      showToast('Código', code, '📋');
    }
  });

  // Load template
  document.getElementById('load-template-btn').addEventListener('click', async () => {
    if (!confirm('Isso vai adicionar 89 itens à sua lista. Continuar?')) return;
    showToast('Carregando...', 'Adicionando itens do template', '⏳');
    await loadTemplate(currentHousehold.id);
    showToast('Template carregado!', '89 itens adicionados', '✅');
    await loadList();
  });

  // Export
  document.getElementById('export-data-btn').addEventListener('click', () => {
    exportData(currentHousehold.id);
  });

  document.getElementById('export-btn').addEventListener('click', () => {
    exportData(currentHousehold.id);
  });

  // Reset list
  document.getElementById('reset-list-btn').addEventListener('click', async () => {
    if (!confirm('Resetar a lista? Isso vai desmarcar todos os "Vistos" e limpar os preços atuais.')) return;
    await resetList(currentHousehold.id);
    await loadList();
  });

  // Import
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });

  document.getElementById('file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      showToast('Importação', 'Funcionalidade de importação em desenvolvimento', '📂');
    } catch (err) {
      showToast('Erro', 'Arquivo inválido', '❌');
    }
    e.target.value = '';
  });
}

function renderSettings() {
  document.getElementById('settings-invite-code').textContent = currentHousehold.invite_code || '--------';

  const membersGrid = document.getElementById('members-grid');
  membersGrid.innerHTML = householdMembers.map((m) => {
    const name = m.profiles?.name || 'Usuário';
    return `
      <div class="member-chip">
        <div class="user-avatar" style="background: ${m.role === 'admin' ? 'var(--gradient-primary)' : 'var(--gradient-cool)'};">
          ${getInitials(name)}
        </div>
        <span class="member-chip-name">${name}</span>
        <span class="member-chip-role">${m.role === 'admin' ? 'Admin' : 'Membro'}</span>
      </div>
    `;
  }).join('');
}

// ---- UI Event Listeners ----

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  unsubscribeAll();
  await logout();
});

// Mobile sidebar
document.getElementById('mobile-menu-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
});

document.getElementById('sidebar-overlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
});

// ---- Init Auth & Household ----
initAuth(() => checkHousehold());
initHousehold(async (household) => {
  currentHousehold = { ...household, userRole: 'admin' };
  await initApp();
});

// ---- Boot ----
boot();
