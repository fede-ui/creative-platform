// ─── api/state.js ──────────────────────────────────────────────────────────────
// Shared backend for the whole app's data (clients, feedback, mastersheet,
// resources, batches, options) so everyone with the link sees the same data
// instead of each browser having its own private localStorage copy.
//
// Backed by Vercel KV (a small Redis-like store, Upstash under the hood).
// Setup needed once, in the Vercel dashboard: Storage tab -> Create Database
// -> KV -> Connect to this project. That automatically sets the
// KV_REST_API_URL / KV_REST_API_TOKEN environment variables used below —
// nothing to type in manually, no separate account needed.
//
// Until that's connected, this endpoint returns a clear error and the app
// falls back to working from localStorage only (same as before).

const STATE_KEY = 'ci_shared_state_v1';

module.exports = async function handler(req, res) {
  const baseUrl = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!baseUrl || !token) {
    res.status(500).json({
      error: 'Shared storage is not connected yet. In Vercel: Storage tab -> Create Database -> KV -> Connect to this project, then redeploy.'
    });
    return;
  }

  if (req.method === 'GET') {
    try {
      const kvResp = await fetch(baseUrl + '/get/' + STATE_KEY, {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await kvResp.json();
      let state = null;
      if (data && data.result) {
        try { state = JSON.parse(data.result); } catch (e) { state = null; }
      }
      res.status(200).json({ state: state });
    } catch (err) {
      res.status(500).json({ error: 'Failed to read shared state: ' + err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    if (!body.state) {
      res.status(400).json({ error: 'Missing "state" in request body.' });
      return;
    }

    try {
      const kvResp = await fetch(baseUrl + '/set/' + STATE_KEY, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(body.state)
      });
      if (!kvResp.ok) {
        const errText = await kvResp.text();
        res.status(500).json({ error: 'Shared storage write failed: ' + errText });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save shared state: ' + err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
};
