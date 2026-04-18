import { supabase } from './supabase.js';
import { showToast, getInitials } from './utils.js';
import { loadNotifications } from './notifications.js';

let itemsChannel = null;
let notificationsChannel = null;
let presenceChannel = null;

/**
 * Subscribe to realtime changes
 */
export function subscribeRealtime(householdId, userId, handlers) {
  unsubscribeAll();

  // Items changes
  itemsChannel = supabase
    .channel(`items-${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'items',
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        if (handlers.onItemChange) handlers.onItemChange(payload);
      }
    )
    .subscribe();

  // Notifications
  notificationsChannel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const n = payload.new;
        showToast(n.title, n.message, getNotificationIcon(n.type));
        loadNotifications(userId);
      }
    )
    .subscribe();

  // Presence (who's online)
  presenceChannel = supabase.channel(`presence-${householdId}`, {
    config: { presence: { key: userId } },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      if (handlers.onPresenceChange) handlers.onPresenceChange(state);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
      }
    });
}

function getNotificationIcon(type) {
  const icons = {
    stock_out: '🔴',
    list_ready: '📋',
    price_up: '📈',
    member_joined: '👋',
    purchase_done: '✅',
  };
  return icons[type] || '🔔';
}

/**
 * Render online members
 */
export function renderOnlineMembers(presenceState, membersData) {
  const container = document.getElementById('online-members');
  const onlineUserIds = Object.keys(presenceState);

  if (onlineUserIds.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = onlineUserIds.slice(0, 5).map((key) => {
    const presences = presenceState[key];
    const uid = presences?.[0]?.user_id || key;
    const member = membersData.find((m) => m.user_id === uid);
    const name = member?.profiles?.name || '?';
    const initials = getInitials(name);

    return `
      <div class="online-avatar" title="${name} (online)">
        ${initials}
        <div class="online-dot"></div>
      </div>
    `;
  }).join('');

  if (onlineUserIds.length > 5) {
    container.innerHTML += `
      <div class="online-avatar" style="background: var(--surface); font-size: 0.6rem;">
        +${onlineUserIds.length - 5}
      </div>
    `;
  }
}

/**
 * Unsubscribe from all channels
 */
export function unsubscribeAll() {
  if (itemsChannel) {
    supabase.removeChannel(itemsChannel);
    itemsChannel = null;
  }
  if (notificationsChannel) {
    supabase.removeChannel(notificationsChannel);
    notificationsChannel = null;
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
}
