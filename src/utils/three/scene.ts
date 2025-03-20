
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  PointLight,
  Mesh,
  MeshStandardMaterial,
  TextureLoader,
  PlaneGeometry,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  Fog,
  Color,
  PCFSoftShadowMap,
  RepeatWrapping,
  Vector3,
  Raycaster,
  AxesHelper,
  HemisphereLight,
  SpotLight,
  Group,
  FogExp2,
  Clock,
  AudioListener,
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
  private assets: Map<string, any> = new Map();
  private onLoadProgressCallback: (progress: number) => void;
  private onLoadCompleteCallback: () => void;
  
  constructor(
    container: HTMLElement,
    onLoadProgress: (progress: number) => void,
    onLoadComplete: () => void
  ) {
    this.container = container;
    this.onLoadProgressCallback = onLoadProgress;
    this.onLoadCompleteCallback = onLoadComplete;
    
    // Create scene
    this.scene = new Scene();
    this.scene.background = new Color(0x080810);
    this.scene.fog = new FogExp2(0x080810, 0.05);
    
    // Create camera
    this.camera = new PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.7, 5);
    
    // Create renderer
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.outputColorSpace = 'srgb';
    this.container.appendChild(this.renderer.domElement);
    
    // Pointer lock controls
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    
    // Create player
    this.player = new Player(this.camera, this.scene);
    
    // Combat system
    this.combatSystem = new CombatSystem(this.scene, this.player);
    
    // Add event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.addEventListener('click', () => {
      if (!this.controls.isLocked) {
        this.controls.lock();
      }
    });
    
    // Initialize audio listener
    const listener = gameAudio.getListener();
    this.camera.add(listener);
  }
  
  async initialize(): Promise<void> {
    // Load textures and assets
    await this.loadAssets();
    
    // Setup lights
    this.setupLights();
    
    // Create environment
    this.createEnvironment();
    
    // Add enemies
    this.createEnemies();
    
    // Start animation
    this.animate();
    
    this.isInitialized = true;
    this.onLoadCompleteCallback();
  }
  
  private async loadAssets(): Promise<void> {
    const textureLoader = new TextureLoader();
    const soundFiles = [
      { name: 'lightsaberOn', path: 'https://assets.mixkit.co/active_storage/sfx/883/883.wav' },
      { name: 'lightsaberOff', path: 'https://assets.mixkit.co/active_storage/sfx/135/135.wav' },
      { name: 'lightsaberHum', path: 'https://assets.mixkit.co/active_storage/sfx/209/209.wav' },
      { name: 'lightsaberSwing', path: 'https://assets.mixkit.co/active_storage/sfx/790/790.wav' },
      { name: 'lightsaberClash', path: 'https://assets.mixkit.co/active_storage/sfx/1001/1001.wav' },
      { name: 'lightsaberMove', path: 'https://assets.mixkit.co/active_storage/sfx/2648/2648.wav' },
      { name: 'playerHit', path: 'https://assets.mixkit.co/active_storage/sfx/150/150.wav' },
      { name: 'enemyHit', path: 'https://assets.mixkit.co/active_storage/sfx/539/539.wav' },
      { name: 'enemyDeath', path: 'https://assets.mixkit.co/active_storage/sfx/561/561.wav' },
      { name: 'background', path: 'https://assets.mixkit.co/active_storage/sfx/1224/1224.wav' },
    ];
    
    // Load floor texture
    const floorTexture = await new Promise<any>((resolve) => {
      textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/hardwood2_diffuse.jpg', (texture) => {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(4, 4);
        resolve(texture);
      });
    });
    this.assets.set('floorTexture', floorTexture);
    
    // Report progress
    this.onLoadProgressCallback(20);
    
    // Load sound effects
    let loadedSounds = 0;
    for (const sound of soundFiles) {
      await gameAudio.loadSound(sound.name, sound.path);
      loadedSounds++;
      this.onLoadProgressCallback(20 + (loadedSounds / soundFiles.length) * 80);
    }
  }
  
  private setupLights(): void {
    // Ambient light
    const ambientLight = new HemisphereLight(0x404080, 0x101010, 0.4);
    this.scene.add(ambientLight);
    
    // Main directional light (sun)
    const mainLight = new DirectionalLight(0xffffff, 1);
    mainLight.position.set(-10, 20, 15);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -20;
    mainLight.shadow.camera.right = 20;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -20;
    this.scene.add(mainLight);
    
    // Spotlights for dramatic effect
    const spotLight1 = new SpotLight(0x5555ff, 2, 20, Math.PI / 6, 0.5, 1);
    spotLight1.position.set(-5, 10, -5);
    spotLight1.castShadow = true;
    this.scene.add(spotLight1);
    
    const spotLight2 = new SpotLight(0xff5555, 2, 20, Math.PI / 6, 0.5, 1);
    spotLight2.position.set(5, 10, -5);
    spotLight2.castShadow = true;
    this.scene.add(spotLight2);
    
    // Add some point lights for ambiance
    const pointLight1 = new PointLight(0x3333ff, 1, 10);
    pointLight1.position.set(-8, 2, -8);
    this.scene.add(pointLight1);
    
    const pointLight2 = new PointLight(0xff3333, 1, 10);
    pointLight2.position.set(8, 2, -8);
    this.scene.add(pointLight2);
  }
  
  private createEnvironment(): void {
    // Floor
    const floorGeometry = new PlaneGeometry(50, 50);
    const floorMaterial = new MeshStandardMaterial({
      map: this.assets.get('floorTexture'),
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    
    // Create some pillars
    const createPillar = (x: number, z: number) => {
      const baseGeometry = new BoxGeometry(2, 0.5, 2);
      const baseMaterial = new MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.7,
        roughness: 0.3,
      });
      const base = new Mesh(baseGeometry, baseMaterial);
      base.position.set(x, 0.25, z);
      base.receiveShadow = true;
      base.castShadow = true;
      this.scene.add(base);
      
      const pillarGeometry = new CylinderGeometry(0.3, 0.3, 5, 16);
      const pillarMaterial = new MeshStandardMaterial({
        color: 0x444444,
        metalness: 0.7,
        roughness: 0.3,
      });
      const pillar = new Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(x, 2.5, z);
      pillar.receiveShadow = true;
      pillar.castShadow = true;
      this.scene.add(pillar);
      
      const topGeometry = new BoxGeometry(1.5, 0.3, 1.5);
      const top = new Mesh(topGeometry, baseMaterial);
      top.position.set(x, 5.15, z);
      top.receiveShadow = true;
      top.castShadow = true;
      this.scene.add(top);
    };
    
    // Create pillars at corners
    createPillar(10, 10);
    createPillar(-10, 10);
    createPillar(10, -10);
    createPillar(-10, -10);
    
    // Create some barriers
    const createBarrier = (x: number, z: number, width: number, depth: number, height: number = 1) => {
      const geometry = new BoxGeometry(width, height, depth);
      const material = new MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.6,
        roughness: 0.4,
      });
      const barrier = new Mesh(geometry, material);
      barrier.position.set(x, height / 2, z);
      barrier.receiveShadow = true;
      barrier.castShadow = true;
      this.scene.add(barrier);
    };
    
    // Create barriers around the arena
    createBarrier(0, 12, 24, 1, 2);
    createBarrier(0, -12, 24, 1, 2);
    createBarrier(12, 0, 1, 24, 2);
    createBarrier(-12, 0, 1, 24, 2);
    
    // Add some decorative objects
    const sphereGeometry = new SphereGeometry(0.5, 32, 32);
    const sphereMaterial = new MeshStandardMaterial({
      color: 0x3333ff,
      emissive: 0x1111aa,
      emissiveIntensity: 0.5,
      metalness: 1.0,
      roughness: 0.3,
    });
    
    const sphere1 = new Mesh(sphereGeometry, sphereMaterial);
    sphere1.position.set(5, 1, 5);
    sphere1.castShadow = true;
    this.scene.add(sphere1);
    
    const sphere2 = new Mesh(
      sphereGeometry,
      new MeshStandardMaterial({
        color: 0xff3333,
        emissive: 0xaa1111,
        emissiveIntensity: 0.5,
        metalness: 1.0,
        roughness: 0.3,
      })
    );
    sphere2.position.set(-5, 1, 5);
    sphere2.castShadow = true;
    this.scene.add(sphere2);
  }
  
  private createEnemies(): void {
    // Create an enemy
    const enemy = new Enemy(this.scene);
    enemy.position.set(0, 0, -5);
    this.scene.add(enemy);
    
    // Add to tracking lists
    this.enemies.push(enemy);
    this.combatSystem.addEnemy(enemy);
  }
  
  onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    
    if (!this.isInitialized) return;
    
    const delta = this.clock.getDelta();
    
    // Update player
    this.player.update(delta);
    
    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(delta, this.player.getPosition(), this.player.getDirection());
    }
    
    // Update combat
    this.combatSystem.update();
    
    // Update audio
    gameAudio.update();
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
  
  lockControls(): void {
    this.controls.lock();
  }
  
  unlockControls(): void {
    this.controls.unlock();
  }
  
  isControlsLocked(): boolean {
    return this.controls.isLocked;
  }
  
  getPlayer(): Player {
    return this.player;
  }
  
  getCombatSystem(): CombatSystem {
    return this.combatSystem;
  }
  
  getEnemies(): Enemy[] {
    return this.enemies;
  }
  
  startBackgroundMusic(): void {
    gameAudio.playMusic('background', { fadeIn: 2000, volume: 0.3 });
  }
  
  stopBackgroundMusic(): void {
    gameAudio.stopMusic(1000);
  }
  
  cleanup(): void {
    this.stopBackgroundMusic();
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.controls.unlock();
    this.container.removeChild(this.renderer.domElement);
  }
}
