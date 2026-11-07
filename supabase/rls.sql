-- ============================================================================
-- Ghana Services App — Row Level Security (RLS) policies
--
-- SUPABASE ONLY. Run this file AFTER schema.sql, in the Supabase SQL
-- Editor. Do NOT run it on Neon or plain Postgres: the policies use
-- Supabase's auth.uid() and the `authenticated` role, which do not exist
-- anywhere else (the statements would fail).
--
-- The Node API (Stack 2) connects as the table owner, bypasses RLS, and
-- enforces the same rules in code (see api/routes/).
-- ============================================================================

alter table users            enable row level security;
alter table listings         enable row level security;
alter table service_requests enable row level security;
alter table reviews          enable row level security;

-- users: anyone can read public profiles (needed to show repairer names
-- and phone numbers on listings). A user can only create / edit their own.
drop policy if exists "users_select_all" on users;
create policy "users_select_all" on users
  for select using (true);

drop policy if exists "users_insert_own" on users;
create policy "users_insert_own" on users
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- listings: anyone can read. Only the owning repairer can write.
drop policy if exists "listings_select_all" on listings;
create policy "listings_select_all" on listings
  for select using (true);

drop policy if exists "listings_insert_own" on listings;
create policy "listings_insert_own" on listings
  for insert to authenticated with check (auth.uid() = repairer_id);

drop policy if exists "listings_update_own" on listings;
create policy "listings_update_own" on listings
  for update to authenticated using (auth.uid() = repairer_id)
  with check (auth.uid() = repairer_id);

drop policy if exists "listings_delete_own" on listings;
create policy "listings_delete_own" on listings
  for delete to authenticated using (auth.uid() = repairer_id);

-- service_requests: only the customer or the repairer involved can see
-- a request. The customer creates it; either side updates its status.
drop policy if exists "requests_select_involved" on service_requests;
create policy "requests_select_involved" on service_requests
  for select to authenticated
  using (auth.uid() = customer_id or auth.uid() = repairer_id);

drop policy if exists "requests_insert_customer" on service_requests;
create policy "requests_insert_customer" on service_requests
  for insert to authenticated with check (auth.uid() = customer_id);

drop policy if exists "requests_update_involved" on service_requests;
create policy "requests_update_involved" on service_requests
  for update to authenticated
  using (auth.uid() = customer_id or auth.uid() = repairer_id)
  with check (auth.uid() = customer_id or auth.uid() = repairer_id);

-- reviews: anyone can read. Only the customer of a COMPLETED request
-- can leave one review for it.
drop policy if exists "reviews_select_all" on reviews;
create policy "reviews_select_all" on reviews
  for select using (true);

drop policy if exists "reviews_insert_customer" on reviews;
create policy "reviews_insert_customer" on reviews
  for insert to authenticated
  with check (
    auth.uid() = customer_id
    and exists (
      select 1 from service_requests r
      where r.id = request_id
        and r.customer_id = auth.uid()
        and r.status = 'completed'
    )
  );
