-- Add mo_target column to monthly_app_configs table
ALTER TABLE weekly_app_configs 
ADD COLUMN IF NOT EXISTS mo_target numeric DEFAULT 0;

-- Also checking if monthly_app_configs exists as implied by the code, assuming it matches the context.tsx
-- context.tsx uses 'monthly_app_configs'
ALTER TABLE monthly_app_configs 
ADD COLUMN IF NOT EXISTS mo_target numeric DEFAULT 0;
