/*
  script.js

  Main application script for Card Maker. Responsibilities:
  - Initialize the Fabric.js canvas
  - Wire up UI controls (add text, formatting, background)
  - Load and insert stickers from the Stickers folder
  - Provide canvas export / share functionality
  - Implement basic clipboard (copy/cut/paste) for canvas objects
  - Handle panel dragging and UI interactions
*/

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

// --- Canvas initialization ---
// Create a Fabric.js canvas instance that we will use for all drawing and object manipulation.
const canvas = new fabric.Canvas('cardCanvas');

// --- Background color initialization ---
// Read the background color picker (if present) and apply it to the canvas background.
const picker = document.getElementById('bgColorPicker');
const initialBg = (picker && picker.value) || '#FFE699';
canvas.backgroundColor = initialBg;
canvas.requestRenderAll();

// --- Add Text control ---
// When the user clicks "Add Text" we create a new Fabric Textbox with current toolbar defaults
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

// --- Deletion via keyboard ---
// Allow the user to remove selected objects using the Delete or Backspace keys.
// This handler ignores keystrokes when typing into inputs or editable elements.
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

// --- Clipboard (copy/cut/paste) for canvas objects ---
let canvasClipboard = null;

function copySelection() {
  const active = (typeof canvas.getActiveObjects === 'function')
    ? canvas.getActiveObjects() : (canvas.getActiveObject() ? [canvas.getActiveObject()] : []);
  if (!active || active.length === 0) return;
  // store serializable representations
  canvasClipboard = active.map(obj => obj.toObject(['src']));
  // optional: give slight visual feedback
  console.log('Copied', canvasClipboard.length, 'object(s)');
}

function cutSelection() {
  copySelection();
  const active = (typeof canvas.getActiveObjects === 'function')
    ? canvas.getActiveObjects() : (canvas.getActiveObject() ? [canvas.getActiveObject()] : []);
  if (!active || active.length === 0) return;
  active.forEach(obj => canvas.remove(obj));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

function pasteClipboard() {
  if (!canvasClipboard) return;
  fabric.util.enlivenObjects(canvasClipboard, function(enlivened) {
    const added = [];
    enlivened.forEach(function(obj) {
      // offset pasted objects so they are visible and not overlapping exactly
      obj.set({ left: (obj.left || 100) + 20, top: (obj.top || 100) + 20 });
      canvas.add(obj);
      added.push(obj);
    });
    if (added.length) {
      canvas.discardActiveObject();
      if (added.length === 1) canvas.setActiveObject(added[0]);
      canvas.requestRenderAll();
    }
  });
}

// Keyboard shortcuts: Ctrl/Cmd+C, X, V
window.addEventListener('keydown', function (e) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (!mod) return;
  const key = (e.key || '').toLowerCase();
  if (key === 'c') {
    e.preventDefault();
    copySelection();
  } else if (key === 'x') {
    e.preventDefault();
    cutSelection();
  } else if (key === 'v') {
    e.preventDefault();
    pasteClipboard();
  }
});

// --- Text formatting logic ---
// Helpers and toolbar synchronization for changing font family, size, color, weight, style, and alignment
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
// Loads a JSON index of stickers from `Stickers/stickers.json`, displays thumbnails in a
// floating panel, and inserts selected images onto the canvas as Fabric Image objects.
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

// Make sticker panel draggable by its header using Pointer Events
function enableStickerDrag() {
  if (!stickerPanel) return;
  const stickerHeader = stickerPanel.querySelector('.sticker-panel-header');
  if (!stickerHeader) return;
  stickerHeader.style.cursor = 'move';
  // prevent touch scrolling interference on mobile
  stickerHeader.style.touchAction = 'none';
  // avoid native HTML5 drag of text or elements
  stickerHeader.setAttribute('draggable', 'false');
  stickerHeader.style.userSelect = 'none';
  stickerHeader.addEventListener('dragstart', function (e) { e.preventDefault(); });

  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let activePointerId = null;

  function ensurePanelHasLeftTop() {
    // If panel is positioned with `right`, convert to explicit left/top so we can move it
    const style = getComputedStyle(stickerPanel);
    if (style.right && style.right !== 'auto') {
      const rect = stickerPanel.getBoundingClientRect();
      stickerPanel.style.left = rect.left + 'px';
      stickerPanel.style.top = rect.top + 'px';
      stickerPanel.style.right = 'auto';
    }
    // ensure position fixed
    stickerPanel.style.position = 'fixed';
  }

  function onPointerDown(e) {
    // only react to primary button
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    ensurePanelHasLeftTop();
    dragging = true;
    document.body.style.userSelect = 'none';
    startX = e.clientX;
    startY = e.clientY;
    const rect = stickerPanel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    // capture the pointer so we keep receiving events even if the cursor moves fast
    try {
      if (typeof e.pointerId !== 'undefined' && stickerPanel.setPointerCapture) {
        stickerPanel.setPointerCapture(e.pointerId);
        activePointerId = e.pointerId;
      }
    } catch (err) {
      // ignore pointer capture failures
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const pad = 8;
    let left = startLeft + (clientX - startX);
    let top = startTop + (clientY - startY);
    const maxLeft = Math.max(pad, window.innerWidth - stickerPanel.offsetWidth - pad);
    const maxTop = Math.max(pad, window.innerHeight - stickerPanel.offsetHeight - pad);
    left = Math.max(pad, Math.min(left, maxLeft));
    top = Math.max(pad, Math.min(top, maxTop));
    stickerPanel.style.left = left + 'px';
    stickerPanel.style.top = top + 'px';
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    // release pointer capture if we captured it
    try {
      if (activePointerId !== null && stickerPanel.releasePointerCapture) {
        stickerPanel.releasePointerCapture(activePointerId);
      }
    } catch (err) {
      // ignore
    }
    activePointerId = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  // Use a document-level pointerdown so clicks on inner elements still start drag
  document.addEventListener('pointerdown', function (e) {
    // don't start dragging when clicking the close button
    if (e.target.closest && e.target.closest('#closeStickers')) return;
    const hdr = e.target.closest && e.target.closest('.sticker-panel-header');
    if (!hdr || !stickerPanel.contains(hdr)) return;
    onPointerDown(e);
    // try to capture the pointer on the panel so we continue receiving events
    try {
      if (typeof e.pointerId !== 'undefined' && stickerPanel.setPointerCapture) {
        stickerPanel.setPointerCapture(e.pointerId);
        activePointerId = e.pointerId;
      }
    } catch (err) {
      console.debug('pointer capture not supported:', err);
    }
  });

  // Fallback: attach mouse and touch handlers directly to header
  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    ensurePanelHasLeftTop();
    dragging = true;
    document.body.style.userSelect = 'none';
    startX = e.clientX;
    startY = e.clientY;
    const rect = stickerPanel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
  }

  function onTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;
    e.preventDefault();
    ensurePanelHasLeftTop();
    dragging = true;
    document.body.style.userSelect = 'none';
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    const rect = stickerPanel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  }

  function onTouchMove(e) {
    if (!dragging || !e.touches || e.touches.length === 0) return;
    e.preventDefault();
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    const pad = 8;
    let left = startLeft + (clientX - startX);
    let top = startTop + (clientY - startY);
    const maxLeft = Math.max(pad, window.innerWidth - stickerPanel.offsetWidth - pad);
    const maxTop = Math.max(pad, window.innerHeight - stickerPanel.offsetHeight - pad);
    left = Math.max(pad, Math.min(left, maxLeft));
    top = Math.max(pad, Math.min(top, maxTop));
    stickerPanel.style.left = left + 'px';
    stickerPanel.style.top = top + 'px';
  }

  stickerHeader.addEventListener('mousedown', onMouseDown);
  stickerHeader.addEventListener('touchstart', onTouchStart, { passive: false });
}

enableStickerDrag();

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
          const cw = (typeof canvas.getWidth === 'function') ? canvas.getWidth() : (canvas.width || 1000);
          const ch = (typeof canvas.getHeight === 'function') ? canvas.getHeight() : (canvas.height || 700);
          oImg.set({ left: cw / 2 - (oImg.width * 0.25) / 2, top: ch / 2 - (oImg.height * 0.25) / 2 });
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

// --- Double-click behavior ---
// Double-click a text object to enter in-place editing. For non-text objects, double-click
// no longer deletes them (use Delete/Backspace instead) to avoid accidental removal.
canvas.on('mouse:dblclick', function (opt) {
  const target = opt.target;
  if (!target) return;
  // If object supports enterEditing (fabric.Textbox/Text), enter edit mode
  if (typeof target.enterEditing === 'function') {
    try {
      target.enterEditing();
      if (typeof target.selectAll === 'function') target.selectAll();
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
    } catch (e) {
      console.warn('Failed to enter editing mode:', e);
    }
  }
  // otherwise ignore double-click (deletion still works with Delete/Backspace)
});

// --- Export / Share the canvas ---
// Provide two user-facing ways to get the canvas out of the app:
// 1) "Save Image" downloads a PNG file of the canvas.
// 2) "Email / Share" tries the Web Share API (mobile-friendly). If not available,
//    it falls back to downloading the image and opening a mailto: link instructing
//    the user to attach the downloaded file.
function dataUrlToBlob(dataUrl) {
  return fetch(dataUrl).then(r => r.blob());
}

document.getElementById('saveImage')?.addEventListener('click', function () {
  try {
    const dataUrl = canvas.toDataURL({ format: 'png', quality: 1 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'card.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error('Failed to save image', err);
    alert('Failed to save image: ' + err.message);
  }
});

document.getElementById('shareImage')?.addEventListener('click', async function () {
  try {
    const dataUrl = canvas.toDataURL({ format: 'png', quality: 1 });
    const blob = await dataUrlToBlob(dataUrl);
    const file = new File([blob], 'card.png', { type: 'image/png' });

    // Try Web Share API with files (mobile/modern browsers)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My Card', text: 'A card I made' });
        return;
      } catch (err) {
        console.warn('Web Share failed, falling back', err);
      }
    }

    // Fallback: trigger download and open mail client with instructions
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'card.png';
    document.body.appendChild(a);
    a.click();
    a.remove();

    const subject = encodeURIComponent('A card I made');
    const body = encodeURIComponent("Hi,%0A%0AI've created a card and saved it as 'card.png'. Please attach that file to this email.%0A%0AThanks!");
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  } catch (err) {
    console.error('Failed to share image', err);
    alert('Failed to share image: ' + err.message);
  }
});

