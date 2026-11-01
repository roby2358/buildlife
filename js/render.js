// Canvas drawing from the render contract (getRenderData). Simple shapes only (D-9).
var BL = window.BL = window.BL || {};

BL.createRenderer = (canvas) => {
  const ctx = canvas.getContext('2d');
  const shown = { x: null, y: null }; // the inhabitant's drawn position, eased toward its tile

  const COLORS = {
    ground: '#6aa84f', grid: '#5f9a46', label: '#16260f',
    leaf: '#2f6e30', berry: '#e2506a', water: '#4a9be8', stone: '#8a8f99',
    wood: '#8a5a32', roof: '#b0533c', trunk: '#6b4423', other: '#7d8590',
    body: '#ffb347', eye: '#1c1f26', goal: 'rgba(255, 255, 255, 0.65)',
  };

  const circle = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const shapes = {
    bush: (cx, cy, r) => {
      circle(cx, cy, r * 0.8, COLORS.leaf);
      for (const [dx, dy] of [[-0.3, -0.2], [0.25, -0.3], [0.1, 0.25], [-0.25, 0.3]]) circle(cx + dx * r, cy + dy * r, r * 0.13, COLORS.berry);
    },
    well: (cx, cy, r) => {
      circle(cx, cy, r * 0.8, COLORS.stone);
      circle(cx, cy, r * 0.55, COLORS.water);
    },
    shack: (cx, cy, r) => {
      ctx.fillStyle = COLORS.wood;
      ctx.fillRect(cx - r * 0.65, cy - r * 0.15, r * 1.3, r * 0.85);
      ctx.fillStyle = COLORS.roof;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.85, cy - r * 0.1);
      ctx.lineTo(cx, cy - r * 0.85);
      ctx.lineTo(cx + r * 0.85, cy - r * 0.1);
      ctx.fill();
    },
    tree: (cx, cy, r) => {
      ctx.fillStyle = COLORS.trunk;
      ctx.fillRect(cx - r * 0.12, cy + r * 0.1, r * 0.24, r * 0.7);
      circle(cx, cy - r * 0.15, r * 0.65, COLORS.leaf);
    },
  };

  // Structures the models invent get a generic labelled square (U-7).
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
      (shapes[s.name] || generic)(center(s.x), center(s.y), tile * 0.5);
      ctx.fillStyle = COLORS.label;
      ctx.fillText(s.name, center(s.x), center(s.y) + tile * 0.72);
    }

    if (inh) {
      const x = center(shown.x);
      const y = center(shown.y);
      circle(x, y, tile * 0.3, COLORS.body);
      circle(x - tile * 0.1, y - tile * 0.05, tile * 0.045, COLORS.eye);
      circle(x + tile * 0.1, y - tile * 0.05, tile * 0.045, COLORS.eye);
    }
  };

  return { draw };
};
