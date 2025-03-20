
import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  Vector3,
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  Clock,
  Fog,
  HemisphereLight,
  TextureLoader,
  RepeatWrapping,
  SRGBColorSpace,
  PointLight,
  Color,
  Raycaster,
  Group,
  BoxGeometry,
  MeshBasicMaterial,
  FogExp2,
} from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Player } from './player';
import { Enemy } from './enemy';
import { CombatSystem } from './combat';
import { ParticleSystem } from './effects';
import gameAudio from './audio';

export class GameScene {
  private container: HTMLElement;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private controls: PointerLockControls;
  private player: Player;
  private enemies: Enemy[] = [];
  private combatSystem: CombatSystem;
  private particleSystem: ParticleSystem;
  private clock: Clock = new Clock();
  private isInitialized: boolean = false;
  private onLoadProgress: (progress: number) => void;
  private onLoadComplete: () => void;
  private backgroundMusic: any = null;
  
  constructor(
    container: HTMLElement,
    onLoadProgress: (progress: number) => void = () => {},
    onLoadComplete: () => void = () => {}
  ) {
    this.container = container;
    this.onLoadProgress = onLoadProgress;
    this.onLoadComplete = onLoadComplete;
    
    // Create scene
    this.scene = new Scene();
    this.scene.fog = new FogExp2(0x000000, 0.03);
    
    // Create camera
    this.camera = new PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.7, 5);
    
    // Create renderer
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    
    // Create controls
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    
    // Create player
    this.player = new Player(this.camera, this.scene);
    
    // Create combat system
    this.combatSystem = new CombatSystem(this.scene, this.player);
    
    // Create particle system
    this.particleSystem = new ParticleSystem(this.scene);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Load assets with proper error handling
    try {
      await this.loadAssets();
      
      // Setup lighting
      this.setupLighting();
      
      // Create environment
      this.createEnvironment();
      
      // Create enemies
      this.createEnemies();
      
      // Start animation loop
      this.animate();
      
      this.isInitialized = true;
      console.log("Game scene initialized successfully");
      this.onLoadComplete();
    } catch (error) {
      console.error("Error initializing game scene:", error);
    }
  }
  
  private async loadAssets(): Promise<boolean> {
    try {
      // Initialize audio with better progress tracking
      await gameAudio.initialize((progress) => {
        console.log("Audio loading progress:", progress);
        this.onLoadProgress(progress * 0.8); // Audio is 80% of loading
      });
      
      // Load textures
      const textureLoader = new TextureLoader();
      await new Promise<void>((resolve, reject) => {
        textureLoader.load(
          '/textures/floor.jpg', 
          (texture) => {
            console.log("Floor texture loaded");
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            texture.repeat.set(10, 10);
            this.onLoadProgress(0.9); // Textures are 10% of loading
            resolve();
          },
          // Progress callback
          (xhr) => {
            console.log(`Texture ${(xhr.loaded / xhr.total) * 100}% loaded`);
          },
          // Error callback
          (error) => {
            console.error("Error loading texture:", error);
            // Continue even if texture fails
            this.onLoadProgress(0.9);
            resolve();
          }
        );
      });
      
      this.onLoadProgress(1.0);
      console.log("All assets loaded successfully");
      
      return true;
    } catch (error) {
      console.error("Error loading assets:", error);
      // Complete loading even if there's an error
      this.onLoadProgress(1.0);
      return false;
    }
  }
  
  private setupLighting(): void {
    // Ambient light
    const ambientLight = new AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);
    
    // Hemisphere light
    const hemisphereLight = new HemisphereLight(0x606060, 0x404040, 0.6);
    this.scene.add(hemisphereLight);
    
    // Directional light (sun)
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    this.scene.add(directionalLight);
    
    // Add some point lights for atmosphere
    const pointLight1 = new PointLight(0x3366ff, 1, 10);
    pointLight1.position.set(5, 2, 5);
    this.scene.add(pointLight1);
    
    const pointLight2 = new PointLight(0xff3333, 1, 10);
    pointLight2.position.set(-5, 2, -5);
    this.scene.add(pointLight2);
  }
  
  private createEnvironment(): void {
    // Create floor
    const floorGeometry = new PlaneGeometry(100, 100);
    const floorMaterial = new MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    
    // Create some obstacles
    this.createObstacle(3, 0, 3, 1, 1, 1, 0x555555);
    this.createObstacle(-3, 0, -3, 1, 2, 1, 0x555555);
    this.createObstacle(0, 0, -5, 2, 0.5, 2, 0x555555);
  }
  
  private createObstacle(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: number
  ): void {
    const geometry = new BoxGeometry(width, height, depth);
    const material = new MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.3,
    });
    const obstacle = new Mesh(geometry, material);
    obstacle.position.set(x, y + height / 2, z);
    obstacle.castShadow = true;
    obstacle.receiveShadow = true;
    this.scene.add(obstacle);
  }
  
  private createEnemies(): void {
    // Create an enemy
    const enemy = new Enemy(this.scene);
    
    // Set the enemy's position
    enemy.position.set(
      (Math.random() - 0.5) * 8,
      0,
      (Math.random() - 0.5) * 8
    );
    
    this.scene.add(enemy);
    this.enemies.push(enemy);
    
    // Add enemy to combat system
    this.combatSystem.addEnemy(enemy);
  }
  
  private setupEventListeners(): void {
    // Lock controls on click
    this.renderer.domElement.addEventListener('click', () => {
      if (!this.controls.isLocked) {
        this.controls.lock();
      }
    });
    
    // Handle control lock change
    this.controls.addEventListener('lock', () => {
      console.log('Controls locked');
    });
    
    this.controls.addEventListener('unlock', () => {
      console.log('Controls unlocked');
    });
  }
  
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    
    const delta = this.clock.getDelta();
    
    // Update player
    this.player.update(delta);
    
    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(
        delta,
        this.player.getPosition(),
        this.player.getDirection()
      );
    }
    
    // Update combat system
    this.combatSystem.update();
    
    // Update particle systems
    this.particleSystem.update(delta);
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  unlockControls(): void {
    if (this.controls.isLocked) {
      this.controls.unlock();
    }
  }
  
  lockControls(): void {
    if (!this.controls.isLocked) {
      this.controls.lock();
    }
  }
  
  startBackgroundMusic(): void {
    this.backgroundMusic = gameAudio.playSound('backgroundMusic', {
      loop: true,
      volume: 0.3
    });
  }
  
  stopBackgroundMusic(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.stop();
      this.backgroundMusic = null;
    }
  }
  
  cleanup(): void {
    // Stop animation loop
    cancelAnimationFrame(this.animate as any);
    
    // Stop audio
    this.stopBackgroundMusic();
    gameAudio.stopAll();
    
    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
    // Remove renderer
    this.container.removeChild(this.renderer.domElement);
    
    // Dispose of resources
    this.renderer.dispose();
  }
  
  getPlayer(): Player {
    return this.player;
  }
  
  getCombatSystem(): CombatSystem {
    return this.combatSystem;
  }
}
