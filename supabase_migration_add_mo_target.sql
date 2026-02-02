-- 1. Create table if it doesn't exist (Safety check)
CREATE TABLE IF NOT EXISTS monthly_app_configs (
  month_key text PRIMARY KEY,
  standard_hour_rate numeric,
  tax_rate numeric
);

-- 2. Add the missing column 'mo_target'
ALTER TABLE monthly_app_configs 
ADD COLUMN IF NOT EXISTS mo_target numeric DEFAULT 0;

-- 3. Enable RLS (Security) - Optional but recommended
ALTER TABLE monthly_app_configs ENABLE ROW LEVEL SECURITY;

-- 4. Create Policy to allow access (if not exists)
-- This uses a DO block to avoid errors if policy already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'monthly_app_configs'
        AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" 
        ON monthly_app_configs 
        FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END
$$;
