import {
  Scene,
  Vector3,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  Group,
  Color,
  Object3D,
} from 'three';

export interface ParticleOptions {
  count: number;
  color: string | Color;
  size: number;
  speed: number;
  spread: number;
  lifetime: number;
  gravity?: number;
}

export class ParticleSystem {
  private scene: Scene;
  private particles: Group;
  private systems: ParticleEmitter[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    this.particles = new Group();
    this.scene.add(this.particles);
  }

  createEmitter(
    position: Vector3,
    options: ParticleOptions
  ): ParticleEmitter {
    const emitter = new ParticleEmitter(options);
    emitter.position.copy(position);
    this.particles.add(emitter);
    this.systems.push(emitter);
    return emitter;
  }

  update(deltaTime: number): void {
    // Update all particle systems and remove dead ones
    for (let i = this.systems.length - 1; i >= 0; i--) {
      const system = this.systems[i];
      system.update(deltaTime);

      if (system.isDead()) {
        this.particles.remove(system);
        this.systems.splice(i, 1);
      }
    }
  }
}

class ParticleEmitter extends Group {
  private points: Points;
  private geometry: BufferGeometry;
  private material: PointsMaterial;
  private velocities: number[] = [];
  private lifetimes: number[] = [];
  private maxLifetime: number;
  private elapsedTime: number = 0;
  private options: ParticleOptions;
  private isDone: boolean = false;

  constructor(options: ParticleOptions) {
    super();
    this.options = options;
    this.maxLifetime = options.lifetime;

    // Create geometry
    this.geometry = new BufferGeometry();
    const positions: number[] = [];
    const sizes: number[] = [];
    const colors: number[] = [];
    this.velocities = [];
    this.lifetimes = [];

    const color = options.color instanceof Color 
      ? options.color 
      : new Color(options.color);

    for (let i = 0; i < options.count; i++) {
      // Initial position
      positions.push(0, 0, 0);

      // Random velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = options.speed * (0.5 + Math.random() * 0.5);
      const vx = Math.cos(angle) * speed * (Math.random() - 0.5) * 2 * options.spread;
      const vy = Math.sin(angle) * speed * (Math.random() - 0.5) * 2 * options.spread;
      const vz = Math.random() * speed * options.spread;
      this.velocities.push(vx, vy, vz);

      // Size
      const size = options.size * (0.5 + Math.random() * 0.5);
      sizes.push(size);

      // Color with slight variation
      const particleColor = color.clone();
      particleColor.r += (Math.random() - 0.5) * 0.1;
      particleColor.g += (Math.random() - 0.5) * 0.1;
      particleColor.b += (Math.random() - 0.5) * 0.1;
      colors.push(particleColor.r, particleColor.g, particleColor.b);

      // Lifetime
      this.lifetimes.push(options.lifetime * (0.8 + Math.random() * 0.4));
    }

    this.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('customSize', new Float32BufferAttribute(sizes, 1));
    this.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

    // Create material
    this.material = new PointsMaterial({
      size: 1,
      vertexColors: true,
      transparent: true,
      opacity: 1,
    });

    // Create points
    this.points = new Points(this.geometry, this.material);
    this.add(this.points);
  }

  update(deltaTime: number): void {
    if (this.isDone) return;

    this.elapsedTime += deltaTime;
    if (this.elapsedTime > this.maxLifetime) {
      this.isDone = true;
      return;
    }

    const positions = this.geometry.attributes.position.array as number[];
    const sizes = this.geometry.attributes.customSize.array as number[];
    let anyParticleAlive = false;

    for (let i = 0; i < this.options.count; i++) {
      const idx = i * 3;
      const sizeIdx = i;
      const velocityIdx = i * 3;
      
      // Update lifetime
      this.lifetimes[i] -= deltaTime;
      const normalizedLife = Math.max(0, this.lifetimes[i] / this.maxLifetime);
      
      if (this.lifetimes[i] > 0) {
        anyParticleAlive = true;
        
        // Update position
        positions[idx] += this.velocities[velocityIdx] * deltaTime;
        positions[idx + 1] += this.velocities[velocityIdx + 1] * deltaTime;
        positions[idx + 2] += this.velocities[velocityIdx + 2] * deltaTime;
        
        // Apply gravity if specified
        if (this.options.gravity) {
          this.velocities[velocityIdx + 1] -= this.options.gravity * deltaTime;
        }
        
        // Update size
        sizes[sizeIdx] = this.options.size * normalizedLife;
        
        // Update material opacity based on lifetime
        this.material.opacity = Math.min(1, normalizedLife * 2);
      }
    }

    if (!anyParticleAlive) {
      this.isDone = true;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.customSize.needsUpdate = true;
  }

  isDead(): boolean {
    return this.isDone;
  }
}

export function createSaberClashEffect(scene: Scene, position: Vector3, color: string): void {
  const particleSystem = new ParticleSystem(scene);
  
  // Create spark particles
  particleSystem.createEmitter(position, {
    count: 50,
    color: color,
    size: 0.02,
    speed: 2,
    spread: 1,
    lifetime: 0.5,
    gravity: 9.8
  });
  
  // Create glow particles
  particleSystem.createEmitter(position, {
    count: 20,
    color: '#ffffff',
    size: 0.05,
    speed: 1,
    spread: 0.5,
    lifetime: 0.3
  });
}

export function createHitEffect(scene: Scene, position: Vector3, color: string): void {
  const particleSystem = new ParticleSystem(scene);
  
  particleSystem.createEmitter(position, {
    count: 30,
    color: color,
    size: 0.03,
    speed: 2,
    spread: 0.8,
    lifetime: 0.7,
    gravity: 5
  });
}

export function attachToObject(obj: Object3D, effect: ParticleEmitter): void {
  obj.add(effect);
}
