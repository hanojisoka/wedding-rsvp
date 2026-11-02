
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'

function AdminDashboard() {
  const navigate = useNavigate()

  const [guests, setGuests] = useState([])
  const [guestName, setGuestName] = useState('')
  const qrCanvases = useRef(new Map())
  const [editingGuestId, setEditingGuestId] = useState(null)
  const [editingGuestName, setEditingGuestName] = useState('')

  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [savingGuest, setSavingGuest] = useState(false)
  const [error, setError] = useState('')

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
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>

      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <h1>Guest Management</h1>

        <button onClick={handleLogout}>
          Logout
        </button>
      </header>

      {/* RSVP Statistics */}
      <div style={{
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        marginBottom: '32px'
      }}>
        <div>
          <h2>{guests.length}</h2>
          <p>Total Guests</p>
        </div>

        <div>
          <h2>{attending}</h2>
          <p>Attending</p>
        </div>

        <div>
          <h2>{declined}</h2>
          <p>Declined</p>
        </div>

        <div>
          <h2>{pending}</h2>
          <p>Pending</p>
        </div>
      </div>

      {/* Add Guest Form */}
      <section style={{ marginBottom: '32px' }}>
        <h2>Add Guest</h2>

        <form onSubmit={handleAddGuest}>
          <input
            type="text"
            placeholder="Enter guest name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
          />

          <button type="submit" disabled={adding}>
            {adding ? 'Adding...' : 'Add Guest'}
          </button>
        </form>
      </section>

      {error && (
        <p style={{ color: 'red' }}>{error}</p>
      )}

      {/* Guest List */}
      <section>
        <h2>Guest List</h2>

        {loading ? (
          <p>Loading guests...</p>
        ) : guests.length === 0 ? (
          <p>No guests added yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
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
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td>
                      {editingGuestId === guest.id ? (
                        <input
                          type="text"
                          value={editingGuestName}
                          onChange={(e) => setEditingGuestName(e.target.value)}
                          aria-label={`Edit name for ${guest.name}`}
                          autoFocus
                        />
                      ) : guest.name}
                    </td>

                    <td>
                      {guest.will_attend === true
                        ? 'Attending'
                        : guest.will_attend === false
                          ? 'Declined'
                          : 'Pending'}
                    </td>

                    <td>
                      <code>{guest.token}</code>
                    </td>

                    <td>
                      <div>
                        <QRCodeCanvas
                          ref={(canvas) => {
                            if (canvas) {
                              qrCanvases.current.set(guest.id, canvas)
                            } else {
                              qrCanvases.current.delete(guest.id)
                            }
                          }}
                          value={`${window.location.origin}/rsvp/${guest.token}`}
                          size={150}
                          level="H"
                          includeMargin
                        />
                        <div>
                          <button onClick={() => handleDownloadQr(guest)}>
                            Download QR
                          </button>
                        </div>
                      </div>
                    </td>

                    <td>
                      {editingGuestId === guest.id ? (
                        <>
                          <button
                            onClick={() => handleSaveGuest(guest)}
                            disabled={savingGuest}
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={savingGuest}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleEditGuest(guest)}>
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteGuest(guest.id)}
                        disabled={editingGuestId === guest.id && savingGuest}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}

export default AdminDashboard
