import {
  Camera,
  Vector3,
  Raycaster,
  Object3D,
  Scene,
  ArrowHelper,
  Quaternion,
  BoxGeometry,
  MeshBasicMaterial,
  Mesh,
  MeshPhongMaterial,
  AdditiveBlending,
  Group,
} from 'three';
import { Lightsaber } from './lightsaber';
import gameAudio from './audio';
import { createHitEffect } from './effects';

export interface PlayerState {
  health: number;
  maxHealth: number;
  blocking: boolean;
  attacking: boolean;
  lastAttackTime: number;
  staggered: boolean;
}

export class Player {
  private camera: Camera;
  private scene: Scene;
  private lightsaber: Lightsaber;
  private velocity: Vector3 = new Vector3();
  private moveForward: boolean = false;
  private moveBackward: boolean = false;
  private moveLeft: boolean = false;
  private moveRight: boolean = false;
  private canJump: boolean = false;
  private raycaster: Raycaster = new Raycaster();
  private speed: number = 5.0;
  private jumpForce: number = 10.0;
  private gravity: number = 30.0;
  private prevTime: number = performance.now();
  private state: PlayerState = {
    health: 100,
    maxHealth: 100,
    blocking: false,
    attacking: false,
    lastAttackTime: 0,
    staggered: false,
  };
  
  // Collision
  private collider: Object3D;
  private boundingBox: Mesh;
  private cameraHeight: number = 1.7;
  private attackCooldown: number = 0.5; // seconds
  private blockingEfficiency: number = 0.8; // percentage of damage reduced when blocking
  
  // Saber animation
  private saberGroup: Group;
  private targetSaberPosition: Vector3 = new Vector3();
  private targetSaberRotation: Quaternion = new Quaternion();
  private defaultSaberPosition: Vector3 = new Vector3(0.4, -0.3, -0.5);
  private defaultSaberRotation: Quaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    Math.PI / 2
  );
  
  constructor(camera: Camera, scene: Scene) {
    this.camera = camera;
    this.scene = scene;
    
    // Setup lightsaber
    this.lightsaber = new Lightsaber({
      bladeColor: '#0088ff',
      length: 1.0,
    });
    
    // Create a group for the saber to control its position/rotation
    this.saberGroup = new Group();
    this.saberGroup.add(this.lightsaber);
    this.saberGroup.position.copy(this.defaultSaberPosition);
    this.saberGroup.quaternion.copy(this.defaultSaberRotation);
    this.camera.add(this.saberGroup);
    
    // Activate the lightsaber
    this.lightsaber.activateBlade();
    
    // Create player collider (invisible)
    const colliderGeometry = new BoxGeometry(0.6, 2, 0.6);
    const colliderMaterial = new MeshBasicMaterial({ visible: false });
    this.collider = new Mesh(colliderGeometry, colliderMaterial);
    this.collider.position.copy(this.camera.position);
    this.collider.position.y -= this.cameraHeight / 2;
    this.scene.add(this.collider);
    
    // Debugging bounding box (invisible in final version)
    const boundingGeometry = new BoxGeometry(0.6, 2, 0.6);
    const boundingMaterial = new MeshPhongMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.0, // Set to 0.2 to visualize collider
      blending: AdditiveBlending
    });
    this.boundingBox = new Mesh(boundingGeometry, boundingMaterial);
    this.boundingBox.position.copy(this.collider.position);
    this.scene.add(this.boundingBox);
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    document.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'KeyW':
          this.moveForward = true;
          break;
        case 'KeyS':
          this.moveBackward = true;
          break;
        case 'KeyA':
          this.moveLeft = true;
          break;
        case 'KeyD':
          this.moveRight = true;
          break;
        case 'Space':
          if (this.canJump) {
            this.velocity.y = this.jumpForce;
            this.canJump = false;
          }
          break;
      }
    });
    
    document.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'KeyW':
          this.moveForward = false;
          break;
        case 'KeyS':
          this.moveBackward = false;
          break;
        case 'KeyA':
          this.moveLeft = false;
          break;
        case 'KeyD':
          this.moveRight = false;
          break;
      }
    });
    
    document.addEventListener('mousedown', (event) => {
      event.preventDefault();
      
      // Left click - Attack
      if (event.button === 0) {
        this.attack();
      }
      
      // Right click - Block
      if (event.button === 2) {
        this.block(true);
      }
    });
    
    document.addEventListener('mouseup', (event) => {
      event.preventDefault();
      
      // Right click release - Stop blocking
      if (event.button === 2) {
        this.block(false);
      }
    });
    
    // Prevent right-click context menu
    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }
  
  update(deltaTime: number): void {
    const time = performance.now();
    
    // Handle movement
    const delta = (time - this.prevTime) / 1000;
    this.prevTime = time;
    
    // Apply gravity
    this.velocity.y -= this.gravity * delta;
    
    // Move direction based on camera orientation
    const moveDirection = new Vector3();
    
    if (this.moveForward) {
      moveDirection.z -= 1;
    }
    if (this.moveBackward) {
      moveDirection.z += 1;
    }
    if (this.moveLeft) {
      moveDirection.x -= 1;
    }
    if (this.moveRight) {
      moveDirection.x += 1;
    }
    
    // Normalize movement direction
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
    }
    
    // Convert movement from camera space to world space
    const cameraDirection = new Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();
    
    const cameraRight = new Vector3(1, 0, 0);
    cameraRight.applyQuaternion(this.camera.quaternion);
    cameraRight.y = 0;
    cameraRight.normalize();
    
    const worldMoveDirection = new Vector3();
    worldMoveDirection.addScaledVector(cameraDirection, -moveDirection.z);
    worldMoveDirection.addScaledVector(cameraRight, moveDirection.x);
    
    // Apply movement to velocity
    this.velocity.x = worldMoveDirection.x * this.speed;
    this.velocity.z = worldMoveDirection.z * this.speed;
    
    // Move player collider
    this.collider.position.x += this.velocity.x * delta;
    this.collider.position.y += this.velocity.y * delta;
    this.collider.position.z += this.velocity.z * delta;
    
    // Ground collision (simple)
    if (this.collider.position.y < 0) {
      this.collider.position.y = 0;
      this.velocity.y = 0;
      this.canJump = true;
    }
    
    // Update camera position based on collider
    this.camera.position.copy(this.collider.position);
    this.camera.position.y += this.cameraHeight / 2;
    
    // Update debug bounding box
    this.boundingBox.position.copy(this.collider.position);
    
    // Smoothly interpolate lightsaber position and rotation for animations
    if (this.state.attacking) {
      // Check if attack animation should end
      const attackDuration = 0.3; // seconds
      if (time - this.state.lastAttackTime > attackDuration * 1000) {
        this.state.attacking = false;
        this.targetSaberPosition.copy(this.defaultSaberPosition);
        this.targetSaberRotation.copy(this.defaultSaberRotation);
      }
    } else if (this.state.blocking) {
      // Update saber position for blocking stance
      this.targetSaberPosition.set(0.2, 0, -0.5);
      this.targetSaberRotation.setFromAxisAngle(
        new Vector3(0, 0, 1),
        Math.PI / 4
      );
    } else {
      // Return to default position
      this.targetSaberPosition.copy(this.defaultSaberPosition);
      this.targetSaberRotation.copy(this.defaultSaberRotation);
    }
    
    // Smoothly interpolate position and rotation
    this.saberGroup.position.lerp(this.targetSaberPosition, 10 * delta);
    this.saberGroup.quaternion.slerp(this.targetSaberRotation, 10 * delta);
    
    // Update lightsaber trail
    const isMoving = this.state.attacking || 
                     (this.velocity.x !== 0 || this.velocity.z !== 0);
    this.lightsaber.updateTrail(this.camera.position, isMoving);
    
    // Update staggered state
    if (this.state.staggered && time - this.state.lastAttackTime > 1000) {
      this.state.staggered = false;
    }
  }
  
  attack(): void {
    const time = performance.now();
    
    // Check attack cooldown
    if (time - this.state.lastAttackTime < this.attackCooldown * 1000) {
      return;
    }
    
    // Set attacking state
    this.state.attacking = true;
    this.state.lastAttackTime = time;
    
    // Generate swing sound
    this.lightsaber.swing(1.0);
    
    // Set target position and rotation for attack swing
    this.targetSaberPosition.set(0.8, 0.3, -0.5);
    this.targetSaberRotation.setFromAxisAngle(
      new Vector3(0, 0, 1),
      -Math.PI / 3
    );
    
    // Create a raycaster for attack hit detection
    const raycaster = new Raycaster();
    const attackDistance = 2.5;
    
    // Set raycaster origin and direction
    raycaster.set(
      this.camera.position,
      new Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
    );
    
    // We're not returning anything here
  }
  
  block(isBlocking: boolean): void {
    this.state.blocking = isBlocking;
    
    if (isBlocking) {
      gameAudio.playSound('lightsaberMove', { volume: 0.4 });
    }
  }
  
  takeDamage(amount: number, source?: Vector3): number {
    const actualDamage = this.state.blocking
      ? amount * (1 - this.blockingEfficiency)
      : amount;
    
    this.state.health -= actualDamage;
    
    if (this.state.health < 0) {
      this.state.health = 0;
    }
    
    // Visual feedback
    if (actualDamage > 0) {
      // Play hit sound
      if (this.state.blocking) {
        this.lightsaber.clash();
        
        // Create effect if source position is provided
        if (source) {
          createHitEffect(this.scene, source, '#ffaa00');
        }
      } else {
        gameAudio.playSound('playerHit', { volume: 0.6 });
        this.state.staggered = true;
      }
    }
    
    return actualDamage;
  }
  
  getHealth(): number {
    return this.state.health;
  }
  
  getMaxHealth(): number {
    return this.state.maxHealth;
  }
  
  getPosition(): Vector3 {
    return this.camera.position.clone();
  }
  
  getDirection(): Vector3 {
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    return direction;
  }
  
  getSaberPosition(): Vector3 {
    const position = this.lightsaber.getBladeEndPosition();
    return position;
  }
  
  getSaberTipPosition(): Vector3 {
    const position = this.lightsaber.getBladeEndPosition();
    return position;
  }
  
  isBlocking(): boolean {
    return this.state.blocking;
  }
  
  isAttacking(): boolean {
    return this.state.attacking;
  }
  
  isAlive(): boolean {
    return this.state.health > 0;
  }
}
