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
  private isAnimating: boolean = false;
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
    this.renderer.outputColorSpace = 'srgb';
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
    console.log("Starting game initialization");
    
    if (this.isInitialized) {
      console.log("Game already initialized");
      return;
    }

    try {
      // Setup scene and lighting
      this.setupScene();
      console.log("Scene setup complete");
      
      // Load game assets
      await this.loadAssets();
      console.log("Assets loaded");
      
      // Setup player
      this.setupPlayer();
      console.log("Player setup complete");
      
      // Add enemies once the player is ready
      this.createEnemies();
      console.log("Enemies setup complete");
      
      // Mark as initialized
      this.isInitialized = true;
      console.log("Game initialization complete");
      
      // Start animation loop
      this.animate();
      console.log("Animation loop started");
      
      // Trigger complete callback
      if (this.onLoadComplete) {
        this.onLoadComplete();
      }
    } catch (error) {
      console.error("Error initializing game:", error);
      throw error;
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
    console.log("Setting up enemies");
    
    // Clear any existing enemies
    this.enemies = [];
    
    // Create a single enemy for dueling
    const enemy = new Enemy(this.scene, {
      health: 100,
      speed: 2.5,          // Increased speed
      attackRange: 2.5,
      attackDamage: 10,
      lightsaberColor: '#ff0000'
    });
    
    // Position enemy opposite to player
    enemy.position.set(0, 0, -5);  // Fix Y position to ground level
    
    // Add to scene and enemy list
    this.scene.add(enemy);
    this.enemies.push(enemy);
    
    // CRITICAL: Add the enemy to the combat system
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
  
  public animate(): void {
    // Skip if not initialized
    if (!this.isInitialized) return;
    
    this.isAnimating = true;
    
    const deltaTime = this.clock.getDelta();
    
    // Update player
    this.player.update(deltaTime);
    
    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(deltaTime, this.player.getPosition(), this.player.getDirection());
    }
    
    // CRITICAL FIX: Make sure to call combat system update
    this.combatSystem.update(deltaTime);
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
    
    // Continue animation loop
    if (this.isAnimating) {
      requestAnimationFrame(this.animate.bind(this));
    }
  }
  
  unlockControls(): void {
    if (this.controls && this.controls.isLocked) {
      this.controls.unlock();
    }
  }
  
  lockControls(): void {
    try {
      console.log("Locking controls...");
      if (this.controls) {
        this.controls.lock();
      } else {
        console.warn("Controls not available");
      }
    } catch (error) {
      console.error("Failed to lock controls:", error);
    }
  }
  
  startBackgroundMusic(): void {
    try {
      console.log("Starting background music...");
      this.backgroundMusic = gameAudio.playSound('backgroundMusic', {
        loop: true,
        volume: 0.5
      });
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
    try {
      console.log("Cleaning up game scene...");
      // Stop animation loop
      if (this.isAnimating) {
        this.isAnimating = false;
      }
      
      // Clean up audio
      gameAudio.stopAll();
      
      // Dispose of all materials and geometries
      this.scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      
      // Clean up renderer
      this.renderer.dispose();
      
      // Remove renderer from DOM
      if (this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
      
      // Clean up event listeners
      window.removeEventListener('resize', this.onWindowResize.bind(this));
      
      console.log("Game scene cleanup complete");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
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
  
  private addDebugElements(enhanced: boolean = false): void {
    console.log("Adding debug elements, enhanced:", enhanced);
    
    // Add debug elements to the scene
    if (enhanced) {
      // Enhanced debugging - more visual aids
      this.enableDebugView();
    } else {
      // Basic debugging - just axes and grid
      const axesHelper = new AxesHelper(5);
      axesHelper.name = 'debug-helper-axes';
      this.scene.add(axesHelper);
      
      const gridHelper = new GridHelper(20, 20);
      gridHelper.name = 'debug-helper-grid';
      this.scene.add(gridHelper);
    }
  }
  
  public debug(): void {
    console.log("Debug info:");
    console.log("- isInitialized:", this.isInitialized);
    console.log("- isAnimating:", this.isAnimating);
    console.log("- container:", this.container);
    console.log("- camera position:", this.camera?.position);
    console.log("- scene children:", this.scene?.children.length);
    console.log("- renderer:", this.renderer);
    
    // Check if renderer canvas is in DOM
    if (this.renderer) {
      const canvas = this.renderer.domElement;
      console.log("- canvas in DOM:", document.body.contains(canvas));
    }
  }
  
  public stop(): void {
    console.log("Stopping game scene");
    this.isAnimating = false;
  }
  
  private setupScene(): void {
    console.log("Setting up game scene");

    // Setup lighting
    this.setupLighting();
    console.log("Lighting setup complete");

    // Create environment (floor and boundaries)
    this.createEnvironment();
    console.log("Environment created");

    // Create UI elements including health display
    this.createUIElements();
    
    this.addDebugElements(true);
  }
  
  private async loadAssets(): Promise<void> {
    console.log("Loading game assets");
    
    // Simulate asset loading with progress
    const loadSteps = 5;
    for (let i = 1; i <= loadSteps; i++) {
      // Update progress
      this.onLoadProgress(i / loadSteps);
      
      // Small delay to simulate loading
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Load audio assets
    try {
      await gameAudio.initialize((progress) => {
        // Adjust progress to be between 0.8 and 1.0
        const adjustedProgress = 0.8 + progress * 0.2;
        this.onLoadProgress(adjustedProgress);
      });
    } catch (error) {
      console.error("Error loading audio:", error);
    }
    
    return Promise.resolve();
  }
  
  private setupPlayer(): void {
    console.log("Setting up player");
    
    // Instead of calling initialize which doesn't exist, we'll do the setup directly
    // Comment out the problematic line
    // this.player.initialize();
    
    // Position player properly
    this.player.position.set(0, 1, 0);
    
    // Activate the lightsaber if needed
    try {
      if (this.player.getLightsaber() && typeof this.player.getLightsaber().activate === 'function') {
        this.player.getLightsaber().activate();
      }
    } catch (error) {
      console.warn("Failed to activate player lightsaber:", error);
    }
    
    // Additional player setup if needed
    console.log("Player positioned at:", this.player.position);
  }
  
  // Add method to create UI elements
  private createUIElements(): void {
    // Create player health bar
    const healthBarContainer = document.createElement('div');
    healthBarContainer.id = 'player-health-container';
    healthBarContainer.style.position = 'absolute';
    healthBarContainer.style.bottom = '20px';
    healthBarContainer.style.left = '20px';
    healthBarContainer.style.width = '200px';
    healthBarContainer.style.height = '20px';
    healthBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    healthBarContainer.style.border = '2px solid #ffffff';
    healthBarContainer.style.borderRadius = '4px';
    
    const healthBar = document.createElement('div');
    healthBar.id = 'player-health';
    healthBar.style.width = '100%';
    healthBar.style.height = '100%';
    healthBar.style.backgroundColor = '#00ff00';
    healthBar.style.transition = 'width 0.3s ease-out';
    
    healthBarContainer.appendChild(healthBar);
    this.container.appendChild(healthBarContainer);
    
    // Set up event listener to update health bar
    this.player.addEventListener('healthChanged', (event: any) => {
      const healthPercent = event.health / event.maxHealth;
      healthBar.style.width = `${healthPercent * 100}%`;
      
      // Change color based on health
      if (healthPercent > 0.6) {
        healthBar.style.backgroundColor = '#00ff00'; // Green
      } else if (healthPercent > 0.3) {
        healthBar.style.backgroundColor = '#ffff00'; // Yellow
      } else {
        healthBar.style.backgroundColor = '#ff0000'; // Red
      }
    });
  }
}
