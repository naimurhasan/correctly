// Full page app for grammar correction

const MAX_CHARS = 500;

// DOM elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const charCount = document.getElementById('charCount');
const correctBtn = document.getElementById('correctBtn');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');

let modelReady = false;

// Update status display
function updateStatus(status, progress = null) {
  statusIndicator.className = 'status-indicator';

  if (status === 'ready') {
    statusIndicator.classList.add('ready');
    statusText.textContent = 'Model ready! You can start typing.';
    progressBar.classList.remove('visible');
    inputText.disabled = false;
    correctBtn.disabled = false;
    modelReady = true;
  } else if (status === 'loading') {
    statusIndicator.classList.add('loading');
    if (progress !== null) {
      statusText.textContent = `Loading model... ${progress}%`;
      progressBar.classList.add('visible');
      progressFill.style.width = `${progress}%`;
    } else {
      statusText.textContent = 'Loading grammar model...';
      progressBar.classList.add('visible');
    }
  } else if (status === 'testing') {
    statusIndicator.classList.add('loading');
    statusText.textContent = 'Testing model... (this may take a moment)';
    progressBar.classList.add('visible');
    progressFill.style.width = '100%';
  } else if (status === 'error') {
    statusIndicator.classList.add('error');
    statusText.textContent = 'Error loading model. Please reload the extension.';
    progressBar.classList.remove('visible');
  } else if (status === 'correcting') {
    statusText.textContent = 'Checking grammar...';
    correctBtn.classList.add('loading');
    correctBtn.disabled = true;
  } else if (status === 'done') {
    statusIndicator.classList.add('ready');
    statusText.textContent = 'Correction complete!';
    correctBtn.classList.remove('loading');
    correctBtn.disabled = false;
  }
}

// Update character count
function updateCharCount() {
  const len = inputText.value.length;
  charCount.textContent = `${len} / ${MAX_CHARS} characters`;
  charCount.className = 'char-count';

  if (len > MAX_CHARS) {
    charCount.classList.add('error');
  } else if (len > MAX_CHARS * 0.8) {
    charCount.classList.add('warning');
  }
}

// Check model status on load
async function checkModelStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getModelStatus' });
    if (response.ready) {
      updateStatus('ready');
    } else if (response.loading) {
      updateStatus('loading', response.progress);
    } else {
      updateStatus('loading');
    }
  } catch (error) {
    console.error('Error checking model status:', error);
    updateStatus('loading');
  }
}

// Correct grammar
async function correctGrammar() {
  const text = inputText.value.trim();

  if (!text) {
    return;
  }

  if (text.length < 3) {
    outputText.innerHTML = '<span style="color: #dc3545;">Please enter at least 3 characters.</span>';
    return;
  }

  updateStatus('correcting');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'correctGrammar',
      text: text
    });

    if (response.error) {
      outputText.innerHTML = `<span style="color: #dc3545;">Error: ${response.error}</span>`;
      updateStatus('ready');
    } else if (response.result && response.result.length > 0) {
      const correctedText = response.result[0].generated_text || response.result[0].text || response.result;
      outputText.textContent = correctedText;
      outputText.classList.add('has-content');
      copyBtn.disabled = false;
      updateStatus('done');

      // Reset to ready after a moment
      setTimeout(() => updateStatus('ready'), 2000);
    }
  } catch (error) {
    console.error('Error correcting grammar:', error);
    outputText.innerHTML = `<span style="color: #dc3545;">Error: ${error.message}</span>`;
    updateStatus('ready');
  }
}

// Copy result to clipboard
async function copyResult() {
  const text = outputText.textContent;
  if (text && !outputText.querySelector('.output-placeholder')) {
    try {
      await navigator.clipboard.writeText(text);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }
}

// Clear all
function clearAll() {
  inputText.value = '';
  outputText.innerHTML = '<span class="output-placeholder">Corrected text will appear here...</span>';
  outputText.classList.remove('has-content');
  copyBtn.disabled = true;
  updateCharCount();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'modelReady') {
    updateStatus('ready');
  } else if (request.action === 'modelLoadingProgress') {
    if (request.status === 'testing') {
      updateStatus('testing');
    } else {
      updateStatus('loading', request.progress);
    }
  } else if (request.action === 'modelError') {
    updateStatus('error');
  }
});

// Event listeners
inputText.addEventListener('input', updateCharCount);

correctBtn.addEventListener('click', correctGrammar);

copyBtn.addEventListener('click', copyResult);

clearBtn.addEventListener('click', clearAll);

// Allow Ctrl+Enter to submit
inputText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && modelReady) {
    correctGrammar();
  }
});

// Initialize
checkModelStatus();
updateCharCount();
