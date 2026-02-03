-- MIGRATION V2 - RUN THIS IN SUPABASE SQL EDITOR
-- This ensures the table and column exist for MO Target (Meta de MO)

-- 1. Create table if it allows (Safety check)
CREATE TABLE IF NOT EXISTS monthly_app_configs (
  month_key text PRIMARY KEY,
  standard_hour_rate numeric DEFAULT 15.00,
  tax_rate numeric DEFAULT 0
);

-- 2. Add mo_target columns (numeric for decimals)
ALTER TABLE monthly_app_configs 
ADD COLUMN IF NOT EXISTS mo_target numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS mo_target_extra numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS mo_target_clt numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS mo_target_total numeric DEFAULT 0;

-- 3. Verify settings / Add Comments
COMMENT ON COLUMN monthly_app_configs.mo_target IS 'Meta de MO por UH Ocupada (ex: 2.18)';

-- 4. Security Policies (RLS)
ALTER TABLE monthly_app_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'monthly_app_configs' AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" 
        ON monthly_app_configs FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END
$$;

-- 5. Monthly Budgets Persistence Fix (clt_budget_qty and clt_budget_value)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_budgets' AND column_name = 'clt_budget_qty') THEN
        ALTER TABLE monthly_budgets ADD COLUMN clt_budget_qty numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_budgets' AND column_name = 'clt_budget_value') THEN
        ALTER TABLE monthly_budgets ADD COLUMN clt_budget_value numeric DEFAULT 0;
    END IF;
END
$$;

-- 6. Ensure RLS allows saves to monthly_budgets
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

-- Drop old/restrictive policies
DROP POLICY IF EXISTS "Allow all access to monthly_budgets" ON monthly_budgets;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON monthly_budgets;
DROP POLICY IF EXISTS "Enable read access for all users" ON monthly_budgets;

-- Create permissive policy for authenticated users
CREATE POLICY "Allow all access to monthly_budgets"
ON monthly_budgets
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Explicit Grants
GRANT ALL ON monthly_budgets TO authenticated;
GRANT ALL ON monthly_app_configs TO authenticated;

-- 8. WFO & MANUAL REAL STATS PERSISTENCE FIX
-- This ensures the manual_real_stats table has the correct PK and JSON support
DROP TABLE IF EXISTS manual_real_stats CASCADE;

CREATE TABLE manual_real_stats (
    sector_id uuid REFERENCES sectors(id) ON DELETE CASCADE,
    month_key text NOT NULL,
    real_qty numeric DEFAULT 0,
    real_value numeric DEFAULT 0,
    afastados_qty numeric DEFAULT 0,
    apprentices_qty numeric DEFAULT 0,
    wfo_qty numeric DEFAULT 0,
    wfo_lotes_json jsonb DEFAULT '{}',
    PRIMARY KEY (sector_id, month_key)
);

-- Reset RLS and Policies for manual_real_stats
ALTER TABLE manual_real_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to manual_real_stats" 
ON manual_real_stats FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

GRANT ALL ON manual_real_stats TO authenticated;
GRANT ALL ON manual_real_stats TO service_role;

