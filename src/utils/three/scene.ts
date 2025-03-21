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
import { NetworkManager, NetworkPlayer } from '@/utils/network/NetworkManager';
import { RemotePlayer } from './RemotePlayer';

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
  private networkManager: NetworkManager;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private isMultiplayer: boolean = false;
  private isNetworkInitialized: boolean = false;
  
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
    
    // Create other components
    this.player = new Player(this.camera, this.scene);
    this.combatSystem = new CombatSystem(this.scene, this.player);
    this.particleSystem = new ParticleSystem(this.scene);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    console.log("GameScene constructor completed");
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
        // Add a delay at the start to ensure DOM is ready
        setTimeout(() => {
          this.initializeWithProgress(resolve, timeout);
        }, 100);
      } catch (error) {
        console.error("Initialization failed:", error);
        clearTimeout(timeout);
        this.isInitialized = true;
        if (this.onLoadComplete) this.onLoadComplete();
        resolve(); // Resolve anyway to prevent stuck loading
      }
    });
  }
  
  private async initializeWithProgress(resolve: () => void, timeout: NodeJS.Timeout): Promise<void> {
    try {
      // Setup lighting
      console.log("Setting up lighting...");
      this.setupLighting();
      this.onLoadProgress(0.2);
      
      // Create environment
      console.log("Creating environment...");
      this.createEnvironment();
      this.onLoadProgress(0.4);
      
      // Add debug elements
      console.log("Adding debug elements...");
      this.addDebugElements(true);
      this.onLoadProgress(0.6);
      
      // Create enemies
      console.log("Creating enemies...");
      this.createEnemies();
      this.onLoadProgress(0.8);
      
      // Start animation loop
      console.log("Starting animation loop...");
      this.animate();
      this.onLoadProgress(0.9);
      
      // Allow a small delay before completing
      setTimeout(() => {
        clearTimeout(timeout);
        this.isInitialized = true;
        this.onLoadProgress(1.0);
        console.log("Initialization complete!");
        if (this.onLoadComplete) this.onLoadComplete();
        resolve();
      }, 500);
    } catch (error) {
      console.error("Error during initialization:", error);
      clearTimeout(timeout);
      this.isInitialized = true;
      if (this.onLoadComplete) this.onLoadComplete();
      resolve(); // Resolve anyway to prevent stuck loading
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
      const position = new Vector3(
        (Math.random() - 0.5) * 8,
        0,
        (Math.random() - 0.5) * 8
      );
      
      enemy.position.copy(position);
      
      this.scene.add(enemy);
      this.enemies.push(enemy);
      
      // Add enemy to combat system
      this.combatSystem.addEnemy(enemy);
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
      
      // Add network update for multiplayer
      if (this.isMultiplayer && this.isNetworkInitialized && this.player) {
        // Send player updates to network (limit frequency to reduce bandwidth)
        if (this.clock.elapsedTime % 0.05 < 0.01) {
          this.networkManager.sendPlayerUpdate(
            this.player.position,
            this.player.quaternion,
            this.player.getLightsaberPosition(),
            this.player.getLightsaberRotation(),
            this.player.isAttacking(),
            this.player.isBlocking()
          );
        }
        
        // Update remote players
        this.remotePlayers.forEach(remotePlayer => {
          remotePlayer.update(deltaTime);
        });
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
      new MeshBasicMaterial({ 
        color: 0xff00ff,
        wireframe: true
      })
    );
    debugBox.position.set(0, enhanced ? 3 : 1, 0);
    debugBox.name = 'debug-box';
    this.scene.add(debugBox);
    
    // Add a solid box inside
    const innerBox = new Mesh(
      new BoxGeometry(enhanced ? 1.8 : 0.9, enhanced ? 1.8 : 0.9, enhanced ? 1.8 : 0.9),
      new MeshBasicMaterial({ color: 0xff00ff })
    );
    innerBox.position.set(0, enhanced ? 3 : 1, 0);
    innerBox.name = 'debug-box-inner';
    this.scene.add(innerBox);
    
    console.log("Enhanced debug elements added to scene");
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
  
  public initializeMultiplayer(isHost: boolean = true): void {
    this.isMultiplayer = true;
    this.networkManager = NetworkManager.getInstance();
    
    // Check if joining from URL
    const isJoiningFromUrl = this.networkManager.checkAndJoinFromUrl();
    
    if (isHost && !isJoiningFromUrl) {
      // Create a new room as host
      this.networkManager.createRoom();
      console.log("Creating a new multiplayer room as host");
    }
    
    // Set up network event listeners
    this.setupNetworkEvents();
    this.isNetworkInitialized = true;
  }
  
  private setupNetworkEvents(): void {
    const networkManager = this.networkManager;
    
    // Room created event
    networkManager.onRoomCreated((data) => {
      console.log(`Room created with ID: ${data.roomId}`);
      console.log(`Share this link to play together: ${data.joinUrl}`);
      
      // Display join link in UI
      this.displayJoinLink(data.joinUrl);
    });
    
    // Player joined event
    networkManager.onPlayerJoined((data) => {
      console.log(`Player joined: ${data.playerId}`);
      
      // Create character for new player
      this.createRemotePlayer(data.playerId);
      
      // If we're the host and there are at least 2 players, enable start button
      if (networkManager.isGameHost() && data.players.length >= 2) {
        this.enableStartButton();
      }
    });
    
    // Game started event
    networkManager.onGameStarted(() => {
      console.log("Game started!");
      this.hideMultiplayerUI();
      this.startMultiplayerGame();
    });
    
    // Player updated event
    networkManager.onPlayerUpdated((data) => {
      const remotePlayer = this.remotePlayers.get(data.playerId);
      if (remotePlayer) {
        remotePlayer.updateFromNetwork(
          data.position,
          data.rotation,
          data.lightsaberPosition,
          data.lightsaberRotation,
          data.isAttacking,
          data.isBlocking
        );
      }
    });
    
    // Player damaged event
    networkManager.onPlayerDamaged((data) => {
      if (data.playerId === networkManager.getPlayerId()) {
        // Local player was hit
        this.player.takeDamage(data.health);
        this.onPlayerDamage(data.health);
      } else {
        // Remote player was hit
        const remotePlayer = this.remotePlayers.get(data.playerId);
        if (remotePlayer) {
          remotePlayer.setHealth(data.health);
        }
      }
    });
    
    // Player defeated event
    networkManager.onPlayerDefeated((playerId, winnerId) => {
      if (playerId === networkManager.getPlayerId()) {
        // Local player was defeated
        this.onPlayerDefeated();
      } else {
        // Remote player was defeated
        this.onRemotePlayerDefeated(playerId);
        if (winnerId === networkManager.getPlayerId()) {
          this.onVictory();
        }
      }
    });
    
    // Host disconnected event
    networkManager.onHostDisconnected(() => {
      console.log("Host disconnected!");
      this.onHostDisconnected();
    });
    
    // Error event
    networkManager.onError((message) => {
      console.error(`Network error: ${message}`);
      this.onNetworkError(message);
    });
  }
  
  // Add methods for creating and updating remote players
  private createRemotePlayer(playerId: string): void {
    const remotePlayer = new RemotePlayer(this.scene, playerId);
    this.remotePlayers.set(playerId, remotePlayer);
    this.scene.add(remotePlayer);
  }
  
  // UI methods for multiplayer
  private displayJoinLink(url: string): void {
    // Implementation depends on your UI framework
    // This could dispatch an event or update a React state
    window.dispatchEvent(new CustomEvent('showJoinLink', { detail: { url } }));
  }
  
  private enableStartButton(): void {
    window.dispatchEvent(new CustomEvent('enableStartButton'));
  }
  
  private hideMultiplayerUI(): void {
    window.dispatchEvent(new CustomEvent('hideMultiplayerUI'));
  }
  
  public startMultiplayerGame(): void {
    if (this.isMultiplayer && this.networkManager.isGameHost()) {
      this.networkManager.startGame();
    }
  }
  
  private onPlayerDamage(health: number): void {
    // Update UI with new health value
    window.dispatchEvent(new CustomEvent('playerDamage', { detail: { health } }));
  }
  
  private onPlayerDefeated(): void {
    // Show defeat screen
    window.dispatchEvent(new CustomEvent('playerDefeated'));
  }
  
  private onRemotePlayerDefeated(playerId: string): void {
    // Remove defeated player from scene
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      this.scene.remove(remotePlayer);
      this.remotePlayers.delete(playerId);
    }
  }
  
  private onVictory(): void {
    // Show victory screen
    window.dispatchEvent(new CustomEvent('playerVictory'));
  }
  
  private onHostDisconnected(): void {
    // Show host disconnected message
    window.dispatchEvent(new CustomEvent('hostDisconnected'));
  }
  
  private onNetworkError(message: string): void {
    // Show error message
    window.dispatchEvent(new CustomEvent('networkError', { detail: { message } }));
  }
}
