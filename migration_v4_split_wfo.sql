-- MIGRATION V4 - SPLIT WFO BASES
-- Run this in Supabase SQL Editor

-- 1. Add new columns to manual_real_stats
ALTER TABLE manual_real_stats 
ADD COLUMN IF NOT EXISTS wfo_qty_lotes_json jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS wfo_value_lotes_json jsonb DEFAULT '{}';

-- 2. Migração de dados (Opcional: migra o que já existia no wfo_lotes_json original para o qty)
UPDATE manual_real_stats 
SET wfo_qty_lotes_json = wfo_lotes_json
WHERE wfo_lotes_json IS NOT NULL AND wfo_qty_lotes_json = '{}';

-- 3. Comentários para documentação
COMMENT ON COLUMN manual_real_stats.wfo_qty_lotes_json IS 'Metas de WFO (Quantidade) por Lote';
COMMENT ON COLUMN manual_real_stats.wfo_value_lotes_json IS 'Metas de WFO (Valor Pago) por Lote';
