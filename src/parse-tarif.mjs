import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const suppliersConfig = JSON.parse(readFileSync(resolve(__dirname, '../parsers/suppliers.json'), 'utf8'));

function detectSupplier(filename) {
  for (const [name, config] of Object.entries(suppliersConfig)) {
    if (filename.toUpperCase().includes(config.filePattern.toUpperCase())) {
      return name;
    }
  }
  return null;
}

function parseExcel(filePath, supplierName) {
  const config = suppliersConfig[supplierName];
  if (!config) throw new Error(`Unknown supplier: ${supplierName}`);

  const wb = XLSX.readFile(filePath);
  const results = [];

  for (const [sheetKey, sheetConfig] of Object.entries(config.sheets)) {
    const sheetName = wb.SheetNames.find(s =>
      s.toUpperCase().includes(sheetKey.toUpperCase())
    );
    if (!sheetName) continue;

    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const headerRow = sheetConfig.headerRow || 0;
    const headers = data[headerRow] || [];

    const normalizeHeader = h => String(h).replace(/[\r\n]+/g, ' ').trim().toLowerCase();

    const refIdx = headers.findIndex(h =>
      normalizeHeader(h) === sheetConfig.refColumn.toLowerCase()
    );
    const priceLabelNorm = sheetConfig.priceLabel ? sheetConfig.priceLabel.replace(/[\r\n]+/g, ' ').toLowerCase() : '';
    const priceColNorm = sheetConfig.priceColumn.toLowerCase();
    const priceIdx = headers.findIndex(h => {
      const nh = normalizeHeader(h);
      return nh.includes(priceLabelNorm) || nh === priceColNorm;
    });
    const desIdx = headers.findIndex(h => {
      const nh = normalizeHeader(h);
      return nh.includes('désignation') || nh.includes('designation');
    });
    const eanIdx = headers.findIndex(h => {
      const nh = normalizeHeader(h);
      return nh.includes('ean') || nh.includes('code barre');
    });
    const pcbIdx = headers.findIndex(h =>
      normalizeHeader(h) === 'pcb'
    );

    if (refIdx === -1 || priceIdx === -1) {
      console.warn(`Sheet ${sheetName}: ref or price column not found`);
      continue;
    }

    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      const ref = String(row[refIdx]).trim();
      const price = parseFloat(row[priceIdx]);
      if (!ref || isNaN(price)) continue;

      results.push({
        ref,
        designation: desIdx !== -1 ? String(row[desIdx]).trim() : '',
        ean: eanIdx !== -1 ? String(row[eanIdx]).trim() : '',
        pcb: pcbIdx !== -1 ? row[pcbIdx] : '',
        priceTTC: config.priceIsTTC ? price : null,
        priceHT: config.priceIsTTC ? price / (1 + config.tva) : price,
        sheet: sheetKey,
        supplier: supplierName
      });
    }
  }

  return results;
}

function parsePDF(filePath, supplierName) {
  throw new Error('PDF parsing not yet implemented — use Excel format for now');
}

export function parseTarif(filePath) {
  const filename = filePath.split(/[\\/]/).pop();
  const supplier = detectSupplier(filename);
  if (!supplier) throw new Error(`Cannot detect supplier from filename: ${filename}`);

  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    return { supplier, items: parseExcel(filePath, supplier) };
  } else if (ext === 'pdf') {
    return { supplier, items: parsePDF(filePath, supplier) };
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('parse-tarif.mjs')) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node parse-tarif.mjs <tarif-file-path>');
    process.exit(1);
  }
  const result = parseTarif(resolve(filePath));
  console.log(`Supplier: ${result.supplier}`);
  console.log(`Items found: ${result.items.length}`);
  console.log(JSON.stringify(result.items.slice(0, 5), null, 2));
}
