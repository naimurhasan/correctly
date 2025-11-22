// Offscreen document - has access to DOM APIs including URL.createObjectURL
import { pipeline, env } from './transformers.min.js';

console.log("Offscreen document loaded");

// Configure transformers.js to use local files
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

// Set the path to local WASM files
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('./');

let generator = null;
let isModelLoading = false;
let modelReady = false;
let loadingProgress = 0;

// Progress callback for model loading
function progressCallback(progress) {
  console.log("Model loading progress:", progress);

  // Calculate percentage if available
  if (progress.progress !== undefined) {
    loadingProgress = Math.round(progress.progress);
    console.log(`Loading: ${loadingProgress}%`);

    // Send progress update to background
    chrome.runtime.sendMessage({
      type: "progressUpdate",
      progress: loadingProgress,
      status: progress.status
    });
  }
}

// Load the model
async function loadModel() {
  if (isModelLoading || modelReady) {
    console.log("Model already loading or loaded");
    return;
  }

  isModelLoading = true;
  console.log("Starting to load grammar correction model in offscreen document...");

  try {
    generator = await pipeline(
      'text2text-generation',
      'Xenova/t5-base-grammar-correction',
      {
        device: 'wasm',
        dtype: 'fp32',
        progress_callback: progressCallback
      }
    );

    isModelLoading = false;
    loadingProgress = 100;
    console.log("Model pipeline loaded successfully in offscreen document!");

    // Test the model with the example text before marking as ready
    const testText = "My name are Naimur";
    console.log("Testing model with:", testText);
    const result = await generator(testText);
    console.log("Model output:", result);

    // Now mark as ready after successful test
    modelReady = true;
    console.log("Model is fully ready!");

    // Notify background that model is ready
    console.log("Sending modelReady message to background...");
    chrome.runtime.sendMessage({
      type: "modelReady"
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("Error sending modelReady:", chrome.runtime.lastError.message);
      } else {
        console.log("modelReady message sent successfully");
      }
    });

  } catch (error) {
    console.error("Error loading model:", error);
    isModelLoading = false;

    // Notify background of error
    chrome.runtime.sendMessage({
      type: "modelError",
      error: error.message
    });
  }
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

    generator(request.text)
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

// Start loading the model when offscreen document loads
console.log("Starting model load...");
loadModel();
