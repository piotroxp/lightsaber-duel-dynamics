
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
  PointLight,
  Color,
  Raycaster,
  Group,
  BoxGeometry,
  MeshBasicMaterial,
  FogExp2,
  AxesHelper,
  GridHelper,
  SphereGeometry,
} from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Player } from './player';
import { Enemy } from './enemy';
import { CombatSystem } from './combat';
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
    this.scene.background = new Color(0x111111); // Dark background for better visibility
    
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
    this.renderer.setClearColor(0x111111);
    this.container.appendChild(this.renderer.domElement);
    
    // Create camera third (now renderer exists)
    this.setupCamera();
    
    // Create player (needs camera reference)
    this.player = new Player(this.camera, this.scene);
    
    // Create combat system (needs player and scene references)
    this.combatSystem = new CombatSystem(this.scene, this.player);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    console.log("GameScene constructor completed");
  }
  
  async initialize(): Promise<void> {
    console.log("Starting game scene initialization");
    
    if (this.isInitialized) {
      console.log("Scene already initialized");
      this.onLoadComplete();
      return;
    }
    
    try {
      // Report starting progress
      this.onLoadProgress(0.1);
      
      // Setup lighting
      console.log("Setting up lighting...");
      this.setupLighting();
      this.onLoadProgress(0.4);
      
      // Create environment
      console.log("Creating environment...");
      this.createEnvironment();
      this.onLoadProgress(0.6);
      
      // Add debug elements
      console.log("Adding debug elements...");
      this.addDebugElements(true);
      this.onLoadProgress(0.8);
      
      // Create enemies
      console.log("Creating enemies...");
      this.createEnemies();
      this.onLoadProgress(0.9);
      
      // Start animation loop
      console.log("Starting animation loop...");
      this.animate();
      
      // Mark as initialized
      this.isInitialized = true;
      this.onLoadProgress(1.0);
      
      // Report completion after a short delay
      setTimeout(() => {
        console.log("Initialization complete!");
        this.onLoadComplete();
      }, 500);
    } catch (error) {
      console.error("Error during initialization:", error);
      
      // Still mark as initialized to prevent getting stuck
      this.isInitialized = true;
      this.onLoadProgress(1.0);
      
      setTimeout(() => {
        this.onLoadComplete();
      }, 500);
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
    const ambientLight = new AmbientLight(0xffffff, 2.0); // Increase intensity
    this.scene.add(ambientLight);
    
    // Add hemisphere light for better ambient lighting
    const hemisphereLight = new HemisphereLight(0xffffff, 0x444444, 1.5);
    this.scene.add(hemisphereLight);
    
    // Create directional light (like the sun)
    const directionalLight = new DirectionalLight(0xffffff, 3.0); // Triple intensity
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    this.scene.add(directionalLight);
    
    // Add point lights around the scene for extra visibility
    const pointLight1 = new PointLight(0xffffff, 3.0, 20);
    pointLight1.position.set(0, 5, 0);
    this.scene.add(pointLight1);
    
    // Add colored point lights for atmosphere
    const blueLight = new PointLight(0x0088ff, 2.0, 10);
    blueLight.position.set(-5, 3, -5);
    this.scene.add(blueLight);
    
    const redLight = new PointLight(0xff3333, 2.0, 10);
    redLight.position.set(5, 3, -5);
    this.scene.add(redLight);
    
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
    
    // Create a more visible floor for debugging
    const debugFloor = new Mesh(
      new PlaneGeometry(20, 20),
      new MeshBasicMaterial({
        color: 0x222222,
        wireframe: true
      })
    );
    debugFloor.rotation.x = -Math.PI / 2;
    debugFloor.position.y = 0.01; // Slightly above the main floor
    debugFloor.name = 'debug-floor';
    this.scene.add(debugFloor);
    
    // Create some obstacles with bright colors
    this.createObstacle(3, 0, 3, 1, 1, 1, 0xff5555);
    this.createObstacle(-3, 0, -3, 1, 2, 1, 0x55ff55);
    this.createObstacle(0, 0, -5, 2, 0.5, 2, 0x5555ff);
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
    // Create a wireframe box first for better visibility
    const wireGeometry = new BoxGeometry(width, height, depth);
    const wireMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true
    });
    const wireObstacle = new Mesh(wireGeometry, wireMaterial);
    wireObstacle.position.set(x, y + height / 2, z);
    this.scene.add(wireObstacle);
    
    // Create the solid obstacle
    const geometry = new BoxGeometry(width, height, depth);
    const material = new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.2,
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
    try {
      // Create an enemy
      const enemy = new Enemy(this.scene);
      
      // Set the enemy's position
      enemy.position.set(0, 0, -5);
      
      this.scene.add(enemy);
      this.enemies.push(enemy);
      
      // Add enemy to combat system
      this.combatSystem.addEnemy(enemy);
      
      console.log("Enemy created at position:", enemy.position);
    } catch (error) {
      console.error("Error creating enemies:", error);
    }
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
      
      // Update player
      if (this.player) {
        this.player.update(deltaTime);
      }
      
      // Update enemies
      for (const enemy of this.enemies) {
        try {
          enemy.update(
            deltaTime,
            this.player.position,
            new Vector3(0, 0, 1) // Forward direction as fallback
          );
        } catch (error) {
          console.error("Error updating enemy:", error);
        }
      }
      
      // Update combat system
      try {
        this.combatSystem.update();
      } catch (error) {
        console.error("Error updating combat system:", error);
      }
      
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
    if (this.controls && this.controls.isLocked) {
      this.controls.unlock();
    }
  }
  
  lockControls(): void {
    if (this.controls && !this.controls.isLocked) {
      this.controls.lock();
    }
  }
  
  startBackgroundMusic(): void {
    try {
      this.backgroundMusic = gameAudio.playSound('backgroundMusic', {
        loop: true,
        volume: 0.3
      });
      console.log("Background music started");
    } catch (error) {
      console.error("Failed to start background music:", error);
    }
  }
  
  stopBackgroundMusic(): void {
    if (this.backgroundMusic) {
      try {
        this.backgroundMusic.stop();
        this.backgroundMusic = null;
        console.log("Background music stopped");
      } catch (error) {
        console.error("Failed to stop background music:", error);
      }
    }
  }
  
  cleanup(): void {
    console.log("Cleaning up game scene");
    
    // Stop audio
    this.stopBackgroundMusic();
    gameAudio.stopAll();
    
    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
    // Remove renderer
    if (this.container && this.renderer) {
      try {
        this.container.removeChild(this.renderer.domElement);
      } catch (error) {
        console.error("Error removing renderer:", error);
      }
    }
    
    // Dispose of resources
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    console.log("Game scene cleanup complete");
  }
  
  getPlayer(): Player {
    return this.player;
  }
  
  getCombatSystem(): CombatSystem {
    return this.combatSystem;
  }
  
  public enableDebugView(): void {
    console.log("Enabling debug view");
    
    // Remove any existing debug helpers
    this.scene.children = this.scene.children.filter(child => 
      !(child.name?.includes('debug-helper')));
    
    // Reset camera position to see everything
    this.camera.position.set(0, 10, 15);
    this.camera.lookAt(0, 0, 0);
    
    // Add bright colored boxes to make the scene visible
    const debugBox = new Mesh(
      new BoxGeometry(3, 3, 3),
      new MeshBasicMaterial({ 
        color: 0xff00ff,
        wireframe: true
      })
    );
    debugBox.position.set(0, 1.5, 0);
    debugBox.name = 'debug-helper-box';
    this.scene.add(debugBox);
    
    // Add a grid helper
    const gridHelper = new GridHelper(20, 20, 0xffffff, 0x888888);
    gridHelper.name = 'debug-helper-grid';
    this.scene.add(gridHelper);
    
    // Add axes helper to show orientation
    const axesHelper = new AxesHelper(5);
    axesHelper.name = 'debug-helper-axes';
    this.scene.add(axesHelper);
    
    // Add a bright sphere at origin to check rendering
    const originSphere = new Mesh(
      new SphereGeometry(0.5, 16, 16),
      new MeshBasicMaterial({ color: 0xffff00 })
    );
    originSphere.name = 'debug-helper-origin';
    originSphere.position.set(0, 1, 0);
    this.scene.add(originSphere);
    
    // Make lighting very bright
    const brightLight = new DirectionalLight(0xffffff, 3);
    brightLight.position.set(5, 10, 5);
    brightLight.name = 'debug-helper-light';
    this.scene.add(brightLight);
    
    console.log("Debug view enabled");
  }
  
  public disableDebugView(): void {
    console.log("Disabling debug view");
    
    // Remove debug helpers
    this.scene.children = this.scene.children.filter(child => 
      !(child.name?.includes('debug-helper')));
    
    console.log("Debug view disabled");
  }
}
