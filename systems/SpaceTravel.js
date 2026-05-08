// Space Travel System
class SpaceTravel {

    // ── Tree generation ──────────────────────────────────────────────────────

    static generateTree() {
        const TIERS      = CONSTANTS.TREE_TIERS;       // 16
        const QUEEN_TIER = CONSTANTS.TREE_QUEEN_TIER;  // 15
        const W          = CONSTANTS.GALAXY_WIDTH;
        const H          = CONSTANTS.GALAXY_HEIGHT;
        const X_START    = 100;
        const X_END      = W - 100;
        const tierStep   = (X_END - X_START) / (TIERS - 1);

        const systems = [];
        const byTier  = [];
        let   nextId  = 0;

        // ── Place nodes tier by tier ─────────────────────────────────────────
        for (let tier = 0; tier < TIERS; tier++) {
            byTier.push([]);

            const nodeCount = (tier === 0 || tier === QUEEN_TIER)
                ? 1
                : randomInt(CONSTANTS.TREE_NODES_MIN, CONSTANTS.TREE_NODES_MAX);

            const baseX = X_START + tier * tierStep;

            for (let j = 0; j < nodeCount; j++) {
                // Spread nodes evenly in Y, from 80 to H-80
                const yBase = nodeCount === 1
                    ? H / 2
                    : 80 + (j / (nodeCount - 1)) * (H - 160);
                const y = Math.max(60, Math.min(H - 60, yBase + randomInt(-20, 20)));
                const x = baseX + randomInt(-12, 12);

                // Venue probabilities — scale linearly with tier fraction
                const tierFrac = tier < QUEEN_TIER ? tier / (QUEEN_TIER - 1) : 1;
                const lerp = (a, b) => a + tierFrac * (b - a);

                const sys = {
                    id:   nextId++,
                    name: getRandomSystemName(),
                    tier,
                    x,
                    y,
                    visited:  false,
                    seen:     false,
                    connections: [],   // forward edges to children only
                    parentId: null,
                    isQueenPlanet: tier === QUEEN_TIER,

                    // Every non-queen system has a dock (repair)
                    hasRepair:     tier < QUEEN_TIER,
                    hasShipyard:   tier < QUEEN_TIER && Math.random() < lerp(CONSTANTS.VENUE_SHIPYARD_BASE,   CONSTANTS.VENUE_SHIPYARD_MAX),
                    hasMechanic:   tier < QUEEN_TIER && Math.random() < lerp(CONSTANTS.VENUE_MECHANIC_BASE,   CONSTANTS.VENUE_MECHANIC_MAX),
                    hasCourthouse: tier < QUEEN_TIER && Math.random() < lerp(CONSTANTS.VENUE_COURTHOUSE_BASE, CONSTANTS.VENUE_COURTHOUSE_MAX),
                };

                byTier[tier].push(sys);
                systems.push(sys);
            }
        }

        // ── Wire forward connections tier by tier ────────────────────────────
        const routes = new Map();

        for (let tier = 0; tier < TIERS - 1; tier++) {
            const parents  = byTier[tier];
            const children = byTier[tier + 1];

            // Track which children have been connected
            const connected = new Set();

            // Each parent branches to 1–BRANCHES_MAX children (closest by Y first)
            for (const parent of parents) {
                const maxBranches = Math.min(
                    randomInt(CONSTANTS.TREE_BRANCHES_MIN, CONSTANTS.TREE_BRANCHES_MAX),
                    children.length
                );
                const sorted = [...children].sort((a, b) => Math.abs(a.y - parent.y) - Math.abs(b.y - parent.y));
                let branches = 0;
                for (const child of sorted) {
                    if (branches >= maxBranches) break;
                    if (!parent.connections.includes(child.id)) {
                        parent.connections.push(child.id);
                        if (child.parentId === null) child.parentId = parent.id;
                        connected.add(child.id);
                        routes.set(getRouteKey(parent.id, child.id), this.generateRouteData(tier + 1));
                        branches++;
                    }
                }
            }

            // Ensure every child has at least one parent
            for (const child of children) {
                if (!connected.has(child.id)) {
                    const closest = parents.reduce((a, b) =>
                        Math.abs(a.y - child.y) < Math.abs(b.y - child.y) ? a : b
                    );
                    if (!closest.connections.includes(child.id)) {
                        closest.connections.push(child.id);
                        if (child.parentId === null) child.parentId = closest.id;
                        routes.set(getRouteKey(closest.id, child.id), this.generateRouteData(tier + 1));
                    }
                }
            }
        }

        return { systems, routes };
    }

    // Build route metadata for a route whose destination is at `destinationTier`
    static generateRouteData(destinationTier) {
        const QUEEN_TIER = CONSTANTS.TREE_QUEEN_TIER;
        const tierFrac   = destinationTier / QUEEN_TIER;  // 0.0–1.0

        // Fleet strength ramps from 1 to 10 across tiers
        const base     = CONSTANTS.FLEET_STRENGTH_BASE + Math.floor(tierFrac * (CONSTANTS.FLEET_STRENGTH_MAX - CONSTANTS.FLEET_STRENGTH_BASE));
        const jitter   = randomInt(-CONSTANTS.FLEET_STRENGTH_JITTER, CONSTANTS.FLEET_STRENGTH_JITTER);
        const strength = Math.max(1, Math.min(CONSTANTS.FLEET_STRENGTH_MAX, base + jitter));

        // Max encounter slots scale with tier (1 at tier 1, up to ROUTE_MAX_ENCOUNTERS)
        const maxEncounters = Math.max(1, Math.round(1 + (tierFrac * (CONSTANTS.ROUTE_MAX_ENCOUNTERS - 1))));

        // Faction weights: humans dominate early, aliens ramp in from tier ALIEN_WEIGHT_START_TIER
        const alienStart = CONSTANTS.ALIEN_WEIGHT_START_TIER;
        const alienFrac  = destinationTier >= alienStart
            ? Math.pow((destinationTier - alienStart) / (QUEEN_TIER - alienStart), 1.4)
            : 0;
        const alienWeight = alienFrac * 80;
        const humanPool   = Math.max(0, 100 - alienWeight);

        const factionWeights = {
            pirates:   humanPool * 0.28,
            merchants: humanPool * 0.20,
            police:    humanPool * 0.22,
            soldiers:  humanPool * 0.10,
            smugglers: humanPool * 0.20,
            aliens:    alienWeight,
        };

        // Hazard intensity scales with tier (fed to combat in a future pass)
        const hazardChance = 0.1 + tierFrac * 0.7;

        const isQueenRoute = destinationTier === QUEEN_TIER;

        return { destinationTier, fleetStrength: strength, maxEncounters, factionWeights, hazardChance, isQueenRoute };
    }

    // Roll encounters for a route at travel time — returns array sorted by _crossT
    static rollEncountersForRoute(routeData) {
        if (routeData.isQueenRoute) {
            return [{
                faction: 'aliens',
                isQueenFight: true,
                isAlien: true,
                size: 5,
                fleetStrength: CONSTANTS.FLEET_STRENGTH_MAX,
                _crossT: 0.5,
            }];
        }

        const { fleetStrength, maxEncounters, factionWeights } = routeData;
        const encounterChance = CONSTANTS.ENCOUNTER_CHANCE_BASE
            + (fleetStrength / CONSTANTS.FLEET_STRENGTH_MAX) * (CONSTANTS.ENCOUNTER_CHANCE_MAX - CONSTANTS.ENCOUNTER_CHANCE_BASE);

        const encounters = [];
        const span = 0.70;
        const step = span / maxEncounters;

        for (let i = 0; i < maxEncounters; i++) {
            if (Math.random() > encounterChance) continue;

            const baseT = 0.15 + step * i + step * 0.1 + Math.random() * step * 0.8;
            const crossT = Math.min(0.85, Math.max(0.15, baseT));

            // Weighted faction roll
            const totalWeight = Object.values(factionWeights).reduce((a, b) => a + b, 0);
            let r = Math.random() * totalWeight;
            let faction = 'pirates';
            for (const [f, w] of Object.entries(factionWeights)) {
                r -= w;
                if (r <= 0) { faction = f; break; }
            }

            // Fleet size from strength
            const size = fleetStrength <= 3 ? randomInt(1, 2)
                       : fleetStrength <= 6 ? randomInt(2, 4)
                       : randomInt(3, 6);

            encounters.push({ faction, size, fleetStrength, _crossT: crossT });
        }

        // Guarantee at least one encounter
        if (encounters.length === 0) {
            const totalWeight = Object.values(factionWeights).reduce((a, b) => a + b, 0);
            let r = Math.random() * totalWeight;
            let faction = 'pirates';
            for (const [f, w] of Object.entries(factionWeights)) {
                r -= w;
                if (r <= 0) { faction = f; break; }
            }
            const size = fleetStrength <= 3 ? randomInt(1, 2)
                       : fleetStrength <= 6 ? randomInt(2, 4)
                       : randomInt(3, 6);
            encounters.push({ faction, size, fleetStrength, _crossT: 0.15 + Math.random() * 0.70 });
        }

        return encounters.sort((a, b) => a._crossT - b._crossT);
    }

    // ── Starting system ──────────────────────────────────────────────────────

    static initializeStartingSystem(systems) {
        const start = systems.find(s => s.tier === 0) || systems[0];
        start.visited = true;
        this.revealFromTier(systems, 0);
        return start;
    }

    // Reveal all systems up to tier `fromTier + 2`
    static revealFromTier(systems, fromTier) {
        const revealUpTo = fromTier + 2;
        systems.forEach(s => {
            if (s.tier <= revealUpTo) s.seen = true;
        });
    }

    // ── Travel helpers ───────────────────────────────────────────────────────

    static travelToSystem(fromSystem, toSystem) {
        toSystem.visited = true;
    }

    static getReachableSystems(fromSystem, allSystems) {
        return allSystems.filter(sys => (fromSystem.connections || []).includes(sys.id));
    }

    // ── Enemy fleet generation ───────────────────────────────────────────────

    static generateEnemyFleet(encounter) {
        const faction     = encounter && encounter.faction ? encounter.faction : null;
        const strength    = encounter && encounter.fleetStrength ? encounter.fleetStrength : 3;
        const factionData = faction ? CONSTANTS.FACTIONS.find(f => f.id === faction) : null;
        const factionColor = factionData ? factionData.color : null;

        // Queen fight — fixed fleet
        if (encounter && encounter.isQueenFight) {
            const fleet = [];
            const queen = this.generateShipOfType('Alien Queen');
            if (factionColor) queen.factionColor = factionColor;
            fleet.push(queen);
            for (const type of ['Alien Titan', 'Alien Stalker', 'Alien Ravager', 'Alien Phantom']) {
                const s = this.generateShipOfType(type);
                if (factionColor) s.factionColor = factionColor;
                fleet.push(s);
            }
            assignFleetNames(fleet);
            return fleet;
        }

        // Tiered ship pool by fleet strength
        const strengthTier = strength <= 3 ? 'low' : strength <= 6 ? 'mid' : 'high';
        const pools = CONSTANTS.FACTION_SHIP_POOLS[faction];
        const pool  = (pools && pools[strengthTier]) || (factionData && factionData.shipTypes) || ['Corvette'];

        const size = encounter && encounter.size ? encounter.size : (strength <= 3 ? randomInt(1, 2) : strength <= 6 ? randomInt(2, 4) : randomInt(3, 6));

        // Module chance ramps from 0 at strength 2 to 1.0 at strength 10
        const moduleChance = Math.max(0, (strength - 2) / 8);
        const factionModulePool = (CONSTANTS.FACTION_MODULES || {})[faction] || [];

        const fleet = [];
        for (let i = 0; i < size; i++) {
            const type = pool[Math.floor(Math.random() * pool.length)];
            const ship = this.generateShipOfType(type);
            if (factionColor) ship.factionColor = factionColor;

            // Equip modules — try each slot independently
            if (factionModulePool.length > 0) {
                const slotCount = ship.moduleSlots || CONSTANTS.MODULE_SLOTS;
                for (let slot = 0; slot < slotCount; slot++) {
                    if (Math.random() > moduleChance) continue;
                    // Pick a random module from the pool that isn't already installed and doesn't conflict
                    const shuffled = factionModulePool.slice().sort(() => Math.random() - 0.5);
                    for (const modId of shuffled) {
                        const modDef = CONSTANTS.MODULES.find(m => m.id === modId);
                        if (!modDef || ship.modules.some(m => m.id === modId)) continue;
                        if (modDef.exclusiveGroup && ship.modules.some(m => {
                            const d = CONSTANTS.MODULES.find(md => md.id === m.id);
                            return d && d.exclusiveGroup === modDef.exclusiveGroup;
                        })) continue;
                        ship.installModule(modDef, 1.0);
                        break;
                    }
                }
            }

            fleet.push(ship);
        }
        assignFleetNames(fleet);
        return fleet;
    }

    // Instantiate a Ship of a specific type with randomised stats.
    static generateShipOfType(typeName) {
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === typeName);
        if (!typeData) return new Ship(0, 0, false);
        const stats = {
            type:    typeName,
            hull:    Math.max(1, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.HULL_MIN,    CONSTANTS.SHIP_STATS.HULL_MAX)    * typeData.hullMult)),
            shields: Math.max(0, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.SHIELDS_MIN, CONSTANTS.SHIP_STATS.SHIELDS_MAX) * typeData.shieldMult)),
            laser:   Math.max(1, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.LASER_MIN,   CONSTANTS.SHIP_STATS.LASER_MAX)   * typeData.laserMult)),
            radar:   Math.max(1, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.RADAR_MIN,   CONSTANTS.SHIP_STATS.RADAR_MAX)   * typeData.radarMult)),
            engine:  Math.max(5, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.ENGINE_MIN,  CONSTANTS.SHIP_STATS.ENGINE_MAX)  * typeData.engineMult)),
        };
        return new Ship(0, 0, false, 0, stats);
    }
}
