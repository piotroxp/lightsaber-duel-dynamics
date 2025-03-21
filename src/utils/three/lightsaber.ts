import { Group, Vector3, Mesh, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial, Color, AdditiveBlending, SpotLight, Object3D, PointLight, SphereGeometry } from 'three';
import { ParticleEmitter } from './effects';
import gameAudio from './audio';

export interface LightsaberOptions {
  color?: string;
  bladeLength?: number;
  hiltLength?: number;
  glowIntensity?: number;
}

export class Lightsaber extends Group {
  declare position: Vector3;
  declare rotateY: (angle: number) => this;
  private bladeColor: string;
  private bladeLength: number;
  private hiltLength: number;
  private glowIntensity: number;
  private active: boolean = false;
  private activationProgress: number = 0;
  private hilt: Mesh;
  private blade: Mesh;
  private bladeCore: Mesh;
  private plasmaCore: Mesh;
  private bladeLight: PointLight;
  private glowEmitter: ParticleEmitter | null = null;
  private isSwinging: boolean = false;
  private isBlocking: boolean = false;
  private initialRotation = { x: 0, y: 0, z: 0 };
  private swingAnimation: number | null = null;
  private bladeFlare: Mesh;
  private pulseTime: number = 0;

  constructor(options: LightsaberOptions = {}) {
    super();
    
    this.bladeColor = options.color || '#3366ff';
    this.bladeLength = options.bladeLength || 1.2;
    this.hiltLength = options.hiltLength || 0.25; // Slightly longer for more detail
    this.glowIntensity = options.glowIntensity || 1.0;
    
    // Create hilt group to contain all hilt components
    const hiltGroup = new Group();
    this.add(hiltGroup);
    
    // Create main hilt body
    const hiltGeometry = new CylinderGeometry(0.022, 0.025, this.hiltLength, 16);
    const hiltMaterial = new MeshStandardMaterial({
      color: 0x303030, // Darker metal
      metalness: 0.9,
      roughness: 0.2
    });
    this.hilt = new Mesh(hiltGeometry, hiltMaterial);
    this.hilt.castShadow = true;
    this.hilt.position.y = this.hiltLength / 2;
    hiltGroup.add(this.hilt);
    
    // Add etched rings along the hilt for futuristic detail
    const addEtchedRing = (y: number, radiusTop: number, radiusBottom: number, height: number, color: number, emissive: boolean = false) => {
      const ringGeometry = new CylinderGeometry(radiusTop, radiusBottom, height, 16);
      const ringMaterial = new MeshStandardMaterial({
        color: color,
        metalness: 0.9,
        roughness: 0.1,
        emissive: emissive ? color : 0x000000,
        emissiveIntensity: emissive ? 0.5 : 0
      });
      const ring = new Mesh(ringGeometry, ringMaterial);
      ring.position.y = y;
      hiltGroup.add(ring);
      return ring;
    };
    
    // Add multiple etched rings for detail
    addEtchedRing(this.hiltLength * 0.85, 0.026, 0.026, 0.01, 0x222222);
    addEtchedRing(this.hiltLength * 0.7, 0.0265, 0.0265, 0.015, 0x777777);
    addEtchedRing(this.hiltLength * 0.6, 0.027, 0.027, 0.01, 0x222222);
    
    // Activation button with emissive material
    addEtchedRing(this.hiltLength * 0.5, 0.028, 0.028, 0.02, parseInt(this.bladeColor.replace('#', '0x')), true);
    
    // Lower rings
    addEtchedRing(this.hiltLength * 0.35, 0.0265, 0.0265, 0.01, 0x222222);
    addEtchedRing(this.hiltLength * 0.25, 0.026, 0.026, 0.015, 0x777777);
    
    // Add pommel at the bottom
    const pommelGeometry = new CylinderGeometry(0.027, 0.023, 0.04, 16);
    const pommelMaterial = new MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.9,
      roughness: 0.3
    });
    const pommel = new Mesh(pommelGeometry, pommelMaterial);
    pommel.position.y = 0.02; // Just above the bottom
    hiltGroup.add(pommel);
    
    // Create blade (colored outer glow) with more translucency
    const bladeGeometry = new CylinderGeometry(0.025, 0.015, this.bladeLength, 16);
    const bladeMaterial = new MeshBasicMaterial({
      color: new Color(this.bladeColor),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false // Make outer blade not write to depth buffer
    });
    this.blade = new Mesh(bladeGeometry, bladeMaterial);
    this.blade.position.y = this.hiltLength + this.bladeLength / 2;
    this.add(this.blade);
    
    // Improve core visibility with larger radius and brighter color
    const coreGeometry = new CylinderGeometry(0.015, 0.01, this.bladeLength * 0.98, 16);
    const coreMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.bladeCore = new Mesh(coreGeometry, coreMaterial);
    this.bladeCore.position.y = this.hiltLength + this.bladeLength / 2;
    this.add(this.bladeCore);
    
    // Make plasma core more visible
    const plasmaGeometry = new CylinderGeometry(0.008, 0.005, this.bladeLength * 0.96, 16);
    const plasmaMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.plasmaCore = new Mesh(plasmaGeometry, plasmaMaterial);
    this.plasmaCore.position.y = this.hiltLength + this.bladeLength / 2;
    this.add(this.plasmaCore);
    
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
    
    // Create blade flare at the tip
    const flareGeometry = new SphereGeometry(0.03, 16, 16);
    const flareMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending
    });
    this.bladeFlare = new Mesh(flareGeometry, flareMaterial);
    this.bladeFlare.position.y = this.hiltLength + this.bladeLength;
    this.add(this.bladeFlare);
    
    // Make blade light more intense
    this.bladeLight.intensity = 2 * this.glowIntensity;
    this.bladeLight.distance = 3;
    
    // Add a second light for better glow
    const secondaryLight = new PointLight(this.bladeColor, 1 * this.glowIntensity, 1.5);
    secondaryLight.position.y = this.hiltLength + this.bladeLength * 0.7;
    this.add(secondaryLight);
  }
  
  createGlowEmitter(): void {
    // Create particle emitter for blade glow
    this.glowEmitter = new ParticleEmitter({
      count: 50,
      size: 0.05,
      color: parseInt(this.bladeColor.replace('#', '0x')),
      lifetime: 0.5,
      speed: 0.5,
      direction: new Vector3(0, 0, 0),
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
      // Control emission rate based on activation
      if (this.activationProgress > 0) {
        this.glowEmitter.start();
      } else {
        this.glowEmitter.stop();
      }
    }
    
    // Add subtle pulsing effect to the blade
    if (this.active) {
      this.pulseTime += deltaTime * 2;
      const pulseAmount = Math.sin(this.pulseTime) * 0.1 + 0.9;
      
      // Apply pulse to blade and core opacity
      if (this.blade.material instanceof MeshBasicMaterial) {
        this.blade.material.opacity = this.activationProgress * 0.7 * pulseAmount;
      }
      
      if (this.bladeCore.material instanceof MeshBasicMaterial) {
        this.bladeCore.material.opacity = this.activationProgress * 1.0 * pulseAmount;
      }
      
      if (this.plasmaCore.material instanceof MeshBasicMaterial) {
        this.plasmaCore.material.opacity = this.activationProgress * 1.2 * pulseAmount;
        
        // Add random flickering to plasma core for energy effect
        if (Math.random() > 0.7) {
          this.plasmaCore.material.opacity *= 0.8 + Math.random() * 0.4;
        }
      }
      
      // Pulse the light intensity too
      this.bladeLight.intensity = 2 * this.glowIntensity * pulseAmount;
    }
  }
  
  private updateBladeVisuals(): void {
    // Update blade material - reduce opacity for more translucency
    const bladeMaterial = this.blade.material as MeshBasicMaterial;
    bladeMaterial.opacity = this.activationProgress * 0.5; // More translucent
    
    // Update core material with higher opacity
    const coreMaterial = this.bladeCore.material as MeshBasicMaterial;
    coreMaterial.opacity = this.activationProgress * 1.2; // More visible
    
    // Update plasma core with even higher opacity
    const plasmaMaterial = this.plasmaCore.material as MeshBasicMaterial;
    plasmaMaterial.opacity = this.activationProgress * 1.5; // Very bright
    
    // Scale blade based on activation progress
    this.blade.scale.y = this.activationProgress;
    this.blade.position.y = this.hiltLength + (this.bladeLength * this.activationProgress) / 2;
    
    // Scale cores based on activation progress
    this.bladeCore.scale.y = this.activationProgress;
    this.bladeCore.position.y = this.hiltLength + (this.bladeLength * this.activationProgress) / 2;
    
    this.plasmaCore.scale.y = this.activationProgress;
    this.plasmaCore.position.y = this.hiltLength + (this.bladeLength * this.activationProgress) / 2;
    
    // Update light intensity
    this.bladeLight.visible = this.activationProgress > 0;
    this.bladeLight.intensity = this.activationProgress * 2;
    
    // Update glow emitter position
    if (this.glowEmitter) {
      this.glowEmitter.position.y = this.hiltLength + (this.bladeLength * this.activationProgress) / 2;
    }
    
    // Update blade flare
    if (this.bladeFlare.material instanceof MeshBasicMaterial) {
      this.bladeFlare.material.opacity = this.activationProgress * 0.8;
      this.bladeFlare.position.y = this.hiltLength + (this.bladeLength * this.activationProgress);
      
      // Scale flare with activation
      const flareScale = this.activationProgress * 1.2;
      this.bladeFlare.scale.set(flareScale, flareScale, flareScale);
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
      
      // Update blade and cores visibility
      if (this.blade.material instanceof MeshBasicMaterial) {
        this.blade.material.opacity = progress * 0.5; // Translucent outer blade
      }
      
      if (this.bladeCore.material instanceof MeshBasicMaterial) {
        this.bladeCore.material.opacity = progress * 1.2; // Bright core
      }
      
      if (this.plasmaCore.material instanceof MeshBasicMaterial) {
        this.plasmaCore.material.opacity = progress * 1.5; // Very bright plasma
      }
      
      // Grow blade and cores from hilt
      this.blade.scale.set(1, progress, 1);
      this.blade.position.y = this.hiltLength + (this.bladeLength * progress) / 2;
      
      this.bladeCore.scale.set(1, progress, 1);
      this.bladeCore.position.y = this.hiltLength + (this.bladeLength * progress) / 2;
      
      this.plasmaCore.scale.set(1, progress, 1);
      this.plasmaCore.position.y = this.hiltLength + (this.bladeLength * progress) / 2;
      
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
  
  swing(movementDirection: 'left' | 'right' | 'forward' | 'none' = 'none'): void {
    if (!this.active || this.isSwinging) return;
    
    this.isSwinging = true;
    
    // Play swing sound
    gameAudio.playSound('lightsaberSwing', { volume: 0.5 });
    
    // Store original position and rotation
    const originalRotation = {
      x: this.rotation.x,
      y: this.rotation.y,
      z: this.rotation.z
    };
    
    const originalPosition = {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z
    };
    
    // Set up swing animation
    const startTime = Date.now();
    const duration = 350; // slightly longer for more fluid motion
    let progress = 0;
    
    if (this.swingAnimation) {
      cancelAnimationFrame(this.swingAnimation);
    }
    
    const animateSwing = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      
      // Apply different swing animations based on movement direction
      switch (movementDirection) {
        case 'right':
          // When moving right, swing from top-right to bottom-left
          if (progress < 0.7) {
            // Rotational component - spherical arc
            this.rotation.x = originalRotation.x + Math.sin(progress * Math.PI) * 0.7;
            this.rotation.z = originalRotation.z - Math.sin(progress * Math.PI) * 1.0;
            this.rotation.y = originalRotation.y - Math.sin(progress * Math.PI * 0.5) * 0.2;
            
            // Positional component - thrust forward during swing
            this.position.z = originalPosition.z - Math.sin(progress * Math.PI) * 0.15;
            this.position.x = originalPosition.x - Math.sin(progress * Math.PI * 0.5) * 0.05;
          } else {
            // Return phase
            const returnProgress = (progress - 0.7) / 0.3;
            
            // Smoothly return to original position and rotation
            this.rotation.x = originalRotation.x + Math.sin((1 - returnProgress) * Math.PI) * 0.3;
            this.rotation.z = originalRotation.z - Math.sin((1 - returnProgress) * Math.PI) * 0.4;
            this.rotation.y = originalRotation.y - Math.sin((1 - returnProgress) * Math.PI * 0.5) * 0.1;
            
            // Return position
            this.position.z = originalPosition.z - Math.sin((1 - returnProgress) * Math.PI) * 0.05;
            this.position.x = originalPosition.x - Math.sin((1 - returnProgress) * Math.PI * 0.5) * 0.02;
          }
          break;
          
        case 'left':
          // When moving left, swing from top-left to bottom-right
          if (progress < 0.7) {
            // Rotational component - spherical arc
            this.rotation.x = originalRotation.x - Math.sin(progress * Math.PI) * 0.7;
            this.rotation.z = originalRotation.z + Math.sin(progress * Math.PI) * 1.0;
            this.rotation.y = originalRotation.y + Math.sin(progress * Math.PI * 0.5) * 0.2;
            
            // Positional component - thrust forward during swing
            this.position.z = originalPosition.z - Math.sin(progress * Math.PI) * 0.15;
            this.position.x = originalPosition.x + Math.sin(progress * Math.PI * 0.5) * 0.05;
          } else {
            // Return phase
            const returnProgress = (progress - 0.7) / 0.3;
            
            // Smoothly return to original position and rotation
            this.rotation.x = originalRotation.x - Math.sin((1 - returnProgress) * Math.PI) * 0.3;
            this.rotation.z = originalRotation.z + Math.sin((1 - returnProgress) * Math.PI) * 0.4;
            this.rotation.y = originalRotation.y + Math.sin((1 - returnProgress) * Math.PI * 0.5) * 0.1;
            
            // Return position
            this.position.z = originalPosition.z - Math.sin((1 - returnProgress) * Math.PI) * 0.05;
            this.position.x = originalPosition.x + Math.sin((1 - returnProgress) * Math.PI * 0.5) * 0.02;
          }
          break;
          
        case 'forward':
        case 'none':
        default:
          // When static or moving forward, diagonal swing from top to bottom-forward
          if (progress < 0.7) {
            // Create a forward slashing motion (away from player)
            this.rotation.x = originalRotation.x - Math.sin(progress * Math.PI) * 1.0;
            this.rotation.z = originalRotation.z + Math.sin(progress * Math.PI * 0.5) * 0.4;
            this.rotation.y = originalRotation.y + Math.sin(progress * Math.PI * 0.7) * 0.3;
            
            // Add forward thrust (more exaggerated)
            this.position.z = originalPosition.z - Math.sin(progress * Math.PI) * 0.25;
          } else {
            // Return phase
            const returnProgress = (progress - 0.7) / 0.3;
            
            this.rotation.x = originalRotation.x - Math.sin((1 - returnProgress) * Math.PI) * 0.5;
            this.rotation.z = originalRotation.z + Math.sin((1 - returnProgress) * Math.PI * 0.5) * 0.2;
            this.rotation.y = originalRotation.y + Math.sin((1 - returnProgress) * Math.PI * 0.7) * 0.1;
            
            // Return position
            this.position.z = originalPosition.z - Math.sin((1 - returnProgress) * Math.PI) * 0.07;
          }
          break;
      }
      
      if (progress < 1) {
        this.swingAnimation = requestAnimationFrame(animateSwing);
      } else {
        // Reset rotation and position when done
        this.rotation.set(originalRotation.x, originalRotation.y, originalRotation.z);
        this.position.set(originalPosition.x, originalPosition.y, originalPosition.z);
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
