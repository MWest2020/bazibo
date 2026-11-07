// The games in the app, in the order of the tiles on the home screen. A game that is not ready
// yet shows as a "coming soon" tile. Adding a game: web/games/<id>/ with meta.js (id, titleKey,
// free tier), strings.js and a controller, then an entry here and a tile in index.html.
import { meta as bubbels } from '../games/bubbels/meta.js';
import { meta as dogudoku } from '../games/dogudoku/meta.js';
import { meta as picturedoku } from '../games/picturedoku/meta.js';

export const GAMES = [
  { ...bubbels, status: 'ready' },
  { ...dogudoku, status: 'ready' },
  { ...picturedoku, status: 'ready' },
];
