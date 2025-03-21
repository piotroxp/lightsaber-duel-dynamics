import { io, Socket } from "socket.io-client";
import { Vector3, Quaternion } from "three";

export interface NetworkPlayer {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  health: number;
  lightsaberPosition: { x: number; y: number; z: number };
  lightsaberRotation: { x: number; y: number; z: number; w: number };
  isAttacking: boolean;
  isBlocking: boolean;
}

interface RoomCreatedEvent {
  roomId: string;
  joinUrl: string;
}

interface PlayerJoinedEvent {
  playerId: string;
  players: NetworkPlayer[];
}

interface PlayerUpdatedEvent {
  playerId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  lightsaberPosition: { x: number; y: number; z: number };
  lightsaberRotation: { x: number; y: number; z: number; w: number };
  isAttacking: boolean;
  isBlocking: boolean;
}

interface PlayerDamagedEvent {
  playerId: string;
  health: number;
  attackerId: string;
}

export class NetworkManager {
  private static instance: NetworkManager;
  private socket: Socket;
  private roomId: string | null = null;
  private isHost: boolean = false;
  private remotePlayers: Map<string, NetworkPlayer> = new Map();
  
  // Event callbacks
  private onRoomCreatedCallback: ((data: RoomCreatedEvent) => void) | null = null;
  private onPlayerJoinedCallback: ((data: PlayerJoinedEvent) => void) | null = null;
  private onGameStartedCallback: (() => void) | null = null;
  private onPlayerUpdatedCallback: ((data: PlayerUpdatedEvent) => void) | null = null;
  private onPlayerDamagedCallback: ((data: PlayerDamagedEvent) => void) | null = null;
  private onPlayerDefeatedCallback: ((playerId: string, winnerId: string) => void) | null = null;
  private onHostDisconnectedCallback: (() => void) | null = null;
  private onErrorCallback: ((message: string) => void) | null = null;

  private constructor() {
    // Connect to the server (use environment variable or default)
    const serverUrl = process.env.SERVER_URL || "http://localhost:3000";
    this.socket = io(serverUrl);
    
    this.setupSocketListeners();
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private setupSocketListeners(): void {
    // Room creation response
    this.socket.on("room_created", (data: RoomCreatedEvent) => {
      this.roomId = data.roomId;
      this.isHost = true;
      if (this.onRoomCreatedCallback) this.onRoomCreatedCallback(data);
    });

    // Player joined event
    this.socket.on("player_joined", (data: PlayerJoinedEvent) => {
      // Update remote players
      data.players.forEach(player => {
        if (player.id !== this.socket.id) {
          this.remotePlayers.set(player.id, player);
        }
      });
      
      if (this.onPlayerJoinedCallback) this.onPlayerJoinedCallback(data);
    });

    // Game started event
    this.socket.on("game_started", () => {
      if (this.onGameStartedCallback) this.onGameStartedCallback();
    });

    // Player position/state update
    this.socket.on("player_updated", (data: PlayerUpdatedEvent) => {
      // Update remote player's state
      const player = this.remotePlayers.get(data.playerId);
      if (player) {
        player.position = data.position;
        player.rotation = data.rotation;
        player.lightsaberPosition = data.lightsaberPosition;
        player.lightsaberRotation = data.lightsaberRotation;
        player.isAttacking = data.isAttacking;
        player.isBlocking = data.isBlocking;
      }
      
      if (this.onPlayerUpdatedCallback) this.onPlayerUpdatedCallback(data);
    });

    // Player damaged event
    this.socket.on("player_damaged", (data: PlayerDamagedEvent) => {
      // Update remote player's health
      const player = this.remotePlayers.get(data.playerId);
      if (player) {
        player.health = data.health;
      }
      
      if (this.onPlayerDamagedCallback) this.onPlayerDamagedCallback(data);
    });

    // Player defeated event
    this.socket.on("player_defeated", ({ playerId, winnerId }) => {
      if (this.onPlayerDefeatedCallback) this.onPlayerDefeatedCallback(playerId, winnerId);
    });

    // Host disconnected event
    this.socket.on("host_disconnected", () => {
      if (this.onHostDisconnectedCallback) this.onHostDisconnectedCallback();
    });

    // Error events
    this.socket.on("error", ({ message }) => {
      if (this.onErrorCallback) this.onErrorCallback(message);
    });
  }

  // Create a new room as host
  public createRoom(): void {
    this.socket.emit("create_room");
  }

  // Join an existing room
  public joinRoom(roomId: string): void {
    this.roomId = roomId;
    this.isHost = false;
    this.socket.emit("join_room", roomId);
  }

  // Start the game (host only)
  public startGame(): void {
    if (this.isHost && this.roomId) {
      this.socket.emit("start_game", this.roomId);
    } else {
      console.error("Only the host can start the game");
    }
  }

  // Send player update to server
  public sendPlayerUpdate(
    position: Vector3,
    rotation: Quaternion,
    lightsaberPosition: Vector3,
    lightsaberRotation: Quaternion,
    isAttacking: boolean,
    isBlocking: boolean
  ): void {
    if (!this.roomId) return;
    
    this.socket.emit("player_update", {
      roomId: this.roomId,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      lightsaberPosition: { x: lightsaberPosition.x, y: lightsaberPosition.y, z: lightsaberPosition.z },
      lightsaberRotation: { x: lightsaberRotation.x, y: lightsaberRotation.y, z: lightsaberRotation.z, w: lightsaberRotation.w },
      isAttacking,
      isBlocking
    });
  }

  // Send player hit event
  public sendPlayerHit(targetId: string, damage: number): void {
    if (!this.roomId) return;
    
    this.socket.emit("player_hit", {
      roomId: this.roomId,
      targetId,
      damage
    });
  }

  // Register event handlers
  public onRoomCreated(callback: (data: RoomCreatedEvent) => void): void {
    this.onRoomCreatedCallback = callback;
  }

  public onPlayerJoined(callback: (data: PlayerJoinedEvent) => void): void {
    this.onPlayerJoinedCallback = callback;
  }

  public onGameStarted(callback: () => void): void {
    this.onGameStartedCallback = callback;
  }

  public onPlayerUpdated(callback: (data: PlayerUpdatedEvent) => void): void {
    this.onPlayerUpdatedCallback = callback;
  }

  public onPlayerDamaged(callback: (data: PlayerDamagedEvent) => void): void {
    this.onPlayerDamagedCallback = callback;
  }

  public onPlayerDefeated(callback: (playerId: string, winnerId: string) => void): void {
    this.onPlayerDefeatedCallback = callback;
  }

  public onHostDisconnected(callback: () => void): void {
    this.onHostDisconnectedCallback = callback;
  }

  public onError(callback: (message: string) => void): void {
    this.onErrorCallback = callback;
  }

  // Getters
  public getRemotePlayers(): Map<string, NetworkPlayer> {
    return this.remotePlayers;
  }

  public isGameHost(): boolean {
    return this.isHost;
  }

  public getRoomId(): string | null {
    return this.roomId;
  }

  public getPlayerId(): string {
    return this.socket.id;
  }

  // Cleanup
  public disconnect(): void {
    this.socket.disconnect();
  }

  // Check if URL contains room ID and auto-join
  public checkAndJoinFromUrl(): boolean {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    
    if (roomId) {
      this.joinRoom(roomId);
      return true;
    }
    
    return false;
  }
} 