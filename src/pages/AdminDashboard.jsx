
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'
import './AdminDashboard.css'

function AdminDashboard() {
  const navigate = useNavigate()

  const [guests, setGuests] = useState([])
  const [guestName, setGuestName] = useState('')
  const qrCanvases = useRef(new Map())
  const [editingGuestId, setEditingGuestId] = useState(null)
  const [editingGuestName, setEditingGuestName] = useState('')
  const [copyFeedback, setCopyFeedback] = useState(null)
  const copyFeedbackTimeout = useRef(null)

  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [savingGuest, setSavingGuest] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => {
    window.clearTimeout(copyFeedbackTimeout.current)
  }, [])

  // Check authentication and load guests
  useEffect(() => {
    let mounted = true

    async function initialize() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session) {
        navigate('/admin/login', { replace: true })
        return
      }

      await loadGuests()
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [navigate])

  // Retrieve guests from Supabase
  async function loadGuests() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setGuests(data)
    }

    setLoading(false)
  }

  // Add a new guest
  async function handleAddGuest(e) {
    e.preventDefault()

    if (!guestName.trim()) return

    setAdding(true)
    setError('')

    const { data, error } = await supabase
      .from('guests')
      .insert([
        {
          name: guestName.trim(),
        },
      ])
      .select()
      .single()

    if (error) {
      setError(error.message)
    } else {
      setGuests((current) => [data, ...current])
      setGuestName('')
    }

    setAdding(false)
  }

  function handleEditGuest(guest) {
    setError('')
    setEditingGuestId(guest.id)
    setEditingGuestName(guest.name)
  }

  async function handleSaveGuest(guest) {
    const name = editingGuestName.trim()
    if (!name) {
      setError('Guest name cannot be empty.')
      return
    }

    setSavingGuest(true)
    setError('')

    const { error } = await supabase
      .from('guests')
      .update({ name })
      .eq('id', guest.id)

    if (error) {
      setError(error.message)
      setSavingGuest(false)
      return
    }

    setGuests((current) =>
      current.map((currentGuest) =>
        currentGuest.id === guest.id
          ? { ...currentGuest, name }
          : currentGuest
      )
    )
    setEditingGuestId(null)
    setEditingGuestName('')
    setSavingGuest(false)
  }

  function handleCancelEdit() {
    setEditingGuestId(null)
    setEditingGuestName('')
    setError('')
  }

  // Delete a guest
  async function handleDeleteGuest(id) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this guest?'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('guests')
      .delete()
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    setGuests((current) =>
      current.filter((guest) => guest.id !== id)
    )
  }

  function handleDownloadQr(guest) {
    const canvas = qrCanvases.current.get(guest.id)
    if (!canvas) return

    const safeName = guest.name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'Guest'
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `${safeName}-QR.png`
    link.click()
  }

  async function handleCopyLink(guest, invitationUrl) {
    window.clearTimeout(copyFeedbackTimeout.current)

    try {
      await navigator.clipboard.writeText(invitationUrl)
      setCopyFeedback({
        guestId: guest.id,
        message: 'Link copied!',
      })
    } catch {
      setCopyFeedback({
        guestId: guest.id,
        message: 'Could not copy link. Please copy the URL above.',
      })
    }

    copyFeedbackTimeout.current = window.setTimeout(() => {
      setCopyFeedback(null)
    }, 3000)
  }

  // Logout
  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  const attending = guests.filter(
    (guest) => guest.will_attend === true
  ).length

  const declined = guests.filter(
    (guest) => guest.will_attend === false
  ).length

  const pending = guests.filter(
    (guest) => guest.will_attend === null
  ).length

  return (
    <main className="admin-dashboard">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">WEDDING RSVP</p>
          <h1>Guest Management</h1>
          <p className="admin-subtitle">A little overview of your celebration.</p>
        </div>

        <button className="admin-button admin-button-secondary" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {/* RSVP Statistics */}
      <section className="admin-stats" aria-label="RSVP statistics">
        <article className="admin-stat-card admin-stat-total">
          <h2>{guests.length}</h2>
          <p>Total Guests</p>
        </article>

        <article className="admin-stat-card admin-stat-attending">
          <h2>{attending}</h2>
          <p>Attending</p>
        </article>

        <article className="admin-stat-card admin-stat-declined">
          <h2>{declined}</h2>
          <p>Declined</p>
        </article>

        <article className="admin-stat-card admin-stat-pending">
          <h2>{pending}</h2>
          <p>Pending</p>
        </article>
      </section>

      {/* Add Guest Form */}
      <section className="admin-panel admin-add-guest">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">YOUR GUEST LIST</p>
            <h2>Add a guest</h2>
          </div>
        </div>

        <form onSubmit={handleAddGuest}>
          <input
            className="admin-input"
            type="text"
            placeholder="Enter guest name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
          />

          <button className="admin-button admin-button-primary" type="submit" disabled={adding}>
            {adding ? 'Adding...' : 'Add Guest'}
          </button>
        </form>
      </section>

      {error && (
        <p className="admin-error" role="alert">{error}</p>
      )}

      {/* Guest List */}
      <section className="admin-panel admin-guest-list">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">EVERYONE IN ONE PLACE</p>
            <h2>Guest list</h2>
          </div>
          <span className="admin-guest-count">
            {guests.length} {guests.length === 1 ? 'guest' : 'guests'}
          </span>
        </div>

        {loading ? (
          <p className="admin-empty-state">Loading guests...</p>
        ) : guests.length === 0 ? (
          <p className="admin-empty-state">No guests added yet. Add your first guest above to get started.</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th align="left">Name</th>
                  <th align="left">RSVP Status</th>
                  <th align="left">Invitation Token</th>
                  <th align="left">QR Code</th>
                  <th align="left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {guests.map((guest) => {
                  const invitationUrl = `${window.location.origin}/rsvp/${guest.token}`

                  return (
                  <tr key={guest.id}>
                    <td>
                      {editingGuestId === guest.id ? (
                        <input
                          className="admin-input admin-name-input"
                          type="text"
                          value={editingGuestName}
                          onChange={(e) => setEditingGuestName(e.target.value)}
                          aria-label={`Edit name for ${guest.name}`}
                          autoFocus
                        />
                      ) : <span className="admin-guest-name">{guest.name}</span>}
                    </td>

                    <td>
                      <span className={`admin-status ${
                        guest.will_attend === true
                          ? 'admin-status-attending'
                          : guest.will_attend === false
                            ? 'admin-status-declined'
                            : 'admin-status-pending'
                      }`}>
                        {guest.will_attend === true
                          ? 'Attending'
                          : guest.will_attend === false
                            ? 'Declined'
                            : 'Pending'}
                      </span>
                    </td>

                    <td>
                      <code className="admin-token">{guest.token}</code>
                    </td>

                    <td>
                      <div className="admin-qr-content">
                        <QRCodeCanvas
                          ref={(canvas) => {
                            if (canvas) {
                              qrCanvases.current.set(guest.id, canvas)
                            } else {
                              qrCanvases.current.delete(guest.id)
                            }
                          }}
                          value={invitationUrl}
                          size={150}
                          level="H"
                          includeMargin
                        />
                        <div className="admin-invitation-url">
                          <a href={invitationUrl}>{invitationUrl}</a>
                        </div>
                        <div className="admin-qr-actions">
                          <button
                            className="admin-button admin-button-primary"
                            type="button"
                            onClick={() => handleCopyLink(guest, invitationUrl)}
                          >
                            Copy Link
                          </button>
                          <button
                            className="admin-button admin-button-secondary"
                            type="button"
                            onClick={() => handleDownloadQr(guest)}
                          >
                            Download QR
                          </button>
                        </div>
                        {copyFeedback?.guestId === guest.id && (
                          <p className={`admin-copy-feedback ${
                            copyFeedback.message === 'Link copied!'
                              ? 'admin-copy-success'
                              : 'admin-copy-error'
                          }`} aria-live="polite">{copyFeedback.message}</p>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="admin-row-actions">
                      {editingGuestId === guest.id ? (
                        <>
                          <button
                            className="admin-button admin-button-primary"
                            type="button"
                            onClick={() => handleSaveGuest(guest)}
                            disabled={savingGuest}
                          >
                            Save
                          </button>
                          <button
                            className="admin-button admin-button-secondary"
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={savingGuest}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="admin-button admin-button-secondary"
                          type="button"
                          onClick={() => handleEditGuest(guest)}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        className="admin-button admin-button-danger"
                        type="button"
                        onClick={() => handleDeleteGuest(guest.id)}
                        disabled={editingGuestId === guest.id && savingGuest}
                      >
                        Delete
                      </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </main>
  )
}

export default AdminDashboard
