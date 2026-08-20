<div align="center">
  <img src="https://www.frenchconnoisseur.com.au/cdn/shop/files/logo-embleme.png?v=1782913967&width=300" alt="French Connoisseur" width="120">
  <br><br>
  <h1>FC Price Updater</h1>
  <p><strong>Automated supplier price update pipeline</strong></p>
  <p>
    <em>Supplier tariffs → Catalogue Excel → Validation UI → Shopify API</em>
  </p>
  <br>
  <img src="https://img.shields.io/badge/status-active-success?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/supplier-CRISTEL%20%7C%20DEGRENNE%20%7C%20...-6A254B?style=flat-square" alt="Suppliers">
  <img src="https://img.shields.io/badge/Shopify-API%20GraphQL-95BF47?style=flat-square&logo=shopify" alt="Shopify">
  <img src="https://img.shields.io/badge/n8n-workflow-FF6D5A?style=flat-square&logo=n8n" alt="n8n">
</div>

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────┐     ┌──────────────┐
│  Supplier     │     │  Parse & Match    │     │  Validation   │     │  Update       │
│  Tariff File  │────▶│  (Node.js)        │────▶│  (Web UI)     │────▶│  (n8n)        │
│  Excel / PDF  │     │                   │     │  GitHub Pages │     │  Excel+Shopify│
└──────────────┘     └──────────────────┘     └───────────────┘     └──────────────┘
     _Import/         parsers/suppliers.json    web/index.html       automate.libraudit.tech
```

### How it works

1. **Drop** a supplier tariff file (Excel/PDF) into `_Import/`
2. **Auto-detect** — n8n watches the folder, detects the supplier from filename
3. **Parse & Match** — extracts prices, matches `Ref Fournisseur` to catalogue
4. **Calculate** — applies supplier discount, converts to AUD with margins
5. **Validate** — you review the diff on a web page, approve or override prices
6. **Update** — catalogue Excel + Shopify product prices are updated automatically

---

## Repository Structure

```
fc-price-updater/
├── parsers/
│   └── suppliers.json          # Per-supplier config (discount, VAT, columns)
├── src/
│   ├── parse-tarif.mjs         # Read Excel/PDF → normalised JSON
│   ├── match-catalogue.mjs     # Match supplier refs to catalogue
│   ├── calculate-prices.mjs    # Discount, exchange rate, margins → AUD
│   └── process-all.mjs         # Full pipeline: parse → match → diff
├── docs/
│   ├── index.html              # Price validation page (GitHub Pages)
│   ├── style.css               # FC brand styles
│   └── validate.js             # Frontend logic + webhook submission
├── ratios.json                 # Exchange rates, margins, GST
└── package.json
```

---

## Supplier Configuration

Each supplier is configured in [`parsers/suppliers.json`](parsers/suppliers.json):

```json
{
  "CRISTEL": {
    "remise": 0.536,
    "tva": 0.20,
    "priceIsTTC": true,
    "filePattern": "CRISTEL",
    "sheets": {
      "SETS": {
        "refColumn": "Code Article",
        "priceColumn": "PVP TTC",
        "priceLabel": "PVP TTC 2026 (T26)",
        "headerRow": 3
      }
    }
  }
}
```

| Field | Description |
|---|---|
| `remise` | Supplier discount rate on PVP HT |
| `tva` | VAT rate to convert TTC → HT |
| `priceIsTTC` | `true` if supplier price includes VAT |
| `filePattern` | Substring to detect supplier from filename |
| `sheets` | Per-sheet column mapping for parsing |

To add a new supplier, add an entry to this file.

---

## Price Calculation

From [`ratios.json`](ratios.json):

| Parameter | Value |
|---|---|
| Exchange rate | 1 AU$ = 0.56 EUR |
| Public margin | × 2.4 |
| Wholesale margin | × 2.0 |
| GST | 10% |

**Calculation per product:**

```
prix_achat_HT    = PVP_HT × (1 − remise)
prix_vente_EUR   = prix_achat_HT × 2.4
prix_vente_AUD   = prix_vente_EUR / 0.56
prix_affiché_AUD = round(prix_vente_AUD)
prix_GST_AUD     = prix_affiché_AUD × 1.10
```

---

## Validation Page

Hosted on **GitHub Pages**, the validation UI lets you:

- ✅ Review each price change: old vs new, with % difference
- ✅ Select/deselect individual products or batch (price up, price down)
- ✅ Override the suggested AUD retail price manually
- ✅ Export the diff as CSV
- ✅ Submit validated prices to n8n webhook → updates Excel + Shopify

**Demo:** `https://mick44-dev.github.io/fc-price-updater/`

---

## Shopify Integration

The n8n workflow pushes validated prices to Shopify via the **Admin GraphQL API**:

```
POST https://frenchconnoisseur.myshopify.com/admin/api/2024-01/graphql.json
Header: X-Shopify-Access-Token: <token>
```

Required scopes: `read_products`, `write_products`

---

## Adding a New Supplier

1. Add an entry in `parsers/suppliers.json` with discount rate, VAT, and column mapping
2. Drop a tariff file named with the supplier name into `_Import/`
3. The pipeline auto-detects and processes it

---

## Tech Stack

| Component | Technology |
|---|---|
| Parsing | Node.js + xlsx |
| Price engine | Node.js (ES modules) |
| Validation UI | Vanilla HTML/CSS/JS (GitHub Pages) |
| Orchestration | n8n (automate.libraudit.tech) |
| E-commerce API | Shopify Admin GraphQL |

---

<div align="center">
  <img src="https://www.frenchconnoisseur.com.au/cdn/shop/files/logo-embleme.png?v=1782913967&width=300" alt="FC" width="40">
  <br>
  <sub>Built for <a href="https://www.frenchconnoisseur.com.au">French Connoisseur</a> — Made in France 🇫🇷</sub>
</div>
