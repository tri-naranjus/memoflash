-- Confirmar todos los usuarios existentes que no estén confirmados
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- Verificar que los usuarios están confirmados
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
ORDER BY created_at DESC;
