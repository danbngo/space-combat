const CONSTANTS_COMBAT = {
    MAX_TURN_TIME: 30000,

    // Animation / timing
    COMBAT_ANIMATION_SPEED:   300,    // laser/explosion animation duration (ms)
    EXPLOSION_DURATION:       500,    // explosion animation duration (ms)
    SHIP_ANIMATION_SPEED:     0.15,   // movement interpolation factor (per ms of deltaTime)
    ROTATION_LERP_FACTOR:     0.1,    // rotation interpolation factor per frame
    ROTATION_SNAP_THRESHOLD:  0.05,   // snap to target rotation within this many radians

    // Formation
    COMBAT_FORMATION_OFFSET: 0.6,     // how far from center ships start (fraction of arena radius)
    COMBAT_FORMATION_SPREAD:  40,     // pixel spread around formation position

    // Shooting geometry
    SHOOTING_ANGLE:          Math.PI * 0.25,   // half-angle of shooting cone (45°)
    SHOOTING_ZONE_HALF_ANGLE: Math.atan(0.65), // ≈33° — matches port/starboard triangle half-angle

    // Rendering
    SHIP_SIZE:      4,
    LASER_SIZE:     3,
    LASER_SPEED:    5,
    ARENA_GRID_GAP: 40,   // pixel spacing of arena background grid lines

    // Ranges and damage
    SHOOT_RANGE_BASE:    15,   // radar (integer ~10) × SHOOT_RANGE_BASE = max shoot range (px)
    RAM_DAMAGE_FACTOR:   0.3,  // engine × factor = hull damage dealt to rammer; target takes 2×
    RAM_PUSHBACK_FACTOR: 0.25, // fraction of move distance the rammed ship is pushed back

    // Movement oval (multiples of ship.engine in ship local space; +X = forward)
    COMBAT_MOVE_OVAL_OFFSET: 3.375,  // forward offset of oval centre
    COMBAT_MOVE_OVAL_MAJOR:  2.625,  // semi-major (forward/back axis)
    COMBAT_MOVE_OVAL_MINOR:  1.875,  // semi-minor (side axis)
};
