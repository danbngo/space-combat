const CONSTANTS_SHIPS = {
    // Stat ranges — midpoint ~10 for laser/engine/radar, ~25 for hull/shields
    SHIP_STATS: {
        HULL_MIN:    20,
        HULL_MAX:    30,
        SHIELDS_MIN: 20,
        SHIELDS_MAX: 30,
        LASER_MIN:    8,
        LASER_MAX:   12,
        RADAR_MIN:    8,
        RADAR_MAX:   12,
        ENGINE_MIN:   8,
        ENGINE_MAX:  12,
    },

    // Ship types: stat multipliers + normalized polygon vertices (pointing +X, scaled by SHIP_SIZE)
    // internal: true types are excluded from station offers and random generation
    SHIP_TYPES: [
        {
            type: 'Fighter',
            description: 'Fast, agile and hits hard, but fragile. Excels at hit-and-run tactics and flanking maneuvers.',
            hullMult: 0.8, shieldMult: 0.7, laserMult: 1.3, radarMult: 1.1, engineMult: 1.4,
            builtinModules: ['blink_drive'],
            vertices: [[2.2, 0], [0.2, -1.0], [-0.6, -1.4], [-1.2, -0.4], [-1.2, 0.4], [-0.6, 1.4], [0.2, 1.0]],
        },
        {
            type: 'Tanker',
            description: 'A heavily armored bulk freighter repurposed for combat. Exceptional hull and shields at the cost of speed and firepower. Hard to kill, nearly impossible to run.',
            hullMult: 1.8, shieldMult: 1.5, laserMult: 0.7, radarMult: 0.8, engineMult: 0.6,
            vertices: [[1.2, 0], [0.8, -1.0], [-0.3, -1.4], [-1.5, -1.2], [-1.5, 1.2], [-0.3, 1.4], [0.8, 1.0]],
        },
        {
            type: 'Raider',
            description: 'Aggressive and fast, with strong weapons and good mobility. Effective in hit-and-run tactics.',
            hullMult: 0.9, shieldMult: 0.6, laserMult: 1.4, radarMult: 1.0, engineMult: 1.3,
            builtinModules: [],
            vertices: [[2.3, 0], [0.3, -1.0], [-1.8, -1.5], [-1.3, 0], [-1.8, 1.5], [0.3, 1.0]],
        },
        {
            type: 'Corvette',
            description: 'A well-rounded warship with solid hull, shields, and firepower. Built-in Cloak Drive lets it vanish before a counter-attack — the backbone of a versatile fleet.',
            hullMult: 1.2, shieldMult: 1.2, laserMult: 1.0, radarMult: 0.9, engineMult: 0.9,
            builtinModules: ['cloak_drive'],
            vertices: [[1.8, 0], [1.2, -0.6], [0.4, -1.3], [-0.6, -1.3], [-1.5, -0.5], [-1.5, 0.5], [-0.6, 1.3], [0.4, 1.3], [1.2, 0.6]],
        },
        {
            type: 'Scout',
            description: 'An extremely agile recon vessel built for speed above all else. Very fragile in a stand-up fight, but with Afterburner it can reposition faster than anything else on the field.',
            hullMult: 0.6, shieldMult: 0.5, laserMult: 0.8, radarMult: 1.2, engineMult: 1.8,
            builtinModules: ['afterburner_drive'],
            vertices: [[3.0, 0], [0.5, -0.3], [-0.2, -0.9], [-1.5, -0.5], [-2.0, 0], [-1.5, 0.5], [-0.2, 0.9], [0.5, 0.3]],
        },
        {
            type: 'Destroyer',
            description: 'Heavily armored and well-armed, with strong defensive capabilities.',
            hullMult: 1.4, shieldMult: 0.8, laserMult: 1.2, radarMult: 1.0, engineMult: 1.1,
            builtinModules: ['emp_blast_drive'],
            vertices: [[2.2, 0], [1.5, -0.6], [0.4, -1.2], [-0.4, -1.2], [-0.4, -0.6], [-1.5, -0.6], [-2.0, 0], [-1.5, 0.6], [-0.4, 0.6], [-0.4, 1.2], [0.4, 1.2], [1.5, 0.6]],
        },
        {
            type: 'Carrier',
            description: 'A massive command vessel with heavy armor and shields. Deploys combat drones via its built-in Carrier Bay — each drone can move, shoot, and self-destruct in a blast.',
            hullMult: 2.0, shieldMult: 1.8, laserMult: 0.6, radarMult: 0.7, engineMult: 0.5,
            builtinModules: ['carrier_bay'],
            vertices: [[1.0, 0], [0.5, -0.9], [-0.2, -1.7], [-1.2, -1.8], [-2.0, 0], [-1.2, 1.8], [-0.2, 1.7], [0.5, 0.9]],
        },
        {
            type: 'Interceptor',
            description: 'High-speed vessel which can pull other ships towards it.',
            hullMult: 0.7, shieldMult: 1.0, laserMult: 1.0, radarMult: 1.0, engineMult: 1.5,
            builtinModules: ['tractor_beam_emitter'],
            vertices: [[3.0, 0], [0.8, -0.2], [0.0, -0.7], [-1.5, -0.5], [-2.0, 0], [-1.5, 0.5], [0.0, 0.7], [0.8, 0.2]],
        },
        {
            type: 'Drone',
            internal: true,
            hullMult: 1.0, shieldMult: 0, laserMult: 1.0, radarMult: 0.5, engineMult: 1.0,
            builtinModules: [],
            vertices: [[1.5, 0], [0.3, -0.8], [-0.8, -0.5], [-0.8, 0.5], [0.3, 0.8]],
        },
        {
            type: 'Smuggler',
            description: 'Fast and stealthy, built to slip through enemy lines undetected.',
            hullMult: 0.75, shieldMult: 0.6, laserMult: 1.0, radarMult: 1.3, engineMult: 1.5,
            builtinModules: ['cloak_drive'],
            vertices: [[2.5, 0], [0.8, -0.5], [-0.5, -1.0], [-1.8, -0.7], [-1.5, 0], [-1.8, 0.7], [-0.5, 1.0], [0.8, 0.5]],
        },
        {
            type: 'Battleship',
            description: 'Massive capital ship bristling with weapons and armor. Slow but devastating.',
            hullMult: 3.0, shieldMult: 2.5, laserMult: 1.8, radarMult: 1.1, engineMult: 0.35,
            builtinModules: ['warhead_launcher'],
            vertices: [[2.0, 0], [1.5, -0.5], [0.8, -1.5], [-0.2, -1.8], [-1.2, -1.5], [-2.2, -0.8], [-2.5, 0], [-2.2, 0.8], [-1.2, 1.5], [-0.2, 1.8], [0.8, 1.5], [1.5, 0.5]],
        },
        {
            type: 'Jammer',
            description: 'High-tech electronic warfare vessel that disrupts enemy systems.',
            hullMult: 0.9, shieldMult: 1.2, laserMult: 0.85, radarMult: 1.6, engineMult: 1.1,
            builtinModules: ['emp_blast_drive'],
            vertices: [[2.0, 0], [0.5, -0.5], [-0.5, -1.2], [-1.0, -1.5], [-2.0, -0.8], [-2.0, 0.8], [-1.0, 1.5], [-0.5, 1.2], [0.5, 0.5]],
        },
        {
            type: 'Repair Ship',
            description: 'Mobile repair platform that keeps allied ships in fighting condition.',
            hullMult: 1.0, shieldMult: 1.6, laserMult: 0.5, radarMult: 1.0, engineMult: 0.85,
            builtinModules: ['repair_bay'],
            vertices: [[1.5, 0], [0.8, -0.8], [-0.2, -1.2], [-1.8, -1.0], [-2.0, -0.4], [-2.0, 0.4], [-1.8, 1.0], [-0.2, 1.2], [0.8, 0.8]],
        },
    ],

    // Faction definitions — each controls fleet color, ship pool, and combat behavior
    FACTIONS: [
        {
            id: 'pirates',
            name: 'Pirates',
            color: '#ff4444',
            shipTypes: ['Raider', 'Fighter', 'Smuggler', 'Destroyer'],
        },
        {
            id: 'merchants',
            name: 'Merchants',
            color: '#ffdd44',
            shipTypes: ['Tanker', 'Repair Ship', 'Corvette', 'Scout'],
        },
        {
            id: 'police',
            name: 'Police',
            color: '#4488ff',
            shipTypes: ['Corvette', 'Destroyer', 'Interceptor', 'Fighter', 'Jammer'],
        },
    ],
};
