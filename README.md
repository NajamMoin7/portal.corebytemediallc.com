# Core Byte Media LLC — Order Portal

Internal staff portal for **portal.corebytemediallc.com**. Each agent signs in with their own
email and password, enters the amount and the customer's billing and shipping details, takes the
card, and charges it through the NMI merchant gateway. Approved orders are saved to MongoDB with the
agent who took them, and the dashboard shows per-agent totals for today, this month, this year
and all time. Built with Next.js 16 (App Router),
Tailwind CSS v4 and JavaScript, using the same brand system as the public website. It is a standalone project — nothing is shared
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
3. The route re-validates the order (including that the agent is one of `data/agents.js`) and
   submits a `sale` (or `auth`) to the NMI Payment API with the **private** security key.
4. On approval the order, amount, agent, gateway result (transaction ID, auth code, AVS/CVV) and
   the card's last four digits are saved to the `orders` collection in MongoDB, and the record
   is shown to staff. A failed save never fails the request — the card has already been charged —
   it is reported on screen instead.

Refunds, voids, captures and full reporting are done in the NMI merchant portal.

## Environment variables

Set these in Netlify under **Site configuration → Environment variables** (and in
`.env.local` for development). `.env.example` documents each one.

| Variable | Where used | Purpose |
| --- | --- | --- |
| `PORTAL_EMAIL` | server | Email of the **first super admin**, created on first login |
| `PORTAL_PASSWORD` | server | Password for that first super admin |
| `PORTAL_SESSION_SECRET` | server | Signs the session cookie — `openssl rand -hex 32` |
| `PORTAL_SESSION_HOURS` | server | Session length (default 12) |
| `MONGODB_URI` | server | MongoDB Atlas connection string (see below) |
| `MONGODB_DB` | server | Optional database name (default `corebyte-portal`) |
| `NEXT_PUBLIC_NMI_TOKENIZATION_KEY` | browser | NMI **public** key for Collect.js |
| `NMI_SECURITY_KEY` | server | NMI **private** key for the Payment API |
| `NMI_API_URL` | server | Optional gateway URL override |
| `NEXT_PUBLIC_NMI_COLLECT_JS_URL` | browser | Optional Collect.js URL override |
| `NMI_TRANSACTION_TYPE` | server | `sale` (default) or `auth` |
| `NMI_CUSTOMER_RECEIPT` | server | `true` to have NMI email the customer a receipt |

`NEXT_PUBLIC_*` values are compiled into the browser bundle at build time, so after changing
them in Netlify trigger a new deploy. Never give the private key a `NEXT_PUBLIC_` prefix.

## Roles and accounts

There are two roles, both stored in the `users` collection:

| | Super admin | Agent |
| --- | --- | --- |
| Take orders and charge cards | yes | yes |
| See order history and totals | everyone's | only their own |
| Create, edit and archive agents | yes | no |
| Download month / year reports | yes | no |
| Record and clear chargebacks | yes | no |
| Reset passwords, switch access on/off | yes | no |

**The first super admin** is created automatically from `PORTAL_EMAIL` and `PORTAL_PASSWORD` the
first time anyone signs in. That bootstrap only ever *creates*: once a super admin exists,
changing those variables does nothing, and passwords changed in the portal are never overwritten
by a later deploy.

**Agents** are created in the portal under **Agents** (super admin only). Give the new agent the
email and password you set — the password is stored as a salted scrypt hash and cannot be read
back, only replaced.

**Nothing is ever deleted.** "Delete" on an agent *archives* them: they can no longer sign in and
drop out of the active lists, but their account and every order they took stay in the database,
and they can be restored at any time. Deactivating or archiving an agent also ends any session
they already have open, because the role and status are re-read from the database on every
request.

The portal refuses any change that would leave no active super admin, and you cannot archive or
demote your own account.

**The two roles get different navigation.** A super admin gets a left sidebar (Dashboard, New
Order, Order History, Agents, Reports); an agent gets the simpler top header, since they only
have the order pages. Both collapse to a drawer on a phone.

## Chargebacks

When a customer disputes a charge, a super admin opens the order in the history and uses
**Mark chargeback**. The penalty — `CHARGEBACK_PENALTY` in `data/site.js`, `$35` — is recorded
against **the agent who took that order**, read from the order itself rather than chosen, so it
always lands on the right person.

Where it shows up:

- a **Charged back** badge on the order row, for everyone;
- a chargeback line on the dashboard (the admin sees everyone's, an agent sees their own);
- the count and penalty total beside each agent on the **Agents** page;
- the full list on the agent's profile (**Agents → Profile**), with the order, reason, who
  marked it and when, plus their net after penalties.

If the dispute is won, **Clear chargeback** stops the penalty counting. Nothing is deleted: the
fee in force at the time is stored on the order, and every mark and clear is appended to that
order's `chargebackLog`, so the history survives either way. Changing `CHARGEBACK_PENALTY` only
affects chargebacks marked afterwards.

## Reports

**Reports** (super admin only) totals a calendar month or a whole year, broken down by agent,
with the orders behind it. The picker only offers periods that actually have orders.

Two CSV downloads per period:

- **Orders** — one row per order: reference, date, agent, amount, invoice, customer and
  contact details, addresses, transaction id, auth code, card last four, AVS and CVV.
- **Agent summary** — one row per agent with their order count and total, plus a total row.

Both are UTF-8 with a BOM so Excel opens them correctly, and any value starting with `=`, `+`,
`-` or `@` is prefixed with a quote so spreadsheets never execute customer data as a formula.
A single export is capped at 5,000 orders; the page says so when a period exceeds it.

### Setting up MongoDB

The portal uses [MongoDB Atlas](https://www.mongodb.com/atlas), MongoDB's hosted service. The
free tier (M0) is enough for this workload.

1. Create an Atlas account and a project, then **Create a cluster** → choose the **Free** tier.
2. **Database Access** → *Add new database user* → username + password with the
   *Read and write to any database* role. Avoid special characters in the password, or
   URL-encode them in the URI.
3. **Network Access** → *Add IP address*. For local development add your current IP. For
   Netlify (whose function IPs change) add `0.0.0.0/0` — the user's password is still
   required to connect.
4. **Database → Connect → Drivers** → copy the connection string, replace `<password>`, and
   paste it into `MONGODB_URI`.

The `corebyte-portal` database and its `orders` collection are created automatically on the
first order; indexes (unique `orderId`, `createdAt`, `result.transactionId`,
`order.customer.email`, `agent`) are created on first use by `lib/orders-db.js`. The per-agent
totals come from a single aggregation pipeline (`agentStats()`), with "today / this month / this
year" worked out in the timezone set by `TIMEZONE` in `data/site.js`. Browse the data in
Atlas under **Database → Browse Collections**.

The dashboard's *Gateway status* panel pings the database, so a wrong URI or missing network
access entry shows up there without placing an order.

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
  (portal)/dashboard/     quick actions, gateway + database status, agent totals, recent orders
  (portal)/orders/new/    the order + charge form
  (portal)/orders/        agent totals + paginated order history (scoped by role)
  (portal)/agents/        super admin: create, edit, activate, archive agents
  (portal)/agents/[id]/   agent profile: totals, chargebacks, penalties, recent orders
  (portal)/reports/       super admin: month / year totals and CSV downloads
  api/agents/             agent CRUD (super admin only; DELETE archives)
  api/reports/export      CSV download (super admin only)
  api/orders/[id]/chargeback  mark or clear a chargeback (super admin only)
  api/auth/login|logout   session cookie set / clear
  api/charge              validates the order, calls NMI, saves the approved order
components/
  OrderForm.js            form state, submit → tokenise → charge
  CardFields.js           Collect.js inline iframes
  AgentsManager.js        super admin's staff table and forms
  OrderSearch.js          free-text search box over the order history
  order/ChargebackControl.js  mark / clear a chargeback on one order
  PortalSidebar.js        super admin's left sidebar shell
  ReportPicker.js         report period picker and CSV download links
  AgentStats.js           per-agent totals: today, last month, this month, year
  ui/NavSpinner.js        spinner on the tab being navigated to
  order/                  billing + shipping fields, summary and confirmation blocks
  order/SmartPaste.js     magic clipboard: review panel for a pasted contact block
  PortalHeader.js, LoginForm.js, OrderHistory.js, PageHeader.js
  ui/                     Button, Field, Icons, Badge, Notice, Panel, Toast, spinners
lib/
  auth.js                 signed session cookie + the signed-in user (server only)
  users.js                users collection: roles, scrypt passwords, archiving
  reports.js              month / year report building and CSV output
  smart-paste.js          parses pasted customer details into form fields
  nmi.js                  Payment API client + response codes (server only)
  order.js                shared order shape, normalisation, validation
  mongodb.js              cached MongoClient connection (server only)
  orders-db.js            orders collection: save, list, count, find (server only)
  collect.js              Collect.js loader
data/
  site.js                 brand, contact, currency, nav, business timezone
  us-states.js
context/
  ToastContext.js
```

## Things to know

- **Login** is per person, from the `users` collection. Sessions are signed cookies holding only
  the user id; the role and status are read from the database on every request, so access changes
  take effect immediately.
- **Magic clipboard.** An agent can paste a customer's details — an email, a chat message, an
  address block or a spreadsheet row — and the form fills itself. Pasting a multi-line block
  anywhere on the form is caught and sent to a review panel instead of landing in one box; the
  "Paste details" button and "Read my clipboard" do the same thing on demand. The parse is
  always reviewed before it is applied: each detected value is listed with a tick, and "Undo
  autofill" restores the previous values. Ordinary single-value pastes are untouched.
- **The totals table compares months.** The columns are Today, Previous Month, This Month and
  Year, with the two months side by side and the change between them under the current figure.
  The headings name the months (`Previous Month (Aug)`) and roll over with the calendar, worked
  out in `TIMEZONE`, so a sale at 8:30pm on 31 August counts in August, not September.
- **Every tab shows it is loading**: the clicked link gets an inline spinner (`useLinkStatus`)
  and the content area gets a shape-matched skeleton from that route's `loading.js`. Portal
  pages are all dynamic, so there is always a short wait to cover.
- **Order history is searchable** (`?q=…`): customer name, company, email, phone (digits are
  compared, so formatting never matters), city, zip, order reference, transaction id, auth code,
  invoice number, description, card last four, agent, and an exact amount. Search and paging
  preserve each other, and an agent's search only ever covers their own orders.
- **Order history is paginated** at 20 per page, server-side: the controls are plain links to
  `?page=N`, so a page can be bookmarked and works before the JavaScript loads. An out-of-range
  page clamps to the last one rather than erroring.
- **Order history lives in MongoDB** and is shared by everyone who uses the portal. NMI is
  still the authority on the money: refunds, voids and captures are done there, by the
  transaction ID stored on each order. Only the card's last four digits, type and expiry are
  stored — never a full card number.
- **Orders are attributed to whoever is signed in.** The charge route takes the agent from the
  session, never from the request body, so a browser cannot record an order against someone else.
  Renaming an agent does not re-attribute their earlier orders.
- **Amount** is entered directly (there is no product catalogue). The server caps it at
  `MAX_AMOUNT` in `lib/order.js`.
- The site sends `X-Robots-Tag: noindex` and a disallow-all `robots.txt`.
