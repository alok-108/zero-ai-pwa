# 🚀 Zero AI — Private Offline Multimodal PWA Hub

Zero AI is a **100% private, client-side, offline-first Multimodal PWA** that runs entirely inside your browser. No server bills, no API keys, no collection of user data — **₹0 forever**. 

By leveraging WebGPU, WebAssembly (WASM), and browser-native APIs, Zero AI packs local LLMs, image/video generators, zero-shot object detectors, front-end code sandboxes, and financial stock indicators into a lightweight progressive web application.

---

## 🌟 Key Capabilities

### 1. 💬 Private Offline Chat (Local LLMs)
- **Engine**: Powered by `@mlc-ai/web-llm` running WebGPU-accelerated models locally.
- **Available Models**:
  - **SmolLM2 360M**: Ultra-light (135 MB), ideal for older devices.
  - **Llama 3.2 1B**: Recommended default (1.1 GB) balance of quality and speed.
  - **Qwen 2.5 1.5B**: Optimized for coding and multilingual capabilities.
  - **Phi 3.5 Mini**: Near 7B quality (2.5 GB) for high-performance hardware.
- **RAG Integration**: Index `.txt` and `.md` files locally into an in-memory vector database (`voy-search` + `@xenova/transformers` all-MiniLM embeddings) to retrieve contextual references in chats.

### 2. 🎨 Creative Visual Studio (Image & Video)
- **Image Generation**: Toggle between local WebGPU inference (Stable Diffusion 2.1 base ONNX) or instant cloud-based generation (Flux.1 Schnell via free Hugging Face API).
- **Video Studio**: Generate 2-5 second looping WebM/MP4 videos client-side. The engine takes a text prompt, creates a starting keyframe, translates it through a canvas rendering pipeline with custom camera presets (Zoom In, Pan, Barrel Rotation, Liquid Warp), and records the canvas stream at up to 30 FPS using `MediaRecorder`.

### 3. 🔍 Vision & Video Tracker
- **Static Detection**: Upload images to locate objects using standard DETR ResNet-50.
- **Zero-Shot Queries**: Input open-ended queries (e.g. "red cup, person, keys") to isolate targets using OWL-ViT Base.
- **Video Object Tracking**: Upload `.mp4`/`.webm` videos. The analyzer extracts frames dynamically, runs local object detection, and overlays smooth tracker bounding boxes in real-time on top of the playing video.

### 4. 💻 Coding Assistant & Sandbox
- **Python Editor**: Write and run scripts in-browser via Pyodide WASM. Standard output and exceptions are redirected to a monospace dark terminal console.
- **Web Sandbox**: Live coding playground for HTML/CSS/JS. Executes code in a clean sandboxed `iframe` with live visual previews. Captures and forwards internal iframe `console.log` statements directly back to the terminal console.
- **Interactive Templates**: Preload scripts (e.g. Matrix Digital Rain animations, NumPy analysis walks, SVG interactive particles) and trigger AI assistance directly from Monaco Editor code selections.

### 5. 📈 Stock Market Analyzer (Technical Indicators & Live Feeds)
- **Live Stock Quotes**: Fetch active historical OHLCV chart records (NSE/BSE Indian stocks or indices like `^NSEI`) directly in the browser via a multi-proxy fallback framework (`corsproxy.io` -> `allorigins`).
- **Live Business News**: Google News RSS feeds parsed client-side using `DOMParser` to render company-specific news panels.
- **Technical Indicators**: Toggle SMA 20, EMA 50, and RSI 14 overlays. The RSI oscillator renders in a separate synchronized timeline chart.
- **Comparative Ticker Charting**: Input additional symbols to overlay relative percentage charts.
- **PDF Report Exporters**: Trigger standard print-style formatting to export analysis summaries to PDF.

---

## 🛠️ Technical Stack & Architecture

- **Front-end**: React 19, TypeScript, Vite.
- **Styling**: Vanilla CSS with HSL design tokens, responsive flexgrids, and Framer Motion micro-animations.
- **Local Inference**:
  - LLM: `@mlc-ai/web-llm`
  - Embeddings & Vision: `@xenova/transformers` (Transformers.js)
  - Image Pipeline: `@aislamov/diffusers.js`
- **Data Visualizations**: `chart.js` + `react-chartjs-2`
- **Storage**: IndexedDB via `idb-keyval` for persistent conversations, app configurations, and uploaded RAG text documents.

---

## 🚀 Setup & Execution

### Prerequisites
- Node.js (v18+)
- WebGPU-capable browser (Chrome, Edge, or Opera with hardware acceleration enabled)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/alok-108/zero-ai-pwa.git
   cd zero-ai-pwa
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### Production Build
Compile and generate production bundles and service worker caches:
```bash
npm run build
```

---

## ⚙️ How Client-Side Storage Works
Zero AI caches models inside browser storage namespaces:
1. **WebGPU Shader/Weight Caches**: WebLLM weights are stored in the browser's Cache API. If model files are downloaded once, subsequent loads are instant.
2. **Settings & Chats**: Messages are stored in IndexedDB. No server database is queried.
3. **Bandwidth Savings**: Local models are cached. Cloud generators (Flux.1) run under Hugging Face CDN queries, which require zero local compute storage.

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.
