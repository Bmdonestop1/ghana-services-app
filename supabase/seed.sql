-- ============================================================================
-- Ghana Services App — seed data (9 starter repairer listings)
--
-- Run AFTER schema.sql. Safe to re-run (ON CONFLICT DO NOTHING).
--
-- NOTE: these are SAMPLE listings so the app is usable immediately.
-- Seed repairers have no password and cannot log in. Real repairers must
-- register their own account and create their own listings; customers can
-- browse and contact the samples, and can send requests to them, but only
-- registered repairers can answer requests. Delete these rows any time
-- with:  delete from users where id between
--         '10000000-0000-4000-8000-000000000001' and
--         '10000000-0000-4000-8000-000000000009';
-- ============================================================================

insert into users (id, phone, name, role, region, city, whatsapp)
values
  ('10000000-0000-4000-8000-000000000001', '+233241000001', 'Kwame Mensah',   'repairer', 'Greater Accra', 'Accra',      '+233241000001'),
  ('10000000-0000-4000-8000-000000000002', '+233241000002', 'Ama Serwaa',     'repairer', 'Ashanti',       'Kumasi',     '+233241000002'),
  ('10000000-0000-4000-8000-000000000003', '+233241000003', 'Kofi Boateng',   'repairer', 'Western',       'Takoradi',   '+233241000003'),
  ('10000000-0000-4000-8000-000000000004', '+233241000004', 'Efua Asante',    'repairer', 'Greater Accra', 'Tema',       '+233241000004'),
  ('10000000-0000-4000-8000-000000000005', '+233241000005', 'Yaw Owusu',      'repairer', 'Central',       'Cape Coast', '+233241000005'),
  ('10000000-0000-4000-8000-000000000006', '+233241000006', 'Akosua Frimpong','repairer', 'Greater Accra', 'Accra',      '+233241000006'),
  ('10000000-0000-4000-8000-000000000007', '+233241000007', 'Kwabena Adjei',  'repairer', 'Northern',      'Tamale',     '+233241000007'),
  ('10000000-0000-4000-8000-000000000008', '+233241000008', 'Adwoa Osei',     'repairer', 'Ashanti',       'Kumasi',     '+233241000008'),
  ('10000000-0000-4000-8000-000000000009', '+233241000009', 'Esi Yankey',     'repairer', 'Western',       'Takoradi',   '+233241000009')
on conflict (phone) do nothing;

insert into listings (id, repairer_id, service_type, title, description, price, region, city)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'Phone Repair', 'Phone screen, battery & charging port repair',
   'Fast phone repairs: screen replacement, battery change, charging port and software fixes. Most phones ready same day.',
   80, 'Greater Accra', 'Accra'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   'Laptop / Computer Repair', 'Laptop screen, keyboard & software repair',
   'Laptop screen and keyboard replacement, battery, RAM upgrade, Windows installation and virus removal.',
   150, 'Ashanti', 'Kumasi'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003',
   'TV Repair', 'Flat-screen TV repair & wall mounting',
   'All flat-screen TV repairs: backlight, sound, no power, plus professional wall mounting.',
   120, 'Western', 'Takoradi'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004',
   'Fridge / AC Repair', 'Fridge gas refill & air conditioner servicing',
   'Fridge gas refill, thermostat repair, AC installation, servicing and repair. Home service available.',
   200, 'Greater Accra', 'Tema'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005',
   'Plumbing', 'Leaking pipes, toilets & water pump repair',
   'Fixing leaking pipes, toilet and sink installation, water pump repair and full bathroom plumbing.',
   100, 'Central', 'Cape Coast'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006',
   'Electrical', 'House wiring, sockets & breaker repair',
   'House wiring, socket and breaker replacement, ceiling fan and light installation. ECG-safe work.',
   90, 'Greater Accra', 'Accra'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007',
   'Mechanic', 'Car engine service, brakes & diagnostics',
   'Car engine servicing, brake repair, oil change and computer diagnostics for all car brands.',
   180, 'Northern', 'Tamale'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000008',
   'Beauty', 'Braids, wig installation, makeup & nails',
   'Braids, wig installation, bridal makeup and nails. Home service or walk-in at the salon.',
   60, 'Ashanti', 'Kumasi'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009',
   'Tailoring', 'Men & women clothing, alterations & kente',
   'Custom men and women clothing, quick alterations, kente and funeral cloth sewing.',
   70, 'Western', 'Takoradi')
on conflict (id) do nothing;
