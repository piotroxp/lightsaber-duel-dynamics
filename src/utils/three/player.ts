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
  Vector2
} from 'three';
import { Lightsaber } from './lightsaber';
import gameAudio from './audio';
import { createHitEffect } from './effects';

// Extend Three.js event types with our custom events
declare global {
  namespace THREE {
    interface Object3DEventMap {
      healthChanged: { detail: { health: number, maxHealth: number } };
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
  
  constructor(scene: Scene, camera: Camera) {
    super();
    
    this.scene = scene;
    this.camera = camera;
    
    this.createPlayerModel();
    
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
      color: '#0066ff', // Brighter blue color
      bladeLength: 1.2,
      hiltLength: 0.25,
      glowIntensity: 2.0 // Increased glow intensity for better pulsation
    });
    // Add lightsaber to camera for first-person view
    this.camera.add(this.lightsaber);
    
    // Position lightsaber at bottom right of view
    this.lightsaber.position.set(0.4, -0.3, -0.5);
    this.lightsaber.rotation.x = Math.PI * (-0.13);
    
    // Add keyboard event listeners
    this.setupControls();
    
    // Activate lightsaber with delay for effect
    setTimeout(() => {
      this.lightsaber.activate();
      // Force update to ensure pulsation starts immediately
      this.lightsaber.update(0.016);
    }, 1000);
    
    // Track mouse movement for saber control
    document.addEventListener('mousemove', (event) => {
      // Calculate normalized device coordinates (-1 to +1)
      this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Update lightsaber position based on mouse
      this.updateLightsaberFromMouse();
    });
  }
  
  private setupControls(): void {
    // Keyboard controls
    document.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'KeyW': this.isMovingForward = true; break;
        case 'KeyS': this.isMovingBackward = true; break;
        case 'KeyA': this.isMovingLeft = true; break;
        case 'KeyD': this.isMovingRight = true; break;
        case 'Digit1': 
          // Toggle lightsaber on/off
          this.toggleLightsaber();
          break;
      }
    });

    document.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'KeyW': this.isMovingForward = false; break;
        case 'KeyS': this.isMovingBackward = false; break;
        case 'KeyA': this.isMovingLeft = false; break;
        case 'KeyD': this.isMovingRight = false; break;
      }
    });
    
    // Mouse controls for attacking
    document.addEventListener('mousedown', (event) => {
      // Skip if clicking on a UI element
      if (event.target instanceof HTMLElement && 
          (event.target.closest('.color-picker') || 
           event.target.closest('button') || 
           event.target.closest('input'))) {
        this.clickedOnUI = true;
        console.log("Clicked on UI element, skipping attack");
        return;
      }
      
      // Not clicking on UI
      this.clickedOnUI = false;
      console.log("Mouse down - not on UI");
      
      if (event.button === 0) { // Left click
        // Directly set attack state
        this.isAttackPressed = true;
        this.state = PlayerState.ATTACKING;
        // Directly trigger attack
        this.startAttack();
        console.log("Left click - attack triggered");
      } else if (event.button === 2) { // Right click
        // Directly set block state
        this.isBlockPressed = true;
        this.state = PlayerState.BLOCKING;
        // Directly trigger block
        this.startBlock();
        console.log("Right click - block triggered");
      }
    });
    
    // Reset UI click flag on mouseup
    document.addEventListener('mouseup', (event) => {
      this.clickedOnUI = false;
      
      // Reset attack/block state on mouse up
      if (event.button === 0) { // Left click
        this.isAttackPressed = false;
        if (this.state === PlayerState.ATTACKING) {
          this.state = PlayerState.IDLE;
        }
      } else if (event.button === 2) { // Right click
        this.isBlockPressed = false;
        if (this.state === PlayerState.BLOCKING) {
          this.state = PlayerState.IDLE;
        }
      }
    });
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
        console.log("Toggle third-person view key pressed");
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
    // Skip if clicking on a UI element
    if (event.target instanceof HTMLElement && 
        (event.target.closest('.color-picker') || 
         event.target.closest('button') || 
         event.target.closest('input'))) {
      return;
    }
    
    if (event.button === 0) { // Left mouse button
      this.isAttackPressed = true;
      this.startAttack();
    } else if (event.button === 2) { // Right mouse button
      this.isBlockPressed = true;
      this.startBlock();
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
    // Skip if dead
    if (this.state === PlayerState.DEAD) return;
    
    // Update lightsaber position
    this.updateLightsaberPosition();
    
    // Update lightsaber visuals
    if (this.lightsaber) {
      // Only allow attacks when lightsaber is active
      if (!this.isLightsaberActive && this.isAttackPressed) {
        this.isAttackPressed = false;
      }
      
      // Update lightsaber
      this.lightsaber.update(deltaTime);
      
      // Handle attack state
      if (this.isAttackPressed && this.state === PlayerState.ATTACKING) {
        // Trigger lightsaber swing animation if not already swinging
        if (!this.lightsaber.isSwinging) {
          this.lightsaber.playSwingSound();
          // Add swing animation here
        }
      }
      
      // Make sure lightsaber state is consistent
      if (this.isLightsaberActive !== this.lightsaber.isActive()) {
        if (this.isLightsaberActive) {
          this.lightsaber.activate();
        } else {
          this.lightsaber.deactivate();
        }
      }
    }
    
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
    
    // Always update player model rotation to match camera direction
    if (this.playerModel) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.y = 0; // Keep rotation only around Y axis
      
      if (direction.length() > 0.1) {
        this.playerModel.lookAt(this.position.clone().add(direction));
      }
    }
    
    // Update health bar if it exists
    this.updateHealthBar();
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
    this.damageAppliedInCurrentAttack = false;
    
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
      if (this.lightsaber && typeof this.lightsaber.getBladeTopPosition === 'function') {
        return this.lightsaber.getBladeTopPosition();
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
  
  public hasAppliedDamageInCurrentAttack(): boolean {
    return this.damageAppliedInCurrentAttack;
  }
  
  public setDamageAppliedInCurrentAttack(value: boolean): void {
    this.damageAppliedInCurrentAttack = value;
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
    
    this.isAttackPressed = true;
    this.state = PlayerState.ATTACKING;
    this.lastAttackTime = performance.now() / 1000;
    
    // Start a swing animation toward the mouse position
    this.startSwingTowardsMouse();
    
    // Trigger lightsaber swing animation
    if (this.lightsaber) {
      this.lightsaber.playSwingSound();
    }
    
    console.log("Player attack started");
  }
  
  startBlock(): void {
    if (this.state === PlayerState.DEAD) return;
    
    this.isBlockPressed = true;
    this.state = PlayerState.BLOCKING;
    this.lastBlockTime = performance.now() / 1000;
    
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
  
  // New method to update lightsaber position based on mouse
  private updateLightsaberFromMouse(): void {
    if (!this.lightsaber || this.state === PlayerState.DEAD) return;
    
    // Set raycaster from camera using mouse position
    this.raycaster.setFromCamera(this.mousePosition, this.camera);
    
    // Calculate a point in space where the saber should point
    const targetDistance = 3; // How far ahead to project
    this.targetPoint.copy(this.raycaster.ray.direction).multiplyScalar(targetDistance).add(this.camera.position);
    
    // Only update when not swinging
    if (!this.isSwinging) {
      // Calculate direction from lightsaber to target
      const direction = new Vector3().subVectors(this.targetPoint, this.lightsaber.getWorldPosition(new Vector3()));
      
      // Convert world direction to local rotation
      const lookAtMatrix = new Matrix4().lookAt(
        new Vector3(0, 0, 0),
        direction,
        new Vector3(0, 1, 0)
      );
      const targetRotation = new Quaternion().setFromRotationMatrix(lookAtMatrix);
      
      // Smoothly interpolate current rotation to target
      const currentRotation = this.lightsaber.quaternion.clone();
      this.lightsaber.quaternion.slerp(targetRotation, 0.1);
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
      type: 'healthChanged', 
      detail: { 
        health: this.health, 
        maxHealth: this.maxHealth 
      } 
    });
  }
}
