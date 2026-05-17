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

        // Symmetric ramp: 1,2,3,4,...,4,3,2,1 (tier 0=start, QUEEN_TIER=queen).
        // Each station has at most 2 routes out, so cap children to parentCount*2.
        const nodeCountForTier = (tier) => Math.min(4, tier + 1, QUEEN_TIER - tier + 1);

        // ── Place nodes tier by tier ─────────────────────────────────────────
        for (let tier = 0; tier < TIERS; tier++) {
            byTier.push([]);

            // Cap so orphan-fix can never push a parent past 2 connections.
            const maxFromParents = tier === 0 ? 1 : byTier[tier - 1].length * 2;
            const nodeCount = (tier === 0 || tier === QUEEN_TIER)
                ? 1
                : Math.min(nodeCountForTier(tier), maxFromParents);

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

                    // Each non-queen system is exactly one type of station
                    stationType: tier < QUEEN_TIER
                        ? ['shipyard', 'blackmarket', 'mechanic', 'courthouse', 'marketplace'][Math.floor(Math.random() * 5)]
                        : null,
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

            // Each parent connects to 1 or 2 closest children
            for (const parent of parents) {
                const maxBranches = Math.min(randomInt(1, 2), children.length);
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

            // Ensure every child has at least one parent.
            // Prefer parents that still have room (< 2 connections) to stay within the cap.
            for (const child of children) {
                if (!connected.has(child.id)) {
                    const pool = parents.filter(p => p.connections.length < 2);
                    const candidates = pool.length > 0 ? pool : parents;
                    const closest = candidates.reduce((a, b) =>
                        Math.abs(a.y - child.y) < Math.abs(b.y - child.y) ? a : b
                    );
                    if (!closest.connections.includes(child.id)) {
                        closest.connections.push(child.id);
                        if (child.parentId === null) child.parentId = closest.id;
                        routes.set(getRouteKey(closest.id, child.id), this.generateRouteData(tier + 1));
                        connected.add(child.id);
                    }
                }
            }
        }

        this.removeCrossings(systems, routes);
        return { systems, routes };
    }

    // Post-process: remove all crossing edges between adjacent tiers by swapping destinations.
    // Two edges (A→B) and (C→D) cross when their source Y-order and destination Y-order differ.
    // Swapping to (A→D) and (C→B) eliminates the crossing without changing connectivity.
    static removeCrossings(systems, routes) {
        const systemMap = new Map(systems.map(s => [s.id, s]));

        const byTier = new Map();
        for (const sys of systems) {
            if (!byTier.has(sys.tier)) byTier.set(sys.tier, []);
            byTier.get(sys.tier).push(sys);
        }

        const tiers = [...byTier.keys()].sort((a, b) => a - b);

        for (let ti = 0; ti < tiers.length - 1; ti++) {
            const dstTier = tiers[ti + 1];

            // Collect all forward edges for this tier pair
            const edges = [];
            for (const src of (byTier.get(tiers[ti]) || [])) {
                for (const dstId of src.connections) {
                    const dst = systemMap.get(dstId);
                    if (dst && dst.tier === dstTier) edges.push({ src, dst });
                }
            }

            // Iteratively swap any crossing pair until the tier is crossing-free
            let changed = true;
            while (changed) {
                changed = false;
                for (let i = 0; i < edges.length; i++) {
                    for (let j = i + 1; j < edges.length; j++) {
                        const e1 = edges[i], e2 = edges[j];
                        if (e1.src === e2.src || e1.dst === e2.dst) continue;

                        // Crossing: source order and destination order are inverted
                        const srcOrder = e1.src.y < e2.src.y;
                        const dstOrder = e1.dst.y < e2.dst.y;
                        if (srcOrder === dstOrder) continue;

                        // Skip if the swap would introduce duplicate connections
                        if (e1.src.connections.includes(e2.dst.id) ||
                            e2.src.connections.includes(e1.dst.id)) continue;

                        // Swap destinations in the connection arrays
                        const d1 = e1.dst, d2 = e2.dst;
                        e1.src.connections = e1.src.connections.map(id => id === d1.id ? d2.id : id);
                        e2.src.connections = e2.src.connections.map(id => id === d2.id ? d1.id : id);

                        // Migrate route data to the new keys
                        const k1 = getRouteKey(e1.src.id, d1.id), k2 = getRouteKey(e2.src.id, d2.id);
                        const rd1 = routes.get(k1), rd2 = routes.get(k2);
                        routes.delete(k1); routes.delete(k2);
                        if (rd1) routes.set(getRouteKey(e1.src.id, d2.id), rd1);
                        if (rd2) routes.set(getRouteKey(e2.src.id, d1.id), rd2);

                        e1.dst = d2;
                        e2.dst = d1;
                        changed = true;
                    }
                }
            }
        }
    }

    // Build route metadata for a route whose destination is at `destinationTier`
    static generateRouteData(destinationTier) {
        const QUEEN_TIER = CONSTANTS.TREE_QUEEN_TIER;
        const tierFrac   = destinationTier / QUEEN_TIER;  // 0.0–1.0

        // Fleet strength ramps from 1 to 10 across tiers
        const base     = CONSTANTS.FLEET_STRENGTH_BASE + Math.floor(tierFrac * (CONSTANTS.FLEET_STRENGTH_MAX - CONSTANTS.FLEET_STRENGTH_BASE));
        const jitter   = randomInt(-CONSTANTS.FLEET_STRENGTH_JITTER, CONSTANTS.FLEET_STRENGTH_JITTER);
        const strength = Math.max(1, Math.min(CONSTANTS.FLEET_STRENGTH_MAX, base + jitter));

        // Encounter count by quarter of the run (Q1 easiest, Q4 hardest)
        const quarter = Math.floor((destinationTier - 1) * 4 / QUEEN_TIER); // 0–3
        const encRanges = [[1,2],[1,3],[3,4],[4,5]];
        const [minEnc, maxEnc] = encRanges[Math.min(quarter, 3)];
        const maxEncounters = randomInt(minEnc, maxEnc);

        // Faction weights: aliens ramp linearly from 0 at ALIEN_WEIGHT_START_TIER to 100% at QUEEN_TIER
        const alienStart  = CONSTANTS.ALIEN_WEIGHT_START_TIER;
        const alienWeight = destinationTier >= alienStart
            ? Math.min(100, ((destinationTier - alienStart) / (QUEEN_TIER - alienStart)) * 100)
            : 0;
        const humanPool = Math.max(0, 100 - alienWeight);

        const factionWeights = {
            pirates:   humanPool * 0.28,
            merchants: humanPool * 0.20,
            police:    humanPool * 0.22,
            soldiers:  humanPool * 0.10,
            smugglers: humanPool * 0.20,
            aliens:    alienWeight,
        };

        // Hazard flags — rolled once per route, applied to every encounter on that route.
        // Tier 0–1: no hazards. Scales to 33/33/33 (0/1/2) at mid-tier, 100% 2 at queen tier.
        // 2 hazards = asteroids + cloud; 1 hazard = one of the two chosen randomly.
        let hasAsteroids = false;
        let cloudType    = null;

        if (destinationTier > 1) {
            const scaledFrac = (destinationTier - 1) / (QUEEN_TIER - 1); // 0 at tier 2, 1 at QUEEN_TIER
            let p0, p1, p2;
            if (scaledFrac <= 0.5) {
                const t = scaledFrac * 2;                // 0 → 1 over lower half
                p0 = 1 - t * (2 / 3);
                p1 = t * (1 / 3);
                p2 = t * (1 / 3);
            } else {
                const t = (scaledFrac - 0.5) * 2;       // 0 → 1 over upper half
                p0 = (1 / 3) * (1 - t);
                p1 = (1 / 3) * (1 - t);
                p2 = 1 / 3 + t * (2 / 3);
            }
            const roll = Math.random();
            const hazardCount = roll < p2 ? 2 : roll < p2 + p1 ? 1 : 0;
            const cloudTypes = CONSTANTS.CLOUD_TYPES;
            if (hazardCount === 2) {
                hasAsteroids = true;
                cloudType = cloudTypes[Math.floor(Math.random() * cloudTypes.length)];
            } else if (hazardCount === 1) {
                if (Math.random() < 0.5) {
                    hasAsteroids = true;
                } else {
                    cloudType = cloudTypes[Math.floor(Math.random() * cloudTypes.length)];
                }
            }
        }

        const isQueenRoute = destinationTier === QUEEN_TIER;

        const rd = { destinationTier, fleetStrength: strength, maxEncounters, factionWeights, isQueenRoute, hasAsteroids, cloudType };
        // Pre-roll fleets so they're visible on the galaxy map before travel
        rd.fleets = this.rollEncountersForRoute(rd);
        return rd;
    }

    // Generate fleet entries for a route — returns array sorted by _crossT.
    // Each entry includes faction, size, fleetStrength, _crossT, leaderType, done flag.
    static rollEncountersForRoute(routeData) {
        if (routeData.isQueenRoute) {
            return [{
                faction: 'aliens',
                isQueenFight: true,
                isAlien: true,
                size: 5,
                fleetStrength: CONSTANTS.FLEET_STRENGTH_MAX,
                _crossT: 0.5,
                leaderType: 'Alien Queen',
                done: false,
            }];
        }

        const { fleetStrength, maxEncounters, factionWeights } = routeData;

        const pickFaction = (weights) => {
            const total = Object.values(weights).reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            for (const [f, w] of Object.entries(weights)) { r -= w; if (r <= 0) return f; }
            return 'pirates';
        };
        const pickLeader = (faction, strength) => {
            const tier = strength <= 3 ? 'low' : strength <= 6 ? 'mid' : 'high';
            const pools = CONSTANTS.FACTION_SHIP_POOLS[faction];
            const pool = (pools && pools[tier]) || (CONSTANTS.FACTIONS.find(f => f.id === faction) || {}).shipTypes || ['Corvette'];
            return pool[Math.floor(Math.random() * pool.length)];
        };

        const encounters = [];

        for (let i = 0; i < maxEncounters; i++) {
            const crossT = (i + 1) / (maxEncounters + 1);
            const faction = pickFaction(factionWeights);
            const size = fleetStrength <= 3 ? randomInt(1, 2) : fleetStrength <= 6 ? randomInt(2, 4) : randomInt(3, 6);
            encounters.push({ faction, size, fleetStrength, _crossT: crossT, leaderType: pickLeader(faction, fleetStrength), done: false });
        }

        // 35% chance of one abandoned ship encounter per route (outside queen routes)
        if (Math.random() < 0.35) {
            const crossT = randomFloat(0.15, 0.85);
            const credits = fleetStrength <= 3 ? randomInt(100, 300) : fleetStrength <= 6 ? randomInt(250, 600) : randomInt(500, 1200);
            encounters.push({ faction: 'abandoned_ship', size: 0, fleetStrength, _crossT: crossT, _abandonedCredits: credits, done: false });
        }

        return encounters.sort((a, b) => a._crossT - b._crossT);
    }

    // ── Starting system ──────────────────────────────────────────────────────

    static initializeStartingSystem(systems) {
        const start = systems.find(s => s.tier === 0) || systems[0];
        start.stationType = 'shipyard';
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
        // 25% chance the fleet arrives already battle-damaged
        if (Math.random() < 0.25) {
            fleet.forEach(ship => {
                ship.hull = Math.max(1, Math.round(ship.maxHull * (0.01 + Math.random() * 0.99)));
            });
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
