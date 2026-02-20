import { useState } from 'react'

interface CreateDeckModalProps {
  onClose: () => void
  onCreate: (name: string, description: string) => Promise<void>
}

export function CreateDeckModal({ onClose, onCreate }: CreateDeckModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await onCreate(name.trim(), description.trim())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Crear nuevo mazo</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Nombre del mazo *</label>
            <input
              className="form-input"
              type="text"
              placeholder="Ej: Anatomía, Bioquímica..."
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Descripción (opcional)</label>
            <input
              className="form-input"
              type="text"
              placeholder="Breve descripción del mazo"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? '⏳ Creando...' : 'Crear mazo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
