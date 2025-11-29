// Content script - Grammar checker with visual badge indicator
console.log("Grammar CET content script loaded");

// ============================================
// CSS Injection for Loading Animation
// ============================================
function injectStyles() {
  const style = document.createElement('style');
  style.id = 'grammar-badge-styles';
  style.textContent = `
    @keyframes grammar-spin {
      to { transform: rotate(360deg); }
    }
    .grammar-badge-loading::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: grammar-spin 0.8s linear infinite;
    }
    .grammar-popup {
      position: fixed;
      z-index: 2147483647;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 14px;
      max-width: 350px;
      min-width: 250px;
      overflow: hidden;
    }
    .grammar-popup-header {
      background: #f8f9fa;
      padding: 10px 14px;
      border-bottom: 1px solid #e9ecef;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #333;
    }
    .grammar-popup-close {
      cursor: pointer;
      font-size: 18px;
      color: #666;
      line-height: 1;
    }
    .grammar-popup-close:hover {
      color: #333;
    }
    .grammar-popup-content {
      padding: 14px;
    }
    .grammar-popup-row {
      margin-bottom: 10px;
    }
    .grammar-popup-row:last-child {
      margin-bottom: 0;
    }
    .grammar-popup-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .grammar-popup-text {
      background: #f8f9fa;
      padding: 8px 10px;
      border-radius: 4px;
      word-wrap: break-word;
      line-height: 1.4;
    }
    .grammar-popup-original {
      color: #dc3545;
    }
    .grammar-popup-corrected {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .grammar-popup-actions {
      display: flex;
      gap: 8px;
      padding: 10px 14px;
      border-top: 1px solid #e9ecef;
      background: #f8f9fa;
    }
    .grammar-popup-btn {
      flex: 1;
      padding: 8px 14px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    .grammar-popup-btn-apply {
      background: #28a745;
      color: white;
    }
    .grammar-popup-btn-apply:hover {
      background: #218838;
    }
    .grammar-popup-btn-skip {
      background: #e9ecef;
      color: #495057;
    }
    .grammar-popup-btn-skip:hover {
      background: #dee2e6;
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// Field Detection (Grammarly-style)
// ============================================

// Find the root contenteditable element (not a child inside it)
function getEditableRoot(element) {
  if (!element) return null;

  const tagName = (element.tagName || '').toLowerCase();

  // If it's an input or textarea, return it directly
  if (tagName === 'input' || tagName === 'textarea') {
    return element;
  }

  // For contenteditable, find the root contenteditable element
  if (element.isContentEditable) {
    let current = element;
    while (current.parentElement && current.parentElement.isContentEditable) {
      current = current.parentElement;
    }
    return current;
  }

  return null;
}

function isValidTextField(element) {
  if (!element || !element.tagName) return false;

  const tagName = element.tagName.toLowerCase();
  const type = (element.type || '').toLowerCase();

  // Valid element types - show on ALL text-like inputs for now
  const isTextarea = tagName === 'textarea';
  const isTextInput = tagName === 'input' && !['checkbox', 'radio', 'submit', 'button', 'file', 'hidden', 'image', 'reset', 'color', 'range'].includes(type);
  const isContentEditable = element.isContentEditable;

  if (!isTextarea && !isTextInput && !isContentEditable) return false;

  // For now, only exclude password fields
  if (type === 'password') return false;

  return true;
}

function hasEnoughText(text) {
  const trimmed = text.trim().replace(/\n/g, ' ');

  // Ignore placeholder-like text
  if (/^(start writing|type here|enter text|write something)/i.test(trimmed)) {
    return false;
  }

  // Ignore if mostly punctuation/ellipsis
  if (/^[.\s!?…]+$/.test(trimmed)) {
    return false;
  }

  // At least 2 words (Grammarly-style)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0 && !/^[.!?…]+$/.test(w));
  return words.length >= 2;
}

function getTextContent(element) {
  if (element.value !== undefined) {
    return element.value;
  }
  return element.innerText || element.textContent || '';
}

// ============================================
// Badge Creation and Positioning
// ============================================
function createBadge(element) {
  const badge = document.createElement('div');
  badge.className = 'grammar-badge';
  badge.style.cssText = `
    position: fixed;
    min-width: 20px;
    height: 20px;
    padding: 0 4px;
    background: #6c757d;
    border-radius: 10px;
    color: white;
    font-size: 11px;
    font-weight: bold;
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    cursor: pointer;
    transition: background-color 0.2s ease;
    box-sizing: border-box;
  `;
  badge._grammarElement = element; // Store reference to the text field
  document.body.appendChild(badge);
  return badge;
}

function positionBadge(badge, element) {
  const rect = element.getBoundingClientRect();
  const PADDING = 8;
  const BADGE_HEIGHT = 20;

  // Position at bottom-right inside the field
  badge.style.top = (rect.bottom - BADGE_HEIGHT - PADDING) + 'px';
  badge.style.left = (rect.right - badge.offsetWidth - PADDING) + 'px';
}

// ============================================
// Badge State Management
// ============================================
function setBadgeState(badge, state, count = 0) {
  // Reset classes
  badge.className = 'grammar-badge';

  switch(state) {
    case 'loading':
      badge.style.background = '#6c757d';
      badge.classList.add('grammar-badge-loading');
      badge.textContent = '';
      badge.style.display = 'flex';
      break;
    case 'errors':
      badge.style.background = '#dc3545';
      badge.textContent = count > 9 ? '9+' : count.toString();
      badge.style.display = 'flex';
      break;
    case 'success':
      badge.style.background = '#28a745';
      badge.textContent = '✓';
      badge.style.display = 'flex';
      break;
    case 'hidden':
      badge.style.display = 'none';
      break;
  }
}

// ============================================
// Grammar Check & Difference Counting
// ============================================
function countDifferences(original, corrected) {
  const orig = original.trim().toLowerCase();
  const corr = corrected.trim().toLowerCase();

  // If identical, no differences
  if (orig === corr) return 0;

  const origWords = orig.split(/\s+/);
  const corrWords = corr.split(/\s+/);

  let diff = 0;
  const maxLen = Math.max(origWords.length, corrWords.length);

  for (let i = 0; i < maxLen; i++) {
    if (origWords[i] !== corrWords[i]) {
      diff++;
    }
  }

  // At least 1 difference if strings differ
  return diff || 1;
}

function checkGrammar(text, badge, element) {
  setBadgeState(badge, 'loading');
  positionBadge(badge, element);

  chrome.runtime.sendMessage(
    { action: "correctGrammar", text },
    (response) => {
      if (chrome.runtime.lastError) {
        console.log("Grammar check error:", chrome.runtime.lastError.message);
        setBadgeState(badge, 'hidden');
        return;
      }

      if (response?.error) {
        console.log("Grammar model error:", response.error);
        // If model is loading, keep badge hidden
        if (response.loading) {
          setBadgeState(badge, 'hidden');
        }
        return;
      }

      if (response?.result?.[0]) {
        const corrected = response.result[0].generated_text;
        const count = countDifferences(text, corrected);

        console.log(`Grammar check: "${text}" → "${corrected}" (${count} differences)`);

        if (count === 0) {
          setBadgeState(badge, 'success');
          correctionData.delete(element); // No corrections needed
        } else {
          // Store correction data for popup
          correctionData.set(element, {
            original: text,
            corrected: corrected,
            count: count
          });
          setBadgeState(badge, 'errors', count);
        }
        positionBadge(badge, element);
      } else {
        setBadgeState(badge, 'hidden');
        correctionData.delete(element);
      }
    }
  );
}

// ============================================
// Popup Functions
// ============================================
let activePopup = null;
let activePopupElement = null;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function closePopup() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
    activePopupElement = null;
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleEscapeKey);
  }
}

function handleOutsideClick(e) {
  if (activePopup && !activePopup.contains(e.target) &&
      !e.target.classList.contains('grammar-badge')) {
    closePopup();
  }
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closePopup();
  }
}

function createPopup(element, data) {
  closePopup(); // Close any existing popup

  const popup = document.createElement('div');
  popup.className = 'grammar-popup';
  popup.innerHTML = `
    <div class="grammar-popup-header">
      <span>Suggestion</span>
      <span class="grammar-popup-close">&times;</span>
    </div>
    <div class="grammar-popup-content">
      <div class="grammar-popup-row">
        <div class="grammar-popup-label">Original</div>
        <div class="grammar-popup-text grammar-popup-original">${escapeHtml(data.original)}</div>
      </div>
      <div class="grammar-popup-row">
        <div class="grammar-popup-label">Corrected</div>
        <div class="grammar-popup-text grammar-popup-corrected">${escapeHtml(data.corrected)}</div>
      </div>
    </div>
    <div class="grammar-popup-actions">
      <button class="grammar-popup-btn grammar-popup-btn-skip">Skip</button>
      <button class="grammar-popup-btn grammar-popup-btn-apply">Apply</button>
    </div>
  `;

  document.body.appendChild(popup);
  activePopup = popup;
  activePopupElement = element;

  // Position popup above the badge
  const badge = fieldBadges.get(element);
  if (badge) {
    const badgeRect = badge.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    // Try to position above badge
    let top = badgeRect.top - popupRect.height - 8;
    let left = badgeRect.right - popupRect.width;

    // If would go off top, position below badge
    if (top < 8) {
      top = badgeRect.bottom + 8;
    }

    // Keep within viewport horizontally
    if (left < 8) {
      left = 8;
    }

    popup.style.top = top + 'px';
    popup.style.left = left + 'px';
  }

  // Event handlers
  popup.querySelector('.grammar-popup-close').onclick = closePopup;
  popup.querySelector('.grammar-popup-btn-skip').onclick = closePopup;
  popup.querySelector('.grammar-popup-btn-apply').onclick = () => {
    applyCorrection(element, data.corrected);
    closePopup();
  };

  // Close on outside click (with slight delay to avoid immediate close)
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);
  }, 10);
}

function applyCorrection(element, correctedText) {
  // Replace text in the field
  if (element.value !== undefined) {
    element.value = correctedText;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (element.isContentEditable) {
    element.innerText = correctedText;
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  // Show green checkmark
  const badge = fieldBadges.get(element);
  if (badge) {
    setBadgeState(badge, 'success');
  }

  // Clear stored correction data and update cache
  correctionData.delete(element);
  lastCheckedText.set(element, correctedText);
}

// ============================================
// Field Tracking with Persistent Badges
// ============================================
const fieldBadges = new WeakMap();
const debounceTimers = new WeakMap();
const lastCheckedText = new WeakMap(); // Cache to avoid re-checking same text
const correctionData = new WeakMap(); // Store { original, corrected, count } for popup
const DEBOUNCE_MS = 1500; // 1.5 seconds debounce

function getOrCreateBadge(element) {
  if (!fieldBadges.has(element)) {
    const badge = createBadge(element);
    fieldBadges.set(element, badge);
  }
  return fieldBadges.get(element);
}

function handleFieldInput(element, isInputEvent = false) {
  const text = getTextContent(element);
  const badge = getOrCreateBadge(element);

  // If not enough text, hide badge completely
  if (!hasEnoughText(text)) {
    setBadgeState(badge, 'hidden');
    lastCheckedText.delete(element);
    return;
  }

  // Skip if text hasn't changed (on focus/blur)
  const lastText = lastCheckedText.get(element);
  if (lastText === text && !isInputEvent) {
    // Just reposition badge, don't re-check
    positionBadge(badge, element);
    return;
  }

  // Clear existing debounce timer
  const existingTimer = debounceTimers.get(element);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Show loading state immediately when we have enough text
  setBadgeState(badge, 'loading');
  positionBadge(badge, element);

  // Start debounce timer for grammar check
  const timer = setTimeout(() => {
    // Double-check text hasn't been cleared during debounce
    const currentText = getTextContent(element);
    if (hasEnoughText(currentText)) {
      lastCheckedText.set(element, currentText);
      checkGrammar(currentText, badge, element);
    } else {
      setBadgeState(badge, 'hidden');
      lastCheckedText.delete(element);
    }
  }, DEBOUNCE_MS);

  debounceTimers.set(element, timer);
}

// ============================================
// Event Listeners
// ============================================
function initGrammarBadge() {
  // Inject CSS styles
  injectStyles();

  // Focus event - show badge (skip re-check if text unchanged)
  document.addEventListener('focusin', (e) => {
    const root = getEditableRoot(e.target);
    if (root && isValidTextField(root)) {
      handleFieldInput(root, false);
    }
  }, true);

  // Input event - always trigger grammar check (also fires on paste/cut)
  document.addEventListener('input', (e) => {
    const root = getEditableRoot(e.target);
    if (root && isValidTextField(root)) {
      handleFieldInput(root, true);
    }
  }, true);

  // Paste event - force re-check after paste (some browsers don't fire input)
  document.addEventListener('paste', (e) => {
    const root = getEditableRoot(e.target);
    if (root && isValidTextField(root)) {
      // Clear cached text to force re-check
      lastCheckedText.delete(root);
      setTimeout(() => handleFieldInput(root, true), 100);
    }
  }, true);

  // Cut event - force re-check after cut
  document.addEventListener('cut', (e) => {
    const root = getEditableRoot(e.target);
    if (root && isValidTextField(root)) {
      // Clear cached text to force re-check
      lastCheckedText.delete(root);
      setTimeout(() => handleFieldInput(root, true), 100);
    }
  }, true);

  // Scroll event - reposition visible badges
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      document.querySelectorAll('.grammar-badge').forEach(badge => {
        if (badge.style.display !== 'none') {
          // Find the associated element by checking WeakMap entries
          // For now, we'll rely on focusin to reposition
        }
      });
    }, 100);
  }, { passive: true });

  // Resize event - reposition badges
  window.addEventListener('resize', () => {
    // Badges will reposition on next focus/input
  }, { passive: true });

  // Badge click handler - show correction popup
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('grammar-badge')) {
      e.stopPropagation();
      const element = e.target._grammarElement;
      if (element) {
        const data = correctionData.get(element);
        if (data && data.count > 0) {
          createPopup(element, data);
        }
      }
    }
  }, true);

  console.log("Grammar badge system initialized");
}

// ============================================
// Model Status Listener
// ============================================
let modelReady = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "modelLoadingProgress") {
    console.log(`Model loading: ${request.progress}%`);
  } else if (request.action === "modelReady") {
    console.log("Grammar model is ready!");
    modelReady = true;
  }
  return false;
});

// Check model status on load
chrome.runtime.sendMessage({ action: "getModelStatus" }, (response) => {
  if (chrome.runtime.lastError) {
    console.log("Error checking model status:", chrome.runtime.lastError.message);
  } else if (response?.ready) {
    console.log("Grammar model already loaded");
    modelReady = true;
  } else if (response?.loading) {
    console.log(`Grammar model loading: ${response.progress}%`);
  }
});

// ============================================
// Initialize
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGrammarBadge);
} else {
  initGrammarBadge();
}
