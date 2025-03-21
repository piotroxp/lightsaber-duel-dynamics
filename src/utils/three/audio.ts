import { Audio, AudioListener, AudioLoader, PositionalAudio } from 'three';

interface SoundOptions {
  loop?: boolean;
  volume?: number;
  position?: { x: number; y: number; z: number };
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
    return new Promise<void>((resolve) => {
      // Set timeout to resolve even if audio loading hangs
      const timeoutId = setTimeout(() => {
        console.warn('Audio initialization timed out - continuing anyway');
        resolve();
      }, 5000);
      
      try {
        // Create audio listener
        this.listener = new AudioListener();
        this.isInitialized = true;

        // Create audio context
        try {
          this.audioContext = new AudioContext();
          
          // Add event listeners to resume AudioContext on user interaction
          // This is needed because browsers require user interaction to start audio
          this.setupAudioContextResumeListeners();
        } catch (e) {
          console.error('Web Audio API is not supported in this browser', e);
        }

        // Load sounds
        this.loadSounds(onProgress);
        
        // When complete, clear timeout and resolve
        clearTimeout(timeoutId);
        resolve();
      } catch (error) {
        console.error('Audio initialization failed:', error);
        // Still resolve to prevent game from getting stuck
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

    // Mock loading for now since we don't have the actual sound files yet
    for (let i = 0; i < soundFiles.length; i++) {
      const sound = soundFiles[i];
      
      // Create empty buffer for now
      const buffer = this.audioContext?.createBuffer(2, 22050, 44100) || null;
      
      this.sounds.set(sound.name, {
        buffer: buffer as AudioBuffer,
        isLoaded: true
      });
      
      if (onProgress) {
        onProgress((i + 1) / soundFiles.length);
      }
      
      // Small delay to simulate loading
      await new Promise(resolve => setTimeout(resolve, 100));
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
    
    const audio = new Audio(this.listener);
    audio.setBuffer(sound.buffer);
    audio.setLoop(options.loop || false);
    audio.setVolume(options.volume || 1.0);
    audio.play();
    
    // Store reference for cleanup
    this.soundSources.push(audio);
    
    return audio;
  }
  
  stopAll(): void {
    for (const source of this.soundSources) {
      if (source.isPlaying) {
        source.stop();
      }
    }
    this.soundSources = [];
  }
}

export default new GameAudio();
