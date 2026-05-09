const CONSTANTS_SPECIAL_MOVES = {
    // Blink
    BLINK_RANGE: 80,   // px radius of blink teleport circle

    // Afterburner
    AFTERBURNER_RANGE_MULT:      1.875,           // multiplier on normal move reach
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
    REPAIR_BEAM_HULL_MIN:          10,
    REPAIR_BEAM_HULL_MAX:          20,
    REPAIR_BEAM_CONE_HALF_ANGLE:   Math.PI / 8,   // ±22.5° = 45° total forward cone

    // Supercharge
    SUPERCHARGE_CONE_HALF_ANGLE:   Math.PI / 4,   // ±45° = 90° total forward cone

    // Flash
    FLASH_RANGE:        80,   // radius of targeting circle (same as blink)
    FLASH_BLAST_RADIUS: 55,   // radius of blind + damage AoE (same as warhead)
    FLASH_DAMAGE_MIN:    1,   // min hull damage per ship hit
    FLASH_DAMAGE_MAX:    3,   // max hull damage per ship hit
    FLASH_BLIND_TURNS:   2,   // turns blinded ships cannot fire

    // Possess (renamed from Hack)
    POSSESS_RANGE:      28,   // px radius — 50% of WARHEAD_BLAST_RADIUS
    BERSERK_TURNS:       2,   // turns a possessed ship stays berserk

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

    // Chaingun
    CHAINGUN_ROUNDS:      3,
    CHAINGUN_DAMAGE_MULT: 0.5,   // 50% laser damage per round (not total)

    // Plasma Cannon
    PLASMA_RANGE_MULT:  0.5,     // half normal range

    // Rocket Launcher
    ROCKET_BLAST_RADIUS: 35,     // px AoE radius (smaller than EMP/warhead)

    // Anchor
    ANCHOR_CONE_HALF_ANGLE: Math.PI / 4,   // ±45° = 90° forward cone
    ANCHOR_RANGE:           150,            // max px within cone
    ANCHOR_TURNS:             2,            // turns the anchored status lasts

    // Siphon
    SIPHON_RANGE:       40,   // px radius around caster
    SIPHON_SHIELD_MIN:   5,
    SIPHON_SHIELD_MAX:  10,

    // Alien: Swap
    SWAP_RANGE: 80,            // px circle around caster (same as blink)

    // Alien: Absorb
    ABSORB_RANGE: 50,          // px radius AoE around caster

    // Alien: Stasis Field
    STASIS_CAST_RANGE:   60,   // px from ship center to field center
    STASIS_RADIUS:       55,   // starting cloud radius
    STASIS_TURNS:         3,   // turns the field lasts

    // Alien: Doom
    DOOM_TURNS:           1,   // rounds before self-destruct
    DOOM_BLAST_RADIUS:   27,   // ~half of WARHEAD_BLAST_RADIUS

    // Alien: Phase
    PHASE_TURNS:          2,   // turns the phase lasts

    // Alien: Ravager
    RAVAGER_RANGE_MULT: 0.5,   // fraction of normal shoot range

    // Alien: Scatter
    SCATTER_BLINK_DIST: 20,    // px mini-blink on hit

    // Alien: Attractor (laser modifier — pulls target toward shooter)
    ATTRACTOR_KNOCKBACK: 25,   // px pull on laser hit

    // Alien: Swarm
    SWARM_COUNT:         5,    // number of swarmlets spawned
    SWARM_LIFETIME:      3,    // turns before swarmlets expire
    SWARM_HULL:          1,    // swarmlet hull points
    SWARM_ENGINE:       20,    // swarmlet movement speed

    // Alien: Webbing
    WEBBING_RANGE:      80,    // px from ship to blast center (same as flash)
    WEBBING_BLAST_RADIUS: 40,  // px radius of web AoE
    WEB_TURNS:           3,    // turns the web slows the target
    WEB_SPEED_MULT:      0.5,  // fraction of normal move distance when webbed

    // Alien: Timeslip
    TIMESLIP_RANGE:     50,    // px circle around caster for targeting
    TIMESLIP_RECOVERY_TURNS: 2, // turns before state is reset

    // Alien: Frenzy
    FRENZY_RANGE:       70,    // px cone depth
    FRENZY_CONE_HALF_ANGLE: Math.PI / 3,  // ±60° (120° total)
    FRENZY_TURNS:        3,    // turns frenzy lasts

    // Human: Torpedo
    TORPEDO_LIFETIME:    2,    // turns before detonation if no contact
    TORPEDO_BLAST_RADIUS: 55,  // px AoE radius (same as bomb)
    TORPEDO_ENGINE:     22,    // torpedo movement speed per turn

    // Alien: Neutralize
    NEUTRALIZE_RANGE:        80,   // px from ship to blast center
    NEUTRALIZE_BLAST_RADIUS: 30,   // px radius of effect

    // Alien: Gamma Ray
    GAMMA_RAY_HALF_ANGLE: Math.atan(0.325),  // ≈18° — half the width of a standard targeting triangle

    SPECIAL_MOVES: {
        blink:        { id: 'blink',        name: 'Blink',        desc: 'Teleport a short distance in any direction.',                                                                    actionCost: 1, cooldown: 2 },
        afterburner:  { id: 'afterburner',  name: 'Afterburner',  desc: 'Dash forward at full range; damages enemies in path.',                                                           actionCost: 1, cooldown: 2 },
        bomb:         { id: 'bomb',         name: 'Bomb',         desc: 'Plant a bomb at the target point ahead. Detonates after 2 turns — blast damages + knocks back all ships in radius. Can be shot down.', actionCost: 1, cooldown: 3 },
        tractor_beam: { id: 'tractor_beam', name: 'Tractor Beam', desc: 'Pull any ship toward you; allies can be targeted at any angle, enemies must be in the forward cone.',           actionCost: 1, cooldown: 2 },
        emp_blast:    { id: 'emp_blast',    name: 'EMP Blast',    desc: 'Fire an EMP into the zone ahead — damages shields and locks abilities on all ships in the blast radius.',        actionCost: 1, cooldown: 4 },
        cloak:        { id: 'cloak',        name: 'Cloak',        desc: 'Become untargetable by lasers and ramming for 2–4 rounds. Revealed by taking damage or using an ability.',      actionCost: 1, cooldown: 5 },
        summon_drone: { id: 'summon_drone', name: 'Deploy Drone', desc: 'Deploy a combat drone beside you. It can move and shoot. Expires in 4 turns.',                                  actionCost: 1, cooldown: 3 },
        repair_beam:  { id: 'repair_beam',  name: 'Repair Beam',  desc: 'Emit a repair beam in a forward cone — restores hull on all allies in range.',                                  actionCost: 1, cooldown: 2 },
        supercharge:  { id: 'supercharge',  name: 'Supercharge',  desc: 'Fully restore shields on an ally in the forward arc and supercharge them for 1 turn: 2× move, 2× laser damage, 2× laser range.', actionCost: 1, cooldown: 4 },
        flash:        { id: 'flash',        name: 'Flash',        desc: 'Emit a blinding flash at a target point within range. Deals 1–3 damage and blinds all ships in the blast for 2 turns — blinded ships cannot fire.', actionCost: 1, cooldown: 3 },
        possess:      { id: 'possess',      name: 'Possess',      desc: 'Seize control of any ship within close range — friend or foe. The target goes berserk for 2 turns: randomly attacks nearby ships using only lasers and ramming, with 2× actions.', actionCost: 1, cooldown: 4 },
        debris_field: { id: 'debris_field', name: 'Debris Field', desc: 'Launch 3–5 small asteroids in a forward cone. Each travels in a straight line and damages any ship it hits.', actionCost: 1, cooldown: 3 },
        mark:            { id: 'mark',            name: 'Mark',            desc: 'Designate one ship in the forward 90° cone as a priority target — all laser shots against it auto-hit for 3 turns.', actionCost: 1, cooldown: 4 },
        chaingun:        { id: 'chaingun',        name: 'Chaingun',        desc: 'Fire 3 rounds independently — each hits or misses separately, bypasses shields, 50% laser damage per hit. 2× normal miss chance.', actionCost: 1, cooldown: 0 },
        plasma_cannon:   { id: 'plasma_cannon',   name: 'Plasma Cannon',   desc: 'Half range. Rolls separate shield damage and hull damage simultaneously — both apply regardless of shield level.', actionCost: 1, cooldown: 0 },
        rocket_launcher: { id: 'rocket_launcher', name: 'Rockets',         desc: 'Fire a rocket into the targeting area — guaranteed hit, laser damage to all ships in blast radius. 1-turn cooldown.', actionCost: 1, cooldown: 2 },
        anchor:          { id: 'anchor',          name: 'Anchor',          desc: 'Lock a ship in the forward cone — it cannot move or be knocked back for 2 turns.',                                             actionCost: 1, cooldown: 3 },
        siphon:          { id: 'siphon',          name: 'Siphon',          desc: 'Drain 5–10 shields from any nearby ship and add 1 cooldown to all of its abilities.',                                          actionCost: 1, cooldown: 3 },
        // Alien-only abilities
        swap:            { id: 'swap',            name: 'Swap',            desc: 'Instantly swap positions with another ship within range.',                                                                      actionCost: 1, cooldown: 3 },
        summon_mirror:   { id: 'summon_mirror',   name: 'Mirror',          desc: 'Spawn an identical copy that lasts 2 turns. May swap positions with caster — no visual tell until destroyed.',                  actionCost: 1, cooldown: 5 },
        doom:            { id: 'doom',            name: 'Doom',            desc: 'Mark self for destruction — detonates in a small blast next round.',                                                            actionCost: 1, cooldown: 6 },
        phase:           { id: 'phase',           name: 'Phase',           desc: 'Enter a phased state for 2 turns — untargetable, invincible, and immune to knockback, but still visible.',                      actionCost: 1, cooldown: 4 },
        absorb:          { id: 'absorb',          name: 'Absorb',          desc: 'Drain hull from all nearby ships — cannot reduce targets below 1 hull.',                                                        actionCost: 1, cooldown: 3 },
        teleport:        { id: 'teleport',        name: 'Teleport',        desc: 'Instantly move to a random position and angle within the arena.',                                                               actionCost: 1, cooldown: 3 },
        stasis_field:    { id: 'stasis_field',    name: 'Stasis Field',    desc: 'Create a stasis cloud centered nearby — ships inside cannot act or take damage. Shrinks each round; lasts 3 turns.',           actionCost: 1, cooldown: 5 },
        swarm:           { id: 'swarm',           name: 'Swarm',           desc: 'Release 5 swarmlets that independently track and ram the nearest enemy, dying on impact. Expire after 3 turns.',               actionCost: 1, cooldown: 5 },
        webbing:         { id: 'webbing',         name: 'Webbing',         desc: 'Launch a sticky web at a point within range — all ships in the blast area are slowed to half movement speed for 3 turns.',     actionCost: 1, cooldown: 3 },
        timeslip:        { id: 'timeslip',        name: 'Time Slip',       desc: 'Mark a nearby ship for temporal reversal — in 2 turns its position, hull, shields, and cooldowns are all reset to now.',       actionCost: 1, cooldown: 5 },
        frenzy:          { id: 'frenzy',          name: 'Frenzy',          desc: 'Induce frenzy in ships in the forward arc (self included) — frenzied ships gain +1 action but lose 1 hull each turn for 3 turns.', actionCost: 1, cooldown: 4 },
        // Human-only abilities
        torpedo:         { id: 'torpedo',         name: 'Torpedo',         desc: 'Launch a self-propelled torpedo that tracks the nearest enemy — detonates on contact or after 2 turns in a large blast.',     actionCost: 1, cooldown: 3 },
        salvage:         { id: 'salvage',         name: 'Salvage',         desc: 'Lock onto any destroyed allied ship — fully restore its hull and bring it back as a combat-ready vessel.',                    actionCost: 1, cooldown: 6 },
        // Alien-only
        neutralize:      { id: 'neutralize',      name: 'Neutralize',      desc: 'Target a point ahead — strips all status effects from ships in the blast and clears clouds in the area.',                      actionCost: 1, cooldown: 3 },
        gamma_ray:       { id: 'gamma_ray',       name: 'Gamma Ray',       desc: 'Emit a narrow energy cone forward — all ships and asteroids in the beam take 1–5 damage.',                                    actionCost: 1, cooldown: 2 },
    },
};
