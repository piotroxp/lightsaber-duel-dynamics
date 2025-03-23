import { Object3D, Vector3 } from 'three';

// Extend Three.js event types with our custom events
declare global {
  namespace THREE {
    interface Object3DEventMap {
      // Add specific event types instead of using index signature
      enemyDied: { position: Vector3 };
      respawned: void;
      damaged: { amount: number };
    }
  }
} 