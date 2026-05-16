// UI station screen — extends UISystem
// Loaded after UI.js

UISystem._stationDiscount = function(gameState) {
    return barterPriceMult(gameState.perks || []);
};
UISystem._discountedCost = function(cost, gameState) {
    return Math.max(1, Math.floor(cost * this._stationDiscount(gameState)));
};

UISystem.openStationTab = function(tab, gameState) {
        gameState.state = GAME_STATE.STATION;
        gameState.selectedShip = gameState.selectedShip || gameState.playerShips[0] || null;
        this.currentModuleOffer = null;
        this.setStationTab(tab, gameState);
        StationSystem.visitStation(gameState);
        this.showScreen('stationScreen');
        this.updateStationScreen(gameState);
};

UISystem.setStationTab = function(tab, gameState) {
        this.stationTab = tab;
        this.currentStationOffer = null;
        this.selectedOfferIndex = 0;
        this.updateStationScreen(gameState);
};

UISystem.updateStationScreen = function(gameState) {
        assignFleetNames(gameState.playerShips);

        const aliveShips = gameState.playerShips.filter(s => s.alive);
        if ((!gameState.selectedShip || !gameState.playerShips.includes(gameState.selectedShip)) && aliveShips.length) {
            gameState.selectedShip = aliveShips[0];
        }

        const currentShip = gameState.selectedShip || aliveShips[0] || null;

        if (!this.currentStationOffer) {
            this.currentStationOffer = Array.from({ length: CONSTANTS.STATION_OFFER_COUNT }, () => {
                const stats = UISystem.generateNewShipStats();
                return { stats, cost: calcShipCost(stats) };
            });
            this.selectedOfferIndex = 0;
        }

        if (!this.currentItemOffer) {
            this.currentItemOffer = (CONSTANTS.ITEMS || []).slice();
        }

        if (!this.currentModuleOffer) {
            const count = randomInt(0, 3);
            const builtinIds = new Set(CONSTANTS.SHIP_TYPES.flatMap(t => t.builtinModules || []));
            const available = CONSTANTS.MODULES.filter(m => !m.internal && !builtinIds.has(m.id));
            this.currentModuleOffer = [];
            for (let i = 0; i < count && available.length > 0; i++) {
                const idx = randomInt(0, available.length - 1);
                const [mod] = available.splice(idx, 1);
                const quality = Math.round(randomFloat(0.75, 1.25) * 100) / 100;
                this.currentModuleOffer.push({ moduleDef: mod, quality, cost: Math.round(mod.cost * quality) });
            }
        }

        const rawOffer = this.currentStationOffer[this.selectedOfferIndex];
        const offer = rawOffer ? { ...rawOffer, cost: this._discountedCost(rawOffer.cost, gameState) } : rawOffer;

        const stationPanel = document.getElementById('stationPlayerPanel');
        if (stationPanel) {
            stationPanel.innerHTML = this.renderPlayerStatusHtml(gameState, {
                selectable: true,
                selectedShip: currentShip
            });
            const perksBtn = stationPanel.querySelector('#openPerksBtn');
            if (perksBtn) perksBtn.onclick = () => GameController.openPerksScreen();
        }

        // Single-tab station: show only the tab matching the current system's stationType
        const sys = gameState.currentSystem;
        const stationType = sys && sys.stationType;

        const tabIdMap = {
            shipyard:    'shipyardTab',
            blackmarket: 'modulesTab',
            mechanic:    'mechanicTab',
            courthouse:  'courthouseTab',
            marketplace: 'marketplaceTab',
        };
        const activeTabId = tabIdMap[stationType] || 'shipyardTab';

        this.stationTab = stationType === 'blackmarket' ? 'modules'
                        : stationType === 'mechanic'    ? 'mechanic'
                        : stationType === 'courthouse'  ? 'courthouse'
                        : stationType === 'marketplace' ? 'marketplace'
                        : 'shipyard';

        // Update station title
        const stationTitles = { shipyard: 'Shipyard', blackmarket: 'Black Market', mechanic: 'Mechanic Station', courthouse: 'Courthouse', marketplace: 'Marketplace' };
        const titleEl = document.getElementById('stationScreenTitle');
        const baseTitle = (sys && stationTitles[stationType]) || 'Space Station';
        const discountMult = UISystem._stationDiscount(gameState);
        const discountSuffix = discountMult < 1 ? ` <span style="color:#ffcc44;font-size:0.7em;font-weight:normal;">${Math.round((1 - discountMult) * 100)}% off</span>` : '';
        if (titleEl) titleEl.innerHTML = baseTitle + discountSuffix;

        const allTabIds = ['shipyardTab', 'modulesTab', 'mechanicTab', 'courthouseTab', 'marketplaceTab'];
        allTabIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === activeTabId) ? '' : 'none';
        });
        document.querySelectorAll('.station-tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.id === activeTabId);
        });

        let contentHtml = '';

        if (this.stationTab === 'shipyard') {
            const deadShips = gameState.playerShips.filter(s => !s.alive);
            const aliveCount = aliveShips.length;
            const canBuy = offer && gameState.credits >= offer.cost && aliveCount < maxFleetSize(gameState);

            const resurrectCost = this._discountedCost(CONSTANTS.RESURRECT_COST, gameState);
            const deadRows = deadShips.map(ship => {
                const canAfford = gameState.credits >= resurrectCost;
                return `<tr>
                    <td>${ship.name} <span style="color:#ff4444;font-size:0.8em;">[DESTROYED]</span></td>
                    <td style="color:#aaa;font-size:0.85em;">${ship.shipType} · Lv${ship.level || 1}</td>
                    <td style="text-align:right;white-space:nowrap;">${resurrectCost} cr</td>
                    <td><button class="btn-primary btn-sm" ${!canAfford ? 'disabled' : ''} data-resurrect-ship-index="${gameState.playerShips.indexOf(ship)}">Resurrect</button></td>
                </tr>`;
            }).join('');

            const discountedOffers = (this.currentStationOffer || []).map(o =>
                ({ ...o, cost: this._discountedCost(o.cost, gameState) }));
            contentHtml = `
                <div class="station-section">
                    ${this.renderOfferTable(discountedOffers, this.selectedOfferIndex, 0)}
                    <div class="station-action-row" style="margin-top:0.5em;">
                        <button id="buyButton" class="btn-primary" ${!canBuy ? 'disabled' : ''}>Buy (${offer ? offer.cost : '?'} cr)</button>
                        <span style="color:#666;font-size:0.8em;align-self:center;">Fleet: ${aliveCount}/${maxFleetSize(gameState)}</span>
                        ${currentShip ? `<button id="junkButton" class="btn-secondary" ${aliveCount <= 1 && currentShip.alive ? 'disabled' : ''}>Junk Selected</button>` : ''}
                    </div>
                    ${deadShips.length > 0 ? `
                        <div style="margin-top:1em;">
                            <div style="color:#ff8888;font-weight:bold;margin-bottom:0.3em;">Destroyed Ships — ${resurrectCost} cr each</div>
                            <table class="ship-status-table" style="width:100%;">
                                <tbody>${deadRows}</tbody>
                            </table>
                        </div>` : ''}
                </div>`;

        } else if (this.stationTab === 'modules') {
            const slotsFree = currentShip ? currentShip.moduleSlots - currentShip.modules.length : 0;
            const builtinIds = currentShip ? (currentShip.builtinModules || []) : [];

            const builtinSummary = builtinIds.length > 0
                ? builtinIds.map(id => {
                    const m = CONSTANTS.MODULES.find(m => m.id === id);
                    return m ? `<span style="color:#cc99ff;background:#1a0033;padding:1px 6px;border-radius:3px;margin-right:4px;cursor:help;" data-tooltip="${m.desc}">${m.name}</span>` : id;
                  }).join('')
                : '<span style="color:#555;">None</span>';

            const installedNames = currentShip && currentShip.modules.length > 0
                ? currentShip.modules.map(mod => {
                    const m = CONSTANTS.MODULES.find(m => m.id === mod.id);
                    return m ? m.name : mod.id;
                  }).join(', ')
                : 'None';

            const offers = (this.currentModuleOffer || []).map(o =>
                ({ ...o, cost: this._discountedCost(o.cost, gameState) }));
            const moduleRows = currentShip ? offers.map((offer, offerIdx) => {
                const mod = offer.moduleDef;
                const isBuiltin  = builtinIds.includes(mod.id);
                const installed  = currentShip.modules.some(m => m.id === mod.id);
                const noSlots    = !isBuiltin && !installed && slotsFree <= 0;
                const cantAfford = !isBuiltin && !installed && gameState.credits < offer.cost;
                const conflicts  = !isBuiltin && !installed && !!mod.exclusiveGroup && currentShip.modules.some(m => {
                    const def = CONSTANTS.MODULES.find(md => md.id === m.id);
                    return def && def.exclusiveGroup === mod.exclusiveGroup;
                });
                const disabled   = isBuiltin || installed || noSlots || cantAfford || conflicts;
                const label      = installed ? 'Installed' : (noSlots ? 'Full' : (conflicts ? 'Conflicts' : 'Install'));
                const qualColor  = offer.quality >= 1.1 ? '#00ff88' : offer.quality <= 0.9 ? '#ff8888' : '#ffdd44';
                const qualLabel  = `<span style="color:${qualColor};font-size:0.8em;"> ×${offer.quality.toFixed(2)}</span>`;
                return `<tr>
                    <td style="white-space:nowrap;">${mod.name}${qualLabel}</td>
                    <td style="color:#aaa;font-size:0.9em;">${mod.desc}</td>
                    <td style="text-align:right;white-space:nowrap;">${offer.cost} cr</td>
                    <td><button class="btn-primary btn-sm" ${disabled ? 'disabled' : ''} data-module-offer-index="${offerIdx}">${label}</button></td>
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

        } else if (this.stationTab === 'mechanic') {
            const LEVEL_COSTS = CONSTANTS.SHIP_LEVEL_COSTS;
            const LEVEL_MULTS = CONSTANTS.SHIP_LEVEL_MULTS;

            const rows = gameState.playerShips.map((ship, idx) => {
                const level = ship.level || 1;
                const maxed = level >= 5;
                const rawUpgradeCost = maxed ? null : LEVEL_COSTS[level - 1];
                const nextCost = maxed ? null : this._discountedCost(rawUpgradeCost, gameState);
                const nextMult = maxed ? null : LEVEL_MULTS[level];
                const canAfford = !maxed && gameState.credits >= nextCost;
                const isAlive = ship.alive;
                const statusLabel = !isAlive ? '<span style="color:#ff4444;"> [DESTROYED]</span>' : '';
                return `<tr>
                    <td>${ship.name}${statusLabel}</td>
                    <td style="color:#aaa;font-size:0.85em;">${ship.shipType}</td>
                    <td style="text-align:center;">
                        <span style="color:#ffdd44;font-weight:bold;">Lv ${level}</span>
                        ${maxed ? '' : `<span style="color:#666;font-size:0.8em;"> → ${nextMult}×</span>`}
                    </td>
                    <td style="text-align:right;white-space:nowrap;">${maxed ? '<span style="color:#00ff88;">Max</span>' : nextCost + ' cr'}</td>
                    <td><button class="btn-primary btn-sm" ${maxed || !canAfford || !isAlive ? 'disabled' : ''} data-upgrade-ship-index="${idx}">${maxed ? 'Maxed' : 'Upgrade'}</button></td>
                </tr>`;
            }).join('');

            contentHtml = `
                <div class="station-section">
                    <p style="color:#aaa;font-size:0.9em;">Ship upgrades increase all stats proportionally.</p>
                    <table class="ship-status-table" style="margin-top:0.5em;width:100%;">
                        <thead><tr><th>Ship</th><th>Type</th><th>Level</th><th>Cost</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;

        } else if (this.stationTab === 'marketplace') {
            const items = (this.currentItemOffer || []).map(i =>
                ({ ...i, cost: this._discountedCost(i.cost, gameState) }));
            const itemRows = items.map(item => {
                const canAfford = gameState.credits >= item.cost;
                const inv = currentShip ? (currentShip.inventory || []) : [];
                const cap = currentShip ? (currentShip.cargoCapacity || 1) : 1;
                const full = inv.length >= cap;
                const disabled = !currentShip || !canAfford || full;
                const label = full ? 'Full' : 'Buy';
                return `<tr>
                    <td style="color:#ffcc44;white-space:nowrap;">${item.name}</td>
                    <td style="color:#aaa;font-size:0.9em;">${item.desc}</td>
                    <td style="text-align:right;white-space:nowrap;">${item.cost} cr</td>
                    <td><button class="btn-primary btn-sm" ${disabled ? 'disabled' : ''} data-buy-item-id="${item.id}" data-buy-item-cost="${item.cost}">${label}</button></td>
                </tr>`;
            }).join('');

            const cargoRows = gameState.playerShips.filter(s => s.alive).map(ship => {
                const inv = ship.inventory || [];
                const cap = ship.cargoCapacity || 1;
                const invDisplay = inv.length > 0
                    ? inv.map(id => { const it = (CONSTANTS.ITEMS||[]).find(i=>i.id===id); return it ? it.name : id; }).join(', ')
                    : '<span style="color:#555;">Empty</span>';
                return `<tr>
                    <td>${ship.name}</td>
                    <td style="color:#aaa;font-size:0.85em;">${ship.shipType}</td>
                    <td style="text-align:center;">${inv.length}/${cap}</td>
                    <td style="font-size:0.85em;">${invDisplay}</td>
                </tr>`;
            }).join('');

            contentHtml = `
                <div class="station-section">
                    <p style="color:#aaa;font-size:0.9em;">Items are consumed on use during combat. Select a ship to buy items for it.</p>
                    <table class="ship-status-table" style="margin-top:0.5em;width:100%;">
                        <thead><tr><th>Item</th><th>Effect</th><th>Cost</th><th></th></tr></thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                </div>
                <div class="station-section" style="margin-top:1em;">
                    <div class="header-3" style="margin-bottom:0.4em;">Fleet Cargo</div>
                    <table class="ship-status-table" style="width:100%;">
                        <thead><tr><th>Ship</th><th>Type</th><th>Cargo</th><th>Items</th></tr></thead>
                        <tbody>${cargoRows}</tbody>
                    </table>
                </div>`;

        } else if (this.stationTab === 'courthouse') {
            if (gameState.playerFaction === 'pirates') {
                contentHtml = `<div class="station-section">
                    <p style="color:#ff4444;font-weight:bold;">Not Welcome</p>
                    <p style="color:#aaa;font-size:0.9em;">Pirates have no business here. The courthouse doors are shut to you.</p>
                </div>`;
                document.getElementById('stationTabContent').innerHTML = contentHtml;
                this.setupStationButtons(gameState, currentShip);
                return;
            }
            const bounty = gameState.bounty || 0;
            const canPay = bounty > 0 && gameState.credits >= bounty;
            const contracts = gameState.contracts || 0;
            const canCollect = contracts > 0;
            contentHtml = `
                <div class="station-section">
                    <div class="header-3" style="margin-bottom:0.4em;">Bounty Office</div>
                    <p>Current Bounty: <span style="color:${bounty > 0 ? '#ff4444' : '#00ff88'};font-weight:bold;">${bounty} credits</span></p>
                    ${bounty > 0
                        ? `<p style="color:#aaa;font-size:0.9em;">Paying your bounty clears your criminal record. Cost: ${bounty} credits.</p>
                           <div class="station-action-row">
                               <button id="payBountyButton" class="btn-primary" ${!canPay ? 'disabled' : ''}>Pay Bounty</button>
                           </div>
                           ${!canPay ? '<p style="color:#ff6666;font-size:0.85em;">Insufficient credits.</p>' : ''}`
                        : '<p style="color:#00ff88;">No outstanding bounty. You are free to travel.</p>'
                    }
                </div>
                <div class="station-section" style="margin-top:1em;">
                    <div class="header-3" style="margin-bottom:0.4em;">Pirate Contracts</div>
                    <p>Pending Contracts: <span style="color:${contracts > 0 ? '#44ffdd' : '#aaa'};font-weight:bold;">${contracts}</span></p>
                    ${canCollect
                        ? (() => {
                            const isPolice    = gameState.playerFaction === 'police';
                            const creditValue = isPolice ? contracts * 2 : contracts;
                            const bonusNote   = isPolice ? ' <span style="color:#4488ff;font-size:0.85em;">(2× police bonus)</span>' : '';
                            return `<p style="color:#aaa;font-size:0.9em;">Convert your pirate bounty contracts to ${creditValue} credits.${bonusNote}</p>
                           <div class="station-action-row">
                               <button id="collectContractsButton" class="btn-primary">Collect ${creditValue} Credits</button>
                           </div>`;
                          })()
                        : '<p style="color:#aaa;font-size:0.9em;">Defeat pirate ships to earn contracts. Collect here for credits.</p>'
                    }
                </div>`;
        }

        document.getElementById('stationTabContent').innerHTML = contentHtml;
        this.setupStationButtons(gameState, currentShip);
};

UISystem.setupStationButtons = function(gameState, currentShip) {
        const offer = this.currentStationOffer ? this.currentStationOffer[this.selectedOfferIndex] : null;
        const aliveCount = gameState.playerShips.filter(s => s.alive).length;

        const buyButton = document.getElementById('buyButton');
        if (buyButton) {
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
                        // Use offer.cost which is already discounted
                        if (gameState.credits >= offer.cost && gameState.playerShips.filter(s => s.alive).length < maxFleetSize(gameState)) {
                            gameState.credits -= offer.cost;
                            const newShip = new Ship(0, 0, true, 0, offer.stats);
                            newShip._buyPrice = offer.cost;
                            gameState.playerShips.push(newShip);
                            gameState.selectedShip = newShip;
                            this.currentStationOffer = null;
                            this.updateStationScreen(gameState);
                        }
                    }
                });
            };
        }

        const junkButton = document.getElementById('junkButton');
        if (junkButton && currentShip) {
            const isLastAlive = currentShip.alive && aliveCount <= 1;
            junkButton.disabled = isLastAlive;
            junkButton.onclick = () => {
                if (!currentShip) return;
                this.showConfirmModal({
                    title: 'Junk Ship',
                    lines: [
                        `Permanently remove ${currentShip.name} (${currentShip.shipType}) from fleet.`,
                        'This action is free but cannot be undone.',
                    ],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits,
                    onConfirm: () => {
                        if (StationSystem.junkShip(gameState, currentShip)) {
                            this.currentStationOffer = null;
                            this.updateStationScreen(gameState);
                        }
                    }
                });
            };
        }

        document.querySelectorAll('[data-resurrect-ship-index]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.resurrectShipIndex);
                const ship = gameState.playerShips[idx];
                if (!ship) return;
                const resCost = this._discountedCost(CONSTANTS.RESURRECT_COST, gameState);
                this.showConfirmModal({
                    title: 'Resurrect Ship',
                    lines: [
                        `Revive ${ship.name} (${ship.shipType}) at 25% hull.`,
                        `Cost: ${resCost} credits`,
                    ],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits - resCost,
                    onConfirm: () => {
                        if (gameState.credits >= resCost && !ship.alive) {
                            gameState.credits -= resCost;
                            ship.alive = true;
                            ship.hull  = Math.max(1, Math.round(ship.maxHull * 0.25));
                            ship.shields = 0;
                            this.updateStationScreen(gameState);
                        }
                    }
                });
            });
        });

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

        const collectContractsBtn = document.getElementById('collectContractsButton');
        if (collectContractsBtn) {
            collectContractsBtn.onclick = () => {
                const contracts = gameState.contracts || 0;
                if (contracts <= 0) return;
                const isPolice     = gameState.playerFaction === 'police';
                const creditValue  = isPolice ? contracts * 2 : contracts;
                const bonusNote    = isPolice ? ' (2× police bonus)' : '';
                this.showConfirmModal({
                    title: 'Collect Contracts',
                    lines: [`Convert ${contracts} pending contracts to ${creditValue} credits.${bonusNote}`],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits + creditValue,
                    onConfirm: () => {
                        gameState.credits += creditValue;
                        gameState.contracts = 0;
                        this.updateStationScreen(gameState);
                    }
                });
            };
        }

        document.querySelectorAll('[data-upgrade-ship-index]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.upgradeShipIndex);
                const ship = gameState.playerShips[idx];
                if (!ship) return;
                const level = ship.level || 1;
                const rawCost  = CONSTANTS.SHIP_LEVEL_COSTS[level - 1];
                const cost     = this._discountedCost(rawCost, gameState);
                const nextMult = CONSTANTS.SHIP_LEVEL_MULTS[level];
                this.showConfirmModal({
                    title: 'Upgrade Ship',
                    lines: [
                        `${ship.name} (${ship.shipType}) — Level ${level} → ${level + 1}`,
                        `All stats scaled to ${nextMult}× base values.`,
                        `Cost: ${cost} credits`,
                    ],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits - cost,
                    onConfirm: () => {
                        if (gameState.credits >= cost && (ship.level || 1) < 5) {
                            gameState.credits -= cost;
                            ship.upgradeLevel();
                            this.updateStationScreen(gameState);
                        }
                    }
                });
            });
        });

        document.querySelectorAll('[data-buy-item-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!currentShip) return;
                const itemId = btn.dataset.buyItemId;
                const cost = Number(btn.dataset.buyItemCost);
                const item = (CONSTANTS.ITEMS || []).find(i => i.id === itemId);
                if (!item || gameState.credits < cost) return;
                const inv = currentShip.inventory || (currentShip.inventory = []);
                const cap = currentShip.cargoCapacity || 1;
                if (inv.length >= cap) return;
                this.showConfirmModal({
                    title: 'Buy Item',
                    lines: [
                        `<strong>${item.name}</strong> → ${currentShip.name}`,
                        item.desc,
                        `Cargo: ${inv.length}/${cap} (will be ${inv.length + 1}/${cap})`,
                        `Cost: ${cost} credits`,
                    ],
                    creditsBefore: gameState.credits,
                    creditsAfter: gameState.credits - cost,
                    onConfirm: () => {
                        if (gameState.credits < cost) return;
                        const inv2 = currentShip.inventory || (currentShip.inventory = []);
                        if (inv2.length >= (currentShip.cargoCapacity || 1)) return;
                        gameState.credits -= cost;
                        inv2.push(itemId);
                        this.updateStationScreen(gameState);
                    }
                });
            });
        });

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
                const rawOffer = this.currentModuleOffer ? this.currentModuleOffer[offerIdx] : null;
                if (!rawOffer) return;
                const offer     = rawOffer;
                const moduleDef = offer.moduleDef;
                const quality   = offer.quality;
                const cost      = this._discountedCost(offer.cost, gameState);

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

                const qualColor = quality >= 1.1 ? '#00ff88' : quality <= 0.9 ? '#ff8888' : '#ffdd44';
                const extraHtml = `
                    <div class="modal-stat-block">
                        <div class="modal-stat-ship-label">${s.name} &nbsp;·&nbsp; ${s.shipType} &nbsp;·&nbsp; slot ${s.modules.length + 1}/${s.moduleSlots}</div>
                        <div style="font-size:0.82em;color:${qualColor};margin-bottom:0.3em;">Quality: ×${quality.toFixed(2)}</div>
                        ${statRow('Hull',    `${s.hull}/${s.maxHull}`,       undefined)}
                        ${statRow('Shields', `${s.shields}/${s.maxShields}`, undefined)}
                        ${statRow('Laser',   s.laserDamage,                  undefined)}
                        ${statRow('Engine',  s.engine,                       undefined)}
                        ${statRow('Radar',   s.radar,                        undefined)}
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
};

UISystem.showConfirmModal = function({ title, lines, creditsBefore, creditsAfter, extraHtml = '', onConfirm }) {
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
};

UISystem.generateNewShipStats = function() {
        const available = CONSTANTS.SHIP_TYPES.filter(t => !t.internal);
        const typeData  = available[Math.floor(Math.random() * available.length)];
        const S = CONSTANTS.SHIP_STATS;
        return {
            hull:    Math.max(1, Math.round((S.HULL_MIN    + S.HULL_MAX)    / 2 * typeData.hullMult)),
            shields: Math.max(0, Math.round((S.SHIELDS_MIN + S.SHIELDS_MAX) / 2 * typeData.shieldMult)),
            laser:   Math.max(1, Math.round((S.LASER_MIN   + S.LASER_MAX)   / 2 * typeData.laserMult)),
            radar:   Math.max(1, Math.round((S.RADAR_MIN   + S.RADAR_MAX)   / 2 * typeData.radarMult)),
            engine:  Math.max(5, Math.round((S.ENGINE_MIN  + S.ENGINE_MAX)  / 2 * typeData.engineMult)),
            type: typeData.type,
        };
};
