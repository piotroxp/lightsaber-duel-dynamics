import { Group, Vector3, Mesh, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial, Color, AdditiveBlending, SpotLight, Object3D, PointLight, SphereGeometry, DoubleSide, Scene } from 'three';
import { ParticleEmitter, createLightsaberGlow, createHitEffect } from './effects';
import gameAudio from './audio';
import { isDamageable, isDestructible } from './types';

export interface LightsaberOptions {
  color?: string;
  bladeLength?: number;
  hiltLength?: number;
  glowIntensity?: number;
  scene?: Scene;
}

export class Lightsaber extends Group {
  declare position: Vector3;
  declare rotateY: (angle: number) => this;
  private scene: Scene | null = null;
  private bladeColor: string;
  private bladeLength: number;
  private hiltLength: number;
  private glowIntensity: number;
  private active: boolean = false;
  private activationProgress: number = 0;
  private hilt: Mesh;
  private blade: Group;
  private bladeMesh: Mesh;
  private bladeCore: Mesh;
  private plasmaCore: Mesh;
  private bladeLight: PointLight;
  private glowEmitter: ParticleEmitter | null = null;
  public isSwinging: boolean = false;
  private isBlocking: boolean = false;
  private initialRotation = { x: 0, y: 0, z: 0 };
  private swingAnimation: number | null = null;
  private bladeFlare: Mesh | null = null;
  private pulseTime: number = 0;
  private prevPosition: Vector3 = new Vector3();
  private velocity: Vector3 = new Vector3();
  private acceleration: Vector3 = new Vector3();
  private rotationalInertia: Vector3 = new Vector3();
  private swingPhase: number = 0;
  private swingDirectionVector: Vector3 = new Vector3(1, 0, 0);
  private swingDamping: number = 0.92;
  private bladeSegments: (Mesh | Group)[] = [];
  
  // Swing mechanics
  private swingState: 'idle' | 'windup' | 'strike' | 'recovery' = 'idle';
  private swingType: 'light' | 'heavy' | 'none' = 'none';
  private swingDirection: 'horizontal' | 'vertical' | 'diagonal' = 'horizontal';
  private swingProgress: number = 0;
  private swingDuration: number = 0;
  private swingStartTime: number = 0;
  private comboCount: number = 0;
  private lastSwingTime: number = 0;
  private comboResetTime: number = 0.5; // Time in seconds to reset combo
  private swingCooldown: number = 0;
  
  // Damage properties
  private lightAttackDamage: number = 20;
  private heavyAttackDamage: number = 50;
  private lightAttackDuration: number = 0.4;
  private heavyAttackDuration: number = 0.7;
  private lightAttackCooldown: number = 0.1;
  private heavyAttackCooldown: number = 0.2;
  
  // Block properties
  private blockDamageReduction: number = 0.8; // 80% damage reduction
  
  // Hitbox
  private hitboxActive: boolean = false;
  private hitboxRadius: number = 0.05;
  private hitTargets: Set<Object3D> = new Set();

  private debugMode: boolean = true;

  constructor(options: LightsaberOptions = {}) {
    super();
    
    this.bladeColor = options.color || '#3366ff';
    this.bladeLength = options.bladeLength || 1.2;
    this.hiltLength = options.hiltLength || 0.3; // Updated to match spec
    this.glowIntensity = options.glowIntensity || 1.0;
    this.scene = options.scene || null;
    
    // Initialize properties to prevent null reference errors
    this.glowEmitter = null;
    this.bladeFlare = null;
    
    // Store initial position for physics
    this.prevPosition.copy(this.position);
    
    // Center the lightsaber in the scene
    this.position.set(0, 0, 0);
    
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
    // Use blade color for some of the rings
    const colorValue = parseInt(this.bladeColor.replace('#', '0x'));
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
    this.createBlade();
    
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
    if (!this.active) return;
    
    // Update cooldowns
    if (this.swingCooldown > 0) {
      this.swingCooldown -= deltaTime;
    }
    
    // Check for combo reset
    if (this.comboCount > 0 && this.swingState === 'idle') {
      const currentTime = performance.now() / 1000;
      if (currentTime - this.lastSwingTime > this.comboResetTime) {
        this.comboCount = 0;
      }
    }
    
    // Update pulse time
    this.pulseTime += deltaTime * 5; // Adjust speed of pulsation
    
    // Calculate pulse effect (subtle sine wave)
    const pulseAmount = Math.sin(this.pulseTime) * 0.05 + 0.95; // Reduced variation
    
    // Apply pulse to blade opacity and scale
    if (this.bladeMesh && this.bladeMesh.material instanceof MeshBasicMaterial) {
      this.bladeMesh.material.opacity = 0.85 + Math.sin(this.pulseTime * 1.5) * 0.05;
    }
    
    if (this.bladeCore && this.bladeCore.material instanceof MeshBasicMaterial) {
      this.bladeCore.material.opacity = 0.9 + Math.sin(this.pulseTime * 1.2) * 0.05;
    }
    
    // Apply subtle scale pulsing
    this.bladeMesh.scale.x = pulseAmount * 0.98 + 0.02;
    this.bladeMesh.scale.z = pulseAmount * 0.98 + 0.02;
    
    // Update blade light intensity with subtle pulsation
    if (this.bladeLight) {
      this.bladeLight.intensity = (1.0 + Math.sin(this.pulseTime * 2) * 0.1) * this.glowIntensity;
    }
    
    // Update glow emitter if it exists
    if (this.glowEmitter) {
      // Update position to follow the blade tip
      this.glowEmitter.position.copy(this.localToWorld(new Vector3(0, this.hiltLength + this.bladeLength, 0)));
    }
    
    // Increase brightness dramatically during swing
    if (this.bladeLight) {
      if (this.swingState === 'strike') {
        this.bladeLight.intensity = 1.8 * this.glowIntensity;
        this.bladeLight.distance = 2.5;
      } else if (this.swingState === 'windup' || this.swingState === 'recovery') {
        this.bladeLight.intensity = 1.4 * this.glowIntensity;
        this.bladeLight.distance = 2.2;
      }
    }
    
    // Update physics
    this.updateBladePhysics(deltaTime);
    
    // Update particle effects
    if (this.glowEmitter) {
      this.glowEmitter.position.copy(this.getBladeTopPosition());
      this.glowEmitter.setActive(this.active && this.activationProgress > 0.5);
      this.glowEmitter.update(deltaTime);
    }
    
    // Check for hits if hitbox is active
    if (this.hitboxActive && this.parent) {
      this.checkHits();
    }
  }
  
  updateBladeVisuals(): void {
    if (!this.bladeMesh) return;
    
    if (this.active) {
      // Make all blade components visible
      this.bladeMesh.visible = true;
      this.bladeCore.visible = true;
      this.plasmaCore.visible = true;
      this.bladeLight.visible = true;
      this.bladeFlare.visible = true;
      
      // Set proper scale for all blade components
      this.bladeMesh.scale.set(1, 1, 1);
      this.bladeCore.scale.set(1, 1, 1);
      if (this.plasmaCore) this.plasmaCore.scale.set(1, 1, 1);
      
      // Set proper position for all blade components
      this.bladeMesh.position.y = this.hiltLength + this.bladeLength / 2;
      this.bladeCore.position.y = this.hiltLength + this.bladeLength / 2;
      if (this.plasmaCore) this.plasmaCore.position.y = this.hiltLength + this.bladeLength / 2;
      
      // Play activation sound
      gameAudio.playSound('lightsaberOn', { volume: 0.7 });
      
      // CRITICAL FIX: Immediately start the glow effect
      // Apply immediate partial glow to make it visible
      (this.bladeMesh.material as MeshBasicMaterial).opacity = 0.4;
      (this.bladeCore.material as MeshBasicMaterial).opacity = 0.6;
      if (this.plasmaCore) (this.plasmaCore.material as MeshBasicMaterial).opacity = 0.8;
      this.bladeLight.intensity = 1.0 * this.glowIntensity;
      // Enhanced active blade visuals
      const bladeMaterial = this.bladeMesh.material as MeshBasicMaterial;
      
      // Make the blade more vibrant with a higher intensity core
      bladeMaterial.color.setRGB(0.7, 0.9, 1.0);
      
      // Add a more pronounced pulsing effect with MUCH higher frequency
      const pulseAmount = Math.sin(Date.now() * 0.06) * 0.3 + 0.9;
      this.bladeMesh.scale.set(1.2, 1, pulseAmount);
      
      // Make sure the blade is visible
      this.bladeMesh.visible = true;
      
      // Safely handle glowEmitter
      if (this.glowEmitter) {
        this.glowEmitter.visible = true;
        // Make the glow pulse slightly out of sync with the blade
        const glowPulse = Math.sin(Date.now() * 0.07) * 0.6 + 1.4;
        this.glowEmitter.scale.set(glowPulse, glowPulse, glowPulse);
      }
      
      // Update core visuals - make it much more vibrant
      if (this.bladeCore && this.bladeCore.material instanceof MeshBasicMaterial) {
        // Always make core white for better visual effect
        this.bladeCore.material.color.setRGB(1.0, 1.0, 1.0);
        this.bladeCore.material.opacity = 0.9;
        
        // Add stronger pulsing to the core with MUCH higher frequency
        const corePulse = Math.sin(Date.now() * 0.08) * 0.4 + 0.9;
        this.bladeCore.scale.set(corePulse, 1, corePulse);
      }
      
      // Update plasma core - make it extremely bright
      if (this.plasmaCore && this.plasmaCore.material instanceof MeshBasicMaterial) {
        // Always make plasma core pure white
        this.plasmaCore.material.color.setRGB(1.0, 1.0, 1.0);
        this.plasmaCore.material.opacity = 0.9; // Slightly less opaque to blend better
        
        // Add rapid pulsing to the plasma core with MUCH higher frequency
        const plasmaPulse = Math.sin(Date.now() * 0.1) * 0.5 + 0.8;
        this.plasmaCore.scale.set(plasmaPulse, 1, plasmaPulse);
      }
      
      // Update blade light intensity with pulsing
      if (this.bladeLight) {
        const lightPulse = Math.sin(Date.now() * 0.025) * 0.5 + 1.2;
        this.bladeLight.intensity = this.glowIntensity * 1.5 * lightPulse;
      }
      
      // Update blade flare with pulsing
      if (this.bladeFlare) {
        const flarePulse = Math.sin(Date.now() * 0.02) * 0.6 + 1.3;
        this.bladeFlare.scale.set(flarePulse, flarePulse, flarePulse);
      }
    } else {
      // Blade is off
      this.bladeMesh.visible = false;
    }
  }
  
  activate(activate: boolean = true): void {
    if (this.active === activate) return;
    
    console.log("Lightsaber activating...");
    this.active = activate;
    
    // Make blade visible immediately when activating
    if (activate) {
      this.blade.visible = true;
      // Play activation sound
      if (gameAudio) {
        gameAudio.playSound('saberOn');
      }
    }
    
    // Animate the blade activation/deactivation
    this.animateActivation(activate);
  }
  
  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    gameAudio.playSound('saberOff');
  }
  
  isActive(): boolean {
    return this.active;
  }
  
  getColor(): string {
    return this.bladeColor;
  }
  
  playSwingSound(): void {
    gameAudio.playSound('lightsaberSwing', { volume: 0.3 });
    
    // Start swing animation
    this.startSwingAnimation();
  }
  
  playClashSound(): void {
    gameAudio.playSound('lightsaberClash', { volume: 0.7 });
  }
  
  getBladeTopPosition(): Vector3 {
    return new Vector3(0, this.hiltLength + this.bladeLength, 0).applyMatrix4(this.matrixWorld);
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

  // Improve lightsaber swing visibility for enemy
  swingAt(type: number, targetDirection: Vector3): void {
    if (!this.active) {
      // Force activate if not active
      this.activate();
    }
    
    if (this.isSwinging) return;
    this.isSwinging = true;
    
    console.log("Executing lightsaber swing");
    
    // Store original rotation for reset
    const originalRotation = {
      x: this.rotation.x,
      y: this.rotation.y,
      z: this.rotation.z
    };
    
    // Create more dramatic swing animation based on type
    let swingDuration = 400; // ms
    let maxAngle = Math.PI * 0.8; // More dramatic angle
    
    // Direction to adjust for target
    const adjustmentAngle = Math.atan2(targetDirection.x, targetDirection.z);
    this.rotation.y = adjustmentAngle;
    
    // CRITICAL FIX: Make swing more visible with larger rotation and color enhancement
    const startTime = Date.now();
    
    // Increase brightness dramatically during swing
    if (this.bladeLight) {
      this.bladeLight.intensity *= 2;
      this.bladeLight.distance *= 1.5;
    }
    
    // Use more dramatic swing with visual trail effect
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / swingDuration, 1);
      
      // More dramatic swing movement
      // For horizontal swing (type 0)
      if (type === 0) {
        // Wide horizontal arc with sine easing
        const swingRatio = Math.sin(progress * Math.PI);
        this.rotation.z = originalRotation.z + (maxAngle * swingRatio * (progress < 0.5 ? -1 : 1));
      } 
      // For vertical swing (type 1)
      else if (type === 1) {
        // Dramatic overhead swing
        const swingRatio = Math.sin(progress * Math.PI);
        this.rotation.x = originalRotation.x + (maxAngle * swingRatio);
      }
      // Diagonal swing (type 2)
      else {
        // Combined movement
        const swingRatio = Math.sin(progress * Math.PI);
        this.rotation.x = originalRotation.x + (maxAngle * 0.7 * swingRatio);
        this.rotation.z = originalRotation.z + (maxAngle * 0.7 * swingRatio);
      }
      
      // Continue animation until complete
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Reset rotation and swing state
        setTimeout(() => {
          this.rotation.set(
            originalRotation.x,
            this.rotation.y, // Keep facing direction
            originalRotation.z
          );
          this.isSwinging = false;
          
          // Reset blade light
          if (this.bladeLight) {
            this.bladeLight.intensity /= 2;
            this.bladeLight.distance /= 1.5;
          }
        }, 100);
      }
    };
    
    // Start animation
    animate();
    
    // Play swing sound
    gameAudio.playSound('lightsaberSwing', { volume: 0.8 });
  }

  setColor(color: string): void {
    this.bladeColor = color;
    
    // Update blade color
    if (this.bladeMesh && this.bladeMesh.material instanceof MeshBasicMaterial) {
      this.bladeMesh.material.color.set(color);
    }
    
    // Update blade tip color
    if (this.bladeFlare && this.bladeFlare.material instanceof MeshBasicMaterial) {
      this.bladeFlare.material.color.set(color);
    }
    
    // Update core color (always white for better visual effect)
    if (this.bladeCore && this.bladeCore.material instanceof MeshBasicMaterial) {
      // Always make core white for better visual effect
      this.bladeCore.material.color.setRGB(1.0, 1.0, 1.0);
    }
    
    // Update plasma core (always white)
    if (this.plasmaCore && this.plasmaCore.material instanceof MeshBasicMaterial) {
      // Always make plasma core pure white
      this.plasmaCore.material.color.setRGB(1.0, 1.0, 1.0);
    }
    
    // Update light color
    if (this.bladeLight) {
      this.bladeLight.color.set(color);
    }
    
    // Update glow emitter if it exists
    if (this.glowEmitter) {
      // Update emitter color
      this.glowEmitter.setColor(parseInt(color.replace('#', '0x')));
    }
    
    // Update only the activation button color
    this.traverse((child) => {
      if (child instanceof Mesh && 
          child.material instanceof MeshStandardMaterial && 
          child.material.emissive && 
          child.material.emissiveIntensity > 0 &&
          child.position.y === this.hiltLength * 0.5) { // Only the activation button
        // This is the activation button, update its color
        child.material.color.set(color);
        child.material.emissive.set(color);
      }
    });
  }

  /**
   * Creates the blade mesh for the lightsaber
   */
  private createBlade(): void {
    this.blade = new Group();
    this.blade.position.set(0, this.hiltLength / 2, 0); // Position at top of hilt
    
    // Create the outer glow
    const bladeGeometry = new CylinderGeometry(0.03, 0.02, this.bladeLength, 16);
    const bladeMaterial = new MeshBasicMaterial({
      color: this.bladeColor,
      transparent: true,
      opacity: 0.4,
      blending: AdditiveBlending // Add this for better glow effect
    });
    this.bladeMesh = new Mesh(bladeGeometry, bladeMaterial);
    this.bladeMesh.position.set(0, this.bladeLength / 2, 0);
    this.blade.add(this.bladeMesh);
    
    // Create inner core - brighter
    const coreGeometry = new CylinderGeometry(0.015, 0.01, this.bladeLength + 0.05, 8);
    const coreMaterial = new MeshBasicMaterial({
      color: 0xffffff, // White core
      transparent: false, // Change to false to make core fully visible
      opacity: 1.0,
      blending: AdditiveBlending // Add this for better glow effect
    });
    this.bladeCore = new Mesh(coreGeometry, coreMaterial);
    this.bladeCore.position.set(0, this.bladeLength / 2, 0);
    this.blade.add(this.bladeCore);
    
    // Create brightest plasma core
    const plasmaGeometry = new CylinderGeometry(0.008, 0.005, this.bladeLength + 0.1, 8);
    const plasmaMaterial = new MeshBasicMaterial({
      color: 0xffffff, // Pure white
      transparent: false, // Change to false to make plasma fully visible
      opacity: 1.0,
      blending: AdditiveBlending // Add this for better glow effect
    });
    this.plasmaCore = new Mesh(plasmaGeometry, plasmaMaterial);
    this.plasmaCore.position.set(0, this.bladeLength / 2, 0);
    this.blade.add(this.plasmaCore);
    
    // Add blade to the lightsaber
    this.add(this.blade);
    
    // Initially hide blade
    this.blade.visible = false;
    
    // Verify components
    console.log("Blade components verified");
  }

  startSwingAnimation(): void {
    if (this.isSwinging) return;
    
    this.isSwinging = true;
    
    // Store original rotation
    const originalRotation = {
      x: this.rotation.x,
      y: this.rotation.y,
      z: this.rotation.z
    };
    
    // Animate swing
    const startTime = Date.now();
    const duration = 300; // ms
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Swing motion
      const swingAngle = Math.sin(progress * Math.PI) * 0.8;
      this.rotation.z = originalRotation.z + swingAngle;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Reset rotation and swinging state
        this.rotation.set(originalRotation.x, originalRotation.y, originalRotation.z);
        this.isSwinging = false;
      }
    };
    
    // Start animation
    animate();
  }

  updateBladePhysics(deltaTime: number): void {
    if (!this.active || this.bladeSegments.length === 0) return;
    
    // Calculate current velocity based on position change
    const currentVelocity = new Vector3().subVectors(this.position, this.prevPosition).divideScalar(deltaTime);
    
    // Calculate acceleration
    this.acceleration.subVectors(currentVelocity, this.velocity);
    
    // Update velocity with damping
    this.velocity.copy(currentVelocity).multiplyScalar(0.8);
    
    // Store current position for next frame
    this.prevPosition.copy(this.position);
    
    // Apply physics to blade segments with progressive delay
    for (let i = 0; i < this.bladeSegments.length; i++) {
      const segment = this.bladeSegments[i];
      const segmentDelay = i * 0.05; // Increasing delay for segments further from hilt
      
      // Calculate forces for this segment
      const centrifugalForce = this.acceleration.clone().multiplyScalar(0.2 * (i + 1));
      
      // Dampen swinging over time
      this.rotationalInertia.lerp(centrifugalForce, 0.1 * (1 - segmentDelay));
      
      // Apply rotation based on physics
      segment.rotation.x = this.rotationalInertia.z * 0.2 * (i + 1);
      segment.rotation.z = -this.rotationalInertia.x * 0.2 * (i + 1);
    }
    
    // Handle swinging animation
    if (this.isSwinging) {
      this.swingPhase += deltaTime * 8;
      
      if (this.swingPhase > Math.PI) {
        this.isSwinging = false;
        this.swingPhase = 0;
      } else {
        // Apply swing effect to blade segments
        const swingForce = Math.sin(this.swingPhase) * 0.4;
        
        for (let i = 0; i < this.bladeSegments.length; i++) {
          const segment = this.bladeSegments[i];
          const segmentFactor = (i + 1) / this.bladeSegments.length;
          
          segment.rotation.x += this.swingDirectionVector.x * swingForce * segmentFactor;
          segment.rotation.z += this.swingDirectionVector.z * swingForce * segmentFactor;
        }
      }
    }
  }

  triggerSwing(direction: Vector3 = new Vector3(1, 0, 0)): void {
    this.isSwinging = true;
    this.swingPhase = 0;
    this.swingDirectionVector.copy(direction).normalize();
    
    // Apply initial force to start the swing
    this.rotationalInertia.add(direction.clone().multiplyScalar(0.5));
  }

  private updateBladeIntensity(): void {
    if (!this.bladeMesh) return;
    
    // Pulse effect for the blade - subtle variation in brightness
    const pulseIntensity = 0.9 + Math.sin(performance.now() * 0.005) * 0.1;
    
    // Update all blade segments
    this.bladeSegments.forEach(segment => {
      segment.children.forEach(child => {
        if (child instanceof Mesh) {
          if (child === segment.children[0]) {
            // Core brightness
            child.material.opacity = 0.9 * this.activationProgress * pulseIntensity;
          } else {
            // Glow brightness
            child.material.opacity = 0.7 * this.activationProgress * pulseIntensity;
          }
        }
      });
    });
  }

  // Add a method to set the scene if not provided in constructor
  setScene(scene: Scene): void {
    this.scene = scene;
  }

  // Start a light attack
  lightAttack(direction: 'horizontal' | 'vertical' | 'diagonal' = 'horizontal'): void {
    if (this.swingCooldown > 0 || this.swingState !== 'idle') return;
    
    this.swingType = 'light';
    this.swingDirection = direction;
    this.swingState = 'windup';
    this.swingProgress = 0;
    this.swingDuration = this.lightAttackDuration;
    this.swingStartTime = performance.now() / 1000;
    
    // Apply combo effects
    const comboSpeedMultiplier = 1 + (this.comboCount * 0.1); // 10% faster per combo
    this.swingDuration /= comboSpeedMultiplier;
    
    // Play swing sound
    gameAudio.playSound('lightsaberSwing', { 
      volume: 0.7,
      detune: this.comboCount * 100 // Higher pitch with combo
    });
    
    // Start the swing animation
    this.animateSwing();
  }
  
  // Start a heavy attack
  heavyAttack(direction: 'horizontal' | 'vertical' | 'diagonal' = 'horizontal'): void {
    if (this.swingCooldown > 0 || this.swingState !== 'idle') return;
    
    this.swingType = 'heavy';
    this.swingDirection = direction;
    this.swingState = 'windup';
    this.swingProgress = 0;
    this.swingDuration = this.heavyAttackDuration;
    this.swingStartTime = performance.now() / 1000;
    
    // Apply combo effects
    const comboSpeedMultiplier = 1 + (this.comboCount * 0.1); // 10% faster per combo
    this.swingDuration /= comboSpeedMultiplier;
    
    // Play swing sound with lower pitch for heavy attack
    gameAudio.playSound('lightsaberSwing', { 
      volume: 0.9,
      detune: -200 + (this.comboCount * 50) // Lower pitch for heavy, but increases with combo
    });
    
    // Start the swing animation
    this.animateSwing();
  }
  
  // Set blocking state
  setBlocking(blocking: boolean): void {
    this.isBlocking = blocking;
    
    if (blocking) {
      // Move to blocking stance
      this.rotation.x = Math.PI * 0.25; // Angle blade upward
      this.rotation.z = Math.PI * 0.1; // Slight tilt
      
      // Play block sound
      gameAudio.playSound('lightsaberHum', { volume: 0.5, detune: 200 });
    } else {
      // Return to idle stance if not in another state
      if (this.swingState === 'idle') {
        this.rotation.x = 0;
        this.rotation.z = 0;
      }
    }
  }
  
  // Animate the swing based on current state and direction
  private animateSwing(): void {
    // Store original rotation
    const originalRotation = {
      x: this.rotation.x,
      y: this.rotation.y,
      z: this.rotation.z
    };
    
    // Define animation phases
    const windupDuration = this.swingType === 'light' ? 0.15 : 0.25;
    const strikeDuration = this.swingType === 'light' ? 0.1 : 0.15;
    const recoveryDuration = this.swingType === 'light' ? 0.15 : 0.3;
    
    // Animation loop
    const animate = () => {
      const currentTime = performance.now() / 1000;
      const elapsed = currentTime - this.swingStartTime;
      this.swingProgress = elapsed / this.swingDuration;
      
      // Determine current phase
      if (elapsed < windupDuration) {
        // Wind-up phase
        this.swingState = 'windup';
        const windupProgress = elapsed / windupDuration;
        
        // Apply wind-up motion based on direction
        if (this.swingDirection === 'horizontal') {
          // Pull back for horizontal swing
          this.rotation.y = originalRotation.y - (Math.PI * 0.3 * windupProgress);
          this.rotation.z = originalRotation.z - (Math.PI * 0.1 * windupProgress);
        } else if (this.swingDirection === 'vertical') {
          // Raise for vertical swing
          this.rotation.x = originalRotation.x + (Math.PI * 0.4 * windupProgress);
        } else if (this.swingDirection === 'diagonal') {
          // Diagonal wind-up
          this.rotation.x = originalRotation.x + (Math.PI * 0.2 * windupProgress);
          this.rotation.y = originalRotation.y - (Math.PI * 0.2 * windupProgress);
        }
        
      } else if (elapsed < windupDuration + strikeDuration) {
        // Strike phase
        this.swingState = 'strike';
        const strikeProgress = (elapsed - windupDuration) / strikeDuration;
        
        // Activate hitbox during strike
        this.hitboxActive = true;
        
        // Apply strike motion based on direction
        if (this.swingDirection === 'horizontal') {
          // Horizontal swing (from left to right)
          this.rotation.y = originalRotation.y - (Math.PI * 0.3) + (Math.PI * 0.6 * strikeProgress);
          this.rotation.z = originalRotation.z - (Math.PI * 0.1) + (Math.PI * 0.2 * strikeProgress);
        } else if (this.swingDirection === 'vertical') {
          // Vertical swing (from up to down)
          this.rotation.x = originalRotation.x + (Math.PI * 0.4) - (Math.PI * 0.8 * strikeProgress);
        } else if (this.swingDirection === 'diagonal') {
          // Diagonal swing
          this.rotation.x = originalRotation.x + (Math.PI * 0.2) - (Math.PI * 0.4 * strikeProgress);
          this.rotation.y = originalRotation.y - (Math.PI * 0.2) + (Math.PI * 0.4 * strikeProgress);
        }
        
      } else if (elapsed < this.swingDuration) {
        // Recovery phase
        this.swingState = 'recovery';
        const recoveryProgress = (elapsed - windupDuration - strikeDuration) / recoveryDuration;
        
        // Deactivate hitbox
        this.hitboxActive = false;
        
        // Apply recovery motion (return to original position with slight overshoot)
        if (this.swingDirection === 'horizontal') {
          const overshoot = Math.sin(recoveryProgress * Math.PI) * 0.1;
          this.rotation.y = originalRotation.y + (Math.PI * 0.3 * (1 - recoveryProgress)) + overshoot;
          this.rotation.z = originalRotation.z + (Math.PI * 0.1 * (1 - recoveryProgress));
        } else if (this.swingDirection === 'vertical') {
          const overshoot = Math.sin(recoveryProgress * Math.PI) * 0.1;
          this.rotation.x = originalRotation.x - (Math.PI * 0.4 * (1 - recoveryProgress)) - overshoot;
        } else if (this.swingDirection === 'diagonal') {
          const overshoot = Math.sin(recoveryProgress * Math.PI) * 0.1;
          this.rotation.x = originalRotation.x - (Math.PI * 0.2 * (1 - recoveryProgress)) - overshoot;
          this.rotation.y = originalRotation.y + (Math.PI * 0.2 * (1 - recoveryProgress)) + overshoot;
        }
        
      } else {
        // Swing complete
        this.swingState = 'idle';
        this.rotation.x = originalRotation.x;
        this.rotation.y = originalRotation.y;
        this.rotation.z = originalRotation.z;
        
        // Set cooldown
        this.swingCooldown = this.swingType === 'light' ? this.lightAttackCooldown : this.heavyAttackCooldown;
        
        // Update combo
        this.comboCount = Math.min(5, this.comboCount + 1);
        this.lastSwingTime = currentTime;
        
        return; // End animation
      }
      
      // Continue animation
      requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
  }

  // Check for hits with the lightsaber
  private checkHits(): void {
    // Get the scene
    const scene = this.parent.parent;
    if (!scene) return;
    
    // Find the actual Scene object by traversing up the hierarchy
    let actualScene = scene;
    while (actualScene && !(actualScene as any).isScene) {
      actualScene = actualScene.parent;
    }
    
    if (!actualScene) {
      console.warn('Could not find Scene object in hierarchy');
      return;
    }
    
    // Get blade tip and base positions in world space
    const bladeTip = this.localToWorld(new Vector3(0, this.hiltLength + this.bladeLength, 0));
    const bladeBase = this.localToWorld(new Vector3(0, this.hiltLength, 0));
    
    // Find potential targets
    scene.traverse((object) => {
      // Skip self and already hit targets
      if (object === this || object === this.parent || this.hitTargets.has(object)) return;
      
      // Check if object is an enemy or destructible
      if (object.name === 'enemy' && isDamageable(object)) {
        // Simple distance check to blade line segment
        const distanceToLine = this.distanceToLineSegment(
          object.position, 
          bladeBase,
          bladeTip
        );
        
        // If within hitbox radius, register a hit
        if (distanceToLine < this.hitboxRadius + 0.5) { // Add object radius approximation
          this.hitTargets.add(object);
          
          // Calculate damage based on swing type and combo
          const baseDamage = this.swingType === 'light' ? this.lightAttackDamage : this.heavyAttackDamage;
          const comboDamageMultiplier = 1 + (this.comboCount * 0.05); // 5% more damage per combo
          const damage = baseDamage * comboDamageMultiplier;
          
          // Apply damage to the target
          object.takeDamage(damage, this.parent.position);
          
          // Create hit effect
          createHitEffect(actualScene as Scene, object.position.clone(), this.bladeColor);
          
          // Play hit sound
          gameAudio.playSound('lightsaberHit', { volume: 0.8 });
        }
      } else if (object.userData.destructible && isDestructible(object)) {
        // Handle destructible objects
        object.destroy();
        
        // Create destruction effect
        createHitEffect(actualScene as Scene, object.position.clone(), '#ffaa00');
        
        // Play destruction sound
        gameAudio.playSound('objectDestroyed', { volume: 0.7 });
      }
    });
  }
  
  // Helper to calculate distance from point to line segment
  private distanceToLineSegment(point: Vector3, lineStart: Vector3, lineEnd: Vector3): number {
    const line = new Vector3().subVectors(lineEnd, lineStart);
    const lineLength = line.length();
    line.normalize();
    
    const pointToStart = new Vector3().subVectors(point, lineStart);
    const projection = pointToStart.dot(line);
    
    // If projection is outside the line segment, use distance to nearest endpoint
    if (projection <= 0) {
      return pointToStart.length();
    } else if (projection >= lineLength) {
      return new Vector3().subVectors(point, lineEnd).length();
    }
    
    // Calculate perpendicular distance to line
    const projectedPoint = new Vector3().copy(lineStart).add(line.multiplyScalar(projection));
    return new Vector3().subVectors(point, projectedPoint).length();
  }

  // Create blade light
  createBladeLight(): void {
    // Remove old light if it exists
    if (this.bladeLight) {
      this.blade.remove(this.bladeLight);
    }
    
    // Create a point light for the blade
    this.bladeLight = new PointLight(this.bladeColor, this.glowIntensity, 2.0);
    this.bladeLight.position.y = this.bladeLength / 2;
    this.blade.add(this.bladeLight);
    
    // Make sure light is only visible when lightsaber is active
    this.bladeLight.visible = this.active;
  }

  // Animate blade activation/deactivation
  animateActivation(activate: boolean): void {
    // Start activation animation
    this.activationProgress = activate ? 0 : 1;
    const duration = 0.3; // seconds
    const startTime = performance.now() / 1000;
    
    const animate = () => {
      const currentTime = performance.now() / 1000;
      const elapsed = currentTime - startTime;
      
      if (activate) {
        // Extending blade
        this.activationProgress = Math.min(elapsed / duration, 1);
      } else {
        // Retracting blade
        this.activationProgress = Math.max(1 - (elapsed / duration), 0);
      }
      
      // Scale the blade based on activation progress
      if (this.blade) {
        this.blade.scale.y = this.activationProgress;
        
        // Update material opacities
        if (this.bladeMesh && this.bladeMesh.material instanceof MeshBasicMaterial) {
          this.bladeMesh.material.opacity = this.activationProgress * 0.4;
        }
        
        if (this.bladeCore && this.bladeCore.material instanceof MeshBasicMaterial) {
          this.bladeCore.material.opacity = this.activationProgress * 0.7;
        }
        
        if (this.plasmaCore && this.plasmaCore.material instanceof MeshBasicMaterial) {
          this.plasmaCore.material.opacity = this.activationProgress;
        }
        
        // Hide blade when fully retracted
        if (!activate && this.activationProgress === 0) {
          this.blade.visible = false;
          if (this.glowEmitter) {
            this.glowEmitter.setActive(false);
          }
        }
      }
      
      // Continue animation if not complete
      if (activate && this.activationProgress < 1 || !activate && this.activationProgress > 0) {
        requestAnimationFrame(animate);
      }
    };
    
    // Start animation
    animate();
  }

  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}
