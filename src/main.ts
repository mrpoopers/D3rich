// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// Game Constants

const WORLD_ORIGIN = leaflet.latLng(0, 0);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const CELL_SPAWN_PROBABILITY = 0.35; // adjust density
const INTERACTION_RADIUS = 2; // distance in cells

// Game state
type GameState = {
  heldToken: number | null;
  playerLatLng: leaflet.LatLng;
};

const gameState: GameState = {
  heldToken: null,
  playerLatLng: WORLD_ORIGIN,
};

//Cell Coordinate Helpers

// Convert grid i,j to geographic rectangle
function cellBounds(i: number, j: number): leaflet.LatLngBounds {
  const o = WORLD_ORIGIN;
  return leaflet.latLngBounds(
    [
      [o.lat + i * TILE_DEGREES, o.lng + j * TILE_DEGREES],
      [o.lat + (i + 1) * TILE_DEGREES, o.lng + (j + 1) * TILE_DEGREES],
    ],
  );
}

// Reverse: lat/lng → grid cell
function latLngToCell(lat: number, lng: number) {
  const i = Math.floor((lat - WORLD_ORIGIN.lat) / TILE_DEGREES);
  const j = Math.floor((lng - WORLD_ORIGIN.lng) / TILE_DEGREES);
  return { i, j };
}

// Distance between player cell and target cell
function isNearPlayer(state: GameState, i: number, j: number) {
  const playerCell = latLngToCell(
    state.playerLatLng.lat,
    state.playerLatLng.lng,
  );
  const dist = Math.hypot(i - playerCell.i, j - playerCell.j);
  return dist <= INTERACTION_RADIUS;
}

//Cell Managment

const activeCells = new Map<string, leaflet.Rectangle>();
function cellKey(i: number, j: number) {
  return `${i},${j}`;
}

// Remove cells no longer visible
function rectangleIsVisible(
  rect: leaflet.Rectangle,
  bounds: leaflet.LatLngBounds,
) {
  return bounds.intersects(rect.getBounds());
}

//startGame()

export function startGame() {
  // UI Setup
  const directionsDiv = document.createElement("div");
  directionsDiv.id = "directionsDiv";
  directionsDiv.innerHTML = `<div>WASD to move</div>`;
  document.body.append(directionsDiv);

  const mapDiv = document.createElement("div");
  mapDiv.id = "map";
  document.body.append(mapDiv);

  const statusPanelDiv = document.createElement("div");
  statusPanelDiv.id = "statusPanel";
  statusPanelDiv.innerHTML = "Holding: nothing";
  document.body.append(statusPanelDiv);

  // Map Setup
  const map = leaflet.map(mapDiv, {
    center: gameState.playerLatLng,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
  });

  leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // Player marker
  const playerMarker = leaflet.marker(gameState.playerLatLng);
  playerMarker.bindTooltip("You");
  playerMarker.addTo(map);

  // Spawn Cell
  function spawnCell(
    state: GameState,
    i: number,
    j: number,
  ): leaflet.Rectangle {
    let tokenValue = luck([i, j, "spawn"].toString()) < 0.5 ? 1 : 0;

    const rect = leaflet.rectangle(cellBounds(i, j), {
      color: tokenValue > 0 ? "gold" : "gray",
      weight: 1,
    }).addTo(map);

    rect.bindPopup(() => {
      const div = document.createElement("div");
      div.innerHTML = `
        <div>Cell ${i},${j}</div>
        <div>Contains token: <b>${tokenValue}</b></div>
        <div>Holding: <b>${state.heldToken ?? "nothing"}</b></div>
        <button id="interact">Interact</button>
      `;

      div.querySelector("#interact")!.addEventListener("click", () => {
        if (!isNearPlayer(state, i, j)) {
          statusPanelDiv.innerHTML = "Too far to interact.";
          return;
        }

        if (state.heldToken === null && tokenValue > 0) {
          state.heldToken = tokenValue;
          tokenValue = 0;
          statusPanelDiv.innerHTML = `Holding: ${state.heldToken}`;
          rect.setStyle({ color: "gray" });
        } else if (state.heldToken !== null && tokenValue > 0) {
          const newValue = state.heldToken + tokenValue;
          state.heldToken = newValue;
          tokenValue = 0;
          statusPanelDiv.innerHTML = `Crafted new value: ${newValue}`;
          rect.setStyle({ color: "gray" });

          if (newValue >= 10) {
            alert("You win! Crafted token 10.");
          }
        } else {
          statusPanelDiv.innerHTML = "Nothing to do here.";
        }
      });

      return div;
    });

    return rect;
  }

  // Stream Cell System

  function updateVisibleCells() {
    const bounds = map.getBounds();

    const topLeft = latLngToCell(bounds.getNorth(), bounds.getWest());
    const bottomRight = latLngToCell(bounds.getSouth(), bounds.getEast());

    // Spawn all new needed cells
    for (let i = bottomRight.i; i <= topLeft.i; i++) {
      for (let j = topLeft.j; j <= bottomRight.j; j++) {
        const key = cellKey(i, j);

        if (!activeCells.has(key)) {
          const roll = luck([i, j, "cellExists"].toString());
          if (roll < CELL_SPAWN_PROBABILITY) {
            const rect = spawnCell(gameState, i, j);
            activeCells.set(key, rect);
          }
        }
      }
    }

    // Remove offscreen cells
    for (const [key, rect] of activeCells.entries()) {
      if (!rectangleIsVisible(rect, bounds)) {
        map.removeLayer(rect);
        activeCells.delete(key);
      }
    }
  }

  // Update when map is moved
  map.on("moveend", updateVisibleCells);

  // Player movement
  function movePlayer(state: GameState, dLat: number, dLng: number) {
    state.playerLatLng = leaflet.latLng(
      state.playerLatLng.lat + dLat,
      state.playerLatLng.lng + dLng,
    );
    playerMarker.setLatLng(state.playerLatLng);
    map.panTo(state.playerLatLng);
    updateVisibleCells();
  }

  document.addEventListener("keydown", (e) => {
    switch (e.key.toLowerCase()) {
      case "w":
        movePlayer(gameState, TILE_DEGREES, 0);
        break;
      case "s":
        movePlayer(gameState, -TILE_DEGREES, 0);
        break;
      case "a":
        movePlayer(gameState, 0, -TILE_DEGREES);
        break;
      case "d":
        movePlayer(gameState, 0, TILE_DEGREES);
        break;
    }
  });

  // Initial render
  updateVisibleCells();
}

//start
startGame();
