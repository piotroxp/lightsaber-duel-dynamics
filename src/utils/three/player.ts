import { 
  Group, 
  Vector3, 
  Object3D, 
  Camera,
  Quaternion,
  Raycaster,
  Scene,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  BoxGeometry
} from 'three';
import { Lightsaber } from './lightsaber';
import gameAudio from './audio';
import { createHitEffect } from './effects';

enum PlayerState {
  IDLE = 'idle',
  MOVING = 'moving',
  ATTACKING = 'attacking',
  BLOCKING = 'blocking',
  STAGGERED = 'staggered',
  DEAD = 'dead'
}

export class Player extends Group {
  private camera: Camera;
  private lightsaber: Lightsaber;
  private scene: Scene;
  private moveSpeed: number = 5;
  private health: number = 100;
  private maxHealth: number = 100;
  private isMovingForward: boolean = false;
  private isMovingBackward: boolean = false;
  private isMovingLeft: boolean = false;
  private isMovingRight: boolean = false;
  private isAttackPressed: boolean = false;
  private isBlockPressed: boolean = false;
  private state: PlayerState = PlayerState.IDLE;
  private attackCooldown: number = 0.5; // seconds
  private lastAttackTime: number = 0;
  private debugMode: boolean = false;
  
  constructor(camera: Camera, scene: Scene) {
    super();
    
    this.camera = camera;
    this.scene = scene;
    
    // Create debug visual for player position
    if (this.debugMode) {
      const playerMarker = new Mesh(
        new SphereGeometry(0.2, 8, 8),
        new MeshBasicMaterial({ color: 0x00ff00 })
      );
      playerMarker.position.y = 1;
      this.add(playerMarker);
    }
    
    // Create lightsaber with proper options object
    this.lightsaber = new Lightsaber({
      color: '#3366ff', // Blue color
      bladeLength: 1.2,
      hiltLength: 0.2
    });
    this.lightsaber.position.set(0.4, -0.3, -0.5); // Position relative to camera
    this.camera.add(this.lightsaber);
    
    // Add keyboard event listeners
    this.setupEventListeners();
    
    // Activate lightsaber with delay for effect
    setTimeout(() => {
      this.lightsaber.activate();
    }, 1000);
  }
  
  private setupEventListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }
  
  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
        this.isMovingForward = true;
        break;
      case 'KeyS':
        this.isMovingBackward = true;
        break;
      case 'KeyA':
        this.isMovingLeft = true;
        break;
      case 'KeyD':
        this.isMovingRight = true;
        break;
    }
  }
  
  private handleKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
        this.isMovingForward = false;
        break;
      case 'KeyS':
        this.isMovingBackward = false;
        break;
      case 'KeyA':
        this.isMovingLeft = false;
        break;
      case 'KeyD':
        this.isMovingRight = false;
        break;
    }
  }
  
  private handleMouseDown(event: MouseEvent): void {
    if (event.button === 0) { // Left mouse button
      this.isAttackPressed = true;
      this.attack();
    } else if (event.button === 2) { // Right mouse button
      this.isBlockPressed = true;
      this.block();
    }
  }
  
  private handleMouseUp(event: MouseEvent): void {
    if (event.button === 0) { // Left mouse button
      this.isAttackPressed = false;
    } else if (event.button === 2) { // Right mouse button
      this.isBlockPressed = false;
    }
  }
  
  update(deltaTime: number): void {
    if (this.state === PlayerState.DEAD) return;
    
    // Handle movement
    this.handleMovement(deltaTime);
    
    // Update position
    this.position.copy(this.camera.position);
  }
  
  private handleMovement(deltaTime: number): void {
    if (this.state === PlayerState.STAGGERED) return;
    
    const direction = new Vector3();
    const cameraDirection = new Vector3();
    
    // Get camera direction
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Keep movement on horizontal plane
    cameraDirection.normalize();
    
    // Calculate right vector
    const right = new Vector3();
    right.crossVectors(new Vector3(0, 1, 0), cameraDirection).normalize();
    
    // Apply movement inputs
    if (this.isMovingForward) {
      direction.add(cameraDirection);
    }
    if (this.isMovingBackward) {
      direction.sub(cameraDirection);
    }
    if (this.isMovingRight) {
      direction.add(right);
    }
    if (this.isMovingLeft) {
      direction.sub(right);
    }
    
    // Normalize and apply movement
    if (direction.lengthSq() > 0) {
      direction.normalize();
      
      // Move the camera
      const moveAmount = this.moveSpeed * deltaTime;
      this.camera.position.add(direction.multiplyScalar(moveAmount));
      
      // Limit the camera Y position to prevent flying/falling
      this.camera.position.y = 1.7; // Eye level height
      
      this.state = PlayerState.MOVING;
    } else if (this.state !== PlayerState.ATTACKING && this.state !== PlayerState.BLOCKING) {
      this.state = PlayerState.IDLE;
    }
  }
  
  private attack(): void {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.STAGGERED) return;
    
    const currentTime = performance.now() / 1000;
    if (currentTime - this.lastAttackTime < this.attackCooldown) return;
    
    this.lastAttackTime = currentTime;
    this.state = PlayerState.ATTACKING;
    
    // Swing lightsaber using the enhanced swing method
    this.lightsaber.swing();
    
    // Reset state after attack
    setTimeout(() => {
      if (this.state === PlayerState.ATTACKING) {
        this.state = PlayerState.IDLE;
      }
    }, 500);
  }
  
  private block(): void {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.STAGGERED) return;
    
    this.state = PlayerState.BLOCKING;
    
    // Block with lightsaber using the block method
    this.lightsaber.block();
    
    // Reset state when block button released
    setTimeout(() => {
      if (this.state === PlayerState.BLOCKING && !this.isBlockPressed) {
        this.state = PlayerState.IDLE;
      }
    }, 100);
  }
  
  takeDamage(amount: number): void {
    if (this.state === PlayerState.DEAD) return;
    
    // Reduce damage if blocking
    let actualDamage = amount;
    if (this.state === PlayerState.BLOCKING) {
      actualDamage *= 0.2; // 80% damage reduction when blocking
    }
    
    // Apply damage
    this.health -= actualDamage;
    
    // Clamp health to 0
    if (this.health < 0) this.health = 0;
    
    // Check for death
    if (this.health <= 0) {
      this.state = PlayerState.DEAD;
    } else {
      // Stagger briefly
      this.state = PlayerState.STAGGERED;
      
      // Show damage effect
      this.createDamageEffect();
      
      // Reset state after stagger
      setTimeout(() => {
        if (this.state === PlayerState.STAGGERED) {
          this.state = PlayerState.IDLE;
        }
      }, 500);
    }
  }
  
  private createDamageEffect(): void {
    try {
      createHitEffect(this.position, this.scene);
      
      // Play hit sound
      gameAudio.playSound('player_hit', { volume: 0.5 });
    } catch (error) {
      console.warn("Failed to create damage effect:", error);
    }
  }
  
  // Getters
  isAttacking(): boolean {
    return this.state === PlayerState.ATTACKING;
  }
  
  isBlocking(): boolean {
    return this.state === PlayerState.BLOCKING;
  }
  
  isAlive(): boolean {
    return this.state !== PlayerState.DEAD;
  }
  
  getHealth(): number {
    return this.health;
  }
  
  getMaxHealth(): number {
    return this.maxHealth;
  }
  
  getLightsaberPosition(): Vector3 {
    return this.lightsaber.getBladeTopPosition();
  }
  
  getLightsaberRotation(): Quaternion {
    return this.lightsaber.quaternion;
  }
  
  getPosition(): Vector3 {
    return this.position;
  }
  
  getDirection(): Vector3 {
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    return direction;
  }
  
  getQuaternion(): Quaternion {
    return this.camera.quaternion;
  }
}
