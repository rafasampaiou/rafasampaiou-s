-- SQL Migration: Add occupied_uh_real and occupied_uh_meta to monthly_app_configs

ALTER TABLE monthly_app_configs 
ADD COLUMN IF NOT EXISTS occupied_uh_real numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS occupied_uh_meta numeric DEFAULT 0;

COMMENT ON COLUMN monthly_app_configs.occupied_uh_real IS 'UH Ocupada Real (Manual)';
COMMENT ON COLUMN monthly_app_configs.occupied_uh_meta IS 'UH Ocupada Meta (Manual)';
