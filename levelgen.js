import levels from "./levels.json" with { type: "json" };
import { interactable, setTile } from "./util.js";

/** @typedef {{ playerPos: [number, number], inventory: boolean, terrain: number[][], rail: [number, number, number][], bomb: [number, number, number][], chests: Object.<string, (number | null)[] | null> }} Level */

export const levelCount = levels.length;

/**
 * @param {number} idx
 * @param {SVGImageElement[][]} terrain
 * @param {SVGImageElement[][]} rails
 * @param {SVGImageElement[][]} bombs
 * @param {boolean[][]} disallowed
 * @param {number[][]} bombGrid
 */
export async function loadLevel(idx, terrain, rails, bombs, disallowed, bombGrid) {
  /** @type {Level} */
  const levelData = await import(`./assets/levels/${levels[idx]}.json`, { with: { type: "json" } }).then((module) => module.default);
  for (let i = 0; i < terrain.length; i++) {
    for (let j = 0; j < terrain[i].length; j++) {
      const tile = levelData.terrain[i]?.[j] ?? 0;
      setTile(terrain[i][j], tile);
      if (interactable(tile)) {
        terrain[i][j].classList.add("interactable")
      } else {
        terrain[i][j].classList.remove("interactable")
      }
      setTile(rails[i][j], 0);
      setTile(bombs[i][j], 0);
      disallowed[i][j] = false;
      bombGrid[i][j] = 0;
    }
  }
  for (const railTile of levelData.rail) {
    const [x, y, tileIdx] = railTile;
    setTile(rails[y][x], tileIdx);
  }
  disallowed[levelData.rail[0][1]][levelData.rail[0][0]] = true;
  for (const bombTile of levelData.bomb) {
    const [x, y, tileIdx] = bombTile;
    setTile(bombs[y][x], tileIdx);
    bombGrid[y][x] = tileIdx;
  }
  return levelData;
}
