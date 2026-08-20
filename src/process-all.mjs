import XLSX from 'xlsx';
import { resolve } from 'path';
import { parseTarif } from './parse-tarif.mjs';
import { loadCatalogue, matchTarifToCatalogue } from './match-catalogue.mjs';
import { buildDiff, calculatePrices } from './calculate-prices.mjs';

const CATALOGUE_COL = {
  PRIX_ACHAT: 24,
  PRIX_VENTE_PUBLIC_EUR: 28,
  PRIX_VENTE_PUBLIC_AUD: 29,
  PRIX_AFFICHE_AUD: 30,
  PRIX_GST_AUD: 31,
  PRIX_GROSSISTE_EUR: 33,
  PRIX_GROSSISTE_AUD: 34
};

function updateCatalogue(cataloguePath, validatedItems, outputPath) {
  const { wb } = loadCatalogue(cataloguePath);
  const ws = wb.Sheets[wb.SheetNames[0]];

  for (const item of validatedItems) {
    const row = item._rowIndex + 1;
    const newPrices = calculatePrices(item.newPrixAchatHT);

    ws[XLSX.utils.encode_cell({ r: row, c: CATALOGUE_COL.PRIX_ACHAT })].v = newPrices.prixAchatHT;
    ws[XLSX.utils.encode_cell({ r: row, c: CATALOGUE_COL.PRIX_VENTE_PUBLIC_EUR })].v = newPrices.prixVentePublicEUR;
    ws[XLSX.utils.encode_cell({ r: row, c: CATALOGUE_COL.PRIX_VENTE_PUBLIC_AUD })].v = newPrices.prixVentePublicAUD;
    ws[XLSX.utils.encode_cell({ r: row, c: CATALOGUE_COL.PRIX_AFFICHE_AUD })].v = newPrices.prixAfficheAUD;
    ws[XLSX.utils.encode_cell({ r: row, c: CATALOGUE_COL.PRIX_GST_AUD })].v = newPrices.prixGSTAUD;
    ws[XLSX.utils.encode_cell({ r: row, c: CATALOGUE_COL.PRIX_GROSSISTE_EUR })].v = newPrices.prixGrossisteEUR;
    ws[XLSX.utils.encode_cell({ r: row, c: CATALOGUE_COL.PRIX_GROSSISTE_AUD })].v = newPrices.prixGrossisteAUD;
  }

  XLSX.writeFile(wb, outputPath);
  console.log(`Catalogue updated: ${outputPath} (${validatedItems.length} products)`);
}

export async function processTarif(tarifPath, cataloguePath) {
  const { supplier, items } = parseTarif(resolve(tarifPath));
  const { products } = loadCatalogue(resolve(cataloguePath));
  const { matched, unmatched } = matchTarifToCatalogue(items, products, supplier);
  const diff = buildDiff(matched);

  return {
    supplier,
    tarifItems: items.length,
    matched: matched.length,
    unmatched: unmatched.length,
    unmatchedRefs: unmatched.map(u => ({ ref: u.ref, designation: u.designation })),
    diff
  };
}

export { updateCatalogue };

if (process.argv[1] && process.argv[1].endsWith('process-all.mjs')) {
  const tarifPath = process.argv[2];
  const cataloguePath = process.argv[3];

  if (!tarifPath || !cataloguePath) {
    console.error('Usage: node process-all.mjs <tarif-path> <catalogue-path>');
    process.exit(1);
  }

  const result = await processTarif(tarifPath, cataloguePath);
  console.log(`\nSupplier: ${result.supplier}`);
  console.log(`Tarif items: ${result.tarifItems}`);
  console.log(`Matched: ${result.matched}`);
  console.log(`Unmatched: ${result.unmatched}`);
  console.log(`\nPrice differences:`);
  result.diff.forEach(d => {
    const arrow = d.ecartEUR > 0 ? '↑' : d.ecartEUR < 0 ? '↓' : '=';
    console.log(`  ${d.sku} | ${d.ref} | ${d.nom?.substring(0, 40)} | ${d.old.prixAchatHT} → ${d.new.prixAchatHT} EUR ${arrow}${Math.abs(d.ecart)}% | AUD ${d.old.prixAfficheAUD} → ${d.new.prixAfficheAUD}`);
  });
}
