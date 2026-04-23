// Main Game File

/**
 * @typedef {{
 *   state: string,
 *   credits: number,
 *   systems: Array<{id:number, name:string, x:number, y:number, hasEnemyFleet:boolean, visited:boolean, resourceLevel:number, connections:number[]}>,
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
        gameState = {
            state: GAME_STATE.TITLE,
            credits: CONSTANTS.PLAYER_STARTING_CREDITS,
            systems: SpaceTravel.generateUniverse(),
            currentSystem: null,
            selectedSystem: null,
            selectedShip: null,
            playerShips: [],
            enemyShips: []
        };
        
        // Initialize player starting fleet
        for (let i = 0; i < CONSTANTS.PLAYER_STARTING_SHIPS; i++) {
            gameState.playerShips.push(new Ship(0, 0, true));
        }
        
        // Set starting system
        gameState.currentSystem = SpaceTravel.initializeStartingSystem(gameState.systems);
        gameState.selectedSystem = gameState.currentSystem;
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
            if (galaxyRenderer) {
                galaxyRenderer.resizeCanvas();
                galaxyRenderer.fitGalaxyToCanvas();
                galaxyRenderer.resetZoom();
                UISystem.updateGalaxyScreen(gameState);
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
        
        document.getElementById('leaveStationButton').addEventListener('click', () => {
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        });
        
        // Combat Screen
        document.getElementById('skipTurnButton').addEventListener('click', () => {
            if (combat && gameState.playerShips[combat.currentShipIndex]) {
                combat.playerSkipTurn(gameState.playerShips[combat.currentShipIndex]);
                UISystem.updateCombatScreen(gameState, combat);
            }
        });
        
        document.getElementById('retreatButton').addEventListener('click', () => {
            if (confirm('Retreat from combat? You will not receive rewards.')) {
                combat.playerRetreat();
                this.endCombat();
            }
        });
        
        document.getElementById('combatContinueButton').addEventListener('click', () => {
            this.endCombat();
        });
        
        // Game Over Screen
        document.getElementById('gameOverButton').addEventListener('click', () => {
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
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
        StationSystem.visitStation(gameState);
        UISystem.showScreen('stationScreen');
        UISystem.updateStationScreen(gameState);
    },
    
    travelToSystem: function(targetSystem) {
        const travelInfo = SpaceTravel.travelToSystem(gameState.currentSystem, targetSystem);
        gameState.currentSystem = targetSystem;
        
        if (travelInfo.hasEncounter && targetSystem.hasEnemyFleet) {
            // Encounter! Start combat
            gameState.enemyShips = SpaceTravel.generateEnemyFleet(travelInfo.encounterStrength);
            this.startCombat();
        } else {
            // Safe travel
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        }
    },
    
    startCombat: function() {
        gameState.state = GAME_STATE.COMBAT;
        
        // Create fresh combat instance
        combat = new Combat(
            deepCopy(gameState.playerShips),
            deepCopy(gameState.enemyShips)
        );
        
        UISystem.showScreen('combatScreen');
        UISystem.updateCombatScreen(gameState, combat);
        
        // Start game loop
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
            UISystem.updateCombatScreen(gameState, combat);
            
            if (combat.state === COMBAT_STATE.ENDED) {
                document.getElementById('combatContinueButton').style.display = 'block';
                cancelAnimationFrame(animationFrameId);
                return;
            }
            
            animationFrameId = requestAnimationFrame(() => this.gameLoop());
        }
    },
    
    endCombat: function() {
        if (!combat) return;
        
        // Update actual game state with combat results
        gameState.playerShips = combat.playerShips;
        gameState.enemyShips = combat.enemyShips;
        
        if (combat.won && !combat.playerRetreated) {
            // Player won
            const rewards = combat.getRewards();
            gameState.credits += rewards;
            gameState.currentSystem.hasEnemyFleet = false;
            
            UISystem.showGameOver(true, `Combat won! You received ${rewards} credits and destroyed ${combat.enemyShips.filter(s => !s.alive).length} enemy ships.`);
            gameState.state = GAME_STATE.GAME_OVER;
        } else if (combat.lost || (combat.playerRetreated && combat.playerShips.length === 0)) {
            // Player lost
            UISystem.showGameOver(false, 'All your ships were destroyed. Game Over!');
            gameState.state = GAME_STATE.GAME_OVER;
        } else if (combat.playerRetreated) {
            // Player retreated safely
            gameState.state = GAME_STATE.GALAXY;
            UISystem.showScreen('galaxyScreen');
            UISystem.updateGalaxyScreen(gameState);
        }
        
        // Clean up
        cancelAnimationFrame(animationFrameId);
        document.getElementById('combatContinueButton').style.display = 'none';
    }
};

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
    GameController.init();
});
