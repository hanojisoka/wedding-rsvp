
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req) => {
  // Handle browser CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    )

    // GET: Retrieve guest information
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const token = url.searchParams.get('token')

      if (!token) {
        return jsonResponse({ error: 'Missing invitation token.' }, 400)
      }

      const { data: guest, error } = await supabase
        .from('guests')
        .select('name, will_attend')
        .eq('token', token)
        .maybeSingle()

      if (error) {
        console.error('Guest lookup error:', error)
        return jsonResponse({ error: 'Unable to retrieve invitation.' }, 500)
      }

      if (!guest) {
        return jsonResponse({ error: 'Invitation not found.' }, 404)
      }

      return jsonResponse({
        name: guest.name,
        willAttend: guest.will_attend,
      })
    }

    // POST: Save guest RSVP
    if (req.method === 'POST') {
      const body = await req.json()

      const { token, willAttend } = body

      if (!token || typeof willAttend !== 'boolean') {
        return jsonResponse({ error: 'Invalid RSVP information.' }, 400)
      }

      const { data: guest, error } = await supabase
        .from('guests')
        .update({
          will_attend: willAttend,
          responded_at: new Date().toISOString(),
        })
        .eq('token', token)
        .select('name, will_attend')
        .maybeSingle()

      if (error) {
        console.error('RSVP update error:', error)
        return jsonResponse({ error: 'Unable to save RSVP.' }, 500)
      }

      if (!guest) {
        return jsonResponse({ error: 'Invitation not found.' }, 404)
      }

      return jsonResponse({
        message: 'RSVP saved successfully!',
        name: guest.name,
        willAttend: guest.will_attend,
      })
    }

    return jsonResponse({ error: 'Method not allowed.' }, 405)

  } catch (error) {
    console.error('Unexpected RSVP error:', error)
    return jsonResponse({ error: 'An unexpected error occurred.' }, 500)
  }
})
