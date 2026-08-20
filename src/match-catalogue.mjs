import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATALOGUE_COLUMNS = {
  SKU: 0,
  RUBRIQUE: 4,
  SOUS_RUBRIQUE: 5,
  CATEGORIE: 6,
  SOUS_CATEGORIE: 7,
  FOURNISSEUR: 8,
  REF_FOURNISSEUR: 9,
  COLLECTION: 10,
  NOM_PRODUIT: 11,
  NOMENCLATURE: 12,
  ORIGINE: 13,
  POIDS_NET: 15,
  POIDS_BRUT: 16,
  PRIX_ACHAT: 24,
  STOCK: 25,
  PRIX_VENTE_PUBLIC_EUR: 28,
  PRIX_VENTE_PUBLIC_AUD: 29,
  PRIX_AFFICHE_AUD: 30,
  PRIX_GST_AUD: 31,
  PRIX_GROSSISTE_EUR: 33,
  PRIX_GROSSISTE_AUD: 34
};

export function loadCatalogue(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const headers = data[0];

  const products = data.slice(1).map((row, idx) => ({
    _rowIndex: idx + 1,
    sku: row[CATALOGUE_COLUMNS.SKU],
    rubrique: row[CATALOGUE_COLUMNS.RUBRIQUE],
    sousRubrique: row[CATALOGUE_COLUMNS.SOUS_RUBRIQUE],
    categorie: row[CATALOGUE_COLUMNS.CATEGORIE],
    sousCategorie: row[CATALOGUE_COLUMNS.SOUS_CATEGORIE],
    fournisseur: row[CATALOGUE_COLUMNS.FOURNISSEUR],
    refFournisseur: String(row[CATALOGUE_COLUMNS.REF_FOURNISSEUR]).trim(),
    collection: row[CATALOGUE_COLUMNS.COLLECTION],
    nomProduit: row[CATALOGUE_COLUMNS.NOM_PRODUIT],
    origine: row[CATALOGUE_COLUMNS.ORIGINE],
    poidsNet: row[CATALOGUE_COLUMNS.POIDS_NET],
    poidsBrut: row[CATALOGUE_COLUMNS.POIDS_BRUT],
    prixActuel: parseFloat(row[CATALOGUE_COLUMNS.PRIX_ACHAT]) || 0,
    stock: row[CATALOGUE_COLUMNS.STOCK],
    prixVentePublicEUR: row[CATALOGUE_COLUMNS.PRIX_VENTE_PUBLIC_EUR],
    prixVentePublicAUD: row[CATALOGUE_COLUMNS.PRIX_VENTE_PUBLIC_AUD],
    prixAfficheAUD: row[CATALOGUE_COLUMNS.PRIX_AFFICHE_AUD],
    prixGSTAUD: row[CATALOGUE_COLUMNS.PRIX_GST_AUD],
    prixGrossisteEUR: row[CATALOGUE_COLUMNS.PRIX_GROSSISTE_EUR],
    prixGrossisteAUD: row[CATALOGUE_COLUMNS.PRIX_GROSSISTE_AUD],
    _rawRow: row
  }));

  return { headers, products, wb };
}

export function matchTarifToCatalogue(tarifItems, catalogueProducts, supplierName) {
  const matched = [];
  const unmatched = [];

  for (const item of tarifItems) {
    const product = catalogueProducts.find(p =>
      p.fournisseur === supplierName &&
      p.refFournisseur === item.ref
    );

    if (product) {
      matched.push({
        ...item,
        catalogue: product,
        ecart: item.priceHT !== product.prixActuel
          ? ((item.priceHT - product.prixActuel) / product.prixActuel * 100).toFixed(1)
          : 0
      });
    } else {
      unmatched.push(item);
    }
  }

  return { matched, unmatched };
}

if (process.argv[1] && process.argv[1].endsWith('match-catalogue.mjs')) {
  const cataloguePath = process.argv[2];
  const tarifPath = process.argv[3];
  if (!cataloguePath || !tarifPath) {
    console.error('Usage: node match-catalogue.mjs <catalogue-path> <tarif-path>');
    process.exit(1);
  }

  const { parseTarif } = await import('./parse-tarif.mjs');
  const { products } = loadCatalogue(resolve(cataloguePath));
  const { supplier, items } = parseTarif(resolve(tarifPath));
  const { matched, unmatched } = matchTarifToCatalogue(items, products, supplier);

  console.log(`Supplier: ${supplier}`);
  console.log(`Matched: ${matched.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('\nUnmatched refs:', unmatched.map(u => u.ref).join(', '));
  }
}
