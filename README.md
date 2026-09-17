# Core Byte Media LLC — Order Portal

Internal staff portal for **portal.corebytemediallc.com**. Staff sign in, enter a customer's
details and the print products they are ordering, take the card, and charge it through the
NMI merchant gateway. Built with Next.js 16 (App Router), Tailwind CSS v4 and JavaScript, using
the same brand system as the public website. It is a standalone project — nothing is shared
at runtime with corebytemediallc.com.

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm run build
npm run lint
```

---

## How payment works

1. **Collect.js** (NMI's hosted card fields) loads in the browser with the **public**
   tokenization key. The card number, expiry and CVV are typed into NMI-hosted iframes and
   never enter this app's DOM or its server. Collect.js returns a single-use `payment_token`.
2. The browser POSTs the order and that token to `/api/charge`.
3. The route re-validates the order, **recomputes the total from the line items**, and
   submits a `sale` (or `auth`) to the NMI Payment API with the **private** security key.
4. The gateway result (transaction ID, auth code, AVS/CVV) is shown to staff and saved to the
   browser's local order history.

Refunds, voids, captures and full reporting are done in the NMI merchant portal.

## Environment variables

Set these in Netlify under **Site configuration → Environment variables** (and in
`.env.local` for development). `.env.example` documents each one.

| Variable | Where used | Purpose |
| --- | --- | --- |
| `PORTAL_EMAIL` | server | Staff login email |
| `PORTAL_PASSWORD` | server | Staff login password |
| `PORTAL_SESSION_SECRET` | server | Signs the session cookie — `openssl rand -hex 32` |
| `PORTAL_SESSION_HOURS` | server | Session length (default 12) |
| `NEXT_PUBLIC_NMI_TOKENIZATION_KEY` | browser | NMI **public** key for Collect.js |
| `NMI_SECURITY_KEY` | server | NMI **private** key for the Payment API |
| `NMI_API_URL` | server | Optional gateway URL override |
| `NEXT_PUBLIC_NMI_COLLECT_JS_URL` | browser | Optional Collect.js URL override |
| `NMI_TRANSACTION_TYPE` | server | `sale` (default) or `auth` |
| `NMI_CUSTOMER_RECEIPT` | server | `true` to have NMI email the customer a receipt |

`NEXT_PUBLIC_*` values are compiled into the browser bundle at build time, so after changing
them in Netlify trigger a new deploy. Never give the private key a `NEXT_PUBLIC_` prefix.

### Getting the NMI keys

In the NMI merchant portal: **Settings → Security Keys**.

- *Add a new **public** key* → paste into `NEXT_PUBLIC_NMI_TOKENIZATION_KEY`.
- *Add a new **private** key* with **API** permission → paste into `NMI_SECURITY_KEY`.

For testing, use the keys from your NMI **test/sandbox** account before switching to the live
ones. NMI's test card numbers (e.g. Visa `4111111111111111`, any future expiry, CVV `999`)
approve on a test account.

## Deploying to Netlify

1. Push this folder to its own git repository.
2. Netlify → **Add new site → Import an existing project** → pick the repo. Netlify detects
   Next.js; `netlify.toml` already sets the build command, publish directory, Node 22 and
   the `@netlify/plugin-nextjs` runtime that turns `app/api/**` into serverless functions.
3. Add the environment variables above, then deploy.
4. **Domain**: Netlify → Domain management → *Add a domain* → `portal.corebytemediallc.com`.
   At your DNS provider add a **CNAME** record:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `portal` | `<your-site-name>.netlify.app` |

   Netlify provisions the HTTPS certificate automatically once DNS resolves.

## Project layout

```
app/
  layout.js               fonts, brand metadata (noindex), toast provider
  page.js                 redirects to /dashboard or /login
  login/                  sign-in page
  (portal)/layout.js      session guard + header/footer for every portal page
  (portal)/dashboard/     quick actions, gateway status, recent orders
  (portal)/orders/new/    the order + charge form
  (portal)/orders/        local order history
  api/auth/login|logout   session cookie set / clear
  api/charge              validates the order and calls NMI
components/
  OrderForm.js            form state, submit → tokenise → charge
  CardFields.js           Collect.js inline iframes
  order/                  address, line item, summary and confirmation blocks
  PortalHeader.js, LoginForm.js, OrderHistory.js, PageHeader.js
  ui/                     Button, Field, Icons, Badge, Notice, Panel, Toast, spinners
lib/
  auth.js                 HMAC-signed session cookie (server only)
  nmi.js                  Payment API client + response codes (server only)
  order.js                shared order shape, normalisation, validation, totals
  orders-store.js         localStorage history
  collect.js              Collect.js loader
data/
  site.js                 brand, contact, currency, nav, order defaults
  products.js             catalogue (names, SKUs, prices, sizes, colours)
  us-states.js
```

## Things to know

- **Login** is a single set of credentials from the environment. There is no user database;
  add one (or an auth provider) if more than one person needs their own account.
- **Order history is per browser** (`localStorage`). It is a convenience, not the system of
  record — NMI is. Search there by the `CBM-…` order reference or the transaction ID.
- **Prices** pre-fill from `data/products.js` and can be overridden per line; the server
  accepts the entered price (it is a staff tool) but caps quantity, unit price and order total
  (`lib/order.js`).
- **Product catalogue** is a copy of the website's. When products or prices change on the
  site, update `data/products.js` here too.
- The site sends `X-Robots-Tag: noindex` and a disallow-all `robots.txt`.
