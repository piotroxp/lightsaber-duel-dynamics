
import { Group, Vector3, Mesh, CylinderGeometry, MeshStandardMaterial, SphereGeometry, Object3D, Color } from 'three';
import { ParticleEmitter } from './effects';

export interface LightsaberOptions {
  color?: string;
  bladeLength?: number;
  handleLength?: number;
  handleRadius?: number;
  bladeRadius?: number;
  bladeColor?: string; // Adding this for compatibility
}

export class Lightsaber extends Group {
  private blade: Mesh;
  private handle: Mesh;
  private bladeEmitter: ParticleEmitter | null = null;
  private bladeColor: string;
  private isActive: boolean = false;
  private bladeLength: number;
  private handleLength: number;
  private bladeFullLength: number;
  private bladeCurrentLength: number = 0;
  private activationSpeed: number = 5; // Units per second
  private bladeTarget: Object3D;
  
  constructor(options: LightsaberOptions = {}) {
    super();
    
    this.bladeColor = options.color || options.bladeColor || '#3366ff';
    this.bladeLength = options.bladeLength || 1.0;
    this.handleLength = options.handleLength || 0.2;
    const handleRadius = options.handleRadius || 0.025;
    const bladeRadius = options.bladeRadius || 0.015;
    
    this.bladeFullLength = this.bladeLength;
    
    // Create handle
    const handleGeometry = new CylinderGeometry(
      handleRadius,
      handleRadius,
      this.handleLength,
      16, 1, false
    );
    const handleMaterial = new MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.7,
      metalness: 0.8
    });
    this.handle = new Mesh(handleGeometry, handleMaterial);
    this.handle.castShadow = true;
    
    // Create blade (initially invisible with zero length)
    const bladeGeometry = new CylinderGeometry(
      bladeRadius,
      bladeRadius,
      0.001, // Start with minimal length
      16, 1, false
    );
    const bladeMaterial = new MeshStandardMaterial({
      color: new Color(this.bladeColor),
      emissive: new Color(this.bladeColor),
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.7
    });
    this.blade = new Mesh(bladeGeometry, bladeMaterial);
    this.blade.castShadow = true;
    
    // Position handle at the bottom
    this.handle.position.y = 0;
    this.add(this.handle);
    
    // Position blade on top of handle
    this.blade.position.y = this.handleLength / 2;
    this.add(this.blade);
    
    // Create blade tip target for tracking
    this.bladeTarget = new Object3D();
    this.bladeTarget.position.y = this.handleLength / 2 + this.bladeFullLength;
    this.add(this.bladeTarget);
    
    // Create emitter at blade tip (will be active only when blade is on)
    const emitter = new ParticleEmitter({
      maxParticles: 100,
      particleSize: 0.03,
      particleColor: this.bladeColor,
      emissionRate: 10,
      particleLifetime: 0.3,
      gravity: new Vector3(0, 0, 0),
      spread: 0.1
    });
    emitter.position.y = this.handleLength / 2 + this.bladeFullLength;
    this.add(emitter);
    this.bladeEmitter = emitter;
    this.bladeEmitter.setActive(false);
  }
  
  activate(): void {
    if (!this.isActive) {
      this.isActive = true;
      
      // If we have an emitter, activate it
      if (this.bladeEmitter) {
        this.bladeEmitter.setActive(true);
      }
    }
  }
  
  // Alias for activate for compatibility with player.ts
  activateBlade(): void {
    this.activate();
  }
  
  deactivate(): void {
    if (this.isActive) {
      this.isActive = false;
      
      // If we have an emitter, deactivate it
      if (this.bladeEmitter) {
        this.bladeEmitter.setActive(false);
      }
    }
  }
  
  update(deltaTime: number): void {
    // Handle lightsaber activation/deactivation animations
    if (this.isActive && this.bladeCurrentLength < this.bladeFullLength) {
      // Extend the blade
      this.bladeCurrentLength += this.activationSpeed * deltaTime;
      if (this.bladeCurrentLength > this.bladeFullLength) {
        this.bladeCurrentLength = this.bladeFullLength;
      }
      
      this.updateBladeGeometry();
    } else if (!this.isActive && this.bladeCurrentLength > 0) {
      // Retract the blade
      this.bladeCurrentLength -= this.activationSpeed * deltaTime;
      if (this.bladeCurrentLength < 0) {
        this.bladeCurrentLength = 0;
      }
      
      this.updateBladeGeometry();
    }
    
    // Update emitter position to blade tip
    if (this.bladeEmitter) {
      this.bladeEmitter.position.y = this.handleLength / 2 + this.bladeCurrentLength;
    }
    
    // Update blade target
    this.bladeTarget.position.y = this.handleLength / 2 + this.bladeCurrentLength;
  }
  
  // Add method for creating trail when saber moves - used by Player
  updateTrail(position: Vector3, isMoving: boolean): void {
    // Would implement trail effect, but for now just a stub
    if (isMoving && this.isActive) {
      // Trail effect would go here
    }
  }
  
  // Add swing method for Player
  swing(intensity: number = 1.0): void {
    // Would implement swing effect/sound, but for now just a stub
    console.log(`Lightsaber swing with intensity ${intensity}`);
  }
  
  // Add clash method for Player
  clash(): void {
    // Would implement clash effect/sound, but for now just a stub
    console.log('Lightsaber clash');
  }
  
  private updateBladeGeometry(): void {
    // Create new geometry for the blade with the current length
    const bladeGeometry = new CylinderGeometry(
      0.015, // Blade radius
      0.015,
      this.bladeCurrentLength,
      16, 1, false
    );
    
    // Replace the blade geometry
    this.blade.geometry.dispose();
    this.blade.geometry = bladeGeometry;
    
    // Update blade position so the bottom stays at the handle
    this.blade.position.y = this.handleLength / 2 + this.bladeCurrentLength / 2;
  }
  
  setColor(color: string): void {
    this.bladeColor = color;
    
    // Update blade material
    const bladeMaterial = this.blade.material as MeshStandardMaterial;
    bladeMaterial.color.set(color);
    bladeMaterial.emissive.set(color);
    
    // Update emitter color if we have one
    if (this.bladeEmitter) {
      this.bladeEmitter.setColor(color);
    }
  }
  
  getBladeTopPosition(): Vector3 {
    const topPosition = new Vector3(0, this.handleLength / 2 + this.bladeCurrentLength, 0);
    return this.localToWorld(topPosition.clone());
  }
  
  getBladeBasePosition(): Vector3 {
    const basePosition = new Vector3(0, this.handleLength / 2, 0);
    return this.localToWorld(basePosition.clone());
  }
  
  // Add method to match expected call in player.ts
  getBladeEndPosition(): Vector3 {
    return this.getBladeTopPosition();
  }
  
  getSaberTipPosition(): Vector3 {
    return this.getBladeTopPosition();
  }
  
  isLightsaberActive(): boolean {
    return this.isActive;
  }
}
