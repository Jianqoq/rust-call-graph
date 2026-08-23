import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './index.css';
import { App } from './App.js';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Rust Call Graph webview root is missing.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
