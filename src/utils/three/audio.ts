import { Audio, AudioListener, AudioLoader, PositionalAudio } from 'three';

interface SoundOptions {
  loop?: boolean;
  volume?: number;
  position?: { x: number; y: number; z: number };
  detune?: number;
}

interface Sound {
  buffer: AudioBuffer;
  isLoaded: boolean;
}

class GameAudio {
  private listener: AudioListener | null = null;
  private sounds: Map<string, Sound> = new Map();
  private audioContext: AudioContext | null = null;
  private soundSources: Audio[] = [];
  private isInitialized: boolean = false;
  private resumeAudioContext: () => void = () => {};

  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    // If already initialized, just resolve
    if (this.isInitialized) {
      console.log("Audio already initialized");
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      // Set timeout to resolve even if audio loading hangs
      const timeoutId = setTimeout(() => {
        console.warn('Audio initialization timed out - continuing anyway');
        this.isInitialized = true; // Mark as initialized anyway
        resolve();
      }, 5000);
      
      try {
        console.log("Starting audio initialization");
        // Create audio listener
        this.listener = new AudioListener();

        // Create audio context
        try {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          
          // Add event listeners to resume AudioContext on user interaction
          // This is needed because browsers require user interaction to start audio
          this.setupAudioContextResumeListeners();
        } catch (e) {
          console.error('Web Audio API is not supported in this browser', e);
        }

        // Immediately mark as initialized to prevent loading issues
        this.isInitialized = true;

        // Load sounds asynchronously, but don't block game start
        this.loadSounds(onProgress)
          .then(() => {
            console.log("Audio sounds loaded successfully");
            clearTimeout(timeoutId);
            resolve();
          })
          .catch(err => {
            console.error("Failed to load audio sounds:", err);
            clearTimeout(timeoutId);
            resolve(); // Resolve anyway to avoid blocking the game
          });
      } catch (error) {
        console.error('Audio initialization failed:', error);
        // Still resolve to prevent game from getting stuck
        this.isInitialized = true; // Mark as initialized anyway
        clearTimeout(timeoutId);
        resolve();
      }
    });
  }

  private setupAudioContextResumeListeners(): void {
    if (!this.audioContext) return;

    const resumeAudio = () => {
      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('AudioContext resumed successfully');
        }).catch(error => {
          console.error('Failed to resume AudioContext:', error);
        });
      }
    };

    this.resumeAudioContext = resumeAudio;

    // Add event listeners to resume the audio context on user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, resumeAudio, { once: true });
    });
  }

  public resumeAudio(): void {
    this.resumeAudioContext();
  }

  private async loadSounds(onProgress?: (progress: number) => void): Promise<void> {
    const soundFiles = [
      { name: 'lightsaberHum', path: '/sounds/lightsaber_hum.mp3' },
      { name: 'lightsaberOn', path: '/sounds/lightsaber_on.mp3' },
      { name: 'lightsaberOff', path: '/sounds/lightsaber_off.mp3' },
      { name: 'lightsaberSwing', path: '/sounds/lightsaber_swing.mp3' },
      { name: 'lightsaberClash', path: '/sounds/lightsaber_clash.mp3' },
      { name: 'lightsaberMove', path: '/sounds/lightsaber_move.mp3' },
      { name: 'playerHit', path: '/sounds/player_hit.mp3' },
      { name: 'enemyHit', path: '/sounds/enemy_hit.mp3' },
      { name: 'backgroundMusic', path: '/sounds/background_music.mp3' },
    ];

    // Create dummy sounds for now
    for (let i = 0; i < soundFiles.length; i++) {
      const sound = soundFiles[i];
      
      try {
        // Create empty buffer for now
        const buffer = this.audioContext?.createBuffer(2, 22050, 44100) || null;
        
        this.sounds.set(sound.name, {
          buffer: buffer as AudioBuffer,
          isLoaded: true
        });
      } catch (err) {
        console.error(`Failed to create buffer for sound ${sound.name}:`, err);
        // Still add an entry so the game doesn't crash when trying to play this sound
        this.sounds.set(sound.name, {
          buffer: null as any,
          isLoaded: false
        });
      }
      
      if (onProgress) {
        onProgress((i + 1) / soundFiles.length);
      }
      
      // Shorter delay to speed up loading
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  playSound(name: string, options: SoundOptions = {}): Audio | null {
    if (!this.isInitialized || !this.listener) {
      console.warn('Audio system not initialized');
      return null;
    }
    
    // Try to resume audio context if needed
    this.resumeAudio();
    
    const sound = this.sounds.get(name);
    if (!sound || !sound.isLoaded) {
      console.warn(`Sound ${name} not loaded`);
      return null;
    }
    
    try {
      const audio = new Audio(this.listener);
      audio.setBuffer(sound.buffer);
      audio.setLoop(options.loop || false);
      audio.setVolume(options.volume || 1.0);
      audio.play();
      
      // Store reference for cleanup
      this.soundSources.push(audio);
      
      return audio;
    } catch (err) {
      console.error(`Failed to play sound ${name}:`, err);
      return null;
    }
  }
  
  stopAll(): void {
    for (const source of this.soundSources) {
      if (source.isPlaying) {
        try {
          source.stop();
        } catch (err) {
          console.error("Failed to stop audio source:", err);
        }
      }
    }
    this.soundSources = [];
  }
}

export default new GameAudio();
