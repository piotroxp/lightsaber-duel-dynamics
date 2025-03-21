
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
    
    // Update existing combat effects
    this.updateCombatEffects(deltaTime);
  }
  
  private checkCombatInteractions(deltaTime: number): void {
    // Check player attacks against enemies
    this.checkPlayerAttacks();
    
    // Check enemy attacks against player
    this.checkEnemyAttacks();
  }
  
  private updateCombatEffects(deltaTime: number): void {
    // Update any ongoing combat effects
    // This would update particles, sounds, etc.
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
          // Enemy blocked the attack - create impressive clash effect
          this.createSaberClash(lightsaberTip, enemy.getSaberTipPosition());
          
          // Apply camera shake for heavy feeling
          this.applyCameraShake(0.2);
          
          try {
            gameAudio.playSound('lightsaber_clash', { volume: 0.9 });
          } catch (error) {
            console.warn("Failed to play clash sound:", error);
          }
        } else {
          // Enemy took damage
          this.lastHitTime = currentTime;
          
          try {
            gameAudio.playSound('enemy_hit', { volume: 0.6 });
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
          // Player blocked the attack - create impressive clash effect
          this.createSaberClash(this.player.getLightsaberPosition(), enemy.getSaberTipPosition());
          
          // Apply camera shake for heavy feeling - stronger when player blocks
          this.applyCameraShake(0.3);
          
          try {
            gameAudio.playSound('lightsaber_clash', { volume: 0.9 });
          } catch (error) {
            console.warn("Failed to play clash sound:", error);
          }
        } else {
          // Player took damage
          try {
            gameAudio.playSound('player_hit', { volume: 0.6 });
          } catch (error) {
            console.warn("Failed to play hit sound:", error);
          }
          
          // Apply camera shake when player is hit
          this.applyCameraShake(0.4);
          
          // Apply damage to player
          this.player.takeDamage(10);
        }
      }
    }
  }
  
  private createSaberClash(position1: Vector3, position2: Vector3): void {
    // Calculate middle point between the two lightsabers
    const clashPosition = new Vector3().addVectors(position1, position2).multiplyScalar(0.5);
    
    // Create clash effect at the computed position
    createSaberClashEffect(this.scene, clashPosition, '#ffaa33');
    
    // Create a smaller secondary effect
    setTimeout(() => {
      createSaberClashEffect(this.scene, clashPosition, '#ffffff');
    }, 50);
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
