/**
 * GeoSpy - Simplified Intelligence Pipeline
 * This script handles the frontend logic for an application that identifies the location of an uploaded image.
 * Simplified Pipeline:
 * 1. Try Gemini AI (Visual Analysis)
 * 2. If AI fails, try Tensor Flow dataset
 */

import { GoogleGenAI, Type } from "@google/genai";
import L from "leaflet";

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
    const preference = nodes.prefer.value;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
          { text: `Locate this image. Be precise. prefer ${preference}, Return a JSON object with lat, lng, city, country, confidence, and reasoning.`}
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA
      }
    });

    const parsed = JSON.parse(aiResponse.text);
    if (parsed.lat && parsed.lng) {
      return { ...parsed, source: 'Gemini-3-Flash AI' };
    }
  } catch (e) {
    console.warn("AI Analysis failed, trying other models", e);
  
    // Fallback: Try Secondary Model
    try {
      const preference = nodes.prefer.value;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
            { text: `Locate this image. Be precise. prefer ${preference}, Return a JSON object with lat, lng, city, country, confidence, and reasoning.`}
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA
        }
      });
      const parsed = JSON.parse(aiResponse.text);
      if (parsed.lat && parsed.lng) {
        return { ...parsed, source: 'Gemini-2.5-Flash AI' };
      }
    } catch (err) {
      console.warn("Secondary AI failed", err);
    }
  }
  
  // 3. Fallback: Local Object Detection (TensorFlow.js)
  try {
    nodes.statusMessage.innerText="local test begins";
    const data = await runLocalObjectAnalysis(nodes.previewImg);
    return data;
  } 
  catch (e) {
    console.warn("Local AI failed", e);
  }

 
  
}

// --- UI & RENDERING ---

/**
 * Renders the final results of the analysis in the sidebar.
 *  The analysis result data.
 */
function renderResults(data) {
  if(data.confidence < 0.3){
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
async function runLocalObjectAnalysis(imgElement) {
  // Load the model (this loads from CDN the first time, then caches)
  const model = await cocoSsd.load();
  console.log("local test begins");
  nodes.statusMessage.innerText="Running Local Test";
  // Detect objects
  const predictions = await model.detect(imgElement);
  
  if (!predictions || predictions.length === 0) {
    throw new Error("No objects detected locally.");
  }

  // Extract unique objects found
  const objects = predictions.map(p => p.class);
  const uniqueObjects = [...new Set(objects)];
  
  // Heuristic state.mapping: Guess location based on object context
  let lat = 48.8566, lng = 2.3522, city = "Populated Area", country = "Inferred from Objects", reasoning = "", confidence=0.5;
  reasoning = `Local AI detected: ${uniqueObjects.join(', ')}. Scene contains common objects indicating human presence.`;

  try {
    const response = await fetch('./dataset.json', { cache: "no-store" });
    if (response.ok) {
      const dataset = await response.json(); // This is an object, not an array.
      
      // Debug: Log detected objects to help match dataset keys
      console.log("Local AI Detected:", uniqueObjects);
      console.log("Dataset Keys:", Object.keys(dataset));

      // Find the first detected object that exists as a key in our dataset
      const matchedKey = uniqueObjects.find(obj => dataset[obj]);

      if (matchedKey) {
        console.log("Applying match for:", matchedKey);
        const match = dataset[matchedKey];
        lat = match.lat;
        lng = match.lng;
        city = match.city;
        country = match.country;
        reasoning = `Local AI detected '${matchedKey}'. ${match.reasoning}`;
      } else {
        console.warn("No matching object found in dataset.json. Using defaults.");
        const match = dataset["auto_rickshaw"];
        lat = match.lat;
        lng = match.lng;
        city = match.city;
        country = match.country;
        reasoning = `Local AI detected '${matchedKey}'. ${match.reasoning}`;
      }
    }
  } catch (e) {
    console.warn("Error loading or parsing dataset.json", e);
  }

  return {
    source: 'Fallback: Local TensorFlow.js',
    lat, lng, city, country,
    confidence: 0.4, // Low confidence because it's a heuristic
    reasoning,
    visualAnalysisSummary: `Browser-based Neural Network identified: ${uniqueObjects.join(', ')}.`
  };
}
// --- STARTUP ---
init();
