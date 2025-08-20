import { gridSize, cellSize, dingVolume } from "./config.js";
import { bombsDetonated, bombsShot, debugToolsUsed, restarts, shotsFired } from "./game.js";
import { setGameState } from "./index.js";
import { startTime } from "./intro.js";
import { formatTime, playAudio, setTile } from "./util.js";

const endContainer = document.getElementById("end");
const endTerrain = document.getElementById("end-terrain");
const endOverlay = document.getElementById("end-overlay");
const title = document.getElementById("end-title");
const thanks = document.getElementById("end-thanks");
const debug = document.getElementById("end-debug");
const endTime = document.getElementById("end-time");
const endShots = document.getElementById("end-shots");
const endBombs = document.getElementById("end-bombs");
const endChain = document.getElementById("end-chain");
const endRestarts = document.getElementById("end-restarts");
const lines = document.querySelectorAll(".end-line")
let currentLine = -1;

endContainer.setAttribute("viewBox", `0 0 ${gridSize[0] * cellSize} ${gridSize[1] * cellSize}`);
for (let j = 0; j < gridSize[0]; j++) {
  const tile = document.createElementNS("http://www.w3.org/2000/svg", "image");
  tile.setAttribute("x", j * cellSize);
  tile.setAttribute("y", 5 * cellSize);
  tile.setAttribute("width", cellSize);
  tile.setAttribute("height", cellSize);
  setTile(tile, 9);
  endTerrain.append(tile);
}

export function end() {
  setGameState("end");
  const time = Date.now() - startTime;
  endTime.textContent = formatTime(time);
  endShots.textContent = shotsFired;
  endBombs.textContent = bombsDetonated;
  endChain.textContent = bombsDetonated - bombsShot;
  endRestarts.textContent = restarts;
  endContainer.classList.remove("disabled");
  setTimeout(endScreen, 1200);
}

function endScreen() {
  endOverlay.classList.remove("disabled");
  setTimeout(() => {
    playAudio("ding1", dingVolume);
    title.classList.remove("disabled");
    setTimeout(revealLine, 800)
  }, 500)
}

function revealLine() {
  if (++currentLine >= lines.length) {
    setTimeout(() => {
      thanks.classList.remove("disabled");
      if (debugToolsUsed) {
        debug.classList.remove("disabled");
      }
    }, 800);
    return;
  }
  playAudio("ding2");
  lines[currentLine].classList.remove("disabled");
  setTimeout(revealLine, 300);
}
