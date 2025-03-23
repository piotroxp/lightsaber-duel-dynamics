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
  private lastBlockTime: number = 0;
  private debugMode: boolean = false;
  private isThirdPerson: boolean = false;
  private originalCameraPosition: Vector3 = new Vector3();
  
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
      hiltLength: 0.25, // Slightly longer hilt
      glowIntensity: 1.2
    });
    
    // Reposition lightsaber so only top 25% of hilt is visible in normal position
    this.lightsaber.position.set(0.1, -0.47, -0.35);
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
    // Skip if player is dead
    if (this.state === PlayerState.DEAD) return;
    
    // Map keys to movement flags
    switch (event.key.toLowerCase()) {
      case 'w':
        this.isMovingForward = true;
        break;
      case 's':
        this.isMovingBackward = true;
        break;
      case 'a':  // Ensure A maps to moving LEFT
        this.isMovingLeft = true;
        break;
      case 'd':  // Ensure D maps to moving RIGHT
        this.isMovingRight = true;
        break;
      case '3':  // Toggle third-person view
        this.toggleThirdPersonView();
        break;
    }
  }
  
  private handleKeyUp(event: KeyboardEvent): void {
    // Map keys to movement flags
    switch (event.key.toLowerCase()) {
      case 'w':
        this.isMovingForward = false;
        break;
      case 's':
        this.isMovingBackward = false;
        break;
      case 'a':  // Ensure A maps to moving LEFT
        this.isMovingLeft = false;
        break;
      case 'd':  // Ensure D maps to moving RIGHT
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
    
    // Check if we should end blocking state when button released
    if (this.state === PlayerState.BLOCKING && !this.isBlockPressed) {
      this.state = PlayerState.IDLE;
    }
    
    // If in first-person, update position as normal
    if (!this.isThirdPerson) {
      this.position.copy(this.camera.position);
      this.position.y = 1.7; // Keep player at eye level
    } else {
      // In third-person, we need to update camera position based on player movement
      const cameraDirection = new Vector3();
      this.camera.getWorldDirection(cameraDirection);
      
      // Position camera behind and above player
      const thirdPersonPosition = this.position.clone()
        .sub(cameraDirection.normalize().multiplyScalar(3))
        .add(new Vector3(0, 1.5, 0));
      
      this.camera.position.copy(thirdPersonPosition);
    }
  }
  
  private handleMovement(deltaTime: number): void {
    if (this.state === PlayerState.STAGGERED) return;
    
    const direction = new Vector3();
    const cameraDirection = new Vector3();
    
    // Get camera direction
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Keep movement on horizontal plane
    cameraDirection.normalize();
    
    // FIXED: Correctly calculate right vector with proper cross product order
    const right = new Vector3();
    right.crossVectors(cameraDirection, new Vector3(0, 1, 0)).normalize();
    
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
    if (this.state === PlayerState.ATTACKING || 
        this.state === PlayerState.DEAD || 
        this.state === PlayerState.STAGGERED) return;
    
    // Check cooldown
    const currentTime = performance.now() / 1000;
    if (currentTime - this.lastAttackTime < this.attackCooldown) return;
    
    this.lastAttackTime = currentTime;
    this.state = PlayerState.ATTACKING;
    
    // Determine movement direction for swing
    let movementDirection: 'left' | 'right' | 'forward' | 'none' = 'none';
    
    if (this.isMovingLeft) {
      movementDirection = 'left';
    } else if (this.isMovingRight) {
      movementDirection = 'right';
    } else if (this.isMovingForward) {
      movementDirection = 'forward';
    }
    
    // Swing lightsaber using the enhanced swing method with direction
    this.lightsaber.swing(movementDirection);
    
    // Reset state after attack animation
    setTimeout(() => {
      if (this.state === PlayerState.ATTACKING) {
        this.state = PlayerState.IDLE;
      }
    }, 300);
  }
  
  private block(): void {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.STAGGERED) return;
    
    // Set blocking state
    this.state = PlayerState.BLOCKING;
    
    // Block with lightsaber
    this.lightsaber.block();
    
    // Play block sound
    gameAudio.playSound('lightsaberMove', { volume: 0.4 });
    
    // Keep track of block time
    this.lastBlockTime = performance.now() / 1000;
  }
  
  public takeDamage(amount: number, attackerPosition: Vector3): void {
    console.log(`[PLAYER] Taking ${amount} damage from position:`, attackerPosition);
    console.log(`[PLAYER] Current health before damage: ${this.health}`);
    
    // Skip if already dead
    if (this.state === PlayerState.DEAD) {
      console.log("[PLAYER] Already dead, ignoring damage");
      return;
    }
    
    // Check if we're blocking
    if (this.state === PlayerState.BLOCKING) {
      console.log("[PLAYER] Blocking! Damage reduced");
      amount = Math.floor(amount * 0.2); // 80% damage reduction when blocking
    }
    
    // Apply damage
    this.health = Math.max(0, this.health - amount);
    console.log(`[PLAYER] Health after damage: ${this.health}`);
    
    // Create hit effect
    createHitEffect(this.scene, this.position.clone().add(new Vector3(0, 1.2, 0)), '#ff0000');
    
    // Play hit sound
    gameAudio.playSound('playerHit', { volume: 0.7 });
    
    // Dispatch health changed event
    this.dispatchEvent({ 
      type: 'healthChanged', 
      health: this.health, 
      maxHealth: this.maxHealth 
    });
    
    if (this.health <= 0) {
      console.log("[PLAYER] Player died!");
      this.state = PlayerState.DEAD;
      this.dispatchEvent({ type: 'died' });
    } else {
      // Apply short stagger
      this.state = PlayerState.STAGGERED;
      setTimeout(() => {
        if (this.state === PlayerState.STAGGERED) {
          this.state = PlayerState.IDLE;
        }
      }, 200);
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
    try {
      if (this.lightsaber && typeof this.lightsaber.getBladeTipPosition === 'function') {
        return this.lightsaber.getBladeTipPosition();
      } else {
        const offset = new Vector3(0.8, 1.0, 0.5);
        const rotatedOffset = offset.clone().applyQuaternion(this.quaternion);
        return this.position.clone().add(rotatedOffset);
      }
    } catch (error) {
      console.error("Error getting lightsaber position:", error);
      return this.position.clone().add(new Vector3(0, 1, 0));
    }
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
  
  applyStagger(duration: number): void {
    if (this.state === PlayerState.DEAD) return;
    
    this.state = PlayerState.STAGGERED;
    
    setTimeout(() => {
      if (this.state === PlayerState.STAGGERED) {
        this.state = PlayerState.IDLE;
      }
    }, duration * 1000);
  }
  
  getLightsaber(): Lightsaber | null {
    return this.lightsaber;
  }
  
  toggleThirdPersonView(): void {
    this.isThirdPerson = !this.isThirdPerson;
    
    if (this.isThirdPerson) {
      // Store original position
      this.originalCameraPosition.copy(this.camera.position);
      
      // Move camera back and up for third-person view
      const cameraDirection = new Vector3();
      this.camera.getWorldDirection(cameraDirection);
      
      // Position camera behind and above player
      const thirdPersonPosition = this.position.clone()
        .sub(cameraDirection.multiplyScalar(3))  // Move back
        .add(new Vector3(0, 1.5, 0));            // Move up
      
      this.camera.position.copy(thirdPersonPosition);
    } else {
      // Restore first-person view
      this.camera.position.copy(this.originalCameraPosition);
    }
    
    console.log(`Camera view changed to ${this.isThirdPerson ? 'third' : 'first'} person`);
  }
}
