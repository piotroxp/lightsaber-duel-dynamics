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
  AxesHelper,
  GridHelper,
} from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Player } from './player';
import { Enemy } from './enemy';
import { CombatSystem } from './combat';
import { ParticleSystem } from './effects';
import gameAudio from './audio';
import { loadTextureWithFallback } from './textureLoader';

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
    
    // Create scene first
    this.scene = new Scene();
    
    // Create renderer second
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0x222222);
    this.container.appendChild(this.renderer.domElement);
    
    // Create camera third (now renderer exists)
    this.setupCamera();
    
    // Create other components
    this.player = new Player(this.camera, this.scene);
    this.combatSystem = new CombatSystem(this.scene, this.player);
    this.particleSystem = new ParticleSystem(this.scene);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Set a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        console.warn('Scene initialization timed out - continuing anyway');
        this.isInitialized = true;
        if (this.onLoadComplete) this.onLoadComplete();
        resolve();
      }, 10000); // 10 second timeout
      
      console.log("Starting initialization");
      
      try {
        // Load assets
        this.onLoadProgress(0.2);
        try {
          console.log("Loading assets...");
          this.loadAssets();
          console.log("Assets loaded successfully");
        } catch (error) {
          console.error("Error loading assets:", error);
        }
        
        // Setup lighting
        this.onLoadProgress(0.6);
        console.log("Setting up lighting...");
        this.setupLighting();
        
        // Create environment
        this.onLoadProgress(0.7);
        console.log("Creating environment...");
        this.createEnvironment();
        
        // Add debug elements
        this.addDebugElements();
        
        // Create enemies
        this.onLoadProgress(0.8);
        console.log("Creating enemies...");
        this.createEnemies();
        
        // Start animation loop
        this.onLoadProgress(0.9);
        console.log("Starting animation loop...");
        this.animate();
        
        clearTimeout(timeout);
        this.isInitialized = true;
        if (this.onLoadComplete) this.onLoadComplete();
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        console.error('Failed to initialize scene:', error);
        // Still resolve to prevent game from getting stuck
        this.isInitialized = true;
        if (this.onLoadComplete) this.onLoadComplete();
        resolve();
      }
    });
  }
  
  private async loadAssets(): Promise<boolean> {
    try {
      // Initialize audio with better progress tracking
      await gameAudio.initialize((progress) => {
        console.log("Audio loading progress:", progress);
        this.onLoadProgress(progress * 0.8); // Audio is 80% of loading
      });
      
      // Load textures
      const groundTexture = await loadTextureWithFallback('/textures/ground.jpg');
      
      // Setup lighting
      this.onLoadProgress(0.6);
      console.log("Setting up lighting...");
      this.setupLighting();
      
      // Create environment
      this.onLoadProgress(0.7);
      console.log("Creating environment...");
      this.createEnvironment();
      
      // Add debug elements
      this.addDebugElements();
      
      // Create enemies
      this.onLoadProgress(0.8);
      console.log("Creating enemies...");
      this.createEnemies();
      
      // Start animation loop
      this.onLoadProgress(0.9);
      console.log("Starting animation loop...");
      this.animate();
      
      this.isInitialized = true;
      
      // Report completion
      this.onLoadProgress(1.0);
      console.log("Initialization complete");
      this.onLoadComplete();
      
      return true;
    } catch (error) {
      console.error("Error loading assets:", error);
      // Complete loading even if there's an error
      this.onLoadProgress(1.0);
      return false;
    }
  }
  
  private setupCamera(): void {
    // Create and position the camera
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Position the camera higher and further back to see the scene clearly
    this.camera.position.set(0, 5, 8); // Higher and further back
    this.camera.lookAt(0, 0, 0); // Look at the center
    
    // Create controls
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    
    // Add camera to scene for reference
    this.scene.add(this.camera);
    
    console.log("Camera positioned at:", this.camera.position);
  }
  
  private setupLighting(): void {
    // Create very bright ambient light so everything is visible
    const ambientLight = new AmbientLight(0xffffff, 1.0); // Increase intensity
    this.scene.add(ambientLight);
    
    // Add hemisphere light for better ambient lighting
    const hemisphereLight = new HemisphereLight(0xffffff, 0x444444, 1.0);
    this.scene.add(hemisphereLight);
    
    // Create directional light (like the sun)
    const directionalLight = new DirectionalLight(0xffffff, 2.0); // Double intensity
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    this.scene.add(directionalLight);
    
    // Add point lights around the scene for extra visibility
    const pointLight1 = new PointLight(0xffffff, 2.0, 20);
    pointLight1.position.set(0, 5, 0);
    this.scene.add(pointLight1);
    
    console.log("Enhanced lighting setup complete");
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
    const animateLoop = () => {
      requestAnimationFrame(animateLoop);
      
      const deltaTime = this.clock.getDelta();
      
      // Update player and enemies
      if (this.player) {
        this.player.update(deltaTime);
      }
      
      for (const enemy of this.enemies) {
        enemy.update(deltaTime, this.player);
      }
      
      // Update combat system
      this.combatSystem.update();
      
      // Update particle systems
      this.particleSystem.update(deltaTime);
      
      // Render the scene
      this.renderer.render(this.scene, this.camera);
      
      // Log occasional frame to verify rendering is happening
      if (Math.random() < 0.01) {
        console.log("Frame rendered, camera at:", this.camera.position);
      }
    };
    
    animateLoop();
    console.log("Animation loop started");
  }
  
  unlockControls(): void {
    if (this.controls.isLocked) {
      this.controls.unlock();
    }
  }
  
  lockControls(): void {
    if (this.controls && !this.controls.isLocked) {
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
  
  private addDebugElements(enhanced = false): void {
    // Remove existing debug elements if any
    this.scene.children = this.scene.children.filter(child => 
      !child.name?.includes('debug'));
    
    // Add a bright colored box to the scene center
    const debugBox = new Mesh(
      new BoxGeometry(enhanced ? 2 : 1, enhanced ? 2 : 1, enhanced ? 2 : 1),
      new MeshBasicMaterial({ color: 0xff00ff }) // Bright pink
    );
    debugBox.position.set(0, enhanced ? 3 : 1, 0);
    debugBox.name = 'debug-box';
    this.scene.add(debugBox);
    
    // Add a ground plane that's clearly visible
    const debugGround = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshBasicMaterial({ 
        color: 0x00ff00, 
        wireframe: false, // Solid is more visible
        opacity: 0.5,
        transparent: true
      })
    );
    debugGround.rotation.x = -Math.PI / 2;
    debugGround.position.y = 0;
    debugGround.name = 'debug-ground';
    this.scene.add(debugGround);
    
    console.log("Enhanced debug elements added to scene");
  }
  
  public enableDebugView(): void {
    // Reset camera position to see everything
    this.camera.position.set(0, 10, 10);
    this.camera.lookAt(0, 0, 0);
    
    // Add axis helpers to show X, Y, Z directions
    const axisHelper = new AxesHelper(5);
    this.scene.add(axisHelper);
    
    // Add a grid helper
    const gridHelper = new GridHelper(20, 20);
    this.scene.add(gridHelper);
    
    // Make debug elements larger and more visible
    this.addDebugElements(true);
    
    console.log("Debug view enabled");
  }
}
