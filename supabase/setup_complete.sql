-- ============================================
-- MEMOFLASH: Setup COMPLETO y DEFINITIVO
-- Ejecuta esto en Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Pegar TODO > Run
-- ============================================

-- 1. CREAR TABLAS (sin foreign keys a auth.users)

CREATE TABLE IF NOT EXISTS decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  question text NOT NULL,
  correct_answer text NOT NULL,
  wrong_answer_1 text,
  wrong_answer_2 text,
  wrong_answer_3 text,
  explanation text,
  wrong_explanation_1 text,
  wrong_explanation_2 text,
  wrong_explanation_3 text,
  hint text,
  repetitions integer DEFAULT 0,
  interval integer DEFAULT 0,
  ease_factor numeric DEFAULT 2.5,
  next_review timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  quality integer NOT NULL,
  response_time_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. ELIMINAR TODAS las foreign keys a auth.users
ALTER TABLE decks DROP CONSTRAINT IF EXISTS decks_user_id_fkey;
ALTER TABLE card_reviews DROP CONSTRAINT IF EXISTS card_reviews_user_id_fkey;

-- 3. HABILITAR RLS
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;

-- 4. LIMPIAR políticas anteriores
DROP POLICY IF EXISTS "Users can view own decks" ON decks;
DROP POLICY IF EXISTS "Users can create own decks" ON decks;
DROP POLICY IF EXISTS "Users can update own decks" ON decks;
DROP POLICY IF EXISTS "Users can delete own decks" ON decks;
DROP POLICY IF EXISTS "Users can view cards in own decks" ON cards;
DROP POLICY IF EXISTS "Users can create cards in own decks" ON cards;
DROP POLICY IF EXISTS "Users can update cards in own decks" ON cards;
DROP POLICY IF EXISTS "Users can delete cards in own decks" ON cards;
DROP POLICY IF EXISTS "Users can view own reviews" ON card_reviews;
DROP POLICY IF EXISTS "Users can create own reviews" ON card_reviews;

-- 5. CREAR políticas RLS
CREATE POLICY "Users can view own decks" ON decks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own decks" ON decks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own decks" ON decks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own decks" ON decks
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view cards in own decks" ON cards
  FOR SELECT USING (deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid()));
CREATE POLICY "Users can create cards in own decks" ON cards
  FOR INSERT WITH CHECK (deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid()));
CREATE POLICY "Users can update cards in own decks" ON cards
  FOR UPDATE USING (deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete cards in own decks" ON cards
  FOR DELETE USING (deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own reviews" ON card_reviews
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own reviews" ON card_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. VERIFICAR que NO hay foreign keys a auth.users
SELECT conname, conrelid::regclass
FROM pg_constraint
WHERE confrelid = 'auth.users'::regclass
AND conrelid::regclass::text IN ('decks', 'card_reviews');

-- Si devuelve filas, hay que borrarlas manualmente
