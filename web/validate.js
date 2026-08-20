(function () {
  const WEBHOOK_URL = 'https://automate.libraudit.tech/webhook/fc-price-validate';
  let diffData = [];
  let selectedSet = new Set();

  const params = new URLSearchParams(window.location.search);
  const sessionToken = params.get('token') || '';

  async function init() {
    if (!sessionToken) {
      showStatus('error', 'Missing session token. Open this page from the notification link.');
      return;
    }

    try {
      const resp = await fetch(`https://automate.libraudit.tech/webhook/fc-price-data?token=${sessionToken}`);
      if (!resp.ok) throw new Error('Failed to load price data');
      const payload = await resp.json();
      diffData = payload.diff || [];
      document.getElementById('subtitle').textContent =
        `${payload.supplier} — ${payload.matched} products matched — ${new Date().toLocaleDateString('en-AU')}`;
      document.getElementById('sumSupplier').textContent = payload.supplier;
      document.getElementById('sumTotal').textContent = diffData.length;
      renderTable(diffData);
    } catch (e) {
      showStatus('error', 'Could not load price data: ' + e.message);
    }
  }

  function renderTable(items) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    items.forEach((item, idx) => {
      const pct = parseFloat(item.ecart) || 0;
      const cls = pct > 0 ? 'price-up' : pct < 0 ? 'price-down' : 'price-same';
      const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '=';
      const tr = document.createElement('tr');
      tr.dataset.idx = idx;
      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" class="row-check" data-idx="${idx}"></td>
        <td class="col-sku">${esc(item.sku)}</td>
        <td class="col-ref">${esc(item.ref)}</td>
        <td class="col-name">${esc(item.nom)}</td>
        <td class="col-collection">${esc(item.collection)}</td>
        <td class="col-price old">${item.old.prixAchatHT.toFixed(2)}</td>
        <td class="col-price new">${item.new.prixAchatHT.toFixed(2)}</td>
        <td class="col-change ${cls}">${arrow}${Math.abs(pct)}%</td>
        <td class="col-price aud">${item.new.prixAfficheAUD}</td>
        <td class="col-price aud">${item.new.prixGSTAUD}</td>
        <td class="col-override"><input type="number" class="override-input" data-idx="${idx}" value="${item.new.prixAfficheAUD}" step="1" min="0"></td>
      `;
      tbody.appendChild(tr);
    });
    updateSummary();
  }

  function updateSummary() {
    const count = selectedSet.size;
    document.getElementById('sumSelected').textContent = count;
    document.getElementById('btnValidate').disabled = count === 0;

    if (count > 0) {
      const selected = [...selectedSet].map(i => diffData[i]);
      const avg = selected.reduce((s, d) => s + parseFloat(d.ecart || 0), 0) / selected.length;
      document.getElementById('sumAvgChange').textContent = (avg >= 0 ? '+' : '') + avg.toFixed(1) + '%';
    } else {
      document.getElementById('sumAvgChange').textContent = '—';
    }
  }

  function toggleRow(idx, checked) {
    if (checked) { selectedSet.add(idx); } else { selectedSet.delete(idx); }
    const tr = document.querySelector(`tr[data-idx="${idx}"]`);
    if (tr) tr.classList.toggle('selected', checked);
    updateSummary();
  }

  document.getElementById('tableBody').addEventListener('change', function (e) {
    if (e.target.classList.contains('row-check')) {
      toggleRow(parseInt(e.target.dataset.idx), e.target.checked);
    }
  });

  document.getElementById('checkAll').addEventListener('change', function (e) {
    document.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = e.target.checked;
      toggleRow(parseInt(cb.dataset.idx), e.target.checked);
    });
  });

  document.getElementById('btnSelectAll').addEventListener('click', function () {
    document.querySelectorAll('.row-check').forEach(cb => { cb.checked = true; toggleRow(parseInt(cb.dataset.idx), true); });
  });

  document.getElementById('btnDeselectAll').addEventListener('click', function () {
    document.querySelectorAll('.row-check').forEach(cb => { cb.checked = false; toggleRow(parseInt(cb.dataset.idx), false); });
  });

  document.getElementById('btnSelectUp').addEventListener('click', function () {
    diffData.forEach((d, i) => {
      const up = parseFloat(d.ecart) > 0;
      const cb = document.querySelector(`.row-check[data-idx="${i}"]`);
      if (cb) { cb.checked = up; toggleRow(i, up); }
    });
  });

  document.getElementById('btnSelectDown').addEventListener('click', function () {
    diffData.forEach((d, i) => {
      const down = parseFloat(d.ecard) < 0;
      const cb = document.querySelector(`.row-check[data-idx="${i}"]`);
      if (cb) { cb.checked = down; toggleRow(i, down); }
    });
  });

  document.getElementById('searchInput').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('#tableBody tr').forEach(tr => {
      const idx = parseInt(tr.dataset.idx);
      const item = diffData[idx];
      const match = !q || item.sku.toLowerCase().includes(q) || item.ref.toLowerCase().includes(q) || item.nom.toLowerCase().includes(q);
      tr.style.display = match ? '' : 'none';
    });
  });

  document.getElementById('btnValidate').addEventListener('click', async function () {
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Sending...';

    const validated = [...selectedSet].map(idx => {
      const overrideInput = document.querySelector(`.override-input[data-idx="${idx}"]`);
      const overrideAUD = overrideInput ? parseFloat(overrideInput.value) : null;
      return {
        sku: diffData[idx].sku,
        ref: diffData[idx].ref,
        newPrixAchatHT: diffData[idx].new.prixAchatHT,
        prixAfficheAUD: overrideAUD || diffData[idx].new.prixAfficheAUD,
        approved: true
      };
    });

    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: sessionToken, items: validated })
      });
      if (!resp.ok) throw new Error('Server error');
      showStatus('success', `${validated.length} prices validated and updated successfully.`);
      btn.textContent = 'Validated ✓';
    } catch (e) {
      showStatus('error', 'Validation failed: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'Validate selected prices';
    }
  });

  document.getElementById('btnExport').addEventListener('click', function () {
    const rows = [['SKU', 'Ref', 'Product', 'Old Buy EUR', 'New Buy EUR', 'Change %', 'Sell AUD', 'GST AUD', 'Override AUD']];
    diffData.forEach(d => {
      rows.push([d.sku, d.ref, d.nom, d.old.prixAchatHT, d.new.prixAchatHT, d.ecart, d.new.prixAfficheAUD, d.new.prixGSTAUD, d.new.prixAfficheAUD]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fc-price-update-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  });

  function showStatus(type, msg) {
    const el = document.getElementById('statusMsg');
    el.className = 'status-msg ' + type;
    el.textContent = msg;
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  init();
})();
