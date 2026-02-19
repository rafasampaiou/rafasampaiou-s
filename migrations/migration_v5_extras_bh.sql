-- MIGRATION V5 - ADD EXTRAS DE BH COLUMNS
-- Run this in Supabase SQL Editor

-- 1. Add new columns to manual_real_stats
ALTER TABLE manual_real_stats 
ADD COLUMN IF NOT EXISTS lote_extras_bh_qty jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS lote_extras_bh_value jsonb DEFAULT '{}';

-- 2. Comentários para documentação
COMMENT ON COLUMN manual_real_stats.lote_extras_bh_qty IS 'Extras de BH (Quantidade) por Lote';
COMMENT ON COLUMN manual_real_stats.lote_extras_bh_value IS 'Extras de BH (Valor Pago) por Lote';
