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
  (portal)/orders/        agent totals + order history (scoped by role)
  (portal)/agents/        super admin: create, edit, activate, archive agents
  api/agents/             agent CRUD (super admin only; DELETE archives)
  api/auth/login|logout   session cookie set / clear
  api/charge              validates the order, calls NMI, saves the approved order
components/
  OrderForm.js            form state, submit → tokenise → charge
  CardFields.js           Collect.js inline iframes
  AgentsManager.js        super admin's staff table and forms
  AgentStats.js           per-agent totals table (day / month / year / all time)
  order/                  billing + shipping fields, summary and confirmation blocks
  PortalHeader.js, LoginForm.js, OrderHistory.js, PageHeader.js
  ui/                     Button, Field, Icons, Badge, Notice, Panel, Toast, spinners
lib/
  auth.js                 signed session cookie + the signed-in user (server only)
  users.js                users collection: roles, scrypt passwords, archiving
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
