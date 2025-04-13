import { 
  Group, 
  Mesh, 
  MeshBasicMaterial, 
  SphereGeometry, 
  Vector3, 
  Color,
  AdditiveBlending,
  Scene
} from 'three';

interface ParticleOptions {
  count: number;
  size: number;
  color: number;
  lifetime: number;
  speed: number;
  direction: Vector3;
  spread: number;
}

// Simple particle system
export class ParticleEmitter extends Group {
  private particles: Mesh[] = [];
  private velocities: Vector3[] = [];
  private lifetimes: number[] = [];
  private maxLifetime: number;
  private isActive: boolean = false;
  private options: ParticleOptions;
  
  constructor(options: ParticleOptions) {
    super();
    
    this.options = options;
    this.maxLifetime = options.lifetime;
    
    // Create particle meshes
    for (let i = 0; i < options.count; i++) {
      // Create particle
      const geometry = new SphereGeometry(options.size, 4, 4);
      const material = new MeshBasicMaterial({
        color: options.color,
        transparent: true,
        opacity: 0.8,
        blending: AdditiveBlending
      });
      
      const particle = new Mesh(geometry, material);
      particle.visible = false;
      
      // Add to group
      this.add(particle);
      this.particles.push(particle);
      
      // Initialize velocity and lifetime
      const velocity = this.getRandomVelocity();
      this.velocities.push(velocity);
      this.lifetimes.push(0);
    }
  }
  
  private getRandomVelocity(): Vector3 {
    const { direction, spread, speed } = this.options;
    
    // Create random offset within spread
    const offset = new Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    );
    
    // Create velocity vector
    return direction.clone()
      .add(offset)
      .normalize()
      .multiplyScalar(speed * (0.5 + Math.random() * 0.5));
  }
  
  start(): void {
    this.isActive = true;
    
    // Reset particles
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].visible = false;
      this.lifetimes[i] = 0;
    }
  }
  
  stop(): void {
    this.isActive = false;
    
    // Hide all particles
    for (const particle of this.particles) {
      particle.visible = false;
    }
  }
  
  update(deltaTime: number): void {
    if (!this.isActive) return;
    
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const velocity = this.velocities[i];
      
      // Update lifetime
      this.lifetimes[i] += deltaTime;
      
      if (this.lifetimes[i] >= this.maxLifetime) {
        // Reset particle if lifetime expired
        particle.visible = false;
        this.lifetimes[i] = 0;
        this.velocities[i] = this.getRandomVelocity();
        particle.position.set(0, 0, 0);
        
        // Only spawn a new particle occasionally for continuous effect
        if (Math.random() < 0.1) {
          particle.visible = true;
        }
      } else if (!particle.visible && Math.random() < 0.05) {
        // Randomly activate some particles
        particle.visible = true;
      }
      
      if (particle.visible) {
        // Update position
        particle.position.add(velocity.clone().multiplyScalar(deltaTime));
        
        // Update opacity based on lifetime
        const opacity = 1 - (this.lifetimes[i] / this.maxLifetime);
        const scale = 1 - (this.lifetimes[i] / this.maxLifetime) * 0.5;
        
        if (particle.material instanceof MeshBasicMaterial) {
          particle.material.opacity = opacity;
        }
        
        particle.scale.set(scale, scale, scale);
      }
    }
  }

  setEmissionRate(rate: number): void {
    // Adjust how many particles are visible based on the rate
    const visibleCount = Math.round(this.options.count * rate);
    
    for (let i = 0; i < this.particles.length; i++) {
      // Show particles up to the visible count
      if (i < visibleCount) {
        this.particles[i].visible = true;
      } else {
        this.particles[i].visible = false;
      }
    }
  }

  setColor(color: number): void {
    // Update the color for all particles
    this.options.color = color;
    
    // Update existing particles
    this.particles.forEach(particle => {
      if (particle.material instanceof MeshBasicMaterial) {
        particle.material.color.setHex(color);
      }
    });
  }

  setActive(active: boolean): void {
    this.isActive = active;
  }
}

// Create a simple hit effect
export function createHitEffect(
  scene: Scene, 
  position: Vector3, 
  size: number = 0.1, 
  color: number = 0xFFFFFF,
  direction?: Vector3,
  speed: number = 0,
  lifetime: number = 300
): void {
  // Create a mesh for the hit effect
  const geometry = new SphereGeometry(size, 8, 8);
  const material = new MeshBasicMaterial({ 
    color: color,
    transparent: true,
    opacity: 1.0 
  });
  
  const hitEffect = new Mesh(geometry, material);
  hitEffect.position.copy(position);
  
  // Add to scene
  scene.add(hitEffect);
  
  // Set up animation
  const startTime = performance.now();
  const velocity = direction ? direction.clone().multiplyScalar(speed) : new Vector3();
  
  const animateParticle = () => {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = elapsed / lifetime;
    
    if (progress >= 1) {
      // Remove effect when animation completes
      scene.remove(hitEffect);
      geometry.dispose();
      material.dispose();
      return;
    }
    
    // Update position based on velocity and gravity
    if (velocity.length() > 0) {
      hitEffect.position.add(velocity);
      velocity.y -= 0.001; // Simple gravity
    }
    
    // Fade out and scale down
    material.opacity = 1 - progress;
    const scale = 1 - (progress * 0.5);
    hitEffect.scale.set(scale, scale, scale);
    
    // Continue animation
    requestAnimationFrame(animateParticle);
  };
  
  // Start animation
  requestAnimationFrame(animateParticle);
}

// Create a more intense clash effect with multiple particles
export function createClashEffect(
  scene: Scene,
  position: Vector3,
  intensity: number = 1.0
): void {
  // Create center flash
  createHitEffect(
    scene,
    position.clone(),
    0.15 * intensity,
    0xFFFFFF,
    undefined,
    0,
    200
  );
  
  // Create spark shower
  const sparkCount = Math.floor(15 * intensity);
  for (let i = 0; i < sparkCount; i++) {
    // Calculate random direction
    const angle = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.3) * Math.PI; // Bias upward
    
    const direction = new Vector3(
      Math.cos(angle) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(angle) * Math.cos(elevation)
    );
    
    // Randomize properties
    const size = 0.02 + Math.random() * 0.04 * intensity;
    const speed = 0.01 + Math.random() * 0.05 * intensity;
    const lifetime = 300 + Math.random() * 500;
    
    // Create spark with slight delay for better visual
    setTimeout(() => {
      createHitEffect(
        scene,
        position.clone(),
        size,
        0xFFFF99, // Yellowish color
        direction,
        speed,
        lifetime
      );
    }, i * 20);
  }
}

// Create a lightsaber clash effect
export function createSaberClashEffect(scene: Scene, position: Vector3, color: string = '#ffff00'): void {
  const colorValue = color.startsWith('#') ? parseInt(color.replace('#', '0x')) : 0xffff00;
  
  // Main sparks
  const emitter = new ParticleEmitter({
    count: 40,
    size: 0.035,
    color: colorValue,
    lifetime: 0.4,
    speed: 4,
    direction: new Vector3(0, 0, 0),
    spread: 1.2
  });
  
  emitter.position.copy(position);
  scene.add(emitter);
  emitter.start();
  
  // White flash core
  const flashEmitter = new ParticleEmitter({
    count: 15,
    size: 0.05,
    color: 0xffffff,
    lifetime: 0.2,
    speed: 2,
    direction: new Vector3(0, 0, 0),
    spread: 0.8
  });
  
  flashEmitter.position.copy(position);
  scene.add(flashEmitter);
  flashEmitter.start();
  
  // Remove after effect is done
  setTimeout(() => {
    scene.remove(emitter);
    scene.remove(flashEmitter);
  }, 500);
}

// Add enhanced glow method for lightsabers
export function createLightsaberGlow(scene: Scene, position: Vector3, color: string = '#3366ff'): ParticleEmitter {
  const colorValue = color.startsWith('#') ? parseInt(color.replace('#', '0x')) : 0x3366ff;
  
  const emitter = new ParticleEmitter({
    count: 30,
    size: 0.02,
    color: colorValue,
    lifetime: 0.3,
    speed: 0.05,
    direction: new Vector3(0, 0, 0),
    spread: 0.2
  });
  
  emitter.position.copy(position);
  scene.add(emitter);
  
  return emitter;
}
