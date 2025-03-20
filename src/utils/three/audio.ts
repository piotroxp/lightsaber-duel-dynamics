
import { AudioListener, Audio, AudioLoader, PositionalAudio } from 'three';

export class GameAudio {
  private sounds: Map<string, AudioBuffer> = new Map();
  private listener: AudioListener;
  private audioLoader: AudioLoader;
  private currentMusic: Audio | null = null;
  private soundEffects: Map<string, Audio> = new Map();
  private positionalSounds: Map<string, PositionalAudio> = new Map();
  
  constructor() {
    this.listener = new AudioListener();
    this.audioLoader = new AudioLoader();
  }
  
  getListener(): AudioListener {
    return this.listener;
  }
  
  async loadSound(name: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(path, (buffer) => {
        this.sounds.set(name, buffer);
        resolve();
      }, undefined, reject);
    });
  }
  
  playSound(name: string, options: { loop?: boolean; volume?: number } = {}): Audio | null {
    const buffer = this.sounds.get(name);
    if (!buffer) {
      console.warn(`Sound ${name} not found`);
      return null;
    }
    
    const sound = new Audio(this.listener);
    sound.setBuffer(buffer);
    sound.setLoop(options.loop || false);
    sound.setVolume(options.volume !== undefined ? options.volume : 1.0);
    sound.play();
    
    this.soundEffects.set(name + Date.now(), sound);
    
    // Cleanup ended non-looping sounds
    if (!options.loop) {
      sound.onEnded = () => {
        this.soundEffects.forEach((s, key) => {
          if (s === sound) {
            this.soundEffects.delete(key);
          }
        });
      };
    }
    
    return sound;
  }
  
  playMusic(name: string, options: { fadeIn?: number; volume?: number } = {}): void {
    // Stop current music if playing
    if (this.currentMusic && this.currentMusic.isPlaying) {
      this.currentMusic.stop();
    }
    
    const buffer = this.sounds.get(name);
    if (!buffer) {
      console.warn(`Music ${name} not found`);
      return;
    }
    
    const music = new Audio(this.listener);
    music.setBuffer(buffer);
    music.setLoop(true);
    
    // Set initial volume for fade-in
    if (options.fadeIn) {
      music.setVolume(0);
    } else {
      music.setVolume(options.volume !== undefined ? options.volume : 0.5);
    }
    
    music.play();
    this.currentMusic = music;
    
    // Handle fade-in
    if (options.fadeIn) {
      const targetVolume = options.volume !== undefined ? options.volume : 0.5;
      let volume = 0;
      const fadeInterval = setInterval(() => {
        volume += 0.01;
        if (volume >= targetVolume) {
          volume = targetVolume;
          clearInterval(fadeInterval);
        }
        music.setVolume(volume);
      }, options.fadeIn / 100);
    }
  }
  
  stopMusic(fadeOut?: number): void {
    if (!this.currentMusic) return;
    
    if (fadeOut) {
      let volume = this.currentMusic.getVolume();
      const fadeInterval = setInterval(() => {
        volume -= 0.01;
        if (volume <= 0) {
          volume = 0;
          clearInterval(fadeInterval);
          this.currentMusic?.stop();
        }
        this.currentMusic?.setVolume(volume);
      }, fadeOut / 100);
    } else {
      this.currentMusic.stop();
    }
  }
  
  createPositionalSound(name: string, options: { loop?: boolean; volume?: number; refDistance?: number } = {}): PositionalAudio | null {
    const buffer = this.sounds.get(name);
    if (!buffer) {
      console.warn(`Sound ${name} not found`);
      return null;
    }
    
    const sound = new PositionalAudio(this.listener);
    sound.setBuffer(buffer);
    sound.setLoop(options.loop || false);
    sound.setVolume(options.volume !== undefined ? options.volume : 1.0);
    sound.setRefDistance(options.refDistance !== undefined ? options.refDistance : 1);
    
    const soundId = name + Date.now();
    this.positionalSounds.set(soundId, sound);
    
    // Cleanup ended non-looping sounds
    if (!options.loop) {
      sound.onEnded = () => {
        this.positionalSounds.delete(soundId);
      };
    }
    
    return sound;
  }
  
  update(): void {
    // Cleanup any completed sound effects
    this.soundEffects.forEach((sound, key) => {
      if (!sound.isPlaying) {
        this.soundEffects.delete(key);
      }
    });
    
    this.positionalSounds.forEach((sound, key) => {
      if (!sound.isPlaying && sound.getLoop() === false) {
        this.positionalSounds.delete(key);
      }
    });
  }
}

export default new GameAudio();
