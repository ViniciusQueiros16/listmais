import { supabase } from './supabase.js';
import { formatCurrency, formatDate, formatDateShort } from './utils.js';

/**
 * Render history page
 */
export async function renderHistory(householdId) {
  const { data: purchases } = await supabase
    .from('purchases')
    .select('*')
    .eq('household_id', householdId)
    .order('finalized_at', { ascending: false });

  if (!purchases || purchases.length === 0) {
    document.getElementById('purchase-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛒</div>
        <h3>Nenhuma compra finalizada</h3>
        <p>Quando você finalizar uma compra, ela aparecerá aqui com todos os detalhes.</p>
      </div>
    `;
    document.getElementById('history-chart').innerHTML = `
      <div class="empty-state" style="padding: 20px 0;">
        <div class="empty-state-icon">📊</div>
        <p>Finalize compras para ver o gráfico</p>
      </div>
    `;
    return;
  }

  renderChart(purchases);
  renderPurchaseList(purchases, householdId);
}

function renderChart(purchases) {
  const chart = document.getElementById('history-chart');
  const recent = purchases.slice(0, 12).reverse(); // Last 12 purchases
  const maxTotal = Math.max(...recent.map((p) => p.total || 0), 1);

  chart.innerHTML = recent.map((p) => {
    const height = Math.max(((p.total || 0) / maxTotal) * 160, 4);
    return `
      <div class="history-bar-wrapper">
        <div class="history-bar-value">${formatCurrency(p.total || 0)}</div>
        <div class="history-bar" style="height: ${height}px"></div>
        <div class="history-bar-label">${formatDateShort(p.finalized_at)}</div>
      </div>
    `;
  }).join('');
}

async function renderPurchaseList(purchases, householdId) {
  const list = document.getElementById('purchase-list');

  list.innerHTML = purchases.map((p) => `
    <div class="purchase-card" data-purchase-id="${p.id}">
      <div class="purchase-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="purchase-date">${formatDate(p.finalized_at)}</span>
        <div class="purchase-meta">
          <span class="purchase-count">${p.items_count} itens</span>
          <span class="purchase-total">${formatCurrency(p.total)}</span>
        </div>
      </div>
      <div class="purchase-details" data-details-for="${p.id}">
        <div style="padding: 10px 20px; color: var(--text-tertiary); font-size: 0.8rem;">
          Carregando...
        </div>
      </div>
    </div>
  `).join('');

  // Lazy load details on expand
  list.addEventListener('click', async (e) => {
    const card = e.target.closest('.purchase-card');
    if (!card) return;

    const purchaseId = card.dataset.purchaseId;
    const detailsDiv = card.querySelector(`[data-details-for="${purchaseId}"]`);

    // Only load once
    if (detailsDiv.dataset.loaded) return;

    const { data: items } = await supabase
      .from('purchase_items')
      .select('*')
      .eq('purchase_id', purchaseId)
      .order('category_name');

    if (items && items.length > 0) {
      detailsDiv.innerHTML = items.map((item) => `
        <div class="purchase-item-row">
          <span class="purchase-item-name">
            ${item.item_name}
            <span style="color: var(--text-tertiary); font-size: 0.7rem;">
              ${item.quantity} ${item.unit || ''}
            </span>
          </span>
          <span class="purchase-item-price">
            ${item.price ? formatCurrency(item.subtotal) : '-'}
          </span>
        </div>
      `).join('');
    } else {
      detailsDiv.innerHTML = `
        <div style="padding: 10px 20px; color: var(--text-tertiary); font-size: 0.8rem;">
          Sem detalhes disponíveis
        </div>
      `;
    }

    detailsDiv.dataset.loaded = 'true';
  });
}

/**
 * Export data as JSON
 */
export async function exportData(householdId) {
  const [items, categories, purchases, purchaseItems] = await Promise.all([
    supabase.from('items').select('*').eq('household_id', householdId),
    supabase.from('categories').select('*').eq('household_id', householdId),
    supabase.from('purchases').select('*').eq('household_id', householdId),
    supabase.from('purchase_items').select('*, purchases!inner(household_id)').eq('purchases.household_id', householdId),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    categories: categories.data || [],
    items: items.data || [],
    purchases: purchases.data || [],
    purchaseItems: purchaseItems.data || [],
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `listmais-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
