import { gridSize, cellSize, stepVolume, trapdoorVolume, chestVolume, pickupVolume, explosionVolume, minecartVolume, placeVolume, shootVolume } from "./config.js";
import { end } from "./end.js";
import { setGameState, state } from "./index.js";
import { levelCount, loadLevel } from "./levelgen.js";
import { destructable, interactable, intersects, playAudio, playAudioRandom, posToCell, setTile } from "./util.js";

const container = document.getElementById("game");
const gridContainer = document.getElementById("terrain");
const railContainer = document.getElementById("rail");
const bombContainer = document.getElementById("bomb");
const previewContainer = document.getElementById("preview");
const explosionContainer = document.getElementById("explosion");
const player = document.getElementById("player");
const playerSize = [player.getAttribute("width"), player.getAttribute("height")].map(Number);
const minecart = document.getElementById("minecart");
const minecartSize = [minecart.getAttribute("width"), minecart.getAttribute("height")].map(Number);

export let shotsFired = 0;
export let bombsDetonated = 0;
export let bombsShot = 0;
export let restarts = 0;
export let debugToolsUsed = false;

container.setAttribute("viewBox", `0 0 ${gridSize[0] * cellSize} ${gridSize[1] * cellSize}`);
const terrain = Array.from(
  { length: gridSize[1] },
  (_, i) => Array.from(
    { length: gridSize[0] },
    (_, j) => {
      const tile = document.createElementNS("http://www.w3.org/2000/svg", "image");
      tile.classList.add("tile");
      tile.setAttribute("x", j * cellSize);
      tile.setAttribute("y", i * cellSize);
      tile.setAttribute("width", cellSize);
      tile.setAttribute("height", cellSize);
      gridContainer.append(tile);
      return tile;
    }
  )
);
const rails = Array.from(
  { length: gridSize[1] },
  (_, i) => Array.from(
    { length: gridSize[0] },
    (_, j) => {
      const tile = document.createElementNS("http://www.w3.org/2000/svg", "image");
      tile.setAttribute("x", j * cellSize);
      tile.setAttribute("y", i * cellSize);
      tile.setAttribute("width", cellSize);
      tile.setAttribute("height", cellSize);
      railContainer.append(tile);
      return tile;
    }
  )
);
const bombs = Array.from(
  { length: gridSize[1] },
  (_, i) => Array.from(
    { length: gridSize[0] },
    (_, j) => {
      const tile = document.createElementNS("http://www.w3.org/2000/svg", "image");
      tile.setAttribute("x", j * cellSize);
      tile.setAttribute("y", i * cellSize);
      tile.setAttribute("width", cellSize);
      tile.setAttribute("height", cellSize);
      bombContainer.append(tile);
      return tile;
    }
  )
);
const disallowed = Array.from(
  { length: gridSize[1] },
  () => Array.from({ length: gridSize[0] }, () => false)
);
const bombGrid = Array.from(
  { length: gridSize[1] },
  () => Array.from({ length: gridSize[0] }, () => 0)
);
const bombPreview = Array.from(
  { length: gridSize[1] },
  (_, i) => Array.from(
    { length: gridSize[0] },
    (_, j) => {
      const tile = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      tile.setAttribute("x", j * cellSize);
      tile.setAttribute("y", i * cellSize);
      tile.setAttribute("width", cellSize);
      tile.setAttribute("height", cellSize);
      tile.setAttribute("fill-opacity", 0);
      previewContainer.append(tile);
      return tile;
    }
  )
);
const preview = Array.from(
  { length: gridSize[1] },
  () => Array.from({ length: gridSize[0] }, () => 0)
);

/** @type {number[][] | null} */
let grid = null;
/** @type {[number, number, number][] | null} */
let railPath = null;
/** @type {Object.<string, (number | null)[] | null> | null} */
let chests = null;
let cursorInBounds = false;
let cursorValid = false;

const highlight = document.getElementById("highlight");
highlight.setAttribute("width", cellSize);
highlight.setAttribute("height", cellSize);
let cursorPos = [0, 0];
let cursorCell = [0, 0];
window.addEventListener("mousemove", (evt) => {
  const CTM = container.getScreenCTM();
  cursorPos = [
    (evt.clientX - CTM.e) / CTM.a,
    (evt.clientY - CTM.f) / CTM.d
  ];
  if (cursorPos[0] < 0 || cursorPos[0] >= gridSize[0] * cellSize || cursorPos[1] < 0 || cursorPos[1] >= gridSize[1] * cellSize) {
    cursorInBounds = false;
    cursorValid = false;
    highlight.classList.add("disabled")
    return;
  }
  cursorInBounds = true;
  highlight.classList.remove("disabled");
  cursorCell = posToCell(cursorPos, cellSize);
  if (state === "game") {
    updateHighlight();
    updatePreview();
  }
});

const playerSpeed = 6;
const playerRange = 1.8;
let playerPos = [0, 0];
const stepInterval = 0.4;
let stepTimer = 0;

let ingame = false;
let winCond = false;
let winning = false;
let canContinue = false;
let currentLevel = 0;
const input = new Set();

document.addEventListener("keydown", (evt) => input.add(evt.code));
document.addEventListener("keyup", (evt) => input.delete(evt.code));
container.addEventListener("click", handleClick);
container.addEventListener("contextmenu", handleClick);

/** @param {number} deltaTime */
export function update(deltaTime) {
  if (ingame) {
    if (input.has("KeyR")) {
      restarts++;
      start();
      return;
    }
    if (input.has("BracketLeft")) {
      debugToolsUsed = true;
      currentLevel--;
      start();
    }
    if (input.has("BracketRight")) {
      debugToolsUsed = true;
      nextLevel();
    }
    playerMotion(deltaTime);
    stepPebbles(deltaTime);
    updateHighlight();
    updatePreview();
    if (winning) {
      stepMinecart(deltaTime);
    }
  }
}

/** @param {number} deltaTime */
function playerMotion(deltaTime) {
  // get input
  const motion = [0, 0];
  if (input.has("KeyD")) motion[0] += 1;
  if (input.has("KeyA")) motion[0] -= 1;
  if (input.has("KeyS")) motion[1] += 1;
  if (input.has("KeyW")) motion[1] -= 1;
  
  // facing direction
  if (motion[0] > 0) setFacing("right");
  else if (motion[0] < 0) setFacing("left");
  else if (motion[1] > 0) setFacing("front");
  else if (motion[1] < 0) setFacing("back");

  const magnitude = Math.hypot(...motion);
  if (magnitude !== 0) {
    // step sounds
    stepTimer += deltaTime;
    if (stepTimer >= stepInterval) {
      playAudioRandom("step", 4, stepVolume);
      stepTimer %= stepInterval;
    }

    // normalize direction
    motion[0] /= magnitude;
    motion[1] /= magnitude;
    
    // apply motion & collision
    const playerCellMin = posToCell(playerPos, cellSize);
    const playerCellMax = posToCell([playerPos[0] + playerSize[0] - 1, playerPos[1] + playerSize[1] - 1], cellSize);
    
    playerPos[0] += motion[0] * playerSpeed * cellSize * deltaTime;
    playerPos[1] += motion[1] * playerSpeed * cellSize * deltaTime;
    
    if (motion[0] < 0 && (collide(grid[playerCellMin[1]][playerCellMin[0] - 1]) || collide(grid[playerCellMax[1]][playerCellMin[0] - 1]))) {
      playerPos[0] = Math.max(playerPos[0], playerCellMin[0] * cellSize);
    } else if (motion[0] > 0 && (collide(grid[playerCellMin[1]][playerCellMax[0] + 1]) || collide(grid[playerCellMax[1]][playerCellMax[0] + 1]))) {
      playerPos[0] = Math.min(playerPos[0], (playerCellMax[0] + 1) * cellSize - playerSize[0]);
    }
    if (motion[1] < 0 && (collide(grid[playerCellMin[1] - 1][playerCellMin[0]]) || collide(grid[playerCellMin[1] - 1][playerCellMax[0]]))) {
      playerPos[1] = Math.max(playerPos[1], playerCellMin[1] * cellSize);
    } else if (motion[1] > 0 && (collide(grid[playerCellMax[1] + 1][playerCellMin[0]]) || collide(grid[playerCellMax[1] + 1][playerCellMax[0]]))) {
      playerPos[1] = Math.min(playerPos[1], (playerCellMax[1] + 1) * cellSize - playerSize[1]);
    }
  } else {
    stepTimer = stepInterval;
  }
  // apply position
  player.setAttribute("x", playerPos[0]);
  player.setAttribute("y", playerPos[1]);
}

function updateHighlight() {
  if (!cursorInBounds || !grid) {
    cursorValid = false;
    return;
  }
  highlight.setAttribute("x", cursorCell[0] * cellSize);
  highlight.setAttribute("y", cursorCell[1] * cellSize);
  if (disallowed[cursorCell[1]][cursorCell[0]] || (grid[cursorCell[1]][cursorCell[0]] === 5 && !canContinue)) {
    cursorValid = false;
    highlight.classList.add("disallowed");
    return;
  }
  highlight.classList.remove("disallowed");
  if (((cursorCell[0] * cellSize + cellSize / 2) - (playerPos[0] + playerSize[0] / 2))**2 + ((cursorCell[1] * cellSize + cellSize / 2) - (playerPos[1] + playerSize[1] / 2))**2 > (playerRange*cellSize)**2) {
    cursorValid = false;
    highlight.classList.remove("inrange");
    return;
  }
  cursorValid = true;
  highlight.classList.add("inrange");
  const tile = grid[cursorCell[1]][cursorCell[0]];
  if (interactable(tile, canContinue) || winCond && cursorCell[0] === railPath[0][0] && cursorCell[1] === railPath[0][1]) {
    highlight.classList.add("interactable");
  } else {
    highlight.classList.remove("interactable");
  }
}

function updatePreview() {
  for (let i = 0; i < gridSize[1]; i++) {
    for (let j = 0; j < gridSize[0]; j++) {
      preview[i][j] = 0;
    }
  }
  if (cursorInBounds) {
    if (bombGrid[cursorCell[1]][cursorCell[0]]) {
      // apply hover preview
      preview[cursorCell[1]][cursorCell[0]] += 0.3;
      for (const cell of bombArea(cursorCell, bombGrid[cursorCell[1]][cursorCell[0]])) {
        preview[cell[1]][cell[0]] += 0.3;
      }
    }
    if (cursorValid && selected > 0 && inventory[selected - 1]) {
      // apply inventory preview
      preview[cursorCell[1]][cursorCell[0]] += 0.15;
      for (const cell of bombArea(cursorCell, selected + 15)) {
        preview[cell[1]][cell[0]] += 0.15;
      }
    }
  }
  for (let i = 0; i < gridSize[1]; i++) {
    for (let j = 0; j < gridSize[0]; j++) {
      bombPreview[i][j].setAttribute("fill-opacity", preview[i][j]);
    }
  }
}

/** @param {MouseEvent} evt  */
function handleClick(evt) {
  evt.preventDefault();
  if (cursorInBounds) {
    if (evt.button === 0) {
      const tile = grid[cursorCell[1]][cursorCell[0]];
      if (cursorValid && interactable(tile, canContinue)) {
        switch (tile) {
          case 5:
            playAudio("trapdoor", trapdoorVolume);
            nextLevel();
            break;
          case 6:
            playAudio("chest", chestVolume);
            playAudioRandom("pickup", 2, pickupVolume);
            const chest = chests[`${cursorCell[0]},${cursorCell[1]}`];
            if (inventory) {
              for (let i = 0; i < chest.length; i++) {
                if (i >= inventory.length) inventory.push(null);
                if (chest[i] !== null) {
                  inventory[i] ??= 0;
                  inventory[i] += chest[i];
                }
              }
            } else {
              inventory = [...chest];
            }
            updateInventory();
            setTile(terrain[cursorCell[1]][cursorCell[0]], 7);
            disallowed[cursorCell[1]][cursorCell[0]] = true;
            break;
        }
      } else if (cursorValid && winCond && cursorCell[0] === railPath[0][0] && cursorCell[1] === railPath[0][1]) {
        playAudio("minecart", minecartVolume);
        winning = true;
        disallowed[railPath[0][1]][railPath[0][0]] = true;
      } else if (cursorValid && selected > 0 && inventory[selected - 1]) {
        if (!grid[cursorCell[1]][cursorCell[0]]) {
          const currBomb = bombGrid[cursorCell[1]][cursorCell[0]];
          if (currBomb && currBomb !== selected + 15 && inventory) {
            playAudioRandom("pickup", 2, pickupVolume);
            inventory[currBomb - 16] ??= 0
            inventory[currBomb - 16]++
            bombGrid[cursorCell[1]][cursorCell[0]] = 0;
            setTile(bombs[cursorCell[1]][cursorCell[0]], 0);
            updateInventory();
            updatePreview();
          }
          if (!bombGrid[cursorCell[1]][cursorCell[0]]) {
            playAudio("place", placeVolume);
            bombGrid[cursorCell[1]][cursorCell[0]] = selected + 15;
            setTile(bombs[cursorCell[1]][cursorCell[0]], selected + 15);
            inventory[selected - 1]--;
            updateInventory();
            updatePreview();
          }
        }
      } else if (selected === 0) {
        shootPebble();
      }
    } else if (evt.button === 2) {
      if (cursorValid) {
        const bomb = bombGrid[cursorCell[1]][cursorCell[0]];
        if (bomb && inventory) {
          playAudioRandom("pickup", 2, pickupVolume);
          inventory[bomb - 16] ??= 0
          inventory[bomb - 16]++
          bombGrid[cursorCell[1]][cursorCell[0]] = 0;
          setTile(bombs[cursorCell[1]][cursorCell[0]], 0);
          updateInventory();
        }
      }
    }
    updateHighlight();
  }
}

//#region pebble

/** @type {[SVGImageElement, [number, number], [number, number]][]>} */
const pebbles = [];
const pebbleSize = 50;
const pebbleSpeed = 14;

function shootPebble() {
  playAudioRandom("pebble", 6, shootVolume);
  shotsFired++;
  const pos = [playerPos[0] + playerSize[0] / 2, playerPos[1] + playerSize[1] / 2];
  const dir = [cursorPos[0] - pos[0], cursorPos[1] - pos[1]]
  const magnitude = Math.hypot(...dir);
  if (magnitude !== 0) {
    dir[0] /= magnitude;
    dir[1] /= magnitude;
  } else {
    dir[0] = 1;
    dir[1] = 0;
  }
  const pebble = document.createElementNS("http://www.w3.org/2000/svg", "use");
  pebble.setAttribute("href", "#pebble");
  pebble.setAttribute("x", pos[0] - pebbleSize / 2);
  pebble.setAttribute("y", pos[1] - pebbleSize / 2);
  container.append(pebble);
  pebbles.push([pebble, pos, dir]);
}

/** @param {number} deltaTime */
function stepPebbles(deltaTime) {
  for (let i = 0; i < pebbles.length; i++) {
    const [pebble, pos, dir] = pebbles[i];
    const prevPos = [...pos];
    pos[0] += dir[0] * pebbleSpeed * cellSize * deltaTime;
    pos[1] += dir[1] * pebbleSpeed * cellSize * deltaTime;
    pebble.setAttribute("x", pos[0] - pebbleSize / 2);
    pebble.setAttribute("y", pos[1] - pebbleSize / 2);
    const pebbleCell = posToCell(pos, cellSize);
    if (bombHit(pebbleCell, prevPos, pos)) {
      pebble.remove();
      pebbles.splice(i--, 1);
      if (bombGrid[pebbleCell[1]][pebbleCell[0]] === 16) {
        bombsShot++;
        handleDetonation([pebbleCell]);
      }
    } else if (collide(grid[pebbleCell[1]][pebbleCell[0]])) {
      pebble.remove();
      pebbles.splice(i--, 1);
    }
  }
}

/**
 * @param {[number, number]} cell
 * @param {[number, number]} p1
 * @param {[number, number]} p2
 */
function bombHit(cell, p1, p2) {
  const bomb = bombGrid[cell[1]][cell[0]];
  if (!bomb) return false;
  const bombSize = (
    bomb === 16 ? 25 : // cherry bomb
    bomb === 17 ? 40 : // bomb
    bomb === 18 ? 45 : // mega bomb
    0
  );
  const center = [cell[0] * cellSize + cellSize / 2, cell[1] * cellSize + cellSize / 2];
  return (
       intersects(p1, p2, [center[0] - bombSize / 2, center[1] - bombSize / 2], [center[0] + bombSize / 2, center[1] + bombSize / 2])
    || intersects(p1, p2, [center[0] + bombSize / 2, center[1] - bombSize / 2], [center[0] - bombSize / 2, center[1] + bombSize / 2])
  );
}

//#endregion

//#region bomb

const explosionEffect = document.getElementById("explosion-effect");

/** @param {[number, number][]} cells */
function handleDetonation(cells) {
  const next = [];
  const hit = [];
  for (const cell of cells) {
    const bomb = bombGrid[cell[1]][cell[0]];
    if (bomb) {
      playAudioRandom("explode", 4, explosionVolume);
      bombsDetonated++;
      hit.push(...bombArea(cell, bomb));
      bombGrid[cell[1]][cell[0]] = 0;
      setTile(bombs[cell[1]][cell[0]], 0);
    }
  }
  for (const cell of hit) {
    if (destructable(grid[cell[1]][cell[0]])) {
      grid[cell[1]][cell[0]] = 0;
      setTile(terrain[cell[1]][cell[0]], 0);
    }
    if (bombGrid[cell[1]][cell[0]]) {
      next.push(cell);
    }
    /** @type {Element} */
    const effect = explosionEffect.cloneNode(true);
    effect.setAttribute("x", cell[0] * cellSize);
    effect.setAttribute("y", cell[1] * cellSize);
    explosionContainer.append(effect);
    effect.querySelector("animate").addEventListener("repeatEvent", () => {
      effect.remove();
    });
  }
  checkWin();
  if (next.length) {
    setTimeout(handleDetonation, 100, next);
  }
}

/**
 * @param {[number, number]} cell
 * @param {number} bomb
 */
function bombArea(cell, bomb) {
  const hit = [];
  switch (bomb) {
    case 16: // cherry bomb
      hit.push([cell[0] + 1, cell[1]]);
      hit.push([cell[0] - 1, cell[1]]);
      hit.push([cell[0], cell[1] + 1]);
      hit.push([cell[0], cell[1] - 1]);
      break;
    case 17: // bomb
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          hit.push([cell[0] + dx, cell[1] + dy]);
        }
      }
      break;
    case 18: // mega bomb
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (!dx && !dy) continue;
          if (Math.abs(dx) + Math.abs(dy) === 4) continue;
          hit.push([cell[0] + dx, cell[1] + dy]);
        }
      }
      break;
  }
  return hit.filter((hitCell) => hitCell[0] >= 0 && hitCell[0] < gridSize[0] && hitCell[1] >= 0 && hitCell[1] < gridSize[1]);
}

//#endregion

function checkWin() {
  if (!winCond && railPath.every(([x, y, tile]) => !tile || grid[y][x] === 0)) {
    winCond = true;
    disallowed[railPath[0][1]][railPath[0][0]] = false;
  }
}

const minecartSpeed = 4.5;
let minecartRail = 0;
/** @type {[number, number] | null} */
let minecartPos = null;

/** @param {number} deltaTime */
function stepMinecart(deltaTime) {
  let distance = minecartSpeed * cellSize * deltaTime;
  while (distance) {
    const nextRail = railPath[minecartRail + 1];
    const nextPos = [nextRail[0] * cellSize + cellSize / 2, nextRail[1] * cellSize + cellSize / 2];
    const dist = Math.abs(nextPos[0] - minecartPos[0]) + Math.abs(nextPos[1] - minecartPos[1]);
    const dir = [nextPos[0] - minecartPos[0], nextPos[1] - minecartPos[1]];
    const magnitude = Math.hypot(...dir);
    if (magnitude !== 0) {
      dir[0] /= magnitude;
      dir[1] /= magnitude;
    }
    if (distance >= dist) {
      distance -= dist;
      minecartRail++;
      minecartPos = [
        railPath[minecartRail][0] * cellSize + cellSize / 2,
        railPath[minecartRail][1] * cellSize + cellSize / 2
      ];
      if (minecartRail === railPath.length - 1) {
        minecart.classList.add("disabled");
        winning = false;
        canContinue = true;
        break;
      }
    } else {
      minecartPos[0] += dir[0] * distance;
      minecartPos[1] += dir[1] * distance;
      distance = 0;
    }
  }
  minecart.setAttribute("x", minecartPos[0] - minecartSize[0] / 2);
  minecart.setAttribute("y", minecartPos[1] - minecartSize[1] / 2);
}

//#region inventory

const inventoryContainer = document.getElementById("inventory");
const inventorySlots = [...inventoryContainer.children].map((slot, i) => ({
  container: slot,
  slot: slot.querySelector(".invslot"),
  count: i ? slot.lastElementChild : null
}));

for (let i = 0; i < inventorySlots.length; i++) {
  const idx = i;
  const { container } = inventorySlots[idx];
  container.addEventListener("click", () => {
    if (inventory && (idx === 0 || inventory[idx - 1] != null)) {
      selected = idx;
      updateInventory();
    }
  })
}

/** @type {(number | null)[] | null} */
let inventory = null;
/** @type {number} */
let selected = -1;

function updateInventory() {
  if (!inventory) {
    inventoryContainer.classList.add("disabled");
    return;
  }
  if (selected === -1) selected = 0;
  inventoryContainer.classList.remove("disabled");
  for (const { slot } of inventorySlots) {
    slot.classList.remove("selected");
  }
  inventorySlots[selected].slot.classList.add("selected");
  for (let i = 1; i < 4; i++) {
    const count = inventory[i - 1];
    if (count == null) {
      inventorySlots[i].container.classList.add("disabled");
      continue;
    }
    inventorySlots[i].container.classList.remove("disabled");
    inventorySlots[i].count.textContent = `x${count}`
  }
}

//#endregion

export function start() {
  setGameState("game");
  winCond = false;
  winning = false;
  canContinue = false;
  input.clear();
  loadLevel(currentLevel, terrain, rails, bombs, disallowed, bombGrid, cellSize, playerSize).then((levelData) => {
    setFacing("front");
    playerPos = [
      levelData.playerPos[0] * cellSize + (cellSize - playerSize[0]) / 2,
      levelData.playerPos[1] * cellSize + (cellSize - playerSize[1]) / 2,
    ];
    grid = structuredClone(levelData.terrain);
    railPath = levelData.rail;
    minecartRail = 0;
    minecartPos = [railPath[0][0] * cellSize + cellSize / 2, railPath[0][1] * cellSize + cellSize / 2];
    minecart.classList.remove("disabled");
    minecart.setAttribute("x", railPath[0][0] * cellSize);
    minecart.setAttribute("y", railPath[0][1] * cellSize);
    inventory = levelData.inventory ? [] : null;
    updateInventory();
    chests = levelData.chests;
    container.classList.remove("disabled");
    ingame = true;
    checkWin();
  });
}

function nextLevel() {
  if (++currentLevel < levelCount) {
    start();
  } else {
    container.classList.add("disabled");
    inventoryContainer.classList.add("disabled");
    end();
  }
}

/** @param {string} dir */
function setFacing(dir) {
  player.setAttribute("href", `assets/player/${dir}.png`);
}

/** @param {number} tile */
function collide(tile) {
  return tile && !interactable(tile);
}
