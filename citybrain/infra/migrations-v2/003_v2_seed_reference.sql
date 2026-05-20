-- Reference data: Islamabad hospitals + rescue teams (demo)

INSERT INTO hospitals (name, code, lat, lng, beds_total, beds_available, ed_wait_minutes, metadata) VALUES
  ('Pakistan Institute of Medical Sciences (PIMS)', 'PIMS', 33.706, 73.055, 550, 42, 38, '{"region":"Islamabad"}'),
  ('Shifa International Hospital', 'SHIFA', 33.695, 73.045, 400, 88, 22, '{"region":"Islamabad"}'),
  ('Maroof International Hospital', 'MAROOF', 33.668, 73.032, 120, 31, 15, '{"region":"G-10"}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO rescue_teams (team_code, team_type, name, lat, lng, status, capacity, metadata) VALUES
  ('AMB-07', 'ambulance', 'Ambulance Unit 07 — Islamabad EMS', 33.684, 73.048, 'available', 2, '{}'),
  ('PUMP-03', 'pump', 'Flood Pump Unit 03', 33.672, 73.025, 'available', 1, '{}'),
  ('TOW-02', 'tow', 'Tow Truck 02', 33.655, 73.090, 'available', 1, '{}'),
  ('ENG-05', 'engineer', 'Grid Engineer Team 05', 33.648, 73.042, 'available', 4, '{}'),
  ('SHELTER-01', 'shelter', 'Cooling Shelter 01 — Margalla', 33.735, 73.062, 'available', 200, '{}')
ON CONFLICT (team_code) DO NOTHING;
