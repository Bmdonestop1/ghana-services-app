-- ============================================================================
-- Ghana Services App — database schema
-- Works on Supabase Postgres AND on Neon / any Postgres (used by the
-- Node API on Render). Run this file once on a fresh database.
--
-- Tables: users, listings, service_requests, reviews
-- This file is pure DDL and runs on ANY Postgres (Supabase, Neon, local).
-- Row Level Security lives in rls.sql — run that file ONLY on Supabase.
-- The Node API connects as the table owner and enforces the same access
-- rules in code (see api/routes/), so it does not need RLS.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users: both customers and repairers.
--   * Supabase mode: id = Supabase Auth user id (auth.users). A profile row
--     is created right after sign-up. password_hash stays NULL.
--   * REST (Render/Neon) mode: id is generated here, password_hash holds a
--     bcrypt hash. The API creates the row at registration.
-- ---------------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null,
  name          text not null,
  role          text not null check (role in ('customer', 'repairer')),
  region        text not null,
  city          text not null,
  whatsapp      text,
  password_hash text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- listings: services offered by a repairer.
-- ---------------------------------------------------------------------------
create table if not exists listings (
  id           uuid primary key default gen_random_uuid(),
  repairer_id  uuid not null references users(id) on delete cascade,
  service_type text not null,
  title        text not null,
  description  text not null default '',
  price        numeric(10, 2) not null check (price >= 0),
  region       text not null,
  city         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- service_requests: a customer asks a repairer to do a job.
--   status: pending -> accepted | declined
--           accepted -> completed | cancelled
--           pending  -> cancelled (by the customer)
-- ---------------------------------------------------------------------------
create table if not exists service_requests (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  customer_id uuid not null references users(id) on delete cascade,
  repairer_id uuid not null references users(id) on delete cascade,
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  message     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reviews: one review per completed request, left by the customer.
-- ---------------------------------------------------------------------------
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null unique references service_requests(id) on delete cascade,
  listing_id  uuid not null references listings(id) on delete cascade,
  repairer_id uuid not null references users(id) on delete cascade,
  customer_id uuid not null references users(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text not null default '',
  created_at  timestamptz not null default now()
);

-- Indexes for the common filters.
create index if not exists listings_service_type_idx on listings (service_type);
create index if not exists listings_region_idx       on listings (region);
create index if not exists listings_repairer_idx     on listings (repairer_id);
create index if not exists requests_customer_idx     on service_requests (customer_id);
create index if not exists requests_repairer_idx     on service_requests (repairer_id);
create index if not exists requests_listing_idx      on service_requests (listing_id);
create index if not exists reviews_listing_idx       on reviews (listing_id);
create index if not exists reviews_repairer_idx      on reviews (repairer_id);
