// Network calls to OpenRouter (Jev) and Anthropic (Sonnet), straight from the browser.
// Plain fetch: this page runs from file:// with no bundler, so the SDKs aren't an option.
var BL = window.BL = window.BL || {};

BL.createApi = (getKeys) => {
  const errorMessage = async (res) => {
    try {
      const data = await res.json();
      return (data.error && (data.error.message || data.error)) || data.message || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status} ${res.statusText}`;
    }
  };

  const post = async (url, headers, body) => {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
  };

  return {
    canCall: (provider) => !!(provider === 'jev' ? getKeys().openrouter : getKeys().anthropic),

    jev: (body) => post('https://openrouter.ai/api/v1/chat/completions', {
      'Authorization': `Bearer ${getKeys().openrouter.trim()}`,
      'Content-Type': 'application/json',
      'X-Title': 'BuildLife',
    }, body),

    sonnet: (body) => post('https://api.anthropic.com/v1/messages', {
      'x-api-key': getKeys().anthropic.trim(),
      'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    }, body),
  };
};
