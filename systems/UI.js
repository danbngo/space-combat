// UI System
class UISystem {
    static stationTab = 'orbit';
    static currentStationOffer = null;
    static selectedOfferIndex = 0;

    static showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const screen = document.getElementById(screenName);
        if (screen) {
            screen.classList.add('active');
        }
    }
    
    static updateGalaxyScreen(gameState) {
        const currentSystemName = gameState.currentSystem ? gameState.currentSystem.name : 'None';
        document.getElementById('currentSystem').textContent = `Current System: ${currentSystemName}`;

        this.updatePlayerStatusPanel(gameState);
        this.updateCurrentSystemSection(gameState);

        if (galaxyRenderer && gameState.systems) {
            galaxyRenderer.resizeCanvas();
            galaxyRenderer.initializeZoom();
            galaxyRenderer.render(gameState.systems, gameState.currentSystem);
        }
    }

    // Returns HTML for a single stat bar + numeric label.
    static renderStatBar(current, max, color) {
        const pct = Math.max(0, Math.min(100, (current / max) * 100)).toFixed(1);
        return `<div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${color};"></div></div>
                <span class="stat-bar-label" style="color:${color};">${current}/${max}</span>`;
    }

    // Returns HTML for a full ship table.
    // options.selectable   — adds data-ship-index to rows and hover/click cursor
    // options.showStats    — adds Laser / Engine / Radar columns
    // options.selectedShip — highlights the matching ship row
    // options.bars         — true (default): hull/shield show a bar + current/max
    //                        false: hull/shield show max value as plain text (for stat comparison)
    static renderShipTable(ships, options = {}) {
        const { selectable = false, showStats = false, selectedShip = null, bars = true } = options;

        const extraHeaders = showStats ? '<th>LZR</th><th>ENG</th><th>RDR</th>' : '';

        const rows = ships.map((ship, i) => {
            const hullPct = ship.hull / ship.maxHull;
            const hullColor = hullPct > 0.5 ? '#00ffff' : hullPct > 0.25 ? '#ffff00' : '#ff3333';
            const isSelected = selectedShip && ship === selectedShip;
            const isDead = !ship.alive;

            const numCell = isDead
                ? `<span style="color:#ff3333;">${i + 1}</span>`
                : `${i + 1}`;

            const hullCell = bars
                ? this.renderStatBar(ship.hull, ship.maxHull, hullColor)
                : `<span style="color:#aaa;">${ship.maxHull}</span>`;

            const shieldCell = bars
                ? this.renderStatBar(ship.shields, ship.maxShields, '#00ccff')
                : `<span style="color:#aaa;">${ship.maxShields}</span>`;

            const extraCells = showStats ? `
                <td style="text-align:center;">${ship.laserDamage}</td>
                <td style="text-align:center;">${ship.engine}</td>
                <td style="text-align:center;">${(ship.radar * 100).toFixed(0)}%</td>` : '';

            const classes = ['ship-table-row', isSelected ? 'selected' : '', isDead ? 'destroyed' : '']
                .filter(Boolean).join(' ');
            const selectAttr = selectable ? `data-ship-index="${i}"` : '';

            return `<tr class="${classes}" ${selectAttr}>
                <td class="ship-num-cell">${numCell}</td>
                <td>${hullCell}</td>
                <td>${shieldCell}</td>
                ${extraCells}
            </tr>`;
        }).join('');

        return `<table class="ship-status-table">
            <thead><tr><th>#</th><th>Hull</th><th>Shield</th>${extraHeaders}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    static renderOfferTable(offers, selectedIdx) {
        const rows = offers.map((offer, i) => {
            const classes = ['ship-table-row', i === selectedIdx ? 'selected' : ''].filter(Boolean).join(' ');
            return `<tr class="${classes}" data-offer-index="${i}">
                <td class="ship-num-cell">${i + 1}</td>
                <td style="text-align:center;">${offer.stats.hull}</td>
                <td style="text-align:center;">${offer.stats.shields}</td>
                <td style="text-align:center;">${offer.stats.laser}</td>
                <td style="text-align:center;">${offer.stats.engine}</td>
                <td style="text-align:center;">${(offer.stats.radar * 100).toFixed(0)}%</td>
                <td style="text-align:center;">${offer.cost}</td>
            </tr>`;
        }).join('');
        return `<table class="ship-status-table">
            <thead><tr><th>#</th><th>Hull</th><th>Shield</th><th>LZR</th><th>ENG</th><th>RDR</th><th>Cost</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    static renderPlayerStatusHtml(gameState, tableOptions = {}) {
        const alive = gameState.playerShips.filter(s => s.alive).length;
        return `<div class="header-3">Player Status</div>
                <p>Credits: ${gameState.credits}</p>
                <p>Fleet: ${alive} / ${CONSTANTS.PLAYER_STARTING_SHIPS}</p>
                ${this.renderShipTable(gameState.playerShips, tableOptions)}`;
    }

    static updatePlayerStatusPanel(gameState) {
        const el = document.getElementById('playerStatusPanel');
        if (!el) return;
        el.innerHTML = this.renderPlayerStatusHtml(gameState);
    }

    static updateCurrentSystemSection(gameState) {
        const currentActions = document.getElementById('currentSystemActions');

        if (!currentActions) {
            return;
        }

        if (!gameState.currentSystem) {
            currentActions.innerHTML = '';
            return;
        }

        const actionsHtml = `<button id="showSystemButton" class="btn-primary">Show System</button>`;
        currentActions.innerHTML = actionsHtml;
        this.setupCurrentSystemButtons(gameState);
    }

    static setupCurrentSystemButtons(gameState) {
        const showButton = document.getElementById('showSystemButton');

        if (showButton) {
            showButton.onclick = () => {
                if (!gameState.currentSystem) return;
                this.openStationTab('orbit', gameState);
            };
        }
    }

    static openStationTab(tab, gameState) {
        gameState.state = GAME_STATE.STATION;
        gameState.selectedShip = gameState.selectedShip || gameState.playerShips[0] || null;
        this.setStationTab(tab, gameState);
        StationSystem.visitStation(gameState);
        this.showScreen('stationScreen');
        this.updateStationScreen(gameState);
    }

    static setStationTab(tab, gameState) {
        this.stationTab = tab;
        this.currentStationOffer = null;
        this.selectedOfferIndex = 0;
        this.updateStationScreen(gameState);
    }

    static updateStationScreen(gameState) {
        if ((!gameState.selectedShip || !gameState.playerShips.includes(gameState.selectedShip)) && gameState.playerShips.length) {
            gameState.selectedShip = gameState.playerShips[0];
        }

        const currentShip = gameState.selectedShip || gameState.playerShips[0] || null;
        if (!this.currentStationOffer) {
            this.currentStationOffer = Array.from({ length: CONSTANTS.STATION_OFFER_COUNT }, () => ({
                stats: UISystem.generateNewShipStats(),
                cost: CONSTANTS.NEW_SHIP_BASE_COST + randomInt(-50, 50)
            }));
            this.selectedOfferIndex = 0;
        }

        const offer = this.currentStationOffer[this.selectedOfferIndex];
        const shipSaleValue = currentShip ? StationSystem.calculateShipSaleValue(currentShip) : 0;
        const tradePrice = offer ? Math.max(0, offer.cost - shipSaleValue) : 0;

        const stationPanel = document.getElementById('stationPlayerPanel');
        if (stationPanel) {
            stationPanel.innerHTML = this.renderPlayerStatusHtml(gameState, {
                selectable: true,
                selectedShip: currentShip
            });
        }

        document.querySelectorAll('.station-tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.id === `${this.stationTab}Tab`);
        });

        let contentHtml = '';

        if (this.stationTab === 'orbit') {
            contentHtml = `
                <div class="station-section">
                    <p>You are currently orbiting the station. Choose a tab to dock, repair, or visit the shipyard.</p>
                </div>`;
        } else if (this.stationTab === 'dock') {
            const repairCost = currentShip ? CONSTANTS.REPAIR_COST : 0;
            contentHtml = `
                <div class="station-section">
                    <h3>Docking Bay</h3>
                    ${currentShip ? `
                        <p>Selected Ship: Hull ${currentShip.hull}/${currentShip.maxHull}, Shields ${currentShip.shields}/${currentShip.maxShields}, Laser ${currentShip.laserDamage}, Engine ${currentShip.engine}</p>
                        <div class="station-action-row">
                            <button id="repairButton" class="btn-primary">Repair Ship</button>
                            <button id="sellButton" class="btn-secondary">Sell Ship</button>
                        </div>
                        <p class="station-note">Repair cost: ${repairCost} credits. Sell value: ${shipSaleValue} credits.</p>
                    ` : '<p>No ship selected.</p>'}
                </div>`;
        } else if (this.stationTab === 'shipyard') {
            contentHtml = `
                <div class="station-section">
                    <h3>Shipyard</h3>
                    ${this.renderOfferTable(this.currentStationOffer, this.selectedOfferIndex)}
                    <div class="station-action-row" style="margin-top:0.5em;">
                        <button id="buyButton" class="btn-primary">Buy</button>
                        <button id="tradeButton" class="btn-primary">Trade In</button>
                    </div>
                    ${offer ? `<p class="station-note">Cost: ${offer.cost} cr. Trade-in: ${shipSaleValue} cr. Net: ${tradePrice} cr.</p>` : ''}
                </div>`;
        }

        document.getElementById('stationTabContent').innerHTML = contentHtml;
        this.setupStationButtons(gameState, currentShip, shipSaleValue);
    }

    static setupStationButtons(gameState, currentShip, shipSaleValue) {
        const offer = this.currentStationOffer ? this.currentStationOffer[this.selectedOfferIndex] : null;
        const repairButton = document.getElementById('repairButton');
        const sellButton = document.getElementById('sellButton');
        const buyButton = document.getElementById('buyButton');
        const tradeButton = document.getElementById('tradeButton');

        if (repairButton) {
            repairButton.disabled = !currentShip || gameState.credits < CONSTANTS.REPAIR_COST || currentShip.hull >= currentShip.maxHull;
            repairButton.onclick = () => {
                if (currentShip && StationSystem.repairShip(gameState, currentShip)) {
                    this.updateStationScreen(gameState);
                }
            };
        }

        if (sellButton) {
            sellButton.disabled = !currentShip || gameState.playerShips.length <= 1;
            sellButton.onclick = () => {
                if (currentShip && StationSystem.sellShip(gameState, currentShip)) {
                    gameState.selectedShip = gameState.playerShips[0] || null;
                    this.currentStationOffer = null;
                    this.updateStationScreen(gameState);
                }
            };
        }

        if (buyButton) {
            buyButton.disabled = !offer || gameState.credits < offer.cost || gameState.playerShips.length >= CONSTANTS.PLAYER_STARTING_SHIPS;
            buyButton.onclick = () => {
                if (offer && StationSystem.buyNewShip(gameState, offer.stats, offer.cost)) {
                    gameState.selectedShip = gameState.playerShips[gameState.playerShips.length - 1];
                    this.currentStationOffer = null;
                    this.updateStationScreen(gameState);
                }
            };
        }

        if (tradeButton) {
            tradeButton.disabled = !offer || !currentShip || gameState.playerShips.length === 0 || gameState.credits + shipSaleValue < offer.cost;
            tradeButton.onclick = () => {
                if (offer && currentShip && StationSystem.tradeInShip(gameState, currentShip, offer.stats, offer.cost)) {
                    gameState.selectedShip = gameState.playerShips[gameState.playerShips.length - 1];
                    this.currentStationOffer = null;
                    this.updateStationScreen(gameState);
                }
            };
        }

        document.querySelectorAll('[data-ship-index]').forEach(row => {
            row.addEventListener('click', () => {
                const idx = Number(row.dataset.shipIndex);
                gameState.selectedShip = gameState.playerShips[idx] || null;
                this.updateStationScreen(gameState);
            });
        });

        document.querySelectorAll('[data-offer-index]').forEach(row => {
            row.addEventListener('click', () => {
                this.selectedOfferIndex = Number(row.dataset.offerIndex);
                this.updateStationScreen(gameState);
            });
        });
    }
    
    static generateNewShipStats() {
        return {
            hull: generateRandomStats(CONSTANTS.SHIP_STATS.HULL_MIN, CONSTANTS.SHIP_STATS.HULL_MAX),
            shields: generateRandomStats(CONSTANTS.SHIP_STATS.SHIELDS_MIN, CONSTANTS.SHIP_STATS.SHIELDS_MAX),
            laser: generateRandomStats(CONSTANTS.SHIP_STATS.LASER_MIN, CONSTANTS.SHIP_STATS.LASER_MAX),
            radar: randomFloat(CONSTANTS.SHIP_STATS.RADAR_MIN, CONSTANTS.SHIP_STATS.RADAR_MAX),
            engine: generateRandomStats(CONSTANTS.SHIP_STATS.ENGINE_MIN, CONSTANTS.SHIP_STATS.ENGINE_MAX)
        };
    }
    
    static updateCombatScreen(gameState, combat) {
        // Update turn info
        const currentPhase = combat.state === COMBAT_STATE.PLAYER_TURN ? 'Player Turn' : 'Enemy Turn';
        document.getElementById('turnInfo').innerHTML = `
            Turn: ${currentPhase} | Round: ${combat.round}
        `;
        
        // Update player ships list
        const playerList = document.getElementById('playerShipsList');
        playerList.innerHTML = '';
        gameState.playerShips.forEach((ship, index) => {
            const li = document.createElement('li');
            const status = ship.alive ? 'Active' : 'Destroyed';
            const hullBar = this.createHealthBar(ship.hull, ship.maxHull);
            const shieldBar = this.createHealthBar(ship.shields, ship.maxShields, 'shield');
            
            li.innerHTML = `
                Ship ${index + 1}: ${status}<br>
                ${hullBar} Hull<br>
                ${shieldBar} Shield
            `;
            playerList.appendChild(li);
        });
        
        // Update enemy ships list
        const enemyList = document.getElementById('enemyShipsList');
        enemyList.innerHTML = '';
        gameState.enemyShips.forEach((ship, index) => {
            const li = document.createElement('li');
            li.classList.add('enemy');
            const status = ship.alive ? 'Active' : 'Destroyed';
            const hullBar = this.createHealthBar(ship.hull, ship.maxHull);
            const shieldBar = this.createHealthBar(ship.shields, ship.maxShields, 'shield');
            
            li.innerHTML = `
                Enemy ${index + 1}: ${status}<br>
                ${hullBar} Hull<br>
                ${shieldBar} Shield
            `;
            enemyList.appendChild(li);
        });
        
        // Update ship actions
        this.updateShipActions(gameState, combat);
    }
    
    static createHealthBar(current, max, type = 'hull') {
        const percentage = (current / max) * 100;
        const color = type === 'shield' ? '#00ccff' : (percentage > 50 ? '#00ffff' : (percentage > 25 ? '#ffff00' : '#ff0000'));
        const bar = `[<span style="color: ${color};">${'█'.repeat(Math.ceil(percentage / 10))}${' '.repeat(10 - Math.ceil(percentage / 10))}</span>]`;
        return `${bar} ${current}/${max}`;
    }
    
    static updateShipActions(gameState, combat) {
        const actionsDiv = document.getElementById('shipActions');
        actionsDiv.innerHTML = '';
        
        if (combat.state === COMBAT_STATE.PLAYER_TURN) {
            const currentShip = gameState.playerShips[combat.currentShipIndex];
            
            if (currentShip && currentShip.alive) {
                if (!currentShip.hasMovedThisTurn) {
                    const validTargets = gameState.playerShips.filter(s => s !== currentShip && s.alive);
                    
                    validTargets.forEach((targetShip, index) => {
                        const button = document.createElement('button');
                        button.className = 'action-button';
                        button.textContent = `Move toward Ship ${gameState.playerShips.indexOf(targetShip) + 1}`;
                        button.onclick = () => combat.moveTowardShip(currentShip, targetShip);
                        actionsDiv.appendChild(button);
                    });
                }
                
                if (!currentShip.hasActedThisTurn) {
                    const validEnemies = gameState.enemyShips.filter(s => s.alive);
                    
                    validEnemies.forEach((enemy, index) => {
                        const button = document.createElement('button');
                        button.className = 'action-button';
                        button.textContent = `Attack Enemy ${index + 1}`;
                        button.onclick = () => combat.playerShootAt(currentShip, enemy);
                        actionsDiv.appendChild(button);
                    });
                    
                    const skipButton = document.createElement('button');
                    skipButton.className = 'action-button';
                    skipButton.textContent = `Skip Turn (Recharge +${CONSTANTS.SHIELD_RECHARGE_PER_SKIP} shields)`;
                    skipButton.onclick = () => combat.playerSkipTurn(currentShip);
                    actionsDiv.appendChild(skipButton);
                }
                
                const nextButton = document.createElement('button');
                nextButton.className = 'action-button';
                nextButton.style.marginTop = '10px';
                nextButton.style.backgroundColor = 'rgba(0, 150, 0, 0.8)';
                nextButton.textContent = 'Next Ship';
                nextButton.onclick = () => combat.nextPlayerShip();
                actionsDiv.appendChild(nextButton);
            }
        } else if (combat.state === COMBAT_STATE.ENEMY_TURN) {
            const enemyActionDiv = document.createElement('div');
            enemyActionDiv.style.textAlign = 'center';
            enemyActionDiv.textContent = 'Enemy Turn: Deciding...';
            actionsDiv.appendChild(enemyActionDiv);
        }
    }
    
    static showGameOver(won, message = '') {
        const title = document.getElementById('gameOverTitle');
        const messageEl = document.getElementById('gameOverMessage');
        
        if (won) {
            title.textContent = 'Victory!';
            title.style.color = '#00ffff';
        } else {
            title.textContent = 'Defeat!';
            title.style.color = '#ff3333';
        }
        
        messageEl.textContent = message;
        UISystem.showScreen('gameOverScreen');
    }
}
