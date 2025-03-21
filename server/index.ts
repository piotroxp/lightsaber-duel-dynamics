import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

// Game room management
interface GameRoom {
  id: string;
  hostId: string;
  players: {
    id: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    health: number;
    lightsaberPosition: { x: number; y: number; z: number };
    lightsaberRotation: { x: number; y: number; z: number; w: number };
    isAttacking: boolean;
    isBlocking: boolean;
  }[];
  gameState: "waiting" | "playing" | "finished";
  startTime?: number;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from the client build
app.use(express.static("dist"));

// Store active game rooms
const gameRooms: Record<string, GameRoom> = {};

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new game room
  socket.on("create_room", () => {
    const roomId = uuidv4().substring(0, 8);
    gameRooms[roomId] = {
      id: roomId,
      hostId: socket.id,
      players: [{
        id: socket.id,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        health: 100,
        lightsaberPosition: { x: 0, y: 0, z: 0 },
        lightsaberRotation: { x: 0, y: 0, z: 0, w: 1 },
        isAttacking: false,
        isBlocking: false
      }],
      gameState: "waiting"
    };

    // Join socket to the room
    socket.join(roomId);
    
    // Send room info back to client
    socket.emit("room_created", {
      roomId,
      joinUrl: `${process.env.CLIENT_URL || "http://localhost:8080"}?room=${roomId}`
    });
    
    console.log(`Room created: ${roomId} by host: ${socket.id}`);
  });

  // Join an existing game room
  socket.on("join_room", (roomId) => {
    const room = gameRooms[roomId];
    
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }
    
    if (room.gameState !== "waiting") {
      socket.emit("error", { message: "Game already in progress" });
      return;
    }
    
    // Add player to room
    room.players.push({
      id: socket.id,
      position: { x: 0, y: 0, z: 5 }, // Start opposite the host
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      health: 100,
      lightsaberPosition: { x: 0, y: 0, z: 0 },
      lightsaberRotation: { x: 0, y: 0, z: 0, w: 1 },
      isAttacking: false,
      isBlocking: false
    });
    
    // Join socket to the room
    socket.join(roomId);
    
    // Notify room that player joined
    io.to(roomId).emit("player_joined", {
      playerId: socket.id,
      players: room.players
    });
    
    console.log(`Player ${socket.id} joined room: ${roomId}`);
  });

  // Start the game (host only)
  socket.on("start_game", (roomId) => {
    const room = gameRooms[roomId];
    
    if (!room || room.hostId !== socket.id) {
      socket.emit("error", { message: "Not authorized to start game" });
      return;
    }
    
    room.gameState = "playing";
    room.startTime = Date.now();
    
    // Notify all players that game is starting
    io.to(roomId).emit("game_started", {
      startTime: room.startTime,
      players: room.players
    });
    
    console.log(`Game started in room: ${roomId}`);
  });

  // Player updates their position/state
  socket.on("player_update", (data) => {
    const { roomId, position, rotation, lightsaberPosition, lightsaberRotation, isAttacking, isBlocking } = data;
    const room = gameRooms[roomId];
    
    if (!room) return;
    
    // Find and update player
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.position = position;
      player.rotation = rotation;
      player.lightsaberPosition = lightsaberPosition;
      player.lightsaberRotation = lightsaberRotation;
      player.isAttacking = isAttacking;
      player.isBlocking = isBlocking;
      
      // Broadcast update to other players in room
      socket.to(roomId).emit("player_updated", {
        playerId: socket.id,
        position,
        rotation,
        lightsaberPosition,
        lightsaberRotation,
        isAttacking,
        isBlocking
      });
    }
  });

  // Combat hit detection
  socket.on("player_hit", (data) => {
    const { roomId, targetId, damage } = data;
    const room = gameRooms[roomId];
    
    if (!room) return;
    
    // Find target player
    const targetPlayer = room.players.find(p => p.id === targetId);
    if (targetPlayer) {
      targetPlayer.health = Math.max(0, targetPlayer.health - damage);
      
      // Broadcast hit to all players in room
      io.to(roomId).emit("player_damaged", {
        playerId: targetId,
        health: targetPlayer.health,
        attackerId: socket.id
      });
      
      // Check for game over
      if (targetPlayer.health <= 0) {
        io.to(roomId).emit("player_defeated", {
          playerId: targetId,
          winnerId: socket.id
        });
        
        room.gameState = "finished";
      }
    }
  });

  // Disconnect handling
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find rooms player is in
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      
      // Remove player from room
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        // If host left, end the game
        if (room.hostId === socket.id) {
          io.to(roomId).emit("host_disconnected");
          delete gameRooms[roomId];
          console.log(`Room ${roomId} closed: host disconnected`);
        } else {
          // Notify other players
          io.to(roomId).emit("player_left", { playerId: socket.id });
          console.log(`Player ${socket.id} left room: ${roomId}`);
        }
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
}); 