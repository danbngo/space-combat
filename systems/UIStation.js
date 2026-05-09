// UI station screen — extends UISystem
// Loaded after UI.js

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

        // Single-tab station: show only the tab matching the current system's stationType
        const sys = gameState.currentSystem;
        const stationType = sys && sys.stationType;  // 'shipyard' | 'mechanic' | 'courthouse'

        // Map stationType → which tab element is active
        const tabIdMap = { shipyard: 'shipyardTab', mechanic: 'modulesTab', courthouse: 'courthouseTab' };
        const activeTabId = tabIdMap[stationType] || 'shipyardTab';

        // Always force the tab to match the station type
        this.stationTab = stationType === 'mechanic' ? 'modules'
                        : stationType === 'courthouse' ? 'courthouse'
                        : 'shipyard';

        // Hide unused tabs; show only the matching one
        ['orbitTab', 'dockTab', 'shipyardTab', 'modulesTab', 'courthouseTab'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === activeTabId) ? '' : 'none';
        });
        document.querySelectorAll('.station-tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.id === activeTabId);
        });

        let contentHtml = '';
        if (this.stationTab === 'shipyard') {
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
                    return m ? `<span style="color:#cc99ff;background:#1a0033;padding:1px 6px;border-radius:3px;margin-right:4px;cursor:help;" data-tooltip="${m.desc}">${m.name}</span>` : id;
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
};

UISystem.setupStationButtons = function(gameState, currentShip, shipSaleValue) {
        const offer = this.currentStationOffer ? this.currentStationOffer[this.selectedOfferIndex] : null;
        const sellButton = document.getElementById('sellButton');
        const buyButton = document.getElementById('buyButton');
        const tradeButton = document.getElementById('tradeButton');

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
    
