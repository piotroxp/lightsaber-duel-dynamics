
import {
  Group,
  CylinderGeometry,
  MeshStandardMaterial,
  Mesh,
  Color,
  PointLight,
  Vector3,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  MeshPhongMaterial,
} from 'three';
import gameAudio from './audio';

export interface LightsaberOptions {
  bladeColor: string;
  hiltColor?: string;
  length?: number;
  hiltLength?: number;
  bladeRadius?: number;
  hiltRadius?: number;
  intensity?: number;
}

const DEFAULT_OPTIONS: LightsaberOptions = {
  bladeColor: '#0088ff', // Blue
  hiltColor: '#777777',
  length: 1.3,
  hiltLength: 0.2,
  bladeRadius: 0.02,
  hiltRadius: 0.03,
  intensity: 1.5,
};

export class Lightsaber extends Group {
  private blade: Mesh;
  private hilt: Mesh;
  private bladeLight: PointLight;
  private trailGeometry: BufferGeometry;
  private trail: Line;
  private trailPositions: Vector3[];
  private bladeColor: Color;
  private active: boolean = false;
  private options: LightsaberOptions;
  private swingSound: any = null;
  private humSound: any = null;

  constructor(options: Partial<LightsaberOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.bladeColor = new Color(this.options.bladeColor);
    
    // Create hilt
    const hiltGeometry = new CylinderGeometry(
      this.options.hiltRadius!,
      this.options.hiltRadius! * 0.8,
      this.options.hiltLength!,
      16
    );
    const hiltMaterial = new MeshStandardMaterial({
      color: this.options.hiltColor,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.hilt = new Mesh(hiltGeometry, hiltMaterial);
    this.hilt.rotation.x = Math.PI / 2;
    this.add(this.hilt);
    
    // Create blade (initially inactive)
    const bladeGeometry = new CylinderGeometry(
      this.options.bladeRadius!,
      this.options.bladeRadius!,
      this.options.length!,
      16
    );
    const bladeMaterial = new MeshPhongMaterial({
      color: this.bladeColor,
      emissive: this.bladeColor,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.9,
      shininess: 100,
    });
    this.blade = new Mesh(bladeGeometry, bladeMaterial);
    this.blade.position.z = -this.options.length! / 2 + 0.05;
    this.blade.rotation.x = Math.PI / 2;
    this.blade.visible = false;
    this.add(this.blade);
    
    // Create blade light
    this.bladeLight = new PointLight(
      this.bladeColor,
      this.options.intensity,
      1.0
    );
    this.bladeLight.position.z = -this.options.length! / 2;
    this.bladeLight.visible = false;
    this.add(this.bladeLight);
    
    // Create trail effect
    this.trailPositions = [];
    const maxTrailPoints = 20;
    for (let i = 0; i < maxTrailPoints; i++) {
      this.trailPositions.push(new Vector3(0, 0, 0));
    }
    
    this.trailGeometry = new BufferGeometry().setFromPoints(this.trailPositions);
    const trailMaterial = new LineBasicMaterial({
      color: this.bladeColor,
      transparent: true,
      opacity: 0.5,
      linewidth: 1
    });
    
    this.trail = new Line(this.trailGeometry, trailMaterial);
    this.trail.visible = false;
    this.add(this.trail);
  }
  
  activateBlade(): void {
    if (this.active) return;
    
    this.blade.visible = true;
    this.bladeLight.visible = true;
    this.trail.visible = true;
    this.active = true;
    
    const igniteSound = gameAudio.playSound('lightsaberOn', { volume: 0.7 });
    this.humSound = gameAudio.playSound('lightsaberHum', { loop: true, volume: 0.3 });
  }
  
  deactivateBlade(): void {
    if (!this.active) return;
    
    this.blade.visible = false;
    this.bladeLight.visible = false;
    this.trail.visible = false;
    this.active = false;
    
    const deactivateSound = gameAudio.playSound('lightsaberOff', { volume: 0.7 });
    
    if (this.humSound) {
      this.humSound.stop();
      this.humSound = null;
    }
  }
  
  swing(intensity = 1.0): void {
    if (!this.active) return;
    
    if (this.swingSound) {
      this.swingSound.stop();
    }
    
    this.swingSound = gameAudio.playSound('lightsaberSwing', {
      volume: 0.5 * intensity
    });
  }
  
  clash(): void {
    if (!this.active) return;
    
    gameAudio.playSound('lightsaberClash', { volume: 0.8 });
    
    // Flash the blade briefly
    const originalEmissiveIntensity = (this.blade.material as MeshPhongMaterial).emissiveIntensity;
    const originalLightIntensity = this.bladeLight.intensity;
    
    (this.blade.material as MeshPhongMaterial).emissiveIntensity = 2.0;
    this.bladeLight.intensity = this.options.intensity! * 2;
    
    setTimeout(() => {
      (this.blade.material as MeshPhongMaterial).emissiveIntensity = originalEmissiveIntensity;
      this.bladeLight.intensity = originalLightIntensity;
    }, 100);
  }
  
  updateTrail(position: Vector3, isMoving: boolean): void {
    if (!this.active) return;
    
    if (isMoving) {
      // Get blade tip position in world space
      const tipPosition = this.getBladeEndPosition();
      
      // Add new position to the beginning of the array
      this.trailPositions.unshift(tipPosition.clone());
      
      // Remove the last position
      this.trailPositions.pop();
      
      // Update the trail geometry
      this.trailGeometry.setFromPoints(this.trailPositions);
      this.trail.visible = true;
    } else {
      // Reset trail when not moving
      const tipPosition = this.getBladeEndPosition();
      for (let i = 0; i < this.trailPositions.length; i++) {
        this.trailPositions[i].copy(tipPosition);
      }
      this.trailGeometry.setFromPoints(this.trailPositions);
      this.trail.visible = false;
    }
  }
  
  getBladeEndPosition(): Vector3 {
    // Calculate blade tip position
    const tipPosition = new Vector3(0, 0, -this.options.length!);
    return this.localToWorld(tipPosition.clone());
  }
  
  getHiltPosition(): Vector3 {
    return this.localToWorld(new Vector3(0, 0, 0));
  }
  
  isActive(): boolean {
    return this.active;
  }
  
  setColor(color: string): void {
    this.bladeColor = new Color(color);
    if (this.blade) {
      (this.blade.material as MeshPhongMaterial).color = this.bladeColor;
      (this.blade.material as MeshPhongMaterial).emissive = this.bladeColor;
    }
    if (this.bladeLight) {
      this.bladeLight.color = this.bladeColor;
    }
    if (this.trail && this.trail.material) {
      (this.trail.material as LineBasicMaterial).color = this.bladeColor;
    }
  }
}
