const CONSTANTS_SPECIAL_MOVES = {
    // Blink
    BLINK_RANGE: 80,   // px radius of blink teleport circle

    // Afterburner
    AFTERBURNER_RANGE_MULT:      1.25,           // multiplier on normal move reach
    AFTERBURNER_CONE_HALF_ANGLE: Math.PI / 4,   // ±45° steering cone (90° total)
    AFTERBURNER_HALF_WIDTH:      8,              // px half-width of damage streak

    // Tractor beam
    TRACTOR_BEAM_HALF_ANGLE: Math.PI / 6,   // ±30° forward cone

    // Warhead
    WARHEAD_LAUNCH_DIST:    80,   // px from ship center to targeting-circle center
    WARHEAD_TARGET_RADIUS:  40,   // px radius of aim circle
    WARHEAD_BLAST_RADIUS:   55,   // px radius of damage + knockback
    WARHEAD_MAX_DAMAGE:     20,   // max damage at blast center (scales to 1 at edge)
    WARHEAD_KNOCKBACK:      50,   // max knockback distance in px (scales to 0 at edge)

    // Cloak
    CLOAK_MIN_TURNS: 2,
    CLOAK_MAX_TURNS: 4,

    // Drone
    DRONE_HULL:         10,
    DRONE_ENGINE:       10,
    DRONE_LASER:        10,
    DRONE_RADAR:         5,
    DRONE_BLAST_RADIUS: 28,    // ~0.5× WARHEAD_BLAST_RADIUS
    DRONE_MAX_DAMAGE:   10,    // ~0.5× WARHEAD_MAX_DAMAGE
    DRONE_KNOCKBACK:    25,    // ~0.5× WARHEAD_KNOCKBACK
    DRONE_LIFETIME:      3,    // turns before auto-expiry

    // Repair beam
    REPAIR_BEAM_HULL:    15,
    REPAIR_BEAM_SHIELDS: 10,

    SPECIAL_MOVES: {
        blink:        { id: 'blink',        name: 'Blink',        desc: 'Teleport up to 80px in any direction.',                                                                     actionCost: 1, cooldown: 2 },
        afterburner:  { id: 'afterburner',  name: 'Afterburner',  desc: 'Dash forward at full range; damages enemies in path.',                                                      actionCost: 1, cooldown: 2 },
        warhead:      { id: 'warhead',      name: 'Warhead',      desc: 'Fire a missile into the zone ahead; blast damages + knocks back all ships in radius, including allies.',    actionCost: 1, cooldown: 3 },
        tractor_beam: { id: 'tractor_beam', name: 'Tractor Beam', desc: 'Pull any ship toward you; allies can be targeted at any angle, enemies must be in the forward cone.',      actionCost: 1, cooldown: 2 },
        emp_blast:    { id: 'emp_blast',    name: 'EMP Blast',    desc: 'Instantly damages shields and locks abilities on all ships nearby, including yourself.',                    actionCost: 1, cooldown: 4 },
        cloak:        { id: 'cloak',        name: 'Cloak',        desc: 'Become untargetable by lasers and ramming for 2–4 rounds. Revealed by taking damage or using an ability.', actionCost: 1, cooldown: 5 },
        summon_drone: { id: 'summon_drone', name: 'Deploy Drone', desc: 'Deploy a combat drone beside you. It can move, shoot, and detonate. Expires in 3 turns.',                  actionCost: 1, cooldown: 3 },
        detonate:     { id: 'detonate',     name: 'Detonate',     desc: 'Self-destruct — blast damages and knocks back all ships in radius.',                                        actionCost: 1, cooldown: 0 },
        repair_beam:  { id: 'repair_beam',  name: 'Repair Beam',  desc: 'Restore hull and shields to an allied ship in range.',                                                     actionCost: 1, cooldown: 2 },
    },
};
