import { useState } from 'react'
import { useToast } from './Toast'

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}

export function LoginPage({ onSignIn, onSignUp }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isSignUp) {
        await onSignUp(email, password)
        toast('Cuenta creada. Revisa tu email para verificar.', 'success')
      } else {
        await onSignIn(email, password)
        toast('Bienvenido de vuelta!', 'success')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error de autenticación', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">📚</span>
          <h1>MemoFlash</h1>
        </div>
        <p className="auth-subtitle">
          {isSignUp ? 'Crea tu cuenta para empezar a aprender' : 'Inicia sesión en tu cuenta'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              className="form-input"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
            {loading ? '⏳ Cargando...' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="auth-toggle">
          {isSignUp ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
          <button onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </div>
      </div>
    </div>
  )
}
