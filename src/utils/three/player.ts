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
  BoxGeometry,
  CylinderGeometry,
  Matrix4,
  Vector2,
  Euler,
  MathUtils
} from 'three';
import { Lightsaber } from './lightsaber';
import gameAudio from './audio';
import { createHitEffect } from './effects';

// Extend Three.js event types with our custom events
declare global {
  namespace THREE {
    interface Object3DEventMap {
      healthChanged: any;
      died: {};
    }
  }
}

enum PlayerState {
  IDLE = 'idle',
  MOVING = 'moving',
  ATTACKING = 'attacking',
  BLOCKING = 'blocking',
  STAGGERED = 'staggered',
  DEAD = 'dead'
}

export class Player extends Group {
  // Add explicit declarations to help TypeScript recognize inherited properties
  declare position: Vector3;
  declare quaternion: Quaternion;
  declare parent: Object3D;
  
  // Add missing properties for movement and physics
  private velocity: Vector3 = new Vector3();
  private moveDirection: Vector3 = new Vector3();
  private groundMeshes: Object3D[] = [];
  private gravity: number = 9.8;
  private jumpForce: number = 5;
  private height: number = 1.8;
  private isGrounded: boolean = true;
  private isJumping: boolean = false;
  private isJumpPressed: boolean = false;
  private isForwardPressed: boolean = false;
  private isBackwardPressed: boolean = false;
  private isLeftPressed: boolean = false;
  private isRightPressed: boolean = false;
  private isAttackPressed: boolean = false;
  private isHeavyAttackPressed: boolean = false;
  private isBlockPressed: boolean = false;
  
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
  private isCrouching: boolean = false;
  private isLightsaberActive: boolean = false;
  private state: PlayerState = PlayerState.IDLE;
  private attackCooldown: number = 0.5; // seconds
  private lastAttackTime: number = 0;
  private lastBlockTime: number = 0;
  private debugMode: boolean = true;  // Disable debug visuals
  private isThirdPerson: boolean = false;
  private originalCameraPosition: Vector3 = new Vector3();
  private playerModel: Group | null = null;
  private lightsaberOffset: Vector3 = new Vector3(0.09, -0.49, -0.75);
  private damageAppliedInCurrentAttack: boolean = false;
  public clickedOnUI: boolean = false;
  
  // Add mouse position tracking
  private mousePosition = new Vector2();
  private raycaster = new Raycaster();
  private targetPoint = new Vector3();
  private isSwinging = false;
  private swingStartTime = 0;
  private swingDuration = 500; // ms
  
  private lastRespawnTime: number = 0;
  
  // Physics parameters
  private jumpVelocity: number = 0;
  private normalHeight: number = 1.7; // Normal camera height
  private crouchHeight: number = 0.8; // Crouched camera height
  private currentHeight: number = 1.7; // Current camera height
  
  // Add momentum to lightsaber movement
  private readonly saberPositions: Vector3[] = []; // Store recent positions
  private readonly positionHistorySize = 10; // Number of positions to keep
  private readonly saberInertia = 0.75; // Reduced inertia for faster response
  
  // Add missing property for debug output
  private frameCount: number = 0;
  
  // Add property to track attack type for animation
  private currentAttackType: 'light' | 'heavy' = 'light';
  
  // Add properties for head bobbing
  private bobTime: number = 0;
  
  // Add properties for head bobbing
  private headBobTimer: number = 0;
  private headBobValue: number = 0;
  
  // Add input initialization flag
  private inputInitialized: boolean = false;
  
  constructor(scene: Scene, camera: Camera) {
    super();
    
    this.scene = scene;
    this.camera = camera;
    
    // Position the player at the correct initial height
    this.position.set(0, 0.9, 0); // Set starting position at the correct height
    
    // Initialize key components
    this.setupInputListeners();
    
    // Setup physics properties
    this.velocity = new Vector3(0, 0, 0);
    this.moveDirection = new Vector3(0, 0, 0);
    this.isGrounded = true;
    
    // Initialize lightsaber
    this.createLightsaber(); // Create saber early
    
    // Store original camera position if needed for third-person toggle
    this.originalCameraPosition.copy(camera.position);

    // Setup input listeners at the VERY END of the constructor
    this.setupInputListeners(); 
  }
  
  /**
   * Set up keyboard and mouse input listeners
   */
  private setupInputListeners(): void {
    // Make sure we don't double-add listeners
    if (this.inputInitialized) return;
    
    // Keyboard down handler
    document.addEventListener('keydown', (event) => {
      if (event.repeat) return; // Ignore key repeat events
      
      switch (event.code) {
        case 'KeyW':
          this.isForwardPressed = true;
          break;
        case 'KeyS':
          this.isBackwardPressed = true;
          break;
        case 'KeyA':
          this.isRightPressed = true;
          break;
        case 'KeyD':
          this.isLeftPressed = true;
          break;
        case 'Space':
          this.isJumpPressed = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isCrouching = true;
          break;
        case 'KeyF':
          this.isAttackPressed = true;
          break;
        case 'KeyE':
          this.isBlockPressed = true;
          break;
      }
      
      // Debug the key press
      if (this.debugMode) {
        console.log(`Key pressed: ${event.code}`, 
          "Forward:", this.isForwardPressed,
          "Backward:", this.isBackwardPressed,
          "Left:", this.isLeftPressed,
          "Right:", this.isRightPressed);
      }
    });
    
    // Keyboard up handler
    document.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'KeyW':
          this.isForwardPressed = false;
          break;
        case 'KeyS':
          this.isBackwardPressed = false;
          break;
        case 'KeyA':
          this.isRightPressed = false;
          break;
        case 'KeyD':
          this.isLeftPressed = false;
          break;
        case 'Space':
          this.isJumpPressed = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isCrouching = false;
          break;
        case 'KeyF':
          this.isAttackPressed = false;
          break;
        case 'KeyE':
          this.isBlockPressed = false;
          break;
      }
    });
    
    // Mouse events for attacks
    document.addEventListener('mousedown', (event) => {
      if (this.clickedOnUI) return;
      
      if (event.button === 0) { // Left click
        this.isAttackPressed = true;
      } else if (event.button === 2) { // Right click
        this.isBlockPressed = true;
      }
    });
    
    document.addEventListener('mouseup', (event) => {
      if (event.button === 0) { // Left click
        this.isAttackPressed = false;
      } else if (event.button === 2) { // Right click
        this.isBlockPressed = false;
      }
    });
    
    // Mouse movement for camera
    document.addEventListener('mousemove', (event) => {
      this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });
    
    console.log("Input listeners initialized");
    this.inputInitialized = true;
  }
  
  /**
   * Updates player movement based on input and physics
   */
  public update(deltaTime: number): void {
    this.frameCount++;
    
    if (this.debugMode && this.frameCount % 60 === 0) {
      console.log("Player State:", this.state, 
        "Position:", this.position.toArray(),
        "Velocity:", this.velocity.toArray(),
        "Grounded:", this.isGrounded);
    }
    
    // Skip if dead
    if (this.state === PlayerState.DEAD) return;
    
    // Process movement input and update vectors
    this.updateMovement(deltaTime);
    
    // Apply physics
    this.checkGroundCollision();
    
    // Check if player is dead
    if (this.health <= 0 && this.state !== PlayerState.DEAD) {
      this.state = PlayerState.DEAD;
      this.dispatchEvent({ type: 'died' });
      
      // Respawn after a delay
      setTimeout(() => {
        this.respawn();
      }, 2000); // 2 second delay before respawn
    }
    
    // Update combat state
    this.updateAttack(deltaTime);
    
    // Handle lightsaber
    if (this.lightsaber) {
      if (this.isSwinging) {
        this.updateLightsaberSwing(deltaTime);
      } else if (this.state === PlayerState.BLOCKING) {
        this.lightsaber.position.lerp(new Vector3(0, -0.1, -0.6), 0.2);
        this.lightsaber.quaternion.slerp(new Quaternion().setFromEuler(new Euler(Math.PI / 2.5, 0, 0)), 0.2);
      } else {
        this.updateIdleSaberMovement(deltaTime);
      }
    }
    
    // Update head bobbing if needed
    this.updateHeadBob(deltaTime);
  }
  
  /**
   * Process player movement based on input
   */
  private updateMovement(deltaTime: number): void {
    // Reset movement vector
    this.moveDirection.set(0, 0, 0);
    
    // Calculate camera direction vectors for movement relative to camera
    const cameraDirection = new Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Restrict to horizontal plane
    cameraDirection.normalize();
    
    // Get the camera's right vector (perpendicular to direction)
    const cameraRight = new Vector3(cameraDirection.z, 0, -cameraDirection.x);
    
    // Calculate movement direction based on keys
    if (this.isForwardPressed) {
      this.moveDirection.add(cameraDirection);
      this.isMovingForward = true;
    } else {
      this.isMovingForward = false;
    }
    
    if (this.isBackwardPressed) {
      this.moveDirection.sub(cameraDirection);
      this.isMovingBackward = true;
    } else {
      this.isMovingBackward = false;
    }
    
    if (this.isLeftPressed) {
      this.moveDirection.sub(cameraRight);
      this.isMovingLeft = true;
    } else {
      this.isMovingLeft = false;
    }
    
    if (this.isRightPressed) {
      this.moveDirection.add(cameraRight);
      this.isMovingRight = true;
    } else {
      this.isMovingRight = false;
    }
    
    // Normalize the movement direction if it exists
    if (this.moveDirection.lengthSq() > 0) {
      this.moveDirection.normalize();
      
      // Set player state to moving
      if (this.state !== PlayerState.ATTACKING && 
          this.state !== PlayerState.BLOCKING && 
          this.state !== PlayerState.STAGGERED) {
        this.state = PlayerState.MOVING;
      }
      
      // Debug output when moving (less frequent)
      if (this.debugMode && this.frameCount % 10 === 0) {
        console.log("Moving - Direction:", this.moveDirection.toArray());
      }
    } else if (this.state === PlayerState.MOVING) {
      // Player has stopped moving
      this.state = PlayerState.IDLE;
    }
    
    // Calculate speed (can be adjusted based on player state)
    const speed = this.isCrouching ? this.moveSpeed * 0.5 : this.moveSpeed;
    
    // Set horizontal velocity components based on movement direction
    this.velocity.x = this.moveDirection.x * speed;
    this.velocity.z = this.moveDirection.z * speed;
    
    // Apply gravity if not grounded
    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * deltaTime;
    }
    
    // Apply jumping force if jump was requested
    if (this.isJumpPressed && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.isJumping = true;
      this.isJumpPressed = false;
    }
    
    // Apply velocity to position
    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
  }
  
  /**
   * Check and handle ground collision
   */
  private checkGroundCollision(): void {
    // Set groundLevel to exactly 0 (the actual ground plane)
    const groundLevel = 0; 
    const eyeHeight = 1.8; // Player's eye height
    
    if (this.position.y <= groundLevel) {
      // Player has hit the ground
      this.position.y = groundLevel;
      this.velocity.y = 0; // Important - stop downward velocity
      this.isGrounded = true;
      this.isJumping = false;
      
      // Reset camera height to eye level
      if (this.camera) {
        this.camera.position.y = eyeHeight;
      }
    } else {
      // Player is above ground
      this.isGrounded = false;
    }
    
    // Safety check to reset if fallen too far
    if (this.position.y < -100) {
      console.log("Player fell too far, resetting position");
      this.position.set(0, groundLevel, 0);
      this.velocity.set(0, 0, 0);
      this.isGrounded = true;
      this.respawn(); // Call respawn to reset player state
    }
  }
  
  /**
   * Updates the player's attack state and performs attacks
   */
  private updateAttack(deltaTime: number): void {
    // Decrement cooldown timer
    if (this.lastAttackTime > 0) {
      this.lastAttackTime -= deltaTime;
    }
    
    // Check for attack input and cooldown
    if (this.isAttackPressed && this.lastAttackTime <= 0) {
      this.attack(false); // Regular attack
    } else if (this.isHeavyAttackPressed && this.lastAttackTime <= 0) {
      this.attack(true); // Heavy attack
    }
    
    // Update ongoing attacks
    if (this.isSwinging) {
      this.updateLightsaberSwing(deltaTime);
    }
  }

  /**
   * Perform an attack with the lightsaber
   */
  private attack(isHeavy: boolean = false): void {
    if (!this.lightsaber || this.state === PlayerState.ATTACKING || this.state === PlayerState.DEAD) return;
    
    // Initialize attackDirection if not already done
    if (!this.attackDirection) {
      this.attackDirection = new Vector3(0, 0, -1);
    }
    
    this.state = PlayerState.ATTACKING;
    this.isSwinging = true;
    this.swingStartTime = performance.now();
    this.currentAttackType = isHeavy ? 'heavy' : 'light';
    this.swingDuration = isHeavy ? 800 : 500; // Heavy attacks are slower
    this.damageAppliedInCurrentAttack = false;
    
    // Play sound effect
    if (gameAudio) {
      gameAudio.playSound(isHeavy ? 'saberHeavySwing' : 'saberSwing');
    }
    
    // Set cooldown
    this.lastAttackTime = isHeavy ? this.attackCooldown * 1.5 : this.attackCooldown;
    
    // Get attack direction from camera's forward vector
    if (this.camera) {
      const forward = new Vector3(0, 0, -1);
      this.camera.getWorldDirection(forward);
      this.attackDirection.copy(forward);
    }
  }
  
  public takeDamage(amount: number, attackerPosition?: Vector3): void {
    console.log(`[PLAYER] Taking ${amount} damage from position:`, attackerPosition || 'unknown');
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
    window.dispatchEvent(new CustomEvent('playerHealthChanged', {
      detail: {
        health: this.health,
        maxHealth: this.maxHealth
      }
    }));
    
    if (this.health <= 0) {
      console.log("[PLAYER] Player died!");
      this.state = PlayerState.DEAD;
      this.dispatchEvent({ type: 'died' } as any);
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
  public isAttacking(): boolean {
    return this.state === PlayerState.ATTACKING;
  }
  
  public isBlocking(): boolean {
    return this.state === PlayerState.BLOCKING;
  }
  
  public getSwingProgress(): number {
    if (!this.isSwinging || this.swingDuration <= 0) {
      return 0;
    }
    const elapsed = performance.now() - this.swingStartTime;
    return Math.min(elapsed / this.swingDuration, 1);
  }
  
  public getCurrentAttackType(): 'light' | 'heavy' {
    return this.currentAttackType;
  }
  
  public hasAppliedDamageInCurrentAttack(): boolean {
    return this.damageAppliedInCurrentAttack;
  }
  
  public setDamageAppliedInCurrentAttack(applied: boolean): void {
    this.damageAppliedInCurrentAttack = applied;
  }
  
  public getLightsaberPosition(): Vector3 {
    if (!this.lightsaber) return this.position.clone(); // Fallback
    // Return the world position of the saber tip
    const tipOffset = new Vector3(0, this.lightsaber.hiltLength + this.lightsaber.bladeLength, 0);
    return this.lightsaber.localToWorld(tipOffset.clone());
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
    console.log("toggleThirdPersonView called, current mode:", this.isThirdPerson);
    this.isThirdPerson = !this.isThirdPerson;
    
    // Toggle player model visibility
    if (this.playerModel) {
      this.playerModel.visible = this.isThirdPerson;
    }

    if (this.isThirdPerson) {
      // Store original position
      this.originalCameraPosition.copy(this.camera.position);
      
      // Move camera back and up for third-person view
      const cameraDirection = new Vector3();
      this.camera.getWorldDirection(cameraDirection);
      
      // Position camera behind and above player
      const thirdPersonPosition = this.position.clone()
        .sub(cameraDirection.multiplyScalar(4))  // Move back more
        .add(new Vector3(0, 2.0, 0));            // Move up more
      
      this.camera.position.copy(thirdPersonPosition);
      
      // Move lightsaber from camera to player model
      if (this.lightsaber && this.camera) {
        const lightsaberWorldPos = new Vector3();
        this.lightsaber.getWorldPosition(lightsaberWorldPos);
        this.camera.remove(this.lightsaber);
        this.playerModel?.add(this.lightsaber); // Add to player model
        this.lightsaber.position.set(0.5, 1.2, 0.1);
      }
    } else {
      // Restore first-person view
      this.camera.position.copy(this.originalCameraPosition);
      
      // Move lightsaber back to camera
      if (this.lightsaber) {
        this.playerModel?.remove(this.lightsaber);
        this.camera.add(this.lightsaber);
        this.lightsaber.position.set(0.4, -0.1, -0.3);
      }
    }
    
    console.log(`Camera view changed to ${this.isThirdPerson ? 'third' : 'first'} person`);
  }
  
  private createPlayerModel(): void {
    // Create a simple player model (lightsaber wielder)
    this.playerModel = new Group();
    this.playerModel.visible = this.isThirdPerson; // Start with correct visibility
    
    // Create head
    const headGeometry = new SphereGeometry(0.25, 16, 16);
    const headMaterial = new MeshBasicMaterial({ color: 0x8888ff });
    const head = new Mesh(headGeometry, headMaterial);
    head.position.y = 1.6;
    this.playerModel.add(head);
    
    // Create body
    const bodyGeometry = new CylinderGeometry(0.25, 0.2, 1.0, 8);
    const bodyMaterial = new MeshBasicMaterial({ color: 0x222266 });
    const body = new Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.0;
    this.playerModel.add(body);
    
    // Create arms
    const armGeometry = new CylinderGeometry(0.08, 0.08, 0.6, 8);
    const armMaterial = new MeshBasicMaterial({ color: 0x8888ff });
    
    // Right arm (holding lightsaber)
    const rightArm = new Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.3, 1.2, 0);
    rightArm.rotation.z = -Math.PI / 4;
    this.playerModel.add(rightArm);
    
    // Left arm
    const leftArm = new Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.3, 1.2, 0);
    leftArm.rotation.z = Math.PI / 4;
    this.playerModel.add(leftArm);
    
    // Hide by default (first person mode)
    this.playerModel.visible = false;
    this.add(this.playerModel);
  }
  
  private updateLightsaberPosition(): void {
    if (this.isThirdPerson && this.playerModel) {
      // In third person, attach lightsaber to player model's right hand
      this.lightsaber.position.set(0.5, 1.2, 0.1);
      this.lightsaber.rotation.set(0, 0, -Math.PI / 4);
    } else {
      // In first person, position relative to camera
      this.lightsaber.position.copy(this.lightsaberOffset);
    }
  }
  
  toggleLightsaber(): void {
    this.isLightsaberActive = !this.isLightsaberActive;
    
    if (this.isLightsaberActive) {
      this.lightsaber.activate();
      // Play activation sound
      gameAudio.playSound('lightsaberOn', { volume: 0.8 });
    } else {
      this.lightsaber.deactivate();
      // Play deactivation sound
      gameAudio.playSound('lightsaberOff', { volume: 0.8 });
    }
  }
  
  private updateHealthBar(): void {
    // Implementation of updateHealthBar method
  }
  
  startAttack(): void {
    if (this.state === PlayerState.DEAD) return;
    if (this.state === PlayerState.ATTACKING) return;
    
    const now = performance.now() / 1000;
    
    // Check cooldown
    if (now - this.lastAttackTime < this.attackCooldown) {
      return;
    }
    
    // Set state and reset flags
    this.state = PlayerState.ATTACKING;
    this.lastAttackTime = now;
    this.damageAppliedInCurrentAttack = false;
    
    // Calculate attack direction based on movement or facing
    let swingDirection = new Vector3();
    
    if (this.isMovingForward || this.isMovingBackward || this.isMovingLeft || this.isMovingRight) {
      // Use movement direction for swing
      if (this.isMovingForward) swingDirection.z -= 1;
      if (this.isMovingBackward) swingDirection.z += 1;
      if (this.isMovingLeft) swingDirection.x -= 1;
      if (this.isMovingRight) swingDirection.x += 1;
    } else {
      // Use look direction
      swingDirection = this.getDirection();
    }
    
    // Add some randomness to make each swing feel different
    swingDirection.x += (Math.random() - 0.5) * 0.3;
    swingDirection.z += (Math.random() - 0.5) * 0.3;
    
    // Trigger the lightsaber swing physics
    if (this.lightsaber) {
      this.lightsaber.triggerSwing(swingDirection);
    }
    
    // Play attack sound
    gameAudio.playSound('lightsaberSwing', { volume: 0.6 });
    
    // Reset attack state after a delay
    setTimeout(() => {
      if (this.state === PlayerState.ATTACKING) {
        this.state = PlayerState.IDLE;
      }
    }, 500);
  }
  
  startBlock(): void {
    if (this.state === PlayerState.DEAD) return;
    
    this.isBlockPressed = true;
    this.state = PlayerState.BLOCKING;
    this.lastBlockTime = performance.now() / 1000;
    
    // Position lightsaber in blocking stance
    if (this.lightsaber) {
      // Ensure lightsaber is active
      if (!this.lightsaber.isActive()) {
        this.lightsaber.activate();
      }
      
      // Play block sound
      gameAudio.playSound('lightsaberHum', { volume: 0.5 });
    }
    
    console.log("Player block started");
  }
  
  // New method to swing toward mouse position
  private startSwingTowardsMouse(): void {
    if (this.isSwinging) return;
    
    this.isSwinging = true;
    this.swingStartTime = Date.now();
    
    // Store original lightsaber position and rotation
    const originalPosition = this.lightsaber.position.clone();
    const originalRotation = this.lightsaber.quaternion.clone();
    
    // Calculate target position (extend toward mouse point)
    const targetPosition = originalPosition.clone();
    targetPosition.z -= 0.3; // Extend forward
    
    // Set raycaster from camera using mouse position
    this.raycaster.setFromCamera(this.mousePosition, this.camera);
    
    // Calculate world target point
    const targetDistance = 3;
    this.targetPoint.copy(this.raycaster.ray.direction).multiplyScalar(targetDistance).add(this.camera.position);
    
    // Convert to local space of camera
    const localTargetPoint = this.targetPoint.clone().sub(this.camera.position);
    
    // Calculate target rotation to point at mouse
    const targetRotation = new Quaternion();
    const lookAtMatrix = new Matrix4().lookAt(
      new Vector3(0, 0, 0),
      localTargetPoint,
      new Vector3(0, 1, 0)
    );
    targetRotation.setFromRotationMatrix(lookAtMatrix);
    
    // Animate the swing
    const animate = () => {
      const elapsed = Date.now() - this.swingStartTime;
      const progress = Math.min(elapsed / this.swingDuration, 1);
      
      // Use easing for natural motion
      const easedProgress = this.easeInOutQuad(progress);
      
      // Move lightsaber forward and back
      const swingProgress = Math.sin(easedProgress * Math.PI);
      const currentPosition = new Vector3().lerpVectors(
        originalPosition,
        targetPosition,
        swingProgress
      );
      this.lightsaber.position.copy(currentPosition);
      
      // Rotate lightsaber toward target
      this.lightsaber.quaternion.slerpQuaternions(
        originalRotation,
        targetRotation,
        swingProgress
      );
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Reset position and rotation
        this.lightsaber.position.copy(originalPosition);
        this.lightsaber.quaternion.copy(originalRotation);
        this.isSwinging = false;
      }
    };
    
    // Start animation
    animate();
  }
  
  // Easing function for smooth animation
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  
  // New method to update lightsaber position with momentum
  private updateLightsaberWithMomentum(): void {
    if (!this.lightsaber || this.state === PlayerState.DEAD) return;
    
    // Set raycaster from camera using mouse position
    this.raycaster.setFromCamera(this.mousePosition, this.camera);
    
    // Calculate target point (further away to place tip in front)
    const targetDistance = 4; // Increased distance for better reach
    const targetPoint = new Vector3();
    targetPoint.copy(this.raycaster.ray.direction)
      .multiplyScalar(targetDistance)
      .add(this.camera.position);
      
    // If blocking, position saber in defensive stance
    if (this.state === PlayerState.BLOCKING) {
      // Move saber to a horizontal blocking position
      const forward = this.camera.getWorldDirection(new Vector3()).multiplyScalar(1.2);
      const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize().multiplyScalar(0.8);
      
      targetPoint.copy(this.camera.position)
        .add(forward)
        .add(right) // Add sideways component for horizontal positioning
        .add(new Vector3(0, 0.3, 0)); // Slightly raised
    }
    
    // Add to position history
    this.saberPositions.push(targetPoint.clone());
    
    // Keep history at fixed size
    if (this.saberPositions.length > this.positionHistorySize) {
      this.saberPositions.shift();
    }
    
    // Calculate weighted average position (more recent = higher weight)
    const weightedPosition = new Vector3();
    let totalWeight = 0;
    
    this.saberPositions.forEach((pos, index) => {
      // Weight increases with index (more recent positions have higher weight)
      const weight = index + 1;
      weightedPosition.add(pos.clone().multiplyScalar(weight));
      totalWeight += weight;
    });
    
    // Normalize by total weight
    weightedPosition.divideScalar(totalWeight);
    
    // When not actively moving, gradually move saber toward center view
    if (this.state !== PlayerState.ATTACKING && this.state !== PlayerState.BLOCKING) {
      const centerBias = 0.15; // Strength of center bias
      const centerPoint = this.camera.position.clone()
        .add(this.camera.getWorldDirection(new Vector3()).multiplyScalar(2));
      
      weightedPosition.lerp(centerPoint, centerBias);
    }
    
    // Calculate direction and apply to lightsaber
    const direction = new Vector3().subVectors(
      weightedPosition, 
      this.lightsaber.getWorldPosition(new Vector3())
    );
    
    // Convert world direction to local rotation with lag
    const lookAtMatrix = new Matrix4().lookAt(
      new Vector3(0, 0, 0),
      direction,
      new Vector3(0, 1, 0)
    );
    const targetRotation = new Quaternion().setFromRotationMatrix(lookAtMatrix);
    
    // Apply inertia using slerp with custom factor
    const lerpFactor = this.state === PlayerState.BLOCKING ? 0.5 : (1 - this.saberInertia);
    this.lightsaber.quaternion.slerp(targetRotation, lerpFactor);
    
    // Print debug info for space key jumping
    if (this.isJumping) {
      console.log(`Jumping active: height=${this.position.y.toFixed(2)}, velocity=${this.jumpVelocity.toFixed(2)}`);
    }
  }
  
  getLastRespawnTime(): number {
    return this.lastRespawnTime;
  }
  
  /**
   * Respawn the player after death
   */
  public respawn(): void {
    // Only respawn if player is dead or enough time has passed
    const currentTime = performance.now();
    if (this.state !== PlayerState.DEAD && 
        (currentTime - this.lastRespawnTime) < 5000) {
      return; // Prevent rapid respawns
    }
    
    console.log("Respawning player...");
    
    // Reset player position to a safe spawn point
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    
    // Reset health
    this.health = this.maxHealth;
    
    // Reset state
    this.state = PlayerState.IDLE;
    
    // Reset flags
    this.isGrounded = true;
    this.isJumping = false;
    this.isSwinging = false;
    this.isAttackPressed = false;
    this.isHeavyAttackPressed = false;
    this.isBlockPressed = false;
    
    // Reset camera position
    if (this.camera) {
      this.camera.position.y = 1.8;
      this.camera.position.x = 0;
      this.camera.position.z = 0;
    }
    
    // Reset lightsaber
    if (this.lightsaber) {
      this.lightsaber.reset(); // Reset lightsaber state
      
      // Ensure lightsaber is in front position after respawn
      this.updateIdleSaberMovement(0.1);
      
      // Activate the lightsaber if it wasn't already active
      if (!this.isLightsaberActive) {
        this.lightsaber.activate();
        this.isLightsaberActive = true;
      }
    }
    
    // Dispatch health changed event
    this.dispatchEvent({ 
      type: 'healthChanged', 
      detail: { 
        health: this.health, 
        maxHealth: this.maxHealth 
      } 
    });
    
    // Dispatch respawned event
    this.dispatchEvent({ type: 'respawned' });
    
    console.log("Player respawned with full health:", this.health);
    
    // Store last respawn time to prevent rapid respawns
    this.lastRespawnTime = currentTime;
  }

  private handleJumping(deltaTime: number): void {
    // Apply gravity
    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * deltaTime;
    }
    
    // Handle jump input
    if (this.isJumpPressed && this.isGrounded && !this.isJumping) {
      this.velocity.y = this.jumpForce;
      this.isJumping = true;
      this.isGrounded = false;
      
      // Play jump sound
      gameAudio.playSound('jump', { volume: 0.5 });
    }
    
    // Move player based on velocity
    this.position.y += this.velocity.y * deltaTime;
    
    // Check for ground collision
    if (this.position.y <= this.height / 2) {
      this.position.y = this.height / 2;
      this.isGrounded = true;
      this.isJumping = false; // Reset jumping flag when grounded
      this.velocity.y = 0;
    }
  }

  handleInput(deltaTime: number): void {
    // Skip if dead or staggered
    if (this.state === PlayerState.DEAD || this.state === PlayerState.STAGGERED) return;
    
    // Process movement input
    this.moveDirection.set(0, 0, 0); // Reset move direction
    
    // Set movement based on input - THIS FIX ENABLES PLAYER MOVEMENT
    if (this.isForwardPressed) {
      console.log("Forward pressed");
      this.moveDirection.z = -1;
      this.isMovingForward = true;
    } else {
      this.isMovingForward = false;
    }
    
    if (this.isBackwardPressed) {
      console.log("Backward pressed");
      this.moveDirection.z = 1;
      this.isMovingBackward = true;
    } else {
      this.isMovingBackward = false;
    }
    
    if (this.isLeftPressed) {
      console.log("Left pressed");
      this.moveDirection.x = -1;
      this.isMovingLeft = true;
    } else {
      this.isMovingLeft = false;
    }
    
    if (this.isRightPressed) {
      console.log("Right pressed");
      this.moveDirection.x = 1;
      this.isMovingRight = true;
    } else {
      this.isMovingRight = false;
    }

    // Attack Inputs (Left Mouse Button)
    if (this.isAttackPressed) {
      this.attack();
      this.isAttackPressed = false; // Consume the input
    }
    if (this.isHeavyAttackPressed) { // Assuming you have a way to trigger this (e.g., Shift + Click)
      this.attack(true);
      this.isHeavyAttackPressed = false; // Consume the input
    }

    // Blocking Input (Right Mouse Button)
    if (this.isBlockPressed) {
       this.block(); 
    } else {
       // If the block button is released, stop blocking
       this.stopBlocking();
    }
  }

  // Add block method implementation
  block(): void {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.ATTACKING) return;

    if (this.state !== PlayerState.BLOCKING) {
      console.log("Player blocking");
      this.state = PlayerState.BLOCKING;
      // Optional: Play block start sound
      // Optional: Move lightsaber to a blocking pose visually
      if (this.lightsaber) {
         // Example: Move saber to a defensive position
         // You might want a more sophisticated animation
         this.lightsaber.position.set(0, -0.1, -0.6); 
         this.lightsaber.rotation.set(Math.PI / 2.5, 0, 0); 
      }
    }
  }

  // Add method to stop blocking
  stopBlocking(): void {
     if (this.state === PlayerState.BLOCKING) {
       console.log("Player stopped blocking");
       this.state = PlayerState.IDLE;
       // Return lightsaber to normal position
       if (this.lightsaber) {
          this.lightsaber.position.set(0.35, -0.3, -0.7); 
          this.lightsaber.rotation.set(Math.PI / 10, -Math.PI / 8, Math.PI / 16); 
       }
     }
  }

  createLightsaber(): void {
    if (this.lightsaber) {
      console.log("Lightsaber already exists, skipping creation");
      return; // Lightsaber already exists
    }
    
    console.log("Creating lightsaber");
    
    // Create the lightsaber
    this.lightsaber = new Lightsaber(this.scene, {
      bladeLength: 1.0,
      bladeColor: 0x0088ff,
      hiltLength: 0.2,
      debug: this.debugMode
    });

    // Add lightsaber to camera instead of player
    this.camera.add(this.lightsaber);
    
    // Set initial position relative to camera (local coordinates)
    this.lightsaber.position.set(0, -0.3, -0.7);
    this.lightsaber.rotation.set(Math.PI / 20, 0, 0);
    
    // Log creation
    console.log("Lightsaber created and added to camera");
    
    // Activate immediately
    setTimeout(() => {
      this.lightsaber?.activate();
      this.isLightsaberActive = true;
    }, 100);
    
    // Ensure blade components are valid
    setTimeout(() => {
      console.log("Delayed activation check");
      if (this.lightsaber && !this.lightsaber.isActive()) {
        console.log("Lightsaber activation reinforced");
        this.lightsaber.activate();
      }
    }, 500);
  }

  // Implement key release event listener that was missing
  setupKeyEvents(): void {
    // Set up key release events
    document.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'KeyW': this.isForwardPressed = false; break;
        case 'KeyS': this.isBackwardPressed = false; break;
        case 'KeyA': this.isRightPressed = false; break;
        case 'KeyD': this.isLeftPressed = false; break;
        case 'Space': this.isJumpPressed = false; break;
        case 'ShiftLeft': this.isBlockPressed = false; break;
      }
    });

    // Mouse events for attacks
    document.addEventListener('mousedown', (event) => {
      // Skip if clicked on UI
      if (this.clickedOnUI) {
        console.log("Clicked on UI element, skipping attack");
        this.clickedOnUI = false;
        return;
      }

      // Prevent attacking if already attacking
      if (this.state === PlayerState.ATTACKING) {
        console.log("Already attacking, ignoring input");
        return;
      }

      console.log("Mouse down - not on UI");
      
      if (event.button === 0) { // Left click
        console.log("Left click - attack triggered");
        this.isAttackPressed = true;
      } else if (event.button === 2) { // Right click
        console.log("Right click - heavy attack triggered");
        this.isHeavyAttackPressed = true;
      }
    });

    // Add mouseup handler to reset attack flags
    document.addEventListener('mouseup', (event) => {
      if (event.button === 0) { // Left click
        this.isAttackPressed = false;
      } else if (event.button === 2) { // Right click
        this.isHeavyAttackPressed = false;
      }
    });
  }

  // Fix the lightsaber swing update
  private updateLightsaberSwing(deltaTime: number): void {
    if (!this.lightsaber || !this.isSwinging) return;
    
    const elapsed = performance.now() - this.swingStartTime;
    const progress = Math.min(elapsed / this.swingDuration, 1);
    
    // Simple swing animation with local camera space
    if (progress < 1) {
      // Calculate swing angle based on progress (0 to 1)
      const swingAngle = Math.sin(progress * Math.PI) * (Math.PI * 0.6); 
      const verticalAngle = Math.sin(progress * Math.PI * 2) * (Math.PI / 8);
      
      // Reset to base position/rotation
      this.lightsaber.position.set(0, -0.3, -0.7);
      this.lightsaber.rotation.set(Math.PI / 20, 0, 0);
      
      // Apply local rotations
      this.lightsaber.rotateZ(swingAngle);
      this.lightsaber.rotateX(verticalAngle); 
      
      // Add some forward motion during swing
      const forwardPush = Math.sin(progress * Math.PI) * 0.2;
      this.lightsaber.position.z -= forwardPush;
    } else {
      // Swing complete, reset to neutral
      this.isSwinging = false;
      this.lightsaber.position.set(0, -0.3, -0.7);
      this.lightsaber.rotation.set(Math.PI / 20, 0, 0);
      this.state = PlayerState.IDLE;
    }
  }

  // Method for idle/moving saber physics (lag/inertia)
  private updateIdleSaberMovement(deltaTime: number): void {
    if (!this.lightsaber || !this.camera) return;

    // IMPORTANT: Make the lightsaber a child of the camera
    // This ensures it follows the camera perfectly
    if (this.lightsaber.parent !== this.camera) {
      this.camera.add(this.lightsaber);
      console.log("Attached lightsaber to camera");
    }

    // Define fixed local position and rotation relative to camera
    // These are in camera's local space, not world space
    const targetPosition = new Vector3(0, -0.3, -0.7);
    const targetRotation = new Euler(Math.PI / 20, 0, 0);
    const targetQuaternion = new Quaternion().setFromEuler(targetRotation);

    // Use simple lerp in local space (much more reliable)
    this.lightsaber.position.lerp(targetPosition, 0.15);
    this.lightsaber.quaternion.slerp(targetQuaternion, 0.15);
  }

  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (this.lightsaber) this.lightsaber.setDebugMode(enabled); // Propagate if needed
    // Toggle any visual debug helpers specific to the player
  }

  /**
   * Updates the head bobbing effect when the player is moving
   */
  private updateHeadBob(deltaTime: number): void {
    // Only apply head bobbing when the player is moving and on the ground
    const isMoving = this.isMovingForward || this.isMovingBackward || 
                     this.isMovingLeft || this.isMovingRight;
    
    // Get the camera for applying the bob effect
    const camera = this.camera;
    if (!camera) return;
    
    if (isMoving && this.isGrounded) {
      // Increment the bob timer when moving
      this.headBobTimer += deltaTime * (this.isCrouching ? 10 : 15); // Slower when crouching
      
      // Calculate the bob value using a sine wave
      const bobSpeed = this.moveSpeed / 5; // Adjust bob speed based on movement speed
      this.headBobValue = Math.sin(this.headBobTimer * bobSpeed) * (this.isCrouching ? 0.01 : 0.02);
      
      // Apply the bob effect to the camera's Y position
      // Assuming the camera is at height 1.8 (player height), add small offset
      const baseHeight = this.height; // Default eye height
      camera.position.y = baseHeight + this.headBobValue;
      
      // Optional: add slight left-right movement for more realistic effect
      const lateralBob = Math.cos(this.headBobTimer * bobSpeed * 2) * 0.01;
      camera.position.x = lateralBob;
    } else {
      // Gradually return to normal position when not moving
      if (Math.abs(this.headBobValue) > 0.001) {
        // Interpolate back to neutral position
        this.headBobValue *= 0.8;
        camera.position.y = this.height + this.headBobValue;
        camera.position.x *= 0.8; // Reduce any lateral bob
      } else {
        // Reset values when close to neutral
        this.headBobValue = 0;
        this.headBobTimer = 0;
        camera.position.y = this.height;
        camera.position.x = 0;
      }
    }
  }
}
