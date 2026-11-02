(function (root, factory) {
  const stockImport = factory();
  if (typeof module === 'object' && module.exports) module.exports = stockImport;
  else root.StockImport = stockImport;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const CODE_HEADERS = new Set([
    'itemcode', 'itemnumber', 'materialcode', 'materialnumber', 'code',
    'sku', 'skucode', 'productcode', 'productid', 'materialid'
  ]);
  const QUANTITY_HEADERS = new Set([
    'quantity', 'qty', 'stock', 'stockqty', 'currentstock', 'availableqty',
    'balancequantity', 'balanceqty', 'closingstock', 'openingstock',
    'onhand', 'onhandqty', 'quantityonhand', 'physicalstock', 'physicalqty',
    'inventoryquantity'
  ]);
  const NAME_HEADERS = new Set(['itemname', 'materialname', 'productname', 'name']);
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_HEADER_ROWS = 50;

  function normalizeHeader(value) {
    return String(value || '').replace(/^\uFEFF/, '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, '');
  }

  function cellText(cell) {
    const value = cell.value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('').trim();
      throw new Error(`Cell ${cell.address} must contain a plain value, not a formula or object.`);
    }
    return String(value).trim();
  }

  function splitDelimitedText(text) {
    const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim());
    const delimiters = [',', ';', '\t', '|'];
    let delimiter = ',';
    let maxColumns = 1;
    for (const candidate of delimiters) {
      let maxCandidateColumns = 0;
      for (const line of lines.slice(0, MAX_HEADER_ROWS)) {
        let columns = 0;
        let quoted = false;
        for (const character of line) {
          if (character === '"') quoted = !quoted;
          else if (character === candidate && !quoted) columns += 1;
        }
        maxCandidateColumns = Math.max(maxCandidateColumns, columns);
      }
      if (maxCandidateColumns > maxColumns) {
        maxColumns = maxCandidateColumns;
        delimiter = candidate;
      }
    }

    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"' && quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        row.push(value);
        value = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
      } else {
        value += character;
      }
    }
    if (quoted) throw new Error('The CSV file has an unmatched quote.');
    if (value || row.length) {
      row.push(value);
      rows.push(row);
    }
    return rows;
  }

  function findHeader(worksheet) {
    let match = null;
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      if (match || row.number > MAX_HEADER_ROWS) return;
      let codeColumn = 0;
      let quantityColumn = 0;
      let itemNameColumn = 0;
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        const header = normalizeHeader(cellText(cell));
        if (CODE_HEADERS.has(header)) codeColumn = column;
        if (QUANTITY_HEADERS.has(header)) quantityColumn = column;
        if (NAME_HEADERS.has(header)) itemNameColumn = column;
      });
      if (codeColumn && quantityColumn) match = { row, codeColumn, quantityColumn, itemNameColumn };
    });
    return match;
  }

  async function read(file, ExcelJS) {
    if (!ExcelJS?.Workbook) throw new Error('The local Excel reader did not load. Refresh the page and try again.');
    if (file.size > MAX_FILE_SIZE) throw new Error('Choose a file smaller than 10 MB.');
    const extension = file.name.split('.').pop()?.toLocaleLowerCase();
    const workbook = new ExcelJS.Workbook();
    if (extension === 'xlsx') {
      const fileBuffer = await file.arrayBuffer();
      const archiveContents = new TextDecoder().decode(fileBuffer);
      if (archiveContents.includes('Index/Document.iwa')) {
        throw new Error('Apple Numbers file detected. Export as Excel (.xlsx) or CSV, then upload.');
      }
      await workbook.xlsx.load(fileBuffer);
    } else if (extension === 'csv') {
      const worksheet = workbook.addWorksheet('Stock Import');
      splitDelimitedText(await file.text()).forEach((values) => worksheet.addRow(values));
    } else {
      throw new Error('Unsupported file type. Choose an .xlsx or .csv file.');
    }

    if (!workbook.worksheets.length) {
      throw new Error('No readable sheet found. Export as Excel (.xlsx) or CSV, then upload.');
    }
    let selectedWorksheet;
    let header;
    for (const worksheet of workbook.worksheets) {
      header = findHeader(worksheet);
      if (header) {
        selectedWorksheet = worksheet;
        break;
      }
    }
    if (!selectedWorksheet) {
      throw new Error('Add Item Code/Item Number and Quantity/Stock headers, then upload again.');
    }

    const quantities = new Map();
    selectedWorksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= header.row.number) return;
      const quantityCell = row.getCell(header.quantityColumn);
      const itemName = header.itemNameColumn ? cellText(row.getCell(header.itemNameColumn)) : '';
      const code = cellText(row.getCell(header.codeColumn));
      const quantityText = cellText(quantityCell);
      if (!code && !quantityText && !itemName) return;
      if (!code) throw new Error(`Row ${rowNumber}: Item Code/Item Number is missing.`);
      if (!quantityText) throw new Error(`Row ${rowNumber}: Quantity is missing for item ${code}.`);
      const quantity = typeof quantityCell.value === 'number'
        ? quantityCell.value
        : Number(quantityText.replace(/,/g, ''));
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new Error(`Row ${rowNumber}: Quantity for ${code} must be a non-negative number.`);
      }
      const key = code.toLocaleLowerCase();
      quantities.set(key, (quantities.get(key) || 0) + quantity);
    });
    if (!quantities.size) throw new Error('No stock records were found in the selected file.');
    if ([...quantities.values()].every((quantity) => quantity === 0)) {
      throw new Error('No positive stock quantities were found in the selected file.');
    }
    return { quantities, mode: 'add' };
  }

  return { read };
}));
