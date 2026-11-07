# Ghana Services App

A marketplace that connects **customers in Ghana** with **repair people** —
phone repair, laptop/computer repair, TV, fridge/AC, plumbing, electrical,
mechanic, beauty, tailoring and more. Prices in Ghana cedis (GH₵), locations
across all 16 Ghana regions. Both customers and repairers register.

**One codebase, two free deployment stacks** (pick either — the same app,
same features):

| | Stack 1 — Supabase + Cloudflare | Stack 2 — Render + Neon |
|---|---|---|
| Frontend | Cloudflare Pages (free, no sleep) | Render Static Site (free) |
| Backend | Supabase (Postgres + Auth, free) | Node.js API on Render (free, sleeps when idle) |
| Database | Supabase Postgres (free) | Neon Postgres (free) |
| Cost | $0 | $0 |

---

## Features

- **Register / log in** as a customer or a repairer (phone + password, name,
  region/city, phone/WhatsApp number).
- **Repairers** create, edit and delete service listings: service type,
  price in GH₵, city, region, description.
- **Customers** browse, search and filter listings by service type and
  region/city; listing detail shows Call and WhatsApp (`wa.me`) buttons.
- **Repair requests**: a customer sends a request; the repairer accepts,
  declines or marks it completed; the customer can cancel. Both sides see
  everything in **My Jobs**.
- **Ratings & reviews**: after a completed job, the customer leaves a star
  rating (1–5) and a comment; the average shows on the listing.
- **Seed data**: 9 starter repairer listings (phone, laptop, TV, fridge/AC,
  plumbing, electrical, mechanic, beauty, tailoring) across Accra, Kumasi,
  Takoradi, Tema, Cape Coast and Tamale, so the app is usable immediately.

---

## Project layout

```
ghana-services-app-deploy/
├── README.md                 # this file
├── .env.example              # placeholder settings (copy to .env, never real keys)
├── render.yaml               # Render blueprint for Stack 2
├── wrangler.toml             # Cloudflare Pages config for Stack 1
├── frontend/                 # mobile-first static app — no build step
│   ├── index.html
│   ├── styles.css
│   ├── app.js                # all UI logic (works with either adapter)
│   ├── config.js             # ★ EDIT THIS: pick 'supabase' or 'rest' + keys/URL
│   └── adapters/
│       ├── rest-adapter.js       # talks to the Node API (Stack 2)
│       └── supabase-adapter.js   # talks to Supabase directly (Stack 1)
├── api/                      # Node.js + Express + pg (Stack 2 backend)
│   ├── package.json
│   ├── server.js
│   ├── db.js
│   ├── auth.js               # JWT auth
│   └── routes/               # auth, listings, requests, reviews
└── supabase/
    ├── schema.sql            # tables + indexes (any Postgres)
    ├── rls.sql               # Row Level Security — Supabase ONLY
    └── seed.sql              # 9 starter repairers + listings
```

---

## Run it locally (before deploying)

You need **Node.js 18+** and any Postgres database (local Postgres, or a
free Neon/Supabase database — the same one you will deploy with).

```bash
# 1. Install the API dependencies
cd api && npm install && cd ..

# 2. Create your database, then run the schema + seed on it.
#    With psql:
psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/seed.sql

# 3. Settings for the API
cp .env.example .env
# Edit .env: set DATABASE_URL and JWT_SECRET (generate one with
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 4. Start the API (http://localhost:3000)
cd api && npm start

# 5. Serve the frontend (in a second terminal, from the repo root)
python3 -m http.server 8080 --directory frontend
# Open http://localhost:8080
```

`frontend/config.js` already points at the local API
(`BACKEND: 'rest'`, `API_URL: 'http://localhost:3000'`), so local
development works with no changes.

---

## Deploy — Stack 1: Supabase + Cloudflare Pages (recommended)

No server to keep awake; the frontend is static and the database/auth
live in Supabase. **No credit card needed for either free tier.**

### 1. Create a Supabase project (free)
1. Go to https://supabase.com → **Start your project** → New project.
2. Pick a name, a database password (save it), and a region close to Ghana
   (EU West is usually the closest available).
3. Wait for the project to finish setting up.

### 2. Create the tables
1. In Supabase: **SQL Editor → New query**.
2. Paste the whole contents of `supabase/schema.sql` → **Run**.
3. New query again, paste `supabase/rls.sql` → **Run** (this turns on Row
   Level Security so users can only see and change their own data).
4. New query again, paste `supabase/seed.sql` → **Run**.
5. You should see 9 users and 9 listings (Table Editor).

### 3. Turn OFF email confirmation (important)
The app logs in with **phone + password**. Supabase Auth is email-based,
so the app derives an email from the phone number
(`0241234567` → `233241234567@phone.ghanaservices.app`). Those emails
cannot receive mail, so confirmation must be off:
1. **Authentication → Providers → Email**.
2. Turn **OFF** "Confirm email". Save.
   (If you skip this, sign-up will fail with a message telling you to do it.)

### 4. Get your project keys
**Project Settings → API**: copy the **Project URL** and the **anon public**
key. The anon key is safe to put in the frontend — Row Level Security
protects the data.

### 5. Point the frontend at Supabase
Edit `frontend/config.js`:
```js
BACKEND: 'supabase',
SUPABASE_URL: 'https://your-project-ref.supabase.co',
SUPABASE_ANON_KEY: 'your-anon-public-key',
```

### 6. Publish on Cloudflare Pages (free)
1. Push this folder to a GitHub repo (see "Put the code on GitHub" below).
2. Go to https://dash.cloudflare.com → **Workers & Pages → Create →
   Pages → Connect to Git** → pick the repo.
3. **Build settings**: Framework preset **None**; **Build output
   directory: `frontend`**; no build command.
4. **Deploy**. Your app is live at `https://ghana-services-app.pages.dev`
   (you can add a custom domain later in Pages → Custom domains).

---

## Deploy — Stack 2: Render + Neon

A traditional server: the Node API runs on Render, the database on Neon.
**No credit card needed for either free tier.**

### 1. Create a Neon database (free)
1. Go to https://neon.tech → Sign up → New project.
2. Copy the **connection string** (it looks like
   `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).
3. In Neon's **SQL Editor**, run `supabase/schema.sql`, then
   `supabase/seed.sql` (same files — the schema works on any Postgres).
   Do **not** run `supabase/rls.sql` on Neon: it uses Supabase-only
   features (`auth.uid()`, the `authenticated` role).

### 2. Point the frontend at the API
Edit `frontend/config.js` — you will fill in the API URL after step 3:
```js
BACKEND: 'rest',
API_URL: 'https://ghana-services-api.onrender.com',
```

### 3. Deploy on Render with the blueprint
1. Push this folder to a GitHub repo (see below).
2. Go to https://dashboard.render.com → **New + → Blueprint** → connect
   the repo. Render reads `render.yaml` and creates two services:
   - `ghana-services-api` — Node web service (free)
   - `ghana-services-web` — static site serving `frontend/` (free)
3. When prompted, paste your Neon connection string as `DATABASE_URL`.
   (`JWT_SECRET` is generated for you.)
4. After the first deploy, copy the API service URL
   (`https://ghana-services-api.onrender.com`), put it in
   `frontend/config.js` as `API_URL`, commit and push — Render redeploys
   the static site automatically.
5. Optional: set the API's `FRONTEND_URL` env var to the static site URL
   so only your frontend can call the API.

> **Note:** Render's free web service **sleeps after 15 minutes without
> traffic** and takes about a minute to wake on the first request. That is
> normal on the free tier. If the app must always answer instantly, the
> paid Render plan is $7/month — or use Stack 1, which never sleeps.

---

## Put the code on GitHub (needed for both stacks)

```bash
cd ghana-services-app-deploy
git init
git add .
git commit -m "Ghana Services App"
# Create an empty repo on github.com first, then:
git remote add origin https://github.com/YOUR-USERNAME/ghana-services-app.git
git push -u origin main
```

---

## Free-tier limits to watch

| Service | Free tier | What happens at the limit |
|---|---|---|
| **Supabase** | 500 MB database, 1 GB file storage, 50,000 monthly active users, 5 GB bandwidth/mo | Project **pauses after 7 days with no database activity** — one click in the dashboard resumes it, data is kept. Database goes read-only over 500 MB. |
| **Cloudflare Pages** | Unlimited bandwidth & requests, 500 builds/mo | Nothing to watch for a small app. |
| **Render** (free) | 750 hours/mo, 512 MB RAM, sleeps after 15 idle min | First request after sleep takes ~1 min to wake. |
| **Neon** | 1 GB storage per project, 100 compute-hours/mo | Database scales to zero after 5 idle min and wakes on the next query (a few seconds). |
| **Firebase** (not used here) | Auth 50k users, Firestore 1 GiB — but Cloud Functions & Storage need the paid Blaze plan | — |

When the app grows: Supabase Pro is $25/mo; Render paid is $7/mo (API) +
$6/mo (Postgres). Both stacks keep working unchanged — only the plan
changes.

---

## Security notes (read before going live)

- **Seed listings are samples.** The 9 seed repairers have no password
  and cannot log in; they exist so customers can browse immediately. Real
  repairers register their own accounts. Delete the samples any time with
  the SQL in the comment at the top of `supabase/seed.sql`.
- **JWT_SECRET** must be long and random, and never committed. Render
  generates one for you; locally, keep it in `.env` only.
- **Supabase anon key** is public by design — the data is protected by
  the Row Level Security policies in `supabase/schema.sql`. Never put the
  `service_role` key in the frontend.
- **Phone numbers are login IDs.** Anyone who knows a repairer's phone
  number can try to log in, so the 6-character minimum password matters;
  consider a stronger minimum before launch.
- The API accepts cross-origin requests from `FRONTEND_URL` only when
  that is set; unset, it allows any origin (fine for local dev).

## Troubleshooting

- **"Could not load services" / blank listing page** — the frontend
  cannot reach the backend. Check `frontend/config.js` (`BACKEND` and
  the URL/key) and that the backend is up (`/api/health` should answer
  `{"ok":true}` for Stack 2).
- **Sign-up fails on Supabase** with a message about confirming email —
  turn off **Confirm email** (Step 3 of Stack 1).
- **Render API is slow on first request** — the free service was asleep;
  wait about a minute and retry.
- **Supabase project paused** — open the Supabase dashboard and click
  **Resume project** (pauses after 7 days of no database activity).
- **"Wrong phone number or password"** — phone numbers must match
  exactly how they were registered (spaces and dashes are ignored).
