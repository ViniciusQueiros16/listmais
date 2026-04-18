import { supabase } from './supabase.js';
import { formatCurrency } from './utils.js';

/**
 * Render dashboard page
 */
export async function renderDashboard(householdId) {
  const [itemsResult, purchasesResult] = await Promise.all([
    supabase
      .from('items')
      .select('*, categories(name, icon)')
      .eq('household_id', householdId),
    supabase
      .from('purchases')
      .select('*')
      .eq('household_id', householdId)
      .order('finalized_at', { ascending: false })
      .limit(5),
  ]);

  const items = itemsResult.data || [];
  const purchases = purchasesResult.data || [];

  const totalItems = items.length;
  const inStock = items.filter((i) => i.in_stock).length;
  const toBuy = items.filter((i) => !i.in_stock).length;

  // Calculate total estimated
  const totalEstimated = items.reduce((sum, item) => {
    if (!item.in_stock && item.current_price) {
      return sum + item.quantity * item.current_price;
    }
    return sum;
  }, 0);

  // Last purchase total
  const lastPurchaseTotal = purchases.length > 0 ? purchases[0].total : 0;
  const priceDiff = totalEstimated && lastPurchaseTotal
    ? ((totalEstimated - lastPurchaseTotal) / lastPurchaseTotal * 100).toFixed(1)
    : null;

  // Stats cards
  const statsGrid = document.getElementById('stats-grid');
  statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">📦</div>
      <div class="stat-value">${totalItems}</div>
      <div class="stat-label">Total de Itens</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">✅</div>
      <div class="stat-value">${inStock}</div>
      <div class="stat-label">Em Estoque</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🛒</div>
      <div class="stat-value">${toBuy}</div>
      <div class="stat-label">A Comprar</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">💰</div>
      <div class="stat-value">${formatCurrency(totalEstimated)}</div>
      <div class="stat-label">Estimativa da Compra</div>
      ${priceDiff !== null ? `
        <div class="stat-change ${parseFloat(priceDiff) > 0 ? 'up' : 'down'}">
          ${parseFloat(priceDiff) > 0 ? '↑' : '↓'} ${Math.abs(priceDiff)}% vs última
        </div>
      ` : ''}
    </div>
  `;

  // Category chart
  renderCategoryChart(items);

  // Activity - show recent purchases
  renderActivity(purchases);
}

function renderCategoryChart(items) {
  const chart = document.getElementById('category-chart');

  // Group by category
  const categories = {};
  items.forEach((item) => {
    const catName = item.categories?.name || 'Sem Categoria';
    if (!categories[catName]) {
      categories[catName] = { total: 0, icon: item.categories?.icon || '📦' };
    }
    if (item.current_price) {
      categories[catName].total += item.quantity * item.current_price;
    }
  });

  const entries = Object.entries(categories).sort((a, b) => b[1].total - a[1].total);
  const maxTotal = Math.max(...entries.map(([, v]) => v.total), 1);

  if (entries.length === 0 || maxTotal === 0) {
    chart.innerHTML = `
      <div class="empty-state" style="padding: 30px 0;">
        <div class="empty-state-icon">📊</div>
        <p>Adicione preços aos itens para ver o gráfico</p>
      </div>
    `;
    return;
  }

  chart.innerHTML = entries
    .filter(([, v]) => v.total > 0)
    .map(([name, val]) => {
      const pct = (val.total / maxTotal) * 100;
      return `
        <div class="chart-bar">
          <span class="chart-bar-label">${val.icon} ${name}</span>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width: ${pct}%">
              <span class="chart-bar-value">${formatCurrency(val.total)}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderActivity(purchases) {
  const list = document.getElementById('activity-list');

  if (purchases.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding: 20px 0;">
        <div class="empty-state-icon">📝</div>
        <p>Nenhuma atividade ainda</p>
      </div>
    `;
    return;
  }

  list.innerHTML = purchases.map((p) => `
    <div class="activity-item">
      <div class="activity-icon">🛒</div>
      <div>
        <div class="activity-text">
          Compra finalizada — <strong>${formatCurrency(p.total)}</strong> (${p.items_count} itens)
        </div>
        <div class="activity-time">${new Date(p.finalized_at).toLocaleDateString('pt-BR')}</div>
      </div>
    </div>
  `).join('');
}
