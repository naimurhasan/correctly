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
  `;
  document.head.appendChild(style);
}

// ============================================
// Field Detection (Grammarly-style)
// ============================================
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
function createBadge() {
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
    pointer-events: none;
    transition: background-color 0.2s ease;
    box-sizing: border-box;
  `;
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
        } else {
          setBadgeState(badge, 'errors', count);
        }
        positionBadge(badge, element);
      } else {
        setBadgeState(badge, 'hidden');
      }
    }
  );
}

// ============================================
// Field Tracking with Persistent Badges
// ============================================
const fieldBadges = new WeakMap();
const debounceTimers = new WeakMap();
const lastCheckedText = new WeakMap(); // Cache to avoid re-checking same text
const DEBOUNCE_MS = 1500; // 1.5 seconds debounce

function getOrCreateBadge(element) {
  if (!fieldBadges.has(element)) {
    const badge = createBadge();
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
    if (isValidTextField(e.target)) {
      handleFieldInput(e.target, false);
    }
  }, true);

  // Input event - always trigger grammar check
  document.addEventListener('input', (e) => {
    if (isValidTextField(e.target)) {
      handleFieldInput(e.target, true);
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
