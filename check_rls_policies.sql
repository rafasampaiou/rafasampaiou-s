-- Verificar todas as políticas RLS na tabela requests
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'requests';

-- Se não houver política de DELETE, criar uma
DO $$
BEGIN
    -- Remover política antiga se existir
    DROP POLICY IF EXISTS "Allow authenticated users to delete requests" ON requests;
    
    -- Criar nova política de DELETE
    CREATE POLICY "Allow authenticated users to delete requests"
    ON requests
    FOR DELETE
    TO authenticated
    USING (true);
    
    RAISE NOTICE 'Política de DELETE criada com sucesso!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao criar política: %', SQLERRM;
END $$;

-- Verificar novamente após criação
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'requests';
