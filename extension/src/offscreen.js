// Offscreen document - has access to DOM APIs including URL.createObjectURL
import { pipeline, env } from '../lib/transformers.min.js';

console.log("Offscreen document loaded");

// Configure transformers.js to use local files
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

// Set the path to local WASM files - point to lib folder
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('lib/');

let generator = null;
let isModelLoading = false;
let modelReady = false;
let loadingProgress = 0;
let loadModelPromise = null; // Ensures only one download at a time

// Timeout helper to prevent hanging
function withTimeout(promise, ms, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
}

// Constants for timeouts
const MODEL_LOAD_TIMEOUT = 5 * 60 * 1000; // 5 minutes for model download
const INFERENCE_TIMEOUT = 30 * 1000; // 30 seconds for inference

// Track progress per file to handle multi-file downloads
let fileProgressMap = {};
let lastReportedProgress = -1;

// Progress callback for model loading
function progressCallback(progress) {
  console.log("Model loading progress:", progress);

  if (progress.progress !== undefined) {
    // Track progress per file
    const fileKey = progress.file || 'default';
    fileProgressMap[fileKey] = progress.progress;

    // Calculate overall progress as average of all files (weighted by assuming similar sizes)
    // For T5, the main files are: encoder (~220MB), decoder (~550MB), so decoder is ~70% of total
    const files = Object.keys(fileProgressMap);
    let overallProgress;

    if (files.length === 1) {
      // Single file, just use its progress
      overallProgress = Math.round(fileProgressMap[files[0]]);
    } else {
      // Multiple files - use weighted average based on known T5 structure
      // encoder_model = ~30%, decoder_model_merged = ~70%
      const encoder = fileProgressMap['onnx/encoder_model.onnx'] || 0;
      const decoder = fileProgressMap['onnx/decoder_model_merged.onnx'] || 0;
      const otherFiles = files.filter(f => !f.includes('encoder_model') && !f.includes('decoder_model'));
      const otherProgress = otherFiles.length > 0
        ? otherFiles.reduce((sum, f) => sum + fileProgressMap[f], 0) / otherFiles.length
        : 100; // Small config files likely done

      // Weight: 5% for small files, 25% encoder, 70% decoder
      overallProgress = Math.round(otherProgress * 0.05 + encoder * 0.25 + decoder * 0.70);
    }

    // Only send update if progress changed
    if (overallProgress !== lastReportedProgress) {
      lastReportedProgress = overallProgress;
      loadingProgress = overallProgress;
      console.log(`Loading: ${loadingProgress}% (file: ${progress.file})`);

      chrome.runtime.sendMessage({
        type: "progressUpdate",
        progress: loadingProgress,
        status: progress.status || "downloading"
      });
    }
  }
}

// Load the model (ensures only one download at a time)
async function loadModel() {
  // If already loaded, return immediately
  if (modelReady) {
    console.log("Model already loaded");
    return;
  }

  // If currently loading, return the existing promise
  if (loadModelPromise) {
    console.log("Model already loading, waiting for existing download...");
    return loadModelPromise;
  }

  // Start loading
  isModelLoading = true;
  console.log("Starting to load grammar correction model in offscreen document...");

  loadModelPromise = (async () => {
    try {
      // Wrap model loading with timeout to prevent indefinite hanging
      generator = await withTimeout(
        pipeline(
          'text2text-generation',
          'Xenova/t5-base-grammar-correction',
          {
            device: 'wasm',
            dtype: 'fp32',
            progress_callback: progressCallback
          }
        ),
        MODEL_LOAD_TIMEOUT,
        'Model download timed out after 5 minutes. Please check your network connection and try again.'
      );

      console.log("Model pipeline loaded successfully in offscreen document!");

      // Notify that we're now testing the model
      chrome.runtime.sendMessage({
        type: "progressUpdate",
        progress: 100,
        status: "testing"
      });

      // Test the model with timeout to ensure it's working
      const testText = "My name are Naimur";
      console.log("Testing model with:", testText);
      const result = await withTimeout(
        generator(testText),
        INFERENCE_TIMEOUT,
        'Model test inference timed out after 30 seconds.'
      );
      console.log("Model output:", result);

      // Now mark as ready after successful test
      isModelLoading = false;
      modelReady = true;
      loadingProgress = 100;
      console.log("Model is fully ready!");

      // Notify background that model is ready
      console.log("Sending modelReady message to background...");
      chrome.runtime.sendMessage({
        type: "modelReady"
      }, () => {
        if (chrome.runtime.lastError) {
          console.log("Error sending modelReady:", chrome.runtime.lastError.message);
        } else {
          console.log("modelReady message sent successfully");
        }
      });

    } catch (error) {
      console.error("Error loading model:", error);
      isModelLoading = false;
      loadModelPromise = null; // Reset so it can be retried

      // Notify background of error
      chrome.runtime.sendMessage({
        type: "modelError",
        error: error.message
      });
    }
  })();

  return loadModelPromise;
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Offscreen received message:", request, "from:", sender.url);

  // Ignore messages that we sent (type messages)
  if (request.type) {
    return;
  }

  // Only process action messages from background/content
  if (!request.action) {
    return;
  }

  if (request.action === "loadModel") {
    loadModel().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === "correctGrammar") {
    if (!modelReady) {
      sendResponse({
        error: "Model not ready yet. Please wait...",
        loading: isModelLoading,
        progress: loadingProgress
      });
      return true;
    }

    // Validate input text
    const text = (request.text || '').trim();
    if (!text || text.length < 3) {
      sendResponse({ error: "Text too short", result: null });
      return true;
    }

    // Limit text length to prevent browser hang (max ~500 chars)
    const truncatedText = text.length > 500 ? text.substring(0, 500) : text;

    // Wrap inference with timeout to prevent indefinite hanging
    withTimeout(
      generator(truncatedText, { max_length: 512 }),
      INFERENCE_TIMEOUT,
      'Grammar correction timed out after 30 seconds. Try with shorter text.'
    )
      .then(result => {
        console.log("Grammar correction result:", result);
        sendResponse({ result: result });
      })
      .catch(error => {
        console.error("Error correcting grammar:", error);
        sendResponse({ error: error.message });
      });

    return true; // Keep message channel open for async response
  }

  if (request.action === "getModelStatus") {
    sendResponse({
      ready: modelReady,
      loading: isModelLoading,
      progress: loadingProgress
    });
    return true;
  }
});

// Don't auto-load - wait for explicit request from background
console.log("Offscreen document ready, waiting for load request...");
