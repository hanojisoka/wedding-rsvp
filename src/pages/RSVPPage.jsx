
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import './RSVPPage.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function InvitationVideo() {
  const [videoAvailable, setVideoAvailable] = useState(true)

  if (!videoAvailable) {
    return (
      <p className="rsvp-video-fallback" role="status">
        The invitation video is unavailable right now.
      </p>
    )
  }

  return (
    <div className="rsvp-video-container">
      <video
        className="rsvp-video"
        src="/videos/wedding-invitation.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        onError={() => setVideoAvailable(false)}
      />
    </div>
  )
}

function RSVPPage() {
  const { token } = useParams()
  const audioRef = useRef(null)

  const [guest, setGuest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [musicNeedsInteraction, setMusicNeedsInteraction] = useState(false)
  const [musicError, setMusicError] = useState('')

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    let cancelled = false
    let listeningForInteraction = false

    function removeInteractionListeners() {
      if (!listeningForInteraction) return
      window.removeEventListener('click', tryPlayMusic)
      window.removeEventListener('touchstart', tryPlayMusic)
      window.removeEventListener('keydown', tryPlayMusic)
      listeningForInteraction = false
    }

    function listenForInteraction() {
      if (listeningForInteraction) return
      window.addEventListener('click', tryPlayMusic)
      window.addEventListener('touchstart', tryPlayMusic)
      window.addEventListener('keydown', tryPlayMusic)
      listeningForInteraction = true
    }

    async function tryPlayMusic() {
      try {
        await audio.play()
        if (cancelled) return
        setMusicNeedsInteraction(false)
        setMusicError('')
        removeInteractionListeners()
      } catch {
        if (!cancelled) {
          setMusicNeedsInteraction(true)
          listenForInteraction()
        }
      }
    }

    void tryPlayMusic()

    return () => {
      cancelled = true
      removeInteractionListeners()
    }
  }, [])

  // Retrieve guest information
  useEffect(() => {
    let cancelled = false

    async function loadGuest() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/rsvp?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
            headers: {
              apikey: SUPABASE_KEY,
            },
          }
        )

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Unable to load invitation.')
        }

        if (!cancelled) {
          setGuest(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadGuest()

    return () => {
      cancelled = true
    }
  }, [token])

  // Submit RSVP response
  async function handleRSVP(willAttend) {
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/rsvp`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            willAttend,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Unable to save RSVP.')
      }

      setGuest(result)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rsvp-page">
      <div className="rsvp-card">

        <InvitationVideo />

        <audio
          ref={audioRef}
          src="/audio/wedding-music.mp3"
          loop
          preload="none"
          onError={() => {
            setMusicNeedsInteraction(false)
            setMusicError('Wedding music could not be loaded.')
          }}
        />
        {musicNeedsInteraction && !musicError && (
          <p className="rsvp-music-prompt" role="status">
            Tap anywhere to enable music ♫
          </p>
        )}
        {musicError && (
          <p className="rsvp-music-error" role="status">{musicError}</p>
        )}

        {loading ? (
          <p>Loading your invitation...</p>
        ) : !guest ? (
          <>
            <h1>Invitation Not Found</h1>
            <p>
              Sorry, we couldn't find your invitation.
              Please check your QR code or contact us.
            </p>
          </>
        ) : (
          <>
            <p className="rsvp-subtitle">
              YOU'RE INVITED
            </p>

            <div className="rsvp-divider">
              ✦
            </div>

            <p className="rsvp-greeting">
              Dear {guest.name},
            </p>

            <p className="rsvp-message">
              We would love to celebrate this special
              day with you!
            </p>

            {guest.willAttend !== null && !editing ? (
              <div className="rsvp-confirmation">

                <h2>
                  {guest.willAttend
                    ? "We're excited to see you!"
                    : "Thank you for letting us know."}
                </h2>

                <p>
                  Your response:
                  <strong>
                    {guest.willAttend
                      ? " Yes, I'll attend."
                      : " Sorry, I can't make it."}
                  </strong>
                </p>

                <button
                  className="rsvp-secondary-button"
                  onClick={() => setEditing(true)}
                >
                  Change My Response
                </button>

              </div>
            ) : (
              <div className="rsvp-form">

                <h2>Will you be joining us?</h2>

                <button
                  className="rsvp-yes-button"
                  disabled={submitting}
                  onClick={() => handleRSVP(true)}
                >
                  {submitting ? 'Saving...' : "Yes, I'll be there!"}
                </button>

                <button
                  className="rsvp-no-button"
                  disabled={submitting}
                  onClick={() => handleRSVP(false)}
                >
                  {submitting ? 'Saving...' : "Sorry, I can't make it"}
                </button>

              </div>
            )}

            {error && (
              <p className="rsvp-error">{error}</p>
            )}

            <div className="rsvp-footer">
              <p>We hope to celebrate with you!</p>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default RSVPPage
