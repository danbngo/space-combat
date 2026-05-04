// Main Game File

/**
 * @typedef {{
 *   state: string,
 *   credits: number,
 *   systems: Array<{id:number, name:string, x:number, y:number, visited:boolean, resourceLevel:number, connections:number[]}>,
 *   routeFleets: Map<string, Array>,
 *   bounty: number,
 *   currentSystem: object,
 *   selectedSystem: object|null,
 *   selectedShip: Ship|null,
 *   playerShips: Ship[],
 *   enemyShips: Ship[]
 * }} GameState
 */
/** @type {GameState} */
let gameState = null;
let combat = null;
let lastTime = Date.now();
let animationFrameId = null;

// Callback to resume travel after a mid-route combat resolves.
let _travelContinuation = null;

// Info about the encounter currently being fought — used to respawn the fleet on player victory.
let _defeatedEncounterInfo = null;

const GameController = {
    init: function() {
        this.initializeGameState();
        initRendering();
        initGalaxyRenderer();
        this.setupEventListeners();
        UISystem.showScreen('titleScreen');

        spriteSystem.loadAll({
            battleship:   'images/battleship.png',
            corvette:     'images/corvette.png',
            destroyer:    'images/destroyer.png',
            drone:        'images/drone.png',
            fighter:      'images/fighter.png',
            freighter:    'images/tanker.png',
            jammer:       'images/jammer.png',
            repair_ship:  'images/repair_ship.png',
            smuggler:     'images/smuggler.png',
        });
    },
    
    initializeGameState: function() {
        const systems = SpaceTravel.generateUniverse();
        const startingSystem = SpaceTravel.initializeStartingSystem(systems);
        const routeFleets = SpaceTravel.generateRouteFleets(systems);

        // Count total routes for loss condition
        let totalRoutes = 0;
        systems.forEach(sys => {
            sys.connections.forEach(connId => { if (connId > sys.id) totalRoutes++; });
        });

        // Find alien capital (≥10 hops from player start)
        const alienCapitalId = this.findAlienCapital(systems, startingSystem);

        // Seed alien-controlled routes adjacent to the capital
        const alienRoutes = new Set();
        if (alienCapitalId !== null) {
            const capitalSys = systems.find(s => s.id === alienCapitalId);
            if (capitalSys) {
                capitalSys.connections.forEach(connId => {
                    alienRoutes.add(getRouteKey(alienCapitalId, connId));
                });
            }
        }

        gameState = {
            state: GAME_STATE.TITLE,
            credits: CONSTANTS.PLAYER_STARTING_CREDITS,
            bounty: 0,
            fame: 0,
            day: 1,
            systems: systems,
            routeFleets: routeFleets,
            alienRoutes: alienRoutes,
            alienCapitalId: alienCapitalId,
            totalRoutes: totalRoutes,
            currentSystem: startingSystem,
            selectedSystem: startingSystem,
            selectedShip: null,
            playerShips: [],
            enemyShips: []
        };

        // Initialize player starting fleet
        for (let i = 0; i < CONSTANTS.PLAYER_STARTING_SHIPS; i++) {
            const s = new Ship(0, 0, true);
            s._buyPrice = CONSTANTS.NEW_SHIP_BASE_COST;
            gameState.playerShips.push(s);
        }
        assignFleetNames(gameState.playerShips);
    },
    
    findAlienCapital: function(systems, startingSystem) {
        const dist = new Map();
        dist.set(startingSystem.id, 0);
        const queue = [startingSystem.id];
        while (queue.length > 0) {
            const cur = queue.shift();
            const sys = systems.find(s => s.id === cur);
            if (!sys) continue;
            for (const nid of sys.connections) {
                if (!dist.has(nid)) {
                    dist.set(nid, dist.get(cur) + 1);
                    queue.push(nid);
                }
            }
        }
        const farSystems = systems.filter(s => (dist.get(s.id) || 0) >= 10 && s.connections.length > 0);
        if (farSystems.length > 0) {
            return farSystems[Math.floor(Math.random() * farSystems.length)].id;
        }
        // Fallback: pick the farthest system
        let maxDist = 0, maxId = null;
        for (const [id, d] of dist) {
            if (d > maxDist) { maxDist = d; maxId = id; }
        }
        return maxId;
    },

    advanceAlienSpawns: function(daysElapsed) {
        if (!gameState.alienRoutes || gameState.alienCapitalId === null) return;
        // Spawn chance per day: 0% on day 1, +1% per day, max 10%
        const spawnChancePerDay = Math.min(0.10, Math.max(0, (gameState.day - 1) / 100));
        if (spawnChancePerDay <= 0) return;
        // Cumulative probability over daysElapsed
        const spawnChance = 1 - Math.pow(1 - spawnChancePerDay, daysElapsed);

        // Collect all systems bordering alien territory
        const alienSystems = new Set();
        for (const key of gameState.alienRoutes) {
            const [a, b] = key.split('-').map(Number);
            alienSystems.add(a);
            alienSystems.add(b);
        }

        // Find adjacent unoccupied routes
        const candidateSet = new Set();
        for (const sysId of alienSystems) {
            const sys = gameState.systems.find(s => s.id === sysId);
            if (!sys) continue;
            for (const connId of sys.connections) {
                const key = getRouteKey(sysId, connId);
                if (!gameState.alienRoutes.has(key)) candidateSet.add(key);
            }
        }

        for (const key of candidateSet) {
            if (Math.random() < spawnChance) gameState.alienRoutes.add(key);
        }
    },

    fightAlienQueen: function() {
        const alienColor = '#ff8800';
        const queenFleet = [];
        const queenShip = SpaceTravel.generateShipOfType('Alien Queen');
        queenShip.factionColor = alienColor;
        queenFleet.push(queenShip);
        ['Alien Phantom', 'Alien Ravager', 'Alien Titan', 'Alien Stalker'].forEach(type => {
            const s = SpaceTravel.generateShipOfType(type);
            s.factionColor = alienColor;
            queenFleet.push(s);
        });
        assignFleetNames(queenFleet);
        gameState.enemyShips = queenFleet;
        _defeatedEncounterInfo = { faction: 'aliens', size: queenFleet.length, fameDelta: 0, isQueenFight: true };
        _travelContinuation = null;
        this.startCombat({ enemyFirst: false });
    },

    showAlienNewsModal: function(totalAlienRoutes, newRoutes) {
        const bodyEl    = document.getElementById('alienNewsBody');
        const modal     = document.getElementById('alienNewsModal');
        const dismissBtn = document.getElementById('alienNewsDismissBtn');
        const pct = Math.round((totalAlienRoutes / gameState.totalRoutes) * 100);
        const urgency = pct >= 50
            ? `<p style="color:#ff4444;font-weight:bold;">The aliens now control more than half the galaxy's routes!</p>`
            : '';
        bodyEl.innerHTML = `
            <p>Alien forces have expanded, claiming <strong>${newRoutes}</strong> new ${newRoutes === 1 ? 'route' : 'routes'}.</p>
            <p>They now control <strong>${totalAlienRoutes}</strong> of <strong>${gameState.totalRoutes}</strong> routes (${pct}%).</p>
            ${urgency}
            <p style="color:#ff8800;font-size:0.85em;">Destroy the Alien Queen at the alien capital to end their expansion.</p>`;
        dismissBtn.onclick = () => {
            modal.style.display = 'none';
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        };
        modal.style.display = 'flex';
    },

    setupEventListeners: function() {
        // Title Screen
        document.getElementById('startButton').addEventListener('click', () => {
            this.startGame();
        });
        
        // Galaxy Map Zoom Controls
        document.getElementById('zoomInButton').addEventListener('click', () => {
            if (galaxyRenderer) galaxyRenderer.zoomIn();
            UISystem.updateGalaxyScreen(gameState);
        });
        
        document.getElementById('zoomOutButton').addEventListener('click', () => {
            if (galaxyRenderer) galaxyRenderer.zoomOut();
            UISystem.updateGalaxyScreen(gameState);
        });
        
        document.getElementById('zoomResetButton').addEventListener('click', () => {
            if (galaxyRenderer) galaxyRenderer.resetZoom();
            UISystem.updateGalaxyScreen(gameState);
        });
        
        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (gameState.state === GAME_STATE.COMBAT && e.key === 'Escape') {
                const cancelBtn = document.getElementById('combatCancelModeBtn');
                if (cancelBtn) cancelBtn.click();
                return;
            }
            if (!galaxyRenderer || gameState.state !== GAME_STATE.GALAXY) return;
            if (e.key === '+' || e.key === '=') {
                galaxyRenderer.zoomIn();
                UISystem.updateGalaxyScreen(gameState);
            } else if (e.key === '-' || e.key === '_') {
                galaxyRenderer.zoomOut();
                UISystem.updateGalaxyScreen(gameState);
            }
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            if (gameState.state === GAME_STATE.GALAXY && galaxyRenderer) {
                galaxyRenderer.resizeCanvas();
                galaxyRenderer.fitGalaxyToCanvas();
                galaxyRenderer.resetZoom();
                UISystem.updateGalaxyScreen(gameState);
            } else if (gameState.state === GAME_STATE.COMBAT && renderingSystem) {
                renderingSystem.resizeCanvas();
                renderingSystem.fitArenaToCanvas();
            }
        });
        
        // Station Screen
        document.getElementById('orbitTab').addEventListener('click', () => {
            UISystem.setStationTab('orbit', gameState);
        });
        document.getElementById('dockTab').addEventListener('click', () => {
            UISystem.setStationTab('dock', gameState);
        });
        document.getElementById('shipyardTab').addEventListener('click', () => {
            UISystem.setStationTab('shipyard', gameState);
        });
        document.getElementById('modulesTab').addEventListener('click', () => {
            UISystem.setStationTab('modules', gameState);
        });
        document.getElementById('courthouseTab').addEventListener('click', () => {
            UISystem.setStationTab('courthouse', gameState);
        });
        
        document.getElementById('leaveStationButton').addEventListener('click', () => {
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        });
        
        // Combat Screen
        document.getElementById('combatActionsTab').addEventListener('click', () => {
            UISystem.combatTab = 'actions';
            if (combat) UISystem.updateCombatScreen(gameState, combat);
        });
        document.getElementById('combatInfoTab').addEventListener('click', () => {
            UISystem.combatTab = 'info';
            if (combat) UISystem.updateCombatScreen(gameState, combat);
        });

        document.getElementById('combatResultContinueBtn').addEventListener('click', () => {
            document.getElementById('combatResultModal').style.display = 'none';
            this.endCombat();
        });

        document.getElementById('combatZoomInButton').addEventListener('click', () => {
            if (renderingSystem) renderingSystem.zoomIn();
        });
        document.getElementById('combatZoomOutButton').addEventListener('click', () => {
            if (renderingSystem) renderingSystem.zoomOut();
        });
        document.getElementById('combatZoomResetButton').addEventListener('click', () => {
            if (renderingSystem) renderingSystem.fitArenaToCanvas();
        });
        
        // Game Over Screen
        document.getElementById('gameOverButton').addEventListener('click', () => {
            UISystem.stationTab = 'orbit';
            UISystem.currentStationOffer = null;
            UISystem.currentModuleOffer = null;
            combat = null;
            _travelContinuation = null;
            _defeatedEncounterInfo = null;
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            document.getElementById('gameOverButton').textContent = 'Start New Game';
            this.initializeGameState();
            UISystem.showScreen('titleScreen');
        });
    },
    
    startGame: function() {
        gameState.state = GAME_STATE.GALAXY;
        UISystem.showScreen('galaxyScreen');
        UISystem.updateGalaxyScreen(gameState);
    },
    
    visitStation: function() {
        gameState.state = GAME_STATE.STATION;
        gameState.selectedShip = gameState.selectedShip || gameState.playerShips[0] || null;
        UISystem.stationTab = 'orbit';
        UISystem.currentStationOffer = null;
        UISystem.currentModuleOffer = null;
        StationSystem.visitStation(gameState);
        UISystem.showScreen('stationScreen');
        UISystem.updateStationScreen(gameState);
    },
    
    travelToSystem: function(targetSystem) {
        const fromSystem = gameState.currentSystem;
        const routeKey = getRouteKey(fromSystem.id, targetSystem.id);

        // Compute the player-progress value t at which the player's ship meets each fleet,
        // accounting for fleet movement during transit (fleets move 0.30 per full player trip).
        const FLEET_STEP = 0.30;
        const encounters = [];
        for (const enc of (gameState.routeFleets.get(routeKey) || [])) {
            if (enc.fromId === undefined) continue; // skip legacy direction-less encounters
            const sameDir = enc.fromId === fromSystem.id;
            // Same dir: player at t, fleet at enc.position + t*FLEET_STEP → meet at enc.position / (1 - FLEET_STEP)
            // Opp dir:  player at t, fleet at (1-enc.position) - t*FLEET_STEP → meet at (1-enc.position) / (1 + FLEET_STEP)
            const crossT = sameDir
                ? enc.position / (1 - FLEET_STEP)
                : (1 - enc.position) / (1 + FLEET_STEP);
            if (crossT > 0 && crossT <= 1) {
                encounters.push({ ...enc, _crossT: crossT, _original: enc });
            }
        }
        // If this route is alien-controlled, add an alien encounter
        if (gameState.alienRoutes && gameState.alienRoutes.has(routeKey)) {
            encounters.push({
                faction: 'aliens',
                size: randomInt(2, 4),
                _crossT: 0.4 + Math.random() * 0.2,
                isAlien: true,
                fromId: fromSystem.id,
                toId: targetSystem.id,
            });
        }
        encounters.sort((a, b) => a._crossT - b._crossT);

        const arrive = () => {
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            const routeDist = distance(fromSystem.x, fromSystem.y, targetSystem.x, targetSystem.y);
            const daysElapsed = routeDist / avgEngine / CONSTANTS.TRAVEL_TIME_SCALE;
            gameState.day = (gameState.day || 1) + daysElapsed;
            if (gameState.bounty > 0) {
                gameState.bounty = Math.floor(gameState.bounty * Math.pow(0.95, daysElapsed));
            }

            // Advance alien expansion
            const alienCountBefore = (gameState.alienRoutes || new Set()).size;
            this.advanceAlienSpawns(daysElapsed);
            const alienCountAfter = (gameState.alienRoutes || new Set()).size;

            SpaceTravel.travelToSystem(fromSystem, targetSystem);
            SpaceTravel.revealAdjacentSystems(targetSystem, gameState.systems);
            gameState.currentSystem = targetSystem;
            gameState.selectedSystem = targetSystem;
            this.advanceFleets();

            // Loss: aliens conquered all routes
            if (gameState.alienRoutes && gameState.totalRoutes && gameState.alienRoutes.size >= gameState.totalRoutes) {
                document.getElementById('gameOverTitle').textContent = 'Defeat';
                document.getElementById('gameOverTitle').style.color = '#ff4444';
                document.getElementById('gameOverMessage').textContent = 'Alien forces have conquered all trade routes. The galaxy has fallen.';
                document.getElementById('gameOverButton').textContent = 'Start New Game';
                gameState.state = GAME_STATE.GAME_OVER;
                UISystem.showScreen('gameOverScreen');
                return;
            }

            // Show alien news if expansion occurred, otherwise go straight to galaxy
            if (alienCountAfter > alienCountBefore) {
                this.showAlienNewsModal(alienCountAfter, alienCountAfter - alienCountBefore);
            } else {
                UISystem.showScreen('galaxyScreen');
                UISystem.updateGalaxyScreen(gameState);
            }
        };

        const alive = gameState.playerShips.filter(s => s.alive);
        const avgEngine = alive.length > 0 ? alive.reduce((sum, s) => sum + s.engine, 0) / alive.length : 10;
        if (galaxyRenderer) galaxyRenderer.startTravelAnim(fromSystem, targetSystem, avgEngine);
        this.processEncounters(fromSystem, targetSystem, routeKey, encounters, 0, arrive);
    },

    // Advance all fleet positions by one travel tick; fleets that arrive at a system
    // immediately pick a new destination and continue from the start of that route.
    advanceFleets: function() {
        const STEP = 0.30;
        const toAdd = []; // fleets that moved to a new route

        for (const [key, encounters] of gameState.routeFleets) {
            const remaining = [];
            for (const enc of encounters) {
                if (enc.fromId === undefined) { remaining.push(enc); continue; }
                enc.position += STEP;
                if (enc.position >= 1) {
                    // Fleet arrived at toId — pick a new destination (prefer not to backtrack, avoid alien routes)
                    const arrivedSys = gameState.systems.find(s => s.id === enc.toId);
                    if (arrivedSys && arrivedSys.connections.length > 0) {
                        const alienRoutes = gameState.alienRoutes || new Set();
                        const nonAlien = arrivedSys.connections.filter(id => !alienRoutes.has(getRouteKey(arrivedSys.id, id)));
                        const others = nonAlien.filter(id => id !== enc.fromId);
                        const pool = others.length > 0 ? others : (nonAlien.length > 0 ? nonAlien : []);
                        if (pool.length === 0) continue; // stranded in alien territory — fleet dissolves
                        const newToId = pool[Math.floor(Math.random() * pool.length)];
                        enc.fromId    = enc.toId;
                        enc.toId      = newToId;
                        enc.position  = enc.position - 1; // carry over excess
                        toAdd.push({ key: getRouteKey(enc.fromId, newToId), enc });
                    }
                    // If no valid system found, fleet disappears
                } else {
                    remaining.push(enc);
                }
            }
            if (remaining.length > 0) gameState.routeFleets.set(key, remaining);
            else gameState.routeFleets.delete(key);
        }

        for (const { key, enc } of toAdd) {
            if (!gameState.routeFleets.has(key)) gameState.routeFleets.set(key, []);
            gameState.routeFleets.get(key).push(enc);
        }
    },

    respawnFleet: function(info) {
        if (!info) return;
        const origin = gameState.currentSystem;
        if (!origin) return;

        // BFS to find hop distances from current system
        const dist = new Map();
        dist.set(origin.id, 0);
        const queue = [origin.id];
        while (queue.length > 0) {
            const cur = queue.shift();
            const sys = gameState.systems.find(s => s.id === cur);
            if (!sys) continue;
            for (const nid of sys.connections) {
                if (!dist.has(nid)) {
                    dist.set(nid, dist.get(cur) + 1);
                    queue.push(nid);
                }
            }
        }

        const farSystems = gameState.systems.filter(s =>
            (dist.get(s.id) || 0) >= 5 && s.connections.length > 0
        );
        if (farSystems.length === 0) return;

        const chosenSys = farSystems[Math.floor(Math.random() * farSystems.length)];
        const connId    = chosenSys.connections[Math.floor(Math.random() * chosenSys.connections.length)];
        const routeKey  = getRouteKey(chosenSys.id, connId);
        const forward   = Math.random() < 0.5;
        const enc = {
            position: 0.05 + Math.random() * 0.15,
            faction:  info.faction,
            size:     info.size,
            fromId:   forward ? chosenSys.id : connId,
            toId:     forward ? connId : chosenSys.id,
        };

        if (!gameState.routeFleets.has(routeKey)) gameState.routeFleets.set(routeKey, []);
        gameState.routeFleets.get(routeKey).push(enc);
    },

    processEncounters: function(fromSystem, targetSystem, routeKey, encounters, index, onArrival) {
        if (index >= encounters.length) {
            if (galaxyRenderer) galaxyRenderer.animateTravelSegment(1.0, onArrival);
            else onArrival();
            return;
        }

        const encounter = encounters[index];
        const continueNext = () => this.processEncounters(fromSystem, targetSystem, routeKey, encounters, index + 1, onArrival);

        if (galaxyRenderer) {
            galaxyRenderer.animateTravelSegment(encounter._crossT ?? encounter.position, () => {
                this.showFactionEncounterModal(encounter, routeKey, continueNext, onArrival);
            });
        } else {
            this.showFactionEncounterModal(encounter, routeKey, continueNext, onArrival);
        }
    },

    showFactionEncounterModal: function(encounter, routeKey, onContinue, onArrival) {
        const factionData = CONSTANTS.FACTIONS.find(f => f.id === encounter.faction);
        const factionName = factionData ? factionData.name : 'Unknown';
        const factionColor = factionData ? factionData.color : '#ffffff';

        // Soldiers with non-negative fame: show a clearance modal instead of silent pass
        if (encounter.faction === 'soldiers' && (gameState.fame || 0) >= 0) {
            const computeFameDelta = (faction, playerInitiated) => {
                if (faction === 'pirates') return 1;
                if (faction === 'smugglers') return playerInitiated ? 1 : 0;
                return playerInitiated ? -1 : 0;
            };
            const preGenFleetSoldier = SpaceTravel.generateEnemyFleet(encounter);
            const startCombatSoldier = (addBounty, combatOptions = {}, fameDelta = 0) => {
                if (addBounty) gameState.bounty = (gameState.bounty || 0) + CONSTANTS.FLEET_ATTACK_BOUNTY;
                removeEncounterFn();
                _defeatedEncounterInfo = { faction: encounter.faction, size: encounter.size, fameDelta, alienRouteKey: null };
                gameState.enemyShips = preGenFleetSoldier;
                _travelContinuation = onContinue;
                this.startCombat(combatOptions);
            };
            const removeEncounterFn = () => {
                const arr = gameState.routeFleets.get(routeKey);
                if (arr) {
                    const idx = arr.indexOf(encounter._original || encounter);
                    if (idx !== -1) arr.splice(idx, 1);
                    if (arr.length === 0) gameState.routeFleets.delete(routeKey);
                }
            };
            const modalEl2   = document.getElementById('encounterModal');
            const titleEl2   = document.getElementById('encounterModalTitle');
            const bodyEl2    = document.getElementById('encounterModalBody');
            const engageBtn2 = document.getElementById('encounterEngageBtn');
            const retreatBtn2 = document.getElementById('encounterRetreatBtn');
            const closeModal2 = () => { modalEl2.style.display = 'none'; retreatBtn2.style.display = ''; retreatBtn2.textContent = 'Turn Back'; };
            titleEl2.textContent = 'Soldier Patrol';
            titleEl2.style.color = '#aaaaff';
            bodyEl2.innerHTML = `<p>A soldier patrol of <strong>${encounter.size} ships</strong> scans your transponder.</p>
                <p style="color:#00ff88;font-size:0.88em;margin-top:0.3em;">✓ Cleared to pass — your record is clean.</p>`;
            engageBtn2.textContent = 'Attack';
            retreatBtn2.textContent = 'Pass';
            retreatBtn2.style.display = '';
            engageBtn2.onclick = () => { closeModal2(); startCombatSoldier(false, { enemyFirst: false }, computeFameDelta('soldiers', true)); };
            retreatBtn2.onclick = () => { closeModal2(); removeEncounterFn(); onContinue(); };
            modalEl2.style.display = 'flex';
            return;
        }

        // fameDelta on victory: +1 for pirates always; +1 for smugglers if player initiated;
        // -1 for all others if player initiated; 0 if defending
        const computeFameDelta = (faction, playerInitiated) => {
            if (faction === 'pirates') return 1;
            if (faction === 'smugglers') return playerInitiated ? 1 : 0;
            return playerInitiated ? -1 : 0;
        };

        // Pre-generate enemy fleet so detection roll uses real radar totals,
        // and the same fleet objects are used in combat.
        const preGenFleet = SpaceTravel.generateEnemyFleet(encounter);
        const playerRadar = gameState.playerShips.filter(s => s.alive).reduce((sum, s) => sum + s.radar, 0);
        const enemyRadar  = preGenFleet.reduce((sum, s) => sum + s.radar, 0);
        const undetected  = playerRadar > enemyRadar;

        // Remove this specific encounter from the route map before starting combat
        const removeEncounter = () => {
            const arr = gameState.routeFleets.get(routeKey);
            if (arr) {
                const idx = arr.indexOf(encounter._original || encounter);
                if (idx !== -1) arr.splice(idx, 1);
                if (arr.length === 0) gameState.routeFleets.delete(routeKey);
            }
        };

        const startCombatWith = (addBounty, combatOptions = {}, fameDelta = 0) => {
            if (addBounty) gameState.bounty = (gameState.bounty || 0) + CONSTANTS.FLEET_ATTACK_BOUNTY;
            if (!encounter.isAlien) removeEncounter();
            _defeatedEncounterInfo = {
                faction: encounter.faction,
                size: encounter.size,
                fameDelta,
                alienRouteKey: encounter.isAlien ? routeKey : null,
            };
            gameState.enemyShips = preGenFleet;
            _travelContinuation = onContinue;
            this.startCombat(combatOptions);
        };

        const modalEl    = document.getElementById('encounterModal');
        const titleEl    = document.getElementById('encounterModalTitle');
        const bodyEl     = document.getElementById('encounterModalBody');
        const engageBtn  = document.getElementById('encounterEngageBtn');
        const retreatBtn = document.getElementById('encounterRetreatBtn');

        const closeModal = () => {
            modalEl.style.display = 'none';
            retreatBtn.style.display = '';
            retreatBtn.textContent = 'Turn Back';
        };

        titleEl.textContent = `${factionName} Fleet`;
        titleEl.style.color = factionColor;

        // ── ALIENS: always attack, no negotiate ───────────────────────────────────
        if (encounter.faction === 'aliens') {
            titleEl.textContent = 'Alien Fleet';
            titleEl.style.color = '#ff8800';
            bodyEl.innerHTML = `
                <p style="color:#ff8800;">An alien fleet of <strong>${encounter.size} ships</strong> blocks your path!</p>
                <p style="color:#aaa;font-size:0.85em;">Aliens cannot be negotiated with. Clear the route to pass.</p>`;
            engageBtn.textContent = 'Fight';
            retreatBtn.style.display = 'none';
            engageBtn.onclick = () => {
                closeModal();
                startCombatWith(false, { enemyFirst: true }, 3);
            };
            modalEl.style.display = 'flex';
            return;
        }

        if (undetected) {
            // ── UNDETECTED: player saw them first ──────────────────────────────────
            const detLine = `<p style="color:#00ff88;font-size:0.85em;margin-bottom:0.3em;">
                ✓ Undetected — your radar (${playerRadar}) outpaced theirs (${enemyRadar})
            </p>`;
            let fleetDesc = '';
            if (encounter.faction === 'pirates')   fleetDesc = `A pirate fleet of <strong>${encounter.size} ships</strong> ahead.`;
            if (encounter.faction === 'police')    fleetDesc = `A police patrol of <strong>${encounter.size} ships</strong> ahead.`;
            if (encounter.faction === 'merchants') fleetDesc = `A merchant convoy of <strong>${encounter.size} ships</strong> ahead.`;
            if (encounter.faction === 'soldiers')  fleetDesc = `A soldier patrol of <strong>${encounter.size} ships</strong> ahead.`;
            if (encounter.faction === 'smugglers') fleetDesc = `A smuggler convoy of <strong>${encounter.size} ships</strong> ahead.`;

            bodyEl.innerHTML = `${detLine}<p>${fleetDesc}</p>
                <p style="color:#aaa;font-size:0.82em;margin-top:0.3em;">Each option has a <strong>50%</strong> chance of success.</p>`;

            engageBtn.textContent = 'Ambush';
            retreatBtn.textContent = 'Sneak Around';
            retreatBtn.style.display = '';

            engageBtn.onclick = () => {
                closeModal();
                const fameDelta = computeFameDelta(encounter.faction, true);
                if (Math.random() < 0.5) {
                    // Ambush success: enemy 0 shields, faces away, player first
                    startCombatWith(false, { ambush: true, enemyFirst: false }, fameDelta);
                } else {
                    // Ambush failed: they spotted you, enemy first — player still initiated
                    startCombatWith(false, { enemyFirst: true }, fameDelta);
                }
            };

            retreatBtn.onclick = () => {
                const sneakSuccess = Math.random() < 0.5;
                retreatBtn.style.display = 'none';
                if (sneakSuccess) {
                    bodyEl.innerHTML = `<p style="color:#00ff88;"><strong>✓ Sneak successful!</strong></p>
                        <p style="color:#aaa;font-size:0.88em;">You slipped past undetected.</p>`;
                    engageBtn.textContent = 'Continue';
                    engageBtn.onclick = () => { closeModal(); onContinue(); };
                } else {
                    bodyEl.innerHTML = `<p style="color:#ff4444;"><strong>✗ Sneak failed!</strong></p>
                        <p style="color:#aaa;font-size:0.88em;">They spotted you — prepare for combat.</p>`;
                    engageBtn.textContent = 'Fight';
                    engageBtn.onclick = () => { closeModal(); startCombatWith(false, { enemyFirst: true }, computeFameDelta(encounter.faction, false)); };
                }
            };
        } else {
            // ── DETECTED: normal faction encounter ─────────────────────────────────
            const detLine = `<p style="color:#ff6644;font-size:0.85em;margin-bottom:0.3em;">
                ✗ Detected — their radar (${enemyRadar}) overpowered yours (${playerRadar})
            </p>`;

            const playerBounty = gameState.bounty || 0;
            const playerFame   = gameState.fame   || 0;
            let willAttack = false;
            if (encounter.faction === 'pirates') {
                willAttack = Math.random() < CONSTANTS.FLEET_PIRATE_ATTACK_CHANCE;
            } else if (encounter.faction === 'police' && playerBounty > 0) {
                willAttack = Math.random() < CONSTANTS.FLEET_POLICE_ATTACK_CHANCE;
            } else if (encounter.faction === 'soldiers' && playerFame < 0) {
                willAttack = Math.random() < Math.min(1, -playerFame / 100);
            }

            if (willAttack) {
                let msg = '';
                if (encounter.faction === 'pirates')
                    msg = `A pirate fleet of <strong>${encounter.size} ships</strong> is moving to intercept!`;
                else if (encounter.faction === 'police')
                    msg = `A police patrol of <strong>${encounter.size} ships</strong> has detected your bounty and is closing in!`;
                else if (encounter.faction === 'soldiers')
                    msg = `A soldier patrol of <strong>${encounter.size} ships</strong> has marked you as an enemy of the state!`;

                if (encounter.faction === 'pirates') {
                    const toll = Math.floor(gameState.credits * (0.25 + Math.random() * 0.5));
                    bodyEl.innerHTML = `${detLine}<p>${msg}</p>
                        <p style="color:#ffdd44;font-size:0.85em;margin-top:0.4em;">They'll let you pass if you hand over <strong>${toll} credits</strong>.</p>`;
                    engageBtn.textContent = 'Fight';
                    retreatBtn.textContent = `Surrender (−${toll} cr)`;
                    retreatBtn.style.display = '';

                    engageBtn.onclick = () => {
                        closeModal();
                        startCombatWith(false, { enemyFirst: true }, computeFameDelta(encounter.faction, false));
                    };
                    retreatBtn.onclick = () => {
                        closeModal();
                        gameState.credits = Math.max(0, gameState.credits - toll);
                        onContinue();
                    };
                } else {
                    bodyEl.innerHTML = `${detLine}<p>${msg}</p>`;
                    engageBtn.textContent = 'Fight';
                    retreatBtn.style.display = 'none';

                    engageBtn.onclick = () => {
                        closeModal();
                        startCombatWith(false, { enemyFirst: true }, computeFameDelta(encounter.faction, false));
                    };
                }
            } else {
                const givesBounty = encounter.faction !== 'pirates' && encounter.faction !== 'smugglers';
                let msg = '', attackLabel = 'Attack';
                if (encounter.faction === 'pirates') {
                    msg = `A pirate fleet of <strong>${encounter.size} ships</strong> seems to be ignoring you.`;
                    attackLabel = 'Attack';
                } else if (encounter.faction === 'police') {
                    msg = `A police patrol of <strong>${encounter.size} ships</strong> is nearby.`;
                    attackLabel = `Attack (+${CONSTANTS.FLEET_ATTACK_BOUNTY} bounty)`;
                } else if (encounter.faction === 'merchants') {
                    msg = `A merchant convoy of <strong>${encounter.size} ships</strong> is on the route.`;
                    attackLabel = `Attack (+${CONSTANTS.FLEET_ATTACK_BOUNTY} bounty)`;
                } else if (encounter.faction === 'soldiers') {
                    msg = `A soldier patrol of <strong>${encounter.size} ships</strong> is watching you closely (fame: ${playerFame}).`;
                    attackLabel = `Attack (−1 fame)`;
                } else if (encounter.faction === 'smugglers') {
                    msg = `A smuggler convoy of <strong>${encounter.size} ships</strong> is on the route.`;
                    attackLabel = `Attack (+1 fame)`;
                }

                bodyEl.innerHTML = `${detLine}<p>${msg}</p>`;
                engageBtn.textContent = attackLabel;
                retreatBtn.textContent = 'Pass';
                retreatBtn.style.display = '';

                engageBtn.onclick = () => {
                    closeModal();
                    startCombatWith(givesBounty, { enemyFirst: false }, computeFameDelta(encounter.faction, true));
                };

                retreatBtn.onclick = () => {
                    closeModal();
                    onContinue();
                };
            }
        }

        modalEl.style.display = 'flex';
    },
    
    startCombat: function(options = {}) {
        gameState.state = GAME_STATE.COMBAT;

        combat = new Combat(
            gameState.playerShips.map(s => s.clone()),
            gameState.enemyShips.map(s => s.clone()),
            options
        );

        UISystem.combatTab = 'actions';
        UISystem.showScreen('combatScreen');

        // Size canvas to its wrapper, then fit the arena into view
        renderingSystem.resizeCanvas();
        renderingSystem.fitArenaToCanvas();

        // Canvas click: mode-gated movement / shooting / ramming
        renderingSystem.initCombatEventListeners((wx, wy) => {
            if (!combat || combat.state !== COMBAT_STATE.PLAYER_TURN) {
                console.log(`[click] ignored: state=${combat?.state}`);
                return;
            }
            if (combat.isAnimating()) {
                console.log('[click] ignored: animating');
                return;
            }
            const activeShip     = combat.playerShips[combat.currentShipIndex];
            const clickedShip    = combat.getShipAtPosition(wx, wy);
            const clickedAsteroid = combat.getAsteroidAtPosition(wx, wy);
            const mode           = combat.playerMode;

            console.log(`[click] mode=${mode || 'none'} at (${wx.toFixed(0)},${wy.toFixed(0)}) active=${activeShip?.name}(act=${activeShip?.actionsRemaining}) clicked=${clickedShip ? clickedShip.name + (clickedShip.isPlayer ? '[P]' : '[E]') : 'empty'} asteroid=${!!clickedAsteroid}`);

            if (mode === 'fire') {
                if (clickedAsteroid && activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const shootRange = combat.getShootRange(activeShip);
                    const dist = distance(activeShip.x, activeShip.y, clickedAsteroid.x, clickedAsteroid.y);
                    const inRange = dist <= shootRange;
                    const inZone  = isInFiringZone(activeShip, clickedAsteroid);
                    console.log(`[click] asteroid fire: dist=${dist.toFixed(0)} range=${shootRange.toFixed(0)} inRange=${inRange} inZone=${inZone}`);
                    if (inRange && inZone) {
                        console.log('[click] → playerShootAtAsteroid');
                        combat.playerShootAtAsteroid(activeShip, clickedAsteroid);
                    } else {
                        console.log(`[click] asteroid fire BLOCKED: ${!inRange ? 'out of range' : 'not in firing zone'}`);
                    }
                } else {
                    if (clickedShip) combat.selectedCombatShip = clickedShip;
                    if (clickedShip && !clickedShip.isPlayer && !clickedShip.cloaked && activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                        const shootRange = combat.getShootRange(activeShip);
                        const inRange = dist <= shootRange;
                        const inZone  = isInFiringZone(activeShip, clickedShip);
                        console.log(`[click] fire check: dist=${dist.toFixed(0)} range=${shootRange.toFixed(0)} inRange=${inRange} inZone=${inZone} rotation=${(activeShip.rotation * 180 / Math.PI).toFixed(1)}°`);
                        if (inRange && inZone) {
                            console.log('[click] → playerShootAt');
                            combat.playerShootAt(activeShip, clickedShip);
                        } else {
                            console.log(`[click] fire BLOCKED: ${!inRange ? 'out of range' : 'not in firing zone'}`);
                        }
                    } else if (clickedShip) {
                        console.log(`[click] fire skipped: isPlayer=${clickedShip.isPlayer} cloaked=${clickedShip.cloaked} actions=${activeShip?.actionsRemaining} alive=${activeShip?.alive}`);
                    }
                }
            } else if (mode === 'move') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    if (clickedAsteroid) {
                        const inOval = isWithinMovementOval(activeShip, clickedAsteroid.x, clickedAsteroid.y);
                        console.log(`[click] asteroid ram check: inOval=${inOval}`);
                        if (inOval) {
                            console.log('[click] → playerRamAsteroid');
                            combat.playerRamAsteroid(activeShip, clickedAsteroid);
                        } else {
                            const target = clampToMovementOval(activeShip, clickedAsteroid.x, clickedAsteroid.y);
                            console.log(`[click] asteroid out of range → move toward (${target.x.toFixed(0)},${target.y.toFixed(0)})`);
                            combat.playerMoveToPoint(activeShip, target.x, target.y);
                        }
                    } else if (clickedShip) {
                        const isRammable = (!clickedShip.isPlayer || clickedShip.isBomb) && !clickedShip.cloaked;
                        if (isRammable) {
                            const inOval = isWithinMovementOval(activeShip, clickedShip.x, clickedShip.y);
                            console.log(`[click] ram check: inOval=${inOval} isBomb=${!!clickedShip.isBomb}`);
                            if (inOval) {
                                console.log('[click] → playerRamShip');
                                combat.playerRamShip(activeShip, clickedShip);
                            } else {
                                const target = clampToMovementOval(activeShip, clickedShip.x, clickedShip.y);
                                console.log(`[click] ship out of range → move toward (${target.x.toFixed(0)},${target.y.toFixed(0)})`);
                                combat.playerMoveToPoint(activeShip, target.x, target.y);
                            }
                        } else {
                            combat.selectedCombatShip = clickedShip;
                            console.log(`[click] ram skipped: isPlayer=${clickedShip.isPlayer} cloaked=${clickedShip.cloaked}`);
                        }
                    } else {
                        const target = clampToMovementOval(activeShip, wx, wy);
                        console.log(`[click] → playerMoveToPoint (${target.x.toFixed(0)},${target.y.toFixed(0)})`);
                        combat.playerMoveToPoint(activeShip, target.x, target.y);
                    }
                } else if (clickedShip) {
                    combat.selectedCombatShip = clickedShip;
                }
            } else if (mode === 'blink') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const dist = distance(activeShip.x, activeShip.y, wx, wy);
                    const tx = dist > CONSTANTS.BLINK_RANGE ? activeShip.x + (wx - activeShip.x) / dist * CONSTANTS.BLINK_RANGE : wx;
                    const ty = dist > CONSTANTS.BLINK_RANGE ? activeShip.y + (wy - activeShip.y) / dist * CONSTANTS.BLINK_RANGE : wy;
                    console.log(`[click] → playerBlink (clamped=${dist > CONSTANTS.BLINK_RANGE})`);
                    combat.playerBlink(activeShip, tx, ty);
                }
            } else if (mode === 'afterburner') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const maxRange  = activeShip.engine * (CONSTANTS.COMBAT_MOVE_OVAL_OFFSET + CONSTANTS.COMBAT_MOVE_OVAL_MAJOR) * CONSTANTS.AFTERBURNER_RANGE_MULT;
                    const halfAngle = CONSTANTS.AFTERBURNER_CONE_HALF_ANGLE;
                    const mouseAng  = Math.atan2(wy - activeShip.y, wx - activeShip.x);
                    const relAng    = Math.max(-halfAngle, Math.min(halfAngle, normalizeAngle(mouseAng - activeShip.rotation)));
                    const aimAng    = activeShip.rotation + relAng;
                    const tx = activeShip.x + Math.cos(aimAng) * maxRange;
                    const ty = activeShip.y + Math.sin(aimAng) * maxRange;
                    console.log(`[click] → playerAfterburner relAng=${(relAng * 180 / Math.PI).toFixed(0)}° range=${maxRange.toFixed(0)}`);
                    combat.playerAfterburner(activeShip, tx, ty);
                }
            } else if (mode === 'bomb') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const acx = activeShip.x + Math.cos(activeShip.rotation) * CONSTANTS.WARHEAD_LAUNCH_DIST;
                    const acy = activeShip.y + Math.sin(activeShip.rotation) * CONSTANTS.WARHEAD_LAUNCH_DIST;
                    const d = distance(acx, acy, wx, wy);
                    const inside = d <= CONSTANTS.WARHEAD_TARGET_RADIUS;
                    const tx = inside ? wx : acx + (wx - acx) / d * CONSTANTS.WARHEAD_TARGET_RADIUS;
                    const ty = inside ? wy : acy + (wy - acy) / d * CONSTANTS.WARHEAD_TARGET_RADIUS;
                    console.log(`[click] → playerPlantBomb at (${tx.toFixed(0)},${ty.toFixed(0)})`);
                    combat.playerPlantBomb(activeShip, tx, ty);
                }
            } else if (mode === 'tractor_beam') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const tractorRange = combat.getTractorBeamRange(activeShip);
                    let tractorFired = false;
                    if (clickedShip && clickedShip !== activeShip) {
                        const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                        const inCone = clickedShip.isPlayer || isInTractorBeamCone(activeShip, clickedShip);
                        if (dist <= tractorRange && inCone) {
                            console.log('[click] → playerTractorBeam (ship)');
                            combat.playerTractorBeam(activeShip, clickedShip);
                            tractorFired = true;
                        }
                    }
                    if (!tractorFired && clickedAsteroid) {
                        const dist = distance(activeShip.x, activeShip.y, clickedAsteroid.x, clickedAsteroid.y);
                        const ang = Math.atan2(clickedAsteroid.y - activeShip.y, clickedAsteroid.x - activeShip.x);
                        const localAng = normalizeAngle(ang - activeShip.rotation);
                        if (dist <= tractorRange && Math.abs(localAng) <= CONSTANTS.TRACTOR_BEAM_HALF_ANGLE) {
                            console.log('[click] → playerTractorBeam (asteroid)');
                            combat.playerTractorBeam(activeShip, clickedAsteroid);
                            tractorFired = true;
                        }
                    }
                    if (!tractorFired) {
                        // No valid target — cancel targeting mode
                        combat.playerMode = null;
                        UISystem.updateCombatScreen(gameState, combat);
                    }
                }
            } else if (mode === 'debris_field') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    console.log('[click] → playerDebrisField');
                    combat.playerDebrisField(activeShip);
                }
            } else if (mode === 'emp_blast') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const acx = activeShip.x + Math.cos(activeShip.rotation) * CONSTANTS.WARHEAD_LAUNCH_DIST;
                    const acy = activeShip.y + Math.sin(activeShip.rotation) * CONSTANTS.WARHEAD_LAUNCH_DIST;
                    const d = distance(acx, acy, wx, wy);
                    const inside = d <= CONSTANTS.WARHEAD_TARGET_RADIUS;
                    const tx = inside ? wx : acx + (wx - acx) / d * CONSTANTS.WARHEAD_TARGET_RADIUS;
                    const ty = inside ? wy : acy + (wy - acy) / d * CONSTANTS.WARHEAD_TARGET_RADIUS;
                    console.log(`[click] → playerEmpBlast at (${tx.toFixed(0)},${ty.toFixed(0)})`);
                    combat.playerEmpBlast(activeShip, tx, ty);
                }
            } else if (mode === 'repair_beam') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    console.log('[click] → playerRepairBeam (cone)');
                    combat.playerRepairBeam(activeShip);
                }
            } else if (mode === 'supercharge') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const range = activeShip.radar * CONSTANTS.SHOOT_RANGE_BASE * 0.75;
                    const halfAngle = CONSTANTS.SUPERCHARGE_CONE_HALF_ANGLE;
                    const allies = activeShip.isPlayer ? combat.playerShips : combat.enemyShips;
                    const target = allies.find(s => {
                        if (s === activeShip || !s.alive || s.isBomb) return false;
                        const dist = distance(activeShip.x, activeShip.y, s.x, s.y);
                        if (dist > range) return false;
                        const ang = Math.atan2(s.y - activeShip.y, s.x - activeShip.x);
                        const localAng = normalizeAngle(ang - activeShip.rotation);
                        return Math.abs(localAng) <= halfAngle
                            && distance(s.x, s.y, wx, wy) <= CONSTANTS.SHIP_SIZE * 4;
                    });
                    if (target) {
                        console.log(`[click] → playerSupercharge ${target.name}`);
                        combat.playerSupercharge(activeShip, target);
                    }
                }
            } else if (mode === 'flash') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const dist = distance(activeShip.x, activeShip.y, wx, wy);
                    const tx = dist > CONSTANTS.FLASH_RANGE ? activeShip.x + (wx - activeShip.x) / dist * CONSTANTS.FLASH_RANGE : wx;
                    const ty = dist > CONSTANTS.FLASH_RANGE ? activeShip.y + (wy - activeShip.y) / dist * CONSTANTS.FLASH_RANGE : wy;
                    console.log(`[click] → playerFlash at (${tx.toFixed(0)},${ty.toFixed(0)})`);
                    combat.playerFlash(activeShip, tx, ty);
                }
            } else if (mode === 'hack') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && clickedShip !== activeShip) {
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    if (dist <= CONSTANTS.HACK_RANGE) {
                        console.log(`[click] → playerHack ${clickedShip.name}`);
                        combat.playerHack(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'mark') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && clickedShip !== activeShip) {
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    const ang = Math.atan2(clickedShip.y - activeShip.y, clickedShip.x - activeShip.x);
                    const localAng = normalizeAngle(ang - activeShip.rotation);
                    if (dist <= CONSTANTS.MARK_RANGE && Math.abs(localAng) <= CONSTANTS.MARK_CONE_HALF_ANGLE) {
                        console.log(`[click] → playerMark ${clickedShip.name}`);
                        combat.playerMark(activeShip, clickedShip);
                    }
                }
            } else {
                // Default: select only
                if (clickedShip) combat.selectedCombatShip = clickedShip;
                console.log('[click] select-only mode');
            }

            UISystem.updateCombatScreen(gameState, combat);
        });

        UISystem.updateCombatScreen(gameState, combat);
        if (options.enemyFirst) combat.beginEnemyTurn();
        this.startGameLoop();
    },
    
    startGameLoop: function() {
        lastTime = Date.now();
        animationFrameId = requestAnimationFrame(() => this.gameLoop());
    },
    
    gameLoop: function() {
        const currentTime = Date.now();
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        if (combat && gameState.state === GAME_STATE.COMBAT) {
            combat.update(deltaTime);

            if (combat.state === COMBAT_STATE.ENDED) {
                const elapsed = combat._endedAt ? Date.now() - combat._endedAt : 0;
                if (elapsed >= 1500) {
                    this.showCombatResultModal();
                    cancelAnimationFrame(animationFrameId);
                    return;
                }
                // Still in delay — keep rendering but don't show modal yet
            }
            
            animationFrameId = requestAnimationFrame(() => this.gameLoop());
        }
    },
    
    showCombatResultModal: function() {
        if (!combat) return;
        const titleEl = document.getElementById('combatResultTitle');
        const bodyEl  = document.getElementById('combatResultBody');

        const allPlayerShips = [...combat.playerShips, ...combat.fleedPlayerShips];
        const allEnemyShips  = [...combat.enemyShips,  ...combat.fleedEnemyShips];

        const playerDestroyed = allPlayerShips.filter(s => !s.alive).length;
        const playerFled      = allPlayerShips.filter(s => s.fled && s.alive).length;
        const playerSurvived  = allPlayerShips.filter(s => s.alive && !s.fled).length;
        const enemyDestroyed  = allEnemyShips.filter(s => !s.alive).length;
        const enemyFled       = allEnemyShips.filter(s => s.fled && s.alive).length;
        const enemySurvived   = allEnemyShips.filter(s => s.alive && !s.fled).length;
        const rewards         = combat.getRewards();

        if (combat.won && !combat.playerRetreated) {
            titleEl.textContent = 'Victory!';
            titleEl.style.color = '#44ff88';
        } else if (combat.lost) {
            titleEl.textContent = 'Defeat';
            titleEl.style.color = '#ff4444';
        } else {
            titleEl.textContent = 'Retreated';
            titleEl.style.color = '#ffaa44';
        }

        const playerSummaryParts = [];
        if (playerSurvived > 0) playerSummaryParts.push(`${playerSurvived} survived`);
        if (playerFled > 0)     playerSummaryParts.push(`${playerFled} fled`);
        if (playerDestroyed > 0) playerSummaryParts.push(`${playerDestroyed} destroyed`);

        const enemySummaryParts = [];
        if (enemyDestroyed > 0) enemySummaryParts.push(`${enemyDestroyed} destroyed`);
        if (enemyFled > 0)      enemySummaryParts.push(`${enemyFled} fled`);
        if (enemySurvived > 0)  enemySummaryParts.push(`${enemySurvived} survived`);

        const faction = _defeatedEncounterInfo ? _defeatedEncounterInfo.faction : null;
        const factionData = faction ? CONSTANTS.FACTIONS.find(f => f.id === faction) : null;
        const creditMult = factionData ? (factionData.creditMult || 1) : 1;
        const displayRewards = Math.round(rewards * creditMult);
        const creditNote = creditMult > 1 ? ' — wealthy convoy' : creditMult < 1 ? ' — few valuables' : ` (${enemyDestroyed} × ${CONSTANTS.CREDITS_PER_ENEMY_DESTROYED} cr per kill)`;
        const creditsLine = displayRewards > 0
            ? `<p style="color:#ffdd44;margin-top:0.5em;">+${displayRewards} credits${creditNote}</p>`
            : '';

        bodyEl.innerHTML = `
            <div style="margin-bottom:0.75em;">
                <div style="color:#44ccff;font-weight:bold;margin-bottom:0.2em;">Your Fleet</div>
                <div style="font-size:0.78em;color:#aaa;margin-bottom:0.3em;">${playerSummaryParts.join(' · ')}</div>
                ${UISystem.renderShipTable(allPlayerShips, { bars: true })}
            </div>
            <div style="margin-bottom:0.5em;">
                <div style="color:#ff6666;font-weight:bold;margin-bottom:0.2em;">Enemy Fleet</div>
                <div style="font-size:0.78em;color:#aaa;margin-bottom:0.3em;">${enemySummaryParts.join(' · ')}</div>
                ${UISystem.renderShipTable(allEnemyShips, { bars: true })}
            </div>
            ${creditsLine}`;

        document.getElementById('combatResultModal').style.display = 'flex';
    },

    endCombat: function() {
        if (!combat) return;

        gameState.playerShips = [...combat.playerShips, ...combat.fleedPlayerShips];
        gameState.enemyShips = combat.enemyShips;

        cancelAnimationFrame(animationFrameId);

        if (combat.won && !combat.playerRetreated) {
            const rewards = combat.getRewards();
            if (_defeatedEncounterInfo) {
                const fameDelta = _defeatedEncounterInfo.fameDelta || 0;
                if (fameDelta !== 0) gameState.fame = (gameState.fame || 0) + fameDelta;

                // Clear the alien route if this was an alien encounter on a route
                if (_defeatedEncounterInfo.alienRouteKey) {
                    gameState.alienRoutes.delete(_defeatedEncounterInfo.alienRouteKey);
                }

                // Queen fight win = game won
                if (_defeatedEncounterInfo.isQueenFight) {
                    _defeatedEncounterInfo = null;
                    gameState.state = GAME_STATE.GAME_WON;
                    document.getElementById('gameOverTitle').textContent = 'Victory!';
                    document.getElementById('gameOverTitle').style.color = '#ffdd00';
                    document.getElementById('gameOverMessage').textContent = 'You defeated the Alien Queen. The invasion is over — the galaxy is saved!';
                    document.getElementById('gameOverButton').textContent = 'Start New Game';
                    UISystem.showScreen('gameOverScreen');
                    cancelAnimationFrame(animationFrameId);
                    return;
                }

                const factionDataEC = CONSTANTS.FACTIONS.find(f => f.id === _defeatedEncounterInfo.faction);
                const creditMult = factionDataEC ? (factionDataEC.creditMult || 1) : 1;
                gameState.credits += Math.round(rewards * creditMult);
                // Don't respawn alien fleets
                if (!_defeatedEncounterInfo.alienRouteKey) {
                    this.respawnFleet(_defeatedEncounterInfo);
                }
                _defeatedEncounterInfo = null;
            } else {
                gameState.credits += rewards;
            }
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            if (_travelContinuation) {
                const cont = _travelContinuation;
                _travelContinuation = null;
                cont();
            } else {
                UISystem.updateGalaxyScreen(gameState);
            }
        } else if (combat.lost) {
            _travelContinuation = null;
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            UISystem.showGameOver(false, 'All your ships were destroyed. Game Over!');
            gameState.state = GAME_STATE.GAME_OVER;
        } else if (combat.playerRetreated) {
            // Retreated mid-travel → continue to destination (can't turn back)
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            if (_travelContinuation) {
                const cont = _travelContinuation;
                _travelContinuation = null;
                cont();
            } else {
                if (galaxyRenderer) galaxyRenderer._travelAnim = null;
                UISystem.updateGalaxyScreen(gameState);
            }
        }
    }
};

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
    TooltipSystem.init();
    GameController.init();
});
