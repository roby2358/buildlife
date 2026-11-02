// Canvas drawing from the render contract (getRenderData). Places and the inhabitant are emoji
// chosen in the world MIAL (EMOJI, or a structure's own emoji field); anything without one is a
// generic shape (D-9, D-35).
var BL = window.BL = window.BL || {};

BL.createRenderer = (canvas) => {
  const ctx = canvas.getContext('2d');
  const shown = { x: null, y: null }; // the inhabitant's drawn position, eased toward its tile
  const PING_MS = 900;
  let pingAt = -Infinity; // when Jev last decided; a ring spreads from the inhabitant

  const COLORS = {
    ground: '#6aa84f', grid: '#5f9a46', label: '#16260f',
    other: '#7d8590',
    body: '#ffb347', eye: '#1c1f26', goal: 'rgba(255, 255, 255, 0.65)',
  };

  const circle = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // One grapheme only, so a model can't paint a sentence across the map.
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
  const firstGrapheme = (str) => {
    if (typeof str !== 'string' || !str.trim()) return '';
    if (!segmenter) return Array.from(str.trim())[0];
    const it = segmenter.segment(str.trim())[Symbol.iterator]().next();
    return it.done ? '' : it.value.segment;
  };

  const emoji = (ch, cx, cy, r) => {
    ctx.save();
    ctx.font = `${r * 1.5}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy);
    ctx.restore();
  };

  // A place with no emoji gets a generic labelled square (U-7).
  const generic = (cx, cy, r) => {
    ctx.fillStyle = COLORS.other;
    ctx.beginPath();
    ctx.roundRect(cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2, r * 0.2);
    ctx.fill();
  };

  const fitCanvas = () => {
    const size = Math.floor(Math.min(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight) * devicePixelRatio);
    if (size > 0 && canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
  };

  const draw = (data) => {
    fitCanvas();
    const size = canvas.width; // square: fitCanvas keeps width === height
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 0, size, size);
    if (!data.grid) return;
    const cells = Math.max(data.grid.w, data.grid.h);
    const tile = size / cells;
    const center = (t) => (t + 0.5) * tile;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * tile, 0); ctx.lineTo(i * tile, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * tile); ctx.lineTo(size, i * tile); ctx.stroke();
    }

    const inh = data.inhabitant;
    if (inh) {
      if (shown.x === null || Math.hypot(shown.x - inh.x, shown.y - inh.y) > 3) Object.assign(shown, { x: inh.x, y: inh.y });
      shown.x += (inh.x - shown.x) * 0.2;
      shown.y += (inh.y - shown.y) * 0.2;
    }

    const goal = inh && data.structures.find(s => s.name === inh.goal);
    if (goal) {
      ctx.strokeStyle = COLORS.goal;
      ctx.setLineDash([tile * 0.15, tile * 0.15]);
      ctx.lineWidth = Math.max(1, tile * 0.05);
      ctx.beginPath(); ctx.moveTo(center(shown.x), center(shown.y)); ctx.lineTo(center(goal.x), center(goal.y)); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.font = `${Math.max(10, tile * 0.24)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const s of data.structures) {
      const ch = firstGrapheme(s.emoji || (data.emoji || {})[s.name]);
      if (ch) emoji(ch, center(s.x), center(s.y), tile * 0.5);
      else generic(center(s.x), center(s.y), tile * 0.5);
      ctx.fillStyle = COLORS.label;
      ctx.fillText(s.name, center(s.x), center(s.y) + tile * 0.72);
    }

    if (inh) {
      const x = center(shown.x);
      const y = center(shown.y);
      // Decision ping: the only visible sign of a decision that leaves the inhabitant where it is.
      const age = (performance.now() - pingAt) / PING_MS;
      if (age >= 0 && age < 1) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - age)})`;
        ctx.lineWidth = Math.max(1, tile * 0.06);
        ctx.beginPath();
        ctx.arc(x, y, tile * (0.45 + 0.75 * age), 0, Math.PI * 2);
        ctx.stroke();
      }
      const ch = firstGrapheme((data.emoji || {}).inhabitant);
      if (ch) emoji(ch, x, y, tile * 0.45);
      else {
        circle(x, y, tile * 0.3, COLORS.body);
        circle(x - tile * 0.1, y - tile * 0.05, tile * 0.045, COLORS.eye);
        circle(x + tile * 0.1, y - tile * 0.05, tile * 0.045, COLORS.eye);
      }
    }
  };

  return { draw, ping: () => { pingAt = performance.now(); } };
};
