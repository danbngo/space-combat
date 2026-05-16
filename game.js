// Main Game File

const PLAYER_FACTIONS = [
    { id: 'police',    name: 'Police',    color: '#4488ff', startingShip: 'Interceptor',    startingBounty: 0,    desc: 'Law enforcement officers.',      startingPerk: 'gunner_1',      startingItem: 'battery',       effects: 'Cannot attack non-criminals · No bounty · 2× credits from pirate contracts · Starts with Gunner I + Battery Pack' },
    { id: 'pirates',   name: 'Pirates',   color: '#ff4444', startingShip: 'Raider',          startingBounty: 1000, desc: 'Outlaws who take what they want.', startingPerk: 'salvaging_1',   startingItem: 'nanites',       effects: 'Start with 1000 bounty · Cannot use courthouses · Enemy pirates are friendly · Starts with Salvaging I + Nanite Canister' },
    { id: 'merchants', name: 'Merchants', color: '#ffcc44', startingShip: 'Freighter',       startingBounty: 0,    desc: 'Shrewd traders and deal-makers.',   startingPerk: 'barter_1',      startingItem: 'teleporter',    effects: 'Merchant fleets offer to trade · Starts with Barter I + Teleporter' },
    { id: 'smugglers', name: 'Smugglers', color: '#aa44ff', startingShip: 'Blockade Runner', startingBounty: 0,    desc: 'Operators in unofficial channels.',  startingPerk: 'engineering_1', startingItem: 'flash_grenade', effects: 'Starts with Engineering I + Flash Grenade' },
];

/**
 * @typedef {{
 *   state: string,
 *   credits: number,
 *   systems: Array<{id:number, name:string, tier:number, x:number, y:number, visited:boolean, connections:number[], parentId:number|null, isQueenPlanet:boolean, stationType:string|null}>,
 *   routes: Map<string, object>,
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

// State needed to re-show the travel screen after returning from combat.
let _travelScreenState = null;

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
            carrier:      'images/carrier.png',
            freighter:    'images/freighter.png',
            interceptor:  'images/interceptor.png',
            jammer:       'images/jammer.png',
            repair_ship:  'images/repair_ship.png',
            scout:        'images/scout.png',
            blockade_runner:     'images/blockade_runner.png',
            raider:       'images/raider.png',
            hijacker:     'images/hijacker.png',
            amplifier:    'images/amplifier.png',
        });
    },
    
    initializeGameState: function() {
        const { systems, routes } = SpaceTravel.generateTree();
        const startingSystem = SpaceTravel.initializeStartingSystem(systems);

        gameState = {
            state: GAME_STATE.TITLE,
            credits: CONSTANTS.PLAYER_STARTING_CREDITS,
            bounty: 0,
            fame: 0,
            contracts: 0,
            day: 1,
            playerFaction: null,
            playerName: 'Commander',
            exp: 0,
            perks: [],
            systems,
            routes,
            currentSystem: startingSystem,
            selectedSystem: startingSystem,
            selectedShip: null,
            playerShips: [],
            enemyShips: [],
        };
        // Ships are created in beginNewGame() after faction selection
    },

    showCharacterCreation: function() {
        const container = document.getElementById('factionCards');
        if (!container) return;
        this._selectedFaction = 'police';
        this._selectedBonusPerk = null;

        const updateBonusPerkPicker = (factionId) => {
            const faction = PLAYER_FACTIONS.find(f => f.id === factionId);
            const startingPerk = faction ? faction.startingPerk : null;
            const eligible = (CONSTANTS.PERKS || []).filter(p =>
                p.id !== startingPerk &&
                (!p.requires || p.requires === startingPerk)
            );
            // Keep current selection if still valid, otherwise pick first
            if (!eligible.find(p => p.id === this._selectedBonusPerk)) {
                this._selectedBonusPerk = eligible.length > 0 ? eligible[0].id : null;
            }
            const picker = document.getElementById('bonusPerkPicker');
            if (!picker) return;
            picker.innerHTML = eligible.map(p => {
                const sel = this._selectedBonusPerk === p.id;
                return `<div class="perk-pick-card" data-perk-id="${p.id}"
                    style="border:2px solid ${sel ? '#aaff44' : '#333'};border-radius:4px;padding:0.5em 0.65em;
                           background:${sel ? '#0d1800' : '#0a0a0a'};cursor:pointer;">
                    <div style="color:${sel ? '#aaff44' : '#eee'};font-weight:bold;font-size:0.88em;">${p.name}</div>
                    <div style="color:#555;font-size:0.7em;line-height:1.4;margin-top:0.15em;">${p.desc}</div>
                </div>`;
            }).join('');
            picker.querySelectorAll('.perk-pick-card').forEach(card => {
                card.addEventListener('click', () => {
                    this._selectedBonusPerk = card.dataset.perkId;
                    updateBonusPerkPicker(factionId);
                });
            });
        };

        container.innerHTML = PLAYER_FACTIONS.map(f => `
            <div class="faction-card" data-faction-id="${f.id}" data-faction-color="${f.color}"
                style="border:2px solid #333;border-radius:4px;padding:0.75em;background:#0a0a0a;cursor:pointer;">
                <div style="color:${f.color};font-weight:bold;margin-bottom:0.1em;">${f.name}
                    <span style="color:#555;font-weight:normal;font-size:0.78em;">— ${f.startingShip}</span>
                </div>
                <div style="color:#666;font-size:0.72em;line-height:1.45;margin-top:0.2em;">${f.effects}</div>
            </div>`).join('');

        container.querySelectorAll('.faction-card').forEach(card => {
            card.addEventListener('click', () => {
                container.querySelectorAll('.faction-card').forEach(c => {
                    c.style.borderColor = '#333';
                    c.style.background = '#0a0a0a';
                });
                card.style.borderColor = card.dataset.factionColor;
                card.style.background = '#111';
                this._selectedFaction = card.dataset.factionId;
                updateBonusPerkPicker(card.dataset.factionId);
            });
        });

        const firstCard = container.querySelector('.faction-card');
        if (firstCard) firstCard.click();

        document.getElementById('commanderNameInput').value = '';
        UISystem.showScreen('characterCreationScreen');
        setTimeout(() => document.getElementById('commanderNameInput').focus(), 80);
    },

    beginNewGame: function(playerName, playerFaction) {
        gameState.playerName    = (playerName || '').trim() || 'Commander';
        gameState.playerFaction = playerFaction || 'merchants';

        const factionData = PLAYER_FACTIONS.find(f => f.id === playerFaction);
        if (factionData && factionData.startingBounty) {
            gameState.bounty = factionData.startingBounty;
        }

        const startShipType = factionData ? factionData.startingShip : null;
        let startingShip;
        if (startShipType) {
            startingShip = SpaceTravel.generateShipOfType(startShipType);
            startingShip.isPlayer = true;
        } else {
            startingShip = new Ship(0, 0, true);
        }
        startingShip._buyPrice = CONSTANTS.NEW_SHIP_BASE_COST;
        gameState.playerShips  = [startingShip];
        if (factionData && factionData.startingPerk) {
            gameState.perks = [factionData.startingPerk];
        }
        if (this._selectedBonusPerk && !gameState.perks.includes(this._selectedBonusPerk)) {
            gameState.perks.push(this._selectedBonusPerk);
        }
        if (factionData && factionData.startingItem) {
            startingShip.inventory = [factionData.startingItem];
        }
        assignFleetNames(gameState.playerShips);
        gameState.selectedShip = startingShip;

        this.startGame();
    },

    setupEventListeners: function() {
        // Title Screen
        document.getElementById('startButton').addEventListener('click', () => {
            this.showCharacterCreation();
        });

        // Character Creation
        document.getElementById('beginGameButton').addEventListener('click', () => {
            const name    = document.getElementById('commanderNameInput').value;
            const faction = this._selectedFaction || 'merchants';
            this.beginNewGame(name, faction);
        });
        document.getElementById('commanderNameInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('beginGameButton').click();
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
        document.getElementById('shipyardTab').addEventListener('click', () => {
            UISystem.setStationTab('shipyard', gameState);
        });
        document.getElementById('modulesTab').addEventListener('click', () => {
            UISystem.setStationTab('modules', gameState);
        });
        document.getElementById('mechanicTab').addEventListener('click', () => {
            UISystem.setStationTab('mechanic', gameState);
        });
        document.getElementById('courthouseTab').addEventListener('click', () => {
            UISystem.setStationTab('courthouse', gameState);
        });
        document.getElementById('marketplaceTab').addEventListener('click', () => {
            UISystem.setStationTab('marketplace', gameState);
        });
        
        document.getElementById('leaveStationButton').addEventListener('click', () => {
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        });

        document.getElementById('closePerksButton').addEventListener('click', () => {
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
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
            UISystem.currentStationOffer = null;
            UISystem.currentModuleOffer = null;
            combat = null;
            _travelContinuation = null;
            _defeatedEncounterInfo = null;
            _travelScreenState = null;
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            document.getElementById('gameOverButton').textContent = 'Start New Game';
            this.initializeGameState();
            UISystem.showScreen('titleScreen');
        });
    },
    
    startGame: function() {
        gameState.state = GAME_STATE.GALAXY;
        UISystem.showScreen('galaxyScreen');
        if (galaxyRenderer) { galaxyRenderer.resizeCanvas(); galaxyRenderer.initializeZoom(); }
        UISystem.updateGalaxyScreen(gameState);
    },

    openPerksScreen: function() {
        UISystem.showScreen('perksScreen');
        UISystem.updatePerksScreen(gameState);
    },
    
    visitStation: function() {
        gameState.state = GAME_STATE.STATION;
        gameState.selectedShip = gameState.selectedShip || gameState.playerShips[0] || null;
        // Tab is driven by stationType — updateStationScreen sets it; just clear offers
        UISystem.currentStationOffer = null;
        UISystem.currentModuleOffer = null;
        StationSystem.visitStation(gameState);
        UISystem.showScreen('stationScreen');
        UISystem.updateStationScreen(gameState);
    },
    
    travelToSystem: function(targetSystem) {
        const fromSystem = gameState.currentSystem;

        // Guard: only allow travel to direct children (no backtracking)
        if (!fromSystem.connections.includes(targetSystem.id)) return;

        const routeKey  = getRouteKey(fromSystem.id, targetSystem.id);
        const routeData = gameState.routes ? gameState.routes.get(routeKey) : null;
        // Use the pre-rolled fleets; filter out any already cleared on a prior trip
        const encounters = routeData && routeData.fleets ? routeData.fleets.filter(f => !f.done) : [];

        const alive     = gameState.playerShips.filter(s => s.alive);
        const avgEngine = alive.length > 0 ? alive.reduce((sum, s) => sum + s.engine, 0) / alive.length : 10;

        const arrive = () => {
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            const routeDist   = distance(fromSystem.x, fromSystem.y, targetSystem.x, targetSystem.y);
            const daysElapsed = routeDist / avgEngine / CONSTANTS.TRAVEL_TIME_SCALE;
            gameState.day = (gameState.day || 1) + daysElapsed;
            if (gameState.bounty > 0) {
                gameState.bounty = Math.floor(gameState.bounty * Math.pow(0.95, daysElapsed));
            }

            SpaceTravel.travelToSystem(fromSystem, targetSystem);
            SpaceTravel.revealFromTier(gameState.systems, targetSystem.tier);
            gameState.currentSystem  = targetSystem;
            gameState.selectedSystem = targetSystem;

            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        };

        // Stay on galaxy map during travel — the animated ship icon drives the visual
        if (galaxyRenderer) galaxyRenderer.startTravelAnim(fromSystem, targetSystem, avgEngine);
        this.processEncounters(fromSystem, targetSystem, routeKey, encounters, 0, arrive);
    },

    processEncounters: function(fromSystem, targetSystem, routeKey, encounters, index, onArrival) {
        if (index >= encounters.length) {
            if (galaxyRenderer) galaxyRenderer.animateTravelSegment(1.0, onArrival);
            else onArrival();
            return;
        }

        const encounter = encounters[index];
        const continueNext = () => {
            encounter.done = true;
            this.processEncounters(fromSystem, targetSystem, routeKey, encounters, index + 1, onArrival);
        };

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
        const isPirateFaction = gameState.playerFaction === 'pirates';
        const isPoliceFaction = gameState.playerFaction === 'police';

        // Route hazard flags — threaded into every combat on this route
        const _routeData = routeKey && gameState.routes ? gameState.routes.get(routeKey) : null;
        const _hazardOpts = _routeData ? { hasAsteroids: _routeData.hasAsteroids, cloudType: _routeData.cloudType } : {};

        // Soldiers with non-negative fame: show a clearance modal instead of silent pass
        if (encounter.faction === 'soldiers' && (gameState.fame || 0) >= 0) {
            const computeFameDelta = (faction, playerInitiated) => {
                if (faction === 'pirates') return 1;
                if (faction === 'smugglers') return playerInitiated ? 1 : 0;
                return playerInitiated ? -1 : 0;
            };
            const preGenFleetSoldier = SpaceTravel.generateEnemyFleet(encounter);
            const startCombatSoldier = (addBounty, combatOptions = {}, fameDelta = 0) => {
                if (addBounty && !isPoliceFaction) gameState.bounty = (gameState.bounty || 0) + CONSTANTS.FLEET_ATTACK_BOUNTY;
                removeEncounterFn();
                _defeatedEncounterInfo = { faction: encounter.faction, size: encounter.size, fameDelta, isQueenFight: false };
                gameState.enemyShips = preGenFleetSoldier;
                _travelContinuation = onContinue;
                this.startCombat({ ..._hazardOpts, ...combatOptions, encounterFaction: encounter.faction });
            };
            const removeEncounterFn = () => {};
            const modalEl2   = document.getElementById('encounterModal');
            const titleEl2   = document.getElementById('encounterModalTitle');
            const bodyEl2    = document.getElementById('encounterModalBody');
            const engageBtn2 = document.getElementById('encounterEngageBtn');
            const retreatBtn2 = document.getElementById('encounterRetreatBtn');
            const closeModal2 = () => { modalEl2.style.display = 'none'; retreatBtn2.style.display = ''; retreatBtn2.textContent = 'Turn Back'; };
            titleEl2.textContent = 'Soldier Patrol';
            titleEl2.style.color = '#aaaaff';
            const soldierFaction = CONSTANTS.FACTIONS.find(f => f.id === 'soldiers');
            if (soldierFaction && soldierFaction.description) {
                titleEl2.setAttribute('data-tooltip-title', soldierFaction.name);
                titleEl2.setAttribute('data-tooltip-body', soldierFaction.description);
                titleEl2.style.cursor = 'help';
            }
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

        const startCombatWith = (addBounty, combatOptions = {}, fameDelta = 0) => {
            if (addBounty && !isPoliceFaction) gameState.bounty = (gameState.bounty || 0) + CONSTANTS.FLEET_ATTACK_BOUNTY;
            _defeatedEncounterInfo = {
                faction:      encounter.faction,
                size:         encounter.size,
                fameDelta,
                isQueenFight: encounter.isQueenFight || false,
            };
            gameState.enemyShips = preGenFleet;
            _travelContinuation = onContinue;
            this.startCombat({ ..._hazardOpts, ...combatOptions, encounterFaction: encounter.faction });
        };

        const modalEl    = document.getElementById('encounterModal');
        const titleEl    = document.getElementById('encounterModalTitle');
        const bodyEl     = document.getElementById('encounterModalBody');
        const engageBtn  = document.getElementById('encounterEngageBtn');
        const retreatBtn = document.getElementById('encounterRetreatBtn');

        engageBtn.style.display = '';
        const closeModal = () => {
            modalEl.style.display = 'none';
            retreatBtn.style.display = '';
            retreatBtn.textContent = 'Turn Back';
        };

        titleEl.textContent = `${factionName} Fleet`;
        titleEl.style.color = factionColor;
        if (factionData && factionData.description) {
            titleEl.setAttribute('data-tooltip-title', factionData.name);
            titleEl.setAttribute('data-tooltip-body', factionData.description);
            titleEl.style.cursor = 'help';
        } else {
            titleEl.removeAttribute('data-tooltip-title');
            titleEl.removeAttribute('data-tooltip-body');
            titleEl.style.cursor = '';
        }

        // ── ALIENS (including queen) — always attack, no negotiate ───────────────
        if (encounter.faction === 'aliens') {
            titleEl.style.color = '#ff8800';
            if (encounter.isQueenFight) {
                titleEl.textContent = 'Alien Queen';
                bodyEl.innerHTML = `
                    <p style="color:#ff4400;font-size:1em;"><strong>The Alien Queen herself blocks your path!</strong></p>
                    <p style="color:#aaa;font-size:0.85em;">Defeat her to end the invasion and win the war.</p>`;
            } else {
                titleEl.textContent = 'Alien Fleet';
                bodyEl.innerHTML = `
                    <p style="color:#ff8800;">An alien fleet of <strong>${encounter.size} ships</strong> blocks your path!</p>
                    <p style="color:#aaa;font-size:0.85em;">Aliens cannot be negotiated with. Clear the route to pass.</p>`;
            }
            engageBtn.textContent = 'Fight';
            retreatBtn.style.display = 'none';
            engageBtn.onclick = () => {
                closeModal();
                startCombatWith(false, { enemyFirst: true }, encounter.isQueenFight ? 0 : 3);
            };
            modalEl.style.display = 'flex';
            return;
        }

        // ── MERCHANT PLAYER meets MERCHANT FLEET — always offer to trade ────────
        if (gameState.playerFaction === 'merchants' && encounter.faction === 'merchants') {
            const items = CONSTANTS.ITEMS || [];
            const randomItem = items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;

            const availableShipTypes = (CONSTANTS.SHIP_TYPES || []).filter(t => !t.internal);
            const randomTypeData = availableShipTypes[Math.floor(Math.random() * availableShipTypes.length)];
            const S = CONSTANTS.SHIP_STATS;
            const offerShipStats = {
                hull:    Math.max(1, Math.round((S.HULL_MIN + S.HULL_MAX) / 2 * randomTypeData.hullMult)),
                shields: Math.max(0, Math.round((S.SHIELDS_MIN + S.SHIELDS_MAX) / 2 * randomTypeData.shieldMult)),
                laser:   Math.max(1, Math.round((S.LASER_MIN + S.LASER_MAX) / 2 * randomTypeData.laserMult)),
                radar:   Math.max(1, Math.round((S.RADAR_MIN + S.RADAR_MAX) / 2 * randomTypeData.radarMult)),
                engine:  Math.max(5, Math.round((S.ENGINE_MIN + S.ENGINE_MAX) / 2 * randomTypeData.engineMult)),
                type:    randomTypeData.type,
            };
            const discountMult = barterPriceMult(gameState.perks || []);
            const itemCost  = randomItem ? Math.max(1, Math.floor(randomItem.cost * discountMult)) : 0;
            const shipCost  = Math.max(1, Math.floor(calcShipCost(offerShipStats) * discountMult));
            const fleetFull = gameState.playerShips.filter(s => s.alive).length >= maxFleetSize(gameState);

            titleEl.textContent = 'Merchant Convoy';
            titleEl.style.color = '#ffcc44';
            titleEl.removeAttribute('data-tooltip-title');
            titleEl.removeAttribute('data-tooltip-body');
            titleEl.style.cursor = '';

            const itemHtml = randomItem ? `
                <div style="margin:0.4em 0;padding:0.4em 0.5em;background:#0d0d0d;border:1px solid #333;border-radius:3px;display:flex;justify-content:space-between;align-items:center;gap:0.5em;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:bold;color:#eee;">${randomItem.name}</div>
                        <div style="font-size:0.8em;color:#888;">${randomItem.desc}</div>
                    </div>
                    <button class="btn-primary btn-sm" id="merchantBuyItem" ${gameState.credits < itemCost ? 'disabled' : ''}>${itemCost} cr</button>
                </div>` : '';

            const shipFleetNote = fleetFull ? `<div style="font-size:0.78em;color:#ff8844;margin-top:0.15em;">Fleet at capacity</div>` : '';
            const shipHtml = `
                <div style="margin:0.4em 0;padding:0.4em 0.5em;background:#0d0d0d;border:1px solid #333;border-radius:3px;display:flex;justify-content:space-between;align-items:center;gap:0.5em;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:bold;color:#eee;">${offerShipStats.type}</div>
                        <div style="font-size:0.8em;color:#888;">Hull ${offerShipStats.hull} · Shields ${offerShipStats.shields} · Laser ${offerShipStats.laser} · Radar ${offerShipStats.radar} · Engine ${offerShipStats.engine}</div>
                        ${shipFleetNote}
                    </div>
                    <button class="btn-primary btn-sm" id="merchantBuyShip" ${(gameState.credits < shipCost || fleetFull) ? 'disabled' : ''}>${shipCost} cr</button>
                </div>`;

            bodyEl.innerHTML = `<p style="color:#aaa;margin-bottom:0.3em;">A merchant convoy of <strong>${encounter.size} ships</strong> offers to trade.</p>${itemHtml}${shipHtml}`;
            engageBtn.style.display = 'none';
            retreatBtn.textContent = 'Pass';
            retreatBtn.style.display = '';
            retreatBtn.onclick = () => { closeModal(); onContinue(); };

            if (randomItem) {
                const itemBtn = document.getElementById('merchantBuyItem');
                if (itemBtn) itemBtn.addEventListener('click', () => {
                    if (gameState.credits < itemCost) return;
                    gameState.credits -= itemCost;
                    const ship = gameState.playerShips.find(s => s.alive && (s.inventory || []).length < (s.cargoCapacity || 1));
                    if (ship) ship.inventory.push(randomItem.id);
                    closeModal(); onContinue();
                });
            }

            const shipBtn = document.getElementById('merchantBuyShip');
            if (shipBtn) shipBtn.addEventListener('click', () => {
                const aliveNow = gameState.playerShips.filter(s => s.alive).length;
                if (gameState.credits < shipCost || aliveNow >= maxFleetSize(gameState)) return;
                gameState.credits -= shipCost;
                const newShip = SpaceTravel.generateShipOfType(offerShipStats.type);
                newShip.isPlayer = true;
                newShip._buyPrice = shipCost;
                gameState.playerShips.push(newShip);
                assignFleetNames(gameState.playerShips);
                closeModal(); onContinue();
            });

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

            const isNeutral = encounter.faction === 'merchants';
            // Police can't initiate against non-criminals (pirates + smugglers are criminals); pirates are friendly with other pirates
            const policeBlock  = isPoliceFaction && encounter.faction !== 'pirates' && encounter.faction !== 'smugglers';
            const pirateBlock  = isPirateFaction && encounter.faction === 'pirates';
            if (policeBlock || pirateBlock) {
                const noteColor = policeBlock ? '#4488ff' : '#ff8888';
                const noteMsg   = policeBlock
                    ? 'Your sworn duty prevents attacking non-criminal factions.'
                    : 'They recognise your colours — you\'re one of them.';
                bodyEl.innerHTML = `${detLine}<p>${fleetDesc}</p><p style="color:${noteColor};font-size:0.85em;margin-top:0.3em;">${noteMsg}</p>`;
                engageBtn.style.display = 'none';
                retreatBtn.textContent  = 'Pass';
                retreatBtn.style.display = '';
                retreatBtn.onclick = () => { closeModal(); onContinue(); };
                modalEl.style.display = 'flex';
                return;
            }

            if (isNeutral) {
                bodyEl.innerHTML = `${detLine}<p>${fleetDesc}</p>
                    <p style="color:#aaa;font-size:0.82em;margin-top:0.3em;">Ambush has a <strong>50%</strong> chance of success. They won't attack you unprovoked.</p>`;
            } else {
                bodyEl.innerHTML = `${detLine}<p>${fleetDesc}</p>
                    <p style="color:#aaa;font-size:0.82em;margin-top:0.3em;">Each option has a <strong>50%</strong> chance of success.</p>`;
            }

            engageBtn.style.display = '';
            engageBtn.textContent = 'Ambush';
            retreatBtn.textContent = isNeutral ? 'Ignore' : 'Sneak Around';
            retreatBtn.style.display = '';

            engageBtn.onclick = () => {
                const fameDelta = computeFameDelta(encounter.faction, true);
                const ambushSuccess = Math.random() < 0.5;
                retreatBtn.style.display = 'none';
                if (ambushSuccess) {
                    titleEl.textContent = 'Ambush Successful!';
                    titleEl.style.color = '#00ff88';
                    bodyEl.innerHTML = `<p style="color:#00ff88;"><strong>✓ Ambush successful!</strong></p>
                        <p style="color:#aaa;font-size:0.88em;">Enemy caught off-guard — shields down, facing away.</p>`;
                    engageBtn.textContent = 'Continue';
                    engageBtn.onclick = () => { closeModal(); startCombatWith(false, { ambush: true, enemyFirst: false }, fameDelta); };
                } else {
                    titleEl.textContent = 'Ambush Failed!';
                    titleEl.style.color = '#ff4444';
                    bodyEl.innerHTML = `<p style="color:#ff4444;"><strong>✗ Ambush failed!</strong></p>
                        <p style="color:#aaa;font-size:0.88em;">They spotted you first — prepare for their assault!</p>`;
                    engageBtn.textContent = 'Fight';
                    engageBtn.onclick = () => { closeModal(); startCombatWith(false, { enemyFirst: true }, fameDelta); };
                }
            };

            if (isNeutral) {
                retreatBtn.onclick = () => { closeModal(); onContinue(); };
            } else {
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
            }
        } else {
            // ── DETECTED: normal faction encounter ─────────────────────────────────
            const detLine = `<p style="color:#ff6644;font-size:0.85em;margin-bottom:0.3em;">
                ✗ Detected — their radar (${enemyRadar}) overpowered yours (${playerRadar})
            </p>`;

            const playerBounty = gameState.bounty || 0;
            const playerFame   = gameState.fame   || 0;
            let willAttack = false;
            if (encounter.faction === 'pirates') {
                willAttack = isPirateFaction ? false : Math.random() < 0.5;
            } else if (encounter.faction === 'police' && playerBounty > 0) {
                willAttack = Math.random() < 0.5;
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
                    engageBtn.style.display = '';
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

                // Police can't attack non-criminals (pirates + smugglers are criminals); pirates are friendly with other pirates
                const blockAttack = (isPoliceFaction && encounter.faction !== 'pirates' && encounter.faction !== 'smugglers')
                                 || (isPirateFaction && encounter.faction === 'pirates');
                if (blockAttack) {
                    const noteColor = isPoliceFaction ? '#4488ff' : '#ff8888';
                    const noteMsg   = isPoliceFaction
                        ? 'Your sworn duty prevents attacking non-criminal factions.'
                        : 'They recognise your colours — you\'re one of them.';
                    bodyEl.innerHTML = `${detLine}<p>${msg}</p><p style="color:${noteColor};font-size:0.85em;margin-top:0.3em;">${noteMsg}</p>`;
                    engageBtn.style.display = 'none';
                    retreatBtn.textContent = 'Pass';
                    retreatBtn.style.display = '';
                    retreatBtn.onclick = () => { closeModal(); onContinue(); };
                    modalEl.style.display = 'flex';
                    return;
                }

                bodyEl.innerHTML = `${detLine}<p>${msg}</p>`;
                engageBtn.style.display = '';
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
            const mode           = combat.playerMode;
            const clickedShip    = combat.getShipAtPosition(wx, wy, mode);
            const clickedAsteroid = mode === 'salvage' ? null : combat.getAsteroidAtPosition(wx, wy);

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
            } else if (mode === 'possess') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && clickedShip !== activeShip) {
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    if (dist <= CONSTANTS.POSSESS_RANGE) {
                        console.log(`[click] → playerPossess ${clickedShip.name}`);
                        combat.playerPossess(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'webbing') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const dist = distance(activeShip.x, activeShip.y, wx, wy);
                    const tx = dist > CONSTANTS.WEBBING_RANGE ? activeShip.x + (wx - activeShip.x) / dist * CONSTANTS.WEBBING_RANGE : wx;
                    const ty = dist > CONSTANTS.WEBBING_RANGE ? activeShip.y + (wy - activeShip.y) / dist * CONSTANTS.WEBBING_RANGE : wy;
                    console.log(`[click] → playerWebbing at (${tx.toFixed(0)},${ty.toFixed(0)})`);
                    combat.playerWebbing(activeShip, tx, ty);
                }
            } else if (mode === 'timeslip') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && clickedShip !== activeShip) {
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    if (dist <= CONSTANTS.TIMESLIP_RANGE && !(clickedShip.timeslipTurns || 0)) {
                        console.log(`[click] → playerTimeslip ${clickedShip.name}`);
                        combat.playerTimeslip(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'salvage') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && !clickedShip.alive) {
                    console.log(`[click] → playerSalvage ${clickedShip.name}`);
                    combat.playerSalvage(activeShip, clickedShip);
                }
            } else if (mode === 'neutralize') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const launchDist = CONSTANTS.WARHEAD_LAUNCH_DIST;
                    const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
                    const acx = activeShip.x + Math.cos(activeShip.rotation) * launchDist;
                    const acy = activeShip.y + Math.sin(activeShip.rotation) * launchDist;
                    const d = distance(acx, acy, wx, wy);
                    const tx = d > targetRadius ? acx + (wx - acx) / d * targetRadius : wx;
                    const ty = d > targetRadius ? acy + (wy - acy) / d * targetRadius : wy;
                    console.log(`[click] → playerNeutralize at (${tx.toFixed(0)},${ty.toFixed(0)})`);
                    combat.playerNeutralize(activeShip, tx, ty);
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
            } else if (mode === 'chaingun') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && clickedShip !== activeShip) {
                    const maxRange = combat.getShootRange(activeShip);
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    if (dist <= maxRange && !clickedShip.isPlayer) {
                        console.log(`[click] → playerChaingun ${clickedShip.name}`);
                        combat.playerChaingun(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'plasma_cannon') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && clickedShip !== activeShip) {
                    const maxRange = combat.getShootRange(activeShip) * CONSTANTS.PLASMA_RANGE_MULT;
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    if (dist <= maxRange && !clickedShip.isPlayer) {
                        console.log(`[click] → playerPlasmaCannon ${clickedShip.name}`);
                        combat.playerPlasmaCannon(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'rocket_launcher') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    const acx = activeShip.x + Math.cos(activeShip.rotation) * CONSTANTS.WARHEAD_LAUNCH_DIST;
                    const acy = activeShip.y + Math.sin(activeShip.rotation) * CONSTANTS.WARHEAD_LAUNCH_DIST;
                    const d = distance(acx, acy, wx, wy);
                    const tx = d <= CONSTANTS.WARHEAD_TARGET_RADIUS ? wx : acx + (wx - acx) / d * CONSTANTS.WARHEAD_TARGET_RADIUS;
                    const ty = d <= CONSTANTS.WARHEAD_TARGET_RADIUS ? wy : acy + (wy - acy) / d * CONSTANTS.WARHEAD_TARGET_RADIUS;
                    console.log(`[click] → playerRocketLauncher at (${tx.toFixed(0)},${ty.toFixed(0)})`);
                    combat.playerRocketLauncher(activeShip, tx, ty);
                }
            } else if (mode === 'anchor') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && clickedShip !== activeShip) {
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    const ang = Math.atan2(clickedShip.y - activeShip.y, clickedShip.x - activeShip.x);
                    const localAng = normalizeAngle(ang - activeShip.rotation);
                    if (dist <= CONSTANTS.ANCHOR_RANGE && Math.abs(localAng) <= CONSTANTS.ANCHOR_CONE_HALF_ANGLE) {
                        console.log(`[click] → playerAnchor ${clickedShip.name}`);
                        combat.playerAnchor(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'siphon') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && clickedShip !== activeShip) {
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    if (dist <= CONSTANTS.SIPHON_RANGE) {
                        console.log(`[click] → playerSiphon ${clickedShip.name}`);
                        combat.playerSiphon(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'swap') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && clickedShip !== activeShip) {
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    if (dist <= CONSTANTS.SWAP_RANGE) {
                        console.log(`[click] → playerSwap ${clickedShip.name}`);
                        combat.playerSwap(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'absorb') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    console.log(`[click] → playerAbsorb`);
                    combat.playerAbsorb(activeShip);
                }
            } else if (mode === 'ravager') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0 && clickedShip && !clickedShip.isPlayer) {
                    const dist = distance(activeShip.x, activeShip.y, clickedShip.x, clickedShip.y);
                    const ravRange = combat.getShootRange(activeShip) * CONSTANTS.RAVAGER_RANGE_MULT;
                    if (dist <= ravRange && isInFiringZone(activeShip, clickedShip)) {
                        console.log(`[click] → playerRavager ${clickedShip.name}`);
                        combat.playerRavager(activeShip, clickedShip);
                    }
                }
            } else if (mode === 'stasis_field') {
                if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                    console.log(`[click] → playerStasisField ${wx.toFixed(0)},${wy.toFixed(0)}`);
                    combat.playerStasisField(activeShip, wx, wy);
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

        const isTemp = s => s.isBomb || s.isTorpedo || s.isSwarmlet || s.isDrone || s.isMirror;
        const allPlayerShips = [...combat.playerShips, ...combat.fleedPlayerShips].filter(s => !isTemp(s));
        const allEnemyShips  = [...combat.enemyShips,  ...combat.fleedEnemyShips].filter(s => !isTemp(s));

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
        const isPirates = faction === 'pirates';
        let rewardLine = '';
        if (combat.won && !combat.playerRetreated) {
            if (isPirates) {
                const contractsEarned = enemyDestroyed * 250;
                rewardLine = contractsEarned > 0
                    ? `<p style="color:#44ffdd;margin-top:0.5em;">+${contractsEarned} contracts (${enemyDestroyed} × 250 — collect at courthouse)</p>`
                    : '';
            } else {
                const creditMult = factionData ? (factionData.creditMult || 1) : 1;
                const salvMult = salvagingCreditMult(gameState.perks || []);
                const displayRewards = Math.round(rewards * creditMult * salvMult);
                let creditNote = creditMult > 1 ? ' — wealthy convoy' : creditMult < 1 ? ' — few valuables' : ` (${enemyDestroyed} × ${CONSTANTS.CREDITS_PER_ENEMY_DESTROYED} cr per kill)`;
                if (salvMult > 1) creditNote += `, +${Math.round((salvMult - 1) * 100)}% salvaging`;
                rewardLine = displayRewards > 0
                    ? `<p style="color:#ffdd44;margin-top:0.5em;">+${displayRewards} credits${creditNote}</p>`
                    : '';
            }
        }

        const expGained  = combat ? (combat.expGained || 0) : 0;
        const expLine = expGained > 0
            ? `<p style="color:#aaff44;margin-top:0.5em;">+${expGained} EXP earned this battle</p>`
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
            ${rewardLine}
            ${expLine}`;

        document.getElementById('combatResultModal').style.display = 'flex';
    },

    endCombat: function() {
        if (!combat) return;

        // Keep all ships including dead ones (can be resurrected at shipyard)
        gameState.playerShips = [...combat.playerShips, ...combat.fleedPlayerShips];
        gameState.enemyShips = combat.enemyShips;

        // Shields fully restore; hull repaired by Engineering perk fraction (no full auto-restore)
        const repairFrac = engineeringRepairFraction(gameState.perks || []);
        gameState.playerShips.forEach(s => {
            if (s.alive) {
                s.shields = s.maxShields;
                s.hull = Math.min(s.hull + Math.round(s.maxHull * repairFrac), s.maxHull);
            }
        });

        cancelAnimationFrame(animationFrameId);

        if (combat.won && !combat.playerRetreated) {
            const rewards = combat.getRewards();
            if (_defeatedEncounterInfo) {
                const fameDelta = _defeatedEncounterInfo.fameDelta || 0;
                if (fameDelta !== 0) gameState.fame = (gameState.fame || 0) + fameDelta;

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
                if (_defeatedEncounterInfo.faction === 'pirates') {
                    const isTemp = s => s.isBomb || s.isTorpedo || s.isSwarmlet || s.isDrone || s.isMirror;
                    const enemyDestroyed = [...combat.enemyShips, ...combat.fleedEnemyShips].filter(s => !isTemp(s) && !s.alive).length;
                    gameState.contracts = (gameState.contracts || 0) + enemyDestroyed * 250;
                } else {
                    const creditMult = factionDataEC ? (factionDataEC.creditMult || 1) : 1;
                    const salvMult = salvagingCreditMult(gameState.perks || []);
                    gameState.credits += Math.round(rewards * creditMult * salvMult);
                }
                _defeatedEncounterInfo = null;
            } else {
                const salvMult = salvagingCreditMult(gameState.perks || []);
                gameState.credits += Math.round(rewards * salvMult);
            }
            // Return to galaxy map; if mid-travel, resume the journey
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
            if (_travelContinuation) {
                const cont = _travelContinuation;
                _travelContinuation = null;
                cont();
            }
        } else if (combat.lost) {
            _travelContinuation = null;
            if (galaxyRenderer) galaxyRenderer._travelAnim = null;
            UISystem.showGameOver(false, 'All your ships were destroyed. Game Over!');
            gameState.state = GAME_STATE.GAME_OVER;
        } else if (combat.playerRetreated) {
            // Retreated mid-travel → resume journey; otherwise just return to galaxy map
            if (_travelContinuation) {
                gameState.state = GAME_STATE.GALAXY;
                UISystem.showScreen('galaxyScreen');
                UISystem.updateGalaxyScreen(gameState);
                const cont = _travelContinuation;
                _travelContinuation = null;
                cont();
            } else {
                if (galaxyRenderer) galaxyRenderer._travelAnim = null;
                gameState.state = GAME_STATE.GALAXY;
                UISystem.showScreen('galaxyScreen');
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
