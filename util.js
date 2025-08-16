import tiles from "./tiles.json" with { type: "json" };

/**
 * @param {[number, number]} pos
 * @param {number} cellSize
 */
export const posToCell = (pos, cellSize) => [Math.trunc(pos[0] / cellSize), Math.trunc(pos[1] / cellSize)];

/**
 * @param {number} tile
 * @param {boolean} allowTrapdoor
*/
export const interactable = (tile, allowTrapdoor = true) => (tile === 5 && allowTrapdoor) || tile === 6 || tile === 7;

/** @param {number} tile */
export const destructable = (tile) => tile === 2 || tile === 4;

/** @param {string} tileName */
export const tileAsset = (tileName) => `assets/tiles/${tileName}`;

/**
 * @param {SVGImageElement} tile
 * @param {number} tileIdx
 */
export const setTile = (tile, tileIdx) => tile.setAttribute("href", tileAsset(tiles[tileIdx]));

// modified from https://stackoverflow.com/a/24392281
// (a,b)->(c,d) intersects (p,q)->(r,s) ?
export function intersects([a,b],[c,d],[p,q],[r,s]) {
  const det = (c - a) * (s - q) - (r - p) * (d - b);
  if (det === 0) {
    return false;
  } else {
    const lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
    const gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
  }
};

/** @param {number} time */
export function formatTime(time) {
  const ms = time % 1000;
  time = Math.trunc(time / 1000);
  const s = time % 60;
  time = Math.trunc(time / 60);
  const m = time % 60;
  time = Math.trunc(time / 60);
  const h = time;
  return `${h ? `${h}:` : ""}${m.toString().padStart(h ? 2 : 1, 0)}:${s.toString().padStart(2, 0)}`
}

/**
 * @param {string} name
 * @param {number} volume
 */
export function playAudio(name, volume = 1) {
  const path = `assets/audio/${name}.ogg`;
  const audio = new Audio(path);
  audio.volume = volume;
  audio.autoplay = true;
}

/**
 * @param {string} name
 * @param {number} count
 * @param {number} volume
*/
export function playAudioRandom(name, count, volume = 1) {
  playAudio(name + (Math.floor(Math.random() * count) + 1), volume)
}
