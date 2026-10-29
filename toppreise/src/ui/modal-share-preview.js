/**
 * Discord Share Preview Modal
 * Displays deal preview (rendered markdown + chart/product images)
 * and channel action buttons for 1-click sharing.
 */

import { ensureSkeleton, uiShadowRoot } from './shell.js';
import { renderDiscordMarkdownPreview } from '../features/discord-recipe.js';

const escapeHtml = s => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export function openSharePreviewModal({ channels = [], onSend, onCancel }) {
  ensureSkeleton();
  const shadow = uiShadowRoot;
  if (!shadow) return null;

  // Clean up any stale preview dialog
  shadow.getElementById('tp-modal-share-preview')?.remove();

  const dialog = document.createElement('dialog');
  dialog.id = 'tp-modal-share-preview';
  dialog.className = 'tp-share-preview-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'tp-share-preview-title');

  const channelButtonsHtml = channels.map(ch => `
    <button type="button" class="tp-btn tp-share-channel-btn" data-channel-id="${escapeHtml(ch.id)}" disabled>
      📤 ${escapeHtml(ch.name)}
    </button>
  `).join('');

  dialog.innerHTML = `
    <div class="tp-share-preview-header">
      <h3 id="tp-share-preview-title" class="tp-share-preview-title">Discord Deal-Share</h3>
      <button type="button" class="tp-share-preview-close" aria-label="Schliessen">&times;</button>
    </div>

    <div class="tp-share-preview-body">
      <div class="tp-share-preview-loading" id="tp-share-preview-loading">
        <span class="tp-share-preview-spinner">⏳</span>
        <span>Vorschau wird vorbereitet…</span>
      </div>
      <div class="tp-share-preview-error" id="tp-share-preview-error" style="display: none;"></div>

      <div class="tp-share-preview-content-wrap" id="tp-share-preview-content-wrap" style="display: none;">
        <div class="tp-share-preview-label">Discord-Vorschau:</div>
        <div class="tp-share-preview-message" id="tp-share-preview-message"></div>
        <div class="tp-share-preview-images" id="tp-share-preview-images"></div>
      </div>
    </div>

    <div class="tp-share-preview-footer">
      <div class="tp-share-preview-channels" id="tp-share-preview-channels">
        ${channelButtonsHtml}
      </div>
      <button type="button" class="tp-btn tp-btn-secondary tp-share-cancel-btn">Abbrechen</button>
    </div>
  `;

  shadow.appendChild(dialog);

  const loadingEl = dialog.querySelector('#tp-share-preview-loading');
  const errorEl = dialog.querySelector('#tp-share-preview-error');
  const contentWrap = dialog.querySelector('#tp-share-preview-content-wrap');
  const messageEl = dialog.querySelector('#tp-share-preview-message');
  const imagesEl = dialog.querySelector('#tp-share-preview-images');
  const channelBtns = dialog.querySelectorAll('.tp-share-channel-btn');
  const closeBtn = dialog.querySelector('.tp-share-preview-close');
  const cancelBtn = dialog.querySelector('.tp-share-cancel-btn');

  const createdUrls = [];

  const cleanup = () => {
    while (createdUrls.length > 0) {
      const u = createdUrls.pop();
      try { URL.revokeObjectURL(u); } catch {}
    }
  };

  const close = () => {
    cleanup();
    if (typeof dialog.close === 'function') {
      try { dialog.close(); } catch {}
    }
    dialog.remove();
  };

  const handleCancel = () => {
    close();
    onCancel?.();
  };

  closeBtn?.addEventListener('click', handleCancel);
  cancelBtn?.addEventListener('click', handleCancel);

  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isBackdrop = (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
    if (isBackdrop) handleCancel();
  });

  dialog.addEventListener('cancel', e => {
    e.preventDefault();
    handleCancel();
  });

  const controller = {
    dialog,
    updateContent({ formattedContent, chartBlob, productBlob, keepaBlob }) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';

      if (messageEl) {
        messageEl.innerHTML = renderDiscordMarkdownPreview(formattedContent || '');
      }

      if (imagesEl) {
        imagesEl.innerHTML = '';
        if (productBlob instanceof Blob) {
          try {
            const prodUrl = URL.createObjectURL(productBlob);
            createdUrls.push(prodUrl);
            const prodImg = document.createElement('img');
            prodImg.className = 'tp-share-preview-img tp-share-preview-prod-img';
            prodImg.src = prodUrl;
            prodImg.alt = 'Produktbild';
            prodImg.title = 'Produktbild (wird als Bildanhang gesendet)';
            imagesEl.appendChild(prodImg);
          } catch {}
        }
        if (chartBlob instanceof Blob) {
          try {
            const chartUrl = URL.createObjectURL(chartBlob);
            createdUrls.push(chartUrl);
            const chartImg = document.createElement('img');
            chartImg.className = 'tp-share-preview-img tp-share-preview-chart-img';
            chartImg.src = chartUrl;
            chartImg.alt = 'Preisverlauf';
            chartImg.title = 'Preisverlauf (wird als Bildanhang gesendet)';
            imagesEl.appendChild(chartImg);
          } catch {}
        }
        if (keepaBlob instanceof Blob) {
          try {
            const keepaUrl = URL.createObjectURL(keepaBlob);
            createdUrls.push(keepaUrl);
            const keepaImg = document.createElement('img');
            keepaImg.className = 'tp-share-preview-img tp-share-preview-keepa-img';
            keepaImg.src = keepaUrl;
            keepaImg.alt = 'Amazon Keepa-Preisverlauf';
            keepaImg.title = 'Amazon Keepa-Preisverlauf (wird als Bildanhang gesendet)';
            imagesEl.appendChild(keepaImg);
          } catch {}
        }
      }

      if (contentWrap) contentWrap.style.display = '';

      channelBtns.forEach(btn => {
        btn.disabled = false;
      });
    },

    setError(errorMessage) {
      if (errorEl) {
        errorEl.textContent = errorMessage || 'Fehler beim Senden';
        errorEl.style.display = '';
      }
      channelBtns.forEach(btn => {
        btn.disabled = false;
        const ch = channels.find(c => c.id === btn.dataset.channelId);
        btn.textContent = `📤 ${ch?.name || 'Kanal'}`;
      });
    },

    setSending(channelId) {
      if (errorEl) errorEl.style.display = 'none';
      channelBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.channelId === channelId) {
          btn.textContent = '⏳ Senden…';
        }
      });
    },

    close
  };

  channelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const channelId = btn.dataset.channelId;
      const targetChannel = channels.find(c => c.id === channelId);
      if (!targetChannel) return;
      controller.setSending(channelId);
      onSend?.(targetChannel, controller);
    });
  });

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }

  return controller;
}
