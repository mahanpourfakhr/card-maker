// Coerce invalid baseline values coming from libraries (fixes Chrome warning)
(function() {
  try {
    const proto = CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (!proto) return;
    const desc = Object.getOwnPropertyDescriptor(proto, 'textBaseline');
    if (desc && typeof desc.set === 'function') {
      const originalGet = desc.get;
      const originalSet = desc.set;
      Object.defineProperty(proto, 'textBaseline', {
        get: originalGet ? function() { return originalGet.call(this); } : undefined,
        set: function(value) {
          if (value === 'alphabetical') value = 'alphabetic';
          return originalSet.call(this, value);
        },
        configurable: true,
        enumerable: false
      });
    }
  } catch (e) {
    console.warn('textBaseline override skipped:', e);
  }
})();

// Create the canvas
const canvas = new fabric.Canvas('cardCanvas');

// Initialize background from color picker (if present) and render
const picker = document.getElementById('bgColorPicker');
const initialBg = (picker && picker.value) || '#FFE699';
canvas.backgroundColor = initialBg;
canvas.requestRenderAll();

// Add text button
document.getElementById('addText').onclick = function () {
  // Use toolbar defaults for new text if available
  const fontFamily = document.getElementById('fontFamily')?.value || 'Arial';
  const fontSize = Number(document.getElementById('fontSize')?.value) || 32;
  const fill = document.getElementById('textColor')?.value || '#000000';

  const text = new fabric.Textbox('You are awesome!', {
    left: 150,
    top: 150,
    fontSize: fontSize,
    fontFamily: fontFamily,
    fill: fill
  });
  canvas.add(text);
};

// Change background button
// Wire up color picker: update background immediately on input
const bgPicker = document.getElementById('bgColorPicker');
if (bgPicker) {
  bgPicker.addEventListener('input', function () {
    canvas.backgroundColor = bgPicker.value;
    canvas.requestRenderAll();
  });
}

// Allow Delete or Backspace to remove selected objects (textboxes or any selection)
window.addEventListener('keydown', function (e) {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  // don't interfere with typing in inputs
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;

  const activeObjects = (typeof canvas.getActiveObjects === 'function')
    ? canvas.getActiveObjects() : (canvas.getActiveObject() ? [canvas.getActiveObject()] : []);
  if (!activeObjects || activeObjects.length === 0) return;

  e.preventDefault();
  activeObjects.forEach(function (obj) {
    canvas.remove(obj);
  });
  canvas.discardActiveObject();
  canvas.requestRenderAll();
});

// --- Text formatting logic ---
function applyPropsToActive(props) {
  const active = (typeof canvas.getActiveObjects === 'function')
    ? canvas.getActiveObjects() : (canvas.getActiveObject() ? [canvas.getActiveObject()] : []);
  if (!active || active.length === 0) return;
  active.forEach(obj => {
    try {
      obj.set(props);
      if (obj.setCoords) obj.setCoords();
    } catch (e) {
      // ignore objects that don't accept these props
    }
  });
  canvas.requestRenderAll();
}




function updateToolbarFromActive() {
  const active = canvas.getActiveObject();
  const fontFamily = document.getElementById('fontFamily');
  const fontSize = document.getElementById('fontSize');
  const textColor = document.getElementById('textColor');
  const textBold = document.getElementById('textBold');
  const textItalic = document.getElementById('textItalic');
  const textAlign = document.getElementById('textAlign');

  if (!active) {
    if (fontFamily) fontFamily.value = 'Arial';
    if (fontSize) fontSize.value = 32;
    if (textColor) textColor.value = '#000000';
    if (textBold) textBold.classList.remove('active');
    if (textItalic) textItalic.classList.remove('active');
    if (textAlign) textAlign.value = 'left';
    return;
  }

  if (fontFamily && active.fontFamily) fontFamily.value = active.fontFamily;
  if (fontSize && active.fontSize) fontSize.value = active.fontSize;
  if (textColor && active.fill) textColor.value = active.fill;
  if (textBold) {
    const isBold = (active.fontWeight === 'bold' || active.fontWeight === '700');
    textBold.classList.toggle('active', !!isBold);
  }
  if (textItalic) {
    const isItalic = (active.fontStyle === 'italic');
    textItalic.classList.toggle('active', !!isItalic);
  }
  if (textAlign && active.textAlign) textAlign.value = active.textAlign;
}

// Hook toolbar controls
document.getElementById('fontFamily')?.addEventListener('change', function () {
  applyPropsToActive({ fontFamily: this.value });
});
document.getElementById('fontSize')?.addEventListener('input', function () {
  applyPropsToActive({ fontSize: Number(this.value) });
});
document.getElementById('textColor')?.addEventListener('input', function () {
  applyPropsToActive({ fill: this.value });
});
document.getElementById('textBold')?.addEventListener('click', function () {
  const active = canvas.getActiveObject();
  const isBold = active && (active.fontWeight === 'bold' || active.fontWeight === '700');
  applyPropsToActive({ fontWeight: isBold ? 'normal' : 'bold' });
  updateToolbarFromActive();
});
document.getElementById('textItalic')?.addEventListener('click', function () {
  const active = canvas.getActiveObject();
  const isItalic = active && (active.fontStyle === 'italic');
  applyPropsToActive({ fontStyle: isItalic ? 'normal' : 'italic' });
  updateToolbarFromActive();
});
document.getElementById('textAlign')?.addEventListener('change', function () {
  applyPropsToActive({ textAlign: this.value });
});

// Update toolbar when selection changes
canvas.on('selection:created', updateToolbarFromActive);
canvas.on('selection:updated', updateToolbarFromActive);
canvas.on('selection:cleared', updateToolbarFromActive);
canvas.on('object:selected', updateToolbarFromActive);

// --- Stickers integration ---
const stickersBtn = document.getElementById('stickersBtn');
const stickerPanel = document.getElementById('stickerPanel');
const closeStickers = document.getElementById('closeStickers');
const stickerList = document.getElementById('stickerList');

function showStickerPanel() {
  stickerPanel.classList.remove('hidden');
  stickerPanel.setAttribute('aria-hidden', 'false');
}

function hideStickerPanel() {
  stickerPanel.classList.add('hidden');
  stickerPanel.setAttribute('aria-hidden', 'true');
}

stickersBtn?.addEventListener('click', function () {
  // toggle
  if (!stickerPanel || stickerPanel.classList.contains('hidden')) showStickerPanel();
  else hideStickerPanel();
});
closeStickers?.addEventListener('click', hideStickerPanel);

// Load sticker list JSON and populate thumbnails
if (!stickerList) {
  console.warn('stickerList element not found in DOM');
} else {
  // show a loading hint
  stickerList.innerHTML = '<div style="width:100%;text-align:center;color:#666;padding:12px;">Loading stickers…</div>';
  fetch('Stickers/stickers.json').then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(list => {
    stickerList.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      stickerList.innerHTML = '<div style="color:#666;padding:12px;">No stickers found. Make sure Stickers/stickers.json contains relative paths to PNG files.</div>';
      return;
    }
    list.forEach(function (path) {
      const img = document.createElement('img');
      img.src = path;
      img.alt = path.split('/').pop();
      img.className = 'sticker-thumb';
      img.title = 'Add ' + img.alt;
      img.addEventListener('click', function () {
        // Add sticker to canvas centered
        fabric.Image.fromURL(path, function (oImg) {
          oImg.set({ left: canvas.width / 2 - (oImg.width * 0.25) / 2, top: canvas.height / 2 - (oImg.height * 0.25) / 2 });
          // set an initial scale so image fits reasonably
          const maxDim = Math.max(oImg.width, oImg.height);
          const scale = Math.min(200 / maxDim, 1) * 0.8;
          oImg.scale(scale);
          oImg.setControlsVisibility({
            mt: true, mb: true, ml: true, mr: true,
            bl: true, br: true, tl: true, tr: true,
            mtr: true
          });
          canvas.add(oImg);
          canvas.setActiveObject(oImg);
          canvas.requestRenderAll();
        }, { crossOrigin: 'anonymous' });
      });
      // If image fails to load, show a faded placeholder
      img.addEventListener('error', function () {
        img.style.opacity = '0.45';
        img.title = 'Failed to load: ' + img.src;
      });
      stickerList.appendChild(img);
    });
  }).catch(function (err) {
    console.warn('Failed to load stickers.json', err);
    stickerList.innerHTML = '<div style="color:#b00;padding:12px;">Failed to load stickers. If you opened the file directly, run a local server (e.g. `python3 -m http.server`).</div>';
  });
}

// Double-click to remove an object (convenience)
canvas.on('mouse:dblclick', function (opt) {
  const target = opt.target;
  if (target) {
    canvas.remove(target);
    canvas.requestRenderAll();
  }
});

