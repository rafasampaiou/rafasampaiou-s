-- MIGRATION V3 - TRIPLE MO TARGET
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_app_configs' AND column_name = 'mo_target_extra') THEN
        ALTER TABLE monthly_app_configs ADD COLUMN mo_target_extra numeric DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_app_configs' AND column_name = 'mo_target_clt') THEN
        ALTER TABLE monthly_app_configs ADD COLUMN mo_target_clt numeric DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_app_configs' AND column_name = 'mo_target_total') THEN
        ALTER TABLE monthly_app_configs ADD COLUMN mo_target_total numeric DEFAULT 0;
    END IF;
END
$$;

-- Add comments for clarity
COMMENT ON COLUMN monthly_app_configs.mo_target_extra IS 'Meta de MO / UH Extra';
COMMENT ON COLUMN monthly_app_configs.mo_target_clt IS 'Meta de MO / UH (Quadro CLT)';
COMMENT ON COLUMN monthly_app_configs.mo_target_total IS 'Meta de MO / UH (Total)';
