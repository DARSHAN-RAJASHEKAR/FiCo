const ALLOWED_MODEL = 'google/gemini-2.5-flash:standard';
const MAX_TOKENS = 4096;
const MAX_BODY_BYTES = 2_000_000; // 2 MB max (images need more room)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  // Enforce body size limit
  const bodyStr = JSON.stringify(req.body);
  if (bodyStr.length > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request body too large' });
  }

  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: messages required' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers['origin'] || 'https://fico.vercel.app',
        'X-Title': 'FiCo Document Analyzer',
      },
      // Enforce model and max_tokens server-side — client cannot override
      body: JSON.stringify({
        model: ALLOWED_MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
