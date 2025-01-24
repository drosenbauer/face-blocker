import * as faceapi from './face-api.esm.js';

export class FaceDetector {
  constructor() {
    this.modelsLoaded = false;
    this.labeledDescriptors = [];
  }

  static async create(references) {
    let fd = new FaceDetector()
    await fd.loadModels()

    for(let img of references) {
      await fd.addExemplar(img.url, img.label);
    }
    
    return fd;
  }

  // Load the required models
  async loadModels() {
    await faceapi.tf.enableProdMode();
    await faceapi.tf.ready()

    const modelPath = 'models';
    const url = chrome.runtime.getURL(modelPath);

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(url), // Face detection model
      faceapi.nets.faceRecognitionNet.loadFromUri(url), // Face recognition model
      faceapi.nets.faceLandmark68Net.loadFromUri(url), // Face landmarks model
    ]);
    console.debug("Models loaded: " + faceapi.nets)
    this.modelsLoaded = true;
  }

  // Add an exemplar face to match against
  async addExemplar(imageUrl, label) {
    if (!this.modelsLoaded) {
      throw new Error('Models are not loaded yet. Call loadModels() first.');
    }

    const img = await faceapi.fetchImage(imageUrl);
    const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detections) {
      throw new Error(`No face detected in exemplar image: ${imageUrl}`);
    }

    const descriptor = detections.descriptor;
    this.labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label, [descriptor]));
  }

  /**
   * Matches the image against the exemplar faces
   * @param {string} imageDataUrl 
   * @returns {Promise<FaceMatcherResult}>}
   */
  async matchFaces(imageDataUrl, imageSrc) {
    if (!this.modelsLoaded) {
      throw new Error('Models are not loaded yet. Call loadModels() first.');
    }

    if (this.labeledDescriptors.length === 0) {
      throw new Error('No exemplars added. Use addExemplar() to add faces.');
    }

    const base64Response = await fetch(imageDataUrl);
    const blob = await base64Response.blob();
    const img = await faceapi.bufferToImage(blob);

    const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();

    if (!detections.length) {
      console.debug("No faces in image {}", imageSrc);
      
      return { matches: false, details: [] };
    }

    const faceMatcher = new faceapi.FaceMatcher(this.labeledDescriptors);
    const results = detections.map((detection) => {
      const match = faceMatcher.findBestMatch(detection.descriptor);
      return {
        label: match.label,
        distance: match.distance,
        match: match.label !== 'unknown',
      };
    });

    const matches = results.some((result) => result.match);
    return { matches, details: results };
  }
}

export default FaceDetector;
