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
  private lastHitTime: number = 0;
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
    this.attackDamage = options.attackDamage || 10;
    
    // Create enemy body
    this.createBody();
    
    // Create lightsaber
    this.lightsaber = new Lightsaber({
      color: options.lightsaberColor || '#ff0000',
      bladeLength: 1.2,
      hiltLength: 0.2
    });
    this.lightsaber.position.set(0.4, 0.9, 0.2);
    this.lightsaber.rotateY(Math.PI * 0.25);
    this.add(this.lightsaber);
    
    // Activate lightsaber
    this.lightsaber.activate();
  }
  
  update(deltaTime: number, playerPosition: Vector3, playerDirection: Vector3): void {
    // Update lightsaber
    this.lightsaber.update(deltaTime);
    
    // Update cooldowns
    if (this.attackCooldown > 0) {
      this.attackCooldown -= deltaTime;
    }
    
    if (this.blockCooldown > 0) {
      this.blockCooldown -= deltaTime;
    }
    
    if (this.staggerTime > 0) {
      this.staggerTime -= deltaTime;
      if (this.staggerTime <= 0) {
        this.state = EnemyState.PURSUING;
      }
    }
    
    // If dead, don't do anything else
    if (this.state === EnemyState.DEAD) {
      return;
    }
    
    // Save the target player position for pathfinding
    this.targetPosition.copy(playerPosition);
    this.targetDirection.copy(playerDirection);
    
    // Update state based on distance to player
    const distanceToPlayer = this.position.distanceTo(playerPosition);
    
    if (this.staggerTime > 0) {
      this.state = EnemyState.STAGGERED;
    } else if (distanceToPlayer <= this.attackRange) {
      // Within attack range
      const shouldBlock = Math.random() < 0.3 && this.blockCooldown <= 0;
      
      if (shouldBlock) {
        this.state = EnemyState.BLOCKING;
        this.blocking = true;
        this.blockCooldown = 1.0; // Cooldown before blocking again
      } else if (this.attackCooldown <= 0) {
        this.state = EnemyState.ATTACKING;
        this.attack();
      } else {
        this.state = EnemyState.PURSUING;
      }
    } else if (distanceToPlayer <= this.aggroRange) {
      // Within aggro range, pursue player
      this.state = EnemyState.PURSUING;
      this.blocking = false;
    } else {
      // Out of range, go idle
      this.state = EnemyState.IDLE;
      this.blocking = false;
    }
    
    // Update movement based on state
    switch (this.state) {
      case EnemyState.PURSUING:
        this.moveTowardsTarget(deltaTime);
        break;
        
      case EnemyState.IDLE:
        this.wander(deltaTime);
        break;
        
      case EnemyState.ATTACKING:
        // Don't move during attack
        this.rotateTowardTarget(deltaTime);
        break;
        
      case EnemyState.BLOCKING:
        // Move slightly when blocking to avoid easy hits
        this.strafeAroundTarget(deltaTime);
        break;
        
      case EnemyState.STAGGERED:
        // Don't move while staggered
        break;
        
      default:
        break;
    }
    
    // Update animation
    this.animate(deltaTime);
  }
  
  private moveTowardsTarget(deltaTime: number): void {
    // Calculate direction vector
    const direction = new Vector3()
      .subVectors(this.targetPosition, this.position)
      .normalize();
    
    // Only move in the xz plane
    direction.y = 0;
    
    // Check if we're too close to the player
    const distanceToPlayer = this.position.distanceTo(this.targetPosition);
    if (distanceToPlayer < this.tooCloseRange) {
      // Move away slightly
      direction.negate();
    }
    
    // Move the enemy
    const moveAmount = this.speed * deltaTime;
    this.position.add(direction.multiplyScalar(moveAmount));
    
    // Rotate to face the target
    this.rotateTowardTarget(deltaTime);
  }
  
  private rotateTowardTarget(deltaTime: number): void {
    // Get direction to player
    const direction = new Vector3()
      .subVectors(this.targetPosition, this.position)
      .normalize();
    
    // Only rotate in the xz plane
    direction.y = 0;
    
    // Calculate target rotation
    const targetQuaternion = new Quaternion();
    const euler = new Euler(0, Math.atan2(direction.x, direction.z), 0);
    targetQuaternion.setFromEuler(euler);
    
    // Smoothly rotate towards the target
    this.quaternion.slerp(targetQuaternion, 5 * deltaTime);
  }
  
  private strafeAroundTarget(deltaTime: number): void {
    // Calculate position relative to the player
    const toPlayer = new Vector3().subVectors(this.targetPosition, this.position);
    
    // Create a perpendicular direction in the xz plane (for strafing)
    const strafeDir = new Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
    
    // Alternate strafing direction based on time
    const time = performance.now() * 0.001;
    if (Math.sin(time) > 0) {
      strafeDir.negate();
    }
    
    // Move the enemy
    const moveAmount = this.speed * 0.7 * deltaTime; // Move slower while strafing
    this.position.add(strafeDir.multiplyScalar(moveAmount));
    
    // Keep facing the player
    this.rotateTowardTarget(deltaTime);
  }
  
  private wander(deltaTime: number): void {
    // Update wander timer
    this.wanderTimer -= deltaTime;
    
    // Pick a new random destination if needed
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2 + Math.random() * 3; // 2-5 seconds
      
      // Random point within 5 units of current position
      const randomOffset = new Vector3(
        (Math.random() - 0.5) * 10,
        0,
        (Math.random() - 0.5) * 10
      );
      
      this.wanderTarget.copy(this.position).add(randomOffset);
    }
    
    // Move towards the wander target
    const direction = new Vector3()
      .subVectors(this.wanderTarget, this.position)
      .normalize();
    
    // Only move in the xz plane
    direction.y = 0;
    
    // Move the enemy at half speed
    const moveAmount = this.speed * 0.5 * deltaTime;
    this.position.add(direction.multiplyScalar(moveAmount));
    
    // Rotate towards the wander target
    const targetQuaternion = new Quaternion();
    const euler = new Euler(0, Math.atan2(direction.x, direction.z), 0);
    targetQuaternion.setFromEuler(euler);
    
    // Smoothly rotate towards the target
    this.quaternion.slerp(targetQuaternion, 3 * deltaTime);
  }
  
  attack(): void {
    if (this.attackCooldown <= 0 && this.state !== EnemyState.DEAD) {
      this.attacking = true;
      this.attackCooldown = 1.5; // Cooldown before next attack
      
      // Simple attack animation tracked through time
      const attackDuration = 0.5; // seconds
      
      // Play attack sound
      gameAudio.playSound('lightsaberHum', { volume: 0.4 });
      
      // Schedule the end of attack
      setTimeout(() => {
        this.attacking = false;
      }, attackDuration * 1000);
    }
  }
  
  takeDamage(amount: number, hitPosition: Vector3): number {
    // If the enemy is dead, no more damage
    if (this.state === EnemyState.DEAD) {
      return 0;
    }
    
    // If blocking and hit is from the front, reduce damage
    if (this.blocking) {
      // Calculate direction from enemy to hit
      const toHit = new Vector3().subVectors(hitPosition, (this as any).position).normalize();
      toHit.y = 0; // Only consider xz plane for blocking
      
      // Get enemy forward direction
      const forward = new Vector3(0, 0, 1).applyQuaternion((this as any).quaternion);
      
      // If hit from the front (dot product > 0), block reduces damage by 75%
      const dot = forward.dot(toHit);
      if (dot > 0.3) { // Blocking angle (about 60 degrees from front)
        amount *= 0.25; // Reduce damage by 75%
        
        // Create a clash effect at the lightsaber position
        const clashPosition = this.lightsaber.getSaberTipPosition();
        const sceneParent = this.parent as Scene;
        createSaberClashEffect(sceneParent, clashPosition, '#ff8800');
      }
    }
    
    // Apply damage
    this.health -= amount;
    this.lastHitTime = performance.now();
    
    // Enter staggered state if hit
    if (amount > 0 && this.health > 0) {
      this.staggerTime = 0.3; // Staggered for 0.3 seconds
      this.state = EnemyState.STAGGERED;
    }
    
    // Check for death
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
    
    return amount; // Return actual damage dealt
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
}
