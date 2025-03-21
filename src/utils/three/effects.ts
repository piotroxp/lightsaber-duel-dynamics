import {
  Group,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  Points,
  Vector3,
  Color,
  AdditiveBlending,
  Object3D,
  Scene,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial
} from 'three';

// Particle emitter options
interface ParticleEmitterOptions {
  count?: number;
  size?: number;
  color?: number;
  lifetime?: number;
  speed?: number;
  direction?: Vector3;
  spread?: number;
  gravity?: number;
  emissionRate?: number;
}

// Particle system for visual effects
export class ParticleSystem {
  private emitters: ParticleEmitter[] = [];
  private scene: Object3D;

  constructor(scene: Object3D) {
    this.scene = scene;
  }

  createEmitter(options: ParticleEmitterOptions): ParticleEmitter {
    const emitter = new ParticleEmitter(options);
    this.emitters.push(emitter);
    this.scene.add(emitter);
    return emitter;
  }

  update(delta: number): void {
    for (const emitter of this.emitters) {
      emitter.update(delta);
    }
  }
}

// Individual particle emitter
export class ParticleEmitter extends Group {
  private particleGeometry: BufferGeometry;
  private particleMaterial: PointsMaterial;
  private particlePoints: Points;
  private particles: {
    position: Vector3;
    velocity: Vector3;
    lifetime: number;
    maxLifetime: number;
    size: number;
  }[] = [];
  private options: ParticleEmitterOptions;
  private isEmitting: boolean = false;
  private emissionInterval: number = 0.05;
  private timeSinceLastEmit: number = 0;

  constructor(options: ParticleEmitterOptions = {}) {
    super();
    
    this.options = {
      count: options.count || 100,
      size: options.size || 0.1,
      color: options.color || 0xffffff,
      lifetime: options.lifetime || 1.0,
      speed: options.speed || 1.0,
      direction: options.direction || new Vector3(0, 1, 0),
      spread: options.spread || 0.2,
      gravity: options.gravity || 0.5,
      emissionRate: options.emissionRate || 0.05
    };
    
    // Initialize particle geometry
    this.particleGeometry = new BufferGeometry();
    const positions = new Float32Array(this.options.count * 3);
    const sizes = new Float32Array(this.options.count);
    const colors = new Float32Array(this.options.count * 3);
    
    // Set default values
    for (let i = 0; i < this.options.count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      sizes[i] = 0;
      
      const color = new Color(this.options.color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    this.particleGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.particleGeometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    this.particleGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    
    // Create particle material
    this.particleMaterial = new PointsMaterial({
      size: this.options.size,
      vertexColors: true,
      blending: AdditiveBlending,
      transparent: true,
      sizeAttenuation: true,
      depthWrite: false
    });
    
    // Create points system
    this.particlePoints = new Points(this.particleGeometry, this.particleMaterial);
    this.add(this.particlePoints);
    
    // Initialize particles array
    for (let i = 0; i < this.options.count; i++) {
      this.particles.push({
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(0, 0, 0),
        lifetime: 0,
        maxLifetime: 0,
        size: 0
      });
    }
    
    this.emissionInterval = this.options.emissionRate || 0.05;
    this.timeSinceLastEmit = 0;
  }
  
  start(): void {
    this.isEmitting = true;
  }
  
  stop(): void {
    this.isEmitting = false;
  }
  
  emit(count: number = 10): void {
    const direction = this.options.direction.clone().normalize();
    const speed = this.options.speed;
    const spread = this.options.spread;
    const lifetime = this.options.lifetime;
    
    let emitted = 0;
    
    for (let i = 0; i < this.particles.length && emitted < count; i++) {
      const particle = this.particles[i];
      
      // Only use inactive particles
      if (particle.lifetime <= 0) {
        // Reset position
        particle.position.set(0, 0, 0);
        
        // Random direction within spread
        const randomDir = direction.clone();
        randomDir.x += (Math.random() - 0.5) * spread;
        randomDir.y += (Math.random() - 0.5) * spread;
        randomDir.z += (Math.random() - 0.5) * spread;
        randomDir.normalize();
        
        // Set velocity
        particle.velocity.copy(randomDir).multiplyScalar(speed);
        
        // Set lifetime
        particle.maxLifetime = lifetime * (0.8 + Math.random() * 0.4);
        particle.lifetime = particle.maxLifetime;
        
        // Set size
        particle.size = this.options.size;
        
        emitted++;
      }
    }
    
    // Update geometry
    this.updateGeometry();
  }
  
  updateGeometry(): void {
    const positions = this.particleGeometry.getAttribute('position').array as Float32Array;
    const sizes = this.particleGeometry.getAttribute('size').array as Float32Array;
    
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      
      // Update position in buffer
      positions[i * 3] = particle.position.x;
      positions[i * 3 + 1] = particle.position.y;
      positions[i * 3 + 2] = particle.position.z;
      
      // Update size in buffer
      sizes[i] = particle.lifetime > 0 ? particle.size * (particle.lifetime / particle.maxLifetime) : 0;
    }
    
    this.particleGeometry.getAttribute('position').needsUpdate = true;
    this.particleGeometry.getAttribute('size').needsUpdate = true;
  }
  
  update(delta: number): void {
    // Update emission
    if (this.isEmitting) {
      this.timeSinceLastEmit += delta;
      
      if (this.timeSinceLastEmit >= this.emissionInterval) {
        const emitCount = Math.floor(this.timeSinceLastEmit / this.emissionInterval);
        this.emit(emitCount);
        this.timeSinceLastEmit %= this.emissionInterval;
      }
    }
    
    // Update particles
    const gravity = this.options.gravity;
    
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      
      if (particle.lifetime > 0) {
        // Apply gravity
        particle.velocity.y -= gravity * delta;
        
        // Update position
        particle.position.addScaledVector(particle.velocity, delta);
        
        // Update lifetime
        particle.lifetime -= delta;
      }
    }
    
    // Update geometry
    this.updateGeometry();
  }
}

export function createHitEffect(
  scene: Scene, 
  position: Vector3,
  color: number = 0xff0000,
  size: number = 0.5,
  duration: number = 500
): void {
  // Create a sphere for the hit effect
  const geometry = new SphereGeometry(size, 8, 8);
  const material = new MeshBasicMaterial({ 
    color: color,
    transparent: true,
    opacity: 0.7
  });
  
  const hitEffect = new Mesh(geometry, material);
  hitEffect.position.copy(position);
  scene.add(hitEffect);
  
  // Animation variables
  const startTime = Date.now();
  const startOpacity = material.opacity;
  const startScale = hitEffect.scale.x;
  
  // Animate the hit effect
  function animate() {
    const elapsedTime = Date.now() - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    
    // Fade out and expand
    material.opacity = startOpacity * (1 - progress);
    const newScale = startScale * (1 + progress);
    hitEffect.scale.set(newScale, newScale, newScale);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Clean up
      scene.remove(hitEffect);
      geometry.dispose();
      material.dispose();
    }
  }
  
  // Start animation
  animate();
}

// Additional utility for creating particle effects
export function createParticleEffect(
  scene: Scene,
  position: Vector3,
  count: number = 10,
  color: number = 0xffff00,
  size: number = 0.1,
  speed: number = 2,
  duration: number = 1000
): void {
  const particles: Object3D[] = [];
  
  // Create particles
  for (let i = 0; i < count; i++) {
    const geometry = new SphereGeometry(size * (0.5 + Math.random() * 0.5), 4, 4);
    const material = new MeshBasicMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.8
    });
    
    const particle = new Mesh(geometry, material);
    particle.position.copy(position);
    
    // Random direction
    const direction = new Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ).normalize();
    
    // Store direction and velocity on the particle
    (particle as any).direction = direction;
    (particle as any).velocity = speed * (0.5 + Math.random() * 0.5);
    
    particles.push(particle);
    scene.add(particle);
  }
  
  // Animation
  const startTime = Date.now();
  
  function animate() {
    const elapsedTime = Date.now() - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    
    // Move and fade particles
    particles.forEach(particle => {
      const direction = (particle as any).direction;
      const velocity = (particle as any).velocity;
      
      particle.position.add(direction.clone().multiplyScalar(velocity * 0.1));
      (particle.material as MeshBasicMaterial).opacity = 0.8 * (1 - progress);
    });
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Clean up
      particles.forEach(particle => {
        scene.remove(particle);
        (particle as Mesh).geometry.dispose();
        (particle as Mesh).material.dispose();
      });
    }
  }
  
  // Start animation
  animate();
}

export function createSaberClashEffect(
  scene: Scene,
  position: Vector3,
  color: number = 0xffaa00, // Yellow-orange for clash
  size: number = 0.8,
  duration: number = 800
): void {
  // Create central flash
  createHitEffect(scene, position, color, size, duration);
  
  // Create particle burst
  createParticleEffect(
    scene,
    position,
    15, // More particles for dramatic effect
    color,
    0.15,
    3.5, // Faster particles
    duration
  );
  
  // Create additional shock wave effect
  const geometry = new SphereGeometry(size * 0.5, 16, 16);
  const material = new MeshBasicMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    wireframe: true
  });
  
  const shockwave = new Mesh(geometry, material);
  shockwave.position.copy(position);
  scene.add(shockwave);
  
  // Animation variables
  const startTime = Date.now();
  
  // Animate the shockwave
  function animateShockwave() {
    const elapsedTime = Date.now() - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    
    // Expand and fade
    const newScale = 1 + progress * 3;
    shockwave.scale.set(newScale, newScale, newScale);
    material.opacity = 0.9 * (1 - progress);
    
    if (progress < 1) {
      requestAnimationFrame(animateShockwave);
    } else {
      // Clean up
      scene.remove(shockwave);
      geometry.dispose();
      material.dispose();
    }
  }
  
  // Start animation
  animateShockwave();
}
