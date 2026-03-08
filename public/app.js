(() => {
  'use strict';

  // ── DOM references ──

  const $ = (sel) => document.querySelector(sel);
  const statusBadge = $('#statusBadge');
  const statusText = statusBadge.querySelector('.status-text');
  const toggleBtn = $('#toggleBot');
  const pairLabel = $('#pairLabel');
  const priceEl = $('#currentPrice');
  const atrEl = $('#atrValue');
  const lastUpdateEl = $('#lastUpdate');
  const balEurEl = $('#balanceEur');
  const balBtcEl = $('#balanceBtc');
  const portfolioEl = $('#portfolioValue');
  const pnlEl = $('#totalPnl');
  const feesEl = $('#totalFees');
  const gridViz = $('#gridViz');
  const ordersList = $('#ordersList');
  const orderCount = $('#orderCount');
  const tradesList = $('#tradesList');
  const tradeCount = $('#tradeCount');
  const cfgLevels = $('#cfgLevels');
  const cfgRange = $('#cfgRange');
  const cfgInterval = $('#cfgInterval');
  const cfgOrderSize = $('#cfgOrderSize');
  const cfgUptime = $('#cfgUptime');
  const wsIndicator = $('#wsIndicator');

  let botRunning = false;
  let lastPrice = 0;
  let ws = null;
  let eurUsdRate = null;

  // ── Formatting helpers ──

  function fmtEur(n) {
    return '€' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtBtc(n) {
    return Number(n).toFixed(8);
  }

  function fmtTime(date) {
    if (!date) return '--:--:--';
    const d = new Date(date);
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function fmtDuration(ms) {
    if (!ms || ms <= 0) return '--';
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hrs = Math.floor(min / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ${hrs % 24}h ${min % 60}m`;
    if (hrs > 0) return `${hrs}h ${min % 60}m`;
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
  }

  // ── Update UI from status data ──

  function updateUI(data) {
    if (!data) return;

    // Status badge
    botRunning = data.isRunning;
    if (botRunning) {
      statusBadge.classList.add('running');
      statusText.textContent = 'RUNNING';
      toggleBtn.textContent = 'PAUSE';
      toggleBtn.classList.add('active');
    } else {
      statusBadge.classList.remove('running');
      statusText.textContent = 'OFFLINE';
      toggleBtn.textContent = 'START';
      toggleBtn.classList.remove('active');
    }

    // Price
    pairLabel.textContent = data.pair || 'BTC-EUR';
    if (data.currentPrice > 0) {
      const newPrice = data.currentPrice;
      priceEl.textContent = fmtEur(newPrice).replace('€', '');

      priceEl.classList.remove('up', 'down');
      if (lastPrice > 0) {
        if (newPrice > lastPrice) priceEl.classList.add('up');
        else if (newPrice < lastPrice) priceEl.classList.add('down');
        setTimeout(() => priceEl.classList.remove('up', 'down'), 1500);
      }
      lastPrice = newPrice;

      const priceUsdEl = $('#priceUsd');
      if (eurUsdRate && newPrice > 0) {
        const usd = newPrice * eurUsdRate;
        priceUsdEl.textContent = '≈ $' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }

    atrEl.textContent = data.grid?.atr > 0 ? fmtEur(data.grid.atr) : '--';
    lastUpdateEl.textContent = fmtTime(data.lastGridUpdate);

    // Portfolio
    balEurEl.textContent = fmtEur(data.balanceEur);
    balBtcEl.textContent = fmtBtc(data.balanceBtc);
    portfolioEl.textContent = fmtEur(data.portfolioValue);

    const pnl = data.totalPnl || 0;
    pnlEl.textContent = (pnl >= 0 ? '+' : '') + fmtEur(pnl);
    pnlEl.classList.remove('positive', 'negative');
    if (pnl > 0) pnlEl.classList.add('positive');
    else if (pnl < 0) pnlEl.classList.add('negative');

    feesEl.textContent = fmtEur(data.totalFees || 0);

    // Grid visualization
    renderGrid(data);

    // Orders
    renderOrders(data.openOrders || []);

    // Trades
    renderTrades(data.trades || []);

    // Config
    cfgLevels.textContent = data.grid?.levels ?? '--';
    cfgRange.textContent = data.grid?.low > 0
      ? `${fmtEur(data.grid.low)} — ${fmtEur(data.grid.high)}`
      : '-- — --';
    cfgInterval.textContent = data.grid?.interval > 0 ? fmtEur(data.grid.interval) : '--';
    cfgOrderSize.textContent = '€5 / level';
    cfgUptime.textContent = fmtDuration(data.uptime);

    // P&L Chart
    renderPnlChart(data.pnlHistory || []);
  }

  // ── P&L Chart ──

  let pnlChart = null;

  function renderPnlChart(history) {
    const canvas = $('#pnlChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = history.map(p => new Date(p.t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }));
    const values = history.map(p => p.pnl);

    if (pnlChart) {
      pnlChart.data.labels = labels;
      pnlChart.data.datasets[0].data = values;
      pnlChart.update('none');
      return;
    }

    pnlChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'P&L (€)',
          data: values,
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { color: 'rgba(26, 26, 46, 0.5)' },
            ticks: { color: '#6a6a8a', maxTicksLimit: 8 },
          },
          y: {
            grid: { color: 'rgba(26, 26, 46, 0.5)' },
            ticks: {
              color: '#6a6a8a',
              callback: v => '€' + v,
            },
          },
        },
      },
    });
  }

  // ── Grid visualization ──

  function renderGrid(data) {
    if (!data.grid || data.grid.low <= 0 || !data.openOrders) {
      gridViz.innerHTML = '<div class="grid-empty">Waiting for grid initialization...</div>';
      return;
    }

    const { low, high, interval } = data.grid;
    const currentPrice = data.currentPrice;
    const orders = data.openOrders || [];

    const levels = [];
    const numSteps = Math.round((high - low) / interval);

    for (let i = numSteps; i >= 0; i--) {
      const price = low + i * interval;
      const side = price < currentPrice ? 'buy' : 'sell';
      const isCurrentPrice = Math.abs(price - currentPrice) < interval * 0.5;
      const hasOrder = orders.some(o => Math.abs(o.price - price) < interval * 0.3);
      const distFromPrice = Math.abs(price - currentPrice) / (high - low);
      const barWidth = Math.max(10, (1 - distFromPrice) * 80);

      levels.push({ price, side, isCurrentPrice, hasOrder, barWidth });
    }

    gridViz.innerHTML = levels.map(l => {
      const cls = l.isCurrentPrice ? 'current-price' : l.side;
      const sideLabel = l.isCurrentPrice ? '▸ NOW' : l.side.toUpperCase();
      const opacity = l.hasOrder ? '0.25' : '0.08';

      return `
        <div class="grid-level ${cls}">
          <div class="level-bar" style="width: ${l.barWidth}%; opacity: ${opacity}"></div>
          <span class="level-side">${sideLabel}</span>
          <span class="level-price">${fmtEur(l.price)}</span>
        </div>
      `;
    }).join('');
  }

  // ── Orders list ──

  function renderOrders(orders) {
    orderCount.textContent = orders.length;

    if (orders.length === 0) {
      ordersList.innerHTML = '<div class="empty-state">No active orders</div>';
      return;
    }

    const sorted = [...orders].sort((a, b) => b.price - a.price);
    ordersList.innerHTML = sorted.map(o => `
      <div class="order-row">
        <span class="order-side ${o.side}">${o.side.toUpperCase()}</span>
        <span class="order-price">${fmtEur(o.price)}</span>
        <span class="order-amount">${fmtBtc(o.amountBtc)} BTC</span>
      </div>
    `).join('');
  }

  // ── Trades list ──

  function renderTrades(trades) {
    tradeCount.textContent = trades.length;

    if (trades.length === 0) {
      tradesList.innerHTML = '<div class="empty-state">No trades executed yet</div>';
      return;
    }

    tradesList.innerHTML = trades.map(t => {
      const profitCls = t.profitEur >= 0 ? 'positive' : 'negative';
      const prefix = t.profitEur >= 0 ? '+' : '';
      return `
        <div class="trade-row">
          <span class="trade-prices">${fmtEur(t.buyPrice)} → ${fmtEur(t.sellPrice)}</span>
          <span class="trade-fee">-${fmtEur(t.feesEur || 0)}</span>
          <span class="trade-profit ${profitCls}">${prefix}${fmtEur(t.profitEur)}</span>
          <span class="trade-time">${fmtTime(t.timestamp)}</span>
        </div>
      `;
    }).join('');
  }

  // ── WebSocket connection ──

  function connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
      wsIndicator.textContent = '● WS CONNECTED';
      wsIndicator.classList.add('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'status') {
          updateUI(msg.data);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      wsIndicator.textContent = '● WS DISCONNECTED';
      wsIndicator.classList.remove('connected');
      setTimeout(connectWS, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  // ── Bot control ──

  toggleBtn.addEventListener('click', async () => {
    toggleBtn.disabled = true;
    toggleBtn.textContent = '...';

    try {
      const endpoint = botRunning ? '/api/bot/stop' : '/api/bot/start';
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();

      if (!data.success) {
        console.error('Bot control failed:', data.message);
      }
    } catch (err) {
      console.error('Request failed:', err);
    } finally {
      toggleBtn.disabled = false;
    }
  });

  const resetBtn = $('#resetBot');
  resetBtn.addEventListener('click', async () => {
    if (!confirm('Weet je het zeker? Dit wist alle trades, orders en balans en start opnieuw.')) return;

    resetBtn.disabled = true;
    resetBtn.textContent = '...';

    try {
      const res = await fetch('/api/bot/reset', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        resetBtn.textContent = 'DONE';
        const statusRes = await fetch('/api/status');
        const statusData = await statusRes.json();
        updateUI(statusData);
        setTimeout(() => { resetBtn.textContent = 'RESET'; resetBtn.disabled = false; }, 2000);
      } else {
        alert('Reset mislukt: ' + (data.message || 'Onbekende fout'));
        resetBtn.textContent = 'RESET';
        resetBtn.disabled = false;
      }
    } catch (err) {
      alert('Reset mislukt — geen verbinding');
      resetBtn.textContent = 'RESET';
      resetBtn.disabled = false;
    }
  });

  // ── Initial load ──

  async function init() {
    try {
      const res = await fetch('/api/status');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      updateUI(data);

    } catch { /* server not ready yet */ }

    connectWS();
  }

  // ── Tooltip positioning ──

  function initTooltips() {
    document.querySelectorAll('.info-tip').forEach((tip) => {
      const text = tip.querySelector('.tip-text');
      if (!text) return;

      tip.addEventListener('mouseenter', () => {
        const rect = tip.getBoundingClientRect();
        const pad = 10;

        text.style.left = '';
        text.style.right = '';
        text.style.top = '';
        text.style.bottom = '';

        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;

        if (spaceAbove > 100) {
          text.style.bottom = (window.innerHeight - rect.top + pad) + 'px';
        } else {
          text.style.top = (rect.bottom + pad) + 'px';
        }

        text.classList.add('visible');

        requestAnimationFrame(() => {
          const tipRect = text.getBoundingClientRect();
          let left = rect.left + rect.width / 2 - tipRect.width / 2;

          if (left < pad) left = pad;
          if (left + tipRect.width > window.innerWidth - pad) {
            left = window.innerWidth - tipRect.width - pad;
          }

          text.style.left = left + 'px';
        });
      });

      tip.addEventListener('mouseleave', () => {
        text.classList.remove('visible');
      });
    });
  }

  initTooltips();

  async function fetchEurUsdRate() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/EUR');
      const data = await res.json();
      if (data.rates?.USD) {
        eurUsdRate = data.rates.USD;
      }
    } catch { /* exchange rate API unavailable, USD price just won't show */ }
  }

  fetchEurUsdRate();
  setInterval(fetchEurUsdRate, 10 * 60 * 1000);

  init();
})();
