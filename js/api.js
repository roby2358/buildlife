// Network calls to OpenRouter (Jev, through its System One endpoint) and Anthropic (Sonnet), straight from the browser.
// Plain fetch: this page runs from file:// with no bundler, so the SDKs aren't an option.
var BL = window.BL = window.BL || {};

// Logs one request/response exchange as a collapsed console group when BL.logApi is on
// (a checkbox in Settings). Headers, and so the API keys, are never logged. Also used by the fake minds.
BL.logApi = true;
BL.logExchange = (label, body, outcome, ms) => {
  if (!BL.logApi) return;
  const failed = outcome instanceof Error;
  console.groupCollapsed(`%c${label}%c ${failed ? 'failed' : 'ok'} · ${Math.round(ms)} ms`,
    'font-weight:bold', failed ? 'color:#ff6b6b' : 'color:inherit');
  console.log('request', body);
  if (failed) console.error('error', outcome.message);
  else console.log('response', outcome);
  console.groupEnd();
};

BL.createApi = (getKeys) => {
  const errorMessage = async (res) => {
    try {
      const data = await res.json();
      return (data.error && (data.error.message || data.error)) || data.message || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status} ${res.statusText}`;
    }
  };

  const post = async (label, url, headers, body) => {
    const started = performance.now();
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await errorMessage(res));
      const data = await res.json();
      BL.logExchange(label, body, data, performance.now() - started);
      return data;
    } catch (e) {
      BL.logExchange(label, body, e, performance.now() - started);
      throw e;
    }
  };

  return {
    canCall: (provider) => !!(provider === 'jev' ? getKeys().openrouter : getKeys().anthropic),

    jev: (body) => post('Jev', 'https://openrouter.ai/api/v1/systemone', {
      'Authorization': `Bearer ${getKeys().openrouter.trim()}`,
      'Content-Type': 'application/json',
      'X-Title': 'BuildLife',
    }, body),

    sonnet: (body) => post(`Reflective mind (${body.model})`, 'https://api.anthropic.com/v1/messages', {
      'x-api-key': getKeys().anthropic.trim(),
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true',
      // on-demand compaction and its summary block (D-40); server-side refusal fallback when a model opts in (D-43)
      'anthropic-beta': ['compact-2026-09-04', ...(body.fallbacks ? ['server-side-fallback-2026-07-01'] : [])].join(','),
      'content-type': 'application/json',
    }, body),
  };
};
