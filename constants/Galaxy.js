const CONSTANTS_GALAXY = {
    // Galaxy canvas dimensions (used by renderer)
    GALAXY_WIDTH:  1800,
    GALAXY_HEIGHT:  700,

    // Tree generation
    TREE_TIERS:          16,    // tiers 0–15 (0 = player start, 15 = alien queen)
    TREE_QUEEN_TIER:     15,
    TREE_NODES_MIN:       2,    // min nodes per interior tier
    TREE_NODES_MAX:       4,    // max nodes per interior tier
    TREE_BRANCHES_MIN:    1,    // min forward connections per node
    TREE_BRANCHES_MAX:    3,    // max forward connections per node

    // Encounter scaling
    ROUTE_MAX_ENCOUNTERS:   5,

    // Fleet strength: base = 1 + floor(destinationTier/QUEEN_TIER * 8), then ±JITTER
    FLEET_STRENGTH_BASE:  1,
    FLEET_STRENGTH_MAX:   10,
    FLEET_STRENGTH_JITTER: 1,   // ±jitter added to base strength per route

    // Venue spawn probabilities (linear interpolation from tier 0 to QUEEN_TIER-1)
    VENUE_SHIPYARD_BASE:   0.35,
    VENUE_SHIPYARD_MAX:    0.85,
    VENUE_MECHANIC_BASE:   0.20,
    VENUE_MECHANIC_MAX:    0.75,
    VENUE_COURTHOUSE_BASE: 0.10,
    VENUE_COURTHOUSE_MAX:  0.50,

    // Alien faction weight ramp-up starts at this tier and reaches full weight at QUEEN_TIER
    ALIEN_WEIGHT_START_TIER: 4,

    // Travel animation speed: galaxy-units / ms / engine-point
    GALAXY_TRAVEL_SPEED_FACTOR: 0.0042,
    // In-game time: days = distance / (avgEngine * TRAVEL_TIME_SCALE)
    TRAVEL_TIME_SCALE: 19.5,

    // Bounty gained for attacking police / merchants
    FLEET_ATTACK_BOUNTY: 1000,

    // Renderer
    GALAXY_DEFAULT_ZOOM:     1,
    GALAXY_MIN_ZOOM:         2,
    GALAXY_MAX_ZOOM:         5,
    GALAXY_ZOOM_STEP:        1.15,
    GALAXY_CANVAS_PADDING:   50,
    GALAXY_SYSTEM_RADIUS:     8,
    GALAXY_SYSTEM_HIT_RADIUS: 10,
    GALAXY_TOOLTIP_DELAY:    500,
};
