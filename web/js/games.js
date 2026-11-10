// The games in the app, in the order of the tiles on the home screen. A game that is not ready
// yet shows as a "coming soon" tile. Adding a game: web/games/<id>/ with meta.js (id, titleKey,
// free tier), strings.js and a controller, then an entry here and a tile in index.html.
import { meta as bubbels } from '../games/bubbels/meta.js';
import { meta as dogudoku } from '../games/dogudoku/meta.js';
import { meta as picturedoku } from '../games/picturedoku/meta.js';
import { meta as vier } from '../games/vier/meta.js';
import { meta as slang } from '../games/slang/meta.js';
import { meta as kleuren } from '../games/kleuren/meta.js';
import { meta as klok } from '../games/klok/meta.js';
import { meta as letters } from '../games/letters/meta.js';

export const GAMES = [
  { ...bubbels, status: 'ready' },
  { ...dogudoku, status: 'ready' },
  { ...picturedoku, status: 'ready' },
  { ...vier, status: 'ready' },
  { ...slang, status: 'ready' },
  { ...kleuren, status: 'ready' },
  { ...klok, status: 'ready' },
  { ...letters, status: 'ready' },
];
