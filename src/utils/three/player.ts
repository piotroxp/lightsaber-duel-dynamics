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
  
  constructor(scene: Scene, camera: Camera) {
    super();
    
    this.scene = scene;
    this.camera = camera;
    this.currentHeight = this.normalHeight; // Initialize current height
    
    // Only create the model if needed (e.g., for third-person or multiplayer)
    // this.createPlayerModel(); // We don't need to see our own model in FPS
    
    // Initialize lightsaber
    this.createLightsaber(); // Create saber early
    
    // Store original camera position if needed for third-person toggle
    this.originalCameraPosition.copy(camera.position);

    // Setup input listeners at the VERY END of the constructor
    this.setupInputListeners(); 
  }
  
  private setupInputListeners(): void {
    // Keyboard down handler
    document.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'KeyW':
          this.isForwardPressed = true;
          break;
        case 'KeyS':
          this.isBackwardPressed = true;
          break;
        case 'KeyA':
          this.isLeftPressed = true;
          break;
        case 'KeyD':
          this.isRightPressed = true;
          break;
        case 'Space':
          this.isJumpPressed = true;
          break;
        // Attack controls
        case 'MouseLeft':
        case 'KeyF':
          this.isAttackPressed = true;
          break;
        // Block control
        case 'KeyQ':
          this.isBlockPressed = true;
          break;
        // Heavy attack
        case 'KeyE':
          this.isHeavyAttackPressed = true;
          break;
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
          this.isLeftPressed = false;
          break;
        case 'KeyD':
          this.isRightPressed = false;
          break;
        case 'Space':
          this.isJumpPressed = false;
          break;
        // Attack controls
        case 'MouseLeft':
        case 'KeyF':
          this.isAttackPressed = false;
          break;
        // Block control
        case 'KeyQ':
          this.isBlockPressed = false;
          break;
        // Heavy attack
        case 'KeyE':
          this.isHeavyAttackPressed = false;
          break;
      }
    });
    
    // Mouse events for attacks
    document.addEventListener('mousedown', (event) => {
      if (event.button === 0 && !this.clickedOnUI) { // Left click
        this.isAttackPressed = true;
      }
      if (event.button === 2 && !this.clickedOnUI) { // Right click
        this.isBlockPressed = true;
      }
    });
    
    document.addEventListener('mouseup', (event) => {
      if (event.button === 0) { // Left click
        this.isAttackPressed = false;
      }
      if (event.button === 2) { // Right click
        this.isBlockPressed = false;
      }
    });
  }
  
  private handleMovementInput(): void {
    // Reset movement flags
    this.isMovingForward = false;
    this.isMovingBackward = false;
    this.isMovingLeft = false;
    this.isMovingRight = false;
    
    // Check keyboard state
    if (this.isForwardPressed) {
      this.isMovingForward = true;
      // Set move direction vector based on camera orientation
      this.moveDirection.z = -1;
    }
    
    if (this.isBackwardPressed) {
      this.isMovingBackward = true;
      this.moveDirection.z = 1;
    }
    
    if (this.isLeftPressed) {
      this.isMovingLeft = true;
      this.moveDirection.x = -1;
    }
    
    if (this.isRightPressed) {
      this.isMovingRight = true;
      this.moveDirection.x = 1;
    }
    
    // Normalize direction vector to maintain consistent speed when moving diagonally
    if (this.moveDirection.lengthSq() > 0) {
      this.moveDirection.normalize();
    }
  }
  
  update(deltaTime: number): void {
    if (this.debugMode && this.frameCount % 120 === 0) { // Example conditional log
       console.log("Player State:", this.state, "Position:", this.position);
    }
    // Skip if dead
    if (this.state === PlayerState.DEAD) return;
    
    const previousY = this.camera.position.y; // Store previous camera Y for bobbing calculation
    
    // Handle Movement Input (apply forces/velocity changes)
    this.handleMovementInput();

    // Apply gravity and ground check
    this.applyPhysics(deltaTime);

    // Update player position based on velocity
    this.position.addScaledVector(this.velocity, deltaTime);

    // Update camera position (bobbing)
    this.updateCameraBobbing(deltaTime, previousY);

    // Handle Action Inputs (Attack/Block) - Process flags set by listeners
    this.updateAttack(deltaTime);

    // Update state based on movement
    if (this.velocity.lengthSq() > 0.01 && this.state !== PlayerState.ATTACKING && this.state !== PlayerState.BLOCKING) {
      this.state = PlayerState.MOVING;
    } else if (this.state !== PlayerState.ATTACKING && this.state !== PlayerState.BLOCKING) {
      this.state = PlayerState.IDLE;
    }

    // Update lightsaber position and physics
    if (this.lightsaber) {
      // Update lightsaber swing animation if attacking
      if (this.isSwinging) { // Base animation on isSwinging flag set by attack()
        this.updateLightsaberSwing(deltaTime);
      } else if (this.state === PlayerState.BLOCKING) {
         // Keep saber in blocking pose (or update blocking animation)
         // Example: Maintain the pose set in block()
         this.lightsaber.position.lerp(new Vector3(0, -0.1, -0.6), 0.2); 
         this.lightsaber.quaternion.slerp(new Quaternion().setFromEuler(new Euler(Math.PI / 2.5, 0, 0)), 0.2);
      } else {
         // Apply inertia/lag when idle or moving
         this.updateIdleSaberMovement(deltaTime);
      }
      
      this.lightsaber.update(deltaTime); // Update internal saber logic (pulse etc.)
    }

    // Update cooldowns
    if (this.attackCooldown > 0) {
      this.attackCooldown -= deltaTime;
    }

    // Debug output for lightsaber visibility
    if (this.lightsaber && this.frameCount % 120 === 0) {
      console.log("Lightsaber visible:", this.lightsaber.visible);
      console.log("Lightsaber position:", this.lightsaber.position);
      console.log("Is active:", this.lightsaber.isActive());
    }

    this.frameCount++;
  }
  
  private applyPhysics(deltaTime: number): void {
     // Ground check (simple raycast down)
     const groundRay = new Raycaster(this.position, new Vector3(0, -1, 0), 0, this.height * 0.6);
     const groundIntersects = groundRay.intersectObjects(this.scene.children, true); // Check against scene objects
     this.isGrounded = groundIntersects.length > 0;

     if (this.isGrounded) {
        // If on ground and falling, stop vertical velocity
        if (this.velocity.y < 0) {
           this.velocity.y = 0;
           // Snap to ground precisely (optional, adjust based on ground check accuracy)
           // this.position.y = groundIntersects[0].point.y; 
        }
     } else {
        // Apply gravity if not grounded
        this.velocity.y -= this.gravity * deltaTime;
     }
  }

  private updateCameraBobbing(deltaTime: number, previousY: number): void {
     if (this.state === PlayerState.MOVING && this.isGrounded) {
        this.bobTime += deltaTime * 8; // Adjust speed of bobbing
        const bobAmount = Math.sin(this.bobTime) * 0.03; // Adjust height of bobbing
        this.camera.position.y = this.currentHeight + bobAmount; // Apply bobbing relative to current height
     } else {
        // Smoothly return to normal height when idle or airborne
        this.camera.position.y = MathUtils.lerp(previousY, this.currentHeight, 0.1);
        this.bobTime = 0; // Reset bob timer
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
  
  respawn(): void {
    // Reset health
    this.health = this.maxHealth;
    
    // Reset position
    this.position.set(0, 0, 0);
    
    // Reset state
    this.state = PlayerState.IDLE;
    
    // Record respawn time
    this.lastRespawnTime = performance.now() / 1000;
    
    // Dispatch event
    this.dispatchEvent({ 
      type: 'healthChanged' as any, 
      detail: { 
        health: this.health, 
        maxHealth: this.maxHealth 
      } 
    });
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
    
    // Create lightsaber
    this.lightsaber = new Lightsaber({
      color: '#3366ff', // Blue lightsaber
      bladeLength: 1.2,
      hiltLength: 0.3,
      glowIntensity: 1.2,
      scene: this.scene // Pass scene reference if needed by Lightsaber
    });
    
    // Add lightsaber to the player group initially, it will be positioned relative to camera later
    this.add(this.lightsaber); 
    
    // Set initial relative position/rotation (will be updated dynamically)
    this.lightsaber.position.copy(this.lightsaberOffset); 
    this.lightsaber.rotation.set(Math.PI / 10, -Math.PI / 8, Math.PI / 16);
    
    // Force the lightsaber to be visible
    this.lightsaber.visible = true;
    
    console.log("Lightsaber created and added to player group at relative position:", this.lightsaber.position);
    
    // IMMEDIATE ACTIVATION: Don't delay activation
    if (this.lightsaber) {
      console.log("Immediately activating lightsaber");
      this.lightsaber.activate();
      this.isLightsaberActive = true;
      
      // Verify activation status
      if (this.lightsaber.isActive()) {
        console.log("Blade components verified");
      } else {
        console.error("Blade components missing");
      }
    }
    
    // Force another activation after a short delay as fallback
    setTimeout(() => {
      if (this.lightsaber) {
        console.log("Delayed activation check");
        this.lightsaber.activate();
        this.isLightsaberActive = true;
        console.log("Lightsaber activation reinforced");
      }
    }, 100);
  }

  // Implement key release event listener that was missing
  setupKeyEvents(): void {
    // Set up key release events
    document.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'KeyW': this.isForwardPressed = false; break;
        case 'KeyS': this.isBackwardPressed = false; break;
        case 'KeyA': this.isLeftPressed = false; break;
        case 'KeyD': this.isRightPressed = false; break;
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

  // Update the player's position handling
  private updateMovement(deltaTime: number): void {
    if (this.state === PlayerState.DEAD) return;

    const moveSpeed = this.isCrouching ? this.moveSpeed * 0.6 : this.moveSpeed;
    const velocity = new Vector3();
    const rotation = this.rotation.clone();

    // Ground check
    const groundCheck = new Raycaster(
      this.position.clone().add(new Vector3(0, 0.5, 0)),
      new Vector3(0, -1, 0),
      0,
      1.0
    );
    const onGround = groundCheck.intersectObjects(this.groundMeshes).length > 0;

    // Apply gravity
    if (!onGround) {
      this.velocity.y -= 9.8 * deltaTime;
    } else {
      this.velocity.y = 0;
      this.position.y = 0; // Snap to ground level
    }

    // Movement during combat
    if (this.state === PlayerState.ATTACKING) {
      // Allow limited movement during attacks
      const attackMoveSpeed = moveSpeed * 0.3;
      if (this.isMovingForward) velocity.z -= attackMoveSpeed;
      if (this.isMovingBackward) velocity.z += attackMoveSpeed;
      if (this.isMovingLeft) velocity.x -= attackMoveSpeed;
      if (this.isMovingRight) velocity.x += attackMoveSpeed;
    } else {
      // Normal movement
      if (this.isMovingForward) velocity.z -= moveSpeed;
      if (this.isMovingBackward) velocity.z += moveSpeed;
      if (this.isMovingLeft) velocity.x -= moveSpeed;
      if (this.isMovingRight) velocity.x += moveSpeed;
    }

    // Apply movement
    velocity.applyEuler(rotation);
    this.position.add(velocity.multiplyScalar(deltaTime));
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
  }

  // Add a method to update lightsaber swing animation
  private updateLightsaberSwing(deltaTime: number): void {
    if (!this.lightsaber || !this.isSwinging) return;
    
    const elapsed = performance.now() - this.swingStartTime;
    const progress = Math.min(elapsed / this.swingDuration, 1);
    
    // Simple swing animation - arc movement
    if (progress < 1) {
      // Calculate swing angle based on progress (0 to 1)
      const swingAngle = Math.sin(progress * Math.PI) * (Math.PI * 0.6); // Wider swing
      const verticalAngle = Math.sin(progress * Math.PI * 2) * (Math.PI / 8); // Add slight vertical movement
      
      // Reset to base position/rotation before applying swing
      this.lightsaber.rotation.set(Math.PI / 10, -Math.PI / 8, Math.PI / 16); 
      
      // Apply swing rotation - rotate around z-axis for horizontal swing
      this.lightsaber.rotateZ(swingAngle * (this.currentAttackType === 'heavy' ? 1.2 : 1)); // Heavier swing for heavy attack
      this.lightsaber.rotateX(verticalAngle); // Add vertical element
      
      // Add some forward motion during swing
      const forwardPush = Math.sin(progress * Math.PI) * 0.15;
      this.lightsaber.position.z = -0.7 - forwardPush; // Base Z position
      this.lightsaber.position.x = 0.35 + Math.sin(progress * Math.PI) * 0.1; // Slight sideways movement
    } else {
      // Swing complete
      this.isSwinging = false;
      
      // Return to neutral position
      this.lightsaber.position.set(0.35, -0.3, -0.7);
      this.lightsaber.rotation.set(Math.PI / 10, -Math.PI / 8, Math.PI / 16);
      this.state = PlayerState.IDLE; // Ensure state resets after swing
    }
  }

  // Method for idle/moving saber physics (lag/inertia)
  private updateIdleSaberMovement(deltaTime: number): void {
    if (!this.lightsaber || !this.camera) return;

    // Define the target position and rotation *relative to the camera*
    const targetLocalPosition = this.lightsaberOffset.clone();
    const targetLocalRotation = new Euler(Math.PI / 10, -Math.PI / 8, Math.PI / 16);
    const targetLocalQuaternion = new Quaternion().setFromEuler(targetLocalRotation);

    // Convert target local camera coordinates to world coordinates
    const targetWorldPosition = this.camera.localToWorld(targetLocalPosition.clone());
    const targetWorldQuaternion = new Quaternion().multiplyQuaternions(this.camera.quaternion, targetLocalQuaternion);

    // Apply smoothing (lerp for position, slerp for rotation)
    const positionLerpFactor = 0.1; // Adjust for more/less lag
    const rotationSlerpFactor = 0.1; // Adjust for more/less lag

    // Interpolate the lightsaber's *world* position and rotation
    this.lightsaber.position.lerp(targetWorldPosition, positionLerpFactor);
    this.lightsaber.quaternion.slerp(targetWorldQuaternion, rotationSlerpFactor);
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
