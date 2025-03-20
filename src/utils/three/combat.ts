
import { Vector3, Scene } from 'three';
import { Player } from './player';
import { Enemy } from './enemy';
import { createSaberClashEffect } from './effects';
import gameAudio from './audio';

export interface CombatState {
  inProgress: boolean;
  lastClashTime: number;
  clashCooldown: number;
}

export class CombatSystem {
  private scene: Scene;
  private player: Player;
  private enemies: Enemy[] = [];
  private state: CombatState = {
    inProgress: false,
    lastClashTime: 0,
    clashCooldown: 200, // ms
  };
  
  constructor(scene: Scene, player: Player) {
    this.scene = scene;
    this.player = player;
  }
  
  addEnemy(enemy: Enemy): void {
    this.enemies.push(enemy);
  }
  
  removeEnemy(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy);
    if (index !== -1) {
      this.enemies.splice(index, 1);
    }
  }
  
  update(): void {
    const time = performance.now();
    
    // Check for lightsaber clashing
    if (time - this.state.lastClashTime > this.state.clashCooldown) {
      for (const enemy of this.enemies) {
        if (!enemy.isAlive()) continue;
        
        // Get saber positions
        const playerSaberTip = this.player.getSaberTipPosition();
        const enemySaberTip = enemy.getSaberTipPosition();
        
        // Check distance between sabers
        const clashDistanceThreshold = 0.3;
        const distance = playerSaberTip.distanceTo(enemySaberTip);
        
        if (distance < clashDistanceThreshold) {
          // Create clash effect at midpoint between sabers
          const clashPosition = new Vector3().addVectors(
            playerSaberTip,
            enemySaberTip
          ).multiplyScalar(0.5);
          
          createSaberClashEffect(this.scene, clashPosition, '#ffffff');
          gameAudio.playSound('lightsaberClash', { volume: 0.7 });
          
          this.state.lastClashTime = time;
          break;
        }
      }
    }
    
    // Process player attacks
    if (this.player.isAttacking()) {
      const playerPosition = this.player.getPosition();
      const playerDirection = this.player.getDirection();
      
      for (const enemy of this.enemies) {
        if (!enemy.isAlive()) continue;
        
        const enemyPosition = enemy.position.clone();
        enemyPosition.y += 1.0; // Adjust to hit center of enemy
        
        // Calculate vector from player to enemy
        const toEnemy = new Vector3().subVectors(enemyPosition, playerPosition);
        
        // Check if enemy is in front of player (dot product with player's direction)
        const dot = toEnemy.normalize().dot(playerDirection);
        const attackRange = 2.5;
        const attackAngle = 0.5; // cos of angle (roughly 60 degrees)
        
        if (dot > attackAngle && playerPosition.distanceTo(enemyPosition) < attackRange) {
          // Calculate attack source for visual effect
          const attackSource = this.player.getSaberTipPosition();
          
          // Enemy takes damage if not blocking or if attack from behind
          const damageDealt = enemy.takeDamage(20, attackSource);
          
          if (damageDealt > 0) {
            // Play hit sound based on whether enemy blocked or not
            if (enemy.isBlocking()) {
              gameAudio.playSound('lightsaberClash', { volume: 0.6 });
            } else {
              gameAudio.playSound('enemyHit', { volume: 0.7 });
            }
          }
        }
      }
    }
    
    // Process enemy attacks
    for (const enemy of this.enemies) {
      if (!enemy.isAlive() || !enemy.isAttacking()) continue;
      
      const playerPosition = this.player.getPosition();
      const enemyPosition = enemy.position.clone();
      
      // Check distance
      const attackRange = enemy.getAttackRange();
      if (enemyPosition.distanceTo(playerPosition) <= attackRange) {
        // Calculate attack source for visual effect
        const attackSource = enemy.getSaberTipPosition();
        
        // Player takes damage
        const damageAmount = enemy.getAttackDamage();
        const damageDealt = this.player.takeDamage(damageAmount, attackSource);
        
        if (damageDealt > 0) {
          // Play appropriate sound
          if (this.player.isBlocking()) {
            gameAudio.playSound('lightsaberClash', { volume: 0.6 });
          } else {
            gameAudio.playSound('playerHit', { volume: 0.7 });
          }
        }
      }
    }
  }
  
  isPlayerAlive(): boolean {
    return this.player.isAlive();
  }
  
  areAllEnemiesDead(): boolean {
    return this.enemies.every(enemy => !enemy.isAlive());
  }
  
  getEnemies(): Enemy[] {
    return this.enemies;
  }
}
