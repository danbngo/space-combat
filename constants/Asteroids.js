const CONSTANTS_ASTEROIDS = {
    ASTEROID_SPAWN_CHANCE:     0.5,
    ASTEROID_MIN_COUNT:          1,
    ASTEROID_MAX_COUNT:         10,
    ASTEROID_MIN_RADIUS:         4,   // 1× SHIP_SIZE
    ASTEROID_MAX_RADIUS:        32,   // 8× SHIP_SIZE
    ASTEROID_MIN_SPLIT_RADIUS:   3,   // fragments smaller than this disappear instead of splitting
    ASTEROID_SPLIT_SPEED:       50,   // px/s for newly split fragments
    ASTEROID_DRAG:           0.002,   // velocity multiplier per second (friction) — ~0.5s stop time
    ASTEROID_COLLISION_DAMAGE:   1,   // hull damage: moving asteroid hit, or overlap collision
    ASTEROID_KNOCKBACK:         40,   // knockback px when a moving asteroid hits a ship
    ASTEROID_SHIP_RADIUS:       12,   // collision radius for ships in overlap checks (≈ SHIP_SIZE × 3)
};
