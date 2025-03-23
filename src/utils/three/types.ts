import { Object3D } from 'three';

// Extend Three.js event types with our custom events
declare global {
  namespace THREE {
    interface Object3DEventMap {
      [key: string]: any; // Allow any string key with any value
    }
  }
} 