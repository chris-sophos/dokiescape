import { gridSize, cellSize, tripVolume, introStepVolume } from "./config.js";
import { start } from "./game.js";
import { playAudio, playAudioRandom, setTile } from "./util.js";

const groundLevel = 3;
const scrollSpeed = 2.8;
const holeOffset = 0;
const dadSize = [35, 35];
const dadOffset = [10, 20];
const dadPivotOffset = [5, 5];

const intro = document.getElementById("intro");
const container = document.getElementById("intro-grid");
const player = document.getElementById("intro-player");
const playerPos = [player.getAttribute("x"), player.getAttribute("y")].map(Number);
const playerSize = [player.getAttribute("width"), player.getAttribute("height")].map(Number);
const playerAnim = player.querySelector("animate");
const fallAcceleration = 4;
const rotationTime = 1;
const rotationMax = 135;
const dadRotationMax = 180;
/** @type {SVGImageElement | null} */
let dad = null;
let dadPos = [0, 0];

container.setAttribute("width", gridSize[0] * cellSize);
container.setAttribute("height", gridSize[1] * cellSize);
intro.classList.remove("disabled");
const grid = Array.from(
  { length: gridSize[1] },
  (_, i) => Array.from(
    { length: gridSize[0] + 1 },
    () =>
      i === groundLevel ? 9 :
      i > groundLevel ? 8 :
      0
  )
);
const terrain = Array.from(
  { length: gridSize[1] },
  (_, i) => Array.from(
    { length: gridSize[0] + 1 },
    (_, j) => {
      const tile = document.createElementNS("http://www.w3.org/2000/svg", "image");
      tile.setAttribute("x", j * cellSize);
      tile.setAttribute("y", i * cellSize);
      tile.setAttribute("width", cellSize);
      tile.setAttribute("height", cellSize);
      setTile(tile, grid[i][j]);
      container.append(tile);
      return tile;
    }
  )
);
export let startTime = 0;

let startPhase = 0;
let gapCol = -1;
const stepInterval = 0.4;
let stepTimer = stepInterval;
let rotation = 0;
let dadRotation = 0;
let downVel = 0;

/** @param {number} deltaTime */
export function update(deltaTime) {
  if (startPhase < 6) {
    stepTimer += deltaTime;
    if (stepTimer >= stepInterval) {
      playAudioRandom("intro_step", 6, introStepVolume);
      stepTimer %= stepInterval;
    }
    for (let i = 0; i < gridSize[1]; i++) {
      for (let j = 0; j <= gridSize[0]; j++) {
        const cell = terrain[i][j];
        let x = Number(cell.getAttribute("x"));
        x -= scrollSpeed * cellSize * deltaTime;
        if (x <= -cellSize) {
          x += (gridSize[0] + 1) * cellSize
          if (startPhase === 1) {
            if (i === groundLevel - 1) {
              cell.setAttribute("href", "assets/intro/dad.png");
              cell.setAttribute("width", dadSize[0]);
              cell.setAttribute("height", dadSize[1]);
              let y = Number(cell.getAttribute("y"));
              x += dadOffset[0];
              y += dadOffset[1];
              cell.setAttribute("y", y);
              dad = cell;
              startPhase++;
            }
          }
          if (startPhase === 3 || startPhase === 4) {
            gapCol = j;
            if (i >= groundLevel) {
              grid[i][j] = 0;
              setTile(cell, 0);
            }
            startPhase = 4;
          }
        }
        cell.setAttribute("x", x);
        if (startPhase === 5 && j === gapCol && x <= playerPos[0] + playerSize[0] + holeOffset) {
          playAudio("trip", tripVolume);
          startPhase++;
        }
      }
    }
    if (startPhase === 2 || startPhase == 4) startPhase++;
  } else if (startPhase === 6) {
    playerAnim.remove();
    player.setAttribute("href", "assets/intro/fall.png");
    dadPos = [dad.getAttribute("x"), dad.getAttribute("y")].map(Number);
    startPhase++;
  } else if (startPhase === 7) {
    if (playerPos[0] + playerSize[0] / 2 < Number(terrain[0][gapCol].getAttribute("x")) + cellSize / 2) {
      playerPos[0] += scrollSpeed * cellSize * deltaTime;
      player.setAttribute("x", playerPos[0]);
    }
    if (rotation < rotationMax) {
      rotation += rotationMax / rotationTime * deltaTime;
      rotation = Math.min(rotation, rotationMax);
    }
    player.setAttribute("transform", `rotate(${rotation}, ${playerPos[0] + playerSize[0] / 2}, ${playerPos[1] + playerSize[1] / 2})`);
    if (dadRotation < dadRotationMax) {
      dadRotation += dadRotationMax / rotationTime * deltaTime;
      dadRotation = Math.min(dadRotation, dadRotationMax);
    }
    dad.setAttribute("transform", `rotate(${dadRotation}, ${dadPos[0] + dadSize[0] + dadPivotOffset[0]}, ${dadPos[1] + dadSize[1] + dadPivotOffset[1]})`);
    downVel += fallAcceleration * deltaTime;
    playerPos[1] += downVel * cellSize * deltaTime;
    player.setAttribute("y", playerPos[1]);
    dadPos[1] += downVel * cellSize * deltaTime;
    dad.setAttribute("y", dadPos[1]);
    if (playerPos[1] > gridSize[1] * cellSize) startPhase++;
  } else {
    intro.classList.add("disabled");
    startTime = Date.now();
    start();
  }
}

const startButton = document.getElementById("start");
startButton.addEventListener("click", () => {
  startButton.classList.add("disabled");
  startPhase = 1;
});
