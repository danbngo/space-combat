const CONSTANTS_MODULES = {
    MODULE_SLOTS: 2,

    MODULES: [
        { id: 'hull_plating',         name: 'Hull Plating',       cost: 150, desc: '+25 max hull',                                                                    effect: { stat: 'maxHull',    amount: 25 } },
        { id: 'shield_booster',       name: 'Shield Booster',     cost: 150, desc: '+20 max shields',                                                                  effect: { stat: 'maxShields', amount: 20 } },
        { id: 'targeting_sys',        name: 'Targeting System',   cost: 200, desc: '+2 radar',                                                                         effect: { stat: 'radar',      amount: 2  } },
        { id: 'engine_upgrade',       name: 'Engine Upgrade',     cost: 175, desc: '+15 engine power',                                                                  effect: { stat: 'engine',     amount: 15 } },
        { id: 'combat_ai',            name: 'Combat AI',          cost: 300, desc: '25% chance: +1 action at start of turn',                                           effect: { type: 'bonus_action', chance: 0.25 } },
        { id: 'blink_drive',          name: 'Blink Drive',        cost: 275, desc: 'Grants Blink: teleport up to 80px in any direction',                               effect: { type: 'special_move', move: 'blink' } },
        { id: 'afterburner_drive',    name: 'Afterburner',        cost: 300, desc: 'Grants Afterburner: straight-line dash at full range, damages enemies in path',    effect: { type: 'special_move', move: 'afterburner' } },
        { id: 'warhead_launcher',     name: 'Warhead Launcher',   cost: 350, desc: 'Grants Warhead: area-blast missile fired forward; damages + knocks back all ships in blast radius', effect: { type: 'special_move', move: 'warhead' } },
        { id: 'tractor_beam_emitter', name: 'Tractor Beam',       cost: 275, desc: 'Grants Tractor Beam: pull any ship in forward cone — target moves to midpoint, you move 50% there', effect: { type: 'special_move', move: 'tractor_beam' } },
        { id: 'emp_blast_drive',      name: 'EMP Blaster',        cost: 400, desc: 'Grants EMP Blast: instantly damages shields and maxes ability cooldowns on all ships within blast radius', effect: { type: 'special_move', move: 'emp_blast' } },
        { id: 'cloak_drive',          name: 'Cloak Drive',        cost: 450, desc: 'Grants Cloak: become untargetable by lasers and ramming for 2–4 rounds; revealed by taking damage or acting', effect: { type: 'special_move', move: 'cloak' } },
        { id: 'carrier_bay',          name: 'Carrier Bay',        cost: 0,   internal: true, desc: 'Deploy a combat drone that can move, shoot, and detonate', effect: { type: 'special_move', move: 'summon_drone' } },
        { id: 'drone_bay',            name: 'Drone Bay',          cost: 375, desc: 'Grants Deploy Drone: launch a combat drone that can move, shoot, and detonate. Expires in 3 turns.', effect: { type: 'special_move', move: 'summon_drone' } },
        { id: 'repair_bay',           name: 'Repair Bay',         cost: 400, desc: 'Grants Repair Beam: restore hull and shields to any allied ship in range',         effect: { type: 'special_move', move: 'repair_beam' } },
    ],
};
