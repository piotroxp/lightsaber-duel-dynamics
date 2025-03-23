import { Group, Vector3, Mesh, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial, Color, AdditiveBlending, SpotLight, Object3D, PointLight, SphereGeometry, DoubleSide, Scene } from 'three';
import { ParticleEmitter, createLightsaberGlow } from './effects';
import gameAudio from './audio';

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
  private swingDirection: Vector3 = new Vector3(1, 0, 0);
  private swingDamping: number = 0.92;
  private bladeSegments: (Mesh | Group)[] = [];

  constructor(options: LightsaberOptions = {}) {
    super();
    
    this.bladeColor = options.color || '#3366ff';
    this.bladeLength = options.bladeLength || 1.2;
    this.hiltLength = options.hiltLength || 0.25; // Slightly longer for more detail
    this.glowIntensity = options.glowIntensity || 1.0;
    this.scene = options.scene || null;
    
    // Initialize properties to prevent null reference errors
    this.glowEmitter = null;
    this.bladeFlare = null;
    
    // Store initial position for physics
    this.prevPosition.copy(this.position);
    
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
      if (this.isSwinging) {
        this.bladeLight.intensity = 1.8 * this.glowIntensity;
        this.bladeLight.distance = 2.5;
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
      this.plasmaCore.scale.set(1, 1, 1);
      
      // Set proper position for all blade components
      this.bladeMesh.position.y = this.hiltLength + this.bladeLength / 2;
      this.bladeCore.position.y = this.hiltLength + this.bladeLength / 2;
      this.plasmaCore.position.y = this.hiltLength + this.bladeLength / 2;
      
      // Play activation sound
      gameAudio.playSound('lightsaberOn', { volume: 0.7 });
      
      // CRITICAL FIX: Immediately start the glow effect
      // Apply immediate partial glow to make it visible
      (this.bladeMesh.material as MeshBasicMaterial).opacity = 0.4;
      (this.bladeCore.material as MeshBasicMaterial).opacity = 0.6;
      (this.plasmaCore.material as MeshBasicMaterial).opacity = 0.8;
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
        this.plasmaCore.material.opacity = 1.0;
        
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
  
  activate(): void {
    // If already active, skip activation
    if (this.active) return;
    
    this.active = true;
    
    // Create blade if not already created
    if (!this.blade || !this.bladeCore || !this.plasmaCore) {
      this.createBlade();
    }
    
    // Make blade visible
    if (this.blade) {
      this.blade.visible = true;
    }
    
    // Enable light
    if (this.bladeLight) {
      this.bladeLight.visible = true;
    }
    
    // Create glow particles if not exists
    if (!this.glowEmitter && this.scene) {
      this.glowEmitter = createLightsaberGlow(
        this.scene, 
        new Vector3(
          this.position.x, 
          this.position.y + this.hiltLength + this.bladeLength * 0.5, 
          this.position.z
        ),
        this.bladeColor
      );
    }
    
    // Play activation sound
    gameAudio.playSound('lightsaberOn', { volume: 0.7 });
    
    // Start activation animation
    this.activationProgress = 0;
    const duration = 0.3; // seconds
    const startTime = performance.now() / 1000;
    
    const animateActivation = () => {
      const currentTime = performance.now() / 1000;
      const elapsed = currentTime - startTime;
      
      this.activationProgress = Math.min(elapsed / duration, 1);
      
      // Scale the blade up
      if (this.blade && this.bladeCore && this.plasmaCore && this.bladeFlare) {
        this.blade.scale.y = this.activationProgress;
        
        // Update blade core
        if (this.bladeCore.material instanceof MeshBasicMaterial) {
          this.bladeCore.material.opacity = this.activationProgress * 0.9;
        }
        
        // Update plasma core
        if (this.plasmaCore.material instanceof MeshBasicMaterial) {
          this.plasmaCore.material.opacity = this.activationProgress;
        }
        
        // Update blade flare (tip)
        if (this.bladeFlare.material instanceof MeshBasicMaterial) {
          this.bladeFlare.material.opacity = this.activationProgress * 0.8;
        }
      }
      
      if (this.activationProgress < 1) {
        requestAnimationFrame(animateActivation);
      }
    };
    
    animateActivation();
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
      if (this.bladeMesh.material instanceof MeshBasicMaterial) {
        this.bladeMesh.material.opacity = (1 - progress) * 0.3;
      }
      
      // Shrink blade into hilt
      this.bladeMesh.scale.set(1, 1 - progress, 1);
      // Move the blade down as it retracts
      this.bladeMesh.position.y = this.hiltLength + (this.bladeLength * (1 - progress)) / 2;
      
      // Also shrink core and plasma core
      if (this.bladeCore) {
        this.bladeCore.scale.set(1, 1 - progress, 1);
        this.bladeCore.position.y = this.hiltLength + (this.bladeLength * (1 - progress)) / 2;
      }
      
      if (this.plasmaCore) {
        this.plasmaCore.scale.set(1, 1 - progress, 1);
        this.plasmaCore.position.y = this.hiltLength + (this.bladeLength * (1 - progress)) / 2;
      }
      
      // Also hide the blade tip and flare
      if (this.bladeFlare && this.bladeFlare.material instanceof MeshBasicMaterial) {
        this.bladeFlare.material.opacity = (1 - progress) * 0.3;
        this.bladeFlare.position.y = this.hiltLength + this.bladeLength * (1 - progress);
      }
      
      // Hide all blade tips
      this.traverse((child) => {
        if (child !== this.bladeMesh && 
            child !== this.bladeCore && 
            child !== this.plasmaCore && 
            child !== this.hilt && 
            child instanceof Mesh && 
            child.position.y > this.hiltLength) {
         
          if (child.material instanceof MeshBasicMaterial) {
            child.material.opacity = (1 - progress) * child.material.opacity;
          }
          
          // Scale down the tip
          child.scale.set(1, 1 - progress, 1);
         
          // Move the tip position based on progress
          if (child.name.includes('Tip')) {
            child.position.y = this.hiltLength + this.bladeLength * (1 - progress);
          }
        }
      });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.active = false;
        // Hide all blade components when fully deactivated
        this.bladeMesh.visible = false;
        this.bladeCore.visible = false;
        this.plasmaCore.visible = false;
        this.bladeFlare.visible = false;
        this.bladeLight.visible = false;
        
        // Hide all blade tips
        this.traverse((child) => {
          if (child !== this.bladeMesh && 
              child !== this.bladeCore && 
              child !== this.plasmaCore && 
              child !== this.hilt && 
              child instanceof Mesh && 
              child.position.y > this.hiltLength) {
            child.visible = false;
          }
        });
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
    
    // Start swing animation
    this.startSwingAnimation();
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
    const colorValue = parseInt(color.replace('#', '0x'));
    this.traverse((child) => {
      if (child instanceof Mesh && 
          child.material instanceof MeshStandardMaterial && 
          child.material.emissive && 
          child.material.emissiveIntensity > 0 &&
          child.position.y === this.hiltLength * 0.5) { // Only the activation button
        // This is the activation button, update its color
        child.material.color.set(colorValue);
        child.material.emissive.set(colorValue);
      }
    });
  }

  createBlade(): void {
    // Remove old blade if it exists
    if (this.blade) {
      this.remove(this.blade);
    }
    if (this.bladeSegments.length > 0) {
      this.bladeSegments.forEach(segment => this.remove(segment));
      this.bladeSegments = [];
    }
    
    // Create blade group
    this.blade = new Group();
    this.blade.position.y = this.hiltLength;
    this.add(this.blade);
    
    // Create the actual mesh inside the group
    const bladeGeometry = new CylinderGeometry(0.025, 0.02, this.bladeLength, 12);
    const bladeMaterial = new MeshBasicMaterial({
      color: this.bladeColor,
      transparent: true,
      opacity: 0.8,
      side: DoubleSide,
      blending: AdditiveBlending
    });
    this.bladeMesh = new Mesh(bladeGeometry, bladeMaterial);
    this.bladeMesh.position.y = this.bladeLength / 2;
    this.blade.add(this.bladeMesh);
    
    // Create core material (bright white)
    const coreGeometry = new CylinderGeometry(0.01, 0.008, this.bladeLength, 8);
    const segmentCoreMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    this.bladeCore = new Mesh(coreGeometry, segmentCoreMaterial);
    this.bladeCore.position.y = this.bladeLength / 2;
    this.blade.add(this.bladeCore);
    
    // Create plasma core (very bright white center)
    const plasmaGeometry = new CylinderGeometry(0.005, 0.004, this.bladeLength, 6);
    const plasmaMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0
    });
    this.plasmaCore = new Mesh(plasmaGeometry, plasmaMaterial);
    this.plasmaCore.position.y = this.bladeLength / 2;
    this.blade.add(this.plasmaCore);
    
    // Create blade flare (tip)
    const flareGeometry = new SphereGeometry(0.03, 8, 8);
    const flareMaterial = new MeshBasicMaterial({
      color: this.bladeColor,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending
    });
    this.bladeFlare = new Mesh(flareGeometry, flareMaterial);
    this.bladeFlare.position.y = this.bladeLength;
    this.blade.add(this.bladeFlare);
    
    // Add blade light
    this.bladeLight = new PointLight(this.bladeColor, this.glowIntensity, 2.0);
    this.bladeLight.position.y = this.bladeLength / 2;
    this.blade.add(this.bladeLight);

    // Create outer glow material
    const glowColor = new Color(this.bladeColor);
    const glowMaterial = new MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.7,
      blending: AdditiveBlending
    });
    
    // Number of blade segments for physics-based bending
    const numSegments = 6;
    const segmentLength = this.bladeLength / numSegments;
    
    // Create blade segments
    for (let i = 0; i < numSegments; i++) {
      // Inner core (white)
      const coreGeometry = new CylinderGeometry(0.02, 0.02, segmentLength, 8);
      const core = new Mesh(coreGeometry, segmentCoreMaterial);
      core.position.y = i * segmentLength + segmentLength / 2;
      
      // Outer glow (colored)
      const glowGeometry = new CylinderGeometry(0.04, 0.04, segmentLength, 16);
      const glow = new Mesh(glowGeometry, glowMaterial);
      glow.position.y = i * segmentLength + segmentLength / 2;
      
      // Create segment group
      const segment = new Group();
      segment.add(core);
      segment.add(glow);
      
      // Store for physics updates
      this.bladeSegments.push(segment);
      this.blade.add(segment);
    }
    
    // Hide blade initially
    this.blade.visible = false;
    this.blade.scale.y = 0;
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
          
          segment.rotation.x += this.swingDirection.x * swingForce * segmentFactor;
          segment.rotation.z += this.swingDirection.z * swingForce * segmentFactor;
        }
      }
    }
  }

  triggerSwing(direction: Vector3 = new Vector3(1, 0, 0)): void {
    this.isSwinging = true;
    this.swingPhase = 0;
    this.swingDirection.copy(direction).normalize();
    
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
}
