import {
  Group,
  Vector3,
  Object3D,
  Scene,
  AnimationMixer,
  Clock,
  Quaternion,
  Raycaster,
  BoxGeometry,
  MeshPhongMaterial,
  Mesh,
  MeshBasicMaterial,
  CylinderGeometry,
  PointLight,
  AdditiveBlending,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Lightsaber } from './lightsaber';
import gameAudio from './audio';
import { createHitEffect } from './effects';

export interface EnemyState {
  health: number;
  maxHealth: number;
  attacking: boolean;
  blocking: boolean;
  staggered: boolean;
  lastAttackTime: number;
  lastDecision: number;
  nextAttackDelay: number;
  targetPosition: Vector3;
  isDead: boolean;
}

export class Enemy extends Group {
  private scene: Scene;
  private model: Group | null = null;
  private lightsaber: Lightsaber;
  private mixer: AnimationMixer | null = null;
  private animations: Map<string, { clip: any; action: any }> = new Map();
  private clock: Clock = new Clock();
  private raycaster: Raycaster = new Raycaster();
  private collider: Object3D;
  private boundingBox: Mesh;
  private state: EnemyState = {
    health: 100,
    maxHealth: 100,
    attacking: false,
    blocking: false,
    staggered: false,
    lastAttackTime: 0,
    lastDecision: 0,
    nextAttackDelay: 0,
    targetPosition: new Vector3(),
    isDead: false,
  };
  
  // Movement
  private moveSpeed: number = 2.0;
  private minAttackDistance: number = 2.5;
  private maxAttackDistance: number = 4.0;
  private optimalDistance: number = 3.0;
  private rotationSpeed: number = 5.0;
  
  // Combat
  private attackCooldown: number = 1.0; // seconds
  private attackDamage: number = 15;
  private attackRange: number = 2.0;
  private attackProbability: number = 0.7;
  private blockProbability: number = 0.5;
  private decisionInterval: number = 0.5; // seconds
  
  constructor(scene: Scene) {
    super();
    this.scene = scene;
    
    // Create lightsaber
    this.lightsaber = new Lightsaber({
      bladeColor: '#ff3333', // Red
      length: 1.1,
    });
    this.lightsaber.position.set(0.4, 1.0, 0.2);
    this.lightsaber.rotateY(Math.PI / 2);
    this.add(this.lightsaber);
    this.lightsaber.activateBlade();
    
    // Create temporary enemy body until model is loaded
    this.createTemporaryBody();
    
    // Create collider
    const colliderGeometry = new BoxGeometry(0.7, 2, 0.7);
    const colliderMaterial = new MeshBasicMaterial({ visible: false });
    this.collider = new Mesh(colliderGeometry, colliderMaterial);
    this.collider.position.y = 1;
    this.add(this.collider);
    
    // Create debug bounding box (invisible in final version)
    const boundingGeometry = new BoxGeometry(0.7, 2, 0.7);
    const boundingMaterial = new MeshPhongMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.0, // Set to 0.2 to visualize collider
      blending: AdditiveBlending
    });
    this.boundingBox = new Mesh(boundingGeometry, boundingMaterial);
    this.boundingBox.position.y = 1;
    this.add(this.boundingBox);
  }
  
  private createTemporaryBody(): void {
    // Create a basic temporary body
    const bodyGeometry = new CylinderGeometry(0.3, 0.3, 1.8, 12);
    const bodyMaterial = new MeshPhongMaterial({
      color: 0x333333,
      specular: 0x111111,
      shininess: 30
    });
    const body = new Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.9;
    this.add(body);
    
    // Create a head
    const headGeometry = new CylinderGeometry(0.2, 0.2, 0.3, 12);
    const headMaterial = new MeshPhongMaterial({
      color: 0x222222,
      specular: 0x111111,
      shininess: 30
    });
    const head = new Mesh(headGeometry, headMaterial);
    head.position.y = 1.95;
    this.add(head);
    
    // Add some eyes
    const eyeGeometry = new CylinderGeometry(0.05, 0.05, 0.05, 8);
    const eyeMaterial = new MeshPhongMaterial({
      color: 0xff3333,
      emissive: 0xff0000,
      emissiveIntensity: 1
    });
    
    const leftEye = new Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(0.1, 2.0, 0.15);
    leftEye.rotateX(Math.PI / 2);
    this.add(leftEye);
    
    const rightEye = new Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(-0.1, 2.0, 0.15);
    rightEye.rotateX(Math.PI / 2);
    this.add(rightEye);
    
    // Add a glow
    const glow = new PointLight(0xff3333, 0.5, 2);
    glow.position.set(0, 1.8, 0);
    this.add(glow);
  }
  
  update(deltaTime: number, playerPosition: Vector3, playerDirection: Vector3): void {
    if (this.state.isDead) {
      // Handle death animation or removal
      return;
    }
    
    const time = performance.now();
    
    // Update mixer if available
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
    
    // Calculate distance to player
    const distanceToPlayer = this.position.distanceTo(playerPosition);
    
    // Make decisions about behavior
    if (time - this.state.lastDecision > this.decisionInterval * 1000) {
      this.state.lastDecision = time;
      
      if (!this.state.staggered) {
        // Reset blocking
        this.state.blocking = false;
        
        // Decide whether to attack
        if (distanceToPlayer <= this.maxAttackDistance && 
            time - this.state.lastAttackTime > this.attackCooldown * 1000 &&
            Math.random() < this.attackProbability) {
          this.attack();
        } 
        // Decide whether to block
        else if (distanceToPlayer <= this.maxAttackDistance && 
                Math.random() < this.blockProbability) {
          this.state.blocking = true;
        }
      }
    }
    
    // Movement logic
    if (!this.state.attacking && !this.state.staggered) {
      let moveTarget = new Vector3();
      
      if (distanceToPlayer > this.maxAttackDistance) {
        // Move closer to player
        moveTarget.copy(playerPosition)
          .sub(this.position)
          .normalize()
          .multiplyScalar(this.moveSpeed * deltaTime);
      } else if (distanceToPlayer < this.minAttackDistance) {
        // Back away slightly
        moveTarget.copy(this.position)
          .sub(playerPosition)
          .normalize()
          .multiplyScalar(this.moveSpeed * 0.5 * deltaTime);
      } else {
        // Circle around the player
        const circleDirection = new Vector3(-playerDirection.z, 0, playerDirection.x);
        moveTarget.copy(circleDirection)
          .normalize()
          .multiplyScalar(this.moveSpeed * 0.7 * deltaTime);
      }
      
      // Apply movement
      this.position.add(moveTarget);
    }
    
    // Always face the player
    const targetRotation = new Quaternion();
    const directionToPlayer = new Vector3()
      .subVectors(playerPosition, this.position)
      .normalize();
    directionToPlayer.y = 0; // Keep upright
    
    const forward = new Vector3(0, 0, 1);
    targetRotation.setFromUnitVectors(forward, directionToPlayer);
    
    // Smoothly rotate towards player
    this.quaternion.slerp(targetRotation, this.rotationSpeed * deltaTime);
    
    // Update lightsaber trail
    const isMoving = this.state.attacking || distanceToPlayer > this.optimalDistance;
    this.lightsaber.updateTrail(this.position, isMoving);
    
    // Check if attack has completed
    if (this.state.attacking && time - this.state.lastAttackTime > 0.7 * 1000) {
      this.state.attacking = false;
    }
    
    // Check if staggered state should end
    if (this.state.staggered && time - this.state.lastAttackTime > 1000) {
      this.state.staggered = false;
    }
  }
  
  attack(): void {
    if (this.state.attacking || this.state.staggered) return;
    
    const time = performance.now();
    this.state.attacking = true;
    this.state.lastAttackTime = time;
    
    // Generate swing sound
    this.lightsaber.swing(1.0);
    
    // Trigger attack animation if available
    // if (this.animations.has('attack')) {
    //   const attackAnim = this.animations.get('attack');
    //   attackAnim.action.reset().play();
    // }
  }
  
  takeDamage(amount: number, sourcePosition?: Vector3): number {
    // Reduced damage when blocking
    const actualDamage = this.state.blocking ? amount * 0.3 : amount;
    
    this.state.health -= actualDamage;
    
    if (this.state.health <= 0) {
      this.state.health = 0;
      this.state.isDead = true;
      this.die();
    } else {
      // Apply stagger effect if not blocking and damage is significant
      if (!this.state.blocking && actualDamage > 5) {
        this.state.staggered = true;
        this.state.lastAttackTime = performance.now(); // Reset timer for stagger recovery
      }
      
      // Visual/audio feedback
      if (this.state.blocking) {
        this.lightsaber.clash();
        
        // Create effect if source position is provided
        if (sourcePosition) {
          createHitEffect(this.scene, sourcePosition, '#ffaa00');
        }
      } else {
        gameAudio.playSound('enemyHit', { volume: 0.6 });
        
        // Create hit effect
        if (sourcePosition) {
          createHitEffect(
            this.scene,
            new Vector3().copy(this.position).add(new Vector3(0, 1, 0)),
            '#ff3333'
          );
        }
      }
    }
    
    return actualDamage;
  }
  
  die(): void {
    // Play death sound
    gameAudio.playSound('enemyDeath', { volume: 0.8 });
    
    // Deactivate lightsaber
    this.lightsaber.deactivateBlade();
    
    // Play death animation if available
    // if (this.animations.has('death')) {
    //   const deathAnim = this.animations.get('death');
    //   deathAnim.action.reset().play();
    // }
    
    // Create death effect
    createHitEffect(
      this.scene,
      new Vector3().copy(this.position).add(new Vector3(0, 1, 0)),
      '#ff3333'
    );
  }
  
  getHealth(): number {
    return this.state.health;
  }
  
  getMaxHealth(): number {
    return this.state.maxHealth;
  }
  
  isAttacking(): boolean {
    return this.state.attacking;
  }
  
  isBlocking(): boolean {
    return this.state.blocking;
  }
  
  isAlive(): boolean {
    return !this.state.isDead;
  }
  
  getAttackDamage(): number {
    return this.attackDamage;
  }
  
  getAttackRange(): number {
    return this.attackRange;
  }
  
  getSaberPosition(): Vector3 {
    // Get world position of lightsaber
    const position = new Vector3();
    this.lightsaber.getWorldPosition(position);
    return position;
  }
  
  getSaberTipPosition(): Vector3 {
    return this.lightsaber.getBladeEndPosition();
  }
}
