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

const GameController = {
    init: function() {
        this.initializeGameState();
        initRendering();
        initGalaxyRenderer();
        this.setupEventListeners();
        UISystem.showScreen('titleScreen');

        spriteSystem.loadAll({
            battleship:   'images/battleship.png',
            jammer:       'images/jammer.png',
            repair_ship:  'images/repair_ship.png',
            smuggler:     'images/smuggler.png',
        });
    },
    
    initializeGameState: function() {
        const systems = SpaceTravel.generateUniverse();
        const startingSystem = SpaceTravel.initializeStartingSystem(systems);
        const routeFleets = SpaceTravel.generateRouteFleets(systems);

        // Remove enemy fleets from routes adjacent to the starting system so the player isn't immediately blocked
        startingSystem.connections.forEach(connId => {
            routeFleets.delete(getRouteKey(startingSystem.id, connId));
        });

        gameState = {
            state: GAME_STATE.TITLE,
            credits: CONSTANTS.PLAYER_STARTING_CREDITS,
            bounty: 0,
            systems: systems,
            routeFleets: routeFleets,
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
        
        // Keyboard zoom (+/= to zoom in, -/_ to zoom out)
        window.addEventListener('keydown', (e) => {
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
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
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

        // Positions are stored relative to the canonical (lower-id → higher-id) direction.
        // If traveling in reverse, mirror each position so the order matches the animation.
        const reversed = fromSystem.id > targetSystem.id;
        const encounters = (gameState.routeFleets.get(routeKey) || [])
            .map(enc => reversed ? { ...enc, _original: enc, position: 1 - enc.position } : enc)
            .sort((a, b) => a.position - b.position);

        const arrive = () => {
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            SpaceTravel.travelToSystem(fromSystem, targetSystem);
            SpaceTravel.revealAdjacentSystems(targetSystem, gameState.systems);
            gameState.currentSystem = targetSystem;
            gameState.selectedSystem = targetSystem;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        };

        if (galaxyRenderer) galaxyRenderer.startTravelAnim(fromSystem, targetSystem);
        this.processEncounters(fromSystem, targetSystem, routeKey, encounters, 0, arrive);
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
            galaxyRenderer.animateTravelSegment(encounter.position, () => {
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

        // Silent pass: police ignore player with no bounty
        if (encounter.faction === 'police' && !(gameState.bounty > 0)) {
            onContinue();
            return;
        }

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

        const startCombatWith = (addBounty, combatOptions = {}) => {
            if (addBounty) gameState.bounty = (gameState.bounty || 0) + CONSTANTS.FLEET_ATTACK_BOUNTY;
            removeEncounter();
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

        if (undetected) {
            // ── UNDETECTED: player saw them first ──────────────────────────────────
            const detLine = `<p style="color:#00ff88;font-size:0.85em;margin-bottom:0.3em;">
                ✓ Undetected — your radar (${playerRadar}) outpaced theirs (${enemyRadar})
            </p>`;
            let fleetDesc = '';
            if (encounter.faction === 'pirates')   fleetDesc = `A pirate fleet of <strong>${encounter.size} ships</strong> ahead.`;
            if (encounter.faction === 'police')    fleetDesc = `A police patrol of <strong>${encounter.size} ships</strong> ahead.`;
            if (encounter.faction === 'merchants') fleetDesc = `A merchant convoy of <strong>${encounter.size} ships</strong> ahead.`;

            bodyEl.innerHTML = `${detLine}<p>${fleetDesc}</p>
                <p style="color:#aaa;font-size:0.82em;margin-top:0.3em;">Each option has a <strong>50%</strong> chance of success.</p>`;

            engageBtn.textContent = 'Ambush';
            retreatBtn.textContent = 'Sneak Around';
            retreatBtn.style.display = '';

            engageBtn.onclick = () => {
                closeModal();
                if (Math.random() < 0.5) {
                    // Ambush success: enemy 0 shields, faces away, player first
                    startCombatWith(false, { ambush: true, enemyFirst: false });
                } else {
                    // Ambush failed: they spotted you, enemy first
                    startCombatWith(false, { enemyFirst: true });
                }
            };

            retreatBtn.onclick = () => {
                closeModal();
                if (Math.random() < 0.5) {
                    // Sneak success: pass without combat
                    onContinue();
                } else {
                    // Sneak failed: they spotted you, enemy first
                    startCombatWith(false, { enemyFirst: true });
                }
            };
        } else {
            // ── DETECTED: normal faction encounter ─────────────────────────────────
            const detLine = `<p style="color:#ff6644;font-size:0.85em;margin-bottom:0.3em;">
                ✗ Detected — their radar (${enemyRadar}) overpowered yours (${playerRadar})
            </p>`;

            const playerBounty = gameState.bounty || 0;
            let willAttack = false;
            if (encounter.faction === 'pirates') {
                willAttack = Math.random() < CONSTANTS.FLEET_PIRATE_ATTACK_CHANCE;
            } else if (encounter.faction === 'police' && playerBounty > 0) {
                willAttack = Math.random() < CONSTANTS.FLEET_POLICE_ATTACK_CHANCE;
            }

            if (willAttack) {
                let msg = '';
                if (encounter.faction === 'pirates')
                    msg = `A pirate fleet of <strong>${encounter.size} ships</strong> is moving to intercept!`;
                else if (encounter.faction === 'police')
                    msg = `A police patrol of <strong>${encounter.size} ships</strong> has detected your bounty and is closing in!`;

                bodyEl.innerHTML = `${detLine}<p>${msg}</p>`;
                engageBtn.textContent = 'Fight';
                retreatBtn.style.display = 'none';

                engageBtn.onclick = () => {
                    closeModal();
                    startCombatWith(false, { enemyFirst: true }); // they spotted you
                };
            } else {
                const givesBounty = encounter.faction !== 'pirates';
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
                }

                bodyEl.innerHTML = `${detLine}<p>${msg}</p>`;
                engageBtn.textContent = attackLabel;
                retreatBtn.textContent = 'Pass';
                retreatBtn.style.display = '';

                engageBtn.onclick = () => {
                    closeModal();
                    startCombatWith(givesBounty, { enemyFirst: false }); // player attacks
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
                if (clickedAsteroid && activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const inOval = isWithinMovementOval(activeShip, clickedAsteroid.x, clickedAsteroid.y);
                    console.log(`[click] asteroid ram check: inOval=${inOval}`);
                    if (inOval) {
                        console.log('[click] → playerRamAsteroid');
                        combat.playerRamAsteroid(activeShip, clickedAsteroid);
                    } else {
                        console.log('[click] asteroid ram BLOCKED: outside movement oval');
                    }
                } else if (clickedShip) {
                    combat.selectedCombatShip = clickedShip;
                    if (!clickedShip.isPlayer && !clickedShip.cloaked && activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        const inOval = isWithinMovementOval(activeShip, clickedShip.x, clickedShip.y);
                        console.log(`[click] ram check: inOval=${inOval}`);
                        if (inOval) {
                            console.log('[click] → playerRamShip');
                            combat.playerRamShip(activeShip, clickedShip);
                        } else {
                            console.log('[click] ram BLOCKED: target outside movement oval');
                        }
                    } else {
                        console.log(`[click] ram skipped: isPlayer=${clickedShip.isPlayer} cloaked=${clickedShip.cloaked} actions=${activeShip?.actionsRemaining}`);
                    }
                } else if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const target = clampToMovementOval(activeShip, wx, wy);
                    console.log(`[click] → playerMoveToPoint (${target.x.toFixed(0)},${target.y.toFixed(0)})`);
                    combat.playerMoveToPoint(activeShip, target.x, target.y);
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
            } else if (mode === 'warhead') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    // Clamp click to the targeting circle centered ahead of the ship
                    const acx = activeShip.x + Math.cos(activeShip.rotation) * CONSTANTS.WARHEAD_LAUNCH_DIST;
                    const acy = activeShip.y + Math.sin(activeShip.rotation) * CONSTANTS.WARHEAD_LAUNCH_DIST;
                    const d = distance(acx, acy, wx, wy);
                    const inside = d <= CONSTANTS.WARHEAD_TARGET_RADIUS;
                    const tx = inside ? wx : acx + (wx - acx) / d * CONSTANTS.WARHEAD_TARGET_RADIUS;
                    const ty = inside ? wy : acy + (wy - acy) / d * CONSTANTS.WARHEAD_TARGET_RADIUS;
                    console.log(`[click] → playerWarhead at (${tx.toFixed(0)},${ty.toFixed(0)}) aimDist=${d.toFixed(0)}`);
                    combat.playerWarhead(activeShip, tx, ty);
                }
            } else if (mode === 'tractor_beam') {
                if (clickedShip && clickedShip !== activeShip && activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const tractorRange = combat.getTractorBeamRange(activeShip);
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    const inRange = dist <= tractorRange;
                    const inCone  = clickedShip.isPlayer || isInTractorBeamCone(activeShip, clickedShip);
                    console.log(`[click] tractor_beam: dist=${dist.toFixed(0)} range=${tractorRange.toFixed(0)} inRange=${inRange} inCone=${inCone}`);
                    if (inRange && inCone) {
                        console.log('[click] → playerTractorBeam');
                        combat.playerTractorBeam(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'emp_blast') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    console.log('[click] → playerEmpBlast');
                    combat.playerEmpBlast(activeShip);
                }
            } else if (mode === 'detonate') {
                if (activeShip && activeShip.alive && activeShip.isDrone) {
                    console.log('[click] → playerDroneDetonate');
                    combat.playerDroneDetonate(activeShip);
                }
            } else if (mode === 'repair_beam') {
                if (clickedShip && clickedShip !== activeShip && clickedShip.alive && activeShip && activeShip.actionsRemaining > 0) {
                    const repairRange = combat.getRepairBeamRange(activeShip);
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    const inZone = isInFiringZone(activeShip, clickedShip);
                    console.log(`[click] repair_beam: dist=${dist.toFixed(0)} range=${repairRange.toFixed(0)} inZone=${inZone}`);
                    if (dist <= repairRange && inZone) {
                        console.log('[click] → playerRepairBeam');
                        combat.playerRepairBeam(activeShip, clickedShip);
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

        const creditsLine = rewards > 0
            ? `<p style="color:#ffdd44;margin-top:0.5em;">+${rewards} credits (${enemyDestroyed} × ${CONSTANTS.CREDITS_PER_ENEMY_DESTROYED} cr per kill)</p>`
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
            gameState.credits += rewards;
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
