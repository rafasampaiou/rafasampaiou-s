-- DEFINITIVE FIX FOR MISSING COLUMNS
-- Run this in Supabase SQL Editor to ensure all columns exist

-- 1. Add Occupancy Deviation (Desvio de Ocupação)
ALTER TABLE monthly_app_configs 
ADD COLUMN IF NOT EXISTS occupancy_deviation numeric DEFAULT 0;

-- 2. Add Occupied UH Columns (UH Ocupada Real e Meta)
ALTER TABLE monthly_app_configs 
ADD COLUMN IF NOT EXISTS occupied_uh_real numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS occupied_uh_meta numeric DEFAULT 0;

-- 3. Add Triple MO Target Columns (Just in case)
ALTER TABLE monthly_app_configs 
ADD COLUMN IF NOT EXISTS mo_target_extra numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS mo_target_clt numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS mo_target_total numeric DEFAULT 0;

-- 4. Set Permissions (Crucial for 400 Bad Request errors)
GRANT ALL ON monthly_app_configs TO authenticated;
GRANT ALL ON monthly_app_configs TO service_role;

-- 5. Force Schema Cache Refresh (Notify PostgREST)
NOTIFY pgrst, 'reload config';

-- 6. Add Comments for Clarity
COMMENT ON COLUMN monthly_app_configs.occupancy_deviation IS 'Desvio da ocupação (% -50 a +50)';
COMMENT ON COLUMN monthly_app_configs.occupied_uh_real IS 'UH Ocupada Real (Manual)';
COMMENT ON COLUMN monthly_app_configs.occupied_uh_meta IS 'UH Ocupada Meta (Manual)';
