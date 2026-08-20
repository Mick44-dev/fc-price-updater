import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ratios = JSON.parse(readFileSync(resolve(__dirname, '../ratios.json'), 'utf8'));

const suppliersConfig = JSON.parse(readFileSync(resolve(__dirname, '../parsers/suppliers.json'), 'utf8'));

function applyRemise(pvpHT, supplierName) {
  const config = suppliersConfig[supplierName];
  if (!config) return pvpHT;
  return pvpHT * (1 - config.remise);
}

export function calculatePrices(prixAchatHT) {
  const prixVentePublicEUR = prixAchatHT * ratios.marginPublic;
  const prixVentePublicAUD = prixVentePublicEUR / ratios.exchangeRate;
  const prixAfficheAUD = Math.round(prixVentePublicAUD);
  const prixGSTAUD = Math.round(prixAfficheAUD * (1 + ratios.gst) * 100) / 100;
  const prixGrossisteEUR = prixAchatHT * ratios.marginWholesale;
  const prixGrossisteAUD = prixGrossisteEUR / ratios.exchangeRate;

  return {
    prixAchatHT: Math.round(prixAchatHT * 100) / 100,
    prixVentePublicEUR: Math.round(prixVentePublicEUR * 100) / 100,
    prixVentePublicAUD: Math.round(prixVentePublicAUD * 100) / 100,
    prixAfficheAUD,
    prixGSTAUD,
    prixGrossisteEUR: Math.round(prixGrossisteEUR * 100) / 100,
    prixGrossisteAUD: Math.round(prixGrossisteAUD * 100) / 100
  };
}

export function buildDiff(matchedItems) {
  return matchedItems.map(item => {
    const prixAchatHT = applyRemise(item.priceHT, item.supplier);
    const newPrices = calculatePrices(prixAchatHT);
    const oldPrices = {
      prixAchatHT: item.catalogue.prixActuel,
      prixVentePublicEUR: item.catalogue.prixVentePublicEUR,
      prixVentePublicAUD: item.catalogue.prixVentePublicAUD,
      prixAfficheAUD: item.catalogue.prixAfficheAUD,
      prixGSTAUD: item.catalogue.prixGSTAUD,
      prixGrossisteEUR: item.catalogue.prixGrossisteEUR,
      prixGrossisteAUD: item.catalogue.prixGrossisteAUD
    };

    const pctChange = oldPrices.prixAchatHT > 0
      ? ((newPrices.prixAchatHT - oldPrices.prixAchatHT) / oldPrices.prixAchatHT * 100).toFixed(1)
      : '0.0';

    return {
      sku: item.catalogue.sku,
      ref: item.ref,
      nom: item.catalogue.nomProduit,
      collection: item.catalogue.collection,
      fournisseur: item.supplier,
      pvpHT: Math.round(item.priceHT * 100) / 100,
      old: oldPrices,
      new: newPrices,
      ecart: pctChange,
      ecartEUR: Math.round((newPrices.prixAchatHT - oldPrices.prixAchatHT) * 100) / 100
    };
  });
}

if (process.argv[1] && process.argv[1].endsWith('calculate-prices.mjs')) {
  const testPrice = parseFloat(process.argv[2]) || 145.62;
  const result = calculatePrices(testPrice);
  console.log(`Input: ${testPrice} EUR HT`);
  console.log(JSON.stringify(result, null, 2));
}
