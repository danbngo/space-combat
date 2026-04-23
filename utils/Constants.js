// Game Constants
const CONSTANTS = {
    GAME_WIDTH: 800,
    GAME_HEIGHT: 600,
    COMBAT_ARENA_RADIUS: 200,

    PLAYER_STARTING_SHIPS: 5,
    ENEMY_STARTING_SHIPS: 3,
    PLAYER_STARTING_CREDITS: 1000,

    // Galaxy layout
    MIN_TRAVEL_DISTANCE: 150,
    MAX_TRAVEL_DISTANCE: 300,
    TARGET_SYSTEM_COUNT: 100,
    SYSTEM_COUNT_VARIANCE: 25, // ±25 (75–125 total)
    GALAXY_WIDTH: 1500,
    GALAXY_HEIGHT: 1500,
    MIN_CONNECTIONS_PER_SYSTEM: 1,
    MAX_CONNECTIONS_PER_SYSTEM: 4,

    // Galaxy generation tuning
    GALAXY_GEN_MAX_ATTEMPTS: 20,       // retries before falling back to smaller galaxy
    GALAXY_MIN_SYSTEM_SPACING: 80,     // minimum pixel distance between systems
    SYSTEM_PLACEMENT_ATTEMPTS: 50,     // tries to find a valid position for each system
    ROUTE_PROXIMITY_THRESHOLD: 1200,   // how close another system can be to a lane (higher = more lenient)
    ROUTE_NEARBY_THRESHOLD: 80,        // threshold for proximity-connection enforcement pass
    ENEMY_FLEET_SPAWN_CHANCE: 0.5,     // probability a new system has an enemy fleet
    MAX_ENCOUNTER_CHANCE: 0.8,         // cap on random encounter probability during travel
    MAX_ENEMY_FLEET_SIZE: 10,          // hard cap on generated enemy fleet size

    // Ship stats ranges
    SHIP_STATS: {
        HULL_MIN: 50,
        HULL_MAX: 150,
        SHIELDS_MIN: 20,
        SHIELDS_MAX: 80,
        LASER_MIN: 10,
        LASER_MAX: 30,
        RADAR_MIN: 0.7,
        RADAR_MAX: 1.0,
        ENGINE_MIN: 30,
        ENGINE_MAX: 80
    },

    // Combat
    SHIELD_RECHARGE_PER_SKIP: 15,
    MAX_TURN_TIME: 30000,
    COMBAT_ANIMATION_SPEED: 300,       // laser/explosion animation duration (ms)
    EXPLOSION_DURATION: 500,           // explosion animation duration (ms)
    SHIP_ANIMATION_SPEED: 0.15,        // movement interpolation factor (per ms of deltaTime)
    ROTATION_LERP_FACTOR: 0.1,         // rotation interpolation factor per frame
    ROTATION_SNAP_THRESHOLD: 0.05,     // snap to target rotation within this many radians
    COMBAT_FORMATION_OFFSET: 0.6,      // how far from center ships start (fraction of arena radius)
    COMBAT_FORMATION_SPREAD: 40,       // pixel spread around formation position
    SHOOTING_ANGLE: Math.PI * 0.25,    // half-angle of shooting cone (45°)

    // Rendering
    SHIP_SIZE: 15,
    LASER_SIZE: 3,
    LASER_SPEED: 5,
    ARENA_GRID_GAP: 40,                // pixel spacing of arena background grid lines

    // Station
    REPAIR_COST: 50,
    REPAIR_AMOUNT: 50,
    NEW_SHIP_BASE_COST: 200,
    STATION_OFFER_COUNT: 4,
    CREDITS_PER_ENEMY_DESTROYED: 100,

    // UI
    SCREEN_TRANSITION_TIME: 300,

    // AI behaviour tuning
    AI_DECISION_DELAY: 500,            // ms pause before enemy actions resolve (visual feedback)
    AI_RETREAT_HEALTH_RATIO: 0.3,      // enemy retreats when fleet health < this fraction of player's
    AI_RETREAT_CHANCE: 0.4,            // probability of retreating when health is low
    AI_MOVE_CHANCE: 0.4,               // probability AI chooses to move instead of attack
    AI_ATTACK_CHANCE: 0.7,             // probability AI attacks vs skips when acting
    AI_MOVE_TOWARD_FACTOR: 0.7,        // fraction of max move distance when moving toward target
    AI_STRAFE_FACTOR: 0.5,             // fraction of max move distance when strafing

    // Galaxy renderer
    GALAXY_DEFAULT_ZOOM: 4,
    GALAXY_MIN_ZOOM: 0.5,
    GALAXY_MAX_ZOOM: 20,
    GALAXY_ZOOM_STEP: 1.15,            // zoom multiplier per click/scroll step
    GALAXY_CANVAS_PADDING: 50,         // pixel padding when fitting galaxy to canvas
    GALAXY_SYSTEM_RADIUS: 8,           // fixed screen-space radius of system dots (px)
    GALAXY_SYSTEM_HIT_RADIUS: 40,      // screen-space click/hover hit radius (px)
    GALAXY_TOOLTIP_DELAY: 500,         // ms before tooltip appears/disappears
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
