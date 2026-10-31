// A stand-in API for trying the page without keys, and for the browser test.
// Enabled with ?fake in the URL. Jev picks the lowest need; Sonnet chats, makes one
// edit, and files one core request, so every chat kind appears.
var BL = window.BL = window.BL || {};

BL.createFakeApi = () => {
  let sonnetCalls = 0;
  const delay = (value) => new Promise(resolve => setTimeout(() => resolve(value), 300));

  const lowestNeed = (prompt, actions) => {
    const meters = [...prompt.matchAll(/(\w+): (\d+)/g)].map(m => [m[1], Number(m[2])]);
    const place = { food: 'bush', water: 'well', rest: 'shack', wood: 'tree' };
    const lowest = meters.filter(([m]) => actions.includes(place[m])).sort((a, b) => a[1] - b[1])[0];
    return lowest ? place[lowest[0]] : actions[0];
  };

  return {
    canCall: () => true,
    jev: (body) => {
      const actions = body.response_format.json_schema.schema.properties.action.enum;
      const action = lowestNeed(body.messages[1].content, actions);
      return delay({ choices: [{ message: { content: JSON.stringify({ thought: `(fake) my ${action} need is calling`, action }) } }] });
    },
    sonnet: (body) => {
      sonnetCalls += 1;
      const reply = {
        thought: `(fake) reflection number ${sonnetCalls}.`,
        say: sonnetCalls === 1 ? 'Hello, neighbour! (I am the fake mind; add API keys in settings for the real ones.)' : '',
        edits: sonnetCalls === 1 ? [{ comment: 'keep a notes definition', source: '# notes\n- `"I live near a well."`\n', delete: [] }] : [],
        core_request: sonnetCalls === 2 ? '(fake) Could the canvas show a little sun that moves with the ticks?' : '',
      };
      return delay({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply) }] });
    },
  };
};
