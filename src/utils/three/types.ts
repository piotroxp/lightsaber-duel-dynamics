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

// Define interfaces for game objects with special behaviors
export interface Damageable {
  takeDamage(amount: number, source?: Vector3): void;
}

export interface Destructible {
  destroy(): void;
}

// Type guard functions
export function isDamageable(obj: any): obj is Damageable {
  return obj && typeof obj.takeDamage === 'function';
}

export function isDestructible(obj: any): obj is Destructible {
  return obj && typeof obj.destroy === 'function';
} 