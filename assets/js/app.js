const imageInput = document.getElementById('imageInput');
const svgPicker = document.getElementById('svgPicker');
const widthCardsInput = document.getElementById('widthCardsInput');
const heightCardsInput = document.getElementById('heightCardsInput');
const contrastInput = document.getElementById('contrastInput');
const generateBtn = document.getElementById('generateBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const statusPanel = document.getElementById('statusPanel');

const originalCanvas = document.getElementById('originalCanvas');
const originalCtx = originalCanvas.getContext('2d');
const mosaicCanvas = document.getElementById('mosaicCanvas');
const mosaicCtx = mosaicCanvas.getContext('2d');

const sourceImage = document.getElementById('sourceImage');

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const cardWidthInches = 2.5;
const cardHeightInches = 3.5;

const cardImagePaths = {
  A: 'assets/img/cards/ace_of_spades.svg',
  '2': 'assets/img/cards/2_of_spades.svg',
  '3': 'assets/img/cards/3_of_spades.svg',
  '4': 'assets/img/cards/4_of_spades.svg',
  '5': 'assets/img/cards/5_of_spades.svg',
  '6': 'assets/img/cards/6_of_spades.svg',
  '7': 'assets/img/cards/7_of_spades.svg',
  '8': 'assets/img/cards/8_of_spades.svg',
  '9': 'assets/img/cards/9_of_spades.svg',
  '10': 'assets/img/cards/10_of_spades.svg'
};

const cardImages = {};
let cardImagesLoaded = false;
let lastGrid = [];
let autoFitNote = 'No auto-fit yet.';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

async function ensureCardImagesLoaded() {
  if (cardImagesLoaded) return;

  const tasks = ranks.map(async (rank) => {
    cardImages[rank] = await loadImage(cardImagePaths[rank]);
  });

  await Promise.all(tasks);
  cardImagesLoaded = true;
}

function brightnessToRank(value) {
  const idx = Math.max(0, Math.min(ranks.length - 1, Math.floor((value / 256) * ranks.length)));
  return ranks[idx];
}

function buildInventory(grid) {
  const counts = Object.fromEntries(ranks.map((r) => [r, 0]));
  for (const row of grid) {
    for (const rank of row) counts[rank]++;
  }
  return counts;
}

function contrastBrightness(v, contrast) {
  const normalized = v / 255;
  const adjusted = (normalized - 0.5) * contrast + 0.5;
  return Math.max(0, Math.min(1, adjusted)) * 255;
}

function setCanvasSizes(widthCards, heightCards) {
  const mosaicAspect = (widthCards * cardWidthInches) / (heightCards * cardHeightInches);
  const width = 900;
  const height = Math.max(260, Math.round(width / mosaicAspect));

  originalCanvas.width = width;
  originalCanvas.height = height;
  mosaicCanvas.width = width;
  mosaicCanvas.height = height;
}

function drawOriginal(img) {
  const cw = originalCanvas.width;
  const ch = originalCanvas.height;
  originalCtx.fillStyle = '#ffffff';
  originalCtx.fillRect(0, 0, cw, ch);

  const scale = Math.min(cw / img.width, ch / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (cw - w) / 2;
  const y = (ch - h) / 2;

  originalCtx.drawImage(img, x, y, w, h);
}

function drawMosaicGrid(grid, rows, cols) {
  const cellW = mosaicCanvas.width / cols;
  const cellH = mosaicCanvas.height / rows;

  mosaicCtx.fillStyle = '#fff';
  mosaicCtx.fillRect(0, 0, mosaicCanvas.width, mosaicCanvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rank = grid[r][c];
      const cardImg = cardImages[rank];
      if (!cardImg) continue;
      mosaicCtx.drawImage(cardImg, c * cellW, r * cellH, cellW, cellH);
    }
  }
}

function formatDimensions(widthCards, heightCards) {
  const widthIn = widthCards * cardWidthInches;
  const heightIn = heightCards * cardHeightInches;
  return {
    widthIn,
    heightIn,
    widthFt: widthIn / 12,
    heightFt: heightIn / 12
  };
}

function estimateAutoFitDimensions(img) {
  const currentWidth = Number(widthCardsInput.value) || 45;
  const currentHeight = Number(heightCardsInput.value) || 60;
  const budget = Math.max(25, currentWidth * currentHeight);

  const imageAspect = img.width / img.height;
  const gridRatio = imageAspect * (cardHeightInches / cardWidthInches);

  let bestWidth = currentWidth;
  let bestHeight = currentHeight;
  let bestArea = 0;

  for (let h = 5; h <= 300; h++) {
    const w = Math.round(h * gridRatio);
    if (w < 5 || w > 300) continue;
    const area = w * h;
    if (area <= budget && area > bestArea) {
      bestArea = area;
      bestWidth = w;
      bestHeight = h;
    }
  }

  if (bestArea === 0) {
    const fallbackHeight = clamp(Math.round(Math.sqrt(budget / Math.max(gridRatio, 0.1))), 5, 300);
    const fallbackWidth = clamp(Math.round(fallbackHeight * gridRatio), 5, 300);
    bestWidth = fallbackWidth;
    bestHeight = fallbackHeight;
    bestArea = bestWidth * bestHeight;
  }

  return {
    width: bestWidth,
    height: bestHeight,
    oldWidth: currentWidth,
    oldHeight: currentHeight,
    oldArea: currentWidth * currentHeight,
    newArea: bestArea
  };
}

function applyAutoFit(img) {
  const fit = estimateAutoFitDimensions(img);
  widthCardsInput.value = fit.width;
  heightCardsInput.value = fit.height;

  autoFitNote = `Auto-fit from ${fit.oldWidth}×${fit.oldHeight} (${fit.oldArea} cards) to ${fit.width}×${fit.height} (${fit.newArea} cards) based on source aspect.`;
}

function updateStatus(grid, widthCards, heightCards) {
  const inventory = buildInventory(grid);
  const totalCards = widthCards * heightCards;
  const dims = formatDimensions(widthCards, heightCards);

  statusPanel.textContent = [
    'Status',
    '',
    `Grid: ${widthCards} x ${heightCards} cards`,
    `Total cards: ${totalCards}`,
    `Total size (in): ${dims.widthIn.toFixed(1)}" W x ${dims.heightIn.toFixed(1)}" H`,
    `Total size (ft): ${dims.widthFt.toFixed(2)}' W x ${dims.heightFt.toFixed(2)}' H`,
    '',
    autoFitNote,
    '',
    'Inventory',
    ...Object.entries(inventory).map(([rank, count]) => `${rank}: ${count}`)
  ].join('\n');
}

async function generateFromImage(img) {
  const widthCards = Number(widthCardsInput.value);
  const heightCards = Number(heightCardsInput.value);
  const contrast = Number(contrastInput.value);

  await ensureCardImagesLoaded();

  const temp = document.createElement('canvas');
  temp.width = widthCards;
  temp.height = heightCards;
  const tctx = temp.getContext('2d');
  tctx.drawImage(img, 0, 0, widthCards, heightCards);
  const data = tctx.getImageData(0, 0, widthCards, heightCards).data;

  const grid = [];
  for (let r = 0; r < heightCards; r++) {
    const row = [];
    for (let c = 0; c < widthCards; c++) {
      const i = (r * widthCards + c) * 4;
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
  setCanvasSizes(widthCards, heightCards);
  drawOriginal(img);
  drawMosaicGrid(grid, heightCards, widthCards);
  updateStatus(grid, widthCards, heightCards);
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

function processLoadedImage() {
  applyAutoFit(sourceImage);
  generateFromImage(sourceImage).catch((error) => alert(error.message));
}

function loadImageFromUrl(url) {
  sourceImage.onload = processLoadedImage;
  sourceImage.src = url;
}

imageInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  sourceImage.onload = () => {
    processLoadedImage();
    URL.revokeObjectURL(url);
  };
  sourceImage.src = url;
});

svgPicker.addEventListener('change', () => {
  if (svgPicker.value) loadImageFromUrl(svgPicker.value);
});

generateBtn.addEventListener('click', async () => {
  if (!sourceImage.src) {
    alert('Pick or upload an image first.');
    return;
  }

  autoFitNote = 'Manual regenerate with current width/height.';

  try {
    await generateFromImage(sourceImage);
  } catch (error) {
    alert(error.message);
  }
});

exportJsonBtn.addEventListener('click', () => {
  if (!lastGrid.length) return alert('Generate first.');
  download('card-mosaic-map.json', JSON.stringify(lastGrid));
});

exportCsvBtn.addEventListener('click', () => {
  if (!lastGrid.length) return alert('Generate first.');
  const csv = lastGrid.map((row) => row.join(',')).join('\n');
  download('card-mosaic-map.csv', csv, 'text/csv');
});
