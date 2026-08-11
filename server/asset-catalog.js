import { mediaToken } from './asset-session.js';
import assetIndex from '../assets/asset-index.json';
import colorPalette from '../assets/logo-color-palette.json';

const backgroundPaths = [
  'backgrounds/ds2-title-vertical.png',
  'backgrounds/kojima-productions-2.png',
  'backgrounds/drawbridge.png',
  'backgrounds/dhv-magellan.png',
];

function mediaDefinition(kind, relativePath, storagePath, contentType) {
  return {
    token: mediaToken(kind, relativePath),
    storagePath: storagePath,
    contentType: contentType,
  };
}

let cachedCatalog = null;
let mediaByToken = null;

function ensureCatalog() {
  if (cachedCatalog && mediaByToken) return;
  mediaByToken = new Map();
  const publicItems = assetIndex.map(function(item) {
    const relativePath = item.relative_path.replace(/\\/g, '/');
    const thumbnailPath = relativePath.replace(/\.png$/i, '.webp');
    const original = mediaDefinition(
      'original',
      relativePath,
      'assets/library/' + relativePath,
      'image/png'
    );
    const thumbnail = mediaDefinition(
      'thumbnail',
      thumbnailPath,
      'assets/thumbnails/' + thumbnailPath,
      'image/webp'
    );
    mediaByToken.set(original.token, original);
    mediaByToken.set(thumbnail.token, thumbnail);
    return {
      id: item.id,
      category: item.category,
      width: item.width,
      height: item.height,
      names: item.names,
      src: '/media/' + original.token,
      thumbnail: '/media/' + thumbnail.token,
    };
  });

  const publicBackgrounds = backgroundPaths.map(function(relativePath) {
    const definition = mediaDefinition(
      'background',
      relativePath,
      'assets/' + relativePath,
      'image/png'
    );
    mediaByToken.set(definition.token, definition);
    return '/media/' + definition.token;
  });

  cachedCatalog = {
    items: publicItems,
    colors: colorPalette.map(function(color) {
      return {
        index: color.index,
        name: color.name,
        hex: color.hex,
        names: color.names,
      };
    }),
    backgrounds: publicBackgrounds,
  };
}

export function getPublicCatalog() {
  ensureCatalog();
  return cachedCatalog;
}

export function getMediaDefinition(token) {
  ensureCatalog();
  return mediaByToken.get(token) || null;
}
