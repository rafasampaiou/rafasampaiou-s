-- SQL Migration: Add occupancy_deviation to monthly_app_configs

ALTER TABLE monthly_app_configs 
ADD COLUMN IF NOT EXISTS occupancy_deviation NUMERIC DEFAULT 0;

COMMENT ON COLUMN monthly_app_configs.occupancy_deviation IS 'Desvio da ocupação em relação a meta (% -50 a +50)';
