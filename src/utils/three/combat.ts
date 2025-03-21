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
    // Update player and enemy attack collisions
    this.checkPlayerAttacks(deltaTime);
    this.checkEnemyAttacks(deltaTime);
    
    // CRITICAL: Force enemy to swing lightsaber and deal damage
    for (const enemy of this.enemies) {
      if (enemy.isAlive() && enemy.isAttacking()) {
        if (!enemy.hasAppliedDamage && enemy.getAttackTimer() > 0.2) {
          // Apply damage only once during attack animation at the right moment
          const playerPos = this.player.getPosition();
          const enemyPos = enemy.getPosition();
          const distanceToPlayer = enemyPos.distanceTo(playerPos);
          
          // Check if player is in range
          if (distanceToPlayer <= enemy.getAttackRange()) {
            const damage = enemy.getAttackDamage();
            
            // Check if player is blocking in the right direction
            if (this.player.isBlocking()) {
              // Create clash effect at lightsaber intersection
              const saberPos = this.player.getLightsaberPosition();
              this.createClashEffect(saberPos);
              
              // Play clash sound
              gameAudio.playSound('lightsaberClash', { volume: 0.7 });
            } else {
              // Deal damage to player if not blocking
              this.player.takeDamage(damage, enemyPos);
            }
            
            // Mark damage as applied for this attack
            enemy.hasAppliedDamage = true;
          }
        }
      } else {
        // Reset damage flag when not attacking
        enemy.hasAppliedDamage = false;
      }
    }
  }
  
  private checkPlayerAttacks(deltaTime: number): void {
    // Check for combat interactions
    this.checkCombatInteractions(deltaTime);
    
    // Check for saber collisions
    this.checkSaberCollisions();
    
    // Update existing combat effects
    this.updateCombatEffects(deltaTime);
  }
  
  private checkEnemyAttacks(deltaTime: number): void {
    // Update enemy attack logic
    this.updateEnemyAttacks(deltaTime);
  }
  
  private checkCombatInteractions(deltaTime: number): void {
    // Skip if player is dead
    if (!this.player.isAlive()) return;
    
    // CRITICAL FIX: More aggressive damage detection
    const playerIsAttacking = this.player.isAttacking();
    
    // Log for debugging
    if (playerIsAttacking) {
      console.log("Player is attacking - checking for hits");
    }
    
    // Check each enemy
    for (const enemy of this.enemies) {
      if (!enemy.isAlive()) continue;
      
      // Always check distance
      const distance = enemy.position.distanceTo(this.player.getPosition());
      
      // CRITICAL FIX: More lenient hit detection when player is attacking
      if (playerIsAttacking && distance < 3.0) {
        console.log(`Enemy in range (${distance.toFixed(2)} units)`);
        
        // Force damage application with direct hit
        const damage = 25;
        enemy.takeDamage(damage, this.player.getPosition());
        console.log(`Applied ${damage} damage to enemy!`);
        
        // Create hit effect at enemy position
        const enemyPos = enemy.getPosition();
        enemyPos.y = 1.2; // Adjust to torso height
        createSaberClashEffect(this.scene, enemyPos, '#ff3300');
        
        // Play hit sound
        gameAudio.playSound('lightsaberHit', { volume: 0.8 });
        
        // Apply camera shake for feedback
        this.applyCameraShake(0.3);
        
        // Only damage one enemy per swing
        break;
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
