const CONSTANTS_GALAXY = {
    // Layout
    MIN_TRAVEL_DISTANCE:  150,
    MAX_TRAVEL_DISTANCE:  240,
    TARGET_SYSTEM_COUNT:  100,
    SYSTEM_COUNT_VARIANCE: 25,      // ±25 (75–125 total)
    GALAXY_WIDTH:  1500,
    GALAXY_HEIGHT: 1500,
    MIN_CONNECTIONS_PER_SYSTEM: 1,
    MAX_CONNECTIONS_PER_SYSTEM: 5,

    // Generation tuning
    GALAXY_GEN_MAX_ATTEMPTS:     20,  // retries before falling back to smaller galaxy
    GALAXY_MIN_SYSTEM_SPACING:   80,  // minimum pixel distance between systems
    SYSTEM_PLACEMENT_ATTEMPTS:   50,  // tries to find a valid position for each system
    MIN_SYSTEM_ROUTE_CLEARANCE:  50,  // minimum px a non-endpoint system must be from any route
    ROUTE_NEARBY_THRESHOLD:      80,  // threshold for proximity-connection enforcement pass
    // Route fleet encounters
    FLEET_MAX_PER_ROUTE:        3,     // max encounter fleets on a single route (0–3 spawned)
    FLEET_SIZE_MIN:             1,     // min ships in an encounter fleet
    FLEET_SIZE_MAX:             5,     // max ships in an encounter fleet
    FLEET_PIRATE_ATTACK_CHANCE: 0.5,  // prob pirates attack on sight
    FLEET_POLICE_ATTACK_CHANCE: 0.5,  // prob police attack when player has bounty
    FLEET_ATTACK_BOUNTY:        1000, // bounty gained from attacking police or merchants

    // Travel animation
    GALAXY_TRAVEL_ANIM_DURATION: 1000, // ms for the ship travel animation on galaxy map

    // Renderer
    GALAXY_DEFAULT_ZOOM:    4,
    GALAXY_MIN_ZOOM:        0.5,
    GALAXY_MAX_ZOOM:        20,
    GALAXY_ZOOM_STEP:       1.15,  // zoom multiplier per click/scroll step
    GALAXY_CANVAS_PADDING:  50,    // pixel padding when fitting galaxy to canvas
    GALAXY_SYSTEM_RADIUS:    8,    // fixed screen-space radius of system dots (px)
    GALAXY_SYSTEM_HIT_RADIUS: 40,  // screen-space click/hover hit radius (px)
    GALAXY_TOOLTIP_DELAY:   500,   // ms before tooltip appears/disappears
};
