const imageInput = document.getElementById('imageInput');
const svgPicker = document.getElementById('svgPicker');
const rowsInput = document.getElementById('rowsInput');
const colsInput = document.getElementById('colsInput');
const contrastInput = document.getElementById('contrastInput');
const generateBtn = document.getElementById('generateBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const inventoryEl = document.getElementById('inventory');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const sourceImage = document.getElementById('sourceImage');

const ranks = ['A','2','3','4','5','6','7','8','9','10'];
let lastGrid = [];

function brightnessToRank(value) {
  const idx = Math.max(0, Math.min(ranks.length - 1, Math.floor((value / 256) * ranks.length)));
  return ranks[idx];
}

function rankShade(rank) {
  const idx = ranks.indexOf(rank);
  const shade = 255 - Math.round((idx / (ranks.length - 1)) * 220);
  return `rgb(${shade},${shade},${shade})`;
}

function drawGrid(grid, rows, cols) {
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rank = grid[r][c];
      ctx.fillStyle = rankShade(rank);
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);

      if (cellW > 12 && cellH > 12) {
        ctx.fillStyle = rank === 'A' ? '#222' : '#111';
        ctx.font = `${Math.min(cellW, cellH) * 0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rank, c * cellW + cellW / 2, r * cellH + cellH / 2);
      }
    }
  }
}

function buildInventory(grid) {
  const counts = Object.fromEntries(ranks.map(r => [r, 0]));
  for (const row of grid) {
    for (const rank of row) counts[rank]++;
  }
  return counts;
}

function contrastBrightness(v, contrast) {
  const normalized = v / 255;
  const adjusted = ((normalized - 0.5) * contrast + 0.5);
  return Math.max(0, Math.min(1, adjusted)) * 255;
}

function generateFromImage(img) {
  const rows = Number(rowsInput.value);
  const cols = Number(colsInput.value);
  const contrast = Number(contrastInput.value);

  const temp = document.createElement('canvas');
  temp.width = cols;
  temp.height = rows;
  const tctx = temp.getContext('2d');
  tctx.drawImage(img, 0, 0, cols, rows);
  const data = tctx.getImageData(0, 0, cols, rows).data;

  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 4;
      const rr = data[i];
      const gg = data[i + 1];
      const bb = data[i + 2];
      const gray = 0.299 * rr + 0.587 * gg + 0.114 * bb;
      const adjusted = contrastBrightness(gray, contrast);
      row.push(brightnessToRank(adjusted));
    }
    grid.push(row);
  }

  lastGrid = grid;
  drawGrid(grid, rows, cols);

  const inventory = buildInventory(grid);
  inventoryEl.textContent = `Inventory\n\n${Object.entries(inventory)
    .map(([rank, count]) => `${rank}: ${count}`)
    .join('\n')}`;
}

function download(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function loadImageFromUrl(url) {
  sourceImage.onload = () => generateFromImage(sourceImage);
  sourceImage.src = url;
}

imageInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  sourceImage.onload = () => {
    generateFromImage(sourceImage);
    URL.revokeObjectURL(url);
  };
  sourceImage.src = url;
});

svgPicker.addEventListener('change', () => {
  if (svgPicker.value) loadImageFromUrl(svgPicker.value);
});

generateBtn.addEventListener('click', () => {
  if (!sourceImage.src) {
    alert('Pick or upload an image first.');
    return;
  }
  generateFromImage(sourceImage);
});

exportJsonBtn.addEventListener('click', () => {
  if (!lastGrid.length) return alert('Generate first.');
  download('card-mosaic-map.json', JSON.stringify(lastGrid));
});

exportCsvBtn.addEventListener('click', () => {
  if (!lastGrid.length) return alert('Generate first.');
  const csv = lastGrid.map(row => row.join(',')).join('\n');
  download('card-mosaic-map.csv', csv, 'text/csv');
});
