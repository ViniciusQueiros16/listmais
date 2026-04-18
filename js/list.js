import { supabase } from './supabase.js';
import { formatCurrency, debounce, CATEGORY_ICONS } from './utils.js';
import {
  toggleStock, toggleChecked, updateItemPrice,
  updateItemQuantity, deleteItem, addItem, addCategory,
  finalizePurchase
} from './items.js';

let currentFilter = 'all';
let currentSearch = '';
let householdId = null;
let userId = null;
let allItems = [];
let allCategories = [];

/**
 * Initialize list page
 */
export function initList(hId, uId) {
  householdId = hId;
  userId = uId;

  // Filter chips
  document.getElementById('list-controls').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    currentFilter = chip.dataset.filter;
    document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    renderList();
  });

  // Search
  const searchInput = document.getElementById('global-search');
  searchInput.addEventListener('input', debounce((e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    renderList();
  }, 250));

  // Add item button
  document.getElementById('add-item-btn').addEventListener('click', showAddItemModal);

  // Finalize button
  document.getElementById('finalize-btn').addEventListener('click', async () => {
    if (!confirm('Deseja finalizar a compra? Itens marcados serão salvos no histórico.')) return;
    const success = await finalizePurchase(householdId, userId);
    if (success) {
      await loadAndRender();
    }
  });
}

/**
 * Load data and render
 */
export async function loadAndRender() {
  const [itemsResult, categoriesResult] = await Promise.all([
    supabase
      .from('items')
      .select('*, categories(id, name, icon, sort_order)')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true }),
    supabase
      .from('categories')
      .select('*')
      .eq('household_id', householdId)
      .order('sort_order', { ascending: true }),
  ]);

  allItems = itemsResult.data || [];
  allCategories = categoriesResult.data || [];
  renderList();
}

/**
 * Render the shopping list
 */
function renderList() {
  const container = document.getElementById('items-container');

  // Filter items
  let filtered = [...allItems];

  if (currentSearch) {
    filtered = filtered.filter((i) => i.name.toLowerCase().includes(currentSearch));
  }

  switch (currentFilter) {
    case 'to-buy':
      filtered = filtered.filter((i) => !i.in_stock);
      break;
    case 'in-stock':
      filtered = filtered.filter((i) => i.in_stock);
      break;
    case 'checked':
      filtered = filtered.filter((i) => i.checked);
      break;
  }

  // Group by category
  const groups = {};
  filtered.forEach((item) => {
    const catName = item.categories?.name || 'Sem Categoria';
    const catIcon = item.categories?.icon || '📦';
    const catOrder = item.categories?.sort_order ?? 999;
    if (!groups[catName]) {
      groups[catName] = { icon: catIcon, order: catOrder, items: [] };
    }
    groups[catName].items.push(item);
  });

  const sortedGroups = Object.entries(groups).sort((a, b) => a[1].order - b[1].order);

  if (sortedGroups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Nenhum item encontrado</h3>
        <p>Adicione itens ou carregue o template nas Configurações.</p>
      </div>
    `;
    updateSummary(filtered);
    updateTotal(filtered);
    return;
  }

  container.innerHTML = sortedGroups.map(([catName, group]) => {
    const catSubtotal = group.items.reduce((sum, item) => {
      return sum + (item.current_price ? item.quantity * item.current_price : 0);
    }, 0);

    return `
      <div class="category-group open" data-category="${catName}">
        <div class="category-header" onclick="this.parentElement.classList.toggle('open')">
          <span class="category-icon">${group.icon}</span>
          <span class="category-name">${catName}</span>
          <span class="category-count">${group.items.length} itens</span>
          ${catSubtotal > 0 ? `<span class="category-subtotal">${formatCurrency(catSubtotal)}</span>` : ''}
          <span class="category-chevron">▼</span>
        </div>
        <div class="category-items">
          ${group.items.map((item) => renderItemRow(item)).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners
  attachItemEvents();
  updateSummary(filtered);
  updateTotal(filtered);
}

function renderItemRow(item) {
  const subtotal = item.current_price ? item.quantity * item.current_price : 0;

  return `
    <div class="item-row ${item.checked ? 'checked-item' : ''}" data-item-id="${item.id}">
      <div class="stock-toggle ${item.in_stock ? 'active' : ''}"
           data-action="toggle-stock"
           data-item-id="${item.id}"
           data-current="${item.in_stock}"
           title="${item.in_stock ? 'Em estoque' : 'Sem estoque'}">
      </div>
      <span class="item-name">${item.name} <span class="item-unit">${item.unit || ''}</span></span>
      <input type="number" class="item-input" value="${item.quantity}"
             data-action="update-qty" data-item-id="${item.id}"
             title="Quantidade" min="0" step="1" style="width:60px;" />
      <input type="number" class="item-input" value="${item.previous_price ?? ''}"
             data-action="update-price" data-field="previous_price" data-item-id="${item.id}"
             placeholder="Ant." title="Valor Anterior" min="0" step="0.01" />
      <input type="number" class="item-input" value="${item.current_price ?? ''}"
             data-action="update-price" data-field="current_price" data-item-id="${item.id}"
             placeholder="Atual" title="Valor Atual" min="0" step="0.01" />
      <span class="item-subtotal">${subtotal > 0 ? formatCurrency(subtotal) : '-'}</span>
      <div class="check-btn ${item.checked ? 'checked' : ''}"
           data-action="toggle-checked"
           data-item-id="${item.id}"
           data-current="${item.checked}"
           title="${item.checked ? 'Visto ✅' : 'Marcar como visto'}">
        ${item.checked ? '✓' : ''}
      </div>
      <div class="item-actions">
        <button class="item-action-btn delete"
                data-action="delete-item"
                data-item-id="${item.id}"
                title="Remover">🗑</button>
      </div>
    </div>
  `;
}

function attachItemEvents() {
  const container = document.getElementById('items-container');

  container.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const itemId = target.dataset.itemId;

    switch (action) {
      case 'toggle-stock':
        await toggleStock(itemId, target.dataset.current === 'true', householdId, userId);
        await loadAndRender();
        break;

      case 'toggle-checked':
        await toggleChecked(itemId, target.dataset.current === 'true', userId);
        await loadAndRender();
        break;

      case 'delete-item':
        if (confirm('Remover este item?')) {
          await deleteItem(itemId);
          await loadAndRender();
        }
        break;
    }
  });

  // Debounced price/qty updates
  const debouncedUpdate = debounce(async (input) => {
    const action = input.dataset.action;
    const itemId = input.dataset.itemId;

    if (action === 'update-price') {
      await updateItemPrice(itemId, input.dataset.field, input.value, householdId, userId);
      await loadAndRender();
    } else if (action === 'update-qty') {
      await updateItemQuantity(itemId, input.value);
      await loadAndRender();
    }
  }, 600);

  container.addEventListener('input', (e) => {
    if (e.target.matches('[data-action="update-price"], [data-action="update-qty"]')) {
      debouncedUpdate(e.target);
    }
  });
}

function updateSummary(items) {
  const summary = document.getElementById('list-summary');
  const total = items.length;
  const inStock = items.filter((i) => i.in_stock).length;
  const toBuy = items.filter((i) => !i.in_stock).length;
  const checked = items.filter((i) => i.checked).length;

  summary.innerHTML = `
    <div class="summary-item">
      <span class="summary-value">${total}</span>
      <span class="summary-label">Total</span>
    </div>
    <div class="summary-item">
      <span class="summary-value" style="color: var(--green);">${inStock}</span>
      <span class="summary-label">Em Estoque</span>
    </div>
    <div class="summary-item">
      <span class="summary-value" style="color: var(--amber);">${toBuy}</span>
      <span class="summary-label">A Comprar</span>
    </div>
    <div class="summary-item">
      <span class="summary-value" style="color: var(--cyan);">${checked}</span>
      <span class="summary-label">Já Vistos</span>
    </div>
  `;
}

function updateTotal(items) {
  const total = items.reduce((sum, item) => {
    if (item.current_price) {
      return sum + item.quantity * item.current_price;
    }
    return sum;
  }, 0);

  document.getElementById('total-value').textContent = formatCurrency(total);
}

/**
 * Show modal to add new item
 */
function showAddItemModal() {
  const modal = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const footer = document.getElementById('modal-footer');

  title.textContent = 'Novo Item';

  const categoryOptions = allCategories
    .map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`)
    .join('');

  body.innerHTML = `
    <div class="form-group">
      <label>Categoria</label>
      <select id="new-item-category">
        ${categoryOptions}
      </select>
    </div>
    <div class="form-group">
      <label>Nome do Item</label>
      <input type="text" id="new-item-name" placeholder="Ex: Arroz" required />
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="form-group">
        <label>Quantidade</label>
        <input type="number" id="new-item-qty" value="1" min="1" />
      </div>
      <div class="form-group">
        <label>Unidade</label>
        <input type="text" id="new-item-unit" placeholder="Kg, Pct, Un..." />
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
    <button class="btn btn-primary" id="modal-confirm">Adicionar</button>
  `;

  modal.classList.add('open');

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.getElementById('modal-confirm').addEventListener('click', async () => {
    const name = document.getElementById('new-item-name').value.trim();
    const categoryId = document.getElementById('new-item-category').value;
    const qty = document.getElementById('new-item-qty').value;
    const unit = document.getElementById('new-item-unit').value.trim();

    if (!name) return;

    await addItem(householdId, categoryId, name, parseFloat(qty), unit);
    closeModal();
    await loadAndRender();
  });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

/**
 * Update data from outside (realtime)
 */
export function updateItems(newItems) {
  allItems = newItems;
  renderList();
}
