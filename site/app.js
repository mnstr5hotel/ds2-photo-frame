// app.js - DS2 photo compositor

// ===== DOM =====
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const ambientMark = document.getElementById('ambientMark');
const btnUpload = document.getElementById('btnUpload');
const btnDownload = document.getElementById('btnDownload');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const stickerGrid = document.getElementById('stickerGrid');
const categoryTabs = document.getElementById('categoryTabs');
const photoAdjustSlot = document.getElementById('photoAdjustSlot');
const statusText = document.getElementById('statusText');
const editToolbar = document.getElementById('editToolbar');
const selectedName = document.getElementById('selectedName');
const snapReadout = document.getElementById('snapReadout');
const canvasReadout = document.getElementById('canvasReadout');
const qualityIndicator = document.getElementById('qualityIndicator');
const historyNotice = document.getElementById('historyNotice');
const canvasControlRow = document.querySelector('.canvas-control-row');
const btnScaleDown = document.getElementById('btnScaleDown');
const btnScaleUp = document.getElementById('btnScaleUp');
const btnRotateLeft = document.getElementById('btnRotateLeft');
const btnRotateRight = document.getElementById('btnRotateRight');
const btnLayerDown = document.getElementById('btnLayerDown');
const btnLayerUp = document.getElementById('btnLayerUp');
const stickerColorControl = document.getElementById('stickerColorControl');
const stickerColorTrigger = document.getElementById('stickerColorTrigger');
const stickerColorName = document.getElementById('stickerColorName');
const stickerColorMenu = document.getElementById('stickerColorMenu');
const btnDeleteSticker = document.getElementById('btnDeleteSticker');
const btnResetPhoto = document.getElementById('btnResetPhoto');
const photoBrightness = document.getElementById('photoBrightness');
const photoBrightnessValue = document.getElementById('photoBrightnessValue');

// ===== Fixed composition model =====
const COMPOSITION_WIDTH = 2560;
const COMPOSITION_HEIGHT = 1440;
const MAX_WORKING_EDGE = 5120;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_STICKERS = 2;
const MIN_STICKER_WIDTH = 96;
const MAX_STICKER_WIDTH = 1664;
const SNAP_DISTANCE = 24;
const ROTATION_SNAP_STEP = Math.PI / 2;
const ROTATION_SNAP_DISTANCE = 6 * Math.PI / 180;
const PHOTO_MIN_SCALE_FACTOR = 0.1;
const PHOTO_MAX_SCALE_FACTOR = 4;
const PHOTO_MIN_BRIGHTNESS = 50;
const PHOTO_MAX_BRIGHTNESS = 150;
const PHOTO_DEFAULT_BRIGHTNESS = 100;
const MIN_VISIBLE_PHOTO = 80;
const HISTORY_LIMIT = 30;
const SELECTION_HANDLE_SIZE = 34;
const SELECTION_HANDLE_HIT_SIZE = 64;
const TINTED_STICKER_CACHE_LIMIT = 16;
const DESKTOP_EAGER_THUMBNAIL_COUNT = 10;
const MOBILE_EAGER_THUMBNAIL_COUNT = 4;
const ASSET_WARM_DELAY = 180;
const CATEGORIES = ['stickers', 'frames'];
let ambientMarks = [];

const state = {
  photo: null,
  frameId: null,
  stickers: [],
  selectedStickerId: null,
  activeCategory: 'stickers',
  photoEditing: false,
  snapGuides: {
    x: false,
    y: false,
    rotation: false,
    left: false,
    right: false,
    top: false,
    bottom: false,
    label: '',
  },
};

// ===== Asset configuration =====
const ASSET_CATALOG_URL = 'assets/catalog.json';
let ASSET_DEFS = [];
let STICKER_COLORS = [];

const assetImages = Object.create(null);
const assetLoadPromises = Object.create(null);
const assetWarmTimers = new Map();
const tintedStickerImages = new Map();
const photoAssets = new Map();
let stickerIdCounter = 0;
let photoAssetCounter = 0;
let serviceWorkerRegistrationStarted = false;
let visibleToolbarMode = null;
let mobileToolbarRevealFrame = null;

// ===== History =====
const history = {
  undo: [],
  redo: [],
  photoFloor: null,
  photoRedoDepth: 0,
};
let savedSignature = '';
let historyNoticeTimer = null;

function captureSnapshot() {
  return {
    photo: state.photo ? { ...state.photo } : null,
    frameId: state.frameId,
    stickers: state.stickers.map(function(sticker) {
      return {
        id: sticker.id,
        defId: sticker.defId,
        name: sticker.name,
        x: sticker.x,
        y: sticker.y,
        w: sticker.w,
        h: sticker.h,
        rotation: sticker.rotation,
        frameSide: sticker.frameSide,
        colorId: sticker.colorId,
        colorName: sticker.colorName,
        colorHex: sticker.colorHex,
      };
    }),
    selectedStickerId: state.selectedStickerId,
  };
}

function compositionSignature(snapshot) {
  const source = snapshot || captureSnapshot();
  return JSON.stringify({
    photo: source.photo,
    frameId: source.frameId,
    stickers: source.stickers.map(function(sticker) {
      return {
        id: sticker.id,
        defId: sticker.defId,
        x: sticker.x,
        y: sticker.y,
        w: sticker.w,
        h: sticker.h,
        rotation: sticker.rotation,
        frameSide: sticker.frameSide,
        colorId: sticker.colorId,
        colorHex: sticker.colorHex,
      };
    }),
  });
}

function restoreSnapshot(snapshot) {
  state.photo = snapshot.photo ? { ...snapshot.photo } : null;
  state.frameId = snapshot.frameId || null;
  state.stickers = snapshot.stickers.map(function(sticker) { return { ...sticker }; });
  state.selectedStickerId = snapshot.selectedStickerId;
  if (!state.stickers.some(function(sticker) { return sticker.id === state.selectedStickerId; })) {
    state.selectedStickerId = null;
  }
  if (!state.photo && state.photoEditing) {
    state.photoEditing = false;
    history.photoFloor = null;
    history.photoRedoDepth = 0;
  }
  clearSnapGuides();
  rebuildCategoryTabs();
  buildAssetPanel();
  updateDynamicControls();
  draw();
}

function commitHistory(before, actionKey) {
  const after = captureSnapshot();
  if (compositionSignature(before) === compositionSignature(after)) return false;

  history.undo.push({ snapshot: before, actionKey: actionKey });
  if (history.undo.length > HISTORY_LIMIT) {
    history.undo.shift();
    if (history.photoFloor !== null) {
      history.photoFloor = Math.max(0, history.photoFloor - 1);
    }
  }
  history.redo = [];
  history.photoRedoDepth = 0;
  prunePhotoAssets();
  updateHistoryControls();
  return true;
}

function canUndo() {
  if (!history.undo.length) return false;
  if (!state.photoEditing) return true;
  return history.undo.length > history.photoFloor;
}

function canRedo() {
  if (!history.redo.length) return false;
  if (!state.photoEditing) return true;
  return history.photoRedoDepth > 0;
}

function undo() {
  flushWheelHistory();
  if (!canUndo()) return;
  const current = captureSnapshot();
  const entry = history.undo.pop();
  history.redo.push({ snapshot: current, actionKey: entry.actionKey });
  if (state.photoEditing) history.photoRedoDepth += 1;
  restoreSnapshot(entry.snapshot);
  showHistoryNotice('undo', entry.actionKey);
  updateHistoryControls();
}

function redo() {
  flushWheelHistory();
  if (!canRedo()) return;
  const current = captureSnapshot();
  const entry = history.redo.pop();
  history.undo.push({ snapshot: current, actionKey: entry.actionKey });
  if (state.photoEditing) history.photoRedoDepth -= 1;
  restoreSnapshot(entry.snapshot);
  showHistoryNotice('redo', entry.actionKey);
  updateHistoryControls();
}

function prunePhotoAssets() {
  const used = new Set();
  function collect(snapshot) {
    if (snapshot.photo) used.add(snapshot.photo.assetId);
  }
  collect(captureSnapshot());
  history.undo.forEach(function(entry) { collect(entry.snapshot); });
  history.redo.forEach(function(entry) { collect(entry.snapshot); });
  photoAssets.forEach(function(asset, id) {
    if (used.has(id)) return;
    if (asset.image && typeof asset.image.close === 'function') asset.image.close();
    photoAssets.delete(id);
  });
}

function showHistoryNotice(mode, actionKey) {
  historyNotice.textContent = t(mode) + ' · ' + t(actionKey);
  historyNotice.hidden = false;
  historyNotice.classList.remove('is-leaving');
  if (historyNoticeTimer) clearTimeout(historyNoticeTimer);
  historyNoticeTimer = setTimeout(function() {
    historyNotice.classList.add('is-leaving');
    historyNoticeTimer = setTimeout(function() {
      historyNotice.hidden = true;
      historyNotice.classList.remove('is-leaving');
      historyNoticeTimer = null;
    }, 180);
  }, 5000);
}

function updateHistoryControls() {
  btnUndo.disabled = !canUndo();
  btnRedo.disabled = !canRedo();
}

// ===== Status and localization =====
function updateStatus(message, statusKey) {
  window.__dsStatusTouched = true;
  if (statusKey) window.__dsStatusKey = statusKey;
  statusText.textContent = message;
}

function updateToolbarLabels() {
  const isPhoto = state.photoEditing;
  btnScaleDown.title = currentLang === 'zh' ? '缩小' : 'Scale down';
  btnScaleUp.title = currentLang === 'zh' ? '放大' : 'Scale up';
  btnRotateLeft.title = currentLang === 'zh' ? '向左旋转' : 'Rotate left';
  btnRotateRight.title = currentLang === 'zh' ? '向右旋转' : 'Rotate right';
  btnLayerDown.title = currentLang === 'zh' ? '移至相框下方' : 'Move below frame';
  btnLayerUp.title = currentLang === 'zh' ? '移至相框上方' : 'Move above frame';
  stickerColorTrigger.title = t('sticker_color');
  stickerColorTrigger.setAttribute('aria-label', t('sticker_color'));
  btnDeleteSticker.title = currentLang === 'zh' ? '删除贴纸' : 'Delete sticker';
  btnResetPhoto.title = currentLang === 'zh' ? '重置照片构图' : 'Reset photo';
  photoBrightness.title = t('brightness');
  photoBrightness.setAttribute('aria-label', t('brightness'));
  btnUndo.title = t('undo');
  btnRedo.title = t('redo');
  editToolbar.dataset.mode = isPhoto ? 'photo' : 'sticker';
}

function updateDynamicControls() {
  btnUpload.textContent = t(state.photo ? 'replace' : 'upload');
  btnDownload.disabled = !state.photo || state.photoEditing;
  updateToolbarLabels();
  updateEditToolbar();
  updateQualityIndicator();
  updateHistoryControls();
}

// ===== Asset loading =====
function getAssetDisplayName(item) {
  return item.id;
}

function getLocalizedName(names, fallback) {
  const locale = currentLang === 'zh' ? 'zh-Hans' : 'en';
  return names && (names[locale] || names['zh-Hans'] || names.en) || fallback;
}

function getAssetDefDisplayName(def) {
  return getLocalizedName(def.names, def.name);
}

function getColorDisplayName(color) {
  return getLocalizedName(color.names, color.name);
}

function getDefaultStickerWidth(item) {
  const heightScale = Math.min(1, 640 / item.height);
  return Math.round(Math.min(960, Math.max(320, item.width * heightScale)));
}

function createAssetDef(item) {
  const fallbackName = getAssetDisplayName(item);
  return {
    id: item.id,
    name: item.names && item.names.en || fallbackName,
    names: item.names || { en: fallbackName, 'zh-Hans': fallbackName },
    src: item.src,
    preview: item.preview || item.src,
    thumbnail: item.thumbnail,
    category: item.category === 'frame' ? 'frames' : 'stickers',
    defaultWidth: item.category === 'sticker' ? getDefaultStickerWidth(item) : undefined,
  };
}

function populateStickerColorMenu() {
  stickerColorMenu.replaceChildren();
  STICKER_COLORS.forEach(function(color) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'sticker-color-option';
    option.dataset.colorId = String(color.index);
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.style.setProperty('--option-color', color.hex.slice(0, 7));

    const swatch = document.createElement('span');
    swatch.className = 'sticker-color-option-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'sticker-color-option-name';
    name.textContent = getColorDisplayName(color);
    option.append(swatch, name);
    option.addEventListener('click', function() {
      setSelectedStickerColor(color.index);
      setStickerColorMenuOpen(false);
      stickerColorTrigger.focus();
    });
    stickerColorMenu.appendChild(option);
  });
}

function setStickerColorMenuOpen(open, focusSelected) {
  const shouldOpen = Boolean(open && getSelectedSticker());
  stickerColorMenu.hidden = !shouldOpen;
  stickerColorTrigger.setAttribute('aria-expanded', String(shouldOpen));
  if (shouldOpen && focusSelected) {
    const selectedOption = stickerColorMenu.querySelector('[aria-selected="true"]');
    if (selectedOption) selectedOption.focus();
  }
}

async function loadAssetIndex() {
  const response = await fetch(ASSET_CATALOG_URL, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error('Asset catalog HTTP ' + response.status);
  const catalog = await response.json();
  const items = catalog.items;
  const colors = catalog.colors;
  if (!Array.isArray(items) || items.length === 0) throw new Error('Asset index is empty');
  if (!Array.isArray(colors) || colors.length !== 24) throw new Error('Color palette is invalid');
  if (!Array.isArray(catalog.backgrounds)) throw new Error('Background catalog is invalid');
  ASSET_DEFS = items.map(createAssetDef);
  STICKER_COLORS = colors;
  ambientMarks = catalog.backgrounds;
  if (ambientMarks.length) {
    ambientMark.src = ambientMarks[Math.floor(Math.random() * ambientMarks.length)];
  }
  populateStickerColorMenu();
}

function createFallbackAsset(def) {
  const isFrame = def.category === 'frames';
  const fallback = document.createElement('canvas');
  fallback.width = isFrame ? 640 : 180;
  fallback.height = isFrame ? 360 : 96;
  const fallbackCtx = fallback.getContext('2d');

  if (!isFrame) {
    fallbackCtx.fillStyle = 'rgba(0,24,40,0.96)';
    fallbackCtx.fillRect(0, 0, fallback.width, fallback.height);
  }
  fallbackCtx.strokeStyle = 'rgba(90,190,246,0.82)';
  fallbackCtx.lineWidth = isFrame ? 3 : 1;
  fallbackCtx.strokeRect(1, 1, fallback.width - 2, fallback.height - 2);
  fallbackCtx.fillStyle = '#e7f6ff';
  fallbackCtx.font = (isFrame ? '20px' : 'bold 14px') + ' Consolas, monospace';
  fallbackCtx.textAlign = 'center';
  fallbackCtx.textBaseline = 'middle';
  fallbackCtx.fillText(getAssetDefDisplayName(def), fallback.width / 2, fallback.height / 2 - 8, fallback.width - 30);
  fallbackCtx.fillStyle = 'rgba(126,208,255,0.66)';
  fallbackCtx.font = (isFrame ? '13px' : '10px') + ' Consolas, monospace';
  fallbackCtx.fillText(def.id, fallback.width / 2, fallback.height / 2 + 16, fallback.width - 30);

  const image = new Image();
  image.src = fallback.toDataURL('image/png');
  image.datasetFailed = 'true';
  return image;
}

function loadAsset(def, priority, fullResolution) {
  const key = fullResolution ? def.id + ':full' : def.id;
  if (assetImages[key]) return Promise.resolve(assetImages[key]);
  if (assetLoadPromises[key]) {
    const pending = assetLoadPromises[key];
    if (priority === 'high' && pending.priority !== 'high') {
      pending.cancel();
    } else {
      return pending.promise;
    }
  }

  const source = fullResolution ? def.src : def.preview;
  const controller = new AbortController();
  const pending = {
    controller: controller,
    priority: priority || 'auto',
    promise: null,
    resolve: null,
    cancel: null,
    image: null,
    objectUrl: null,
    settled: false,
  };
  pending.promise = new Promise(function(resolve) {
    pending.resolve = resolve;
  });
  const cleanup = function() {
    if (pending.objectUrl) URL.revokeObjectURL(pending.objectUrl);
    pending.objectUrl = null;
    if (assetLoadPromises[key] === pending) delete assetLoadPromises[key];
  };
  const settle = function(result) {
    if (pending.settled) return;
    pending.settled = true;
    cleanup();
    pending.resolve(result);
  };
  pending.cancel = function() {
    if (pending.settled) return;
    controller.abort();
    if (pending.image) {
      pending.image.onload = null;
      pending.image.onerror = null;
      pending.image.removeAttribute('src');
    }
    settle(null);
  };
  assetLoadPromises[key] = pending;

  (async function() {
    try {
      const response = await fetch(source, {
        cache: 'default',
        credentials: 'same-origin',
        priority: pending.priority,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Asset HTTP ' + response.status);
      const blob = await response.blob();
      if (pending.settled) return;

      const image = new Image();
      pending.image = image;
      pending.objectUrl = URL.createObjectURL(blob);
      image.decoding = 'async';
      image.onload = async function() {
        if (typeof image.decode === 'function') await image.decode().catch(function() {});
        if (pending.settled) return;
        assetImages[key] = image;
        settle(image);
      };
      image.onerror = function() {
        if (pending.settled) return;
        const fallback = createFallbackAsset(def);
        fallback.onload = function() {
          if (pending.settled) return;
          assetImages[key] = fallback;
          settle(fallback);
        };
      };
      image.src = pending.objectUrl;
    } catch (error) {
      if (error.name === 'AbortError' || pending.settled) return;
      const fallback = createFallbackAsset(def);
      fallback.onload = function() {
        if (pending.settled) return;
        assetImages[key] = fallback;
        settle(fallback);
      };
    }
  })();

  return pending.promise;
}

function connectionPrefersLessData() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return !!connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''));
}

function shouldWarmAssets() {
  return !connectionPrefersLessData() && !window.matchMedia('(pointer:coarse)').matches;
}

function eagerThumbnailCount() {
  if (connectionPrefersLessData()) return MOBILE_EAGER_THUMBNAIL_COUNT;
  return window.matchMedia('(max-width:760px)').matches
    ? MOBILE_EAGER_THUMBNAIL_COUNT
    : DESKTOP_EAGER_THUMBNAIL_COUNT;
}

function cancelAssetWarm(def) {
  if (!def || !assetWarmTimers.has(def.id)) return;
  clearTimeout(assetWarmTimers.get(def.id));
  assetWarmTimers.delete(def.id);
}

function warmAsset(def) {
  if (!def || !shouldWarmAssets() || assetImages[def.id] || assetLoadPromises[def.id] || assetWarmTimers.has(def.id)) return;
  const timer = setTimeout(function() {
    assetWarmTimers.delete(def.id);
    loadAsset(def, 'low', false).catch(function(error) {
      console.warn('Asset warm-up failed:', def.id, error);
    });
  }, ASSET_WARM_DELAY);
  assetWarmTimers.set(def.id, timer);
}

function registerAssetCacheWorker() {
  if (serviceWorkerRegistrationStarted || !('serviceWorker' in navigator)) return;
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  serviceWorkerRegistrationStarted = true;
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function(error) {
      console.warn('Service worker registration failed:', error);
    });
  });
}

// ===== Fixed logical canvas and responsive preview =====
function syncPreviewResolution() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const container = canvas.parentElement;
  const containerRect = container.getBoundingClientRect();
  container.style.setProperty('--canvas-left-gap', Math.max(0, rect.left - containerRect.left) + 'px');
  container.style.setProperty('--canvas-right-gap', Math.max(0, containerRect.right - rect.right) + 'px');
  container.style.setProperty('--canvas-top-gap', Math.max(0, rect.top - containerRect.top) + 'px');
  container.style.setProperty('--canvas-bottom-gap', Math.max(0, containerRect.bottom - rect.bottom) + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.min(1, rect.width * dpr / COMPOSITION_WIDTH);
  const width = Math.max(1, Math.round(COMPOSITION_WIDTH * scale));
  const height = Math.max(1, Math.round(COMPOSITION_HEIGHT * scale));
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  draw();
}

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(syncPreviewResolution).observe(canvas);
} else {
  window.addEventListener('resize', syncPreviewResolution);
}

// ===== Composition rendering =====
function getPhotoAsset(photo) {
  return photo ? photoAssets.get(photo.assetId) || null : null;
}

function drawPhoto(targetCtx, photo) {
  const asset = getPhotoAsset(photo);
  if (!asset) return;
  const width = asset.width * photo.scale;
  const height = asset.height * photo.scale;
  targetCtx.save();
  targetCtx.translate(photo.x, photo.y);
  targetCtx.rotate(photo.rotation);
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = 'high';
  targetCtx.filter = 'brightness(' + (photo.brightness || PHOTO_DEFAULT_BRIGHTNESS) + '%)';
  targetCtx.drawImage(asset.image, -width / 2, -height / 2, width, height);
  targetCtx.filter = 'none';
  targetCtx.restore();
}

function getTintedStickerImage(sticker) {
  const fullKey = sticker.defId + ':full';
  const image = assetImages[fullKey] || assetImages[sticker.defId];
  if (!image) return;
  const colorHex = sticker.colorHex || '#FFFFFF';
  if (colorHex === '#FFFFFF') return image;
  const cacheKey = sticker.defId + '|' + colorHex + (assetImages[fullKey] ? '|full' : '|preview');
  if (tintedStickerImages.has(cacheKey)) return tintedStickerImages.get(cacheKey);

  const tintCanvas = document.createElement('canvas');
  tintCanvas.width = image.naturalWidth || image.width;
  tintCanvas.height = image.naturalHeight || image.height;
  const tintCtx = tintCanvas.getContext('2d', { alpha: true, colorSpace: 'srgb', willReadFrequently: true });
  tintCtx.drawImage(image, 0, 0);
  const pixels = tintCtx.getImageData(0, 0, tintCanvas.width, tintCanvas.height);
  const red = Number.parseInt(colorHex.slice(1, 3), 16);
  const green = Number.parseInt(colorHex.slice(3, 5), 16);
  const blue = Number.parseInt(colorHex.slice(5, 7), 16);
  for (let index = 0; index < pixels.data.length; index += 4) {
    pixels.data[index] = Math.round(pixels.data[index] * red / 255);
    pixels.data[index + 1] = Math.round(pixels.data[index + 1] * green / 255);
    pixels.data[index + 2] = Math.round(pixels.data[index + 2] * blue / 255);
  }
  tintCtx.putImageData(pixels, 0, 0);
  tintedStickerImages.set(cacheKey, tintCanvas);
  if (tintedStickerImages.size > TINTED_STICKER_CACHE_LIMIT) {
    tintedStickerImages.delete(tintedStickerImages.keys().next().value);
  }
  return tintCanvas;
}

function drawSticker(targetCtx, sticker) {
  const image = getTintedStickerImage(sticker);
  if (!image) return;
  targetCtx.save();
  targetCtx.translate(sticker.x, sticker.y);
  targetCtx.rotate(sticker.rotation);
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = 'high';
  targetCtx.drawImage(image, -sticker.w / 2, -sticker.h / 2, sticker.w, sticker.h);
  targetCtx.restore();
}

function drawFrame(targetCtx) {
  if (!state.frameId) return;
  const image = assetImages[state.frameId + ':full'] || assetImages[state.frameId];
  if (!image) return;
  targetCtx.save();
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = 'high';
  targetCtx.drawImage(image, 0, 0, COMPOSITION_WIDTH, COMPOSITION_HEIGHT);
  targetCtx.restore();
}

function renderComposition(targetCtx, editingPreview) {
  targetCtx.fillStyle = editingPreview && !state.photo ? '#1a1f23' : '#000';
  targetCtx.fillRect(0, 0, COMPOSITION_WIDTH, COMPOSITION_HEIGHT);
  if (state.photo) drawPhoto(targetCtx, state.photo);

  if (editingPreview && state.photoEditing) return;

  state.stickers.filter(function(sticker) {
    return sticker.frameSide === 'below';
  }).forEach(function(sticker) { drawSticker(targetCtx, sticker); });
  drawFrame(targetCtx);
  state.stickers.filter(function(sticker) {
    return sticker.frameSide === 'above';
  }).forEach(function(sticker) { drawSticker(targetCtx, sticker); });
}

function draw() {
  const scaleX = canvas.width / COMPOSITION_WIDTH;
  const scaleY = canvas.height / COMPOSITION_HEIGHT;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  renderComposition(ctx, true);

  if (state.photoEditing && state.photo) {
    drawPhotoSelection(ctx, state.photo);
  } else {
    const selected = getSelectedSticker();
    if (selected) drawStickerSelection(ctx, selected);
  }
  drawSnapGuides(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  updateEditToolbar();
  updateQualityIndicator();
}

function drawPhotoSelection(targetCtx, photo) {
  const asset = getPhotoAsset(photo);
  if (!asset) return;
  const width = asset.width * photo.scale;
  const height = asset.height * photo.scale;
  targetCtx.save();
  targetCtx.translate(photo.x, photo.y);
  targetCtx.rotate(photo.rotation);
  drawSelectionFrame(targetCtx, width, height, false);
  targetCtx.restore();
}

function drawStickerSelection(targetCtx, sticker) {
  targetCtx.save();
  targetCtx.translate(sticker.x, sticker.y);
  targetCtx.rotate(sticker.rotation);
  drawSelectionFrame(targetCtx, sticker.w, sticker.h, true);
  targetCtx.restore();
}

function drawSelectionFrame(targetCtx, width, height, showRotationHandle) {
  targetCtx.strokeStyle = '#bde9ff';
  targetCtx.lineWidth = 2;
  targetCtx.strokeRect(-width / 2, -height / 2, width, height);

  const handleSize = SELECTION_HANDLE_SIZE;
  selectionCorners(width, height).forEach(function(corner) {
    targetCtx.fillStyle = 'rgba(1,8,13,0.92)';
    targetCtx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
    targetCtx.strokeStyle = '#7ed0ff';
    targetCtx.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
  });

  if (!showRotationHandle) return;
  const rotateX = width / 2;
  const rotateY = -height / 2 - handleSize / 2 - 12;
  targetCtx.beginPath();
  targetCtx.moveTo(width / 2, -height / 2);
  targetCtx.lineTo(rotateX, rotateY + handleSize / 2);
  targetCtx.strokeStyle = 'rgba(126,208,255,0.75)';
  targetCtx.stroke();
  targetCtx.fillStyle = '#7ed0ff';
  targetCtx.fillRect(rotateX - handleSize / 2, rotateY - handleSize / 2, handleSize, handleSize);
  targetCtx.strokeStyle = 'rgba(1,8,13,0.9)';
  targetCtx.strokeRect(rotateX - handleSize / 2, rotateY - handleSize / 2, handleSize, handleSize);
}

function drawSnapGuides(targetCtx) {
  const guides = state.snapGuides;
  if (!guides.x && !guides.y && !guides.rotation && !guides.left &&
      !guides.right && !guides.top && !guides.bottom) return;

  targetCtx.save();
  targetCtx.strokeStyle = '#7ed0ff';
  targetCtx.lineWidth = 2;
  targetCtx.setLineDash([10, 10]);
  if (guides.x) {
    targetCtx.beginPath();
    targetCtx.moveTo(COMPOSITION_WIDTH / 2, 0);
    targetCtx.lineTo(COMPOSITION_WIDTH / 2, COMPOSITION_HEIGHT);
    targetCtx.stroke();
  }
  if (guides.y) {
    targetCtx.beginPath();
    targetCtx.moveTo(0, COMPOSITION_HEIGHT / 2);
    targetCtx.lineTo(COMPOSITION_WIDTH, COMPOSITION_HEIGHT / 2);
    targetCtx.stroke();
  }
  targetCtx.setLineDash([]);
  targetCtx.lineWidth = 5;
  if (guides.left) strokeGuideEdge(targetCtx, 0, 0, 0, COMPOSITION_HEIGHT);
  if (guides.right) strokeGuideEdge(targetCtx, COMPOSITION_WIDTH, 0, COMPOSITION_WIDTH, COMPOSITION_HEIGHT);
  if (guides.top) strokeGuideEdge(targetCtx, 0, 0, COMPOSITION_WIDTH, 0);
  if (guides.bottom) strokeGuideEdge(targetCtx, 0, COMPOSITION_HEIGHT, COMPOSITION_WIDTH, COMPOSITION_HEIGHT);

  const selected = getSelectedSticker();
  if (guides.rotation && selected && !state.photoEditing) {
    const length = Math.max(selected.w, selected.h) * 0.75 + 60;
    targetCtx.translate(selected.x, selected.y);
    targetCtx.rotate(selected.rotation);
    targetCtx.setLineDash([7, 9]);
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(-length, 0);
    targetCtx.lineTo(length, 0);
    targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.moveTo(0, -length);
    targetCtx.lineTo(0, length);
    targetCtx.stroke();
  }
  targetCtx.restore();
}

function strokeGuideEdge(targetCtx, x1, y1, x2, y2) {
  targetCtx.beginPath();
  targetCtx.moveTo(x1, y1);
  targetCtx.lineTo(x2, y2);
  targetCtx.stroke();
}

// ===== Category and asset panel =====
function categoryLabel(category) {
  return t('category_' + category);
}

function rebuildCategoryTabs() {
  categoryTabs.replaceChildren();
  photoAdjustSlot.replaceChildren();

  const photoButton = document.createElement('button');
  photoButton.type = 'button';
  photoButton.className = 'photo-adjust-button' + (state.photoEditing ? ' active' : '');
  photoButton.textContent = t('photo_adjust');
  photoButton.disabled = !state.photo;
  photoButton.setAttribute('aria-pressed', String(state.photoEditing));
  photoButton.addEventListener('click', togglePhotoEditing);
  photoAdjustSlot.appendChild(photoButton);

  CATEGORIES.forEach(function(category) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-tab' + (!state.photoEditing && state.activeCategory === category ? ' active' : '');
    button.textContent = categoryLabel(category);
    button.disabled = state.photoEditing;
    button.addEventListener('click', function() {
      state.activeCategory = category;
      rebuildCategoryTabs();
      buildAssetPanel();
    });
    categoryTabs.appendChild(button);
  });
}

function buildAssetPanel() {
  stickerGrid.replaceChildren();
  stickerGrid.classList.toggle('is-disabled', state.photoEditing);
  const eagerCount = eagerThumbnailCount();

  if (state.activeCategory === 'frames') {
    stickerGrid.appendChild(createNoFrameButton());
  }

  ASSET_DEFS.filter(function(def) {
    return def.category === state.activeCategory;
  }).forEach(function(def, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sticker-thumb';
    const displayName = getAssetDefDisplayName(def);
    button.title = displayName;
    const isStickerLimit = def.category === 'stickers' && state.stickers.length >= MAX_STICKERS;
    button.disabled = state.photoEditing || isStickerLimit;
    if (def.category === 'frames' && state.frameId === def.id) {
      button.classList.add('selected-asset');
    }

    const image = document.createElement('img');
    image.alt = displayName;
    image.loading = index < eagerCount ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.fetchPriority = index < eagerCount ? 'high' : 'low';
    image.src = def.thumbnail;
    image.onerror = function() {
      image.onerror = null;
      image.src = createFallbackAsset(def).src;
      button.classList.add('asset-missing');
    };
    button.appendChild(image);

    const label = document.createElement('span');
    label.className = 'thumb-name';
    label.textContent = displayName;
    button.appendChild(label);

    button.addEventListener('click', async function() {
      if (def.category === 'frames' && state.frameId === def.id) return;
      cancelAssetWarm(def);
      button.disabled = true;
      if (def.category === 'frames') await setFrame(def.id);
      else await addSticker(def.id);
    });
    button.addEventListener('pointerenter', function() { warmAsset(def); });
    button.addEventListener('pointerleave', function() { cancelAssetWarm(def); });
    button.addEventListener('focus', function() { warmAsset(def); });
    button.addEventListener('blur', function() { cancelAssetWarm(def); });
    stickerGrid.appendChild(button);
  });
}

function createNoFrameButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sticker-thumb no-frame-thumb' + (!state.frameId ? ' selected-asset' : '');
  button.disabled = state.photoEditing;
  const mark = document.createElement('span');
  mark.className = 'no-frame-mark';
  mark.textContent = '×';
  button.appendChild(mark);
  const label = document.createElement('span');
  label.className = 'thumb-name';
  label.textContent = t('no_frame');
  button.appendChild(label);
  button.addEventListener('click', function() { setFrame(null); });
  return button;
}

async function setFrame(frameId) {
  if (state.photoEditing || state.frameId === frameId) return;
  if (frameId) {
    const def = ASSET_DEFS.find(function(item) { return item.id === frameId && item.category === 'frames'; });
    if (!def) return;
    updateStatus(t('status_sticker_loading'), 'status_sticker_loading');
     await loadAsset(def, 'high', false);
  }
  const before = captureSnapshot();
  const hadFrame = !!state.frameId;
  state.frameId = frameId;
  const actionKey = frameId
    ? (hadFrame ? 'action_replace_frame' : 'action_add_frame')
    : 'action_remove_frame';
  commitHistory(before, actionKey);
  rebuildCategoryTabs();
  buildAssetPanel();
  draw();
  const statusKey = frameId ? 'status_frame_changed' : 'status_frame_removed';
  updateStatus(t(statusKey), statusKey);
}

// ===== Sticker operations =====
async function addSticker(defId) {
  if (state.photoEditing) return;
  if (state.stickers.length >= MAX_STICKERS) {
    updateStatus(t('status_sticker_limit'), 'status_sticker_limit');
    return;
  }
  const def = ASSET_DEFS.find(function(item) { return item.id === defId && item.category === 'stickers'; });
  if (!def) return;
  updateStatus(t('status_sticker_loading'), 'status_sticker_loading');
   const image = await loadAsset(def, 'high', false);

  const before = captureSnapshot();
  const aspect = (image.naturalWidth || image.width)
    ? (image.naturalHeight || image.height) / (image.naturalWidth || image.width)
    : 1;
  const width = Math.min(def.defaultWidth || 512, COMPOSITION_WIDTH * 0.75);
  const sticker = {
    id: 'sticker_' + (++stickerIdCounter),
    defId: def.id,
    name: def.name,
    x: COMPOSITION_WIDTH / 2,
    y: COMPOSITION_HEIGHT / 2,
    w: width,
    h: width * aspect,
    rotation: 0,
    frameSide: 'below',
    colorId: 0,
    colorName: STICKER_COLORS[0].name,
    colorHex: STICKER_COLORS[0].hex.slice(0, 7),
  };
  keepStickerReachable(sticker);
  state.stickers.push(sticker);
  state.selectedStickerId = sticker.id;
  commitHistory(before, 'action_add_sticker');
  buildAssetPanel();
  draw();
  updateStatus(t('status_ready'), 'status_ready');
}

function getSelectedSticker() {
  return state.stickers.find(function(sticker) {
    return sticker.id === state.selectedStickerId;
  }) || null;
}

function performStickerAction(actionKey, operation) {
  const selected = getSelectedSticker();
  if (!selected || state.photoEditing) return;
  const before = captureSnapshot();
  operation(selected);
  keepStickerReachable(selected);
  commitHistory(before, actionKey);
  draw();
}

function deleteSelectedSticker() {
  const selected = getSelectedSticker();
  if (!selected || state.photoEditing) return;
  const before = captureSnapshot();
  state.stickers = state.stickers.filter(function(sticker) { return sticker.id !== selected.id; });
  state.selectedStickerId = null;
  commitHistory(before, 'action_delete_sticker');
  buildAssetPanel();
  draw();
}

function scaleSelectedSticker(multiplier) {
  performStickerAction('action_scale_sticker', function(sticker) {
    const width = Math.max(MIN_STICKER_WIDTH, Math.min(MAX_STICKER_WIDTH, sticker.w * multiplier));
    const ratio = sticker.h / sticker.w;
    sticker.w = width;
    sticker.h = width * ratio;
  });
}

function rotateSelectedSticker(delta) {
  performStickerAction('action_rotate_sticker', function(sticker) {
    const result = snapRotation(sticker.rotation + delta);
    sticker.rotation = result.rotation;
    state.snapGuides.rotation = result.snapped;
  });
  scheduleSnapGuideClear();
}

function setSelectedStickerLayer(frameSide) {
  performStickerAction('action_layer_sticker', function(sticker) {
    sticker.frameSide = frameSide;
  });
}

function setSelectedStickerColor(colorId) {
  const color = STICKER_COLORS.find(function(item) { return item.index === colorId; });
  if (!color) return;
  performStickerAction('action_color_sticker', function(sticker) {
    sticker.colorId = color.index;
    sticker.colorName = color.name;
    sticker.colorHex = color.hex.slice(0, 7);
  });
}

function pointInSticker(x, y, sticker) {
  return pointInRotatedRect(x, y, sticker.x, sticker.y, sticker.w, sticker.h, sticker.rotation);
}

function pointInStickerHandle(x, y, sticker) {
  const local = rotatedLocalPoint(x, y, sticker.x, sticker.y, sticker.rotation);
  const centerX = sticker.w / 2;
  const centerY = -sticker.h / 2 - SELECTION_HANDLE_SIZE / 2 - 12;
  const halfHit = SELECTION_HANDLE_HIT_SIZE / 2;
  return Math.abs(local.x - centerX) <= halfHit && Math.abs(local.y - centerY) <= halfHit;
}

function keepStickerReachable(sticker) {
  const margin = Math.min(64, Math.max(24, Math.min(sticker.w, sticker.h) * 0.25));
  sticker.x = Math.max(margin, Math.min(COMPOSITION_WIDTH - margin, sticker.x));
  sticker.y = Math.max(margin, Math.min(COMPOSITION_HEIGHT - margin, sticker.y));
}

function orderedStickersForHitTest() {
  const above = state.stickers.filter(function(sticker) { return sticker.frameSide === 'above'; }).slice().reverse();
  const below = state.stickers.filter(function(sticker) { return sticker.frameSide === 'below'; }).slice().reverse();
  return above.concat(below);
}

// ===== Photo import and processing =====
let heicModulePromise = null;

function isLikelyHeic(file) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || /\.(heic|heif)$/.test(name);
}

async function isHeicFile(file) {
  if (isLikelyHeic(file)) return true;
  try {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (bytes.length < 12) return false;
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return ['mif1', 'msf1', 'heic', 'heix', 'hevc', 'hevx'].includes(brand);
  } catch (error) {
    return false;
  }
}

async function loadHeicModule() {
  if (!heicModulePromise) {
    const url = new URL('vendor/heic-to-csp-1.5.2.js', document.baseURI).href;
    heicModulePromise = import(url);
  }
  return heicModulePromise;
}

async function decodeBlob(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch (error) {
      try {
        return await createImageBitmap(blob);
      } catch (retryError) {
        // Image element fallback below.
      }
    }
  }
  return await new Promise(function(resolve, reject) {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = function() {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = function() {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };
    image.src = url;
  });
}

function drawableWidth(image) {
  return image.naturalWidth || image.width;
}

function drawableHeight(image) {
  return image.naturalHeight || image.height;
}

async function limitWorkingImage(image) {
  const sourceWidth = drawableWidth(image);
  const sourceHeight = drawableHeight(image);
  const longest = Math.max(sourceWidth, sourceHeight);
  if (longest <= MAX_WORKING_EDGE) {
    return { image: image, width: sourceWidth, height: sourceHeight };
  }

  const ratio = MAX_WORKING_EDGE / longest;
  const width = Math.round(sourceWidth * ratio);
  const height = Math.round(sourceHeight * ratio);
  const workCanvas = document.createElement('canvas');
  workCanvas.width = width;
  workCanvas.height = height;
  const workCtx = workCanvas.getContext('2d');
  workCtx.imageSmoothingEnabled = true;
  workCtx.imageSmoothingQuality = 'high';
  workCtx.drawImage(image, 0, 0, width, height);

  let output = workCanvas;
  if (typeof createImageBitmap === 'function') {
    output = await createImageBitmap(workCanvas);
  }
  if (typeof image.close === 'function') image.close();
  return { image: output, width: width, height: height };
}

async function processPhotoFile(file) {
  let decoded;
  try {
    decoded = await decodeBlob(file);
  } catch (nativeError) {
    if (!await isHeicFile(file)) throw nativeError;
    updateStatus(t('status_photo_converting'), 'status_photo_converting');
    const heic = await loadHeicModule();
    const converted = await heic.heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.95,
    });
    decoded = await decodeBlob(Array.isArray(converted) ? converted[0] : converted);
  }
  updateStatus(t('status_photo_processing'), 'status_photo_processing');
  return await limitWorkingImage(decoded);
}

function createDefaultPhoto(assetId) {
  const asset = photoAssets.get(assetId);
  const baseScale = Math.max(COMPOSITION_WIDTH / asset.width, COMPOSITION_HEIGHT / asset.height);
  return {
    assetId: assetId,
    x: COMPOSITION_WIDTH / 2,
    y: COMPOSITION_HEIGHT / 2,
    scale: baseScale,
    baseScale: baseScale,
    rotation: 0,
    brightness: PHOTO_DEFAULT_BRIGHTNESS,
  };
}

async function handlePhotoFile(file) {
  if (!file) return;
  if (file.size > MAX_UPLOAD_BYTES) {
    updateStatus(t('status_photo_too_large'), 'status_photo_too_large');
    fileInput.value = '';
    return;
  }
  const before = captureSnapshot();
  const replacing = !!state.photo;
  btnUpload.disabled = true;
  try {
    const processed = await processPhotoFile(file);
    const assetId = 'photo_' + (++photoAssetCounter);
    photoAssets.set(assetId, {
      id: assetId,
      image: processed.image,
      width: processed.width,
      height: processed.height,
      name: file.name || t('photo_name'),
    });
    state.photo = createDefaultPhoto(assetId);
    commitHistory(before, replacing ? 'action_replace_photo' : 'action_upload_photo');
    rebuildCategoryTabs();
    buildAssetPanel();
    updateDynamicControls();
    draw();
    updateStatus(t('status_photo_loaded'), 'status_photo_loaded');
  } catch (error) {
    console.error(error);
    updateStatus(t('status_photo_failed'), 'status_photo_failed');
  } finally {
    btnUpload.disabled = false;
    fileInput.value = '';
    updateDynamicControls();
  }
}

// ===== Photo geometry and operations =====
function photoSize(photo) {
  const asset = getPhotoAsset(photo);
  return asset
    ? { width: asset.width * photo.scale, height: asset.height * photo.scale }
    : { width: 0, height: 0 };
}

function rotatedBoundsSize(width, height, rotation) {
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

function photoBounds(photo) {
  const size = photoSize(photo);
  const bounds = rotatedBoundsSize(size.width, size.height, photo.rotation);
  return {
    left: photo.x - bounds.width / 2,
    right: photo.x + bounds.width / 2,
    top: photo.y - bounds.height / 2,
    bottom: photo.y + bounds.height / 2,
    width: bounds.width,
    height: bounds.height,
  };
}

function pointInPhoto(x, y, photo) {
  const size = photoSize(photo);
  return pointInRotatedRect(x, y, photo.x, photo.y, size.width, size.height, photo.rotation);
}

function keepPhotoReachable(photo) {
  const bounds = photoBounds(photo);
  photo.x = Math.max(-bounds.width / 2 + MIN_VISIBLE_PHOTO,
    Math.min(COMPOSITION_WIDTH + bounds.width / 2 - MIN_VISIBLE_PHOTO, photo.x));
  photo.y = Math.max(-bounds.height / 2 + MIN_VISIBLE_PHOTO,
    Math.min(COMPOSITION_HEIGHT + bounds.height / 2 - MIN_VISIBLE_PHOTO, photo.y));
}

function snapPhotoPosition(photo, rawX, rawY) {
  photo.x = rawX;
  photo.y = rawY;
  const bounds = photoBounds(photo);
  const xCandidates = [
    { value: COMPOSITION_WIDTH / 2, type: 'x' },
    { value: bounds.width / 2, type: 'left' },
    { value: COMPOSITION_WIDTH - bounds.width / 2, type: 'right' },
  ];
  const yCandidates = [
    { value: COMPOSITION_HEIGHT / 2, type: 'y' },
    { value: bounds.height / 2, type: 'top' },
    { value: COMPOSITION_HEIGHT - bounds.height / 2, type: 'bottom' },
  ];
  const xSnap = nearestSnap(rawX, xCandidates);
  const ySnap = nearestSnap(rawY, yCandidates);
  if (xSnap) photo.x = xSnap.value;
  if (ySnap) photo.y = ySnap.value;
  clearSnapGuides(false);
  if (xSnap) state.snapGuides[xSnap.type] = true;
  if (ySnap) state.snapGuides[ySnap.type] = true;
  const labels = [];
  if (xSnap) labels.push(xSnap.type === 'x' ? 'SNAP X' : 'EDGE');
  if (ySnap) labels.push(ySnap.type === 'y' ? 'SNAP Y' : 'EDGE');
  state.snapGuides.label = labels.join(' · ');
}

function nearestSnap(value, candidates) {
  let result = null;
  candidates.forEach(function(candidate) {
    const distance = Math.abs(value - candidate.value);
    if (distance <= SNAP_DISTANCE && (!result || distance < result.distance)) {
      result = { value: candidate.value, type: candidate.type, distance: distance };
    }
  });
  return result;
}

function resetPhoto() {
  if (!state.photo || !state.photoEditing) return;
  const before = captureSnapshot();
  state.photo = createDefaultPhoto(state.photo.assetId);
  commitHistory(before, 'action_reset_photo');
  draw();
}

function scalePhoto(multiplier, anchor) {
  if (!state.photo || !state.photoEditing) return false;
  const photo = state.photo;
  const oldScale = photo.scale;
  const min = photo.baseScale * PHOTO_MIN_SCALE_FACTOR;
  const max = photo.baseScale * PHOTO_MAX_SCALE_FACTOR;
  const next = Math.max(min, Math.min(max, oldScale * multiplier));
  if (Math.abs(next - oldScale) < 0.000001) return false;
  if (anchor) {
    const ratio = next / oldScale;
    photo.x = anchor.x + (photo.x - anchor.x) * ratio;
    photo.y = anchor.y + (photo.y - anchor.y) * ratio;
  }
  photo.scale = next;
  keepPhotoReachable(photo);
  return true;
}

function scalePhotoByButton(multiplier) {
  if (!state.photo || !state.photoEditing) return;
  const before = captureSnapshot();
  if (scalePhoto(multiplier, null)) {
    commitHistory(before, 'action_scale_photo');
    draw();
  }
}

function rotatePhoto(delta) {
  if (!state.photo || !state.photoEditing) return;
  const before = captureSnapshot();
  state.photo.rotation = normalizeRotation(state.photo.rotation + delta);
  keepPhotoReachable(state.photo);
  commitHistory(before, 'action_rotate_photo');
  draw();
}

let brightnessHistory = null;
function updatePhotoBrightness(value) {
  if (!state.photo || !state.photoEditing) return;
  const next = Math.max(PHOTO_MIN_BRIGHTNESS, Math.min(PHOTO_MAX_BRIGHTNESS, Number(value) || PHOTO_DEFAULT_BRIGHTNESS));
  if (next === (state.photo.brightness || PHOTO_DEFAULT_BRIGHTNESS)) return;
  if (!brightnessHistory) brightnessHistory = captureSnapshot();
  state.photo.brightness = next;
  photoBrightnessValue.textContent = next + '%';
  draw();
}

function commitPhotoBrightness() {
  if (!brightnessHistory) return;
  commitHistory(brightnessHistory, 'action_brightness_photo');
  brightnessHistory = null;
}

function togglePhotoEditing() {
  if (!state.photo) return;
  flushWheelHistory();
  state.photoEditing = !state.photoEditing;
  if (state.photoEditing) {
    history.photoFloor = history.undo.length;
    history.photoRedoDepth = 0;
  } else {
    history.photoFloor = null;
    history.photoRedoDepth = 0;
    clearSnapGuides();
  }
  rebuildCategoryTabs();
  buildAssetPanel();
  updateDynamicControls();
  draw();
}

function updateQualityIndicator() {
  qualityIndicator.hidden = !state.photoEditing || !state.photo;
  if (qualityIndicator.hidden) return;
  const relativeScale = state.photo.scale / state.photo.baseScale;
  let key = 'quality_good';
  if (relativeScale > 1.5) key = 'quality_low';
  else if (relativeScale > 1) key = 'quality_fair';
  qualityIndicator.textContent = t(key);
  qualityIndicator.dataset.quality = key.replace('quality_', '');
}

// ===== Toolbar =====
function revealMobileToolbar() {
  if (!window.matchMedia('(max-width:760px)').matches) return;
  const viewport = window.visualViewport;
  const viewportTop = viewport ? viewport.offsetTop : 0;
  const viewportBottom = viewportTop + (viewport ? viewport.height : window.innerHeight);
  const rect = canvasControlRow.getBoundingClientRect();
  const margin = 12 + (viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0);
  let delta = 0;
  if (rect.bottom + margin > viewportBottom) {
    delta = rect.bottom + margin - viewportBottom;
  } else if (rect.top - margin < viewportTop) {
    delta = rect.top - margin - viewportTop;
  }
  if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
}

function scheduleMobileToolbarReveal() {
  if (!visibleToolbarMode || mobileToolbarRevealFrame !== null) return;
  mobileToolbarRevealFrame = requestAnimationFrame(function() {
    mobileToolbarRevealFrame = null;
    revealMobileToolbar();
  });
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', scheduleMobileToolbarReveal);
}
window.addEventListener('orientationchange', scheduleMobileToolbarReveal);

function updateEditToolbar() {
  const selected = getSelectedSticker();
  const showPhoto = state.photoEditing && !!state.photo;
  const toolbarMode = showPhoto ? 'photo' : (selected ? 'sticker' : null);
  const shouldReveal = editToolbar.hidden || visibleToolbarMode !== toolbarMode;
  editToolbar.hidden = !toolbarMode;
  if (editToolbar.hidden) {
    visibleToolbarMode = null;
    setStickerColorMenuOpen(false);
    return;
  }
  visibleToolbarMode = toolbarMode;
  if (shouldReveal && window.matchMedia('(max-width:760px)').matches) {
    requestAnimationFrame(function() {
      requestAnimationFrame(scheduleMobileToolbarReveal);
    });
    setTimeout(scheduleMobileToolbarReveal, 180);
  }

  document.querySelectorAll('.tool-sticker').forEach(function(element) {
    element.hidden = showPhoto;
  });
  document.querySelectorAll('.tool-photo').forEach(function(element) {
    element.hidden = !showPhoto;
  });

  if (showPhoto) {
    const zoom = Math.round(state.photo.scale / state.photo.baseScale * 100);
    selectedName.textContent = t('photo_name');
    snapReadout.textContent =
      'X ' + formatCoordinate(state.photo.x) +
      ' · Y ' + formatCoordinate(state.photo.y) +
      ' · R ' + rotationDegrees(state.photo.rotation).toString().padStart(3, '0') + '°' +
      ' · Z ' + zoom + '%';
    btnScaleDown.disabled = state.photo.scale <= state.photo.baseScale * PHOTO_MIN_SCALE_FACTOR;
    btnScaleUp.disabled = state.photo.scale >= state.photo.baseScale * PHOTO_MAX_SCALE_FACTOR;
    photoBrightness.value = String(state.photo.brightness || PHOTO_DEFAULT_BRIGHTNESS);
    photoBrightnessValue.textContent = photoBrightness.value + '%';
  } else if (selected) {
    const selectedDef = ASSET_DEFS.find(function(def) { return def.id === selected.defId; });
    selectedName.textContent = selectedDef ? getAssetDefDisplayName(selectedDef) : selected.name;
    snapReadout.textContent =
      'X ' + formatCoordinate(selected.x) +
      ' · Y ' + formatCoordinate(selected.y) +
      ' · R ' + rotationDegrees(selected.rotation).toString().padStart(3, '0') + '°';
    btnScaleDown.disabled = selected.w <= MIN_STICKER_WIDTH;
    btnScaleUp.disabled = selected.w >= MAX_STICKER_WIDTH;
    btnLayerDown.disabled = selected.frameSide === 'below';
    btnLayerUp.disabled = selected.frameSide === 'above';
    const selectedColor = STICKER_COLORS.find(function(color) { return color.index === (selected.colorId || 0); });
    stickerColorName.textContent = selectedColor ? getColorDisplayName(selectedColor) : selected.colorName;
    stickerColorControl.style.setProperty('--sticker-color', selected.colorHex || '#FFFFFF');
    stickerColorMenu.querySelectorAll('.sticker-color-option').forEach(function(option) {
      option.setAttribute('aria-selected', String(Number(option.dataset.colorId) === (selected.colorId || 0)));
    });
  }
  snapReadout.classList.toggle('is-snapped', hasSnapGuide());
  if (state.snapGuides.label) snapReadout.textContent += ' · ' + state.snapGuides.label;
}

function refreshLocalizedAssetLabels() {
  if (ASSET_DEFS.length) buildAssetPanel();
  if (STICKER_COLORS.length) populateStickerColorMenu();
  updateEditToolbar();
}

function formatCoordinate(value) {
  return Math.round(value).toString().padStart(4, '0');
}

// ===== Pointer and wheel interaction =====
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (COMPOSITION_WIDTH / rect.width),
    y: (event.clientY - rect.top) * (COMPOSITION_HEIGHT / rect.height),
  };
}

function rotatedLocalPoint(x, y, centerX, centerY, rotation) {
  const dx = x - centerX;
  const dy = y - centerY;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

function pointInRotatedRect(x, y, centerX, centerY, width, height, rotation) {
  const local = rotatedLocalPoint(x, y, centerX, centerY, rotation);
  return Math.abs(local.x) <= width / 2 && Math.abs(local.y) <= height / 2;
}

function selectionCorners(width, height) {
  return [
    { x: -width / 2, y: -height / 2, sx: -1, sy: -1 },
    { x: width / 2, y: -height / 2, sx: 1, sy: -1 },
    { x: width / 2, y: height / 2, sx: 1, sy: 1 },
    { x: -width / 2, y: height / 2, sx: -1, sy: 1 },
  ];
}

function selectionCornerAt(x, y, centerX, centerY, width, height, rotation) {
  const local = rotatedLocalPoint(x, y, centerX, centerY, rotation);
  const halfHit = SELECTION_HANDLE_HIT_SIZE / 2;
  return selectionCorners(width, height).find(function(corner) {
    return Math.abs(local.x - corner.x) <= halfHit && Math.abs(local.y - corner.y) <= halfHit;
  }) || null;
}

function rotatedOffsetPoint(x, y, offsetX, offsetY, rotation) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: x + offsetX * cos - offsetY * sin,
    y: y + offsetX * sin + offsetY * cos,
  };
}

const activePhotoPointers = new Map();
let photoGesture = null;
let stickerGesture = null;
let wheelHistory = null;
let wheelHistoryTimer = null;
let snapGuideTimer = null;

function beginPhotoPointer(event, point) {
  if (!state.photo) return false;
  const size = photoSize(state.photo);
  const corner = selectionCornerAt(point.x, point.y, state.photo.x, state.photo.y,
    size.width, size.height, state.photo.rotation);
  if (!corner && !pointInPhoto(point.x, point.y, state.photo)) return false;
  event.preventDefault();
  activePhotoPointers.set(event.pointerId, point);
  try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* no-op */ }

  if (!photoGesture) {
    if (corner) {
      const anchor = rotatedOffsetPoint(state.photo.x, state.photo.y,
        -corner.sx * size.width / 2, -corner.sy * size.height / 2, state.photo.rotation);
      photoGesture = {
        before: captureSnapshot(),
        actionKey: 'action_scale_photo',
        mode: 'scale-corner',
        dragPointerId: event.pointerId,
        photoStart: { ...state.photo },
        corner: corner,
        anchor: anchor,
        startWidth: size.width,
        startHeight: size.height,
        pinch: null,
      };
    } else {
      photoGesture = {
        before: captureSnapshot(),
        actionKey: 'action_move_photo',
        mode: 'move',
        dragPointerId: event.pointerId,
        dragStart: point,
        photoStart: { ...state.photo },
        pinch: null,
      };
    }
  }
  if (activePhotoPointers.size >= 2) startPhotoPinch();
  return true;
}

function startPhotoPinch() {
  const points = Array.from(activePhotoPointers.values()).slice(0, 2);
  const center = midpoint(points[0], points[1]);
  photoGesture.pinch = {
    distance: pointDistance(points[0], points[1]),
    center: center,
    photoStart: { ...state.photo },
  };
  photoGesture.mode = 'pinch';
  photoGesture.actionKey = 'action_scale_photo';
}

function movePhotoPointer(event, point) {
  if (!activePhotoPointers.has(event.pointerId) || !photoGesture) return false;
  event.preventDefault();
  activePhotoPointers.set(event.pointerId, point);

  if (activePhotoPointers.size >= 2 && photoGesture.pinch) {
    const points = Array.from(activePhotoPointers.values()).slice(0, 2);
    const center = midpoint(points[0], points[1]);
    const distance = Math.max(1, pointDistance(points[0], points[1]));
    const start = photoGesture.pinch;
    const min = start.photoStart.baseScale * PHOTO_MIN_SCALE_FACTOR;
    const max = start.photoStart.baseScale * PHOTO_MAX_SCALE_FACTOR;
    const nextScale = Math.max(min, Math.min(max, start.photoStart.scale * distance / Math.max(1, start.distance)));
    const ratio = nextScale / start.photoStart.scale;
    state.photo.scale = nextScale;
    state.photo.x = center.x + (start.photoStart.x - start.center.x) * ratio;
    state.photo.y = center.y + (start.photoStart.y - start.center.y) * ratio;
    snapPhotoPosition(state.photo, state.photo.x, state.photo.y);
    keepPhotoReachable(state.photo);
  } else if (event.pointerId === photoGesture.dragPointerId && photoGesture.mode === 'scale-corner') {
    const start = photoGesture;
    const local = rotatedLocalPoint(point.x, point.y, start.anchor.x, start.anchor.y,
      start.photoStart.rotation);
    const diagonalX = start.corner.sx * start.startWidth;
    const diagonalY = start.corner.sy * start.startHeight;
    const denominator = diagonalX * diagonalX + diagonalY * diagonalY;
    const rawRatio = denominator ? (local.x * diagonalX + local.y * diagonalY) / denominator : 1;
    const min = start.photoStart.baseScale * PHOTO_MIN_SCALE_FACTOR;
    const max = start.photoStart.baseScale * PHOTO_MAX_SCALE_FACTOR;
    const nextScale = Math.max(min, Math.min(max, start.photoStart.scale * rawRatio));
    const asset = getPhotoAsset(state.photo);
    if (!asset) return false;
    const nextWidth = asset.width * nextScale;
    const nextHeight = asset.height * nextScale;
    const center = rotatedOffsetPoint(start.anchor.x, start.anchor.y,
      start.corner.sx * nextWidth / 2, start.corner.sy * nextHeight / 2,
      start.photoStart.rotation);
    state.photo.scale = nextScale;
    state.photo.x = center.x;
    state.photo.y = center.y;
    keepPhotoReachable(state.photo);
  } else if (event.pointerId === photoGesture.dragPointerId) {
    const rawX = photoGesture.photoStart.x + point.x - photoGesture.dragStart.x;
    const rawY = photoGesture.photoStart.y + point.y - photoGesture.dragStart.y;
    snapPhotoPosition(state.photo, rawX, rawY);
    keepPhotoReachable(state.photo);
  }
  draw();
  return true;
}

function endPhotoPointer(event) {
  if (!activePhotoPointers.has(event.pointerId) || !photoGesture) return false;
  activePhotoPointers.delete(event.pointerId);
  try { canvas.releasePointerCapture(event.pointerId); } catch (error) { /* no-op */ }

  if (activePhotoPointers.size === 1) {
    const remaining = Array.from(activePhotoPointers.entries())[0];
    photoGesture.dragPointerId = remaining[0];
    photoGesture.dragStart = remaining[1];
    photoGesture.photoStart = { ...state.photo };
    photoGesture.mode = 'move';
    photoGesture.pinch = null;
  } else if (activePhotoPointers.size === 0) {
    commitHistory(photoGesture.before, photoGesture.actionKey);
    photoGesture = null;
    clearSnapGuides();
    draw();
  }
  return true;
}

function beginStickerPointer(event, point) {
  if (!event.isPrimary) return;
  clearSnapGuides();
  const selected = getSelectedSticker();
  const corner = selected && selectionCornerAt(point.x, point.y, selected.x, selected.y,
    selected.w, selected.h, selected.rotation);
  if (corner) {
    const anchor = rotatedOffsetPoint(selected.x, selected.y,
      -corner.sx * selected.w / 2, -corner.sy * selected.h / 2, selected.rotation);
    stickerGesture = {
      pointerId: event.pointerId,
      before: captureSnapshot(),
      stickerId: selected.id,
      mode: 'scale',
      corner: corner,
      anchor: anchor,
      startWidth: selected.w,
      startHeight: selected.h,
      startRotation: selected.rotation,
    };
    try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* no-op */ }
    return;
  }
  if (selected && pointInStickerHandle(point.x, point.y, selected)) {
    stickerGesture = {
      pointerId: event.pointerId,
      before: captureSnapshot(),
      stickerId: selected.id,
      mode: 'rotate',
      startPoint: point,
      startRotation: selected.rotation,
    };
    try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* no-op */ }
    return;
  }

  const hit = orderedStickersForHitTest().find(function(sticker) {
    return pointInSticker(point.x, point.y, sticker);
  });
  if (!hit) {
    state.selectedStickerId = null;
    draw();
    return;
  }

  state.selectedStickerId = hit.id;
  stickerGesture = {
    pointerId: event.pointerId,
    before: captureSnapshot(),
    stickerId: hit.id,
    mode: 'move',
    startPoint: point,
    startX: hit.x,
    startY: hit.y,
  };
  try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* no-op */ }
  draw();
}

function moveStickerPointer(event, point) {
  if (!stickerGesture || stickerGesture.pointerId !== event.pointerId) return;
  const sticker = state.stickers.find(function(item) { return item.id === stickerGesture.stickerId; });
  if (!sticker) return;
  if (stickerGesture.mode === 'move') {
    const rawX = stickerGesture.startX + point.x - stickerGesture.startPoint.x;
    const rawY = stickerGesture.startY + point.y - stickerGesture.startPoint.y;
    snapStickerPosition(sticker, rawX, rawY);
    keepStickerReachable(sticker);
  } else if (stickerGesture.mode === 'scale') {
    const start = stickerGesture;
    const local = rotatedLocalPoint(point.x, point.y, start.anchor.x, start.anchor.y,
      start.startRotation);
    const diagonalX = start.corner.sx * start.startWidth;
    const diagonalY = start.corner.sy * start.startHeight;
    const denominator = diagonalX * diagonalX + diagonalY * diagonalY;
    const rawRatio = denominator ? (local.x * diagonalX + local.y * diagonalY) / denominator : 1;
    const nextWidth = Math.max(MIN_STICKER_WIDTH,
      Math.min(MAX_STICKER_WIDTH, start.startWidth * rawRatio));
    const nextHeight = nextWidth * start.startHeight / start.startWidth;
    const center = rotatedOffsetPoint(start.anchor.x, start.anchor.y,
      start.corner.sx * nextWidth / 2, start.corner.sy * nextHeight / 2,
      start.startRotation);
    sticker.w = nextWidth;
    sticker.h = nextHeight;
    sticker.x = center.x;
    sticker.y = center.y;
    keepStickerReachable(sticker);
  } else {
    const startAngle = Math.atan2(stickerGesture.startPoint.y - sticker.y, stickerGesture.startPoint.x - sticker.x);
    const angle = Math.atan2(point.y - sticker.y, point.x - sticker.x);
    const result = snapRotation(stickerGesture.startRotation + angle - startAngle);
    sticker.rotation = result.rotation;
    clearSnapGuides(false);
    state.snapGuides.rotation = result.snapped;
  }
  draw();
}

function endStickerPointer(event) {
  if (!stickerGesture || stickerGesture.pointerId !== event.pointerId) return;
  const actionKey = stickerGesture.mode === 'move'
    ? 'action_move_sticker'
    : (stickerGesture.mode === 'scale' ? 'action_scale_sticker' : 'action_rotate_sticker');
  commitHistory(stickerGesture.before, actionKey);
  stickerGesture = null;
  clearSnapGuides();
  try { canvas.releasePointerCapture(event.pointerId); } catch (error) { /* no-op */ }
  draw();
}

canvas.addEventListener('pointerdown', function(event) {
  flushWheelHistory();
  const point = canvasPoint(event);
  if (state.photoEditing) beginPhotoPointer(event, point);
  else beginStickerPointer(event, point);
});

canvas.addEventListener('pointermove', function(event) {
  const point = canvasPoint(event);
  canvasReadout.textContent = 'X ' + formatCoordinate(point.x) + ' / Y ' + formatCoordinate(point.y);
  if (state.photoEditing) movePhotoPointer(event, point);
  else moveStickerPointer(event, point);
});

canvas.addEventListener('pointerup', function(event) {
  if (state.photoEditing) endPhotoPointer(event);
  else endStickerPointer(event);
});

canvas.addEventListener('pointercancel', function(event) {
  if (state.photoEditing) endPhotoPointer(event);
  else endStickerPointer(event);
});

canvas.addEventListener('wheel', function(event) {
  event.preventDefault();
  const before = wheelHistory ? null : captureSnapshot();
  let changed = false;
  let actionKey = '';
  if (state.photoEditing && state.photo) {
    changed = scalePhoto(event.deltaY < 0 ? 1.05 : 0.95, canvasPoint(event));
    actionKey = 'action_scale_photo';
  } else if (getSelectedSticker()) {
    const sticker = getSelectedSticker();
    const width = Math.max(MIN_STICKER_WIDTH, Math.min(MAX_STICKER_WIDTH,
      sticker.w * (event.deltaY < 0 ? 1.05 : 0.95)));
    if (width !== sticker.w) {
      const ratio = sticker.h / sticker.w;
      sticker.w = width;
      sticker.h = width * ratio;
      keepStickerReachable(sticker);
      changed = true;
    }
    actionKey = 'action_scale_sticker';
  }
  if (!changed) return;
  if (!wheelHistory) wheelHistory = { before: before, actionKey: actionKey };
  clearTimeout(wheelHistoryTimer);
  wheelHistoryTimer = setTimeout(flushWheelHistory, 180);
  draw();
}, { passive: false });

function flushWheelHistory() {
  if (!wheelHistory) return;
  commitHistory(wheelHistory.before, wheelHistory.actionKey);
  wheelHistory = null;
  if (wheelHistoryTimer) clearTimeout(wheelHistoryTimer);
  wheelHistoryTimer = null;
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function snapStickerPosition(sticker, rawX, rawY) {
  const snapX = Math.abs(rawX - COMPOSITION_WIDTH / 2) <= SNAP_DISTANCE;
  const snapY = Math.abs(rawY - COMPOSITION_HEIGHT / 2) <= SNAP_DISTANCE;
  sticker.x = snapX ? COMPOSITION_WIDTH / 2 : rawX;
  sticker.y = snapY ? COMPOSITION_HEIGHT / 2 : rawY;
  clearSnapGuides(false);
  state.snapGuides.x = snapX;
  state.snapGuides.y = snapY;
  state.snapGuides.label = [snapX ? 'SNAP X' : '', snapY ? 'SNAP Y' : ''].filter(Boolean).join(' · ');
}

function snapRotation(rotation) {
  const nearest = Math.round(rotation / ROTATION_SNAP_STEP) * ROTATION_SNAP_STEP;
  const snapped = Math.abs(rotation - nearest) <= ROTATION_SNAP_DISTANCE;
  return { rotation: snapped ? nearest : rotation, snapped: snapped };
}

function normalizeRotation(rotation) {
  const full = Math.PI * 2;
  return ((rotation % full) + full) % full;
}

function rotationDegrees(rotation) {
  return Math.round(normalizeRotation(rotation) * 180 / Math.PI) % 360;
}

function hasSnapGuide() {
  return Object.keys(state.snapGuides).some(function(key) {
    return key !== 'label' && state.snapGuides[key];
  });
}

function clearSnapGuides(cancelTimer) {
  if (cancelTimer !== false && snapGuideTimer) {
    clearTimeout(snapGuideTimer);
    snapGuideTimer = null;
  }
  Object.keys(state.snapGuides).forEach(function(key) {
    state.snapGuides[key] = key === 'label' ? '' : false;
  });
}

function scheduleSnapGuideClear() {
  if (snapGuideTimer) clearTimeout(snapGuideTimer);
  snapGuideTimer = setTimeout(function() {
    snapGuideTimer = null;
    clearSnapGuides(false);
    draw();
  }, 400);
}

// ===== Export =====
async function exportComposition() {
  if (!state.photo || state.photoEditing) return;
  flushWheelHistory();
  updateStatus(t('status_downloading'), 'status_downloading');
  const selectedDefs = [];
  if (state.frameId) {
    const frameDef = ASSET_DEFS.find(function(def) { return def.id === state.frameId; });
    if (frameDef) selectedDefs.push(frameDef);
  }
  state.stickers.forEach(function(sticker) {
    const stickerDef = ASSET_DEFS.find(function(def) { return def.id === sticker.defId; });
    if (stickerDef && !selectedDefs.includes(stickerDef)) selectedDefs.push(stickerDef);
  });
  await Promise.all(selectedDefs.map(function(def) { return loadAsset(def, 'high', true); }));
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = COMPOSITION_WIDTH;
  exportCanvas.height = COMPOSITION_HEIGHT;
  const exportCtx = exportCanvas.getContext('2d');
  exportCtx.imageSmoothingEnabled = true;
  exportCtx.imageSmoothingQuality = 'high';
  renderComposition(exportCtx, false);
  exportCanvas.toBlob(function(blob) {
    if (!blob) {
      updateStatus(t('status_photo_failed'), 'status_photo_failed');
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'death-stranding-2-frame-' + Date.now() + '.png';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
    savedSignature = compositionSignature();
    updateStatus(t('status_ready'), 'status_ready');
  }, 'image/png');
}

// ===== Events =====
btnUpload.addEventListener('click', function() { fileInput.click(); });
fileInput.addEventListener('change', function(event) {
  handlePhotoFile(event.target.files && event.target.files[0]);
});
btnDownload.addEventListener('click', exportComposition);
btnUndo.addEventListener('click', undo);
btnRedo.addEventListener('click', redo);
btnDeleteSticker.addEventListener('click', deleteSelectedSticker);
btnScaleDown.addEventListener('click', function() {
  if (state.photoEditing) scalePhotoByButton(0.9);
  else scaleSelectedSticker(0.9);
});
btnScaleUp.addEventListener('click', function() {
  if (state.photoEditing) scalePhotoByButton(1.1);
  else scaleSelectedSticker(1.1);
});
btnRotateLeft.addEventListener('click', function() {
  if (state.photoEditing) rotatePhoto(-Math.PI / 2);
  else rotateSelectedSticker(-Math.PI / 18);
});
btnRotateRight.addEventListener('click', function() {
  if (state.photoEditing) rotatePhoto(Math.PI / 2);
  else rotateSelectedSticker(Math.PI / 18);
});
btnLayerDown.addEventListener('click', function() { setSelectedStickerLayer('below'); });
btnLayerUp.addEventListener('click', function() { setSelectedStickerLayer('above'); });
stickerColorTrigger.addEventListener('click', function() {
  setStickerColorMenuOpen(stickerColorMenu.hidden);
});
stickerColorTrigger.addEventListener('keydown', function(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  setStickerColorMenuOpen(true, true);
});
stickerColorMenu.addEventListener('keydown', function(event) {
  const options = Array.from(stickerColorMenu.querySelectorAll('.sticker-color-option'));
  const index = options.indexOf(document.activeElement);
  let nextIndex = index;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % options.length;
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + options.length) % options.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = options.length - 1;
  else if (event.key === 'Escape') {
    event.preventDefault();
    setStickerColorMenuOpen(false);
    stickerColorTrigger.focus();
    return;
  } else return;
  event.preventDefault();
  options[nextIndex].focus();
});
btnResetPhoto.addEventListener('click', resetPhoto);
photoBrightness.addEventListener('input', function(event) { updatePhotoBrightness(event.target.value); });
photoBrightness.addEventListener('change', commitPhotoBrightness);
photoBrightness.addEventListener('blur', commitPhotoBrightness);

document.addEventListener('pointerdown', function(event) {
  if (!stickerColorMenu.hidden && !stickerColorControl.contains(event.target)) {
    setStickerColorMenuOpen(false);
  }
  if (!state.selectedStickerId) return;
  if (event.target === canvas || editToolbar.contains(event.target)) return;
  state.selectedStickerId = null;
  clearSnapGuides();
  draw();
});

document.addEventListener('keydown', function(event) {
  const command = event.ctrlKey || event.metaKey;
  if (command && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (command && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
    return;
  }
  if (event.key === 'Delete' && !state.photoEditing) deleteSelectedSticker();
});

window.addEventListener('beforeunload', function(event) {
  const hasComposition = !!state.photo || !!state.frameId || state.stickers.length > 0;
  if (!hasComposition || compositionSignature() === savedSignature) return;
  event.preventDefault();
  event.returnValue = '';
});

// ===== Init =====
async function initialize() {
  registerAssetCacheWorker();
  savedSignature = compositionSignature();
  rebuildCategoryTabs();
  buildAssetPanel();
  updateDynamicControls();
  draw();
  requestAnimationFrame(syncPreviewResolution);
  updateStatus(t('status_sticker_loading'), 'status_sticker_loading');

  try {
    await loadAssetIndex();
    buildAssetPanel();
    updateStatus(t('status_ready'), 'status_ready');
  } catch (error) {
    console.error(error);
    updateStatus(t('status_sticker_failed'), 'status_sticker_failed');
  }
}

initialize();
