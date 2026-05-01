// Space Travel System
class SpaceTravel {
    static doLineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const ccw = (ax, ay, bx, by, cx, cy) => {
            return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
        };
        return ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
               ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4);
    }

    static wouldConnectionIntersect(system1, system2, systems) {
        for (let sys of systems) {
            if (sys.id === system1.id || sys.id === system2.id) continue;

            if (sys.connections) {
                for (let connId of sys.connections) {
                    const connSys = systems.find(s => s.id === connId);
                    if (connSys && connSys.id > sys.id) {
                        if (this.doLineSegmentsIntersect(
                            system1.x, system1.y, system2.x, system2.y,
                            sys.x, sys.y, connSys.x, connSys.y
                        )) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    static getSystemsNearRoute(system1, system2, systems, threshold = CONSTANTS.ROUTE_NEARBY_THRESHOLD) {
        const nearby = [];
        for (let sys of systems) {
            if (sys.id === system1.id || sys.id === system2.id) continue;

            const dist = distancePointToLineSegment(
                sys.x, sys.y,
                system1.x, system1.y,
                system2.x, system2.y
            );

            if (dist < threshold) {
                nearby.push({ system: sys, distance: dist });
            }
        }
        return nearby.sort((a, b) => a.distance - b.distance);
    }

    // For each system, find the closest route it is NOT an endpoint of, log the distance.
    // Algorithm: point-to-segment projection — project P onto segment AB via
    //   t = clamp(((P−A)·(B−A)) / |AB|², 0, 1), closest point Q = A + t(B−A), dist = |P−Q|
    static logRouteProximities(systems) {
        const clearance = CONSTANTS.MIN_SYSTEM_ROUTE_CLEARANCE;
        let violations = 0;
        const rows = [];

        for (const sys of systems) {
            let minDist = Infinity;
            let minRoute = '—';

            for (const a of systems) {
                if (!a.connections) continue;
                for (const bId of a.connections) {
                    if (bId <= a.id) continue; // each route once
                    if (sys.id === a.id || sys.id === bId) continue;
                    const b = systems.find(s => s.id === bId);
                    if (!b) continue;
                    const d = distancePointToLineSegment(sys.x, sys.y, a.x, a.y, b.x, b.y);
                    if (d < minDist) { minDist = d; minRoute = `${a.name} → ${b.name}`; }
                }
            }

            const ok = minDist >= clearance;
            if (!ok) violations++;
            rows.push({ name: sys.name, minDist: minDist === Infinity ? '∞' : minDist.toFixed(1), minRoute, ok });
        }

        console.groupCollapsed(`[Galaxy] Route clearance report — threshold ${clearance}px — ${violations} violation(s) in ${systems.length} systems`);
        rows.forEach(r => {
            const tag = r.ok ? '✓' : '✗ VIOLATION';
            console.log(`  ${tag}  ${r.name.padEnd(30)} nearest non-own route: ${String(r.minDist).padStart(6)}px  (${r.minRoute})`);
        });
        console.groupEnd();
    }

    static generateUniverse() {
        let attempts = 0;
        let systems = null;

        while (attempts < CONSTANTS.GALAXY_GEN_MAX_ATTEMPTS) {
            const targetCount = CONSTANTS.TARGET_SYSTEM_COUNT + randomInt(-CONSTANTS.SYSTEM_COUNT_VARIANCE, CONSTANTS.SYSTEM_COUNT_VARIANCE);
            systems = this.generateGalaxy(targetCount);

            if (systems && systems.length >= CONSTANTS.TARGET_SYSTEM_COUNT - CONSTANTS.SYSTEM_COUNT_VARIANCE &&
                systems.length <= CONSTANTS.TARGET_SYSTEM_COUNT + CONSTANTS.SYSTEM_COUNT_VARIANCE) {

                if (this.isGalaxyConnected(systems)) {
                    if (this.verifyGalaxyConstraints(systems)) {
                        console.log(`Galaxy generated successfully with ${systems.length} systems after ${attempts + 1} attempt(s)`);
                        this.logRouteProximities(systems);
                        return systems;
                    }
                }
            }

            attempts++;
        }

        console.warn(`Failed to generate valid galaxy after ${CONSTANTS.GALAXY_GEN_MAX_ATTEMPTS} attempts, returning fallback`);
        return this.generateGalaxy(CONSTANTS.TARGET_SYSTEM_COUNT - CONSTANTS.SYSTEM_COUNT_VARIANCE);
    }

    static generateGalaxy(targetCount) {
        const systems = [];

        // Phase 1: Place systems with minimum spacing
        for (let i = 0; i < targetCount; i++) {
            let x, y, validPosition = false;
            let attempts = 0;

            while (!validPosition && attempts < CONSTANTS.SYSTEM_PLACEMENT_ATTEMPTS) {
                x = randomInt(100, CONSTANTS.GALAXY_WIDTH - 100);
                y = randomInt(100, CONSTANTS.GALAXY_HEIGHT - 100);

                validPosition = true;
                for (let sys of systems) {
                    if (distance(x, y, sys.x, sys.y) < CONSTANTS.GALAXY_MIN_SYSTEM_SPACING) {
                        validPosition = false;
                        break;
                    }
                }

                attempts++;
            }

            if (validPosition) {
                systems.push({
                    id: i,
                    name: getRandomSystemName(),
                    x: x,
                    y: y,
                    visited: false,
                    seen: false,
                    resourceLevel: randomInt(1, 10),
                    connections: []
                });
            }
        }

        // Phase 2: Build connections respecting constraints
        this.buildConnectedGraph(systems);

        // Phase 2.5: Ensure all nearby systems are connected
        this.enforceProximityConnections(systems);

        // Phase 3: Remove underconnected systems, remap IDs, repeat until stable
        let valid = systems.filter(s => s.connections.length >= CONSTANTS.MIN_CONNECTIONS_PER_SYSTEM);
        let prevLen = -1;
        while (valid.length !== prevLen) {
            prevLen = valid.length;
            const idMap = new Map(valid.map((sys, idx) => [sys.id, idx]));
            valid.forEach((sys, idx) => {
                sys.id = idx;
                sys.connections = sys.connections
                    .map(oldId => idMap.get(oldId))
                    .filter(newId => newId !== undefined);
            });
            valid = valid.filter(s => s.connections.length >= CONSTANTS.MIN_CONNECTIONS_PER_SYSTEM);
        }

        return valid;
    }

    // Returns true if any non-endpoint system violates MIN_SYSTEM_ROUTE_CLEARANCE for segment s1→s2
    static routeViolatesClearance(s1, s2, systems) {
        const clearance = CONSTANTS.MIN_SYSTEM_ROUTE_CLEARANCE;
        for (const sys of systems) {
            if (sys.id === s1.id || sys.id === s2.id) continue;
            if (distancePointToLineSegment(sys.x, sys.y, s1.x, s1.y, s2.x, s2.y) < clearance) return true;
        }
        return false;
    }

    static buildConnectedGraph(systems) {
        const MIN_DIST = CONSTANTS.MIN_TRAVEL_DISTANCE;
        const MAX_DIST = CONSTANTS.MAX_TRAVEL_DISTANCE;
        const MIN_CONN = CONSTANTS.MIN_CONNECTIONS_PER_SYSTEM;
        const MAX_CONN = CONSTANTS.MAX_CONNECTIONS_PER_SYSTEM;

        const possibleConnections = new Map();
        systems.forEach(sys1 => {
            possibleConnections.set(sys1.id, []);

            systems.forEach(sys2 => {
                if (sys1.id !== sys2.id) {
                    const dist = distance(sys1.x, sys1.y, sys2.x, sys2.y);
                    if (dist >= MIN_DIST && dist <= MAX_DIST) {
                        // Hard-filter: skip routes that pass within MIN_SYSTEM_ROUTE_CLEARANCE of any non-endpoint system
                        if (this.routeViolatesClearance(sys1, sys2, systems)) return;
                        possibleConnections.get(sys1.id).push({
                            systemId: sys2.id,
                            distance: dist,
                        });
                    }
                }
            });

            // Prefer shorter routes
            possibleConnections.get(sys1.id).sort((a, b) => a.distance - b.distance);
        });

        // Phase 1: Ensure minimum connectivity
        systems.forEach(sys => {
            const possibleConn = possibleConnections.get(sys.id);
            while (sys.connections.length < MIN_CONN && possibleConn.length > 0) {
                const connection = possibleConn.shift();
                const otherSystem = systems.find(s => s.id === connection.systemId);
                if (!otherSystem) continue;

                if (!sys.connections.includes(connection.systemId) &&
                    !otherSystem.connections.includes(sys.id)) {
                    if (!this.wouldConnectionIntersect(sys, otherSystem, systems)) {
                        sys.connections.push(connection.systemId);
                        otherSystem.connections.push(sys.id);
                    }
                }
            }
        });

        // Phase 2: Add additional connections up to max
        systems.forEach(sys => {
            if (sys.connections.length < MAX_CONN) {
                const possibleConn = possibleConnections.get(sys.id);
                for (let conn of possibleConn) {
                    if (sys.connections.length >= MAX_CONN) break;

                    const otherSystem = systems.find(s => s.id === conn.systemId);
                    if (!otherSystem) continue;
                    if (!sys.connections.includes(conn.systemId) &&
                        otherSystem.connections.length < MAX_CONN) {
                        if (!this.wouldConnectionIntersect(sys, otherSystem, systems)) {
                            sys.connections.push(conn.systemId);
                            otherSystem.connections.push(sys.id);
                        }
                    }
                }
            }
        });
    }

    static enforceProximityConnections(systems) {
        const MAX_DIST = CONSTANTS.MAX_TRAVEL_DISTANCE;
        const MAX_CONN = CONSTANTS.MAX_CONNECTIONS_PER_SYSTEM;

        const missingConnections = [];

        for (let i = 0; i < systems.length; i++) {
            for (let j = i + 1; j < systems.length; j++) {
                const dist = distance(systems[i].x, systems[i].y, systems[j].x, systems[j].y);

                if (dist <= MAX_DIST) {
                    if (!systems[i].connections.includes(systems[j].id) &&
                        !systems[j].connections.includes(systems[i].id)) {
                        missingConnections.push({ sys1: systems[i], sys2: systems[j], distance: dist });
                    }
                }
            }
        }

        for (let missing of missingConnections) {
            const { sys1, sys2 } = missing;

            const nearbyToRoute = this.getSystemsNearRoute(sys1, sys2, systems, CONSTANTS.ROUTE_NEARBY_THRESHOLD);
            if (nearbyToRoute.length > 0) {
                let routedThrough = false;
                for (let nearby of nearbyToRoute) {
                    const intermediate = nearby.system;
                    const d1 = distance(sys1.x, sys1.y, intermediate.x, intermediate.y);
                    const d2 = distance(intermediate.x, intermediate.y, sys2.x, sys2.y);

                    if (d1 <= MAX_DIST && d2 <= MAX_DIST &&
                        d1 >= CONSTANTS.MIN_TRAVEL_DISTANCE && d2 >= CONSTANTS.MIN_TRAVEL_DISTANCE) {

                        if (sys1.connections.length < MAX_CONN && intermediate.connections.length < MAX_CONN &&
                            !sys1.connections.includes(intermediate.id) &&
                            !intermediate.connections.includes(sys1.id)) {
                            if (!this.wouldConnectionIntersect(sys1, intermediate, systems)) {
                                sys1.connections.push(intermediate.id);
                                intermediate.connections.push(sys1.id);
                            }
                        }

                        if (sys2.connections.length < MAX_CONN && intermediate.connections.length < MAX_CONN &&
                            !sys2.connections.includes(intermediate.id) &&
                            !intermediate.connections.includes(sys2.id)) {
                            if (!this.wouldConnectionIntersect(sys2, intermediate, systems)) {
                                sys2.connections.push(intermediate.id);
                                intermediate.connections.push(sys2.id);
                                routedThrough = true;
                                break;
                            }
                        }
                    }
                }
                if (routedThrough) continue;
            }

            // Skip the direct fallback connection if it violates clearance
            if (this.routeViolatesClearance(sys1, sys2, systems)) continue;

            if (sys1.connections.length < MAX_CONN && sys2.connections.length < MAX_CONN) {
                if (!this.wouldConnectionIntersect(sys1, sys2, systems)) {
                    sys1.connections.push(sys2.id);
                    sys2.connections.push(sys1.id);
                }
            } else if (sys1.connections.length < MAX_CONN) {
                if (this.replaceConnectionIfBetter(sys2, sys1, systems)) {
                    sys1.connections.push(sys2.id);
                }
            } else if (sys2.connections.length < MAX_CONN) {
                if (this.replaceConnectionIfBetter(sys1, sys2, systems)) {
                    sys2.connections.push(sys1.id);
                }
            } else {
                this.replaceConnectionIfBetter(sys1, sys2, systems);
                this.replaceConnectionIfBetter(sys2, sys1, systems);
            }
        }
    }

    static replaceConnectionIfBetter(fromSystem, toSystem, systems) {
        const distToTarget = distance(fromSystem.x, fromSystem.y, toSystem.x, toSystem.y);

        let longestConnIdx = -1;
        let longestDist = distToTarget;

        for (let i = 0; i < fromSystem.connections.length; i++) {
            const connId = fromSystem.connections[i];
            const connSys = systems.find(s => s.id === connId);
            if (connSys) {
                const dist = distance(fromSystem.x, fromSystem.y, connSys.x, connSys.y);
                if (dist > longestDist) {
                    longestConnIdx = i;
                    longestDist = dist;
                }
            }
        }

        if (longestConnIdx !== -1) {
            if (!this.wouldConnectionIntersect(fromSystem, toSystem, systems)) {
                const oldConnId = fromSystem.connections[longestConnIdx];
                const oldConnSys = systems.find(s => s.id === oldConnId);

                fromSystem.connections.splice(longestConnIdx, 1);
                if (oldConnSys) {
                    oldConnSys.connections = oldConnSys.connections.filter(id => id !== fromSystem.id);
                }

                fromSystem.connections.push(toSystem.id);
                return true;
            }
        }

        return false;
    }

    static verifyGalaxyConstraints(systems) {
        for (let sys of systems) {
            if (sys.connections.length < CONSTANTS.MIN_CONNECTIONS_PER_SYSTEM ||
                sys.connections.length > CONSTANTS.MAX_CONNECTIONS_PER_SYSTEM) {
                return false;
            }

            for (let connId of sys.connections) {
                const connSys = systems.find(s => s.id === connId);
                if (!connSys) return false;

                const dist = distance(sys.x, sys.y, connSys.x, connSys.y);
                if (dist < CONSTANTS.MIN_TRAVEL_DISTANCE || dist > CONSTANTS.MAX_TRAVEL_DISTANCE) return false;

                if (!connSys.connections.includes(sys.id)) return false;

                // Hard-fail if any non-endpoint system is within clearance distance of this route
                if (this.routeViolatesClearance(sys, connSys, systems)) return false;
            }
        }

        for (let i = 0; i < systems.length; i++) {
            const sys1 = systems[i];
            if (!sys1.connections) continue;

            for (let connId of sys1.connections) {
                if (connId <= sys1.id) continue;

                const sys2 = systems.find(s => s.id === connId);
                if (!sys2) continue;

                for (let j = 0; j < systems.length; j++) {
                    const sys3 = systems[j];
                    if (sys3.id === sys1.id || sys3.id === sys2.id) continue;
                    if (!sys3.connections) continue;

                    for (let connId2 of sys3.connections) {
                        if (connId2 <= sys3.id) continue;

                        const sys4 = systems.find(s => s.id === connId2);
                        if (!sys4 || sys4.id === sys1.id || sys4.id === sys2.id) continue;

                        if (this.doLineSegmentsIntersect(
                            sys1.x, sys1.y, sys2.x, sys2.y,
                            sys3.x, sys3.y, sys4.x, sys4.y
                        )) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    static isGalaxyConnected(systems) {
        if (systems.length < 2) return true;

        const adjacency = new Map();
        systems.forEach(sys => {
            adjacency.set(sys.id, sys.connections || []);
        });

        const visited = new Set();
        const queue = [systems[0].id];
        visited.add(systems[0].id);

        while (queue.length > 0) {
            const currentId = queue.shift();
            const neighbors = adjacency.get(currentId) || [];

            for (let neighborId of neighbors) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            }
        }

        return visited.size === systems.length;
    }

    static initializeStartingSystem(systems) {
        const startingSystem = systems[0];
        startingSystem.visited = true;
        this.revealAdjacentSystems(startingSystem, systems);
        return startingSystem;
    }

    static revealAdjacentSystems(system, systems) {
        system.seen = true;
        (system.connections || []).forEach(connId => {
            const adj = systems.find(s => s.id === connId);
            if (adj) adj.seen = true;
        });
    }

    static getReachableSystems(fromSystem, allSystems) {
        if (!fromSystem.connections) return [];
        return allSystems.filter(sys => fromSystem.connections.includes(sys.id));
    }

    static travelToSystem(fromSystem, toSystem) {
        const dist = getDistance(fromSystem, toSystem);
        toSystem.visited = true;

        if (dist > CONSTANTS.MAX_TRAVEL_DISTANCE) {
            return null;
        }

        const encounterChance = Math.min(dist / CONSTANTS.MAX_TRAVEL_DISTANCE, CONSTANTS.MAX_ENCOUNTER_CHANCE);
        const hasEncounter = Math.random() < encounterChance;

        return {
            distance: dist,
            hasEncounter: hasEncounter,
            encounterStrength: randomInt(1, 5)
        };
    }

    static generateRouteFleets(systems) {
        const fleets = new Map();
        const seen = new Set();

        systems.forEach(sys => {
            sys.connections.forEach(connId => {
                const key = getRouteKey(sys.id, connId);
                if (!seen.has(key)) {
                    seen.add(key);
                    const count = randomInt(0, CONSTANTS.FLEET_MAX_PER_ROUTE);
                    if (count > 0) {
                        fleets.set(key, this.generateEncountersForRoute(count));
                    }
                }
            });
        });

        return fleets;
    }

    // Returns an array of encounter objects spread along a route.
    static generateEncountersForRoute(count) {
        const factionIds = CONSTANTS.FACTIONS.map(f => f.id);
        const span = 0.70; // occupies [0.15, 0.85] of the route
        const step = span / count;
        const encounters = [];
        for (let i = 0; i < count; i++) {
            const basePos = 0.15 + step * i + step * 0.1 + Math.random() * step * 0.8;
            encounters.push({
                position: Math.min(0.85, Math.max(0.15, basePos)),
                faction: factionIds[Math.floor(Math.random() * factionIds.length)],
                size: randomInt(CONSTANTS.FLEET_SIZE_MIN, CONSTANTS.FLEET_SIZE_MAX),
            });
        }
        return encounters;
    }

    // Generate enemy fleet ships for a given encounter object { faction, size }.
    static generateEnemyFleet(encounter) {
        const faction = encounter && encounter.faction ? encounter.faction : null;
        const size    = encounter && encounter.size    ? encounter.size    : (encounter || 1);
        const factionData = faction ? CONSTANTS.FACTIONS.find(f => f.id === faction) : null;
        const shipTypes   = factionData ? factionData.shipTypes : null;
        const fleet = [];
        for (let i = 0; i < size; i++) {
            fleet.push(shipTypes && shipTypes.length
                ? SpaceTravel.generateShipOfType(shipTypes[Math.floor(Math.random() * shipTypes.length)])
                : new Ship(0, 0, false));
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
