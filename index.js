import { update as menuUpdate } from "./intro.js";
import { update as gameUpdate } from "./game.js";

/** @typedef {"intro" | "game" | "end"} GameState */

/** @type {GameState} */
export let state = "intro";
/** @param {GameState} gameState */
export function setGameState(gameState) {
  state = gameState;
}

let prevTime;
function loop(time) {
  const deltaTime = (time - prevTime) / 1000;
  switch (state) {
    case "game":
      gameUpdate(deltaTime);
      break;
    case "intro":
      menuUpdate(deltaTime);
      break;
  }
  prevTime = time;
  requestAnimationFrame(loop);
}

requestAnimationFrame((time) => {
  prevTime = time;
  requestAnimationFrame(loop);
});
