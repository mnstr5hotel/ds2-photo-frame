// lang.js — 语言包 & 切换逻辑

const LANG = {
  zh: {
    title: 'Photo Simulator',
    lang: 'EN',
    upload: '上传',
    replace: '更换',
    download: '下载',
    sticker_panel: '效果',
    canvas_label: '[ 画布 ]',
    status_ready: '◆ 状态：就绪',
    status_photo_loaded: '◆ 状态：照片已加载',
    status_photo_converting: '◆ 状态：正在转换 HEIC...',
    status_photo_processing: '◆ 状态：正在处理照片...',
    status_photo_failed: '◆ 状态：无法读取该照片',
    status_photo_too_large: '◆ 状态：照片文件不能超过 50 MB',
    status_downloading: '◆ 状态：正在导出...',
    status_sticker_loading: '◆ 状态：正在加载素材...',
    status_sticker_failed: '◆ 状态：部分素材加载失败',
    status_sticker_limit: '◆ 状态：最多添加 2 个贴纸',
    status_frame_changed: '◆ 状态：相框已更换',
    status_frame_removed: '◆ 状态：相框已移除',
    photo_adjust: '照片调整',
    photo_name: '照片',
    brightness: '亮度',
    sticker_color: '颜色',
    no_frame: '无相框',
    category_stickers: '贴纸',
    category_frames: '相框',
    quality_good: '清晰度 · 良好',
    quality_fair: '清晰度 · 一般',
    quality_low: '清晰度 · 偏低',
    undo: '撤销',
    redo: '重做',
    action_upload_photo: '上传照片',
    action_replace_photo: '更换照片',
    action_move_photo: '移动照片',
    action_scale_photo: '缩放照片',
    action_rotate_photo: '旋转照片',
    action_brightness_photo: '调整照片亮度',
    action_reset_photo: '重置照片',
    action_add_sticker: '添加贴纸',
    action_delete_sticker: '删除贴纸',
    action_move_sticker: '移动贴纸',
    action_scale_sticker: '缩放贴纸',
    action_rotate_sticker: '旋转贴纸',
    action_layer_sticker: '调整贴纸层级',
    action_color_sticker: '更改贴纸颜色',
    action_add_frame: '添加相框',
    action_replace_frame: '更换相框',
    action_remove_frame: '移除相框',
    disclaimer: '非官方粉丝项目，仅供个人、非商业用途。本项目与 KOJIMA PRODUCTIONS、Sony Interactive Entertainment 或其关联方无隶属、授权或背书关系。《死亡搁浅 2：冥滩之上》相关名称、商标、图像及游戏素材的权利归各自权利人所有；如权利人提出有效要求，将及时调整或移除相关内容。'
  },
  en: {
    title: 'Photo Simulator',
    lang: '中文',
    upload: 'Upload',
    replace: 'Replace',
    download: 'Download',
    sticker_panel: 'Effects',
    canvas_label: '[ Canvas ]',
    status_ready: '◆ Status: Ready',
    status_photo_loaded: '◆ Status: Photo loaded',
    status_photo_converting: '◆ Status: Converting HEIC...',
    status_photo_processing: '◆ Status: Processing photo...',
    status_photo_failed: '◆ Status: Unable to read this photo',
    status_photo_too_large: '◆ Status: Photo file must be 50 MB or smaller',
    status_downloading: '◆ Status: Exporting...',
    status_sticker_loading: '◆ Status: Loading assets...',
    status_sticker_failed: '◆ Status: Some assets failed to load',
    status_sticker_limit: '◆ Status: Maximum 2 stickers',
    status_frame_changed: '◆ Status: Frame replaced',
    status_frame_removed: '◆ Status: Frame removed',
    photo_adjust: 'Photo Adjust',
    photo_name: 'Photo',
    brightness: 'Brightness',
    sticker_color: 'Color',
    no_frame: 'No Frame',
    category_stickers: 'Stickers',
    category_frames: 'Frames',
    quality_good: 'QUALITY · GOOD',
    quality_fair: 'QUALITY · FAIR',
    quality_low: 'QUALITY · LOW',
    undo: 'Undo',
    redo: 'Redo',
    action_upload_photo: 'Upload photo',
    action_replace_photo: 'Replace photo',
    action_move_photo: 'Move photo',
    action_scale_photo: 'Scale photo',
    action_rotate_photo: 'Rotate photo',
    action_brightness_photo: 'Adjust photo brightness',
    action_reset_photo: 'Reset photo',
    action_add_sticker: 'Add sticker',
    action_delete_sticker: 'Delete sticker',
    action_move_sticker: 'Move sticker',
    action_scale_sticker: 'Scale sticker',
    action_rotate_sticker: 'Rotate sticker',
    action_layer_sticker: 'Change sticker layer',
    action_color_sticker: 'Change sticker color',
    action_add_frame: 'Add frame',
    action_replace_frame: 'Replace frame',
    action_remove_frame: 'Remove frame',
    disclaimer: 'Unofficial fan project for personal, non-commercial use only. Not affiliated with, authorized by, or endorsed by KOJIMA PRODUCTIONS, Sony Interactive Entertainment, or their affiliates. Names, trademarks, images, and game assets related to DEATH STRANDING 2: ON THE BEACH belong to their respective rights holders. Relevant content will be adjusted or removed upon a valid request from a rights holder.'
  }
};

function readSavedLanguage() {
  try {
    return localStorage.getItem('ds_lang');
  } catch {
    return null;
  }
}

let currentLang = readSavedLanguage() || 'zh';
if (!LANG[currentLang]) currentLang = 'zh';

function t(key) {
  return LANG[currentLang][key] || key;
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.title = t('title');
  if (typeof rebuildCategoryTabs !== 'undefined') {
    rebuildCategoryTabs();
  }
  if (typeof refreshLocalizedAssetLabels !== 'undefined') {
    refreshLocalizedAssetLabels();
  }
  if (typeof updateToolbarLabels !== 'undefined') {
    updateToolbarLabels();
  }
  if (typeof updateDynamicControls !== 'undefined') {
    updateDynamicControls();
  }
  if (typeof updateStatus !== 'undefined') {
    const statusKey = window.__dsStatusKey || 'status_ready';
    updateStatus(t(statusKey), statusKey);
  }
}

function toggleLang() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  try {
    localStorage.setItem('ds_lang', currentLang);
  } catch {
    // Language switching still works when storage is unavailable.
  }
  applyLang();
}

function initLang() {
  document.getElementById('btnLang').addEventListener('click', toggleLang);
  applyLang();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLang);
} else {
  initLang();
}
