-- MIGRATION V2 - RUN THIS IN SUPABASE SQL EDITOR
-- This ensures the table and column exist for MO Target (Meta de MO)

-- 1. Create table if it allows (Safety check)
CREATE TABLE IF NOT EXISTS monthly_app_configs (
  month_key text PRIMARY KEY,
  standard_hour_rate numeric DEFAULT 15.00,
  tax_rate numeric DEFAULT 0
);

-- 2. Add mo_target column (numeric for decimals)
ALTER TABLE monthly_app_configs 
ADD COLUMN IF NOT EXISTS mo_target numeric DEFAULT 0;

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
