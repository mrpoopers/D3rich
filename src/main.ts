// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// ----------------------------------------
// UI SETUP
// ----------------------------------------
const directionsDiv = document.createElement("div");
directionsDiv.id = "directionsDiv";
document.body.append(directionsDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

statusPanelDiv.innerHTML = "Holding: nothing";

// Movement buttons
directionsDiv.innerHTML = `
  <div>WASD to move</div>
`;

// ----------------------------------------
// GAMEPLAY CONSTANTS
// ----------------------------------------
const WORLD_ORIGIN = leaflet.latLng(36.997936938057016, -122.05703507501151);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const CELL_SPAWN_PROBABILITY = 0.35; // adjust density
const INTERACTION_RADIUS = 2; // distance in cells

// Player state
let heldToken: number | null = null;
let playerLatLng = WORLD_ORIGIN;

// ----------------------------------------
// MAP SETUP
// ----------------------------------------
const map = leaflet.map(mapDiv, {
  center: playerLatLng,
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
const playerMarker = leaflet.marker(playerLatLng);
playerMarker.bindTooltip("You");
playerMarker.addTo(map);

// ----------------------------------------
// CELL COORDINATE HELPERS
// ----------------------------------------

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
function isNearPlayer(i: number, j: number) {
  const playerCell = latLngToCell(playerLatLng.lat, playerLatLng.lng);
  const dist = Math.hypot(i - playerCell.i, j - playerCell.j);
  return dist <= INTERACTION_RADIUS;
}

// ----------------------------------------
// ACTIVE CELL MANAGEMENT
// ----------------------------------------
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

// ----------------------------------------
// CELL SPAWNING
// ----------------------------------------
function spawnCell(i: number, j: number): leaflet.Rectangle {
  // Each cell has a random 0 or 1 token
  let tokenValue = luck([i, j, "spawn"].toString()) < 0.5 ? 1 : 0;

  const rect = leaflet.rectangle(cellBounds(i, j), {
    color: tokenValue > 0 ? "gold" : "gray",
    weight: 1,
  }).addTo(map);

  // Popup logic
  rect.bindPopup(() => {
    const div = document.createElement("div");
    div.innerHTML = `
      <div>Cell ${i},${j}</div>
      <div>Contains token: <b>${tokenValue}</b></div>
      <div>Holding: <b>${heldToken ?? "nothing"}</b></div>
      <button id="interact">Interact</button>
    `;

    div.querySelector("#interact")!.addEventListener("click", () => {
      // Enforce interaction radius
      if (!isNearPlayer(i, j)) {
        statusPanelDiv.innerHTML = "Too far to interact.";
        return;
      }

      // PICK UP
      if (heldToken === null && tokenValue > 0) {
        heldToken = tokenValue;
        tokenValue = 0;
        statusPanelDiv.innerHTML = `Holding: ${heldToken}`;
        rect.setStyle({ color: "gray" });
      } // CRAFT
      else if (heldToken !== null && tokenValue > 0) {
        const newValue = heldToken + tokenValue;
        heldToken = newValue;
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

// ----------------------------------------
// STREAMING CELL SYSTEM
// ----------------------------------------
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
          const rect = spawnCell(i, j);
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

// ----------------------------------------
// PLAYER MOVEMENT
// ----------------------------------------
function movePlayer(dLat: number, dLng: number) {
  playerLatLng = leaflet.latLng(
    playerLatLng.lat + dLat,
    playerLatLng.lng + dLng,
  );
  playerMarker.setLatLng(playerLatLng);
  map.panTo(playerLatLng);
  updateVisibleCells();
}

document.addEventListener("keydown", (e) => {
  switch (e.key.toLowerCase()) {
    case "w":
      movePlayer(TILE_DEGREES, 0);
      break;
    case "s":
      movePlayer(-TILE_DEGREES, 0);
      break;
    case "a":
      movePlayer(0, -TILE_DEGREES);
      break;
    case "d":
      movePlayer(0, TILE_DEGREES);
      break;
  }
});

// Initial render
updateVisibleCells();
