import { Group, Vector3, Mesh, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial, Color, AdditiveBlending, SpotLight, Object3D, PointLight } from 'three';
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
  private bladeLight: PointLight;
  private glowEmitter: ParticleEmitter | null = null;
  private isSwinging: boolean = false;
  private isBlocking: boolean = false;
  private initialRotation = { x: 0, y: 0, z: 0 };
  private swingAnimation: number | null = null;

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
    this.bladeLight = new PointLight(this.bladeColor, 1, 2);
    this.bladeLight.position.y = this.hiltLength + this.bladeLength / 2;
    this.add(this.bladeLight);
    
    // Disable the light initially
    this.bladeLight.visible = false;
    
    // Store initial rotation
    this.initialRotation = { 
      x: this.rotation.x,
      y: this.rotation.y,
      z: this.rotation.z
    };
    
    // Set name for debugging
    this.name = 'lightsaber';
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
    if (this.active) return;
    
    this.active = true;
    
    // Play activation sound
    gameAudio.playSound('lightsaberOn', { volume: 0.7 });
    
    // Animate blade appearance
    const startTime = Date.now();
    const duration = 300; // ms
    let progress = 0;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      
      // Update blade visibility
      if (this.blade.material instanceof MeshBasicMaterial) {
        this.blade.material.opacity = progress * 0.8;
      }
      
      // Grow blade from hilt
      this.blade.scale.set(1, progress, 1);
      
      // Enable light when partially extended
      if (progress > 0.3 && !this.bladeLight.visible) {
        this.bladeLight.visible = true;
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // When fully activated, play the hum sound
        gameAudio.playSound('lightsaberHum', { loop: true, volume: 0.3 });
      }
    };
    
    // Start animation
    animate();
  }
  
  deactivate(): void {
    if (!this.active) return;
    
    // Play deactivation sound
    gameAudio.playSound('lightsaberOff', { volume: 0.5 });
    
    // Animate blade disappearance
    const startTime = Date.now();
    const duration = 200; // ms
    let progress = 0;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      
      // Update blade visibility
      if (this.blade.material instanceof MeshBasicMaterial) {
        this.blade.material.opacity = (1 - progress) * 0.8;
      }
      
      // Shrink blade into hilt
      this.blade.scale.set(1, 1 - progress, 1);
      
      // Disable light when mostly retracted
      if (progress > 0.7 && this.bladeLight.visible) {
        this.bladeLight.visible = false;
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.active = false;
      }
    };
    
    // Start animation
    animate();
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
    // Calculate the position of the top of the blade in world space
    const bladeTop = new Vector3(0, this.hiltLength + this.bladeLength, 0); // Local position of blade top
    return this.localToWorld(bladeTop.clone());
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
  
  swing(): void {
    if (!this.active || this.isSwinging) return;
    
    this.isSwinging = true;
    
    // Play swing sound
    gameAudio.playSound('lightsaberSwing', { volume: 0.5 });
    
    // Store original rotation
    const originalRotation = {
      x: this.rotation.x,
      y: this.rotation.y,
      z: this.rotation.z
    };
    
    // Set up swing animation
    const startTime = Date.now();
    const duration = 300; // ms
    let progress = 0;
    
    if (this.swingAnimation) {
      cancelAnimationFrame(this.swingAnimation);
    }
    
    const animateSwing = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      
      // Swing motion - adjust these values for desired swing effect
      if (progress < 0.5) {
        // Forward swing
        this.rotation.z = originalRotation.z - Math.sin(progress * Math.PI) * 1.2;
      } else {
        // Return swing
        this.rotation.z = originalRotation.z - Math.sin((1 - progress) * Math.PI) * 0.5;
      }
      
      if (progress < 1) {
        this.swingAnimation = requestAnimationFrame(animateSwing);
      } else {
        // Reset rotation when done
        this.rotation.set(originalRotation.x, originalRotation.y, originalRotation.z);
        this.isSwinging = false;
        this.swingAnimation = null;
      }
    };
    
    // Start the animation
    this.swingAnimation = requestAnimationFrame(animateSwing);
  }
  
  block(): void {
    if (!this.active || this.isBlocking) return;
    
    this.isBlocking = true;
    
    // Play block sound
    gameAudio.playSound('lightsaberMove', { volume: 0.5 });
    
    // Position lightsaber in defensive position
    const originalRotation = {
      x: this.rotation.x,
      y: this.rotation.y,
      z: this.rotation.z
    };
    
    // Horizontal blocking position
    this.rotation.z = originalRotation.z + Math.PI / 2;
    
    // Reset after a short delay
    setTimeout(() => {
      this.rotation.set(originalRotation.x, originalRotation.y, originalRotation.z);
      this.isBlocking = false;
    }, 200);
  }
}
