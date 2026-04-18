import { supabase } from './supabase.js';
import { timeAgo, NOTIFICATION_TYPES } from './utils.js';

/**
 * Load and render notifications
 */
export async function loadNotifications(userId) {
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  renderNotifications(notifications || []);
  updateBadge(notifications || []);
  return notifications || [];
}

function renderNotifications(notifications) {
  const list = document.getElementById('notifications-list');

  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-state-icon">🔔</div>
        <p>Nenhuma notificação</p>
      </div>
    `;
    return;
  }

  list.innerHTML = notifications.map((n) => {
    const typeConfig = NOTIFICATION_TYPES[n.type] || { icon: '🔔', label: '' };
    return `
      <div class="notification-item ${n.read ? '' : 'unread'}" data-notification-id="${n.id}">
        <div class="notification-type-icon ${n.type}">${typeConfig.icon}</div>
        <div class="notification-content">
          <div class="notification-title">${n.title}</div>
          ${n.message ? `<div class="notification-message">${n.message}</div>` : ''}
          <div class="notification-time">${timeAgo(n.created_at)}</div>
        </div>
        ${!n.read ? '<div class="unread-dot"></div>' : ''}
      </div>
    `;
  }).join('');

  // Mark as read on click
  list.addEventListener('click', async (e) => {
    const item = e.target.closest('.notification-item');
    if (!item) return;
    const id = item.dataset.notificationId;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    item.classList.remove('unread');
    item.querySelector('.unread-dot')?.remove();
    updateBadgeCount();
  });
}

function updateBadge(notifications) {
  const unread = notifications.filter((n) => !n.read).length;
  const badge = document.getElementById('notification-badge');
  badge.textContent = unread;
  badge.classList.toggle('show', unread > 0);
}

async function updateBadgeCount() {
  const badge = document.getElementById('notification-badge');
  const unreadDots = document.querySelectorAll('.notification-item.unread');
  badge.textContent = unreadDots.length;
  badge.classList.toggle('show', unreadDots.length > 0);
}

/**
 * Mark all notifications as read
 */
export async function markAllRead(userId) {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  document.querySelectorAll('.notification-item.unread').forEach((item) => {
    item.classList.remove('unread');
    item.querySelector('.unread-dot')?.remove();
  });

  const badge = document.getElementById('notification-badge');
  badge.textContent = '0';
  badge.classList.remove('show');
}

/**
 * Init notification panel toggle
 */
export function initNotificationPanel(userId) {
  const btn = document.getElementById('notification-btn');
  const panel = document.getElementById('notifications-panel');
  const markAllBtn = document.getElementById('mark-all-read-btn');

  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.remove('open');
    }
  });

  markAllBtn.addEventListener('click', () => markAllRead(userId));
}
