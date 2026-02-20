-- Fix NOT NULL constraints on optional card columns
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

ALTER TABLE cards ALTER COLUMN wrong_answer_1 DROP NOT NULL;
ALTER TABLE cards ALTER COLUMN wrong_answer_2 DROP NOT NULL;
ALTER TABLE cards ALTER COLUMN wrong_answer_3 DROP NOT NULL;
ALTER TABLE cards ALTER COLUMN explanation DROP NOT NULL;
ALTER TABLE cards ALTER COLUMN hint DROP NOT NULL;
ALTER TABLE cards ALTER COLUMN wrong_explanation_1 DROP NOT NULL;
ALTER TABLE cards ALTER COLUMN wrong_explanation_2 DROP NOT NULL;
ALTER TABLE cards ALTER COLUMN wrong_explanation_3 DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'cards'
ORDER BY ordinal_position;
