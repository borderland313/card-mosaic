const imageInput = document.getElementById('imageInput');
const svgPicker = document.getElementById('svgPicker');
const widthCardsInput = document.getElementById('widthCardsInput');
const heightCardsInput = document.getElementById('heightCardsInput');
const contrastInput = document.getElementById('contrastInput');
const borderRankInput = document.getElementById('borderRankInput');
const borderSuitInput = document.getElementById('borderSuitInput');
const generateBtn = document.getElementById('generateBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const statusPanel = document.getElementById('statusPanel');
const suitInputs = Array.from(document.querySelectorAll('.suitInput'));
const suitsAllBtn = document.getElementById('suitsAllBtn');
const suitsBlackBtn = document.getElementById('suitsBlackBtn');
const suitsRedBtn = document.getElementById('suitsRedBtn');

const originalCanvas = document.getElementById('originalCanvas');
const originalCtx = originalCanvas.getContext('2d');
const mosaicCanvas = document.getElementById('mosaicCanvas');
const mosaicCtx = mosaicCanvas.getContext('2d');
const sourceImage = document.getElementById('sourceImage');

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const suits = ['spades', 'clubs', 'hearts', 'diamonds'];
const suitColor = { spades: 'black', clubs: 'black', hearts: 'red', diamonds: 'red' };

const cardWidthInches = 2.5;
const cardHeightInches = 3.5;

const cardImagePaths = {};
const cardImages = {};
for (const rank of ranks) {
  const fileRank = rank === 'A' ? 'ace' : rank;
  for (const suit of suits) {
    const key = `${rank}_${suit}`;
    cardImagePaths[key] = `assets/img/cards/${fileRank}_of_${suit}.svg`;
  }
}

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
  const tasks = Object.entries(cardImagePaths).map(async ([key, path]) => {
    cardImages[key] = await loadImage(path);
  });
  await Promise.all(tasks);
  cardImagesLoaded = true;
}

function getSelectedSuits() {
  const selected = suitInputs.filter((el) => el.checked).map((el) => el.value);
  if (!selected.length) {
    suitInputs[0].checked = true;
    return [suitInputs[0].value];
  }
  return selected;
}

function getBorderCard() {
  return {
    rank: borderRankInput.value,
    suit: borderSuitInput.value,
    isBorder: true
  };
}

function brightnessToRank(value) {
  const idx = Math.max(0, Math.min(ranks.length - 1, Math.floor((value / 256) * ranks.length)));
  return ranks[idx];
}

function chooseSuit(brightness, row, col, selectedSuits) {
  const blackSuits = selectedSuits.filter((s) => suitColor[s] === 'black');
  const redSuits = selectedSuits.filter((s) => suitColor[s] === 'red');

  let pool = selectedSuits;
  if (blackSuits.length && redSuits.length) {
    const tone = brightness / 255;
    if (tone < 0.42) pool = blackSuits;
    else if (tone > 0.58) pool = redSuits;
    else pool = (row + col) % 2 === 0 ? blackSuits : redSuits;
  }

  return pool[(row * 131 + col * 17) % pool.length];
}

function contrastBrightness(v, contrast) {
  const normalized = v / 255;
  const adjusted = (normalized - 0.5) * contrast + 0.5;
  return Math.max(0, Math.min(1, adjusted)) * 255;
}

function getContentRect(widthCards, heightCards, imageAspect) {
  const targetGridRatio = imageAspect * (cardHeightInches / cardWidthInches);

  let contentWidth = widthCards;
  let contentHeight = Math.round(widthCards / targetGridRatio);

  if (contentHeight > heightCards) {
    contentHeight = heightCards;
    contentWidth = Math.round(heightCards * targetGridRatio);
  }

  contentWidth = clamp(contentWidth, 1, widthCards);
  contentHeight = clamp(contentHeight, 1, heightCards);

  const x = Math.floor((widthCards - contentWidth) / 2);
  const y = Math.floor((heightCards - contentHeight) / 2);

  return { x, y, width: contentWidth, height: contentHeight };
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
  originalCtx.fillStyle = '#fff';
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
      const cell = grid[r][c];
      const img = cardImages[`${cell.rank}_${cell.suit}`];
      if (img) mosaicCtx.drawImage(img, c * cellW, r * cellH, cellW, cellH);
    }
  }
}

function estimateAutoFitDimensions(img) {
  const currentWidth = Number(widthCardsInput.value) || 45;
  const currentHeight = Number(heightCardsInput.value) || 60;
  const budget = Math.max(25, currentWidth * currentHeight);
  const targetAspect = img.width / img.height;

  let bestWidth = currentWidth;
  let bestHeight = currentHeight;
  let bestArea = 0;
  let bestError = Infinity;

  for (let h = 5; h <= 300; h++) {
    for (let w = 5; w <= 300; w++) {
      const area = w * h;
      if (area > budget) continue;
      const physicalAspect = (w * cardWidthInches) / (h * cardHeightInches);
      const error = Math.abs(Math.log(physicalAspect / targetAspect));

      if (error < bestError - 1e-9 || (Math.abs(error - bestError) < 1e-9 && area > bestArea)) {
        bestError = error;
        bestArea = area;
        bestWidth = w;
        bestHeight = h;
      }
    }
  }

  const actualAspect = (bestWidth * cardWidthInches) / (bestHeight * cardHeightInches);
  const aspectErrorPct = Math.abs((actualAspect - targetAspect) / targetAspect) * 100;

  return {
    width: bestWidth,
    height: bestHeight,
    oldWidth: currentWidth,
    oldHeight: currentHeight,
    oldArea: currentWidth * currentHeight,
    newArea: bestArea,
    targetAspect,
    actualAspect,
    aspectErrorPct
  };
}

function applyAutoFit(img) {
  const fit = estimateAutoFitDimensions(img);
  widthCardsInput.value = fit.width;
  heightCardsInput.value = fit.height;
  autoFitNote = `Auto-fit ${fit.oldWidth}×${fit.oldHeight} (${fit.oldArea}) → ${fit.width}×${fit.height} (${fit.newArea}) | target AR ${fit.targetAspect.toFixed(3)}, actual ${fit.actualAspect.toFixed(3)} (${fit.aspectErrorPct.toFixed(2)}% error).`;
}

function formatDimensions(widthCards, heightCards) {
  const widthIn = widthCards * cardWidthInches;
  const heightIn = heightCards * cardHeightInches;
  return { widthIn, heightIn, widthFt: widthIn / 12, heightFt: heightIn / 12 };
}

function buildStats(grid) {
  const rankCounts = Object.fromEntries(ranks.map((r) => [r, 0]));
  const suitCounts = Object.fromEntries(suits.map((s) => [s, 0]));
  let borderCount = 0;

  for (const row of grid) {
    for (const cell of row) {
      rankCounts[cell.rank]++;
      suitCounts[cell.suit]++;
      if (cell.isBorder) borderCount++;
    }
  }

  return { rankCounts, suitCounts, borderCount };
}

function updateStatus(grid, widthCards, heightCards, selectedSuits, contentRect) {
  const totalCards = widthCards * heightCards;
  const dims = formatDimensions(widthCards, heightCards);
  const { rankCounts, suitCounts, borderCount } = buildStats(grid);
  const borderCard = getBorderCard();

  statusPanel.textContent = [
    'Status',
    '',
    `Grid: ${widthCards} x ${heightCards} cards`,
    `Total cards: ${totalCards}`,
    `Total size (in): ${dims.widthIn.toFixed(1)}" W x ${dims.heightIn.toFixed(1)}" H`,
    `Total size (ft): ${dims.widthFt.toFixed(2)}' W x ${dims.heightFt.toFixed(2)}' H`,
    `Image area: ${contentRect.width} x ${contentRect.height} cards (offset ${contentRect.x}, ${contentRect.y})`,
    `Border card: ${borderCard.rank} of ${borderCard.suit}`,
    `Border cards used: ${borderCount}`,
    `Image suits: ${selectedSuits.join(', ')}`,
    '',
    autoFitNote,
    '',
    'Suit counts',
    ...Object.entries(suitCounts).map(([s, n]) => `${s}: ${n}`),
    '',
    'Rank counts',
    ...Object.entries(rankCounts).map(([r, n]) => `${r}: ${n}`)
  ].join('\n');
}

async function generateFromImage(img) {
  const widthCards = Number(widthCardsInput.value);
  const heightCards = Number(heightCardsInput.value);
  const contrast = Number(contrastInput.value);
  const selectedSuits = getSelectedSuits();
  const borderCard = getBorderCard();

  await ensureCardImagesLoaded();

  const contentRect = getContentRect(widthCards, heightCards, img.width / img.height);

  const temp = document.createElement('canvas');
  temp.width = contentRect.width;
  temp.height = contentRect.height;
  const tctx = temp.getContext('2d');
  tctx.drawImage(img, 0, 0, contentRect.width, contentRect.height);
  const data = tctx.getImageData(0, 0, contentRect.width, contentRect.height).data;

  const grid = Array.from({ length: heightCards }, () =>
    Array.from({ length: widthCards }, () => ({ ...borderCard }))
  );

  for (let r = 0; r < contentRect.height; r++) {
    for (let c = 0; c < contentRect.width; c++) {
      const i = (r * contentRect.width + c) * 4;
      const rr = data[i];
      const gg = data[i + 1];
      const bb = data[i + 2];
      const gray = 0.299 * rr + 0.587 * gg + 0.114 * bb;
      const adjusted = contrastBrightness(gray, contrast);
      const rank = brightnessToRank(adjusted);
      const suit = chooseSuit(adjusted, r, c, selectedSuits);

      grid[contentRect.y + r][contentRect.x + c] = { rank, suit, isBorder: false };
    }
  }

  lastGrid = grid;
  setCanvasSizes(widthCards, heightCards);
  drawOriginal(img);
  drawMosaicGrid(grid, heightCards, widthCards);
  updateStatus(grid, widthCards, heightCards, selectedSuits, contentRect);
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

async function regenerateCurrent(note = 'Manual form update.') {
  if (!sourceImage.src) return;
  autoFitNote = note;
  try {
    await generateFromImage(sourceImage);
  } catch (error) {
    alert(error.message);
  }
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

[widthCardsInput, heightCardsInput, contrastInput, borderRankInput, borderSuitInput].forEach((el) => {
  el.addEventListener('input', () => regenerateCurrent('Manual form update.'));
  el.addEventListener('change', () => regenerateCurrent('Manual form update.'));
});

suitInputs.forEach((el) => {
  el.addEventListener('change', () => regenerateCurrent('Manual suit selection update.'));
});

suitsAllBtn.addEventListener('click', () => {
  suitInputs.forEach((el) => (el.checked = true));
  regenerateCurrent('Suit preset: all suits.');
});

suitsBlackBtn.addEventListener('click', () => {
  suitInputs.forEach((el) => (el.checked = el.value === 'spades' || el.value === 'clubs'));
  regenerateCurrent('Suit preset: black suits only.');
});

suitsRedBtn.addEventListener('click', () => {
  suitInputs.forEach((el) => (el.checked = el.value === 'hearts' || el.value === 'diamonds'));
  regenerateCurrent('Suit preset: red suits only.');
});

generateBtn.addEventListener('click', () => regenerateCurrent('Manual regenerate with current settings.'));

exportJsonBtn.addEventListener('click', () => {
  if (!lastGrid.length) return alert('Generate first.');
  download('card-mosaic-map.json', JSON.stringify(lastGrid));
});

exportCsvBtn.addEventListener('click', () => {
  if (!lastGrid.length) return alert('Generate first.');
  const csv = lastGrid.map((row) => row.map((c) => `${c.rank}_${c.suit}${c.isBorder ? ':B' : ''}`).join(',')).join('\n');
  download('card-mosaic-map.csv', csv, 'text/csv');
});
