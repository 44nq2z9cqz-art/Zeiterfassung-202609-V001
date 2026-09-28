import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

// Kein Pinch-Zoom – iOS ignoriert user-scalable=no teilweise, daher zusätzlich die Geste abfangen
for (const geste of ['gesturestart', 'gesturechange']) {
  document.addEventListener(geste, (e) => e.preventDefault(), { passive: false });
}

const app = mount(App, { target: document.getElementById('app')! });

export default app;
