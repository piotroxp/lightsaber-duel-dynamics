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
import { createClashEffect } from './effects';

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
  private debugMode: boolean = true; // Default to true
  private frameCount: number = 0;
  
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
    this.player = new Player(this.scene, this.camera);
    this.scene.add(this.player);
    
    // Pass debug mode to player
    this.player.setDebugMode(this.debugMode);
    
    // Position player slightly above ground
    this.player.position.set(0, 0.1, 0); // Start slightly above ground plane y=0
    
    // Create combat system (needs player and scene references)
    this.combatSystem = new CombatSystem(this.scene, this.player);
    console.log('Checking combatSystem:', this.combatSystem, typeof this.combatSystem.setDebugMode);
    this.combatSystem.setDebugMode(this.debugMode);
    this.combatSystem.setCamera(this.camera); // Pass camera for potential use
    
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
      
      // Trigger complete callback
      if (this.onLoadComplete) {
        this.onLoadComplete();
      }

      // --- TEMPORARY DEBUG: Start animation immediately after init ---
      console.log("!!! DEBUG: Forcing start() after initialize !!!");
      this.start(); 
      // --- END TEMPORARY DEBUG ---

    } catch (error) {
      console.error("Error initializing game:", error);
      throw error;
    }
  }
  
  private setupCamera(): void {
    // Create a perspective camera with good defaults for first-person view
    this.camera = new PerspectiveCamera(
      75, // Field of view
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    
    // Set initial relative position (will be overridden when added to player)
    this.camera.position.set(0, 0, 0); 
    console.log("Camera created");
    
    // Initialize pointer lock controls
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    
    // Event listeners for lock/unlock are handled in setupEventListeners
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

    // Player events
    (this.player as any).addEventListener('healthChanged', (e: any) => {
      const event = new CustomEvent('playerHealthChanged', {
        detail: { health: e.health, maxHealth: e.maxHealth }
      });
      window.dispatchEvent(event);
    });

    // Enemy events
    window.addEventListener('enemyHealthChanged', (e: any) => {
      this.updateEnemyHealthBar(e.detail.health, e.detail.maxHealth);
    });

    window.addEventListener('enemyRespawned', (e: any) => {
      e.detail.enemy.resetPosition();
    });
  }
  
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  public animate(): void {
    // Log every time animate is entered, before the isAnimating check
    console.log(`--- animate() entered | isAnimating: ${this.isAnimating} | frame: ${this.frameCount} ---`); 
    if (!this.isAnimating) return; 
    requestAnimationFrame(this.animate.bind(this)); 

    const deltaTime = this.clock.getDelta();

    // Log periodically to confirm loop is running
    if (this.frameCount === undefined) this.frameCount = 0; 
    if (this.frameCount % 120 === 0 && this.debugMode) { 
       console.log(`Animate loop running... Frame: ${this.frameCount}, Delta: ${deltaTime.toFixed(4)}`);
    }
    this.frameCount++;

    try {
      // Update game objects
      if (this.player) {
        try {
          this.player.update(deltaTime);
        } catch (playerUpdateError) {
          console.error("Error during player.update:", playerUpdateError);
          this.isAnimating = false; // Stop on error
          return;
        }
      }
      
      this.enemies.forEach(enemy => {
        if (enemy && this.player) {
          try {
            enemy.update(deltaTime, this.player.position, this.player.getWorldDirection(new Vector3()));
          } catch (enemyUpdateError) {
            console.error(`Error during enemy.update (ID: ${enemy.id}):`, enemyUpdateError);
            this.isAnimating = false; // Stop on error
            // Note: returning here only exits the forEach callback, not animate()
            // We set isAnimating = false, so the next frame check will stop it.
          }
        }
      });
      // Check isAnimating again in case enemy update stopped it
      if (!this.isAnimating) return; 

      if (this.combatSystem) {
        try {
          this.combatSystem.update(deltaTime);
        } catch (combatUpdateError) {
          console.error("Error during combatSystem.update:", combatUpdateError);
          this.isAnimating = false; // Stop on error
          return;
        }
      }

      // Add an enhanced collision detection system
      this.checkLightsaberCollisions(deltaTime);
    } catch (updatePhaseError) {
      // Catch any unexpected errors during the update phase logic itself
      console.error("Error during main update phase:", updatePhaseError);
      this.isAnimating = false;
      return;
    }

    // Render the scene
    try {
      this.renderer.render(this.scene, this.camera);
      // Log successful render periodically
      if (this.frameCount % 120 === 1 && this.debugMode) {
         console.log("Scene rendered successfully.");
      }
    } catch (renderError) {
      console.error("Error during render:", renderError);
      this.isAnimating = false; // Stop animation on error
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
    console.log("- camera position:", this.camera ? this.camera.getWorldPosition(new Vector3()) : 'N/A');
    console.log("- scene children:", this.scene ? this.scene.children.length : 'N/A');
    console.log("- renderer:", this.renderer);
    if (this.renderer) {
      console.log("- canvas element:", this.renderer.domElement);
      console.log("- canvas size:", this.renderer.domElement.width, "x", this.renderer.domElement.height);
      console.log("- canvas style size:", this.renderer.domElement.style.width, "x", this.renderer.domElement.style.height);
      console.log("- canvas in DOM:", document.body.contains(this.renderer.domElement));
    } else {
      console.log("- renderer not available for canvas check");
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
    this.createModernHealthDisplay();
    
    this.addDebugElements(true);

    // Add basic lighting
    const ambientLight = new AmbientLight(0xffffff, 0.5); // Soft white light
    this.scene.add(ambientLight);

    const directionalLight = new DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true; // Enable shadows
    // Configure shadow properties (optional but good)
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    this.scene.add(directionalLight);
    console.log("Basic lighting added to scene");

    // Add ground plane (optional but helpful for orientation)
    const groundGeo = new PlaneGeometry(100, 100);
  }
  
  private createModernHealthDisplay(): void {
    // Remove any existing health displays
    const existingHealthElements = document.querySelectorAll('[id$="-health-container"], [id$="-health-modern"]');
    existingHealthElements.forEach(element => element.remove());
    
    // Hide the React-based health display in Game.tsx
    const style = document.createElement('style');
    style.textContent = `
      .player-health, .enemy-health, .vs-text {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    
    // Create health display container
    const healthContainer = document.createElement('div');
    healthContainer.style.position = 'absolute';
    healthContainer.style.top = '20px';
    healthContainer.style.left = '50%';
    healthContainer.style.transform = 'translateX(-50%)';
    healthContainer.style.display = 'flex';
    healthContainer.style.gap = '20px';
    
    // Player health
    const playerHealth = document.createElement('div');
    playerHealth.id = 'player-health-modern';
    playerHealth.innerHTML = `
      <div style="color: white; margin-bottom: 5px; text-align: center; font-weight: bold; text-shadow: 0 0 3px #3366ff">PLAYER</div>
      <div style="width: 200px; height: 20px; background: #222">
        <div id="player-health-bar" style="width: 100%; height: 100%; background: #3366ff; transition: width 0.3s; border-radius:15px;"></div>
      </div>
    `;
    
    // Enemy health
    const enemyHealth = document.createElement('div');
    enemyHealth.id = 'enemy-health-modern';
    enemyHealth.innerHTML = `
      <div style="color: white; margin-bottom: 5px; text-align: center; font-weight: bold; text-shadow: 0 0 3px #ff3333">ENEMY</div>
      <div style="width: 200px; height: 20px; background: #222">
        <div id="enemy-health-bar" style="width: 100%; height: 100%; background: #ff0000; transition: width 0.3s; border-radius:15px;"></div>
      </div>
    `;
    
    healthContainer.appendChild(playerHealth);
    healthContainer.appendChild(enemyHealth);
    this.container.appendChild(healthContainer);
    
    // Add lightsaber color picker
    this.createLightsaberColorPicker();
    
    // Immediately dispatch initial health events to set the bars
    window.dispatchEvent(new CustomEvent('playerHealthChanged', {
      detail: {
        health: this.player.getHealth(),
        maxHealth: this.player.getMaxHealth()
      }
    }));
    
    if (this.enemies.length > 0) {
      window.dispatchEvent(new CustomEvent('enemyHealthChanged', {
        detail: {
          health: this.enemies[0].getHealth(),
          maxHealth: this.enemies[0].getMaxHealth()
        }
      }));
    }
    
    // Event listeners for health updates
    window.addEventListener('playerHealthChanged', (e: CustomEvent) => {
      const bar = document.getElementById('player-health-bar');
      if (bar) {
        const percent = (e.detail.health / e.detail.maxHealth) * 100;
        bar.style.width = `${percent}%`;
      }
    });

    window.addEventListener('enemyHealthChanged', (e: CustomEvent) => {
      const bar = document.getElementById('enemy-health-bar');
      if (bar) {
        const percent = (e.detail.health / e.detail.maxHealth) * 100;
        bar.style.width = `${percent}%`;
      }
    });
  }
  
  private createLightsaberColorPicker(): void {
    // Create color picker container
    const colorPickerContainer = document.createElement('div');
    colorPickerContainer.style.position = 'absolute';
    colorPickerContainer.style.bottom = '20px';
    colorPickerContainer.style.left = '50%';
    colorPickerContainer.style.transform = 'translateX(-50%)';
    colorPickerContainer.style.display = 'flex';
    colorPickerContainer.style.flexDirection = 'column';
    colorPickerContainer.style.alignItems = 'center';
    colorPickerContainer.style.gap = '10px';
    colorPickerContainer.style.background = 'rgba(0, 0, 0, 0.5)';
    colorPickerContainer.style.padding = '10px';
    colorPickerContainer.style.borderRadius = '8px';
    
    // Add title
    const title = document.createElement('div');
    title.textContent = 'LIGHTSABER COLOR';
    title.style.color = 'white';
    title.style.fontWeight = 'bold';
    title.style.textShadow = '0 0 3px #fff';
    colorPickerContainer.appendChild(title);
    
    // Create color options
    const colors = [
      { name: 'Blue', value: '#3366ff' },
      { name: 'Green', value: '#33ff66' },
      { name: 'Red', value: '#ff3333' },
      { name: 'Purple', value: '#9933ff' },
      { name: 'Yellow', value: '#ffcc33' },
      { name: 'White', value: '#ffffff' }
    ];
    
    // Create color buttons container
    const colorButtons = document.createElement('div');
    colorButtons.style.display = 'flex';
    colorButtons.style.gap = '8px';
    
    colors.forEach(color => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.background = color.value;
      button.style.border = '2px solid white';
      button.style.borderRadius = '50%';
      button.style.cursor = 'pointer';
      button.style.boxShadow = `0 0 10px ${color.value}`;
      button.title = color.name;
      
      button.addEventListener('click', () => {
        // Update lightsaber color
        if (this.player && this.player.getLightsaber()) {
          this.player.getLightsaber().setColor(color.value);
        }
        
        // Update active button style
        document.querySelectorAll('#lightsaber-color-picker button').forEach(btn => {
          (btn as HTMLElement).style.transform = 'scale(1)';
          (btn as HTMLElement).style.boxShadow = `0 0 10px ${(btn as HTMLElement).style.background}`;
        });
        
        button.style.transform = 'scale(1.2)';
        button.style.boxShadow = `0 0 15px ${color.value}`;
      });
      
      colorButtons.appendChild(button);
    });
    
    colorPickerContainer.appendChild(colorButtons);
    colorPickerContainer.id = 'lightsaber-color-picker';
    this.container.appendChild(colorPickerContainer);
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
    
    // Restore first-person view by making camera a child of player
    // Set camera position *before* adding it to the player
    this.camera.position.set(0, 1.7, 0); // Eye level relative to player base (0,0,0)
    this.player.add(this.camera);
    console.log("Camera added as child of player in setupPlayer");
    
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
    console.log("Camera world position after adding to player:", this.camera.getWorldPosition(new Vector3()));
  }

  // Add a method to update enemy health UI
  private updateEnemyHealthBar(health: number, maxHealth: number): void {
    // Find or create enemy health bar element
    let healthBar = document.getElementById('enemy-health-bar');
    if (!healthBar) {
      healthBar = document.createElement('div');
      healthBar.id = 'enemy-health-bar';
      healthBar.style.position = 'absolute';
      healthBar.style.top = '70px';
      healthBar.style.left = '50%';
      healthBar.style.transform = 'translateX(-50%)';
      healthBar.style.width = '200px';
      healthBar.style.height = '10px';
      healthBar.style.background = '#333';
      healthBar.style.border = '1px solid #666';
      
      const fill = document.createElement('div');
      fill.id = 'enemy-health-fill';
      fill.style.height = '100%';
      fill.style.width = '100%';
      fill.style.backgroundColor = '#ff3333';
      fill.style.transition = 'width 0.3s';
      
      healthBar.appendChild(fill);
      this.container.appendChild(healthBar);
    }
    
    // Update health bar fill width
    const fillElement = document.getElementById('enemy-health-fill');
    if (fillElement) {
      const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
      fillElement.style.width = `${healthPercent}%`;
      
      // Change color based on health level
      if (healthPercent > 60) {
        fillElement.style.backgroundColor = '#ff3333'; // Full red for enemy
      } else if (healthPercent > 30) {
        fillElement.style.backgroundColor = '#ff6633'; // Orange-red
      } else {
        fillElement.style.backgroundColor = '#ff9933'; // Yellow-orange
      }
    }
  }

  // Method to update debug mode
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    // Propagate to relevant objects
    if (this.player) this.player.setDebugMode(enabled);
    if (this.combatSystem) this.combatSystem.setDebugMode(enabled);
    this.enemies.forEach(enemy => enemy.setDebugMode(enabled));
    // Optionally toggle helpers
    const axesHelper = this.scene.getObjectByName('axesHelper');
    if (axesHelper) axesHelper.visible = enabled;
    const gridHelper = this.scene.getObjectByName('gridHelper');
    if (gridHelper) gridHelper.visible = enabled;
  }

  // Method to start the game loop and music
  start(): void {
    if (!this.isInitialized) {
      console.error("Cannot start game: Scene not initialized.");
      return;
    }
    if (this.isAnimating) {
      console.log("Animation already running.");
      return; // Don't start if already running
    }
    
    console.log("Starting game elements...");
    this.isAnimating = true;
    this.clock.start(); // Ensure the clock is running before the first frame
    this.animate(); // <<< START the animation loop here
  }

  // Add a getter to expose the player directly
  get player(): Player {
    return this._player;
  }

  // Add an enhanced collision detection system
  private checkLightsaberCollisions(deltaTime: number): void {
    if (!this.player || !this.enemy) return;
    
    // Only check collisions when both are attacking or one is attacking and one is blocking
    const playerIsAttacking = this.player.getState() === PlayerState.ATTACKING;
    const enemyIsAttacking = this.enemy.getState() === PlayerState.ATTACKING;
    const playerIsBlocking = this.player.getState() === PlayerState.BLOCKING;
    const enemyIsBlocking = this.enemy.getState() === PlayerState.BLOCKING;
    
    // If neither is attacking, no collision possible
    if (!playerIsAttacking && !enemyIsAttacking) return;
    
    // Both in cooldown, skip detection
    if (this.player.isInClashCooldown && this.enemy.isInClashCooldown) return;
    
    // Get blade positions
    const playerBladeStart = this.player.getLightsaberHiltPosition();
    const playerBladeEnd = this.player.getLightsaberTipPosition();
    const enemyBladeStart = this.enemy.getLightsaberHiltPosition();
    const enemyBladeEnd = this.enemy.getLightsaberTipPosition();
    
    // Calculate closest points between the two blade line segments
    const result = this.closestPointsBetweenLineSegments(
      playerBladeStart, playerBladeEnd,
      enemyBladeStart, enemyBladeEnd
    );
    
    // If blades are close enough, trigger clash
    const distance = result.distance;
    if (distance < 0.2) { // Collision threshold
      // Calculate collision position (midpoint between closest points)
      const collisionPoint = result.pointOnLine1.clone().add(result.pointOnLine2).multiplyScalar(0.5);
      
      // Get directions from each character to collision for proper recoil
      const playerToCollision = collisionPoint.clone().sub(this.player.position).normalize();
      const enemyToCollision = collisionPoint.clone().sub(this.enemy.position).normalize();
      
      // Create clash effect at collision point
      createClashEffect(this.scene, collisionPoint, 1.0);
      
      // Trigger clash handling on both characters
      this.player.handleBladeClash(collisionPoint, enemyToCollision);
      this.enemy.handleBladeClash(collisionPoint, playerToCollision);
      
      // Log the collision for debugging
      console.log("Lightsaber clash detected!", distance);
    }
  }

  // Helper function to find closest points between two line segments
  private closestPointsBetweenLineSegments(
    line1Start: Vector3, line1End: Vector3,
    line2Start: Vector3, line2End: Vector3
  ): { pointOnLine1: Vector3, pointOnLine2: Vector3, distance: number } {
    const u = line1End.clone().sub(line1Start);
    const v = line2End.clone().sub(line2Start);
    const w = line1Start.clone().sub(line2Start);
    
    const a = u.dot(u);
    const b = u.dot(v);
    const c = v.dot(v);
    const d = u.dot(w);
    const e = v.dot(w);
    
    const D = a * c - b * b;
    let sc, tc;
    
    if (D < 0.0001) {
      sc = 0;
      tc = (b > c ? d / b : e / c);
    } else {
      sc = (b * e - c * d) / D;
      tc = (a * e - b * d) / D;
    }
    
    // Clamp sc and tc to [0,1]
    sc = Math.max(0, Math.min(1, sc));
    tc = Math.max(0, Math.min(1, tc));
    
    // Calculate points
    const point1 = line1Start.clone().add(u.multiplyScalar(sc));
    const point2 = line2Start.clone().add(v.multiplyScalar(tc));
    
    return {
      pointOnLine1: point1,
      pointOnLine2: point2,
      distance: point1.distanceTo(point2)
    };
  }
}
