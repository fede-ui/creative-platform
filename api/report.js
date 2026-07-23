// ─── api/report.js ────────────────────────────────────────────────────────────
// Serverless proxy for written-report generation (Analysis -> "Written report" tab).
// Keeps ANTHROPIC_API_KEY on the server — the browser never sees it.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const prompt = body.prompt;
  const maxTokens = body.maxTokens || 1000;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing "prompt" string in request body.' });
    return;
  }

  try {
    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await anthropicResp.json();

    if (!anthropicResp.ok) {
      const msg = (data && data.error && data.error.message) || 'Anthropic API error.';
      res.status(anthropicResp.status).json({ error: msg });
      return;
    }

    const text = (data.content || []).map(function (b) { return b.text || ''; }).join('\n');
    res.status(200).json({ text: text });
  } catch (err) {
    res.status(500).json({ error: 'Request to Anthropic API failed: ' + err.message });
  }
};
