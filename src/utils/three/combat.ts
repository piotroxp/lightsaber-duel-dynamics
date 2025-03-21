
import { Scene, Raycaster, Vector3, Mesh, Group, Object3D } from 'three';
import { Player } from './player';
import { Enemy } from './enemy';
import gameAudio from './audio';

export class CombatSystem {
  private scene: Scene;
  private player: Player;
  private enemies: Enemy[] = [];
  private raycaster: Raycaster;
  private hitCooldown: number = 0.4; // seconds
  private lastHitTime: number = 0;
  
  constructor(scene: Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.raycaster = new Raycaster();
  }
  
  addEnemy(enemy: Enemy): void {
    this.enemies.push(enemy);
  }
  
  getEnemies(): Enemy[] {
    return this.enemies;
  }
  
  update(): void {
    // Check for player attacks hitting enemies
    this.checkPlayerAttacks();
    
    // Check for enemy attacks hitting player
    this.checkEnemyAttacks();
    
    // Remove dead enemies
    this.enemies = this.enemies.filter(enemy => enemy.isAlive());
  }
  
  private checkPlayerAttacks(): void {
    if (!this.player.isAttacking()) return;
    
    const currentTime = performance.now() / 1000;
    if (currentTime - this.lastHitTime < this.hitCooldown) return;
    
    // Get lightsaber position and direction
    const lightsaberTip = this.player.getLightsaberPosition();
    const direction = new Vector3(0, 0, -1).applyQuaternion(this.player.getQuaternion());
    
    // Set up raycaster for hit detection
    this.raycaster.set(lightsaberTip, direction);
    
    // Check for hits against enemies
    for (const enemy of this.enemies) {
      if (!enemy.isAlive()) continue;
      
      // Simple distance check for hits
      const distanceToEnemy = lightsaberTip.distanceTo(enemy.position);
      
      if (distanceToEnemy < 2.0) {
        // Enemy is hit!
        console.log("Player hit enemy!");
        
        if (enemy.isBlocking()) {
          // Enemy blocked the attack
          try {
            gameAudio.playSound('lightsaber_clash', { volume: 0.7 });
          } catch (error) {
            console.warn("Failed to play clash sound:", error);
          }
        } else {
          // Enemy took damage
          this.lastHitTime = currentTime;
          
          try {
            gameAudio.playSound('enemy_hit', { volume: 0.5 });
          } catch (error) {
            console.warn("Failed to play hit sound:", error);
          }
          
          // Apply damage to enemy
          enemy.takeDamage(20, direction);
        }
      }
    }
  }
  
  private checkEnemyAttacks(): void {
    for (const enemy of this.enemies) {
      if (!enemy.isAttacking() || !enemy.isAlive()) continue;
      
      // Check if enemy is close enough to hit player
      const distanceToPlayer = enemy.position.distanceTo(this.player.position);
      
      if (distanceToPlayer < 2.0) {
        // Player is hit!
        if (this.player.isBlocking()) {
          // Player blocked the attack
          try {
            gameAudio.playSound('lightsaber_clash', { volume: 0.7 });
          } catch (error) {
            console.warn("Failed to play clash sound:", error);
          }
        } else {
          // Player took damage
          try {
            gameAudio.playSound('player_hit', { volume: 0.5 });
          } catch (error) {
            console.warn("Failed to play hit sound:", error);
          }
          
          // Apply damage to player
          this.player.takeDamage(10);
        }
      }
    }
  }
}
