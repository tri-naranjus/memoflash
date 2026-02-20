-- ============================================
-- FIX: Eliminar foreign key constraint que bloquea inserts
-- Ejecuta esto en Supabase SQL Editor
-- ============================================

-- 1. Eliminar la foreign key constraint de decks
ALTER TABLE decks DROP CONSTRAINT IF EXISTS decks_user_id_fkey;

-- 2. Eliminar la foreign key constraint de card_reviews
ALTER TABLE card_reviews DROP CONSTRAINT IF EXISTS card_reviews_user_id_fkey;

-- 3. Verificar que se eliminaron
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f'
AND conrelid::regclass::text IN ('decks', 'cards', 'card_reviews');
