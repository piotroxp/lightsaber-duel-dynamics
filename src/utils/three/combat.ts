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
    // Call the saber collision check
    this.checkSaberCollisions();
    
    // CRITICAL: Call our new damage detection methods
    this.checkPlayerDamageToEnemies();
    this.checkEnemyDamageToPlayer(deltaTime);
    
    // Debug the attack states
    if (this.player.isAttacking()) {
      console.log("Player is attacking - checking for damage");
    }
    
    // Check for player attacking enemies
    if (this.player.isAttacking()) {
      const playerPos = this.player.getPosition();
      
      for (const enemy of this.enemies) {
        if (!enemy.isAlive()) continue;
        
        // Calculate distance between player and enemy
        const distance = playerPos.distanceTo(enemy.position);
        
        // If in strike range, apply damage
        if (distanceToEnemy < 2.5) {
          // Get current attack position (lightsaber blade)
          const attackPos = this.player.getLightsaberPosition();
          
          // Calculate more precise hit detection
          const hitDist = enemy.position.distanceTo(attackPos);
          
          // CRITICAL: Direct damage application - guaranteed hit at close range
          if (hitDist < 2.0) {
            console.log("Player hit enemy with lightsaber!");
            
            // Apply significant damage
            enemy.takeDamage(25, playerPos);
            
            // Visual and sound effects
            const hitPosition = enemy.position.clone();
            hitPosition.y = 1.2;
            createHitEffect(this.scene, hitPosition, '#ff0000');
            gameAudio.playSound('enemyHit', { volume: 0.8 });
            
            // Force feedback
            this.applyCameraShake(0.3);    
            this.applyDamageToEnemy(enemy, 25, playerPos);
            
            // Only hit one enemy per swing
            break;
          }
        }
      }
    }
    
    // Check for enemies attacking player
    for (const enemy of this.enemies) {
      if (!enemy.isAlive() || !enemy.isAttacking()) continue;
      
      // CRITICAL FIX: Force damage application during attack animation
      const attackProgress = enemy.getAttackTimer();
      
      // Apply damage at the peak of the swing
      if (attackProgress > 0.2 && attackProgress < 0.5) {
        const distanceToPlayer = enemy.position.distanceTo(this.player.getPosition());
        
        // If enemy is close enough to hit player
        if (distanceToPlayer < 2.5) {
          console.log("Enemy hit player with lightsaber!");
          
          // Apply damage directly
          this.player.takeDamage(enemy.getAttackDamage(), enemy.getPosition());
          
          // Visual and sound effects
          const hitPos = this.player.getPosition().clone();
          hitPos.y = 1.2;
          createHitEffect(this.scene, hitPos, '#ff0000');
          gameAudio.playSound('playerHit', { volume: 0.8 });
          
          // Force feedback
          this.applyCameraShake(0.5);
        }
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
    if (!this.player.isAlive()) return;
    
    try {
      // Get player lightsaber position
      const playerSaberTip = this.player.getLightsaberPosition();
      console.log("Player saber position:", playerSaberTip);
      
      for (const enemy of this.enemies) {
        if (!enemy.isAlive()) continue;
        
        try {
          // Get enemy lightsaber position
          const enemySaberTip = enemy.getLightsaberPosition();
          console.log("Enemy saber position:", enemySaberTip);
          
          // Calculate distance between sabers
          const saberDistance = playerSaberTip.distanceTo(enemySaberTip);
          console.log("Saber distance:", saberDistance);
          
          // CRITICAL: More generous collision detection
          if (saberDistance < 1.5) {
            console.log("LIGHTSABER CLASH DETECTED!");
            
            // Calculate midpoint for effect
            const clashPosition = playerSaberTip.clone().lerp(enemySaberTip, 0.5);
            
            // Create clash effect
            createSaberClashEffect(this.scene, clashPosition, '#ffffff');
            
            // Play clash sound
            gameAudio.playSound('lightsaberClash', { volume: 1.0 });
            
            // Apply camera shake
            this.applyCameraShake(0.6);
            
            // Force sabers back to spawn positions by applying "stagger" effect
            this.player.applyStagger(0.3);
            enemy.applyStagger(0.3);
            
            // Mark the clash so we don't create too many effects
            this.lastHitTime = performance.now() / 1000;
          }
        } catch (error) {
          console.error("Error during saber collision check:", error);
        }
      }
    } catch (error) {
      console.error("Error in checkSaberCollisions:", error);
    }
  }
  
  private updateEnemyAttacks(deltaTime: number): void {
    // Skip if player is dead
    if (!this.player.isAlive()) return;
    
    for (const enemy of this.enemies) {
      if (!enemy.isAlive()) continue;
      
      // CRITICAL: Directly apply damage when enemy is attacking and in range
      if (enemy.isAttacking()) {
        const playerPos = this.player.getPosition();
        const enemyPos = enemy.getPosition();
        const distanceToPlayer = enemyPos.distanceTo(playerPos);
        
        // Force damage application at attack peak (when timer is ~0.3-0.5)
        const attackProgress = enemy.getAttackTimer();
        
        if (attackProgress > 0.3 && attackProgress < 0.5 && distanceToPlayer < 3) {
          console.log("Enemy attack connecting with player!");
          
          // Deal damage to player directly
          const damage = enemy.getAttackDamage();
          this.player.takeDamage(damage, enemyPos);
          
          // Visual feedback
          const attackPos = playerPos.clone();
          attackPos.y = 1.4; // Adjust to player's torso height
          createHitEffect(this.scene, attackPos, '#ff0000');
          
          // Sound effect
          gameAudio.playSound('player_hit', { volume: 0.7 });
          
          // Camera shake
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

  applyDamageToEnemy(enemy: Enemy, amount: number, sourcePosition: Vector3): void {
    // Direct damage application with console log for debugging
    console.log(`Applying ${amount} damage to enemy`);
    enemy.takeDamage(amount, sourcePosition);
      
    // Visual and audio effects
    const hitPosition = enemy.position.clone();
    hitPosition.y = 1.2;
    createHitEffect(this.scene, hitPosition, '#ff0000');
    gameAudio.playSound('enemyHit', { volume: 0.7 });
  }

  checkPlayerDamageToEnemies(): void {
    if (!this.player.isAttacking()) return;
    
    console.log("Checking for player damage to enemies");
    const playerSaberPos = this.player.getLightsaberPosition();
    
    for (const enemy of this.enemies) {
      if (!enemy.isAlive()) continue;
      
      // More generous distance check (3.0 units)
      const hitDistance = enemy.position.distanceTo(playerSaberPos);
      console.log(`Distance to enemy: ${hitDistance.toFixed(2)} units`);
      
      if (hitDistance < 3.0) {
        console.log(`DIRECT HIT: Player hit enemy at distance ${hitDistance.toFixed(2)}`);
        this.applyDamageToEnemy(enemy, 25, playerSaberPos);
        break; // Only hit one enemy per swing
      }
    }
  }

  checkEnemyDamageToPlayer(deltaTime: number): void {
    if (!this.player.isAlive()) return;
    
    for (const enemy of this.enemies) {
      if (!enemy.isAlive() || !enemy.isAttacking()) continue;
      
      // Simplified check for reliable enemy hits
      const enemySaberPos = enemy.getLightsaberPosition();
      const distToPlayer = this.player.getPosition().distanceTo(enemySaberPos);
      
      if (distToPlayer < 1.8 && enemy.getAttackTimer() > 0.2) {
        this.player.takeDamage(enemy.getAttackDamage(), enemy.getPosition());
        break;
      }
    }
  }
}
