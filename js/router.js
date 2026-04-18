/**
 * Simple hash-based SPA router
 */
const routes = ['dashboard', 'list', 'history', 'settings'];
let currentPage = 'dashboard';
let onNavigateCallback = null;

export function initRouter(onNavigate) {
  onNavigateCallback = onNavigate;

  // Handle hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);
  });

  // Handle nav link clicks
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      window.location.hash = page;
    });
  });

  // Initial route
  const initial = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(initial);
}

export function navigateTo(page) {
  if (!routes.includes(page)) page = 'dashboard';
  currentPage = page;

  // Update active nav link
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Update visible page
  document.querySelectorAll('.page').forEach((p) => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');

  // Callback
  if (onNavigateCallback) onNavigateCallback(page);
}

export function getCurrentPage() {
  return currentPage;
}
