// Game Constants
const CONSTANTS = {
    GAME_WIDTH: 800,
    GAME_HEIGHT: 600,
    COMBAT_ARENA_RADIUS: 400,

    PLAYER_STARTING_SHIPS: 3,
    ENEMY_STARTING_SHIPS: 3,
    PLAYER_STARTING_CREDITS: 500,

    // Galaxy layout
    MIN_TRAVEL_DISTANCE: 150,
    MAX_TRAVEL_DISTANCE: 240,
    TARGET_SYSTEM_COUNT: 100,
    SYSTEM_COUNT_VARIANCE: 25, // ±25 (75–125 total)
    GALAXY_WIDTH: 1500,
    GALAXY_HEIGHT: 1500,
    MIN_CONNECTIONS_PER_SYSTEM: 1,
    MAX_CONNECTIONS_PER_SYSTEM: 5,

    // Galaxy generation tuning
    GALAXY_GEN_MAX_ATTEMPTS: 20,       // retries before falling back to smaller galaxy
    GALAXY_MIN_SYSTEM_SPACING: 80,     // minimum pixel distance between systems
    SYSTEM_PLACEMENT_ATTEMPTS: 50,     // tries to find a valid position for each system
    MIN_SYSTEM_ROUTE_CLEARANCE: 50,    // minimum px a non-endpoint system must be from any route
    ROUTE_NEARBY_THRESHOLD: 80,        // threshold for proximity-connection enforcement pass
    ENEMY_FLEET_SPAWN_CHANCE: 0.5,     // probability a new system has an enemy fleet
    MAX_ENCOUNTER_CHANCE: 0.8,         // cap on random encounter probability during travel
    MAX_ENEMY_FLEET_SIZE: 10,          // hard cap on generated enemy fleet size

    // Ship stats ranges — midpoint ~10 for laser/engine/radar, ~25 for hull/shields
    SHIP_STATS: {
        HULL_MIN: 20,
        HULL_MAX: 30,
        SHIELDS_MIN: 20,
        SHIELDS_MAX: 30,
        LASER_MIN: 8,
        LASER_MAX: 12,
        RADAR_MIN: 8,
        RADAR_MAX: 12,
        ENGINE_MIN: 8,
        ENGINE_MAX: 12,
    },

    // Combat
    MAX_TURN_TIME: 30000,
    COMBAT_ANIMATION_SPEED: 300,       // laser/explosion animation duration (ms)
    EXPLOSION_DURATION: 500,           // explosion animation duration (ms)
    SHIP_ANIMATION_SPEED: 0.15,        // movement interpolation factor (per ms of deltaTime)
    ROTATION_LERP_FACTOR: 0.1,         // rotation interpolation factor per frame
    ROTATION_SNAP_THRESHOLD: 0.05,     // snap to target rotation within this many radians
    COMBAT_FORMATION_OFFSET: 0.6,      // how far from center ships start (fraction of arena radius)
    COMBAT_FORMATION_SPREAD: 40,       // pixel spread around formation position
    SHOOTING_ANGLE: Math.PI * 0.25,    // half-angle of shooting cone (45°)
    SHOOTING_ZONE_HALF_ANGLE: Math.atan(0.65), // ≈33° — matches port/starboard triangle half-angle

    // Rendering
    SHIP_SIZE: 4,
    LASER_SIZE: 3,
    LASER_SPEED: 5,
    ARENA_GRID_GAP: 40,                // pixel spacing of arena background grid lines

    // Station
    REPAIR_COST: 50,
    REPAIR_AMOUNT: 50,
    NEW_SHIP_BASE_COST: 200,
    STATION_OFFER_COUNT: 4,
    CREDITS_PER_ENEMY_DESTROYED: 100,

    // Modules
    MODULE_SLOTS: 2,
    MODULES: [
        { id: 'hull_plating',   name: 'Hull Plating',     cost: 150, desc: '+25 max hull',                         effect: { stat: 'maxHull',    amount: 25 } },
        { id: 'shield_booster', name: 'Shield Booster',   cost: 150, desc: '+20 max shields',                      effect: { stat: 'maxShields', amount: 20 } },
        { id: 'targeting_sys',  name: 'Targeting System', cost: 200, desc: '+2 radar',                             effect: { stat: 'radar',      amount: 2 } },
        { id: 'engine_upgrade', name: 'Engine Upgrade',   cost: 175, desc: '+15 engine power',                     effect: { stat: 'engine',     amount: 15 } },
        { id: 'combat_ai',      name: 'Combat AI',        cost: 300, desc: '25% chance: +1 action at start of turn', effect: { type: 'bonus_action', chance: 0.25 } },
        { id: 'blink_drive',       name: 'Blink Drive',   cost: 275, desc: 'Grants Blink: teleport up to 80px in any direction', effect: { type: 'special_move', move: 'blink' } },
        { id: 'afterburner_drive', name: 'Afterburner',       cost: 300, desc: 'Grants Afterburner: straight-line dash 1.5× normal range, damages enemies in path', effect: { type: 'special_move', move: 'afterburner' } },
        { id: 'warhead_launcher',    name: 'Warhead Launcher',  cost: 350, desc: 'Grants Warhead: area-blast missile fired forward; damages + knocks back ships in blast radius', effect: { type: 'special_move', move: 'warhead' } },
        { id: 'tractor_beam_emitter', name: 'Tractor Beam',    cost: 275, desc: 'Grants Tractor Beam: pull any ship in forward cone — target moves to midpoint, you move 50% there', effect: { type: 'special_move', move: 'tractor_beam' } },
    ],

    // UI
    SCREEN_TRANSITION_TIME: 300,

    // AI behaviour tuning
    AI_DECISION_DELAY: 500,            // ms pause before enemy actions resolve (visual feedback)
    AI_RETREAT_HEALTH_RATIO: 0.3,      // enemy retreats when fleet health < this fraction of player's
    AI_RETREAT_CHANCE: 0.4,            // probability of retreating when health is low
    AI_MOVE_CHANCE: 0.4,               // probability AI chooses to move instead of attack
    AI_ATTACK_CHANCE: 0.7,             // probability AI attacks vs skips when acting
    AI_MOVE_TOWARD_FACTOR: 6.0,        // engine × factor = px moved toward target per action
    AI_STRAFE_FACTOR: 0.5,             // fraction of max move distance when strafing
    AI_RETREAT_DANGER_RANGE: 2.5,      // danger zone = shoot range × this; used for retreat probability

    // Galaxy renderer
    GALAXY_DEFAULT_ZOOM: 4,
    GALAXY_MIN_ZOOM: 0.5,
    GALAXY_MAX_ZOOM: 20,
    GALAXY_ZOOM_STEP: 1.15,            // zoom multiplier per click/scroll step
    GALAXY_CANVAS_PADDING: 50,         // pixel padding when fitting galaxy to canvas
    GALAXY_SYSTEM_RADIUS: 8,           // fixed screen-space radius of system dots (px)
    GALAXY_SYSTEM_HIT_RADIUS: 40,      // screen-space click/hover hit radius (px)
    GALAXY_TOOLTIP_DELAY: 500,         // ms before tooltip appears/disappears

    // Ship types: stat multipliers + normalized polygon vertices (pointing +X, scaled by SHIP_SIZE)
    SHIP_TYPES: [
        {
            type: 'Fighter',
            hullMult: 0.8, shieldMult: 0.7, laserMult: 1.3, radarMult: 1.1, engineMult: 1.4,
            // swept delta wing — pronounced forward sweep, clear wingtips
            vertices: [[2.2, 0], [0.2, -1.0], [-0.6, -1.4], [-1.2, -0.4], [-1.2, 0.4], [-0.6, 1.4], [0.2, 1.0]],
        },
        {
            type: 'Tanker',
            hullMult: 1.8, shieldMult: 1.5, laserMult: 0.7, radarMult: 0.8, engineMult: 0.6,
            // chunky barge, reduced width, slight taper at bow
            vertices: [[1.2, 0], [0.8, -1.0], [-0.3, -1.4], [-1.5, -1.2], [-1.5, 1.2], [-0.3, 1.4], [0.8, 1.0]],
        },
        {
            type: 'Raider',
            hullMult: 0.9, shieldMult: 0.6, laserMult: 1.4, radarMult: 1.0, engineMult: 1.3,
            builtinModules: ['tractor_beam_emitter'],
            // aggressive swept-back wings, reduced from original
            vertices: [[2.3, 0], [0.3, -1.0], [-1.8, -1.5], [-1.3, 0], [-1.8, 1.5], [0.3, 1.0]],
        },
        {
            type: 'Cruiser',
            hullMult: 1.2, shieldMult: 1.2, laserMult: 1.0, radarMult: 0.9, engineMult: 0.9,
            // balanced warship with prominent mid-body wings
            vertices: [[1.8, 0], [1.2, -0.6], [0.4, -1.3], [-0.6, -1.3], [-1.5, -0.5], [-1.5, 0.5], [-0.6, 1.3], [0.4, 1.3], [1.2, 0.6]],
        },
        {
            type: 'Scout',
            hullMult: 0.6, shieldMult: 0.5, laserMult: 0.8, radarMult: 1.2, engineMult: 1.8,
            builtinModules: ['afterburner_drive'],
            // elongated with small swept wings at mid-body
            vertices: [[3.0, 0], [0.5, -0.3], [-0.2, -0.9], [-1.5, -0.5], [-2.0, 0], [-1.5, 0.5], [-0.2, 0.9], [0.5, 0.3]],
        },
        {
            type: 'Destroyer',
            hullMult: 1.4, shieldMult: 0.8, laserMult: 1.2, radarMult: 1.0, engineMult: 1.1,
            builtinModules: ['warhead_launcher'],
            // long hull with distinct mid-body side fins
            vertices: [[2.2, 0], [1.5, -0.6], [0.4, -1.2], [-0.4, -1.2], [-0.4, -0.6], [-1.5, -0.6], [-2.0, 0], [-1.5, 0.6], [-0.4, 0.6], [-0.4, 1.2], [0.4, 1.2], [1.5, 0.6]],
        },
        {
            type: 'Carrier',
            hullMult: 2.0, shieldMult: 1.8, laserMult: 0.6, radarMult: 0.7, engineMult: 0.5,
            // broad flying-wing, reduced from original ±2.5
            vertices: [[1.0, 0], [0.5, -0.9], [-0.2, -1.7], [-1.2, -1.8], [-2.0, 0], [-1.2, 1.8], [-0.2, 1.7], [0.5, 0.9]],
        },
        {
            type: 'Interceptor',
            hullMult: 0.7, shieldMult: 0.5, laserMult: 1.0, radarMult: 1.3, engineMult: 2.0,
            builtinModules: ['blink_drive'],
            // ultra-fast dart with small wing stubs
            vertices: [[3.0, 0], [0.8, -0.2], [0.0, -0.7], [-1.5, -0.5], [-2.0, 0], [-1.5, 0.5], [0.0, 0.7], [0.8, 0.2]],
        },
    ],

    GALAXY_TRAVEL_ANIM_DURATION: 1000,  // ms for the ship travel animation on galaxy map

    // Special moves
    BLINK_RANGE: 80,            // px radius of blink teleport circle (≈ 10-engine ship's max straight move)
    AFTERBURNER_RANGE_MULT: 1.5, // multiplier on normal forward reach for afterburner straight-line range
    AFTERBURNER_HALF_WIDTH: 8,  // px half-width of damage streak (ship body width approximation)
    // Tractor beam — forward-cone pull
    TRACTOR_BEAM_HALF_ANGLE: Math.PI / 6,   // ±30° forward cone (must be facing the target)

    // Warhead — area-denial missile fired forward
    WARHEAD_LAUNCH_DIST:  80,   // px from ship center to targeting-circle center (≈ blink range)
    WARHEAD_TARGET_RADIUS: 40,  // px radius of aim circle (how much you can offset the detonation)
    WARHEAD_BLAST_RADIUS:  55,  // px radius of damage + knockback
    WARHEAD_MAX_DAMAGE:    20,  // max damage at blast center (scales to 1 at edge)
    WARHEAD_KNOCKBACK:     50,  // max knockback distance in px (scales to 0 at edge)

    SPECIAL_MOVES: {
        blink:       { id: 'blink',       name: 'Blink',       desc: 'Teleport up to 80px in any direction; randomizes facing.',                       actionCost: 1, cooldown: 2 },
        afterburner: { id: 'afterburner', name: 'Afterburner', desc: 'Dash forward up to 1.5× normal range; damages enemies in path.',                 actionCost: 1, cooldown: 2 },
        warhead:      { id: 'warhead',      name: 'Warhead',      desc: 'Fire a missile into the zone ahead; blast damages + knocks back nearby ships.',  actionCost: 1, cooldown: 3 },
        tractor_beam: { id: 'tractor_beam', name: 'Tractor Beam', desc: 'Pull a ship in the forward cone toward you; both ships move closer.',             actionCost: 1, cooldown: 2 },
    },

    // Asteroids
    ASTEROID_SPAWN_CHANCE: 0.5,
    ASTEROID_MIN_COUNT: 1,
    ASTEROID_MAX_COUNT: 10,
    ASTEROID_MIN_RADIUS: 4,          // 1× SHIP_SIZE
    ASTEROID_MAX_RADIUS: 32,         // 8× SHIP_SIZE
    ASTEROID_MIN_SPLIT_RADIUS: 3,    // fragments smaller than this disappear instead of splitting
    ASTEROID_SPLIT_SPEED: 50,        // px/s for newly split fragments
    ASTEROID_DRAG: 0.6,              // velocity multiplier per second (friction)
    ASTEROID_COLLISION_DAMAGE: 1,    // hull damage: moving asteroid hit, or overlap collision
    ASTEROID_KNOCKBACK: 40,          // knockback px when a moving asteroid hits a ship
    ASTEROID_SHIP_RADIUS: 12,        // collision radius for ships in overlap checks (≈ SHIP_SIZE × 3)

    // Combat ranges
    SHOOT_RANGE_BASE: 20,       // radar (integer ~10) * SHOOT_RANGE_BASE = max shoot range (px)
    RAM_DAMAGE_FACTOR: 0.3,     // engine * factor = hull damage dealt to rammer; target takes 2×
    RAM_PUSHBACK_FACTOR: 0.25,  // fraction of move distance the rammed ship is pushed back

    // Movement oval (multiples of ship.engine, in ship local space; +X = forward)
    // With engine=10: max forward ≈80px, max sideways ≈25px; rear edge =10px fwd (no backing up)
    COMBAT_MOVE_OVAL_OFFSET: 4.5,  // forward offset of oval centre
    COMBAT_MOVE_OVAL_MAJOR:  3.5,  // semi-major (forward/back axis)
    COMBAT_MOVE_OVAL_MINOR:  2.5,  // semi-minor (side axis)
};

// Game States
const GAME_STATE = {
    TITLE: 'title',
    GALAXY: 'galaxy',
    STATION: 'station',
    TRAVEL: 'travel',
    COMBAT: 'combat',
    GAME_OVER: 'gameOver'
};

// Combat States
const COMBAT_STATE = {
    PLAYER_TURN: 'playerTurn',
    ENEMY_TURN: 'enemyTurn',
    RESOLVING: 'resolving',
    ENDED: 'ended'
};
