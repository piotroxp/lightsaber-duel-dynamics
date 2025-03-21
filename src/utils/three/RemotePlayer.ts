import { Group, Vector3, Quaternion, Mesh, BoxGeometry, MeshBasicMaterial, CylinderGeometry, MeshStandardMaterial, Scene, Object3D } from 'three';
import { Lightsaber } from './lightsaber';

export class RemotePlayer extends Group {
  private id: string;
  private scene: Scene;
  private lightsaber: Lightsaber;
  private health: number = 100;
  private body: Group;
  private targetPosition: Vector3 = new Vector3();
  private targetRotation: Quaternion = new Quaternion();
  private targetLightsaberPosition: Vector3 = new Vector3();
  private targetLightsaberRotation: Quaternion = new Quaternion();
  private isAttacking: boolean = false;
  private isBlocking: boolean = false;
  
  constructor(scene: Scene, id: string) {
    super();
    
    this.id = id;
    this.scene = scene;
    
    // Create body
    this.body = new Group();
    this.add(this.body);
    
    // Create mesh for player body
    const bodyMesh = new Mesh(
      new BoxGeometry(0.5, 1.8, 0.5),
      new MeshBasicMaterial({ color: 0x0000ff }) // Blue for opponent
    );
    bodyMesh.position.y = 0.9;
    this.body.add(bodyMesh);
    
    // Create head
    const head = new Mesh(
      new BoxGeometry(0.4, 0.4, 0.4),
      new MeshBasicMaterial({ color: 0x0055ff })
    );
    head.position.y = 1.8;
    this.body.add(head);
    
    // Create lightsaber with red color
    this.lightsaber = new Lightsaber({
      color: '#ff0000',
      bladeLength: 1.2,
      hiltLength: 0.2
    });
    this.lightsaber.position.set(0.4, 0.9, 0.2);
    this.lightsaber.rotateY(Math.PI * 0.25);
    this.body.add(this.lightsaber);
    this.lightsaber.activate();
    
    this.name = `remote-player-${id}`;
  }
  
  public update(deltaTime: number): void {
    // Smooth interpolation of position and rotation
    this.position.lerp(this.targetPosition, 0.2);
    this.quaternion.slerp(this.targetRotation, 0.2);
    
    // Update lightsaber position and rotation
    this.lightsaber.position.lerp(this.targetLightsaberPosition, 0.2);
    this.lightsaber.quaternion.slerp(this.targetLightsaberRotation, 0.2);
    
    // Update lightsaber animation
    this.lightsaber.update(deltaTime);
    
    // Update visual state based on actions
    if (this.isAttacking) {
      // Show attack animation
      this.lightsaber.attack();
    }
    
    if (this.isBlocking) {
      // Show blocking stance
      this.lightsaber.block();
    }
  }
  
  public updateFromNetwork(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number; w: number },
    lightsaberPosition: { x: number; y: number; z: number },
    lightsaberRotation: { x: number; y: number; z: number; w: number },
    isAttacking: boolean,
    isBlocking: boolean
  ): void {
    // Update target positions for smooth interpolation
    this.targetPosition.set(position.x, position.y, position.z);
    this.targetRotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
    this.targetLightsaberPosition.set(
      lightsaberPosition.x,
      lightsaberPosition.y,
      lightsaberPosition.z
    );
    this.targetLightsaberRotation.set(
      lightsaberRotation.x,
      lightsaberRotation.y,
      lightsaberRotation.z,
      lightsaberRotation.w
    );
    
    this.isAttacking = isAttacking;
    this.isBlocking = isBlocking;
  }
  
  public setHealth(health: number): void {
    this.health = health;
    
    // Visual feedback for health
    const healthPercent = health / 100;
    if (healthPercent < 0.3) {
      // Low health indicator
      this.body.scale.set(1, healthPercent * 1.5 + 0.5, 1);
    }
  }
  
  public getHealth(): number {
    return this.health;
  }
  
  public getId(): string {
    return this.id;
  }
} 