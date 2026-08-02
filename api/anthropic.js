// Proxies Anthropic Messages API calls so ANTHROPIC_API_KEY never reaches the
// client. Validates the caller's Supabase session first (service-role key,
// used only to check who's calling — never touches app_state directly).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'missing token' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supa.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'invalid session' });

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (e) {
    console.error('anthropic proxy error:', e);
    res.status(500).json({ error: 'proxy failed' });
  }
}
