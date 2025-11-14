# D3: {walking boxes}

# Game Design Vision

Players can walk around the map and collect tokens from nearby cells. Each cell contains either a 1 or a 0, and collecting a cell simply adds one point to the player’s total. There’s no merging or crafting yet, this milestone focuses on basic movement, interaction, and collecting tokens as you explore.

# Technologies

This project uses Leaflet to display the map and handle the grid layout and the luck() function to randomly decide where tokens appear. Everything else is built with TypeScript and basic UI elements created in the browser.

# Assignments

This milestone sets up the core mechanics.

## D3.a: Core mechanics (token collection and crafting)

### Steps

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

## D3.b:

...

### 
