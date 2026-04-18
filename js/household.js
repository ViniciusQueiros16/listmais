import { supabase } from './supabase.js';
import { showScreen, showToast, CATEGORY_ICONS } from './utils.js';
import { TEMPLATE_CATEGORIES } from './templates.js';

/**
 * Initialize household UI
 */
export function initHousehold(onHouseholdReady) {
  const optCreate = document.getElementById('opt-create-house');
  const optJoin = document.getElementById('opt-join-house');
  const createForm = document.getElementById('create-house-form');
  const joinForm = document.getElementById('join-house-form');
  const householdLogout = document.getElementById('household-logout');

  optCreate.addEventListener('click', () => {
    createForm.classList.toggle('show');
    joinForm.classList.remove('show');
  });

  optJoin.addEventListener('click', () => {
    joinForm.classList.toggle('show');
    createForm.classList.remove('show');
  });

  householdLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    showScreen('auth-screen');
  });

  // Create household
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('house-name').value.trim();
    if (!name) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { data: household, error } = await supabase
      .from('households')
      .insert({ name, created_by: user.id })
      .select()
      .single();

    if (error) {
      showToast('Erro', error.message, '❌');
      return;
    }

    // Add creator as admin
    await supabase
      .from('household_members')
      .insert({ household_id: household.id, user_id: user.id, role: 'admin' });

    showToast('Casa criada!', `Código de convite: ${household.invite_code}`, '🏠');
    onHouseholdReady(household);
  });

  // Join household
  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('invite-code-input').value.trim().toLowerCase();
    if (!code) return;

    const { data: household, error: findError } = await supabase
      .from('households')
      .select('*')
      .eq('invite_code', code)
      .single();

    if (findError || !household) {
      showToast('Erro', 'Código de convite inválido', '❌');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Check if already a member
    const { data: existing } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', household.id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      await supabase
        .from('household_members')
        .insert({ household_id: household.id, user_id: user.id, role: 'member' });

      // Notify others
      const { data: members } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', household.id)
        .neq('user_id', user.id);

      const profile = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      if (members) {
        const notifications = members.map((m) => ({
          household_id: household.id,
          user_id: m.user_id,
          type: 'member_joined',
          title: 'Novo membro!',
          message: `${profile.data?.name || 'Alguém'} entrou na casa`,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    }

    showToast('Entrou na casa!', household.name, '🎉');
    onHouseholdReady(household);
  });
}

/**
 * Get user's household(s)
 */
export async function getUserHousehold(userId) {
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role, households(*)')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!membership) return null;
  return { ...membership.households, userRole: membership.role };
}

/**
 * Get household members with profiles
 */
export async function getHouseholdMembers(householdId) {
  const { data } = await supabase
    .from('household_members')
    .select('*, profiles(*)')
    .eq('household_id', householdId);
  return data || [];
}

/**
 * Load template items into a household
 */
export async function loadTemplate(householdId) {
  // Create categories
  for (let i = 0; i < TEMPLATE_CATEGORIES.length; i++) {
    const cat = TEMPLATE_CATEGORIES[i];

    const { data: category } = await supabase
      .from('categories')
      .insert({
        household_id: householdId,
        name: cat.name,
        icon: cat.icon,
        sort_order: i,
      })
      .select()
      .single();

    if (!category) continue;

    // Create items for this category
    const items = cat.items.map((item) => ({
      household_id: householdId,
      category_id: category.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      in_stock: false,
      checked: false,
    }));

    await supabase.from('items').insert(items);
  }
}
