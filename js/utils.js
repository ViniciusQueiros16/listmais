/**
 * Format a number as BRL currency
 */
export function formatCurrency(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Format a date relative to now
 */
export function timeAgo(date) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHour < 24) return `${diffHour}h atrás`;
  if (diffDay < 7) return `${diffDay}d atrás`;
  return d.toLocaleDateString('pt-BR');
}

/**
 * Format date for display
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format short date
 */
export function formatDateShort(date) {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Get initials from a name
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Debounce function
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Show toast notification
 */
export function showToast(title, message, icon = '🔔') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

/**
 * Show/hide elements
 */
export function showScreen(screenId) {
  ['loading-screen', 'auth-screen', 'household-screen', 'app-screen'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = id === screenId ? '' : 'none';
      if (id === 'app-screen') {
        el.classList.toggle('show', id === screenId);
      }
    }
  });
}

/**
 * Category icons map
 */
export const CATEGORY_ICONS = {
  'Mercearia Básica': '🛒',
  'Açougue e Carnes': '🥩',
  'Miúdos e Preparos': '🍖',
  'Peixaria': '🐟',
  'Hortifruti': '🥬',
  'Condimentos': '🧂',
  'Laticínios e Frios': '🧀',
  'Padaria e Biscoitos': '🍞',
  'Congelados': '🧊',
  'Bebidas': '🥤',
  'Higiene Pessoal': '🧴',
  'Limpeza': '🧹',
  'Outros': '📦',
  'Pet': '🐾',
};

/**
 * Notification type config
 */
export const NOTIFICATION_TYPES = {
  stock_out: { icon: '🔴', label: 'Acabou' },
  list_ready: { icon: '📋', label: 'Lista pronta' },
  price_up: { icon: '📈', label: 'Preço subiu' },
  member_joined: { icon: '👋', label: 'Novo membro' },
  purchase_done: { icon: '✅', label: 'Compra finalizada' },
};
