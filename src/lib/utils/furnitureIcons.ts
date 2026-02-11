/**
 * Architectural top-down furniture renderers for 2D canvas.
 * Each function draws within a normalized rect: (-w/2, -d/2) to (w/2, d/2)
 * where w = width*zoom, d = depth*zoom. Context is already translated & rotated.
 */

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, d: number, color: string) => void;

// Helper: rounded rect
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const drawSofa: DrawFn = (ctx, w, d, color) => {
  const armW = w * 0.12;
  const backD = d * 0.25;
  // Back
  roundRect(ctx, -w/2, -d/2, w, backD, 3);
  ctx.fill(); ctx.stroke();
  // Seat
  roundRect(ctx, -w/2 + armW, -d/2 + backD, w - armW*2, d - backD, 2);
  ctx.fillStyle = color + '40';
  ctx.fill(); ctx.stroke();
  // Arms
  ctx.fillStyle = color + '80';
  roundRect(ctx, -w/2, -d/2 + backD, armW, d - backD, 2);
  ctx.fill(); ctx.stroke();
  roundRect(ctx, w/2 - armW, -d/2 + backD, armW, d - backD, 2);
  ctx.fill(); ctx.stroke();
  // Cushion lines
  ctx.beginPath();
  const cushions = 3;
  for (let i = 1; i < cushions; i++) {
    const x = -w/2 + armW + (w - armW*2) * i / cushions;
    ctx.moveTo(x, -d/2 + backD + 2);
    ctx.lineTo(x, d/2 - 2);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.stroke();
};

const drawLoveseat: DrawFn = (ctx, w, d, color) => {
  // Same as sofa but 2 cushions
  const armW = w * 0.14;
  const backD = d * 0.25;
  roundRect(ctx, -w/2, -d/2, w, backD, 3);
  ctx.fill(); ctx.stroke();
  roundRect(ctx, -w/2 + armW, -d/2 + backD, w - armW*2, d - backD, 2);
  ctx.fillStyle = color + '40';
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = color + '80';
  roundRect(ctx, -w/2, -d/2 + backD, armW, d - backD, 2);
  ctx.fill(); ctx.stroke();
  roundRect(ctx, w/2 - armW, -d/2 + backD, armW, d - backD, 2);
  ctx.fill(); ctx.stroke();
  // One cushion line
  ctx.beginPath();
  ctx.moveTo(0, -d/2 + backD + 2);
  ctx.lineTo(0, d/2 - 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.stroke();
};

const drawChair: DrawFn = (ctx, w, d, color) => {
  const backD = d * 0.2;
  const armW = w * 0.15;
  // Back
  roundRect(ctx, -w/2, -d/2, w, backD, 3);
  ctx.fill(); ctx.stroke();
  // Seat
  roundRect(ctx, -w/2 + armW, -d/2 + backD, w - armW*2, d - backD, 2);
  ctx.fillStyle = color + '40';
  ctx.fill(); ctx.stroke();
  // Arms
  ctx.fillStyle = color + '80';
  roundRect(ctx, -w/2, -d/2 + backD, armW, d - backD - d*0.1, 2);
  ctx.fill(); ctx.stroke();
  roundRect(ctx, w/2 - armW, -d/2 + backD, armW, d - backD - d*0.1, 2);
  ctx.fill(); ctx.stroke();
};

const drawTable: DrawFn = (ctx, w, d) => {
  // Simple rectangle with slightly rounded corners
  roundRect(ctx, -w/2, -d/2, w, d, 3);
  ctx.fill(); ctx.stroke();
};

const drawBed: DrawFn = (ctx, w, d, color) => {
  // Mattress
  roundRect(ctx, -w/2, -d/2, w, d, 3);
  ctx.fill(); ctx.stroke();
  // Headboard (top)
  ctx.fillStyle = color;
  roundRect(ctx, -w/2, -d/2, w, d * 0.08, 2);
  ctx.fill(); ctx.stroke();
  // Pillows
  ctx.fillStyle = '#ffffff90';
  const pw = w * 0.38;
  const ph = d * 0.15;
  const py = -d/2 + d * 0.1;
  roundRect(ctx, -w/2 + w*0.06, py, pw, ph, 3);
  ctx.fill(); ctx.stroke();
  roundRect(ctx, w/2 - w*0.06 - pw, py, pw, ph, 3);
  ctx.fill(); ctx.stroke();
  // Blanket line
  ctx.beginPath();
  ctx.moveTo(-w/2 + 3, d * 0.05);
  ctx.lineTo(w/2 - 3, d * 0.05);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
};

const drawNightstand: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 2);
  ctx.fill(); ctx.stroke();
  // Drawer line
  ctx.beginPath();
  ctx.moveTo(-w/2 + 3, 0);
  ctx.lineTo(w/2 - 3, 0);
  ctx.stroke();
  // Knob
  ctx.beginPath();
  ctx.arc(0, -d*0.25, Math.min(w, d) * 0.06, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, d*0.25, Math.min(w, d) * 0.06, 0, Math.PI * 2);
  ctx.stroke();
};

const drawDresser: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 2);
  ctx.fill(); ctx.stroke();
  // Drawer lines
  const drawers = 4;
  for (let i = 1; i < drawers; i++) {
    const y = -d/2 + (d * i / drawers);
    ctx.beginPath();
    ctx.moveTo(-w/2 + 2, y);
    ctx.lineTo(w/2 - 2, y);
    ctx.stroke();
  }
  // Knobs
  for (let i = 0; i < drawers; i++) {
    const y = -d/2 + d * (i + 0.5) / drawers;
    ctx.beginPath();
    ctx.arc(0, y, Math.min(w, d) * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawWardrobe: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 2);
  ctx.fill(); ctx.stroke();
  // Center line (doors)
  ctx.beginPath();
  ctx.moveTo(0, -d/2 + 2);
  ctx.lineTo(0, d/2 - 2);
  ctx.stroke();
  // Knobs
  ctx.beginPath();
  ctx.arc(-3, 0, 2, 0, Math.PI * 2);
  ctx.arc(3, 0, 2, 0, Math.PI * 2);
  ctx.fill();
};

const drawToilet: DrawFn = (ctx, w, d, color) => {
  // Tank (back rectangle)
  const tankD = d * 0.3;
  roundRect(ctx, -w/2 + w*0.1, -d/2, w*0.8, tankD, 2);
  ctx.fill(); ctx.stroke();
  // Bowl (ellipse)
  ctx.beginPath();
  const bowlCy = -d/2 + tankD + (d - tankD) * 0.5;
  const bowlRx = w * 0.42;
  const bowlRy = (d - tankD) * 0.48;
  ctx.ellipse(0, bowlCy, bowlRx, bowlRy, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff90';
  ctx.fill(); ctx.stroke();
  // Seat opening
  ctx.beginPath();
  ctx.ellipse(0, bowlCy + bowlRy*0.05, bowlRx*0.7, bowlRy*0.7, 0, 0, Math.PI * 2);
  ctx.stroke();
};

const drawBathtub: DrawFn = (ctx, w, d, color) => {
  // Outer
  roundRect(ctx, -w/2, -d/2, w, d, 6);
  ctx.fill(); ctx.stroke();
  // Inner
  ctx.fillStyle = '#ffffff60';
  roundRect(ctx, -w/2 + 3, -d/2 + 3, w - 6, d - 6, 4);
  ctx.fill(); ctx.stroke();
  // Drain
  ctx.beginPath();
  ctx.arc(w*0.3, 0, 2, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Faucet
  ctx.beginPath();
  ctx.arc(-w*0.35, 0, 3, 0, Math.PI*2);
  ctx.stroke();
};

const drawShower: DrawFn = (ctx, w, d) => {
  // Floor tray
  roundRect(ctx, -w/2, -d/2, w, d, 4);
  ctx.fill(); ctx.stroke();
  // Drain
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI*2);
  ctx.stroke();
  // Showerhead indicator (corner)
  ctx.beginPath();
  ctx.arc(-w/2 + 8, -d/2 + 8, 4, 0, Math.PI*2);
  ctx.stroke();
  // Water dots
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-w/2 + 8 + (i+1)*3, -d/2 + 8 + (i+1)*3, 1, 0, Math.PI*2);
    ctx.fill();
  }
};

const drawSink: DrawFn = (ctx, w, d) => {
  // Counter
  roundRect(ctx, -w/2, -d/2, w, d, 3);
  ctx.fill(); ctx.stroke();
  // Basin (ellipse)
  ctx.beginPath();
  ctx.ellipse(0, d*0.05, w*0.35, d*0.35, 0, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff80';
  ctx.fill(); ctx.stroke();
  // Faucet
  ctx.beginPath();
  ctx.arc(0, -d*0.3, 2, 0, Math.PI*2);
  ctx.fill();
};

const drawStove: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 2);
  ctx.fill(); ctx.stroke();
  // 4 burners
  const positions = [[-1,-1],[1,-1],[-1,1],[1,1]];
  const br = Math.min(w, d) * 0.16;
  for (const [px, py] of positions) {
    ctx.beginPath();
    ctx.arc(px * w * 0.2, py * d * 0.2, br, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px * w * 0.2, py * d * 0.2, br * 0.5, 0, Math.PI*2);
    ctx.stroke();
  }
};

const drawFridge: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 2);
  ctx.fill(); ctx.stroke();
  // Door line
  ctx.beginPath();
  ctx.moveTo(-w/2 + 2, -d*0.1);
  ctx.lineTo(w/2 - 2, -d*0.1);
  ctx.stroke();
  // Handle
  ctx.beginPath();
  ctx.moveTo(w*0.3, -d*0.35);
  ctx.lineTo(w*0.3, -d*0.15);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w*0.3, d*0.05);
  ctx.lineTo(w*0.3, d*0.35);
  ctx.stroke();
};

const drawCounter: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 1);
  ctx.fill(); ctx.stroke();
};

const drawDishwasher: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 2);
  ctx.fill(); ctx.stroke();
  // Handle
  ctx.beginPath();
  ctx.moveTo(-w*0.25, -d*0.3);
  ctx.lineTo(w*0.25, -d*0.3);
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

const drawDesk: DrawFn = (ctx, w, d) => {
  // Desktop
  roundRect(ctx, -w/2, -d/2, w, d, 2);
  ctx.fill(); ctx.stroke();
  // Keyboard area indication
  ctx.strokeStyle = ctx.strokeStyle + '60';
  roundRect(ctx, -w*0.25, -d*0.05, w*0.5, d*0.2, 1);
  ctx.stroke();
};

const drawOfficeChair: DrawFn = (ctx, w, d) => {
  // Base (circle)
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(w, d) * 0.45, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Backrest
  ctx.beginPath();
  ctx.arc(0, -d*0.25, w*0.3, Math.PI*1.2, Math.PI*1.8);
  ctx.lineWidth = 2;
  ctx.stroke();
};

const drawDiningTable: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 4);
  ctx.fill(); ctx.stroke();
};

const drawDiningChair: DrawFn = (ctx, w, d, color) => {
  // Seat
  roundRect(ctx, -w/2, -d/2 + d*0.2, w, d*0.8, 2);
  ctx.fillStyle = color + '40';
  ctx.fill(); ctx.stroke();
  // Back
  ctx.fillStyle = color + '80';
  roundRect(ctx, -w/2, -d/2, w, d*0.2, 2);
  ctx.fill(); ctx.stroke();
};

const drawBookshelf: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 1);
  ctx.fill(); ctx.stroke();
  // Shelf lines
  const shelves = 4;
  for (let i = 1; i < shelves; i++) {
    const x = -w/2 + w * i / shelves;
    ctx.beginPath();
    ctx.moveTo(x, -d/2 + 2);
    ctx.lineTo(x, d/2 - 2);
    ctx.stroke();
  }
};

const drawSideTable: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 3);
  ctx.fill(); ctx.stroke();
};

const drawTvStand: DrawFn = (ctx, w, d) => {
  roundRect(ctx, -w/2, -d/2, w, d, 2);
  ctx.fill(); ctx.stroke();
  // TV line at back
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w*0.4, -d*0.35);
  ctx.lineTo(w*0.4, -d*0.35);
  ctx.stroke();
};

/** Registry mapping catalogId → custom draw function */
const iconDrawers: Record<string, DrawFn> = {
  sofa: drawSofa,
  loveseat: drawLoveseat,
  chair: drawChair,
  coffee_table: drawTable,
  tv_stand: drawTvStand,
  bookshelf: drawBookshelf,
  side_table: drawSideTable,
  bed_queen: drawBed,
  bed_twin: drawBed,
  nightstand: drawNightstand,
  dresser: drawDresser,
  wardrobe: drawWardrobe,
  stove: drawStove,
  fridge: drawFridge,
  sink_k: drawSink,
  counter: drawCounter,
  dishwasher: drawDishwasher,
  toilet: drawToilet,
  bathtub: drawBathtub,
  shower: drawShower,
  sink_b: drawSink,
  desk: drawDesk,
  office_chair: drawOfficeChair,
  dining_table: drawDiningTable,
  dining_chair: drawDiningChair,
};

/**
 * Draw an architectural top-down icon for the given furniture item.
 * Context should already be translated to center and rotated.
 * @param w - pixel width (catalogWidth * zoom)
 * @param d - pixel depth (catalogDepth * zoom)
 */
export function drawFurnitureIcon(
  ctx: CanvasRenderingContext2D,
  catalogId: string,
  w: number,
  d: number,
  color: string,
  strokeColor: string
) {
  ctx.fillStyle = color + '60';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;

  const drawer = iconDrawers[catalogId];
  if (drawer) {
    drawer(ctx, w, d, color);
  } else {
    // Fallback: simple rect
    roundRect(ctx, -w/2, -d/2, w, d, 2);
    ctx.fill();
    ctx.stroke();
  }
}
