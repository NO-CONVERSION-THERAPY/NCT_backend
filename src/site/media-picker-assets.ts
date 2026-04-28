export const MEDIA_PICKER_CSS = `
.media-picker-field {
  display: grid;
  gap: 8px;
}

.media-picker-open-button,
.media-picker-confirm,
.media-picker-secondary,
.media-remove-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.media-picker-open-button {
  width: max-content;
  min-height: 44px;
  padding: 12px 18px;
  background: #0f766e;
  color: #fff;
}

.media-selected-summary,
.media-picker-message {
  margin: 0;
  color: #516070;
  font-size: 0.92rem;
  line-height: 1.6;
}

.media-picker-modal[hidden] {
  display: none !important;
}

.media-picker-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
}

.media-picker-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(12, 18, 28, 0.54);
}

.media-picker-panel {
  position: relative;
  z-index: 1;
  width: min(840px, 100%);
  max-height: min(760px, calc(100vh - 40px));
  overflow: auto;
  border: 1px solid rgba(32, 48, 76, 0.14);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 26px 80px rgba(12, 18, 28, 0.24);
}

.media-picker-header,
.media-picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(32, 48, 76, 0.1);
}

.media-picker-footer {
  justify-content: flex-end;
  border-top: 1px solid rgba(32, 48, 76, 0.1);
  border-bottom: 0;
}

.media-picker-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.media-picker-header {
  cursor: grab;
  user-select: none;
}

.media-picker-header.is-dragging {
  cursor: grabbing;
}

.media-picker-close {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: rgba(32, 48, 76, 0.08);
  color: #172033;
  font-size: 1.25rem;
  font-weight: 800;
  cursor: pointer;
}

.media-picker-body {
  display: grid;
  gap: 16px;
  padding: 18px 20px;
}

.media-picker-dropzone {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 180px;
  padding: 22px;
  border: 2px dashed rgba(15, 118, 110, 0.36);
  border-radius: 12px;
  background: #f3faf8;
  text-align: center;
}

.media-picker-dropzone.is-dragover {
  border-color: #0f766e;
  background: #e6f6f2;
}

.media-picker-dropzone strong {
  color: #172033;
  font-size: 1.05rem;
}

.media-picker-secondary {
  min-height: 40px;
  padding: 10px 14px;
  background: rgba(32, 48, 76, 0.08);
  color: #172033;
}

.media-picker-file-label {
  position: relative;
}

.media-picker-file-label:focus-within {
  outline: 2px solid rgba(29, 78, 216, 0.58);
  outline-offset: 2px;
}

.media-picker-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  border: 0;
  white-space: nowrap;
}

.media-picker-confirm {
  min-height: 42px;
  padding: 11px 18px;
  background: #1d4ed8;
  color: #fff;
}

.media-remove-button {
  width: max-content;
  min-height: 34px;
  padding: 7px 10px;
  background: #fee4e2;
  color: #b42318;
}

body.media-picker-open {
  overflow: hidden;
}

@media (max-width: 640px) {
  .media-picker-modal {
    align-items: stretch;
    justify-items: stretch;
    padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom));
  }

  .media-picker-panel {
    width: 100%;
    max-height: calc(100dvh - max(20px, calc(env(safe-area-inset-top) + env(safe-area-inset-bottom))));
    border-radius: 12px;
  }

  .media-picker-header,
  .media-picker-footer {
    padding: 14px 16px;
  }

  .media-picker-body {
    padding: 14px 16px;
  }

  .media-picker-dropzone {
    min-height: 150px;
    padding: 18px 14px;
  }
}
`;

export const MEDIA_PICKER_SCRIPT = `
(function () {
  if (window.createSchoolMediaPicker) return;

  window.createSchoolMediaPicker = function createSchoolMediaPicker(prefix) {
    const fileInput = document.getElementById(prefix + '-file');
    const previewList = document.getElementById(prefix + '-preview-list');
    const selectedSummary = document.getElementById(prefix + '-selected-summary');
    const openButton = document.getElementById(prefix + '-picker-open');
    const dialog = document.getElementById(prefix + '-picker-dialog');
    const confirmButton = document.getElementById(prefix + '-picker-confirm');
    const cancelButton = document.getElementById(prefix + '-picker-cancel');
    const closeButton = document.getElementById(prefix + '-picker-close');
    const dropzone = document.getElementById(prefix + '-picker-dropzone');
    const draftList = document.getElementById(prefix + '-picker-draft-list');
    const message = document.getElementById(prefix + '-picker-message');
    const panel = dialog ? dialog.querySelector('.media-picker-panel') : null;
    const header = dialog ? dialog.querySelector('.media-picker-header') : null;
    const previewUrls = [];
    const draftPreviewUrls = [];
    const panelOffset = { x: 0, y: 0 };
    let selectedFiles = [];
    let draftFiles = [];
    let dragState = null;

    function formatBytes(size) {
      if (!Number.isFinite(size)) return '';
      if (size < 1024) return size + ' B';
      if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
      return (size / 1024 / 1024).toFixed(1) + ' MB';
    }

    function mediaFileKey(file) {
      return [file.name, file.size, file.lastModified].join(':');
    }

    function isSupportedMediaFile(file) {
      return file && (file.type.startsWith('image/') || file.type.startsWith('video/'));
    }

    function clearUrls(urls) {
      while (urls.length) {
        URL.revokeObjectURL(urls.pop());
      }
    }

    function createPreviewCard(file, url, index, mode) {
      const card = document.createElement('article');
      card.className = 'media-preview-card';
      card.dataset.fileIndex = String(index);

      const frame = document.createElement('div');
      frame.className = 'media-preview-frame';
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'metadata';
        video.src = url;
        frame.appendChild(video);
      } else {
        const image = document.createElement('img');
        image.alt = file.name;
        image.src = url;
        frame.appendChild(image);
      }

      const meta = document.createElement('div');
      meta.className = 'media-preview-meta';
      const name = document.createElement('span');
      name.className = 'media-preview-name';
      name.textContent = file.name;
      const detail = document.createElement('span');
      detail.textContent = (file.type || 'unknown') + ' / ' + formatBytes(file.size);
      meta.append(name, detail);

      if (mode === 'draft') {
        const remove = document.createElement('button');
        remove.className = 'media-remove-button';
        remove.type = 'button';
        remove.textContent = '移除';
        remove.addEventListener('click', function () {
          draftFiles.splice(index, 1);
          renderDraftPreviews();
        });
        meta.appendChild(remove);
      } else {
        const itemStatus = document.createElement('span');
        itemStatus.className = 'media-preview-status';
        itemStatus.textContent = '待上传';
        meta.appendChild(itemStatus);
      }

      card.append(frame, meta);
      return card;
    }

    function renderSelectedPreviews() {
      if (!previewList) return;
      clearUrls(previewUrls);
      previewList.innerHTML = '';
      previewList.hidden = selectedFiles.length === 0;
      if (selectedSummary) {
        selectedSummary.textContent = selectedFiles.length
          ? '已选择 ' + selectedFiles.length + ' 个媒体文件，可继续添加或删除。'
          : '未选择媒体文件。';
      }
      selectedFiles.forEach(function (file, index) {
        const url = URL.createObjectURL(file);
        previewUrls.push(url);
        previewList.appendChild(createPreviewCard(file, url, index, 'selected'));
      });
    }

    function renderDraftPreviews() {
      if (!draftList) return;
      clearUrls(draftPreviewUrls);
      draftList.innerHTML = '';
      draftList.hidden = draftFiles.length === 0;
      if (message) {
        message.textContent = draftFiles.length
          ? '已暂存 ' + draftFiles.length + ' 个文件，确认后写入上传列表。'
          : '拖拽文件到此处，或点击选择文件。';
      }
      draftFiles.forEach(function (file, index) {
        const url = URL.createObjectURL(file);
        draftPreviewUrls.push(url);
        draftList.appendChild(createPreviewCard(file, url, index, 'draft'));
      });
    }

    function addDraftFiles(files) {
      const existingKeys = new Set(draftFiles.map(mediaFileKey));
      let rejected = 0;
      Array.from(files || []).forEach(function (file) {
        if (!isSupportedMediaFile(file)) {
          rejected += 1;
          return;
        }
        const key = mediaFileKey(file);
        if (!existingKeys.has(key)) {
          draftFiles.push(file);
          existingKeys.add(key);
        }
      });
      renderDraftPreviews();
      if (message && rejected > 0) {
        message.textContent = '已忽略 ' + rejected + ' 个不支持的文件。';
      }
    }

    function openPicker() {
      if (!dialog) return;
      draftFiles = selectedFiles.slice();
      renderDraftPreviews();
      dialog.hidden = false;
      document.body.classList.add('media-picker-open');
    }

    function closePicker() {
      if (!dialog) return;
      dialog.hidden = true;
      document.body.classList.remove('media-picker-open');
      clearUrls(draftPreviewUrls);
    }

    let lastConfirmedSnapshotKeys = [];
    let onSelectionChanged = null;

    function confirmPicker() {
      const previousKeys = lastConfirmedSnapshotKeys;
      selectedFiles = draftFiles.slice();
      renderSelectedPreviews();
      closePicker();

      const nextKeys = selectedFiles.map(mediaFileKey);
      lastConfirmedSnapshotKeys = nextKeys;
      const previousSet = new Set(previousKeys);
      const addedEntries = [];
      selectedFiles.forEach(function (file, index) {
        if (!previousSet.has(nextKeys[index])) {
          addedEntries.push({ file: file, index: index });
        }
      });
      if (addedEntries.length && typeof onSelectionChanged === 'function') {
        onSelectionChanged(addedEntries);
      }
    }

    function applyPanelOffset() {
      if (!panel) return;
      panel.style.transform = 'translate(' + panelOffset.x + 'px, ' + panelOffset.y + 'px)';
    }

    function clampPanelOffset(x, y) {
      if (!panel) return { x: 0, y: 0 };
      const minVisible = 96;
      const maxX = Math.max(0, (window.innerWidth + panel.offsetWidth) / 2 - minVisible);
      const maxY = Math.max(0, (window.innerHeight + panel.offsetHeight) / 2 - minVisible);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y))
      };
    }

    function isHeaderControl(target) {
      return target && target.closest && target.closest('button, a, input, select, textarea');
    }

    function startPanelDrag(event) {
      if (!header || !panel || isHeaderControl(event.target)) return;
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: panelOffset.x,
        offsetY: panelOffset.y
      };
      header.classList.add('is-dragging');
      header.setPointerCapture(event.pointerId);
    }

    function movePanelDrag(event) {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      event.preventDefault();
      const next = clampPanelOffset(
        dragState.offsetX + event.clientX - dragState.startX,
        dragState.offsetY + event.clientY - dragState.startY
      );
      panelOffset.x = next.x;
      panelOffset.y = next.y;
      applyPanelOffset();
    }

    function endPanelDrag(event) {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      dragState = null;
      if (header) {
        header.classList.remove('is-dragging');
        if (header.hasPointerCapture(event.pointerId)) {
          header.releasePointerCapture(event.pointerId);
        }
      }
    }

    if (openButton) openButton.addEventListener('click', openPicker);
    if (confirmButton) confirmButton.addEventListener('click', confirmPicker);
    if (cancelButton) cancelButton.addEventListener('click', closePicker);
    if (closeButton) closeButton.addEventListener('click', closePicker);
    if (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target && event.target.getAttribute('data-media-picker-close') === 'true') {
          closePicker();
        }
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        addDraftFiles(fileInput.files);
        fileInput.value = '';
      });
    }
    if (dropzone) {
      dropzone.addEventListener('dragover', function (event) {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('is-dragover');
      });
      dropzone.addEventListener('drop', function (event) {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
        addDraftFiles(event.dataTransfer ? event.dataTransfer.files : []);
      });
    }
    if (header) {
      header.addEventListener('pointerdown', startPanelDrag);
      header.addEventListener('pointermove', movePanelDrag);
      header.addEventListener('pointerup', endPanelDrag);
      header.addEventListener('pointercancel', endPanelDrag);
    }
    window.addEventListener('resize', function () {
      const next = clampPanelOffset(panelOffset.x, panelOffset.y);
      panelOffset.x = next.x;
      panelOffset.y = next.y;
      applyPanelOffset();
    });

    renderSelectedPreviews();

    return {
      clear: function () {
        selectedFiles = [];
        draftFiles = [];
        lastConfirmedSnapshotKeys = [];
        renderSelectedPreviews();
        renderDraftPreviews();
      },
      getFiles: function () {
        return selectedFiles.slice();
      },
      setFileStatus: function (index, text, isError) {
        if (!previewList) return;
        const node = previewList.querySelector('[data-file-index="' + index + '"] .media-preview-status');
        if (!node) return;
        node.textContent = text;
        node.dataset.state = isError ? 'error' : 'ok';
      },
      setOnSelectionChanged: function (callback) {
        onSelectionChanged = typeof callback === 'function' ? callback : null;
      }
    };
  };
})();
`;
