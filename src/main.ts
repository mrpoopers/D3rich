// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";

import luck from "./_luck.ts";

// UI setup
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// Gameplay settings
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 12;

// Player state
let heldToken: number | null = null;

// Create the map
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Tile background
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  })
  .addTo(map);

// Player marker
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("You");
playerMarker.addTo(map);

statusPanelDiv.innerHTML = "Holding: nothing";

// Helper: convert (i, j) → bounding rectangle
function cellBounds(i: number, j: number) {
  const o = CLASSROOM_LATLNG;
  return leaflet.latLngBounds(
    [
      [o.lat + i * TILE_DEGREES, o.lng + j * TILE_DEGREES],
      [o.lat + (i + 1) * TILE_DEGREES, o.lng + (j + 1) * TILE_DEGREES],
    ],
  );
}

// Spawn one grid cell
function spawnCell(i: number, j: number) {
  // Each cell has either 0 or 1 token
  let tokenValue = luck([i, j, "spawn"].toString()) < 0.5 ? 1 : 0;

  // Draw rectangle
  const rect = leaflet.rectangle(cellBounds(i, j), {
    color: tokenValue > 0 ? "gold" : "gray",
    weight: 1,
  }).addTo(map);

  // Popup interaction
  rect.bindPopup(() => {
    const div = document.createElement("div");
    div.innerHTML = `
      <div>Cell ${i},${j}</div>
      <div>Contains token: <b>${tokenValue}</b></div>
      <div>Holding: <b>${heldToken ?? "nothing"}</b></div>
      <button id="interact">Interact</button>
    `;

    div.querySelector("#interact")!.addEventListener("click", () => {
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
      } // Nothing happens
      else {
        statusPanelDiv.innerHTML = "Nothing to do here.";
      }
    });

    return div;
  });
}

// Spawn full grid
const CELL_SPAWN_PROBABILITY = 0.4;

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    // Use luck to decide if this cell exists
    const roll = luck([i, j, "cellExists"].toString());

    if (roll < CELL_SPAWN_PROBABILITY) {
      spawnCell(i, j);
    }
  }
}
