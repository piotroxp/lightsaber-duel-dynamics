import { Group, Vector3, Mesh, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial, Color, AdditiveBlending, SpotLight, Object3D } from 'three';
import { ParticleEmitter } from './effects';
import gameAudio from './audio';

export interface LightsaberOptions {
  color?: string;
  bladeLength?: number;
  hiltLength?: number;
}

export class Lightsaber extends Group {
  declare position: Vector3;
  declare rotateY: (angle: number) => this;
  private bladeColor: string;
  private bladeLength: number;
  private hiltLength: number;
  private active: boolean = false;
  private activationProgress: number = 0;
  private hilt: Mesh;
  private blade: Mesh;
  private bladeLight: SpotLight;
  private glowEmitter: ParticleEmitter | null = null;

  constructor(options: LightsaberOptions = {}) {
    super(); // Call the Group constructor
    
    this.bladeColor = options.color || '#3366ff';
    this.bladeLength = options.bladeLength || 1.2;
    this.hiltLength = options.hiltLength || 0.2;
    
    // Create hilt
    const hiltGeometry = new CylinderGeometry(0.02, 0.025, this.hiltLength, 16);
    const hiltMaterial = new MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.2
    });
    this.hilt = new Mesh(hiltGeometry, hiltMaterial);
    this.hilt.castShadow = true;
    this.hilt.position.y = this.hiltLength / 2;
    this.add(this.hilt);
    
    // Create blade (initially invisible)
    const bladeGeometry = new CylinderGeometry(0.02, 0.01, this.bladeLength, 16);
    const bladeMaterial = new MeshBasicMaterial({
      color: new Color(this.bladeColor),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending
    });
    this.blade = new Mesh(bladeGeometry, bladeMaterial);
    this.blade.position.y = this.hiltLength + this.bladeLength / 2;
    this.add(this.blade);
    
    // Create light for blade glow
    this.bladeLight = new SpotLight(
      this.bladeColor,
      2,
      5,
      Math.PI / 4,
      0.5,
      2
    );
    this.bladeLight.position.y = this.hiltLength;
    this.bladeLight.target.position.y = this.hiltLength + this.bladeLength;
    this.add(this.bladeLight);
    this.add(this.bladeLight.target);
    
    // Disable the light initially
    this.bladeLight.visible = false;
  }
  
  createGlowEmitter(): void {
    // Create particle emitter for blade glow
    this.glowEmitter = new ParticleEmitter({
      maxParticles: 50,
      particleSize: 0.05,
      particleColor: this.bladeColor,
      emissionRate: 20,
      particleLifetime: 0.5,
      gravity: new Vector3(0, 0, 0),
      spread: 0.05
    });
    
    // Position the emitter at the middle of the blade
    this.glowEmitter.position.set(0, this.hiltLength + this.bladeLength / 2, 0);
    this.add(this.glowEmitter);
  }
  
  update(deltaTime: number): void {
    // Update activation animation
    if (this.active && this.activationProgress < 1.0) {
      this.activationProgress += deltaTime * 2; // Fully activate in 0.5 seconds
      if (this.activationProgress > 1.0) this.activationProgress = 1.0;
      this.updateBladeVisuals();
    } else if (!this.active && this.activationProgress > 0.0) {
      this.activationProgress -= deltaTime * 2; // Fully deactivate in 0.5 seconds
      if (this.activationProgress < 0.0) this.activationProgress = 0.0;
      this.updateBladeVisuals();
    }
    
    // Update glow emitter if exists
    if (this.glowEmitter && this.activationProgress > 0) {
      const emissionRate = 20 * this.activationProgress;
      this.glowEmitter.setActive(emissionRate > 0);
    }
  }
  
  private updateBladeVisuals(): void {
    // Update blade material
    const bladeMaterial = this.blade.material as MeshBasicMaterial;
    bladeMaterial.opacity = this.activationProgress * 0.8;
    
    // Scale blade based on activation progress
    this.blade.scale.y = this.activationProgress;
    this.blade.position.y = this.hiltLength + (this.bladeLength * this.activationProgress) / 2;
    
    // Update light intensity
    this.bladeLight.visible = this.activationProgress > 0;
    this.bladeLight.intensity = this.activationProgress * 2;
    
    // Update glow emitter position
    if (this.glowEmitter) {
      this.glowEmitter.position.y = this.hiltLength + (this.bladeLength * this.activationProgress) / 2;
    }
  }
  
  activate(): void {
    if (!this.active) {
      this.active = true;
      
      // Play activation sound
      gameAudio.playSound('lightsaberOn', { volume: 0.5 });
      
      // Create glow emitter if not already created
      if (!this.glowEmitter) {
        this.createGlowEmitter();
      }
    }
  }
  
  deactivate(): void {
    if (this.active) {
      this.active = false;
      
      // Play deactivation sound
      gameAudio.playSound('lightsaberOff', { volume: 0.5 });
    }
  }
  
  isActive(): boolean {
    return this.active;
  }
  
  getColor(): string {
    return this.bladeColor;
  }
  
  playSwingSound(): void {
    gameAudio.playSound('lightsaberSwing', { volume: 0.3 });
  }
  
  playClashSound(): void {
    gameAudio.playSound('lightsaberClash', { volume: 0.7 });
  }
  
  getBladeTopPosition(): Vector3 {
    // Get the position of the tip of the saber in world space
    const tipLocalPosition = new Vector3(0, this.hiltLength + this.bladeLength * this.activationProgress, 0);
    const tipWorldPosition = tipLocalPosition.clone();
    this.localToWorld(tipWorldPosition);
    return tipWorldPosition;
  }
  
  getSaberTipPosition(): Vector3 {
    return this.getBladeTopPosition();
  }
  
  getSaberBasePosition(): Vector3 {
    // Get the position of the base of the blade in world space
    const baseLocalPosition = new Vector3(0, this.hiltLength, 0);
    const baseWorldPosition = baseLocalPosition.clone();
    this.localToWorld(baseWorldPosition);
    return baseWorldPosition;
  }
  
  // Add compatibility with Object3D
  localToWorld(vector: Vector3): Vector3 {
    return vector.applyMatrix4(this.matrixWorld);
  }
}
