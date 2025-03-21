import { Group, Scene, Vector3, Mesh, BoxGeometry, MeshStandardMaterial, SphereGeometry, CylinderGeometry, Color, Quaternion, Euler, MathUtils, Object3D } from 'three';
import { Lightsaber } from './lightsaber';
import { createSaberClashEffect, createHitEffect } from './effects';
import gameAudio from './audio';

export interface EnemyOptions {
  health?: number;
  speed?: number;
  attackRange?: number;
  attackDamage?: number;
  lightsaberColor?: string;
}

export enum EnemyState {
  IDLE = 'idle',
  PURSUING = 'pursuing',
  ATTACKING = 'attacking',
  BLOCKING = 'blocking',
  STAGGERED = 'staggered',
  DEAD = 'dead'
}

export class Enemy extends Group {
  // Add explicit declarations to help TypeScript recognize inherited properties
  declare position: Vector3;
  declare quaternion: Quaternion;
  declare parent: Object3D;
  declare add: (object: Object3D) => this;
  declare rotateX: (angle: number) => this;
  declare rotateY: (angle: number) => this;

  // Stats
  private health: number;
  private maxHealth: number;
  private speed: number;
  private attackRange: number;
  private attackDamage: number;
  
  // Combat
  private lightsaber: Lightsaber;
  private attackCooldown: number = 0;
  private blockCooldown: number = 0;
  private staggerTime: number = 0;
  private attacking: boolean = false;
  private blocking: boolean = false;
  private lastAttackTime: number = 0;
  private attackTimer: number = 0;
  private hasAppliedDamage: boolean = false;
  private state: EnemyState = EnemyState.IDLE;
  
  // AI
  private targetPosition: Vector3 = new Vector3();
  private targetDirection: Vector3 = new Vector3(0, 0, -1);
  private aggroRange: number = 10;
  private tooCloseRange: number = 1.5;
  private wanderTimer: number = 0;
  private wanderTarget: Vector3 = new Vector3();
  
  // Visuals
  private head: Mesh;
  private body: Mesh;
  private leftArm: Mesh;
  private rightArm: Mesh;
  private leftLeg: Mesh;
  private rightLeg: Mesh;
  
  private scene: Scene;
  
  constructor(scene: Scene, options: EnemyOptions = {}) {
    super();
    
    this.scene = scene;
    
    // Set stats with defaults
    this.maxHealth = options.health || 100;
    this.health = options.health || 100;
    this.speed = options.speed || 2.0;
    this.attackRange = options.attackRange || 2.0;
    this.attackDamage = options.attackDamage || 15;
    
    // Create enemy body
    this.createBody();
    
    // Create lightsaber with more dramatic parameters
    this.lightsaber = new Lightsaber({
      color: options.lightsaberColor || '#ff0000',
      bladeLength: 1.5,
      hiltLength: 0.25,
      glowIntensity: 1.5
    });
    
    // CRITICAL FIX: Position lightsaber clearly in hand
    this.lightsaber.position.set(0.6, 1.1, 0.3);
    this.lightsaber.rotateZ(-Math.PI / 6);
    this.add(this.lightsaber);
    
    // Ensure lightsaber is active and visible
    setTimeout(() => {
      if (this.lightsaber) {
        this.lightsaber.activate();
        console.log("Enemy lightsaber activated");
      }
    }, 500);
    
    // Name the enemy for easy reference
    this.name = "enemy";
  }
  
  update(deltaTime: number, playerPosition: Vector3, playerDirection: Vector3): void {
    if (!this.isAlive()) return;
    
    // Update enemy animations
    this.updateAnimation(deltaTime);
    
    // IMPROVED: Force aggressive AI behavior
    this.updateAggressive(deltaTime, playerPosition, playerDirection);
    
    // Update lightsaber
    if (this.lightsaber) {
      this.lightsaber.update(deltaTime);
    }
  }
  
  // New method to force more aggressive enemy behavior
  private updateAggressive(deltaTime: number, playerPosition: Vector3, playerDirection: Vector3): void {
    // Skip if dead
    if (this.state === EnemyState.DEAD) return;
    
    // CRITICAL: Store player position for attacking
    this.targetPosition = playerPosition.clone();
    
    // Calculate distance to player
    const distanceToPlayer = this.position.distanceTo(playerPosition);
    
    // Always face the player
    this.lookAt(playerPosition.x, this.position.y, playerPosition.z);
    
    // Attack or pursue based on distance
    if (distanceToPlayer <= this.attackRange) {
      // Get current time for cooldown
      const currentTime = performance.now() / 1000;
      
      // Attack frequently when in range
      if (currentTime - this.lastAttackTime > 1.5) {
        console.log("Enemy attempting attack at player:", playerPosition);
        this.attack();
        this.lastAttackTime = currentTime;
      } else {
        // Strafe around player between attacks
        this.strafeAroundTarget(deltaTime, playerPosition);
      }
    } else if (distanceToPlayer <= this.aggroRange) {
      // Move toward player when outside attack range
      const moveSpeed = this.speed * deltaTime;
      const moveDirection = new Vector3()
        .subVectors(playerPosition, this.position)
        .normalize();
      moveDirection.y = 0;
      
      // Apply movement
      this.position.add(moveDirection.multiplyScalar(moveSpeed));
      this.state = EnemyState.PURSUING;
    }
  }
  
  attack(): void {
    console.log("Enemy attack triggered!");
    
    // Skip if dead
    if (this.state === EnemyState.DEAD) return;
    
    // Set state and timer
    this.state = EnemyState.ATTACKING;
    this.attackTimer = 0;
    this.hasAppliedDamage = false;
    this.lastAttackTime = performance.now() / 1000;
    
    // Store the most recent player position from updateAggressive
    if (!this.targetPosition || this.targetPosition.lengthSq() === 0) {
      console.warn("No target position available, using forward direction");
      // Create a default forward position if target is not set
      this.targetPosition = new Vector3(
        this.position.x + 0, 
        this.position.y + 1, 
        this.position.z + 1
      );
    }
    
    if (this.lightsaber) {
      // Ensure lightsaber is active
      if (!this.lightsaber.isActive()) {
        this.lightsaber.activate();
      }
      
      // Calculate direction to target
      const attackDirection = new Vector3()
        .subVectors(this.targetPosition, this.position)
        .normalize();
      
      // Keep direction horizontal
      attackDirection.y = 0;
      attackDirection.normalize();
      
      // Use default forward direction if calculated direction is invalid
      if (isNaN(attackDirection.x) || isNaN(attackDirection.z)) {
        attackDirection.set(0, 0, 1);
      }
      
      console.log("Attacking toward:", this.targetPosition);
      console.log("Attack direction:", attackDirection);
      
      // Face the target
      this.lookAt(
        this.position.x + attackDirection.x,
        this.position.y,
        this.position.z + attackDirection.z
      );
      
      // Swing the lightsaber
      try {
        this.lightsaber.swingAt(0, attackDirection);
      } catch (error) {
        console.error("Error during swing:", error);
        this.lightsaber.swing(0);
      }
      
      // Play sound effect
      gameAudio.playSound('lightsaberSwing', { volume: 0.8 });
    }
    
    // Reset state after animation completes
    setTimeout(() => {
      if (this.state === EnemyState.ATTACKING) {
        this.state = EnemyState.IDLE;
      }
    }, 800);
  }
  
  takeDamage(amount: number, attackerPosition?: Vector3): void {
    console.log(`Enemy taking ${amount} damage, current health: ${this.health}`);
    
    if (this.state === EnemyState.DEAD) return;
    
    // CRITICAL: Directly reduce health with no conditions
    this.health -= amount;
    console.log(`Enemy health after damage: ${this.health}`);
    
    // Enter staggered state if hit
    this.state = EnemyState.STAGGERED;
    this.staggerTime = 0.5;
    
    // Check if dead
    if (this.health <= 0) {
      this.die();
      return;
    }
    
    // Visual feedback for hit
    if (this.scene) {
      const hitPosition = this.position.clone();
      hitPosition.y = 1.2;
      createHitEffect(this.scene, hitPosition, '#ff4444');
    }
    
    // Audio feedback
    gameAudio.playSound('enemyHit', { volume: 0.8 });
  }
  
  private die(): void {
    this.state = EnemyState.DEAD;
    this.blocking = false;
    this.attacking = false;
    
    // Deactivate lightsaber
    this.lightsaber.deactivate();
    
    // Fall to the ground (simple animation)
    this.rotateX(Math.PI / 2);
    this.position.y = 0.5;
    
    // Play death sound
    gameAudio.playSound('enemyHit', { volume: 1.0 });
    
    // Create hit effect
    createHitEffect(this.parent as Scene, this.position.clone(), '#ff3333');
  }
  
  private animate(deltaTime: number): void {
    // Simple animations based on state
    const time = performance.now() * 0.001;
    
    switch (this.state) {
      case EnemyState.PURSUING:
        // Slight bobbing while moving
        this.position.y = Math.sin(time * 5) * 0.05 + 0.05;
        
        // Arm and leg movement
        this.leftArm.rotation.x = Math.sin(time * 5) * 0.2;
        this.rightArm.rotation.x = -Math.sin(time * 5) * 0.2;
        this.leftLeg.position.z = Math.sin(time * 5) * 0.1;
        this.rightLeg.position.z = -Math.sin(time * 5) * 0.1;
        break;
        
      case EnemyState.ATTACKING:
        // Attacking animation - swing the saber
        if (this.attacking) {
          // Calculate attack progress (0 to 1)
          const progress = 1 - (this.attackCooldown - 1.0) / 0.5;
          
          // Swing the right arm with the lightsaber
          if (progress <= 0.5) {
            // Wind up (0 to 0.5)
            const windupProgress = progress / 0.5;
            this.rightArm.rotation.x = MathUtils.lerp(0, -Math.PI / 2, windupProgress);
          } else {
            // Swing (0.5 to 1)
            const swingProgress = (progress - 0.5) / 0.5;
            this.rightArm.rotation.x = MathUtils.lerp(-Math.PI / 2, Math.PI / 3, swingProgress);
          }
          
          // Twist body into the attack
          this.body.rotation.y = Math.sin(progress * Math.PI) * 0.3;
        }
        break;
        
      case EnemyState.BLOCKING:
        // Hold lightsaber up in blocking stance
        this.rightArm.rotation.x = -Math.PI / 4;
        this.rightArm.rotation.y = -Math.PI / 6;
        break;
        
      case EnemyState.STAGGERED:
        // Recoil from hit
        const recoilAmount = Math.sin(time * 20) * 0.1 * (this.staggerTime / 0.3);
        this.position.y = recoilAmount + 0.05;
        this.body.rotation.z = recoilAmount;
        break;
        
      case EnemyState.IDLE:
        // Subtle idle movements
        this.body.rotation.y = Math.sin(time * 0.5) * 0.1;
        this.head.rotation.y = Math.sin(time * 0.3) * 0.2;
        break;
        
      case EnemyState.DEAD:
        // No animation when dead
        break;
    }
  }
  
  getSaberTipPosition(): Vector3 {
    const tipPosition = this.lightsaber.getSaberTipPosition();
    return tipPosition;
  }
  
  isAttacking(): boolean {
    return this.attacking;
  }
  
  isBlocking(): boolean {
    return this.blocking;
  }
  
  isAlive(): boolean {
    return this.state !== EnemyState.DEAD;
  }
  
  getHealth(): number {
    return this.health;
  }
  
  getMaxHealth(): number {
    return this.maxHealth;
  }
  
  getAttackDamage(): number {
    return this.attackDamage;
  }
  
  getAttackRange(): number {
    return this.attackRange;
  }
  
  getDirection(): Vector3 {
    const forward = new Vector3(0, 0, 1);
    forward.applyQuaternion(this.quaternion);
    return forward;
  }
  
  getPosition(): Vector3 {
    return this.position.clone();
  }
  
  private createBody(): void {
    // Create head
    this.head = new Mesh(
      new SphereGeometry(0.25, 16, 16),
      new MeshStandardMaterial({ color: 0x333333 })
    );
    this.head.position.set(0, 1.7, 0);
    this.head.castShadow = true;
    this.add(this.head);
    
    // Create body
    this.body = new Mesh(
      new BoxGeometry(0.5, 0.8, 0.3),
      new MeshStandardMaterial({ color: 0x222222 })
    );
    this.body.position.set(0, 1.2, 0);
    this.body.castShadow = true;
    this.add(this.body);
    
    // Create limbs (arms and legs)
    this.leftArm = this.createLimb(0.15, 0.6, 0.15, 0x222222);
    this.leftArm.position.set(-0.35, 1.3, 0);
    this.add(this.leftArm);
    
    this.rightArm = this.createLimb(0.15, 0.6, 0.15, 0x222222);
    this.rightArm.position.set(0.35, 1.3, 0);
    this.add(this.rightArm);
    
    this.leftLeg = this.createLimb(0.15, 0.7, 0.15, 0x222222);
    this.leftLeg.position.set(-0.2, 0.5, 0);
    this.add(this.leftLeg);
    
    this.rightLeg = this.createLimb(0.15, 0.7, 0.15, 0x222222);
    this.rightLeg.position.set(0.2, 0.5, 0);
    this.add(this.rightLeg);
  }
  
  private createLimb(width: number, height: number, depth: number, color: number): Mesh {
    const limb = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshStandardMaterial({ color })
    );
    limb.castShadow = true;
    return limb;
  }
  
  // Add strafing method back for more dynamic movement
  private strafeAroundTarget(deltaTime: number, targetPosition: Vector3): void {
    const toTarget = new Vector3().subVectors(targetPosition, this.position);
    toTarget.y = 0; // Keep on xz plane
    
    // Create perpendicular direction to strafe
    const strafeDir = new Vector3(-toTarget.z, 0, toTarget.x).normalize();
    
    // Alternate direction based on time
    const time = performance.now() * 0.001;
    if (Math.sin(time * 0.5) > 0) {
      strafeDir.negate();
    }
    
    // Move slower while strafing
    const strafeSpeed = this.speed * 0.5 * deltaTime;
    this.position.add(strafeDir.multiplyScalar(strafeSpeed));
  }
  
  // Add wandering method for idle behavior
  private wander(deltaTime: number): void {
    // Check if we need a new wander target
    if (!this.wanderTarget || Math.random() < 0.01) {
      // Pick a random point within 5 units
      const randomAngle = Math.random() * Math.PI * 2;
      const randomDist = 2 + Math.random() * 3;
      
      this.wanderTarget = new Vector3(
        this.position.x + Math.cos(randomAngle) * randomDist,
        this.position.y,
        this.position.z + Math.sin(randomAngle) * randomDist
      );
    }
    
    // Move toward wander target
    if (this.wanderTarget) {
      const toTarget = new Vector3().subVectors(this.wanderTarget, this.position);
      toTarget.y = 0;
      
      if (toTarget.length() > 0.1) {
        toTarget.normalize();
        const wanderSpeed = this.speed * 0.3 * deltaTime;
        this.position.add(toTarget.multiplyScalar(wanderSpeed));
        
        // Face wander direction
        this.lookAt(
          this.wanderTarget.x,
          this.position.y,
          this.wanderTarget.z
        );
      }
    }
  }

  // Add missing updateAnimation method
  private updateAnimation(deltaTime: number): void {
    // Skip if the enemy is dead
    if (this.state === EnemyState.DEAD) return;
    
    // Update attack timer if attacking
    if (this.state === EnemyState.ATTACKING) {
      this.attackTimer += deltaTime;
    } else {
      this.attackTimer = 0;
    }
    
    // Handle animation based on current state
    switch (this.state) {
      case EnemyState.PURSUING:
        // Animate walking motion - basic limb movement
        this.animateWalking(deltaTime);
        break;
        
      case EnemyState.ATTACKING:
        // Animation is handled by the attack method
        break;
        
      case EnemyState.BLOCKING:
        // Animation is handled by the block method
        break;
        
      case EnemyState.STAGGERED:
        // Update stagger recovery
        this.staggerTime -= deltaTime;
        if (this.staggerTime <= 0) {
          this.state = EnemyState.IDLE;
        }
        break;
        
      case EnemyState.IDLE:
      default:
        // Reset limbs to neutral position
        this.resetLimbPositions();
        break;
    }
  }

  // Helper method for walking animation
  private animateWalking(deltaTime: number): void {
    // Simple walking animation - leg and arm movement
    const time = performance.now() * 0.001;
    const legSwing = Math.sin(time * 5) * 0.2;
    
    if (this.leftLeg && this.rightLeg) {
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
    }
    
    if (this.leftArm && this.rightArm) {
      this.leftArm.rotation.x = -legSwing * 0.5;
      this.rightArm.rotation.x = legSwing * 0.5;
    }
  }

  // Helper method to reset limb positions
  private resetLimbPositions(): void {
    if (this.leftLeg) this.leftLeg.rotation.set(0, 0, 0);
    if (this.rightLeg) this.rightLeg.rotation.set(0, 0, 0);
    if (this.leftArm) this.leftArm.rotation.set(0, 0, 0);
    if (this.rightArm) this.rightArm.rotation.set(0, 0, 0);
  }

  // Add method to access attack timer for combat system
  getAttackTimer(): number {
    return this.attackTimer;
  }

  // Add missing getLightsaberPosition method to Enemy class
  getLightsaberPosition(): Vector3 {
    // If no lightsaber, return position at hand height
    if (!this.lightsaber) {
      return this.position.clone().add(new Vector3(0.5, 1.1, 0.3));
    }
    
    // Calculate the position at the tip of the lightsaber blade
    const saberPos = this.lightsaber.localToWorld(new Vector3(0, 1.4, 0));
    return saberPos;
  }

  // Implement missing playLightsaberClashSound method
  playLightsaberClashSound(): void {
    gameAudio.playSound('lightsaberClash', { volume: 0.8 });
  }
}
