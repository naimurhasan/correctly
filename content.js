// Content script - runs in the context of web pages
console.log("hello from console cet");

// Request grammar correction from background service worker
const testText = "My name are Naimur";
let correctionAttempted = false;

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "modelLoadingProgress") {
    console.log(`Model loading: ${request.progress}% - ${request.status || ''}`);
  } else if (request.action === "modelReady") {
    console.log("Model is ready! Requesting grammar correction...");
    if (!correctionAttempted) {
      requestGrammarCorrection();
    }
  }
});

function requestGrammarCorrection() {
  correctionAttempted = true;
  console.log("Sending text for grammar correction:", testText);

  chrome.runtime.sendMessage(
    {
      action: "correctGrammar",
      text: testText
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.log("Error:", chrome.runtime.lastError.message);
        correctionAttempted = false;
      } else if (response.error) {
        console.log(response.error);
        if (response.progress !== undefined) {
          console.log(`Current loading progress: ${response.progress}%`);
        }
        if (response.loading) {
          console.log("Model is loading, waiting for it to be ready...");
          correctionAttempted = false;
        }
      } else if (response.result) {
        console.log("✓ Original text:", testText);
        console.log("✓ Corrected text:", response.result[0].generated_text);
      } else {
        console.log("Response from background:", response);
        correctionAttempted = false;
      }
    }
  );
}

// Don't send initial request - wait for modelReady message
// The model will notify us when it's ready via the "modelReady" action
