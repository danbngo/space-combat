const CONSTANTS_CORE = {
    GAME_WIDTH:  800,
    GAME_HEIGHT: 600,
    COMBAT_ARENA_RADIUS: 400,

    PLAYER_STARTING_SHIPS:   1,
    PLAYER_STARTING_CREDITS: 500,
    DEFAULT_FLEET_SIZE: 1,       // base max fleet without any leadership perks (Leadership I-V each add 1, max 6)

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

    // Commander perks — each costs 1 perk point (earned by levelling up via EXP)
    // category: used to group perks on the screen
    PERKS: [
        // ── Leadership: +1 fleet slot per rank, max 6 ships (default 1) ──────────
        { id: 'leadership_1', category: 'Leadership', name: 'Leadership I',   requires: null,           desc: 'Recruit a second ship. Fleet capacity: 2.' },
        { id: 'leadership_2', category: 'Leadership', name: 'Leadership II',  requires: 'leadership_1', desc: 'Expand your fleet to 3 ships.' },
        { id: 'leadership_3', category: 'Leadership', name: 'Leadership III', requires: 'leadership_2', desc: 'Veteran commander. Fleet capacity: 4.' },
        { id: 'leadership_4', category: 'Leadership', name: 'Leadership IV',  requires: 'leadership_3', desc: 'Battle-hardened admiral. Fleet capacity: 5.' },
        { id: 'leadership_5', category: 'Leadership', name: 'Leadership V',   requires: 'leadership_4', desc: 'Legendary squadron leader. Maximum fleet capacity: 6.' },

        // ── Gunner: reduce max-range miss chance by 5% per rank (base 50%, min 25%) ──
        { id: 'gunner_1', category: 'Gunner', name: 'Gunner I',   requires: null,       desc: 'Combat training reduces long-range miss chance by 5% (45% at max range).' },
        { id: 'gunner_2', category: 'Gunner', name: 'Gunner II',  requires: 'gunner_1', desc: 'Improved targeting: 40% miss chance at max range.' },
        { id: 'gunner_3', category: 'Gunner', name: 'Gunner III', requires: 'gunner_2', desc: 'Expert marksman: 35% miss chance at max range.' },
        { id: 'gunner_4', category: 'Gunner', name: 'Gunner IV',  requires: 'gunner_3', desc: 'Elite gunner: 30% miss chance at max range.' },
        { id: 'gunner_5', category: 'Gunner', name: 'Gunner V',   requires: 'gunner_4', desc: 'Deadshot: miss chance capped at 25% even at maximum range.' },

        // ── Barter: -10% to all station prices per rank ──────────────────────────
        { id: 'barter_1', category: 'Barter', name: 'Barter I',   requires: null,       desc: 'Shrewd negotiator: 10% discount at all stations.' },
        { id: 'barter_2', category: 'Barter', name: 'Barter II',  requires: 'barter_1', desc: 'Skilled haggler: 20% discount at all stations.' },
        { id: 'barter_3', category: 'Barter', name: 'Barter III', requires: 'barter_2', desc: 'Trade veteran: 30% discount at all stations.' },
        { id: 'barter_4', category: 'Barter', name: 'Barter IV',  requires: 'barter_3', desc: 'Master dealer: 40% discount at all stations.' },
        { id: 'barter_5', category: 'Barter', name: 'Barter V',   requires: 'barter_4', desc: 'Market legend: 50% discount on everything, everywhere.' },

        // ── Salvaging: +20% credits from combat per rank ──────────────────────────
        { id: 'salvaging_1', category: 'Salvaging', name: 'Salvaging I',   requires: null,           desc: 'Efficient looter: +20% credits earned after combat.' },
        { id: 'salvaging_2', category: 'Salvaging', name: 'Salvaging II',  requires: 'salvaging_1',  desc: 'Practiced scavenger: +40% combat credits.' },
        { id: 'salvaging_3', category: 'Salvaging', name: 'Salvaging III', requires: 'salvaging_2',  desc: 'Fleet stripper: +60% combat credits.' },
        { id: 'salvaging_4', category: 'Salvaging', name: 'Salvaging IV',  requires: 'salvaging_3',  desc: 'Wreck expert: +80% combat credits.' },
        { id: 'salvaging_5', category: 'Salvaging', name: 'Salvaging V',   requires: 'salvaging_4',  desc: 'Total asset recovery: double credits from every combat.' },

        // ── Engineering: repair % of max hull after each combat ───────────────────
        { id: 'engineering_1', category: 'Engineering', name: 'Engineering I',   requires: null,               desc: 'Field repairs restore 20% of max hull after combat.' },
        { id: 'engineering_2', category: 'Engineering', name: 'Engineering II',  requires: 'engineering_1',    desc: 'Improved kit: 40% hull restored after combat.' },
        { id: 'engineering_3', category: 'Engineering', name: 'Engineering III', requires: 'engineering_2',    desc: 'Mobile workshop: 60% hull restored after combat.' },
        { id: 'engineering_4', category: 'Engineering', name: 'Engineering IV',  requires: 'engineering_3',    desc: 'Expert crew: 80% hull restored after combat.' },
        { id: 'engineering_5', category: 'Engineering', name: 'Engineering V',   requires: 'engineering_4',    desc: 'Full refit: hull is completely restored after every combat.' },
    ],
};
