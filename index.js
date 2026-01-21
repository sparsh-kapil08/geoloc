/**
 * GeoSpy - Simplified Intelligence Pipeline
 * This script handles the frontend logic for an application that identifies the location of an uploaded image.
 * Simplified Pipeline:
 * 1. Try Gemini AI (Visual Analysis)
 * 2. If AI fails, try Tensor Flow dataset
 */

import { GoogleGenAI, Type } from "@google/genai";
import L from "leaflet";
import * as mobilenet from "https://esm.sh/@tensorflow-models/mobilenet";
import Tesseract from "https://esm.sh/tesseract.js";
// --- CONFIGURATION & CONSTANTS ---

/**
 * Schema for the expected JSON response from the Gemini AI model.
 * This ensures the AI returns data in a predictable structure.
 */
const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    lat: { type: Type.NUMBER },
    lng: { type: Type.NUMBER },
    city: { type: Type.STRING },
    country: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    reasoning: { type: Type.STRING },
    visualAnalysisSummary: { type: Type.STRING }
  },
  required: ["lat", "lng", "city", "country", "confidence", "reasoning", "visualAnalysisSummary"]
};

// --- APPLICATION STATE ---

const state ={
  markers: [],
  map: null,
}



// --- DOM ELEMENT REFERENCES ---

const nodes = {
  app: document.getElementById('app'),
  fileInput: document.getElementById('fileInput'),
  mainBtn: document.getElementById('mainBtn'),
  clearBtn: document.getElementById('clearBtn'),
  emptyState: document.getElementById('emptyState'),
  resultView: document.getElementById('resultView'),
  previewImg: document.getElementById('previewImg'),
  statusMessage: document.getElementById('statusMessage'),
  resultsContent: document.getElementById('resultsContent'),
  engineBadge: document.getElementById('engineBadge'),
  locCity: document.getElementById('locCity'),
  locCountry: document.getElementById('locCountry'),
  locConfidence: document.getElementById('locConfidence'),
  locCoords: document.getElementById('locCoords'),
  locReasoning: document.getElementById('locReasoning'),
  inferenceText: document.getElementById('inferenceText'),
  prefer: document.getElementById('prefer'),
};

// --- INITIALIZATION ---

/**
 * Initializes the application, state.map, and event listeners.
 */
function init() {
  state.map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([20, 0], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(state.map);

  L.control.zoom({ position: 'topright' }).addTo(state.map);

  nodes.mainBtn.onclick = () => nodes.fileInput.click();
  nodes.fileInput.onchange = handleFileSelect;
  nodes.clearBtn.onclick = resetApp;

  window.addEventListener('resize', () => state.map.invalidateSize());
}

// --- CORE PIPELINE ---

/**
 * Handles the file input change event. Starts the analysis pipeline.
 * The file input change event.
 */
async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const base64Image = event.target.result;
    
    // Prepare UI for results
    nodes.emptyState.classList.add('hidden');
    nodes.resultView.classList.remove('hidden');
    nodes.previewImg.classList.add('blur');

    nodes.previewImg.src = base64Image;
    
    // Show loading state
    nodes.resultsContent.classList.add('hidden');
    nodes.statusMessage.classList.remove('hidden');
    nodes.statusMessage.textContent = "Analyzing image location...";
    nodes.statusMessage.style.color = "#5f6368";

    try {
      const result = await identifyLocation(base64Image, file);
      renderResults(result);
    } catch (err) {
      console.error(err);
      nodes.statusMessage.innerText = "All Scans Failed, Location Not Found";
      nodes.statusMessage.style.color = "#d93025";
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Main Logic: Tries AI first, then falls back to Metadata.
 */
async function identifyLocation(base64Image, file) {
  // 1. Try Gemini AI
  try {
    const serpResponse = await Vision(base64Image);
    console.log("Serp Response:", serpResponse);
    const preference = nodes.prefer.value;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] }},
          { text: `Locate this image. Be precise. prefer ${preference},search on web and Return a JSON object with lat, lng, city, country, confidence, and reasoning.
          make sure if the image dosent have unique visuals,to the point names which defines the place. it looks like multiple places then give your response with the confidence in the range of 0.4 to 0.6
          the hints image got from the google lens=${serpResponse}` },
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      }
    });
    const parsed = JSON.parse(aiResponse.text);
    if (parsed.lat && parsed.lng) {
      return { ...parsed, source: 'Gemini 3 Flash' };
    }
  } catch (e) {
    console.warn("AI Analysis failed, trying other models", e);
  }

  // "Fallback: Try Secondary Model
  try {
      const preference = nodes.prefer.value;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
            { text: `Locate this image. Be precise. prefer ${preference},search on web and Return a JSON object with lat, lng, city, country, confidence, and reasoning.
          make sure if the image dosent have unique visuals,to the point names which defines the place. it looks like multiple places then give your response with the confidence in the range of 0.4 to 0.6
          the hints image got from the google lens=${serpResponse}`}
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        }
      });
      const parsed = JSON.parse(aiResponse.text);
      if (parsed.lat && parsed.lng) {
        return { ...parsed, source: 'Gemini 2.5 Flash' };
      }
  } catch (err) {
      console.warn("Secondary AI failed", err);
  }
  /* 3. Fallback: Local Object Detection (TensorFlow.js)
  try {
    nodes.statusMessage.innerText="local test begins";
    const data = await runLocalObjectAnalysis(nodes.previewImg, base64Image);
    return data;
  } 
  catch (e) {
    console.warn("Local AI failed", e);
  }

// --- UI & RENDERING ---

/**
 * Renders the final results of the analysis in the sidebar.
 *  The analysis result data.
 */
}
function renderResults(data) {
  if(data.confidence < 0){
    nodes.statusMessage.innerText="Very Low confidence";
    nodes.statusMessage.style.color="red";
    nodes.previewImg.classList.remove('blur');
  }
  else{
    nodes.statusMessage.classList.add('hidden');
    nodes.resultsContent.classList.remove('hidden');
    nodes.previewImg.classList.remove('blur');

  // Update Static Elements
    nodes.engineBadge.textContent = `Active Engine: ${data.source}`;
    nodes.inferenceText.textContent = `"${data.visualAnalysisSummary || data.reasoning}"`;
  
    nodes.locCity.textContent = data.city;
    nodes.locCountry.textContent = data.country;
    nodes.locConfidence.textContent = `Certainty: ${Math.round((data.confidence * 100)-10)}%`;
    nodes.locCoords.textContent = `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`;
    nodes.locReasoning.textContent = data.reasoning;

  // Update state.map Markers
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
    if (!isNaN(data.lat) && !isNaN(data.lng)) {
    const marker = L.marker([data.lat, data.lng]).addTo(state.map);
    state.markers.push(marker);
    if(nodes.prefer.value==""){
      const circle = L.circle([data.lat, data.lng], {
      color: '#3388ff',      // Bluish border
      fillColor: '#3388ff',  // Bluish fill
      fillOpacity: 0.2,      // Transparency (0.0 to 1.0)
      radius: 1000        // Radius in meters (e.g., 1000m = 1km)
    }).addTo(state.map);
    state.markers.push(circle);
    console.log("50");
    }
    else{
      const circle = L.circle([data.lat, data.lng], {
      color: '#3388ff',      // Bluish border
      fillColor: '#3388ff',  // Bluish fill
      fillOpacity: 0.2,      // Transparency (0.0 to 1.0)
      radius: 500          // Radius in meters 
    }).addTo(state.map);
    state.markers.push(circle);
    }
    // Add a transparent bluish circle to define the area radius
    

    state.map.flyTo([data.lat, data.lng], 15, { duration: 1.5 });
  }
  }
}

/**
 * Resets the application to its initial state.
 */
function resetApp() {
  nodes.resultView.classList.add('hidden');
  nodes.emptyState.classList.remove('hidden');
  nodes.fileInput.value = '';
  nodes.prefer.value='';
  state.markers.forEach(m => state.map.removeLayer(m));
  state.markers = [];
  state.map.flyTo([20, 0], 2);
}

/**
 * Runs a local neural network (Coco-SSD) to detect objects and infer environment.
 * This runs entirely in the browser without any API calls.
 */
async function runLocalObjectAnalysis(imgElement, base64Image) {
  nodes.statusMessage.innerText = "Running Local Vision & OCR Analysis...";

  // 1. Initialize Models (Parallel Loading)
  // We load MobileNet for object detection and Tesseract for OCR
  const [model, ocrResult] = await Promise.all([
    mobilenet.load(),
    Tesseract.recognize(base64Image, 'eng+hin+fra', {
      logger: m => console.log(m) // Optional: logs OCR progress
    })
  ]);

  // 2. Run Inference
  const predictions = await model.classify(imgElement);
  const ocrText = ocrResult.data.text || "";
  
  // 3. Process Results
  // Normalize object names (MobileNet returns 'className')
  const objects = predictions.map(p => (p.className || p.class).toLowerCase());
  
  // Extract significant words from OCR (length > 3, alphanumeric)
  const ocrWords = ocrText.toLowerCase().split(/[\s,\.]+/).filter(w => w.length > 3 && /^[a-z]+$/.test(w));
  
  const uniqueTerms = [...new Set([...objects, ...ocrWords])];
  console.log("Local Analysis Terms:", uniqueTerms);

  // Default Fallback State
  let result = {
    source: 'Fallback: Local MobileNet + OCR',
    lat: 48.8566, lng: 2.3522, 
    city: "Error Location", country: "Unknown", 
    confidence: 0.2, 
    reasoning: "Local analysis could not match features to the database.",
    visualAnalysisSummary: `Detected Objects: ${objects.join(', ')}. OCR Text: "${ocrText.replace(/\n/g, ' ').substring(0, 60)}..."`
  };

  try {
    const response = await fetch('./dataset.json', { cache: "no-store" });
    if (response.ok) {
      const dataset = await response.json();
      
      // Strategy: Check OCR words first (High Confidence), then Objects (Medium Confidence)
      let matchedKey = uniqueTerms.find(term => dataset[term]);
      
      // If we found a match in our local dataset
      if (matchedKey && dataset[matchedKey]) {
        const match = dataset[matchedKey];
        const isOcrMatch = ocrWords.includes(matchedKey);

        result.lat = match.lat;
        result.lng = match.lng;
        result.city = match.city;
        result.country = match.country;
        result.confidence = isOcrMatch ? 0.7 : 0.4; // Higher confidence if text matched
        result.reasoning = `Local AI identified '${matchedKey}' via ${isOcrMatch ? 'Text Analysis' : 'Visual Recognition'}. ${match.reasoning}`;
      }
    }
  } catch (e) {
    console.warn("Error loading or parsing dataset.json", e);
  }

  return result;
}
async function Vision(base64Image) {
  const preference = nodes.prefer.value;
  const formData = new FormData();
  
  // 1. Upload to ImgBB (This part is usually fast)
  formData.append("image", base64Image.split(',')[1]);
  console.log('Initiating ImgBB upload...');
  
  const imgbb = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMG_BB}`, {
    method: 'POST',
    body: formData
  });
  const imgbbResponse = await imgbb.json();
  const imageUrl = imgbbResponse.data.url;
  console.log("Image URL:", imageUrl);

  // 2. Tell our backend to START the SerpApi search (Async)
  const serpinit=await fetch(`/search.json?engine=google_lens&url=${imageUrl}&api_key=${process.env.SERP_AI}&preference=${preference}`);
  const Response=await serpinit.json();
  console.log(Response);

  if (!Response.ai_overview?.references) {
    const output=Response.visual_matches.map(item=>item.title).join(", ");
    return output;
  }
  else{
    const output=Response.ai_overview.references.map(item=>item.snippet).join(", ");
    return output;
  }
}

// --- STARTUP ---
init();
