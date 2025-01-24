chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'fetchImage') {
      fetch(request.url)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => sendResponse(reader.result);
          reader.readAsDataURL(blob);
        });
      return true; // Keep message channel open for async response
    }
  });