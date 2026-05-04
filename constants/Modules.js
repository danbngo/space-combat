const CONSTANTS_MODULES = {
    MODULE_SLOTS: 2,

    MODULES: [
        { id: 'hull_plating',         name: 'Hull Plating',       cost: 150, desc: '+25 max hull',                                                                                          effect: { stat: 'maxHull',    amount: 25 } },
        { id: 'shield_booster',       name: 'Shield Booster',     cost: 150, desc: '+20 max shields',                                                                                        effect: { stat: 'maxShields', amount: 20 } },
        { id: 'targeting_sys',        name: 'Targeting System',   cost: 200, desc: '+2 radar — increases laser accuracy and range',                                                          effect: { stat: 'radar',      amount: 2  } },
        { id: 'engine_upgrade',       name: 'Engine Upgrade',     cost: 175, desc: '+15 engine — increases movement range and ram damage',                                                   effect: { stat: 'engine',     amount: 15 } },
        { id: 'combat_ai',            name: 'Combat AI',          cost: 300, desc: '25% chance to gain a bonus action at the start of each turn',                                           effect: { type: 'bonus_action', chance: 0.25 } },
        { id: 'blink_drive',          name: 'Blink Drive',        cost: 275, desc: 'Grants Blink: instantly teleport up to 80px in any direction — bypasses all obstacles',                 effect: { type: 'special_move', move: 'blink' } },
        { id: 'afterburner_drive',    name: 'Afterburner',        cost: 300, desc: 'Grants Afterburner: 2.5× range straight-line dash that deals engine damage to ships caught in your path', effect: { type: 'special_move', move: 'afterburner' } },
        { id: 'bomb_launcher',        name: 'Bomb Launcher',      cost: 350, desc: 'Grants Bomb: drop a stationary bomb ahead — survives 2 enemy turns before detonating in a large blast that damages and knocks back everything nearby', effect: { type: 'special_move', move: 'bomb' } },
        { id: 'tractor_beam_emitter', name: 'Tractor Beam',       cost: 275, desc: 'Grants Tractor Beam: lock onto any ship or asteroid in the forward cone and yank it toward you',       effect: { type: 'special_move', move: 'tractor_beam' } },
        { id: 'emp_blast_drive',      name: 'EMP Blaster',        cost: 400, desc: 'Grants EMP Blast: launch a targeted EMP that drains shields and locks all abilities on ships in the blast radius', effect: { type: 'special_move', move: 'emp_blast' } },
        { id: 'cloak_drive',          name: 'Cloak Drive',        cost: 450, desc: 'Grants Cloak: turn invisible for 2–4 turns — immune to lasers and ramming; revealed by damage or taking any action', effect: { type: 'special_move', move: 'cloak' } },
        { id: 'drone_bay',            name: 'Drone Bay',          cost: 375, desc: 'Grants Deploy Drone: launch a combat drone beside you — it acts independently, can move and shoot, and expires after 4 turns', effect: { type: 'special_move', move: 'summon_drone' } },
        { id: 'repair_bay',           name: 'Repair Bay',         cost: 400, desc: 'Grants Repair Beam: emit a healing beam in a forward 90° cone — restores hull on all allies in range', effect: { type: 'special_move', move: 'repair_beam' } },
        { id: 'flash_emitter',        name: 'Flash Emitter',      cost: 375, desc: 'Grants Flash: fire a blinding burst at a target point within 80px — deals 1 damage and blinds all ships in the blast for 2 turns (blinded ships cannot fire)', effect: { type: 'special_move', move: 'flash' } },
        { id: 'supercharge_drive',    name: 'Supercharge Drive',  cost: 400, desc: 'Grants Supercharge: fully restore an ally\'s shields and boost them for 1 turn — 2× move range, 2× laser damage, 2× laser range', effect: { type: 'special_move', move: 'supercharge' } },
        { id: 'hack_module',          name: 'Hack Module',        cost: 400, desc: 'Grants Hack: seize control of any ship within 28px — it goes berserk for 2 turns, wildly attacking any nearby ship with 2× actions', effect: { type: 'special_move', move: 'hack' } },
        { id: 'debris_launcher',      name: 'Debris Launcher',    cost: 325, desc: 'Grants Debris Field: hurl 3–5 small asteroids in a forward 90° cone — each one travels fast and damages ships it hits', effect: { type: 'special_move', move: 'debris_field' } },
        { id: 'mark_module',          name: 'Target Designator',  cost: 375, desc: 'Grants Mark: paint a ship in the forward 90° cone as a priority target — all laser shots against it auto-hit for 3 turns', effect: { type: 'special_move', move: 'mark' } },
    ],
};
