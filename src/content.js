import { resizeResults } from './face-api.esm.js';
import { FaceDetector } from './faceRecognizer.js';

/**
 * @type {Promise<FaceDetector>}
 */
let recognizer = null;

const REFERENCE_IMAGES = [
  {url: 'reference_images/trump1.jpg', label: 'trump'},
  {url: 'reference_images/musk1.jpg', label: 'musk'}
].map(obj => { return { url: chrome.runtime.getURL(obj.url), label: obj.label} } );

export async function initRecognizer() {
  if (!recognizer) {
    recognizer = FaceDetector.create(REFERENCE_IMAGES);
  }

  await Promise.all([recognizer]);

  return recognizer
}

async function getCanvasFromImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.src = dataUrl;
  });
}

async function getImageDataURL(originalImageUrl) {
  let promise = new Promise((resolve) => {
    chrome.runtime.sendMessage({type: 'fetchImage', url: originalImageUrl}, resolve);
  });

  let dataUrl = await promise
  let canvas = await getCanvasFromImage(dataUrl);

  return canvas.toDataURL();
}

export async function checkImage(imageUrl, imageSrc) {
  let recognizer = await initRecognizer()

  /**
   * @type {FaceMatcherResult}
   */
  let results = await recognizer.matchFaces(imageUrl, imageSrc);

  return {
    imageUrl: imageUrl,
    matchData: results
  }
}

/**
 * 
 * @param {HTMLImageElement} img 
 * @returns 
 */
async function handleImage(img) {
  try {
    if (img.complete) {

    }
    if (!img.src || img.hasAttribute('data-face-processed')) return;
    
    img.setAttribute('data-face-processed', 'true');
    
    if (img.src.startsWith('data:') || img.src.startsWith('blob:')) return;

    let imageBase64 = await getImageDataURL(img.src);

    let results = await checkImage(imageBase64, img.src);
    if (results.matchData.matches) {
      console.debug("Match found for image {}", results.matchData);
      const imageElement = document.querySelector(`img[src="${img.src}"]`);
      if (imageElement) {
        imageElement.style.filter = 'blur(5px) sepia(50%) hue-rotate(320deg)';
        imageElement.setAttribute('data-face-match', 'true');
      }
    } else {
      console.debug("No match found for image {}", img.src);
    }
  } catch (error) {
    console.error('Error processing image', img.src, error);
  }
}

function observeImages() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        handleImage(mutation.target);
      }
      mutation.addedNodes.forEach(node => {
        if (node.nodeName === 'IMG') handleImage(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('img').forEach(handleImage);
        }
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
}

document.querySelectorAll('img').forEach(handleImage);
observeImages();