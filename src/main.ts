// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
const STORAGE_KEY = "geo-token-game-v1";

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

// Cell State
type CellState = {
  tokenValue: number;
};

const savedCells = new Map<string, CellState>();

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

function saveGame() {
  const payload = {
    playerLatLng: gameState.playerLatLng,
    heldToken: gameState.heldToken,
    savedCells: Array.from(savedCells.entries()),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  const data = JSON.parse(raw);
  gameState.playerLatLng = leaflet.latLng(data.playerLatLng);
  gameState.heldToken = data.heldToken;

  savedCells.clear();
  for (const [k, v] of data.savedCells) {
    savedCells.set(k, v);
  }
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

function getCellState(i: number, j: number): CellState {
  const key = cellKey(i, j);

  // If we've saved this one before, restore it
  if (savedCells.has(key)) {
    return savedCells.get(key)!;
  }

  // Otherwise generate a fresh procedural state
  const tokenValue = luck([i, j, "spawn"].toString()) < 0.5 ? 1 : 0;
  return { tokenValue };
}

type MoveFn = (dLat: number, dLng: number) => void;

interface MovementController {
  start(): void;
  stop(): void;
}

class ButtonMovementController implements MovementController {
  constructor(private move: MoveFn) {}

  start() {
    document.addEventListener("keydown", this.onKey);
  }

  stop() {
    document.removeEventListener("keydown", this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    switch (e.key.toLowerCase()) {
      case "w":
        this.move(TILE_DEGREES, 0);
        break;
      case "s":
        this.move(-TILE_DEGREES, 0);
        break;
      case "a":
        this.move(0, -TILE_DEGREES);
        break;
      case "d":
        this.move(0, TILE_DEGREES);
        break;
    }
  };
}

class GeoMovementController implements MovementController {
  private watchId: number | null = null;
  private lastPos: GeolocationPosition | null = null;

  constructor(private move: MoveFn) {}

  start() {
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!this.lastPos) {
          this.lastPos = pos;
          return;
        }

        const dLat = (pos.coords.latitude - this.lastPos.coords.latitude) *
          0.00001;
        const dLng = (pos.coords.longitude - this.lastPos.coords.longitude) *
          0.00001;

        this.move(dLat, dLng);
        this.lastPos = pos;
      },
      console.error,
      { enableHighAccuracy: true },
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

class MovementFacade {
  private active: MovementController | null = null;

  use(controller: MovementController) {
    this.active?.stop();
    this.active = controller;
    this.active.start();
  }
}

//startGame()

export function startGame() {
  loadGame();

  // UI Setup
  const directionsDiv = document.createElement("div");
  directionsDiv.id = "directionsDiv";
  directionsDiv.innerHTML = `<div>WASD to move</div>`;
  document.body.append(directionsDiv);

  const movementButtons = document.createElement("div");
  movementButtons.id = "movementButtons";

  movementButtons.innerHTML = `
  <div style="text-align:center;">
  <button id="btnUp">W</button><br>
  <button id="btnLeft">A</button>
  <button id="btnDown">S</button>
  <button id="btnRight">D</button>
`;
  document.body.append(movementButtons);

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
    const key = cellKey(i, j);

    // Load state (memento) or generate new
    let { tokenValue } = getCellState(i, j);

    const rect = leaflet.rectangle(cellBounds(i, j), {
      className: tokenValue > 0 ? "cell-token" : "cell-empty",
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
          savedCells.set(key, { tokenValue });
          statusPanelDiv.innerHTML = `Holding: ${state.heldToken}`;
          rect.getElement()?.classList.remove("cell-token");
          rect.getElement()?.classList.add("cell-empty");
        } else if (state.heldToken !== null && tokenValue > 0) {
          const newValue = state.heldToken + tokenValue;
          state.heldToken = newValue;
          tokenValue = 0;
          statusPanelDiv.innerHTML = `Crafted new value: ${newValue}`;
          rect.getElement()?.classList.remove("cell-token");
          rect.getElement()?.classList.add("cell-empty");

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
          // IMPORTANT: Cells exist only if they spawned once OR if they were modified
          const existsProcedurally =
            luck([i, j, "cellExists"].toString()) < CELL_SPAWN_PROBABILITY;
          const wasModified = savedCells.has(key);

          if (existsProcedurally || wasModified) {
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

  const movement = new MovementFacade();

  const moveFn: MoveFn = (dLat, dLng) => {
    movePlayer(gameState, dLat, dLng);
    saveGame();
  };

  const buttonController = new ButtonMovementController(moveFn);
  const geoController = new GeoMovementController(moveFn);

  // Default mode
  movement.use(buttonController);

  document.getElementById("btnUp")!.addEventListener("click", () => {
    movePlayer(gameState, TILE_DEGREES, 0);
  });
  document.getElementById("btnDown")!.addEventListener("click", () => {
    movePlayer(gameState, -TILE_DEGREES, 0);
  });
  document.getElementById("btnLeft")!.addEventListener("click", () => {
    movePlayer(gameState, 0, -TILE_DEGREES);
  });
  document.getElementById("btnRight")!.addEventListener("click", () => {
    movePlayer(gameState, 0, TILE_DEGREES);
  });

  const controls = document.createElement("div");
  controls.innerHTML = `
  <button id="useButtons">Buttons</button>
  <button id="useGeo">Geolocation</button>
  <button id="newGame">New Game</button>
`;
  document.body.append(controls);

  document.getElementById("useButtons")!.onclick = () =>
    movement.use(buttonController);

  document.getElementById("useGeo")!.onclick = () =>
    movement.use(geoController);

  document.getElementById("newGame")!.onclick = () => {
    localStorage.clear();
    location.reload();
  };

  // Initial render
  updateVisibleCells();
}

//start
startGame();
