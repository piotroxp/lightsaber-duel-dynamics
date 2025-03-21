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
    // CRITICAL FIX: Force update blade visuals regardless of activation state
    if (this.active) {
      // Update pulse time
      this.pulseTime += deltaTime;
      
      // Calculate pulse factor (0.8 to 1.0 range)
      const pulseFactor = 0.8 + 0.2 * Math.sin(this.pulseTime * 2);
      
      // Force assign materials directly for immediate effect
      if (this.blade.material instanceof MeshBasicMaterial) {
        this.blade.material.opacity = 0.7 * pulseFactor;
      }
      if (this.bladeCore.material instanceof MeshBasicMaterial) {
        this.bladeCore.material.opacity = 0.9 * pulseFactor;
      }
      if (this.plasmaCore.material instanceof MeshBasicMaterial) {
        this.plasmaCore.material.opacity = pulseFactor;
      }
      
      // Force light to be visible and pulsing
      this.bladeLight.visible = true;
      this.bladeLight.intensity = 2 * this.glowIntensity * pulseFactor;
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
    this.activationProgress = 0;
    
    // Make all blade components visible
    this.blade.visible = true;
    this.bladeCore.visible = true;
    this.plasmaCore.visible = true;
    this.bladeLight.visible = true;
    this.bladeFlare.visible = true;
    
    // Play activation sound
    gameAudio.playSound('lightsaberOn', { volume: 0.7 });
    
    // CRITICAL FIX: Immediately start the glow effect
    // Apply immediate partial glow to make it visible
    (this.blade.material as MeshBasicMaterial).opacity = 0.4;
    (this.bladeCore.material as MeshBasicMaterial).opacity = 0.6;
    (this.plasmaCore.material as MeshBasicMaterial).opacity = 0.8;
    this.bladeLight.intensity = 1.0 * this.glowIntensity;
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
          if (progress < 0.7) {
            // Use the same animation curve as left, but with inverted signs
            this.rotation.x = originalRotation.x - Math.sin(progress * Math.PI) * 0.7; // Inverse of left
            this.rotation.z = originalRotation.z - Math.sin(progress * Math.PI) * 1.0; // Same as left
            this.rotation.y = originalRotation.y - Math.sin(progress * Math.PI * 0.5) * 0.3; // Enhanced from left
            
            // Positional component - mirror the left swing but with tweaked parameters
            this.position.z = originalPosition.z - Math.sin(progress * Math.PI) * 0.35;
            this.position.x = originalPosition.x - Math.sin(progress * Math.PI * 0.5) * 0.08; // Enhanced from left
          } else {
            // Return phase - mirror the left swing return
            const returnProgress = (progress - 0.7) / 0.3;
            
            this.rotation.x = originalRotation.x - Math.sin((1 - returnProgress) * Math.PI) * 0.3;
            this.rotation.z = originalRotation.z - Math.sin((1 - returnProgress) * Math.PI) * 0.4;
            this.rotation.y = originalRotation.y - Math.sin((1 - returnProgress) * Math.PI * 0.5) * 0.15;
            
            this.position.z = originalPosition.z - Math.sin((1 - returnProgress) * Math.PI) * 0.05;
            this.position.x = originalPosition.x - Math.sin((1 - returnProgress) * Math.PI * 0.5) * 0.04;
          }
          break;
          
        case 'left':
          // When moving left, swing from top-left to bottom-right
          if (progress < 0.7) {
            // Rotational component - spherical arc
            this.rotation.x = originalRotation.x - Math.sin(progress * Math.PI) * 0.7;
            this.rotation.z = originalRotation.z + Math.sin(progress * Math.PI) * 1.0;
            this.rotation.y = originalRotation.y + Math.sin(progress * Math.PI * 0.5) * 0.2;
            
            // Positional component - MORE FORWARD THRUST during swing
            this.position.z = originalPosition.z - Math.sin(progress * Math.PI) * 0.35; // Increased from 0.15 to 0.35
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
    
    // FIXED: Move to raised horizontal blocking position (right to left)
    this.rotation.x = originalRotation.x - 0.3; // Tilt up slightly
    this.rotation.z = originalRotation.z + Math.PI / 2; // Turn blade horizontal
    this.rotation.y = originalRotation.y + 0.2; // Angle across body
    
    // Raise position slightly for a higher block
    this.position.y = originalPosition.y + 0.2;
    this.position.z = originalPosition.z - 0.1;
    
    // Reset position when block ends
    setTimeout(() => {
      if (!this.isBlocking) return;
      
      this.rotation.set(originalRotation.x, originalRotation.y, originalRotation.z);
      this.position.set(originalPosition.x, originalPosition.y, originalPosition.z);
      this.isBlocking = false;
    }, 600);
  }
  
  endBlock(): void {
    if (!this.isBlocking) return;
    
    // Reset rotation and position
    this.rotation.set(
      this.initialRotation.x,
      this.initialRotation.y,
      this.initialRotation.z
    );
    
    this.isBlocking = false;
  }

  // Helper methods for color manipulation
  private getHueFromColor(hexColor: string): number {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    let h = 0;
    
    if (max === min) {
      h = 0; // achromatic
    } else {
      const d = max - min;
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return h;
  }

  private getColorFromHSL(h: number, s: number, l: number): string {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return '#' + 
      Math.round(r * 255).toString(16).padStart(2, '0') +
      Math.round(g * 255).toString(16).padStart(2, '0') +
      Math.round(b * 255).toString(16).padStart(2, '0');
  }
}
