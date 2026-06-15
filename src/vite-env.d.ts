/// <reference types="vite/client" />

// Allow CSS imports
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Allow SVG imports
declare module '*.svg' {
  const content: string;
  export default content;
}

// Allow image imports  
declare module '*.png' {
  const content: string;
  export default content;
}

declare module '@aislamov/diffusers.js';
