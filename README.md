# Stockline — inventory for businesses with more than one store

One owner, several stores. Track what comes in, what sells, what moves between stores and what's running low, with a complete history of every change.

## What's in it

| Area | What it does |
| --- | --- |
| **Overview** | Sales today / this week, stock value, items needing attention, 30-day sales and profit chart, health of each store, what to reorder, best sellers, latest activity |
| **Sell** | Search, scan a barcode (camera, on supported browsers) or type a SKU; build the sale; stock comes off immediately. Can't sell more than is on the shelf |
| **Receive stock** | Log a delivery with supplier and invoice number; a new cost price updates the product |
| **Transfer** | Send stock from one store to another; both update in one step |
| **Stock count** | Type what's actually on the shelf; the difference is saved as an adjustment with a reason (damaged, expired, lost…) |
| **Products** | Search, filter by category or stock status, stock per store, CSV export, add/edit/archive |
| **Stores** | Value, stock health and sales per store; store detail with low-stock list and activity |
| **Suppliers** | Contacts, products supplied, spend in the last 90 days, call / WhatsApp / email |
| **Stock history** | Every movement, filterable by type, store, period and product, with who did it; CSV export |
| **Reports** | Revenue and profit by day, stores compared, stock value by category, busiest hours heatmap, best sellers, slow movers |
| **Salespeople** | Create logins (username + password, no email) for the people who sell; monthly targets, commission, leaderboard, reset passwords, turn accounts off; send the login on WhatsApp |
| **Team** | Invite managers and staff by email and assign them to a store |
| **Settings** | Business name and currency; load sample data on a fresh account |

After each sale there's a receipt to print or send to the customer on WhatsApp, and the owner can get an email about it (Settings → Email alerts; needs `RESEND_API_KEY`, see `.env.example`).

The **admin area** at `/admin` shows every business on the platform: owners, stores, people, stock value, sales and recent activity. Only emails listed in `platform_admins` can open it.

Press **⌘K / Ctrl+K** anywhere to jump to a page or search products.

## Roles

- **Owner** — every store, everything.
- **Manager** — their store(s): products, suppliers, deliveries, counts and adjustments.
- **Staff** — sell, receive and transfer at their store.
- **Salesperson** — only sells, always at the listed price, and only sees their own sales. Signs in with a username the owner or their store manager created.

Enforced in the database with row-level security, not just hidden in the UI.

## How stock is kept honest

`movements` is an append-only ledger: every sale, delivery, transfer and adjustment is a row with who, when, quantity and price. A trigger keeps `stock_levels` in step and refuses anything that would take a store below zero. Nothing is edited or deleted, so every number can be traced.

## Setup

```bash
cp .env.example .env.local   # Supabase URL + publishable key
npm install
npm run dev
```

Run the files in `supabase/migrations/` in order on a Supabase project. Then make yourself an admin:

```sql
insert into public.platform_admins (email) values ('you@example.com');
```
