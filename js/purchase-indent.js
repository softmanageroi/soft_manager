document.addEventListener('DOMContentLoaded', function () {
    const requiredIds = ['piListView', 'piFormView', 'piNewBtn', 'piListBody', 'piCount', 'piVoucherNo', 'piDate', 'piLinesBody', 'piSaveBtn', 'piCancelBtn', 'piMessage', 'piAddRowBtn', 'piListSearch'];
    const elements = {};
    requiredIds.forEach((id) => {
        elements[id] = document.getElementById(id);
        if (!elements[id]) console.warn(`Purchase Indent: missing #${id}`);
    });
    if (requiredIds.some((id) => !elements[id])) return;

    const esc = IMS.esc;
    const baseRowCount = 3;
    let editingPiId = null;
    const requestedByField = document.getElementById('piRequestedBy');
    IMS.setEmployeeOptions(requestedByField);

    function message(text, error) {
        elements.piMessage.textContent = text;
        elements.piMessage.style.color = error ? 'var(--status-red-text)' : 'var(--erp-text-muted)';
    }

    function renderList(filter = '') {
        const vouchers = IMS.piAll().slice().reverse();
        const filtered = vouchers.filter(pi => 
            pi.no.toLowerCase().includes(filter.toLowerCase()) || 
            (pi.requestedBy || '').toLowerCase().includes(filter.toLowerCase())
        );

        elements.piListBody.innerHTML = filtered.length ? filtered.map((pi, index) => `
            <tr data-open-pi="${esc(pi.id)}" style="cursor:pointer">
                <td>${vouchers.length - index}</td>
                <td>${esc(IMS.fmtDate(pi.date))}</td>
                <td><strong>${esc(pi.no)}</strong></td>
                <td>${esc(pi.requestedBy || 'N/A')}</td>
                <td>${Number((pi.lines || []).length)}</td>
                <td>${esc(pi.linkStatus || IMS.piStatus(pi))}</td>
                <td style="text-align:center">
                    <button class="btn-secondary" style="padding: 4px 12px; font-size: 12px;" type="button" data-open-pi-button="${esc(pi.id)}">Open</button>
                </td>
            </tr>`).join('') : '<tr><td colspan="7" style="text-align:center; padding: 20px;">No purchase indent records found.</td></tr>';
        elements.piCount.textContent = String(filtered.length);
    }

    function renderEmptyRow(index) {
        return `<tr class="line-row">
            <td style="text-align:center">${index + 1}</td>
            <td>
                <input data-line-item type="text" list="piItemOptions" placeholder="Search Item..." autocomplete="off" style="width:100%; border:none; background:transparent; outline:none;">
                <datalist id="piItemOptions">${IMS.items().map(i => `<option value="${esc(i.name)}">`).join('')}</datalist>
            </td>
            <td data-line-unit style="text-align:center">—</td>
            <td><input data-line-qty type="number" min="0.01" step="any" placeholder="0.00" style="width:100%; border:none; background:transparent; outline:none; text-align:right;"></td>
            <td style="text-align:right"><output data-line-stock aria-label="Current stock" aria-readonly="true">0</output></td>
        </tr>`;
    }

    function renderRows(count = baseRowCount) {
        elements.piLinesBody.innerHTML = Array.from({ length: count }, (_, index) => renderEmptyRow(index)).join('');
        updateRowNumbers();
    }

    function updateRowNumbers() {
        [...elements.piLinesBody.querySelectorAll('tr')].forEach((row, i) => {
            row.cells[0].textContent = i + 1;
        });
    }

    function fillItemDetails(row) {
        const input = row.querySelector('[data-line-item]');
        const val = input.value.trim().toLowerCase();
        const item = IMS.items().find(i => i.name.toLowerCase() === val || i.code.toLowerCase() === val);
        
        if (item) {
            input.value = item.name;
            row.dataset.itemCode = item.code;
            row.querySelector('[data-line-unit]').textContent = item.unit;
            row.querySelector('[data-line-stock]').textContent = String(item.stock);
            message('', false);
        } else {
            row.dataset.itemCode = '';
            row.querySelector('[data-line-unit]').textContent = '—';
            row.querySelector('[data-line-stock]').textContent = '0';
        }
    }

    function openForm(piId = null) {
        editingPiId = piId;
        document.getElementById('piFormTitle').textContent = piId ? 'Edit Purchase Indent' : 'Create Purchase Indent';
        elements.piDate.value = IMS.todayISO();
        elements.piVoucherNo.value = IMS.peekNo('PIU', elements.piDate.value);
        document.getElementById('piLocation').value = 'Office';
        document.getElementById('piNarration').value = '';
        
        if (piId) {
            const pi = IMS.piAll().find(p => String(p.id) === String(piId));
            if (pi) {
                elements.piDate.value = pi.date;
                elements.piVoucherNo.value = pi.no;
                document.getElementById('piLocation').value = pi.location || 'Office';
                document.getElementById('piNarration').value = pi.narration || '';
                IMS.setEmployeeOptions(requestedByField, pi.requestedBy);
                
                renderRows(Math.max(baseRowCount, pi.lines.length));
                pi.lines.forEach((line, i) => {
                    const row = elements.piLinesBody.rows[i];
                    const input = row.querySelector('[data-line-item]');
                    input.value = line.name;
                    row.dataset.itemCode = line.code;
                    row.querySelector('[data-line-unit]').textContent = line.unit;
                    const master = IMS.items().find(item => item.code === line.code);
                    row.querySelector('[data-line-stock]').textContent = String(master?.stock ?? line.stock);
                    row.querySelector('[data-line-qty]').value = line.qty;
                });
            }
        } else {
            IMS.setEmployeeOptions(requestedByField, '');
            renderRows();
        }

        elements.piListView.hidden = true;
        elements.piFormView.hidden = false;
        elements.piFormView.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    function saveIndent() {
        if (!elements.piDate.value) return message('Please select a date.', true);

        try {
            const lines = [];
            const rows = [...elements.piLinesBody.querySelectorAll('tr')];

            for (const row of rows) {
                const itemCode = row.dataset.itemCode;
                const qty = parseFloat(row.querySelector('[data-line-qty]').value);
                if (!itemCode || isNaN(qty) || qty <= 0) continue;

                const item = IMS.items().find(i => i.code === itemCode);
                if (!item) continue;
                lines.push({
                    code: itemCode,
                    name: item.name,
                    unit: item.unit,
                    qty: qty,
                    stock: item.stock
                });
            }

            if (lines.length === 0) return message('Please add at least one valid item with quantity.', true);

            const piList = IMS.piAll();
            const existingIndex = editingPiId
                ? piList.findIndex((pi) => String(pi.id) === String(editingPiId))
                : -1;
            if (editingPiId && existingIndex < 0) {
                return message('This purchase indent no longer exists. Refresh the list and try again.', true);
            }
            const existing = existingIndex >= 0 ? piList[existingIndex] : null;
            const data = {
                ...(existing || {}),
                id: existing?.id || IMS.uid(),
                no: existing?.no || IMS.nextNo('PIU', elements.piDate.value),
                date: elements.piDate.value,
                location: document.getElementById('piLocation').value,
                requestedBy: requestedByField.value,
                narration: document.getElementById('piNarration').value,
                lines,
                status: existing?.status || 'Pending'
            };

            if (existingIndex >= 0) piList[existingIndex] = data;
            else piList.push(data);
            IMS.piSave(piList);
            elements.piVoucherNo.value = data.no;
            message('Purchase Indent saved successfully!', false);
            setTimeout(closeForm, 1000);
        } catch (error) {
            console.error('Could not save purchase indent.', error);
            message(`Could not save purchase indent: ${error.message}`, true);
        }
    }

    function closeForm() {
        elements.piFormView.hidden = true;
        elements.piListView.hidden = false;
        renderList();
    }

    // Listeners
    elements.piNewBtn.addEventListener('click', () => openForm());
    elements.piCancelBtn.addEventListener('click', closeForm);
    elements.piSaveBtn.addEventListener('click', saveIndent);
    elements.piAddRowBtn.addEventListener('click', () => {
        elements.piLinesBody.insertAdjacentHTML('beforeend', renderEmptyRow(elements.piLinesBody.rows.length));
    });

    elements.piListBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-open-pi-button]');
        if (btn) openForm(btn.dataset.openPiButton);
    });

    elements.piListBody.addEventListener('dblclick', (e) => {
        const row = e.target.closest('[data-open-pi]');
        if (row) openForm(row.dataset.openPi);
    });

    elements.piListSearch.addEventListener('input', (e) => renderList(e.target.value));

    elements.piLinesBody.addEventListener('input', (e) => {
        if (e.target.matches('[data-line-item]')) {
            fillItemDetails(e.target.closest('tr'));
        }
    });
    elements.piDate.addEventListener('change', () => {
        if (!editingPiId && elements.piDate.value) {
            elements.piVoucherNo.value = data.no;
        }
    });

    renderList();
    if (new URLSearchParams(window.location.search).get('view') === 'new') {
        sessionStorage.removeItem('softManagerPendingNavigation');
        openForm();
    }
});
