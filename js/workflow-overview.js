document.addEventListener('DOMContentLoaded', () => {
  const overview = document.querySelector('[data-workflow-overview]');
  if (!overview || !window.IMS) return;

  const primaryValue = overview.querySelector('[data-overview-primary]');
  const secondaryValue = overview.querySelector('[data-overview-secondary]');
  if (!primaryValue || !secondaryValue) {
    console.warn('Workflow overview: required count fields are missing.');
    return;
  }

  const isOpen = (record) => IMS.piStatus(record) !== 'Closed';
  const isUnclosedRfq = (record) => IMS.rfqStatus(record) !== 'Closed';
  let primaryCount;
  let secondaryCount;

  switch (overview.dataset.workflowOverview) {
    case 'purchase-indent': {
      const indents = IMS.piAll();
      primaryCount = indents.length;
      secondaryCount = indents.filter(isOpen).length;
      break;
    }
    case 'rfq': {
      const rfqs = IMS.rfqAll();
      primaryCount = rfqs.length;
      secondaryCount = IMS.piAll().filter(isOpen).length;
      break;
    }
    case 'quotation': {
      const quotations = IMS.qrAll();
      primaryCount = quotations.length;
      secondaryCount = IMS.rfqAll().filter(isUnclosedRfq).length;
      break;
    }
    case 'purchase-order': {
      const orders = IMS.purchaseOrders();
      const linkedQuotationIds = new Set(orders.map((order) => String(order.quotationId || '')));
      const linkedQuotationNumbers = new Set(orders.map((order) => String(order.quotationNo || '').toLowerCase()));
      const pendingQuotations = IMS.qrAll().filter((quotation) =>
        !linkedQuotationIds.has(String(quotation.id))
        && !linkedQuotationNumbers.has(String(quotation.no || '').toLowerCase())
      );
      primaryCount = orders.length;
      secondaryCount = pendingQuotations.length;
      break;
    }
    case 'mrn': {
      const orders = IMS.purchaseOrders();
      const pendingReceipts = orders.filter((order) =>
        (order.lines || []).some((line) =>
          Math.max(0, (Number(line.qty) || 0) - (Number(line.receivedQty) || 0)) > 0
        )
      );
      primaryCount = IMS.mrnAll().length;
      secondaryCount = pendingReceipts.length;
      break;
    }
    case 'material-issue':
    case 'material-authorization': {
      const stored = JSON.parse(localStorage.getItem('materialRequisitionVouchers') || '[]');
      if (!Array.isArray(stored)) throw new TypeError('Saved material issue vouchers must be a list.');
      const fallbackRecords = overview.dataset.workflowOverview === 'material-authorization'
        ? [
            { status: 'Pending' },
            { status: 'Pending' },
            { status: 'Review' }
          ]
        : [];
      const vouchers = stored.length || overview.dataset.workflowOverview !== 'material-authorization'
        ? stored
        : fallbackRecords;
      const closedStatuses = new Set(['approved', 'authorized', 'issued', 'completed', 'rejected', 'cancelled', 'canceled', 'void']);
      const pendingCount = vouchers.filter((voucher) => {
        const status = String(voucher?.authorizationStatus || voucher?.status || 'Pending').trim().toLowerCase();
        return !closedStatuses.has(status);
      }).length;
      primaryCount = vouchers.length;
      secondaryCount = pendingCount;
      break;
    }
    default:
      console.warn(`Workflow overview: unknown page type "${overview.dataset.workflowOverview}".`);
      return;
  }

  primaryValue.textContent = String(primaryCount);
  secondaryValue.textContent = String(secondaryCount);
});
