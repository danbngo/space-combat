const CONSTANTS_SPECIAL_MOVES = {
    // Blink
    BLINK_RANGE: 80,   // px radius of blink teleport circle

    // Afterburner
    AFTERBURNER_RANGE_MULT:      2.5,            // multiplier on normal move reach
    AFTERBURNER_CONE_HALF_ANGLE: Math.PI / 4,   // ±45° steering cone (90° total)
    AFTERBURNER_HALF_WIDTH:      8,              // px half-width of damage streak

    // Tractor beam
    TRACTOR_BEAM_HALF_ANGLE: Math.PI / 6,   // ±30° forward cone

    // Bomb (formerly Warhead) — targeting constants are reused for EMP as well
    WARHEAD_LAUNCH_DIST:    80,   // px from ship center to targeting-circle center
    WARHEAD_TARGET_RADIUS:  40,   // px radius of aim circle
    WARHEAD_BLAST_RADIUS:   55,   // px radius of damage + knockback
    WARHEAD_MAX_DAMAGE:     20,   // max damage at blast center (scales to 1 at edge)
    WARHEAD_KNOCKBACK:      50,   // max knockback distance in px (scales to 0 at edge)

    // Bomb
    BOMB_HULL:              30,   // hp of planted bomb unit
    BOMB_LIFETIME:           2,   // enemy turns before detonation

    // Cloak
    CLOAK_MIN_TURNS: 2,
    CLOAK_MAX_TURNS: 4,

    // Drone
    DRONE_HULL:         10,
    DRONE_ENGINE:       10,
    DRONE_LASER:        10,
    DRONE_RADAR:         5,
    DRONE_LIFETIME:      4,    // turns before auto-expiry

    // Repair beam — forward cone
    REPAIR_BEAM_HULL:              15,
    REPAIR_BEAM_CONE_HALF_ANGLE:   Math.PI / 4,   // ±45° = 90° total forward cone

    // Supercharge
    SUPERCHARGE_CONE_HALF_ANGLE:   Math.PI / 4,   // ±45° = 90° total forward cone

    // Flash
    FLASH_RANGE:        80,   // px radius of targeting circle (same as blink)
    FLASH_BLAST_RADIUS: 55,   // px radius of blind + damage AoE (same as warhead)
    FLASH_DAMAGE:        1,   // hull damage per ship hit
    FLASH_BLIND_TURNS:   2,   // turns blinded ships cannot fire

    // Hack
    HACK_RANGE:         28,   // px radius — 50% of WARHEAD_BLAST_RADIUS
    BERSERK_TURNS:       2,   // turns a hacked ship stays berserk

    // Mark
    MARK_CONE_HALF_ANGLE: Math.PI / 4,   // ±45° = 90° total forward cone
    MARK_RANGE:           200,            // max px within cone
    MARK_TURNS:             3,            // turns the marked status lasts

    // Debris Field
    DEBRIS_FIELD_MIN:         3,            // minimum asteroids launched
    DEBRIS_FIELD_MAX:         5,            // maximum asteroids launched
    DEBRIS_FIELD_CONE_HALF_ANGLE: Math.PI / 4,  // ±45° forward cone
    DEBRIS_FIELD_LAUNCH_DIST:    40,        // px ahead of ship where asteroids spawn
    DEBRIS_FIELD_SPEED:         120,        // px/s launch velocity

    SPECIAL_MOVES: {
        blink:        { id: 'blink',        name: 'Blink',        desc: 'Teleport up to 80px in any direction.',                                                                          actionCost: 1, cooldown: 2 },
        afterburner:  { id: 'afterburner',  name: 'Afterburner',  desc: 'Dash forward at full range; damages enemies in path.',                                                           actionCost: 1, cooldown: 2 },
        bomb:         { id: 'bomb',         name: 'Bomb',         desc: 'Plant a bomb at the target point ahead. Detonates after 2 turns — blast damages + knocks back all ships in radius. Can be shot down.', actionCost: 1, cooldown: 3 },
        tractor_beam: { id: 'tractor_beam', name: 'Tractor Beam', desc: 'Pull any ship toward you; allies can be targeted at any angle, enemies must be in the forward cone.',           actionCost: 1, cooldown: 2 },
        emp_blast:    { id: 'emp_blast',    name: 'EMP Blast',    desc: 'Fire an EMP into the zone ahead — damages shields and locks abilities on all ships in the blast radius.',        actionCost: 1, cooldown: 4 },
        cloak:        { id: 'cloak',        name: 'Cloak',        desc: 'Become untargetable by lasers and ramming for 2–4 rounds. Revealed by taking damage or using an ability.',      actionCost: 1, cooldown: 5 },
        summon_drone: { id: 'summon_drone', name: 'Deploy Drone', desc: 'Deploy a combat drone beside you. It can move and shoot. Expires in 4 turns.',                                  actionCost: 1, cooldown: 3 },
        repair_beam:  { id: 'repair_beam',  name: 'Repair Beam',  desc: 'Emit a repair beam in a forward cone — restores hull on all allies in range.',                                  actionCost: 1, cooldown: 2 },
        supercharge:  { id: 'supercharge',  name: 'Supercharge',  desc: 'Fully restore shields on an ally in the forward arc and supercharge them for 1 turn: 2× move, 2× laser damage, 2× laser range.', actionCost: 1, cooldown: 4 },
        flash:        { id: 'flash',        name: 'Flash',        desc: 'Emit a blinding flash at a target point within 80px. Deals 1 damage and blinds all ships in the blast for 2 turns — blinded ships cannot fire.', actionCost: 1, cooldown: 3 },
        hack:         { id: 'hack',         name: 'Hack',         desc: 'Hack any ship within 28px — friend or foe. The target goes berserk for 2 turns: randomly attacks nearby ships using only lasers and ramming, with 2× actions.', actionCost: 1, cooldown: 4 },
        debris_field: { id: 'debris_field', name: 'Debris Field', desc: 'Launch 3–5 small asteroids in a forward cone. Each travels in a straight line and damages any ship it hits.', actionCost: 1, cooldown: 3 },
        mark:         { id: 'mark',         name: 'Mark',         desc: 'Designate one ship in the forward 90° cone as a priority target — all laser shots against it auto-hit for 3 turns.', actionCost: 1, cooldown: 4 },
    },
};
