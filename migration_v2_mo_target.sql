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
