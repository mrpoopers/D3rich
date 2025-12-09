# D3: {walking boxes}

# Game Design Vision

Players can walk around the map and collect tokens from nearby cells. Each cell contains either a 1 or a 0, and collecting a cell simply adds one point to the player’s total. There’s no merging or crafting yet, this milestone focuses on basic movement, interaction, and collecting tokens as you explore.

# Technologies

This project uses Leaflet to display the map and handle the grid layout and the luck() function to randomly decide where tokens appear. Everything else is built with TypeScript and basic UI elements created in the browser.

# Assignments

## D3.a: Core mechanics (token collection and crafting)

- [x] Copied the original main.ts into a new file called reference.ts to keep as a backup
- [x] Cleared all contents of main.ts to start fresh
- [x] Set up a basic Leaflet map centered on the classroom location
- [x] Added OpenStreetMap tiles so the map renders visually
- [x] Created a player marker to show the player's location
- [x] Disabled zooming and scrolling to create a "game board" feel
- [x] Added a function that converts grid cell coordinates (i, j) into Leaflet rectangle bounds
- [x] Drew a single test cell on the map to verify coordinate math
- [x] Added nested loops to draw a whole grid of cells around the player
- [x] Gave each cell a random token value (0 or 1) using the luck function
- [x] Made each cell clickable to show a popup describing what token (if any) it contains
- [x] Implemented “pick up token" → player can only hold one token at a time
- [x] Implemented “craft” → if holding a token and tapping a cell with a token, combine them to produce a double-value token
- [x] Updated the UI status panel to show the current held token value, instructions, and win-condition progress
- [x] Added logic that prevents interaction with cells that are too far from the player
- [x] Added the win condition: when the player crafts a token of value 10, show a victory message

### D3.b: Movement (set grid and infinite)

- [x] Added on-screen instructions telling the player to use WASD to move
- [x] Replaced button movement with keyboard controls for smoother player movement
- [x] Added a player movement system that updates the marker and recenters the map
- [x] Anchored the world grid to a single origin point to support an earth-spanning coordinate system
- [x] Implemented latLngToCell() to convert map coordinates back into grid cell coordinates
- [x] Added a distance check so the game knows which cell the player is close to
- [x] Created a streaming grid system that spawns new cells as the player moves or scrolls
- [x] Added logic to despawn cells that move offscreen to keep the map efficient
- [x] Used luck() to randomly decide which cells actually exist within the visible area
- [x] Ensured cells reset (“memoryless”) when they leave and re-enter the visible region
- [x] Connected the streaming system to Leaflet’s moveend event so the world updates whenever the map moves
- [x] Switched the game from a fixed grid to a fully infinite-feeling world that scrolls in all directions
- [x] Integrated crafting and pickup mechanics with the new streaming system so interactions still work correctly
- [x] Updated popups to enforce the interaction radius using the new position-based player system
- [x] Verified that the win condition still works with the new system and triggers at token value 10

### D3.b edits

- [x] Changed spawn to Null island
- [x] Added wasd buttons visible in game
- [x] Moved css out of main

### D3.c: Object persistence

- [x] Added a savedCells Map to store only modified cell states
- [x] Created a CellState type to track token values for modified cells.
- [x] Implemented getCellState(i, j) to load saved state or generate a fresh procedural state using luck().
- [x] Updated spawnCell so each cell loads its state from the Memento system instead of always generating new random values.
- [x] Added logic to save cell modifications whenever a player picks up or crafts a token.
- [x] Updated the streaming system so modified cells always respawn when visible

### D3.d: Gameplay Across Real-world Space and Time

- [x] Abstract player movement behind a MovementFacade
- [x] Support both button and geolocation-based controls
- [x] Persist player and cell state using localStorage
- [x] Allow switching movement modes and restarting the game
