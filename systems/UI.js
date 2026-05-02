// UI System
class UISystem {
    static stationTab = 'orbit';
    static combatTab = 'actions';
    static currentStationOffer = null;
    static currentModuleOffer = null;
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
        this.updateSelectedSystemSection(gameState);

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

    // Returns an HTML string of status-effect badges for a ship.
    static renderStatusEffects(ship) {
        const badges = [];
        if (ship.statusEffect === 'dust')   badges.push('<span class="status-badge status-dusty">Dusty</span>');
        if (ship.statusEffect === 'ice')    badges.push('<span class="status-badge status-frozen">Frozen</span>');
        if (ship.statusEffect === 'plasma') badges.push('<span class="status-badge status-overheated">Overheated</span>');
        if (ship.cloaked)                   badges.push('<span class="status-badge status-cloaked">Cloaked</span>');
        if (ship.isDrone)                   badges.push(`<span class="status-badge status-drone">Drone (${ship.droneLifetime ?? '?'}t)</span>`);
        if (!badges.length) return '';
        return `<div class="status-effects-row">${badges.join('')}</div>`;
    }

    // Returns HTML for a full ship table.
    // options.selectable   — adds data-ship-index to rows and hover/click cursor
    // options.showStats    — adds Laser / Engine / Radar columns
    // options.selectedShip — highlights the matching ship row
    // options.bars         — true (default): hull/shield show a bar + current/max
    //                        false: hull/shield show max value as plain text (for stat comparison)
    // options.isEnemy      — if true, rows get data-enemy-index instead of data-ship-index
    static renderShipTable(ships, options = {}) {
        const { selectable = false, showStats = false, selectedShip = null, bars = true, isEnemy = false } = options;

        const extraHeaders = showStats ? '<th>LZR</th><th>ENG</th><th>RDR</th>' : '';

        const rows = ships.map((ship, i) => {
            const hullPct = ship.hull / ship.maxHull;
            const hullColor = hullPct > 0.5 ? '#00ffff' : hullPct > 0.25 ? '#ffff00' : '#ff3333';
            const isSelected = selectedShip && ship === selectedShip;
            const isDead = !ship.alive;
            const isFled = ship.fled && ship.alive;

            const nameLabel = ship.name || String(i + 1);
            const typeDesc = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType)?.description || '';
            const tipAttr  = typeDesc ? ` data-tooltip="${typeDesc}"` : '';
            const numCell = isDead
                ? `<span style="color:#ff3333;"${tipAttr}>${nameLabel}</span>`
                : isFled
                ? `<span style="color:#ffaa44;"${tipAttr}>${nameLabel} (fled)</span>`
                : tipAttr ? `<span style="cursor:help;"${tipAttr}>${nameLabel}</span>` : nameLabel;

            const hullCell = bars
                ? this.renderStatBar(ship.hull, ship.maxHull, hullColor)
                : `<span style="color:#aaa;">${ship.maxHull}</span>`;

            const shieldCell = bars
                ? this.renderStatBar(ship.shields, ship.maxShields, '#00ccff')
                : `<span style="color:#aaa;">${ship.maxShields}</span>`;

            const extraCells = showStats ? `
                <td style="text-align:center;">${ship.laserDamage}</td>
                <td style="text-align:center;">${ship.engine}</td>
                <td style="text-align:center;">${ship.radar}</td>` : '';

            const classes = ['ship-table-row', isSelected ? 'selected' : '', isDead ? 'destroyed' : '']
                .filter(Boolean).join(' ');
            const indexAttr = isEnemy ? `data-enemy-index="${i}"` : (selectable ? `data-ship-index="${i}"` : '');

            return `<tr class="${classes}" ${indexAttr}>
                <td class="ship-num-cell" style="white-space:nowrap;">${numCell}</td>
                <td>${hullCell}</td>
                <td>${shieldCell}</td>
                ${extraCells}
            </tr>`;
        }).join('');

        return `<table class="ship-status-table">
            <thead><tr><th>Ship</th><th>Hull</th><th>Shield</th>${extraHeaders}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    static renderOfferTable(offers, selectedIdx, tradeInValue = 0) {
        const rows = offers.map((offer, i) => {
            const classes = ['ship-table-row', i === selectedIdx ? 'selected' : ''].filter(Boolean).join(' ');
            const typeLabel = offer.stats.type || String(i + 1);
            const typeDesc  = CONSTANTS.SHIP_TYPES.find(t => t.type === offer.stats.type)?.description || '';
            const tipAttr   = typeDesc ? ` data-tooltip="${typeDesc}"` : '';
            const net = offer.cost - tradeInValue;
            const netColor = net <= 0 ? '#00ff88' : '#ffdd44';
            const netLabel = net <= 0 ? `+${-net}` : `${net}`;
            return `<tr class="${classes}" data-offer-index="${i}">
                <td class="ship-num-cell" style="white-space:nowrap;"><span style="cursor:help;"${tipAttr}>${typeLabel}</span></td>
                <td style="text-align:center;">${offer.stats.hull}</td>
                <td style="text-align:center;">${offer.stats.shields}</td>
                <td style="text-align:center;">${offer.stats.laser}</td>
                <td style="text-align:center;">${offer.stats.engine}</td>
                <td style="text-align:center;">${offer.stats.radar}</td>
                <td style="text-align:center;">${offer.cost}</td>
                <td style="text-align:center;color:${netColor};">${netLabel}</td>
            </tr>`;
        }).join('');
        return `<table class="ship-status-table">
            <thead><tr><th>Ship</th><th>Hull</th><th>Shield</th><th>LZR</th><th>ENG</th><th>RDR</th><th>Cost</th><th>Net</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    static renderPlayerStatusHtml(gameState, tableOptions = {}) {
        const bounty = gameState.bounty || 0;
        const bountyHtml = bounty > 0
            ? `<p style="color:#ff4444;font-weight:bold;">Bounty: ${bounty} cr</p>`
            : '';
        return `<div class="header-3">Player Status</div>
                <p>Credits: ${gameState.credits}</p>
                ${bountyHtml}
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

        const isTransiting = typeof galaxyRenderer !== 'undefined' && galaxyRenderer && !!galaxyRenderer._travelAnim;
        if (isTransiting) {
            currentActions.innerHTML = '';
            return;
        }
        currentActions.innerHTML = `<button id="showSystemButton" class="btn-primary">Show System</button>`;
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

    static updateSelectedSystemSection(gameState) {
        const section = document.getElementById('selectedSystemSection');
        if (!section) return;

        const sys = gameState.selectedSystem;
        if (!sys || sys === gameState.currentSystem) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';
        const isTransiting = typeof galaxyRenderer !== 'undefined' && galaxyRenderer && !!galaxyRenderer._travelAnim;
        const isDirectRoute = gameState.currentSystem.connections &&
                              gameState.currentSystem.connections.includes(sys.id);

        if (!sys.seen) {
            document.getElementById('selectedSystemName').textContent = 'Unknown System';
            document.getElementById('selectedSystemStatus').textContent = 'Status: Unexplored';
            const actions = document.getElementById('selectedSystemActions');
            actions.innerHTML = (!isTransiting && isDirectRoute)
                ? `<button id="travelButton" class="btn-primary">Travel</button>`
                : '';
            if (!isTransiting && isDirectRoute) {
                document.getElementById('travelButton').onclick = () => GameController.travelToSystem(sys);
            }
            return;
        }

        document.getElementById('selectedSystemName').textContent = sys.name;
        document.getElementById('selectedSystemStatus').textContent = sys.visited ? 'Status: Visited' : 'Status: Not Yet Visited';

        const actions = document.getElementById('selectedSystemActions');
        actions.innerHTML = `
            ${(!isTransiting && isDirectRoute) ? `<button id="travelButton" class="btn-primary">Travel</button>` : ''}
            <button id="viewSystemLogButton" class="btn-secondary">View Records</button>
        `;

        if (!isTransiting && isDirectRoute) {
            document.getElementById('travelButton').onclick = () => GameController.travelToSystem(sys);
        }
        document.getElementById('viewSystemLogButton').onclick = () => this.showSystemLog(gameState);
    }

    static showSystemLog(gameState) {
        const sys = gameState.selectedSystem;
        if (!sys) return;

        const playerPanel = document.getElementById('systemLogPlayerPanel');
        if (playerPanel) playerPanel.innerHTML = this.renderPlayerStatusHtml(gameState);

        document.getElementById('systemLogTitle').textContent = `System Records: ${sys.name}`;

        const content = document.getElementById('systemLogContent');
        if (sys.visited) {
            const connections = sys.connections.map(id => {
                const connected = gameState.systems.find(s => s.id === id);
                if (!connected) return null;
                const routeKey = getRouteKey(sys.id, id);
                const encounters = gameState.routeFleets && gameState.routeFleets.get(routeKey);
                if (encounters && encounters.length > 0) {
                    const summary = encounters.map(e => {
                        const f = CONSTANTS.FACTIONS.find(f => f.id === e.faction);
                        return `${f ? f.name : '?'}(${e.size})`;
                    }).join(', ');
                    return `${connected.name} [${summary}]`;
                }
                return connected.name;
            }).filter(Boolean).join(', ') || 'None';
            content.innerHTML = `
                <div class="station-section">
                    <p><strong>Status:</strong> Visited</p>
                    <p><strong>Connected systems:</strong> ${connections}</p>
                    <p><strong>Resource level:</strong> ${sys.resourceLevel}</p>
                </div>`;
        } else {
            content.innerHTML = `
                <div class="station-section">
                    <p><strong>Status:</strong> Not Yet Visited</p>
                    <p>No detailed records. Explore this system to gather intelligence.</p>
                </div>`;
        }

        this.showScreen('systemLogScreen');

        const closeBtn = document.getElementById('closeSystemLogButton');
        if (closeBtn) {
            closeBtn.onclick = () => {
                this.showScreen('galaxyScreen');
                this.updateGalaxyScreen(gameState);
            };
        }
    }

    static openStationTab(tab, gameState) {
        gameState.state = GAME_STATE.STATION;
        gameState.selectedShip = gameState.selectedShip || gameState.playerShips[0] || null;
        this.currentModuleOffer = null;
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
        assignFleetNames(gameState.playerShips);

        if ((!gameState.selectedShip || !gameState.playerShips.includes(gameState.selectedShip)) && gameState.playerShips.length) {
            gameState.selectedShip = gameState.playerShips[0];
        }

        const currentShip = gameState.selectedShip || gameState.playerShips[0] || null;
        if (!this.currentStationOffer) {
            this.currentStationOffer = Array.from({ length: CONSTANTS.STATION_OFFER_COUNT }, () => {
                const stats = UISystem.generateNewShipStats();
                return { stats, cost: CONSTANTS.NEW_SHIP_BASE_COST + randomInt(-100, 100) };
            });
            this.selectedOfferIndex = 0;
        }

        if (!this.currentModuleOffer) {
            const count = randomInt(0, 3);
            const available = CONSTANTS.MODULES.filter(m => !m.internal);
            this.currentModuleOffer = [];
            for (let i = 0; i < count && available.length > 0; i++) {
                const idx = randomInt(0, available.length - 1);
                const [mod] = available.splice(idx, 1);
                const quality = Math.round(randomFloat(0.75, 1.25) * 100) / 100;
                this.currentModuleOffer.push({ moduleDef: mod, quality, cost: Math.round(mod.cost * quality) });
            }
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
            const modList = currentShip && currentShip.modules.length > 0
                ? currentShip.modules.map(mod => {
                    const m = CONSTANTS.MODULES.find(m => m.id === mod.id);
                    return m ? m.name : mod.id;
                  }).join(', ')
                : 'None';
            const builtinList = currentShip && (currentShip.builtinModules || []).length > 0
                ? currentShip.builtinModules.map(id => {
                    const m = CONSTANTS.MODULES.find(m => m.id === id);
                    return m ? m.name : id;
                  }).join(', ')
                : null;
            contentHtml = `
                <div class="station-section">
                    ${currentShip ? `
                        <p><strong>${currentShip.name || '?'}</strong> (${currentShip.shipType || '?'}) — Hull ${currentShip.hull}/${currentShip.maxHull}, Shields ${currentShip.shields}/${currentShip.maxShields}, Laser ${currentShip.laserDamage}, Engine ${currentShip.engine}</p>
                        ${builtinList ? `<p style="color:#cc99ff;font-size:0.85em;margin-top:-0.5em;">Built-in: ${builtinList}</p>` : ''}
                        <p style="color:#aaa;font-size:0.85em;margin-top:-0.5em;">Modules (${currentShip.modules.length}/${currentShip.moduleSlots}): ${modList}</p>
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
                    ${this.renderOfferTable(this.currentStationOffer, this.selectedOfferIndex, currentShip ? shipSaleValue : 0)}
                    <div class="station-action-row" style="margin-top:0.5em;">
                        <button id="buyButton" class="btn-primary">Buy</button>
                        <button id="tradeButton" class="btn-primary">Trade In</button>
                    </div>
                    ${offer && currentShip ? `<p class="station-note">Selected ship trade value: ${shipSaleValue} cr.</p>` : ''}
                </div>`;
        } else if (this.stationTab === 'modules') {
            const slotsFree = currentShip ? currentShip.moduleSlots - currentShip.modules.length : 0;
            const builtinIds = currentShip ? (currentShip.builtinModules || []) : [];

            const builtinSummary = builtinIds.length > 0
                ? builtinIds.map(id => {
                    const m = CONSTANTS.MODULES.find(m => m.id === id);
                    return m ? `<span style="color:#cc99ff;background:#1a0033;padding:1px 6px;border-radius:3px;margin-right:4px;">${m.name}</span>` : id;
                  }).join('')
                : '<span style="color:#555;">None</span>';

            const installedNames = currentShip && currentShip.modules.length > 0
                ? currentShip.modules.map(mod => {
                    const m = CONSTANTS.MODULES.find(m => m.id === mod.id);
                    return m ? m.name : mod.id;
                  }).join(', ')
                : 'None';

            const offers = this.currentModuleOffer || [];
            const moduleRows = currentShip ? offers.map(offer => {
                const mod = offer.moduleDef;
                const isBuiltin  = builtinIds.includes(mod.id);
                const installed  = currentShip.modules.some(m => m.id === mod.id);
                const noSlots    = !isBuiltin && !installed && slotsFree <= 0;
                const cantAfford = !isBuiltin && !installed && gameState.credits < offer.cost;
                const disabled   = isBuiltin || installed || noSlots || cantAfford;
                const label      = installed ? 'Installed' : (noSlots ? 'Full' : 'Install');
                const qualColor  = offer.quality >= 1.1 ? '#00ff88' : offer.quality <= 0.9 ? '#ff8888' : '#ffdd44';
                const qualLabel  = `<span style="color:${qualColor};font-size:0.8em;"> ×${offer.quality.toFixed(2)}</span>`;
                return `<tr>
                    <td style="white-space:nowrap;">${mod.name}${qualLabel}</td>
                    <td style="color:#aaa;font-size:0.9em;">${mod.desc}</td>
                    <td style="text-align:right;white-space:nowrap;">${offer.cost} cr</td>
                    <td><button class="btn-primary btn-sm" ${disabled ? 'disabled' : ''} data-module-offer-index="${offers.indexOf(offer)}">${label}</button></td>
                </tr>`;
            }).join('') : '';

            const noOffersMsg = currentShip && offers.length === 0
                ? '<tr><td colspan="4" style="color:#555;font-style:italic;">No modules available at this station.</td></tr>'
                : (!currentShip ? '<tr><td colspan="4" style="color:#aaa;">No ship selected.</td></tr>' : '');

            contentHtml = `
                <div class="station-section">
                    ${currentShip ? `
                        <p><strong>${currentShip.name}</strong> — ${currentShip.modules.length}/${currentShip.moduleSlots} slot${currentShip.modules.length === 1 ? '' : 's'} used</p>
                        <p style="font-size:0.85em;margin-top:-0.3em;">Built-in: ${builtinSummary}</p>
                        <p style="color:#aaa;font-size:0.85em;margin-top:-0.3em;">Installed: ${installedNames}</p>
                    ` : '<p>No ship selected.</p>'}
                    <table class="ship-status-table" style="margin-top:0.5em;width:100%;">
                        <thead><tr><th>Module</th><th>Effect</th><th>Cost</th><th></th></tr></thead>
                        <tbody>${moduleRows}${noOffersMsg}</tbody>
                    </table>
                </div>`;
        }

        if (this.stationTab === 'courthouse') {
            const bounty = gameState.bounty || 0;
            const canPay = bounty > 0 && gameState.credits >= bounty;
            contentHtml = `
                <div class="station-section">
                    <p>Current Bounty: <span style="color:${bounty > 0 ? '#ff4444' : '#00ff88'};font-weight:bold;">${bounty} credits</span></p>
                    ${bounty > 0
                        ? `<p style="color:#aaa;font-size:0.9em;">Paying your bounty clears your criminal record. Cost: ${bounty} credits.</p>
                           <div class="station-action-row">
                               <button id="payBountyButton" class="btn-primary" ${!canPay ? 'disabled' : ''}>Pay Bounty</button>
                           </div>
                           ${!canPay ? '<p style="color:#ff6666;font-size:0.85em;">Insufficient credits.</p>' : ''}`
                        : '<p style="color:#00ff88;">No outstanding bounty. You are free to travel.</p>'
                    }
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
                if (!currentShip) return;
                const hullAfter = Math.min(currentShip.maxHull, currentShip.hull + CONSTANTS.REPAIR_AMOUNT);
                this.showConfirmModal({
                    title: 'Repair Ship',
                    lines: [
                        `Hull: ${currentShip.hull} / ${currentShip.maxHull} → ${hullAfter} / ${currentShip.maxHull}`,
                        `Cost: ${CONSTANTS.REPAIR_COST} credits`,
                    ],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits - CONSTANTS.REPAIR_COST,
                    onConfirm: () => {
                        if (StationSystem.repairShip(gameState, currentShip)) this.updateStationScreen(gameState);
                    }
                });
            };
        }

        if (sellButton) {
            sellButton.disabled = !currentShip || gameState.playerShips.length <= 1;
            sellButton.onclick = () => {
                if (!currentShip) return;
                this.showConfirmModal({
                    title: 'Sell Ship',
                    lines: [
                        `${currentShip.name || '?'} (${currentShip.shipType || '?'})`,
                        `Hull ${currentShip.hull}/${currentShip.maxHull} · Shields ${currentShip.shields}/${currentShip.maxShields}`,
                        `Laser ${currentShip.laserDamage} · Engine ${currentShip.engine} · Radar ${currentShip.radar}`,
                        `Sale value: +${shipSaleValue} credits`,
                    ],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits + shipSaleValue,
                    onConfirm: () => {
                        if (StationSystem.sellShip(gameState, currentShip)) {
                            gameState.selectedShip = gameState.playerShips[0] || null;
                            this.currentStationOffer = null;
                            this.updateStationScreen(gameState);
                        }
                    }
                });
            };
        }

        if (buyButton) {
            buyButton.disabled = !offer || gameState.credits < offer.cost || gameState.playerShips.length >= CONSTANTS.PLAYER_STARTING_SHIPS;
            buyButton.onclick = () => {
                if (!offer) return;
                this.showConfirmModal({
                    title: 'Buy Ship',
                    lines: [
                        `${offer.stats.type || '?'}`,
                        `Hull ${offer.stats.hull} · Shields ${offer.stats.shields}`,
                        `Laser ${offer.stats.laser} · Engine ${offer.stats.engine} · Radar ${offer.stats.radar}`,
                        `Cost: ${offer.cost} credits`,
                    ],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits - offer.cost,
                    onConfirm: () => {
                        if (StationSystem.buyNewShip(gameState, offer.stats, offer.cost)) {
                            gameState.selectedShip = gameState.playerShips[gameState.playerShips.length - 1];
                            this.currentStationOffer = null;
                            this.updateStationScreen(gameState);
                        }
                    }
                });
            };
        }

        if (tradeButton) {
            tradeButton.disabled = !offer || !currentShip || gameState.playerShips.length === 0 || gameState.credits + shipSaleValue < offer.cost;
            tradeButton.onclick = () => {
                if (!offer || !currentShip) return;
                const net = offer.cost - shipSaleValue;
                const netLine = net > 0
                    ? `Net cost: ${net} credits`
                    : `Net gain: +${-net} credits`;
                this.showConfirmModal({
                    title: 'Trade In Ship',
                    lines: [
                        `Trading: ${currentShip.name || '?'} (${currentShip.shipType || '?'}) — value: ${shipSaleValue} cr`,
                        `For: ${offer.stats.type || '?'} — cost: ${offer.cost} cr`,
                        `Hull ${offer.stats.hull} · Shields ${offer.stats.shields} · Laser ${offer.stats.laser} · Engine ${offer.stats.engine}`,
                        netLine,
                    ],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits - net,
                    onConfirm: () => {
                        if (StationSystem.tradeInShip(gameState, currentShip, offer.stats, offer.cost)) {
                            gameState.selectedShip = gameState.playerShips[gameState.playerShips.length - 1];
                            this.currentStationOffer = null;
                            this.updateStationScreen(gameState);
                        }
                    }
                });
            };
        }

        const payBountyBtn = document.getElementById('payBountyButton');
        if (payBountyBtn) {
            payBountyBtn.onclick = () => {
                const bounty = gameState.bounty || 0;
                if (bounty <= 0 || gameState.credits < bounty) return;
                this.showConfirmModal({
                    title: 'Pay Bounty',
                    lines: [`Clear bounty of ${bounty} credits and restore clean record.`],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits - bounty,
                    onConfirm: () => {
                        gameState.credits -= bounty;
                        gameState.bounty = 0;
                        this.updateStationScreen(gameState);
                    }
                });
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

        document.querySelectorAll('[data-module-offer-index]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!currentShip) return;
                const offerIdx = Number(btn.dataset.moduleOfferIndex);
                const offer = this.currentModuleOffer ? this.currentModuleOffer[offerIdx] : null;
                if (!offer) return;
                const moduleDef = offer.moduleDef;
                const quality   = offer.quality;
                const cost      = offer.cost;

                const e = moduleDef.effect;
                const s = currentShip;
                const amt = e.amount !== undefined ? Math.max(1, Math.round(e.amount * quality)) : 0;

                const statRow = (label, before, after) => {
                    const changed = after !== undefined && String(after) !== String(before);
                    return `<div class="modal-stat-row">
                        <span class="modal-stat-label">${label}</span>
                        <span>${before}${changed ? ` → <span style="color:#00ff88;">${after}</span>` : ''}</span>
                    </div>`;
                };

                const hullAfter = e.stat === 'maxHull'    ? `${s.hull + amt}/${s.maxHull + amt}` : undefined;
                const shAfter   = e.stat === 'maxShields' ? `${s.shields + amt}/${s.maxShields + amt}` : undefined;
                const engAfter  = e.stat === 'engine'     ? s.engine + amt : undefined;
                const radAfter  = e.stat === 'radar'      ? s.radar + amt : undefined;

                const qualColor = quality >= 1.1 ? '#00ff88' : quality <= 0.9 ? '#ff8888' : '#ffdd44';
                const extraHtml = `
                    <div class="modal-stat-block">
                        <div class="modal-stat-ship-label">${s.name} &nbsp;·&nbsp; ${s.shipType} &nbsp;·&nbsp; slot ${s.modules.length + 1}/${s.moduleSlots}</div>
                        <div style="font-size:0.82em;color:${qualColor};margin-bottom:0.3em;">Quality: ×${quality.toFixed(2)}</div>
                        ${statRow('Hull',    `${s.hull}/${s.maxHull}`,       hullAfter)}
                        ${statRow('Shields', `${s.shields}/${s.maxShields}`, shAfter)}
                        ${statRow('Laser',   s.laserDamage,                  undefined)}
                        ${statRow('Engine',  s.engine,                       engAfter)}
                        ${statRow('Radar',   s.radar,                        radAfter)}
                    </div>`;

                this.showConfirmModal({
                    title: 'Install Module',
                    lines: [`<strong>${moduleDef.name}</strong> — ${moduleDef.desc}`],
                    extraHtml,
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits - cost,
                    onConfirm: () => {
                        if (StationSystem.installModule(gameState, currentShip, moduleDef, quality, cost)) {
                            this.updateStationScreen(gameState);
                        }
                    }
                });
            });
        });
    }
    
    static showConfirmModal({ title, lines, creditsBefore, creditsAfter, extraHtml = '', onConfirm }) {
        document.getElementById('modalTitle').textContent = title;

        const creditColor = creditsAfter >= creditsBefore ? '#00ff88' : '#ff6666';
        const body = document.getElementById('modalBody');
        body.innerHTML = lines.map(l => `<p>${l}</p>`).join('') +
            extraHtml +
            `<p class="modal-credits-row">
                Credits: ${creditsBefore}
                &nbsp;→&nbsp;
                <span style="color:${creditColor};">${creditsAfter}</span>
             </p>`;

        const modal = document.getElementById('stationModal');
        modal.style.display = 'flex';

        const close = () => { modal.style.display = 'none'; };

        modal.onclick = (e) => { if (e.target === modal) close(); };
        document.getElementById('modalCloseButton').onclick = close;
        document.getElementById('modalConfirmButton').onclick = () => { close(); onConfirm(); };
    }

    static generateNewShipStats() {
        const typeData = CONSTANTS.SHIP_TYPES.filter(t => !t.internal)[Math.floor(Math.random() * CONSTANTS.SHIP_TYPES.filter(t => !t.internal).length)];
        return {
            hull: Math.max(1, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.HULL_MIN, CONSTANTS.SHIP_STATS.HULL_MAX) * typeData.hullMult)),
            shields: Math.max(0, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.SHIELDS_MIN, CONSTANTS.SHIP_STATS.SHIELDS_MAX) * typeData.shieldMult)),
            laser: Math.max(1, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.LASER_MIN, CONSTANTS.SHIP_STATS.LASER_MAX) * typeData.laserMult)),
            radar: Math.max(1, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.RADAR_MIN, CONSTANTS.SHIP_STATS.RADAR_MAX) * typeData.radarMult)),
            engine: Math.max(5, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.ENGINE_MIN, CONSTANTS.SHIP_STATS.ENGINE_MAX) * typeData.engineMult)),
            type: typeData.type,
        };
    }
    
    static updateCombatScreen(gameState, combat) {
        const panel = document.getElementById('combatSidebarPanel');
        const logPanel = document.getElementById('combatLogPanel');
        if (!panel) return;

        // Sync tab button active states
        const actionsTabEl = document.getElementById('combatActionsTab');
        const infoTabEl = document.getElementById('combatInfoTab');
        if (actionsTabEl) actionsTabEl.classList.toggle('active', this.combatTab === 'actions');
        if (infoTabEl) infoTabEl.classList.toggle('active', this.combatTab === 'info');

        const isPlayerTurn = combat.state === COMBAT_STATE.PLAYER_TURN;
        const isResolving = combat.state === COMBAT_STATE.RESOLVING || combat.state === COMBAT_STATE.ENEMY_TURN;
        const activeTurnShip = isPlayerTurn ? combat.playerShips[combat.currentShipIndex] : null;
        const playerAlive = combat.playerShips.filter(s => s.alive).length;
        const enemyAlive = combat.enemyShips.filter(s => s.alive).length;

        if (this.combatTab === 'info') {
            panel.innerHTML = `
                <div class="header-3" style="background-color:#111;color:#00ffff;">
                    Player Fleet ${playerAlive}/${combat.playerShips.length}
                </div>
                ${this.renderShipTable(combat.playerShips, { selectable: true, selectedShip: combat.selectedCombatShip })}
                <div class="header-3" style="background-color:#111;color:#ff5555;margin-top:0.5em;">
                    Enemy Fleet ${enemyAlive}/${combat.enemyShips.length}
                </div>
                ${this.renderShipTable(combat.enemyShips, { isEnemy: true, selectedShip: combat.selectedCombatShip })}`;

            // Combat log in the bottom panel on info tab
            if (logPanel) {
                const logEntries = combat.combatLog || [];
                const prevScroll = logPanel.scrollTop;
                if (logEntries.length > 0) {
                    logPanel.innerHTML =
                        `<div class="header-3" style="margin-bottom:0.25em;">Combat Log</div>` +
                        `<div style="font-size:0.68em;color:#888;line-height:1.55;">` +
                        logEntries.map(m => `<div>${m}</div>`).join('') +
                        `</div>`;
                } else {
                    logPanel.innerHTML = '';
                }
                logPanel.scrollTop = prevScroll;
            }
        } else {
            // Actions tab — active ship + buttons in top panel
            let activeTurnHtml = '';
            if (activeTurnShip) {
                const pips = '●'.repeat(activeTurnShip.actionsRemaining) + '○'.repeat(2 - activeTurnShip.actionsRemaining);
                activeTurnHtml = `
                    <div class="header-3" style="background-color:#002200;color:#00ff44;">Active: ${activeTurnShip.name || '?'} <span style="color:#88ff88;font-size:0.85em;letter-spacing:3px;">${pips}</span></div>
                    ${this.renderShipTable([activeTurnShip], { showStats: true })}
                    ${this.renderStatusEffects(activeTurnShip)}`;
            }

            let actionsHtml = '';
            if (isPlayerTurn && activeTurnShip && activeTurnShip.alive) {
                const hasActions  = activeTurnShip.actionsRemaining > 0;
                const mode        = combat.playerMode;
                const isAnimating = combat.isAnimating();

                const shootRange     = activeTurnShip.radar * CONSTANTS.SHOOT_RANGE_BASE;
                const hasValidTargets = combat.enemyShips.some(s =>
                    s.alive && !s.cloaked &&
                    distance(activeTurnShip.x, activeTurnShip.y, s.x, s.y) <= shootRange &&
                    isInFiringZone(activeTurnShip, s));
                const rechargeLabel  = (activeTurnShip.maxShields > 0 && activeTurnShip.shields >= activeTurnShip.maxShields)
                    ? 'Wait' : 'Recharge';

                if (!isAnimating && mode === 'move') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#88ff88;font-size:0.8em;margin-top:0.5em;text-align:center;">Click oval to move · Click enemy to ram</p>`;
                } else if (!isAnimating && mode === 'fire') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#88ff88;font-size:0.8em;margin-top:0.5em;text-align:center;">Click an enemy in range to fire</p>`;
                } else if (!isAnimating && mode === 'blink') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#bb88ff;font-size:0.8em;margin-top:0.5em;text-align:center;">Click anywhere within the purple circle to blink</p>`;
                } else if (!isAnimating && mode === 'afterburner') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff8800;font-size:0.8em;margin-top:0.5em;text-align:center;">Click anywhere to afterburner-dash forward at full range · damages enemies in path</p>`;
                } else if (!isAnimating && mode === 'warhead') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff4444;font-size:0.8em;margin-top:0.5em;text-align:center;">Click within the red targeting circle to set detonation point · blast damages + knocks back all ships in radius</p>`;
                } else if (!isAnimating && mode === 'tractor_beam') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#00eeff;font-size:0.8em;margin-top:0.5em;text-align:center;">Click a ship within the cyan cone to pull it — target moves to midpoint, you move halfway there</p>`;
                } else if (!isAnimating && mode === 'emp_blast') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ffee44;font-size:0.8em;margin-top:0.5em;text-align:center;">Click anywhere to fire EMP — damages shields and locks abilities on all ships in the yellow radius</p>`;
                } else if (!isAnimating && mode === 'detonate') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff6600;font-size:0.8em;margin-top:0.5em;text-align:center;">Click anywhere to detonate — blast damages all ships in radius</p>`;
                } else if (!isAnimating && mode === 'repair_beam') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#00ff88;font-size:0.8em;margin-top:0.5em;text-align:center;">Click an allied ship in the green range circle to repair it</p>`;
                } else {
                    const overheated = activeTurnShip.statusEffect === 'plasma';
                    const hasStatus  = !!activeTurnShip.statusEffect;
                    const dis     = !hasActions || isAnimating ? 'disabled' : '';
                    const fireDis = !hasActions || !hasValidTargets || isAnimating || overheated ? 'disabled' : '';

                    // Special move buttons — one per move the ship has
                    const cooldowns = activeTurnShip.specialMoveCooldowns || {};
                    const specialBtns = (activeTurnShip.specialMoves || []).map(moveId => {
                        const moveDef = CONSTANTS.SPECIAL_MOVES[moveId];
                        if (!moveDef) return '';
                        const cd = cooldowns[moveId] || 0;
                        const onCd  = cd > 0;
                        const cloakBlocked = moveId === 'cloak' && hasStatus;
                        const btnDis = onCd || !hasActions || isAnimating || overheated || cloakBlocked ? 'disabled' : '';
                        const label  = onCd ? `${moveDef.name} (${cd})` : moveDef.name;
                        const color  = onCd || overheated || cloakBlocked ? '#555' : '#cc99ff';
                        return `<button class="btn-primary combat-special-btn" ${btnDis} data-move-id="${moveId}" style="color:${color};">${label}</button>`;
                    }).join('');

                    actionsHtml = `
                        <div style="text-align:center;font-size:0.8em;color:#aaa;margin-bottom:0.25em;">Actions: ${activeTurnShip.actionsRemaining}/2</div>
                        <div class="combat-action-row">
                            <button id="combatMoveBtn" class="btn-primary" ${dis}>Move</button>
                            <button id="combatFireBtn" class="btn-primary" ${fireDis}>Fire</button>
                            <button id="combatSkipBtn" class="btn-secondary" ${dis}>${rechargeLabel}</button>
                        </div>
                        ${specialBtns ? `<div class="combat-action-row" style="margin-top:0.3em;">${specialBtns}</div>` : ''}`;
                }
            } else if (isResolving) {
                actionsHtml = `<p style="text-align:center;color:#ffaa00;padding:0.5em 0;">Enemy acting...</p>`;
            }

            panel.innerHTML = `${activeTurnHtml}${actionsHtml}`;

            // Selected ship in the bottom panel on actions tab
            if (logPanel) {
                const sel = combat.selectedCombatShip;
                if (sel && sel !== activeTurnShip) {
                    const isAlly = sel.isPlayer;
                    const headerColor = isAlly ? '#004455' : '#440000';
                    const badge = isAlly
                        ? '<span style="color:#00ffff;">[ALLY]</span>'
                        : '<span style="color:#ff5555;">[ENEMY]</span>';
                    logPanel.innerHTML = `
                        <div class="header-3" style="background-color:${headerColor};color:#fff;">Selected: ${sel.name || '?'} ${badge}</div>
                        ${this.renderShipTable([sel], { showStats: true })}
                        ${this.renderStatusEffects(sel)}`;
                } else {
                    logPanel.innerHTML = '';
                }
            }
        }

        this.setupCombatButtons(gameState, combat, activeTurnShip);
    }

    static setupCombatButtons(gameState, combat, activeTurnShip) {
        const moveBtn       = document.getElementById('combatMoveBtn');
        const fireBtn       = document.getElementById('combatFireBtn');
        const cancelModeBtn = document.getElementById('combatCancelModeBtn');
        const skipBtn       = document.getElementById('combatSkipBtn');

        if (moveBtn) {
            moveBtn.onclick = () => {
                combat.playerMode = 'move';
                this.updateCombatScreen(gameState, combat);
            };
        }
        if (fireBtn) {
            fireBtn.onclick = () => {
                combat.playerMode = 'fire';
                this.updateCombatScreen(gameState, combat);
            };
        }
        if (cancelModeBtn) {
            cancelModeBtn.onclick = () => {
                combat.playerMode = null;
                this.updateCombatScreen(gameState, combat);
            };
        }

        if (skipBtn) {
            skipBtn.onclick = () => {
                if (!activeTurnShip) return;
                combat.playerSkipTurn(activeTurnShip);
                this.updateCombatScreen(gameState, combat);
            };
        }

        document.querySelectorAll('.combat-special-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const moveId = btn.dataset.moveId;
                const activeShip = combat.playerShips[combat.currentShipIndex];
                if (moveId === 'emp_blast') {
                    combat.playerMode = 'emp_blast';
                    this.updateCombatScreen(gameState, combat);
                } else if (moveId === 'cloak') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerCloak(activeShip);
                    }
                } else if (moveId === 'summon_drone') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerSummonDrone(activeShip);
                    }
                } else if (moveId === 'detonate') {
                    combat.playerMode = 'detonate';
                    this.updateCombatScreen(gameState, combat);
                } else if (moveId === 'repair_beam') {
                    combat.playerMode = 'repair_beam';
                    this.updateCombatScreen(gameState, combat);
                } else {
                    combat.playerMode = moveId;
                    this.updateCombatScreen(gameState, combat);
                }
            });
        });

        // Sidebar ship rows — click to select (show stats)
        document.querySelectorAll('#combatSidebarPanel [data-ship-index]').forEach(row => {
            row.addEventListener('click', () => {
                const idx = Number(row.dataset.shipIndex);
                combat.selectedCombatShip = combat.playerShips[idx] || null;
                this.updateCombatScreen(gameState, combat);
            });
        });

        document.querySelectorAll('#combatSidebarPanel [data-enemy-index]').forEach(row => {
            row.addEventListener('click', () => {
                const idx = Number(row.dataset.enemyIndex);
                combat.selectedCombatShip = combat.enemyShips[idx] || null;
                this.updateCombatScreen(gameState, combat);
            });
        });
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
