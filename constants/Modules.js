const CONSTANTS_MODULES = {
    MODULE_SLOTS: 2,

    HULL_REGEN_AMOUNT:   1,   // hull restored per round
    SHIELD_REGEN_AMOUNT: 2,   // shields restored per round
    REPULSOR_KNOCKBACK:  20,  // px push on laser hit
    DEBRIS_MOMENTUM:     15,  // px ship lurches forward on debris launch

    MODULES: [
        { id: 'combat_ai',            name: 'Combat AI',          cost: 300, desc: '25% chance to gain a bonus action at the start of each turn',                                           effect: { type: 'bonus_action', chance: 0.25 } },
        { id: 'blink_drive',          name: 'Blink Drive',        cost: 275, desc: 'Grants Blink: instantly teleport a short distance in any direction — bypasses all obstacles',          effect: { type: 'special_move', move: 'blink' }, internal: true },
        { id: 'afterburner_drive',    name: 'Afterburner',        cost: 300, desc: 'Grants Afterburner: 2.5× range straight-line dash that deals engine damage to ships caught in your path', effect: { type: 'special_move', move: 'afterburner' } },
        { id: 'bomb_launcher',        name: 'Bomb Launcher',      cost: 350, desc: 'Grants Bomb: drop a stationary bomb ahead — survives 2 enemy turns before detonating in a large blast that damages and knocks back everything nearby', effect: { type: 'special_move', move: 'bomb' } },
        { id: 'tractor_beam_emitter', name: 'Tractor Beam',       cost: 275, desc: 'Grants Tractor Beam: lock onto any ship or asteroid in the forward cone and yank it toward you',       effect: { type: 'special_move', move: 'tractor_beam' } },
        { id: 'emp_blast_drive',      name: 'EMP Blaster',        cost: 400, desc: 'Grants EMP Blast: launch a targeted EMP that drains shields and locks all abilities on ships in the blast radius', effect: { type: 'special_move', move: 'emp_blast' } },
        { id: 'cloak_drive',          name: 'Cloak Drive',        cost: 450, desc: 'Grants Cloak: turn invisible for 2–4 turns — immune to lasers and ramming; revealed by damage or taking any action', effect: { type: 'special_move', move: 'cloak' } },
        { id: 'drone_bay',            name: 'Drone Bay',          cost: 375, desc: 'Grants Deploy Drone: launch a combat drone beside you — it acts independently, can move and shoot, and expires after 4 turns', effect: { type: 'special_move', move: 'summon_drone' } },
        { id: 'repair_bay',           name: 'Repair Bay',         cost: 400, desc: 'Grants Repair Beam: emit a healing beam in a forward 90° cone — restores hull on all allies in range', effect: { type: 'special_move', move: 'repair_beam' } },
        { id: 'flash_emitter',        name: 'Flash Emitter',      cost: 375, desc: 'Grants Flash: fire a blinding burst at a target point within range — deals 1–3 damage and blinds all ships in the blast for 2 turns (blinded ships cannot fire)', effect: { type: 'special_move', move: 'flash' } },
        { id: 'supercharge_drive',    name: 'Supercharge Drive',  cost: 400, desc: 'Grants Supercharge: fully restore an ally\'s shields and boost them for 1 turn — 2× move range, 2× laser damage, 2× laser range', effect: { type: 'special_move', move: 'supercharge' } },
        { id: 'torpedo_launcher',     name: 'Torpedo Launcher',   cost: 375, desc: 'Grants Torpedo: launch a self-guided warhead that tracks the nearest enemy — detonates on contact or after 2 turns in a large blast',  effect: { type: 'special_move', move: 'torpedo' } },
        { id: 'salvage_module',       name: 'Salvage Module',     cost: 400, desc: 'Grants Salvage: lock onto a destroyed allied ship — fully restore its hull and revive it as a combat-ready vessel',              effect: { type: 'special_move', move: 'salvage' } },
        { id: 'debris_launcher',      name: 'Debris Launcher',    cost: 325, desc: 'Grants Debris Field: hurl 3–5 small asteroids in a forward 90° cone — each one travels fast and damages ships it hits', effect: { type: 'special_move', move: 'debris_field' } },
        { id: 'mark_module',          name: 'Target Designator',  cost: 375, desc: 'Grants Mark: paint a ship in the forward 90° cone as a priority target — all laser shots against it auto-hit for 3 turns', effect: { type: 'special_move', move: 'mark' } },
        { id: 'chaingun_mount',       name: 'Chaingun Mount',      cost: 275, desc: 'Grants Chaingun: fires 3 rounds separately — each bypasses shields, deals 50% laser damage, and has 2× the normal miss chance.', effect: { type: 'special_move', move: 'chaingun' },   exclusiveGroup: 'weapon' },
        { id: 'plasma_cannon_mount',  name: 'Plasma Cannon',       cost: 300, desc: 'Grants Plasma Cannon: half range, rolls separate shield and hull damage simultaneously — both apply regardless of shield level.',            effect: { type: 'special_move', move: 'plasma_cannon' }, exclusiveGroup: 'weapon' },
        { id: 'rocket_pod',           name: 'Rocket Pod',          cost: 350, desc: 'Grants Rockets: guaranteed-hit warhead at a target area — laser damage to all ships in the blast radius. 1-turn cooldown.', effect: { type: 'special_move', move: 'rocket_launcher' }, exclusiveGroup: 'weapon' },
        { id: 'cargo_bay',            name: 'Cargo Bay',           cost: 200, desc: '+1 cargo capacity — allows carrying one additional item into combat.',                                effect: { type: 'cargo_increase',    amount: 1    } },
        { id: 'hull_regen_bay',       name: 'Hull Regen Bay',      cost: 225, desc: '+1 hull per round — steadily repairs battle damage each new round',                                         effect: { type: 'hull_regen',        amount: 1    }, internal: true },
        { id: 'shield_regen_coil',    name: 'Shield Regen Coil',   cost: 225, desc: '+2 shields per round — supplemental shield recovery each round',                                         effect: { type: 'shield_regen',      amount: 2    } },
        { id: 'collision_dampeners',  name: 'Collision Dampeners', cost: 250, desc: 'Immune to all hull damage from collisions and ramming — takes knockback but no damage',                  effect: { type: 'collision_immune'               }, exclusiveGroup: 'defense' },
        { id: 'deflector_array',      name: 'Deflector Array',     cost: 325, desc: '20% chance to reflect any incoming laser shot back at the attacker before it hits you',                  effect: { type: 'reflect_projectile'             }, exclusiveGroup: 'defense' },
        { id: 'repulsor_array',       name: 'Repulsor Array',      cost: 300, desc: 'Each laser hit knocks the target back slightly.',                                                           effect: { type: 'repulsor'                       }, internal: true, exclusiveGroup: 'weapon' },
        { id: 'anchor_launcher',      name: 'Anchor Launcher',     cost: 325, desc: 'Grants Anchor: lock a ship in the forward cone in place for 2 turns — it cannot move or be knocked back', effect: { type: 'special_move', move: 'anchor' }, internal: true },
        { id: 'siphon_array',         name: 'Siphon Array',        cost: 350, desc: 'Grants Siphon: drain 5–10 shields from any nearby ship and add 1 cooldown to all of its abilities',       effect: { type: 'special_move', move: 'siphon' }, internal: true },
        // Alien-only modules (internal: true — never shown in shops, cost is irrelevant)
        { id: 'alien_blink',          name: 'Blink',               cost: 0,   desc: 'Teleport a short distance in any direction, bypassing all obstacles.',   effect: { type: 'special_move', move: 'blink'          }, internal: true },
        { id: 'alien_swap',           name: 'Swap Drive',          cost: 0,   desc: 'Instantly swap positions with any ship within range.',                    effect: { type: 'special_move', move: 'swap'           }, internal: true },
        { id: 'alien_mirror',         name: 'Mirror Generator',    cost: 0,   desc: 'Spawn an identical copy that lasts 2 turns.',                             effect: { type: 'special_move', move: 'summon_mirror'  }, internal: true },
        { id: 'alien_doom',           name: 'Doom Protocol',       cost: 0,   desc: 'Mark self for destruction — detonates in a small blast next round.',      effect: { type: 'special_move', move: 'doom'           }, internal: true },
        { id: 'alien_phase',          name: 'Phase Projector',     cost: 0,   desc: 'Become untargetable and invincible for 2 turns — cancelled by acting.',   effect: { type: 'special_move', move: 'phase'          }, internal: true },
        { id: 'alien_absorb',         name: 'Absorb Array',        cost: 0,   desc: 'Drain hull from all nearby ships — cannot reduce targets below 1.',       effect: { type: 'special_move', move: 'absorb'         }, internal: true },
        { id: 'alien_teleport',       name: 'Teleport Core',       cost: 0,   desc: 'Instantly move to a random position within the arena.',                   effect: { type: 'special_move', move: 'teleport'       }, internal: true },
        { id: 'alien_stasis',         name: 'Stasis Emitter',      cost: 0,   desc: 'Create a stasis cloud nearby — ships inside cannot act or take damage.',  effect: { type: 'special_move', move: 'stasis_field'   }, internal: true },
        { id: 'alien_ravager',        name: 'Ravager Beam',        cost: 0,   desc: 'Half-range laser that heals the attacker by the amount of damage dealt.', effect: { type: 'ravager'  }, internal: true, exclusiveGroup: 'weapon' },
        { id: 'alien_scatter',        name: 'Scatter Field',       cost: 0,   desc: '50% chance to mini-teleport a short distance away when hit by a weapon or ram.', effect: { type: 'scatter'  }, internal: true, exclusiveGroup: 'defense' },
        { id: 'alien_attractor',      name: 'Attractor Array',     cost: 0,   desc: 'Each laser hit pulls the target toward the shooter.',                       effect: { type: 'attractor' }, internal: true, exclusiveGroup: 'weapon' },
        { id: 'possess_module',       name: 'Possess Module',      cost: 0,   desc: 'Grants Possess: seize control of any ship within close range — it goes berserk for 2 turns, attacking any nearby ship with 2× actions.', effect: { type: 'special_move', move: 'possess' }, internal: true },
        { id: 'alien_swarm',          name: 'Swarm Launcher',      cost: 0,   desc: 'Release 5 swarmlets that independently track and ram the nearest enemy, dying on impact. Expire after 3 turns.', effect: { type: 'special_move', move: 'swarm' }, internal: true },
        { id: 'alien_webbing',        name: 'Web Caster',          cost: 0,   desc: 'Launch a web at a target point — all ships in the blast radius are slowed to half speed for 3 turns.', effect: { type: 'special_move', move: 'webbing' }, internal: true },
        { id: 'alien_timeslip',       name: 'Timeslip Core',       cost: 0,   desc: 'Mark a nearby ship — in 2 turns it resets to its current position, hull, shields and cooldowns.', effect: { type: 'special_move', move: 'timeslip' }, internal: true },
        { id: 'alien_frenzy',         name: 'Frenzy Emitter',      cost: 0,   desc: 'Induce frenzy in ships in the forward arc — frenzied ships gain +1 action but cannot use abilities, and take 5 damage when it wears off.', effect: { type: 'special_move', move: 'frenzy' }, internal: true },
        { id: 'alien_neutralize',     name: 'Neutralizer',         cost: 0,   desc: 'Target a point ahead — strips all status effects from ships in the blast and clears clouds in the area.',                                             effect: { type: 'special_move', move: 'neutralize' }, internal: true },
        { id: 'alien_gamma_ray',      name: 'Gamma Emitter',       cost: 0,   desc: 'Emit a narrow energy cone forward — all ships and asteroids in the beam take 1–5 damage.',                                                           effect: { type: 'special_move', move: 'gamma_ray' }, internal: true },
    ],

    // Preferred module pools per faction — used when giving enemy ships modules at higher tiers
    FACTION_MODULES: {
        pirates:   ['chaingun_mount', 'afterburner_drive', 'bomb_launcher', 'rocket_pod', 'deflector_array', 'plasma_cannon_mount'],
        merchants: ['hull_regen_bay', 'shield_regen_coil', 'repair_bay', 'drone_bay', 'collision_dampeners'],
        police:    ['mark_module', 'emp_blast_drive', 'tractor_beam_emitter', 'flash_emitter', 'deflector_array', 'combat_ai'],
        soldiers:  ['rocket_pod', 'collision_dampeners', 'plasma_cannon_mount', 'mark_module', 'torpedo_launcher'],
        smugglers: ['cloak_drive', 'afterburner_drive', 'debris_launcher', 'flash_emitter', 'collision_dampeners', 'salvage_module', 'torpedo_launcher'],
        aliens:    ['alien_blink', 'alien_swap', 'alien_mirror', 'alien_doom', 'alien_phase', 'alien_absorb', 'alien_teleport', 'alien_stasis', 'alien_ravager', 'alien_scatter', 'alien_attractor', 'possess_module', 'alien_swarm', 'alien_webbing', 'alien_timeslip', 'alien_frenzy', 'alien_neutralize', 'alien_gamma_ray'],
    },
};
