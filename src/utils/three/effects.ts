import { Group, Scene, Vector3, Points, BufferGeometry, PointsMaterial, BufferAttribute, Color, Object3D, Mesh, SphereGeometry, MeshBasicMaterial, AdditiveBlending } from 'three';

export interface ParticleOptions {
  maxParticles?: number;
  particleSize?: number;
  particleColor?: string;
  emissionRate?: number;
  particleLifetime?: number;
  gravity?: Vector3;
  spread?: number;
}

interface Particle {
  position: Vector3;
  velocity: Vector3;
  lifetime: number;
  maxLifetime: number;
  size: number;
  active: boolean;
}

export class ParticleEmitter extends Object3D {
  private maxParticles: number;
  private particleSize: number;
  private particleColor: string;
  private emissionRate: number;
  private particleLifetime: number;
  private spread: number;
  private active: boolean = false;
  private particles: any[] = []; // Replace with your Particle type
  private gravity: Vector3;
  
  constructor(options: {
    maxParticles?: number;
    particleSize?: number;
    particleColor?: string;
    emissionRate?: number;
    particleLifetime?: number;
    spread?: number;
    gravity?: Vector3;
  }) {
    super(); // Call parent constructor
    
    this.maxParticles = options.maxParticles || 100;
    this.emissionRate = options.emissionRate || 10; // particles per second
    this.particleLifetime = options.particleLifetime || 1.0; // seconds
    this.gravity = options.gravity || new Vector3(0, -9.8, 0);
    this.spread = options.spread || 0.5; // random spread factor
    
    // Initialize particle system
    this.geometry = new BufferGeometry();
    
    // Create array of particle attributes
    const positions = new Float32Array(this.maxParticles * 3); // x, y, z per particle
    const sizes = new Float32Array(this.maxParticles);
    const colors = new Float32Array(this.maxParticles * 3); // r, g, b per particle
    const alphas = new Float32Array(this.maxParticles);
    
    // Initialize particles
    const defaultColor = new Color(options.particleColor || '#ffffff');
    const defaultSize = options.particleSize || 0.1;
    
    for (let i = 0; i < this.maxParticles; i++) {
      // Initial position (all at emitter)
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      // Initial size
      sizes[i] = defaultSize;
      
      // Initial color
      colors[i * 3] = defaultColor.r;
      colors[i * 3 + 1] = defaultColor.g;
      colors[i * 3 + 2] = defaultColor.b;
      
      // Initial alpha (fully transparent for inactive particles)
      alphas[i] = 0;
      
      // Create particle object
      this.particles.push({
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(0, 0, 0),
        lifetime: 0,
        maxLifetime: this.particleLifetime,
        size: defaultSize,
        active: false
      });
    }
    
    // Set attributes on geometry
    this.geometry.setAttribute('position', new BufferAttribute(positions, 3));
    this.geometry.setAttribute('size', new BufferAttribute(sizes, 1));
    this.geometry.setAttribute('color', new BufferAttribute(colors, 3));
    this.geometry.setAttribute('alpha', new BufferAttribute(alphas, 1));
    
    // Create material with custom shader for alpha control
    this.material = new PointsMaterial({
      size: defaultSize,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending,
      depthWrite: false
    });
    
    // Create points mesh
    this.points = new Points(this.geometry, this.material);
    this.add(this.points); // Now this.add works because we extend Group
  }
  
  setActive(active: boolean): void {
    this.active = active;
  }
  
  setColor(color: string): void {
    const newColor = new Color(color);
    const colorAttrib = this.geometry.getAttribute('color') as BufferAttribute;
    
    for (let i = 0; i < this.maxParticles; i++) {
      colorAttrib.setXYZ(i, newColor.r, newColor.g, newColor.b);
    }
    
    colorAttrib.needsUpdate = true;
  }
  
  update(deltaTime: number): void {
    if (!this.active) {
      // Just fade out existing particles
      this.updateParticles(deltaTime, false);
      return;
    }
    
    // Emit new particles based on rate
    this.timeSinceLastEmission += deltaTime;
    const particlesToEmit = Math.floor(this.timeSinceLastEmission * this.emissionRate);
    
    if (particlesToEmit > 0) {
      this.timeSinceLastEmission -= particlesToEmit / this.emissionRate;
      this.emitParticles(particlesToEmit);
    }
    
    // Update existing particles
    this.updateParticles(deltaTime, true);
  }
  
  private emitParticles(count: number): void {
    let emitted = 0;
    
    for (let i = 0; i < this.maxParticles && emitted < count; i++) {
      if (!this.particles[i].active) {
        // Reset and activate this particle
        this.particles[i].position.set(0, 0, 0);
        this.particles[i].velocity.set(
          (Math.random() - 0.5) * this.spread,
          (Math.random() - 0.5) * this.spread + 0.5, // Slightly upward bias
          (Math.random() - 0.5) * this.spread
        );
        this.particles[i].lifetime = 0;
        this.particles[i].active = true;
        emitted++;
      }
    }
  }
  
  private updateParticles(deltaTime: number, canEmitNew: boolean): void {
    const positionAttrib = this.geometry.getAttribute('position') as BufferAttribute;
    const alphaAttrib = this.geometry.getAttribute('alpha') as BufferAttribute;
    
    for (let i = 0; i < this.maxParticles; i++) {
      const particle = this.particles[i];
      
      if (particle.active) {
        // Update lifetime
        particle.lifetime += deltaTime;
        
        if (particle.lifetime > particle.maxLifetime) {
          // Deactivate if past lifetime
          particle.active = false;
          alphaAttrib.setX(i, 0);
        } else {
          // Update position
          particle.velocity.add(this.gravity.clone().multiplyScalar(deltaTime));
          particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
          
          // Update attributes
          positionAttrib.setXYZ(i, particle.position.x, particle.position.y, particle.position.z);
          
          // Fade out towards end of life
          const lifeRatio = particle.lifetime / particle.maxLifetime;
          const alpha = lifeRatio < 0.8 ? 1.0 : 1.0 - (lifeRatio - 0.8) / 0.2;
          alphaAttrib.setX(i, alpha);
        }
      } else if (canEmitNew) {
        // Deactivated particles are invisible
        alphaAttrib.setX(i, 0);
      }
    }
    
    // Mark attributes for update
    positionAttrib.needsUpdate = true;
    alphaAttrib.needsUpdate = true;
  }
}

export class ParticleSystem {
  private scene: Scene;
  private emitters: ParticleEmitter[] = [];
  
  constructor(scene: Scene) {
    this.scene = scene;
  }
  
  createEmitter(options: ParticleOptions = {}): ParticleEmitter {
    const emitter = new ParticleEmitter(options);
    this.emitters.push(emitter);
    this.scene.add(emitter);
    return emitter;
  }
  
  removeEmitter(emitter: ParticleEmitter): void {
    const index = this.emitters.indexOf(emitter);
    if (index !== -1) {
      this.emitters.splice(index, 1);
      this.scene.remove(emitter);
    }
  }
  
  update(deltaTime: number): void {
    for (const emitter of this.emitters) {
      emitter.update(deltaTime);
    }
  }
}

export function createSaberClashEffect(scene: Scene, position: Vector3, color: string): void {
  // Create a one-time particle emitter at the clash location
  const emitter = new ParticleEmitter({
    maxParticles: 50,
    particleSize: 0.05,
    particleColor: color,
    emissionRate: 100,
    particleLifetime: 0.5,
    spread: 0.5
  });
  
  emitter.position.copy(position);
  scene.add(emitter);
  
  // Emit all particles at once
  emitter.update(0.5);
  
  // Create a flash effect
  const flashGeometry = new SphereGeometry(0.2, 16, 16);
  const flashMaterial = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: 1.0,
    blending: AdditiveBlending
  });
  
  const flash = new Mesh(flashGeometry, flashMaterial);
  flash.position.copy(position);
  scene.add(flash);
  
  // Animate the flash and remove when done
  let flashLifetime = 0;
  const maxFlashLifetime = 0.3;
  
  function updateFlash() {
    flashLifetime += 0.016; // Approximate for 60fps
    
    if (flashLifetime >= maxFlashLifetime) {
      scene.remove(flash);
      flashMaterial.dispose();
      flashGeometry.dispose();
      
      // Also remove emitter after a delay
      setTimeout(() => {
        scene.remove(emitter);
      }, 500);
      
      return;
    }
    
    // Fade out and expand
    const lifeRatio = flashLifetime / maxFlashLifetime;
    flash.scale.set(1 + lifeRatio, 1 + lifeRatio, 1 + lifeRatio);
    flashMaterial.opacity = 1 - lifeRatio;
    
    requestAnimationFrame(updateFlash);
  }
  
  updateFlash();
}

// Add missing createHitEffect function
export function createHitEffect(scene: Scene, position: Vector3, color: string): void {
  // Similar to clash effect but with different parameters
  const emitter = new ParticleEmitter({
    maxParticles: 30,
    particleSize: 0.04,
    particleColor: color,
    emissionRate: 80,
    particleLifetime: 0.4,
    spread: 0.3
  });
  
  emitter.position.copy(position);
  scene.add(emitter);
  
  // Emit particles
  emitter.update(0.3);
  
  // Create a smaller flash
  const flashGeometry = new SphereGeometry(0.15, 12, 12);
  const flashMaterial = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending
  });
  
  const flash = new Mesh(flashGeometry, flashMaterial);
  flash.position.copy(position);
  scene.add(flash);
  
  // Animate and remove
  let flashLifetime = 0;
  const maxFlashLifetime = 0.2;
  
  function updateFlash() {
    flashLifetime += 0.016;
    
    if (flashLifetime >= maxFlashLifetime) {
      scene.remove(flash);
      flashMaterial.dispose();
      flashGeometry.dispose();
      
      setTimeout(() => {
        scene.remove(emitter);
      }, 400);
      
      return;
    }
    
    const lifeRatio = flashLifetime / maxFlashLifetime;
    flash.scale.set(1 + lifeRatio * 0.5, 1 + lifeRatio * 0.5, 1 + lifeRatio * 0.5);
    flashMaterial.opacity = 0.8 * (1 - lifeRatio);
    
    requestAnimationFrame(updateFlash);
  }
  
  updateFlash();
}
