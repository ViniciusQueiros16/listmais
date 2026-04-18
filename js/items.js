import { supabase } from './supabase.js';
import { showToast } from './utils.js';

/**
 * Toggle item stock status
 */
export async function toggleStock(itemId, currentValue, householdId, userId) {
  const newValue = !currentValue;

  const { error } = await supabase
    .from('items')
    .update({ in_stock: newValue })
    .eq('id', itemId);

  if (error) {
    showToast('Erro', error.message, '❌');
    return;
  }

  // If item went out of stock, notify household members
  if (currentValue === true && newValue === false) {
    const { data: item } = await supabase
      .from('items')
      .select('name')
      .eq('id', itemId)
      .single();

    if (item) {
      const { data: members } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId)
        .neq('user_id', userId);

      if (members && members.length > 0) {
        const notifications = members.map((m) => ({
          household_id: householdId,
          user_id: m.user_id,
          type: 'stock_out',
          title: `${item.name} acabou!`,
          message: 'Este item foi marcado como fora de estoque',
          related_item_id: itemId,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    }
  }
}

/**
 * Toggle item checked (visto) status
 */
export async function toggleChecked(itemId, currentValue, userId) {
  const { error } = await supabase
    .from('items')
    .update({
      checked: !currentValue,
      checked_by: !currentValue ? userId : null,
    })
    .eq('id', itemId);

  if (error) {
    showToast('Erro', error.message, '❌');
  }
}

/**
 * Update item price
 */
export async function updateItemPrice(itemId, field, value, householdId, userId) {
  const numValue = parseFloat(value) || null;

  // If updating current_price, check if it's higher than previous for notification
  if (field === 'current_price' && numValue) {
    const { data: item } = await supabase
      .from('items')
      .select('name, previous_price')
      .eq('id', itemId)
      .single();

    if (item && item.previous_price && numValue > item.previous_price) {
      // Notify about price increase
      const { data: members } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId)
        .neq('user_id', userId);

      if (members && members.length > 0) {
        const pctIncrease = (((numValue - item.previous_price) / item.previous_price) * 100).toFixed(0);
        const notifications = members.map((m) => ({
          household_id: householdId,
          user_id: m.user_id,
          type: 'price_up',
          title: `${item.name} subiu de preço`,
          message: `De R$${item.previous_price.toFixed(2)} para R$${numValue.toFixed(2)} (+${pctIncrease}%)`,
          related_item_id: itemId,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    }
  }

  await supabase
    .from('items')
    .update({ [field]: numValue })
    .eq('id', itemId);
}

/**
 * Update item quantity
 */
export async function updateItemQuantity(itemId, value) {
  const numValue = parseFloat(value) || 1;
  await supabase
    .from('items')
    .update({ quantity: numValue })
    .eq('id', itemId);
}

/**
 * Add a new item
 */
export async function addItem(householdId, categoryId, name, quantity, unit) {
  const { data, error } = await supabase
    .from('items')
    .insert({
      household_id: householdId,
      category_id: categoryId,
      name,
      quantity: quantity || 1,
      unit: unit || 'Un',
      in_stock: false,
      checked: false,
    })
    .select()
    .single();

  if (error) {
    showToast('Erro', error.message, '❌');
    return null;
  }

  return data;
}

/**
 * Delete an item
 */
export async function deleteItem(itemId) {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId);

  if (error) {
    showToast('Erro', error.message, '❌');
    return false;
  }
  return true;
}

/**
 * Add a new category
 */
export async function addCategory(householdId, name, icon) {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: householdId,
      name,
      icon: icon || '📦',
    })
    .select()
    .single();

  if (error) {
    showToast('Erro', error.message, '❌');
    return null;
  }
  return data;
}

/**
 * Finalize purchase — save snapshot and reset
 */
export async function finalizePurchase(householdId, userId) {
  // Get all checked items with prices
  const { data: items } = await supabase
    .from('items')
    .select('*, categories(name)')
    .eq('household_id', householdId)
    .eq('checked', true);

  if (!items || items.length === 0) {
    showToast('Atenção', 'Nenhum item marcado como visto', '⚠️');
    return false;
  }

  const total = items.reduce((sum, item) => {
    return sum + (item.current_price ? item.quantity * item.current_price : 0);
  }, 0);

  // Create purchase record
  const { data: purchase, error } = await supabase
    .from('purchases')
    .insert({
      household_id: householdId,
      finalized_by: userId,
      total,
      items_count: items.length,
    })
    .select()
    .single();

  if (error) {
    showToast('Erro', error.message, '❌');
    return false;
  }

  // Create purchase items snapshot
  const purchaseItems = items.map((item) => ({
    purchase_id: purchase.id,
    item_name: item.name,
    category_name: item.categories?.name || 'Sem Categoria',
    quantity: item.quantity,
    unit: item.unit,
    price: item.current_price,
    subtotal: item.current_price ? item.quantity * item.current_price : 0,
  }));

  await supabase.from('purchase_items').insert(purchaseItems);

  // Move current_price to previous_price and reset checked
  for (const item of items) {
    await supabase
      .from('items')
      .update({
        previous_price: item.current_price,
        current_price: null,
        checked: false,
        checked_by: null,
        in_stock: true, // Items bought are now in stock
      })
      .eq('id', item.id);
  }

  // Notify all members
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);

  if (members) {
    const notifications = members.map((m) => ({
      household_id: householdId,
      user_id: m.user_id,
      type: 'purchase_done',
      title: 'Compra finalizada!',
      message: `Total: R$${total.toFixed(2)} — ${items.length} itens`,
    }));
    await supabase.from('notifications').insert(notifications);
  }

  showToast('Compra finalizada!', `Total: R$${total.toFixed(2)}`, '✅');
  return true;
}

/**
 * Reset list for new purchase (uncheck all without finalizing)
 */
export async function resetList(householdId) {
  await supabase
    .from('items')
    .update({ checked: false, checked_by: null, current_price: null })
    .eq('household_id', householdId);

  showToast('Lista resetada', 'Pronta para nova compra', '🔄');
}
