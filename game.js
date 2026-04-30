// Main Game File

/**
 * @typedef {{
 *   state: string,
 *   credits: number,
 *   systems: Array<{id:number, name:string, x:number, y:number, visited:boolean, resourceLevel:number, connections:number[]}>,
 *   routeFleets: Set<string>,
 *   combatRouteKey: string|null,
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

const GameController = {
    init: function() {
        this.initializeGameState();
        initRendering();
        initGalaxyRenderer();
        this.setupEventListeners();
        UISystem.showScreen('titleScreen');
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
            systems: systems,
            routeFleets: routeFleets,
            combatRouteKey: null,
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

        const arrive = () => {
            SpaceTravel.travelToSystem(fromSystem, targetSystem);
            SpaceTravel.revealAdjacentSystems(targetSystem, gameState.systems);
            gameState.currentSystem = targetSystem;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        };

        if (gameState.routeFleets.has(routeKey)) {
            galaxyRenderer.animateTravel(fromSystem, targetSystem, () => {
                this.showEncounterModal(fromSystem, targetSystem, routeKey);
            }, arrive);
        } else {
            galaxyRenderer.animateTravel(fromSystem, targetSystem, null, arrive);
        }
    },

    showEncounterModal: function(fromSystem, targetSystem, routeKey) {
        const fleetData = gameState.routeFleets.get(routeKey);
        const fleetSize = fleetData.size;
        document.getElementById('encounterModalBody').innerHTML =
            `<p>An enemy fleet of <strong>${fleetSize} ships</strong> is blocking the route to ${targetSystem.name}!</p>`;
        document.getElementById('encounterModal').style.display = 'flex';

        document.getElementById('encounterEngageBtn').onclick = () => {
            document.getElementById('encounterModal').style.display = 'none';
            SpaceTravel.travelToSystem(fromSystem, targetSystem);
            SpaceTravel.revealAdjacentSystems(targetSystem, gameState.systems);
            gameState.currentSystem = targetSystem;
            gameState.combatRouteKey = routeKey;
            gameState.enemyShips = SpaceTravel.generateEnemyFleet(fleetSize);
            this.startCombat();
        };

        document.getElementById('encounterRetreatBtn').onclick = () => {
            document.getElementById('encounterModal').style.display = 'none';
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        };
    },
    
    startCombat: function() {
        gameState.state = GAME_STATE.COMBAT;

        combat = new Combat(
            gameState.playerShips.map(s => s.clone()),
            gameState.enemyShips.map(s => s.clone())
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
            } else {
                // Default: select only
                if (clickedShip) combat.selectedCombatShip = clickedShip;
                console.log('[click] select-only mode');
            }

            UISystem.updateCombatScreen(gameState, combat);
        });

        UISystem.updateCombatScreen(gameState, combat);
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

        // Update actual game state with combat results (fled player ships survive)
        gameState.playerShips = [...combat.playerShips, ...combat.fleedPlayerShips];
        gameState.enemyShips = combat.enemyShips;

        cancelAnimationFrame(animationFrameId);

        if (combat.won && !combat.playerRetreated) {
            // Player won — add rewards, clear route, then resume travel animation to destination
            const rewards = combat.getRewards();
            gameState.credits += rewards;
            if (gameState.combatRouteKey) {
                gameState.routeFleets.delete(gameState.combatRouteKey);
                gameState.combatRouteKey = null;
            }
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            if (galaxyRenderer && galaxyRenderer._travelAnim) {
                galaxyRenderer.resumeTravel();
            } else {
                UISystem.updateGalaxyScreen(gameState);
            }
        } else if (combat.lost) {
            // Player lost
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            UISystem.showGameOver(false, 'All your ships were destroyed. Game Over!');
            gameState.state = GAME_STATE.GAME_OVER;
        } else if (combat.playerRetreated) {
            // Ships fled combat — already at target system, clear transit animation
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        }
    }
};

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
    GameController.init();
});
