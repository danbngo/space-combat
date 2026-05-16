const CONSTANTS_CORE = {
    GAME_WIDTH:  800,
    GAME_HEIGHT: 600,
    COMBAT_ARENA_RADIUS: 400,

    PLAYER_STARTING_SHIPS:   1,
    PLAYER_STARTING_CREDITS: 500,
    DEFAULT_FLEET_SIZE: 2,       // base max fleet without any leadership perks

    SCREEN_TRANSITION_TIME:      300,
    CREDITS_PER_ENEMY_DESTROYED: 100,

    // Commander experience
    EXP_PER_ENEMY_DISABLED: 10,  // enemy ship destroyed or disabled in combat
    EXP_PER_SHIP_FLED:       5,  // each of your ships that escapes combat
    // Exp needed to reach each successive commander level (non-cumulative)
    EXP_THRESHOLDS: [10, 25, 100, 300, 900],

    // Ship cost scaling: cost = SHIP_COST_SCALE * totalStats^SHIP_COST_EXP ± variance
    SHIP_COST_SCALE:    1.5,
    SHIP_COST_EXP:      1.25,
    SHIP_COST_VARIANCE: 0.15,    // ±15% random variance on final price

    // Commander perks — each is a single level-up point purchase
    PERKS: [
        {
            id: 'leadership_1',
            name: 'Leadership I',
            desc: 'Your reputation grows. You may command a fleet of up to 3 ships.',
            fleetSize: 3,
            requires: null,
        },
        {
            id: 'leadership_2',
            name: 'Leadership II',
            desc: 'A seasoned commander. Expand your fleet to 4 ships.',
            fleetSize: 4,
            requires: 'leadership_1',
        },
        {
            id: 'leadership_3',
            name: 'Leadership III',
            desc: 'Battle-hardened veteran. Your fleet can field 5 ships.',
            fleetSize: 5,
            requires: 'leadership_2',
        },
        {
            id: 'leadership_4',
            name: 'Leadership IV',
            desc: 'Legendary admiral. Command a full squadron of 6 ships.',
            fleetSize: 6,
            requires: 'leadership_3',
        },
    ],
};
