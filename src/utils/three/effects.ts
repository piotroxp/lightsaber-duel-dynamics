
import { 
  Group, 
  Mesh, 
  MeshBasicMaterial, 
  SphereGeometry, 
  Vector3, 
  Color,
  AdditiveBlending
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
}

// Create a simple hit effect
export function createHitEffect(position: Vector3, scene: any): void {
  const emitter = new ParticleEmitter({
    count: 20,
    size: 0.05,
    color: 0xff0000,
    lifetime: 0.5,
    speed: 2,
    direction: new Vector3(0, 1, 0),
    spread: 1
  });
  
  emitter.position.copy(position);
  scene.add(emitter);
  emitter.start();
  
  // Remove after effect is done
  setTimeout(() => {
    scene.remove(emitter);
  }, 500);
}

// Create a lightsaber clash effect
export function createSaberClashEffect(position: Vector3, scene: any): void {
  const emitter = new ParticleEmitter({
    count: 30,
    size: 0.03,
    color: 0xffff00,
    lifetime: 0.3,
    speed: 3,
    direction: new Vector3(0, 0, 0),
    spread: 1
  });
  
  emitter.position.copy(position);
  scene.add(emitter);
  emitter.start();
  
  // Remove after effect is done
  setTimeout(() => {
    scene.remove(emitter);
  }, 300);
}
