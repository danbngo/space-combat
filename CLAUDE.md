# Space Combat — CLAUDE.md

## How to run
Open `index.html` directly in a browser. No build step, no dev server, no dependencies.

## Tech stack
Vanilla JS (ES6 classes), HTML5 Canvas (2D), CSS3. No frameworks.

## Architecture
- **Entities** (`entities/`) — dumb data holders. Currently just `Ship`.
- **Systems** (`systems/`) — own all logic, read/write `gameState`.
- **Utils** (`utils/`) — shared helpers and constants.
- **`game.js`** — `GameController` object; initialises everything, owns the `requestAnimationFrame` game loop (runs only during combat).

Systems are **static classes** (no instantiation): `AISystem`, `SpaceTravel`, `StationSystem`, `UISystem`.
Exceptions: `Combat`, `RenderingSystem`, `GalaxyRenderer` are instantiated once and stored in globals (`combat`, `renderingSystem`, `galaxyRenderer`).

## Global state
```
gameState = {
    state: GAME_STATE,          // current screen (see GAME_STATE enum in Constants.js)
    credits: number,            // player currency
    systems: System[],          // all star systems in the galaxy
    currentSystem: System,      // where the player is now
    selectedSystem: System|null,// selected system on the galaxy map
    selectedShip: Ship|null,    // ship selected at the station
    playerShips: Ship[],        // player fleet (max CONSTANTS.PLAYER_STARTING_SHIPS)
    enemyShips: Ship[],         // enemies for the current/upcoming combat
}

System = {
    id: number,
    name: string,
    x: number, y: number,       // position in galaxy space (0–GALAXY_WIDTH/HEIGHT)
    hasEnemyFleet: boolean,
    visited: boolean,
    resourceLevel: number,      // 1–10, generated but currently unused
    connections: number[],      // IDs of directly reachable systems
}
```

## Ship shape (see `entities/Ship.js`)
```
hull, maxHull, shields, maxShields  — hit points
laserDamage                         — base damage per shot
radar                               — float 0–1; used as shot accuracy
engine                              — movement distance per turn
hasMovedThisTurn, hasActedThisTurn  — reset each round
isMoving, isShooting, shootingTarget — animation state
targetX, targetY, targetRotation    — interpolation targets for smooth movement
```

## Screen flow
Title → Galaxy (click Start) → Station (click Show System) → Galaxy (Leave Station)
Galaxy → Combat (travel to a system with an enemy fleet) → Game Over → Galaxy

## Enums (`utils/Constants.js`)
- `GAME_STATE` — TITLE, GALAXY, STATION, TRAVEL, COMBAT, GAME_OVER
- `COMBAT_STATE` — PLAYER_TURN, RESOLVING, ENEMY_TURN, ENDED

## Tuning values
All numeric tuning lives in `CONSTANTS` in `utils/Constants.js`. Key sections:
- Ship stat ranges: `CONSTANTS.SHIP_STATS.*`
- Galaxy generation: `CONSTANTS.GALAXY_*`, `CONSTANTS.ROUTE_*`, `CONSTANTS.ENEMY_FLEET_*`
- Combat animation: `CONSTANTS.SHIP_ANIMATION_SPEED`, `CONSTANTS.ROTATION_*`, `CONSTANTS.EXPLOSION_DURATION`
- AI behaviour: `CONSTANTS.AI_*`
- Galaxy renderer: `CONSTANTS.GALAXY_ZOOM_*`, `CONSTANTS.GALAXY_SYSTEM_*`, `CONSTANTS.GALAXY_TOOLTIP_DELAY`

## Known bugs / quirks
- `resourceLevel` on systems is generated but never used.
- `GalaxyRenderer.getSystemAtPosition` caches systems via `window.galaxyMapSystems` (set each render call).
- Galaxy generation retries up to `CONSTANTS.GALAXY_GEN_MAX_ATTEMPTS` times; falls back to a 75-system galaxy on failure.
- Combat `deepCopy`s the fleets on start — changes during combat do not affect `gameState` until `GameController.endCombat()` merges them back.
- The galaxy generation algorithm is sensitive to constant changes — modifying `MIN/MAX_TRAVEL_DISTANCE` or `ROUTE_PROXIMITY_THRESHOLD` may cause generation to fail repeatedly.
