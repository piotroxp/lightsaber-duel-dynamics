# Plasma Blade Combat

## Project info

support btc bc1qhyg294l0r0jt4h9p6xepvjmvsfykk2m6wvmfxp
support sol DDsLkdvH7ewQFA9pTfacVyNcGbtj12tKTZrt1HmqCQ6a

<think>
I need to get an overview of the codebase first. Let me explore the directory structure to understand what kind of project this is and how it's organized.

First, I'll list the root directory contents:
</think>

I'll explore the codebase to create a comprehensive overview for you. Let's start by examining the directory structure.

Ran tool
Let's check the package.json to understand the project's dependencies and structure better:

Read file: package.json
Now let's look at the README to get a better understanding of what this project is about:

Read file: README.md
Let's explore the src directory to understand the code structure:

Ran tool
Let's check the server directory to understand the backend structure:

Ran tool
Let's look at the main App.tsx file to understand the application structure:

Read file: src/App.tsx
Let's look at the main server file:

Read file: server/index.ts
Let's check what's in the pages directory to understand the main application pages:

Ran tool
Let's examine the Index page:

Read file: src/pages/Index.tsx
Let's check the Game component:

Ran tool
Now let's examine the Game component:

Read file: src/components/Game.tsx
Let's look at the Three.js scene implementation that powers the lightsaber duel:

Ran tool
Let's look at the main scene implementation:

Read file: src/utils/three/scene.ts
Let's also check the player implementation:

Read file: src/utils/three/player.ts
Let's also check the lightsaber implementation:

Ran tool

Read file: src/utils/three/lightsaber.ts
Based on the exploration of the codebase, I'll now provide a comprehensive overview of the project:

# Plasma Blade Combat - Code Overview

This is a 3D lightsaber dueling game built with React, Three.js, and Socket.io. The project implements a first-person combat system where players can engage in lightsaber duels with advanced mechanics.

## Project Structure

- **Frontend**: React application with TypeScript using Vite as the build tool
- **Backend**: Express.js server with Socket.io for real-time multiplayer functionality
- **UI Framework**: Uses Shadcn UI components with Tailwind CSS
- **3D Graphics**: Three.js for rendering the 3D environment and lightsaber combat

## Key Components

### 1. Server (Socket.io)

The server (`server/index.ts`) manages multiplayer functionality with:
- Room creation and joining
- Player state synchronization
- Combat mechanics and hit detection
- Game state management (waiting, playing, finished)

### 2. Game Core

The main game logic is implemented in several key classes:

#### GameScene (`src/utils/three/scene.ts`)
- Manages the 3D environment, lighting, and camera
- Handles game initialization and asset loading
- Controls the game loop and animation
- Manages player and enemy interactions
- Implements debug visualization and controls

#### Player (`src/utils/three/player.ts`)
- First-person player controller with movement physics
- Plasmablade combat mechanics (attack, block, stances)
- Health and damage system
- Input handling for keyboard and mouse
- Camera controls with head bobbing effects
- Implements seven different lightsaber combat stances

#### Plasmablade (`src/utils/three/lightsaber.ts`)
- Detailed 3D model with hilt and blade
- Realistic activation/deactivation animations
- Various attack types (light, heavy) with different animations
- Blocking mechanics
- Visual effects like glow, flare, and particle emissions
- Physics-based swing mechanics with momentum

### 3. React Components

- **Game.tsx**: Main component that initializes the 3D scene
- **LoadingScreen**: Handles loading assets and transitions
- **StanceSelector**: UI for selecting different lightsaber fighting styles
- Various UI components for health, score, and game status

## Game Features

1. **Plasmablade Combat System**
   - Different attack types (light and heavy)
   - Seven different fighting stances (Forms I-VII from Star Wars lore)
   - Blocking and parrying mechanics
   - Realistic blade clash effects with visual and audio feedback

2. **Physics and Movement**
   - First-person movement with jumping and crouching
   - Momentum-based lightsaber swings
   - Collision detection for environment and combat

3. **Visual Effects**
   - Dynamic lighting based on lightsaber color
   - Particle effects for blade glow and impacts
   - Head bobbing for movement immersion
   - Debug visualization for hitboxes and physics

4. **Multiplayer Functionality**
   - Room-based duels with host and joining mechanics
   - Real-time position and state synchronization
   - Damage and health synchronization
   - Game state management for rounds

5. **Audio System**
   - Plasmablade hum, activation, and swing sounds
   - Impact and clash sound effects
   - Background music control

## Technical Highlights

- **Performance Optimization**: Efficient rendering with Three.js
- **Advanced Animation**: Combination of procedural and tweened animations
- **Physics Simulation**: Custom physics for lightsaber movement and combat
- **Responsive Controls**: Precise input handling for combat mechanics
- **Stance System**: Modular combat system with different fighting styles

## Development Tools

- TypeScript for type safety
- ESLint for code quality
- Tailwind CSS for styling
- React Query for data management
- Socket.io for real-time communication

This is a complex 3D web application that combines modern web technologies with game development principles to create an immersive lightsaber combat experience.
