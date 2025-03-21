import { Scene, Raycaster, Vector3, Mesh, Group, Object3D, Camera } from 'three';
import { Player } from './player';
import { Enemy } from './enemy';
import gameAudio from './audio';
import { createSaberClashEffect } from './effects';

export class CombatSystem {
  private scene: Scene;
  private player: Player;
  private enemies: Enemy[] = [];
  private raycaster: Raycaster;
  private hitCooldown: number = 0.4; // seconds
  private lastHitTime: number = 0;
  private camera: Camera | null = null;
  
  constructor(scene: Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.raycaster = new Raycaster();
  }
  
  setCamera(camera: Camera): void {
    this.camera = camera;
  }
  
  addEnemy(enemy: Enemy): void {
    this.enemies.push(enemy);
  }
  
  getEnemies(): Enemy[] {
    return this.enemies;
  }
  
  update(deltaTime: number): void {
    // Check for combat interactions
    this.checkCombatInteractions(deltaTime);
    
    // Check for saber collisions
    this.checkSaberCollisions();
    
    // Update existing combat effects
    this.updateCombatEffects(deltaTime);
    
    // Update enemy attack logic
    this.updateEnemyAttacks(deltaTime);
  }
  
  private checkCombatInteractions(deltaTime: number): void {
    // Skip if player is dead
    if (!this.player.isAlive()) return;
    
    // Check if player's lightsaber hits any enemies
    if (this.player.isAttacking()) {
      const playerSaberPosition = this.player.getLightsaberPosition();
      
      for (const enemy of this.enemies) {
        if (!enemy.isAlive()) continue;
        
        // Calculate distance to enemy
        const distance = enemy.position.distanceTo(this.player.getPosition());
        
        if (distance < 3.0) { // Within striking range
          // Get more precise collision using lightsaber tip
          const enemyPosition = enemy.position.clone();
          enemyPosition.y = 1.2; // Adjust to center mass
          
          const saberToEnemy = enemyPosition.distanceTo(playerSaberPosition);
          
          if (saberToEnemy < 0.7) { // Close enough for a hit
            // Check if enemy is blocking
            if (enemy.isBlocking()) {
              // Create clash effect
              const clashPosition = playerSaberPosition.clone().lerp(enemyPosition, 0.5);
              
              // Play clash sound
              this.player.playLightsaberClashSound();
              enemy.playLightsaberClashSound();
              
              // Create visual effect
              createSaberClashEffect(this.scene, clashPosition);
              
              // Apply camera shake
              this.applyCameraShake(0.3);
            } else {
              // Enemy hit!
              enemy.takeDamage(20);
              
              // Create hit effect
              createHitEffect(this.scene, playerSaberPosition, '#ff0000');
              
              // Play hit sound
              gameAudio.playSound('enemy_hit', { volume: 0.6 });
              
              // Apply camera shake
              this.applyCameraShake(0.15);
            }
          }
        }
      }
    }
  }
  
  private checkSaberCollisions(): void {
    // Check for lightsaber vs lightsaber collisions
    if (!this.player.isAlive()) return;
    
    const playerSaberTip = this.player.getLightsaberPosition();
    
    for (const enemy of this.enemies) {
      if (!enemy.isAlive()) continue;
      
      const enemySaberTip = enemy.getLightsaberPosition();
      
      // Calculate distance between sabers
      const saberDistance = playerSaberTip.distanceTo(enemySaberTip);
      
      if (saberDistance < 0.4) { // Sabers are clashing
        // Calculate midpoint for effect
        const clashPosition = playerSaberTip.clone().lerp(enemySaberTip, 0.5);
        
        // Create clash effect
        createSaberClashEffect(this.scene, clashPosition, '#ffff00');
        
        // Play clash sound
        this.player.playLightsaberClashSound();
        enemy.playLightsaberClashSound();
        
        // Apply camera shake
        this.applyCameraShake(0.4);
        
        // Mark the clash so we don't create too many effects
        this.lastHitTime = performance.now() / 1000;
      }
    }
  }
  
  private updateEnemyAttacks(deltaTime: number): void {
    // Skip if player is dead
    if (!this.player.isAlive()) return;
    
    // Current time for cooldowns
    const currentTime = performance.now() / 1000;
    
    for (const enemy of this.enemies) {
      if (!enemy.isAlive()) continue;
      
      // Calculate distance to player
      const distanceToPlayer = enemy.position.distanceTo(this.player.getPosition());
      
      // Check if enemy is in attack range and not on cooldown
      if (distanceToPlayer < enemy.getAttackRange() && 
          currentTime - enemy.getLastAttackTime() > enemy.getAttackCooldown()) {
        
        // Trigger attack
        enemy.attack();
        
        // Check if player is blocking
        if (this.player.isBlocking()) {
          // Calculate player facing direction vs enemy direction
          const playerDirection = this.player.getDirection();
          const enemyDirection = new Vector3()
            .subVectors(enemy.position, this.player.getPosition())
            .normalize();
          
          // Dot product to check if player is facing the attack
          const facingDot = playerDirection.dot(enemyDirection);
          
          if (facingDot < -0.5) { // Player is mostly facing the enemy
            // Successfully blocked!
            const blockPosition = this.player.getPosition().clone();
            blockPosition.y = 1.2;
            
            // Create clash effect
            createSaberClashEffect(this.scene, blockPosition, '#ffff00');
            
            // Play clash sound
            gameAudio.playSound('lightsaberClash', { volume: 0.7 });
            
            // Apply camera shake
            this.applyCameraShake(0.3);
          } else {
            // Block failed, angled wrong
            this.player.takeDamage(enemy.getAttackDamage() * 0.5); // Reduced damage
          }
        } else {
          // Direct hit on player
          this.player.takeDamage(enemy.getAttackDamage());
          
          // Create hit effect
          const hitPosition = this.player.getPosition().clone();
          hitPosition.y = 1.4;
          createHitEffect(this.scene, hitPosition, '#ff0000');
          
          // Apply camera shake
          this.applyCameraShake(0.5);
        }
      }
    }
  }
  
  private updateCombatEffects(deltaTime: number): void {
    // Update any ongoing combat effects
    // This would update particles, sounds, etc.
  }
  
  private applyCameraShake(intensity: number): void {
    if (!this.camera) return;
    
    // Store original camera position
    const originalPosition = this.camera.position.clone();
    
    // Apply random shake to camera
    const shake = () => {
      const offsetX = (Math.random() - 0.5) * intensity;
      const offsetY = (Math.random() - 0.5) * intensity;
      const offsetZ = (Math.random() - 0.5) * intensity;
      
      this.camera.position.set(
        originalPosition.x + offsetX,
        originalPosition.y + offsetY,
        originalPosition.z + offsetZ
      );
    };
    
    // Schedule shake and reset
    shake();
    
    setTimeout(() => shake(), 50);
    setTimeout(() => shake(), 100);
    setTimeout(() => {
      // Reset camera to original position
      this.camera.position.copy(originalPosition);
    }, 150);
  }
}
