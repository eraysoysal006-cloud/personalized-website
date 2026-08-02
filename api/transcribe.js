// Proxies Groq Whisper transcription so GROQ_API_KEY never reaches the
// client. Edge runtime specifically: native request.formData() handles the
// audio blob without needing a multipart-parsing dependency, and JWT
// verification goes through Supabase's REST auth endpoint directly since
// the full @supabase/supabase-js SDK doesn't import cleanly on Edge.
export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return new Response('missing token', { status: 401 });

  try {
    const authResp = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + token,
      },
    });
    if (!authResp.ok) return new Response('invalid session', { status: 401 });

    const form = await request.formData();
    const groqResp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
      body: form,
    });
    const text = await groqResp.text();
    return new Response(text, {
      status: groqResp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
