// UI System
class UISystem {
    static stationTab = 'shipyard';
    static combatTab = 'actions';
    static currentStationOffer = null;
    static currentModuleOffer = null;
    static selectedOfferIndex = 0;
    static _travelLoopRunning = false;
    static _travelStars = null;

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
        document.getElementById('currentSystem').textContent = `Current Station: ${currentSystemName}`;

        this.updatePlayerStatusPanel(gameState);
        this.updateCurrentSystemSection(gameState);
        this.updateSelectedSystemSection(gameState);

        if (galaxyRenderer && gameState.systems) {
            galaxyRenderer.render(gameState.systems, gameState.currentSystem);
            galaxyRenderer.startLoop();
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
        if ((ship.dustTurns   || 0) > 0) badges.push('<span class="status-badge status-dusty" data-tooltip="Asteroid dust — shots against this ship have an extra 50% miss chance.">Dusty</span>');
        if ((ship.iceTurns    || 0) > 0) badges.push('<span class="status-badge status-frozen" data-tooltip="Ice cloud — movement speed halved, incoming non-laser damage halved.">Frozen</span>');
        if ((ship.plasmaTurns || 0) > 0) badges.push('<span class="status-badge status-overheated" data-tooltip="Plasma cloud — cannot fire lasers; shield regen doubled on skip.">Overheated</span>');
        if ((ship.blindedTurns || 0) > 0)      badges.push(`<span class="status-badge status-blinded" data-tooltip="Flash-blinded — cannot fire for ${ship.blindedTurns} more turn${ship.blindedTurns !== 1 ? 's' : ''}.">Blinded (${ship.blindedTurns}t)</span>`);
        if ((ship.superchargedTurns || 0) > 0) badges.push(`<span class="status-badge" style="background:#aa8800;color:#ffe066;" data-tooltip="Supercharged — 2x move range, laser damage, and laser range for ${ship.superchargedTurns} more turn${ship.superchargedTurns !== 1 ? 's' : ''}.">Supercharged</span>`);
        if ((ship.berserkTurns || 0) > 0)      badges.push(`<span class="status-badge" style="background:#880088;color:#ff88ff;" data-tooltip="Hacked and berserk — randomly attacks any nearby ship for ${ship.berserkTurns} more turn${ship.berserkTurns !== 1 ? 's' : ''}.">Berserk (${ship.berserkTurns}t)</span>`);
        if ((ship.markedTurns || 0) > 0)       badges.push(`<span class="status-badge" style="background:#883300;color:#ff8800;" data-tooltip="Marked target — all laser shots auto-hit for ${ship.markedTurns} more turn${ship.markedTurns !== 1 ? 's' : ''}.">Marked (${ship.markedTurns}t)</span>`);
        if ((ship.webTurns || 0) > 0)           badges.push(`<span class="status-badge" style="background:#005544;color:#00ccaa;" data-tooltip="Webbed — movement speed halved for ${ship.webTurns} more turn${ship.webTurns !== 1 ? 's' : ''}.">Webbed (${ship.webTurns}t)</span>`);
        if ((ship.frenzyTurns || 0) > 0)        badges.push(`<span class="status-badge" style="background:#880022;color:#ff2244;" data-tooltip="Frenzied — +1 action per turn but loses 1 hull per turn for ${ship.frenzyTurns} more turn${ship.frenzyTurns !== 1 ? 's' : ''}.">Frenzied (${ship.frenzyTurns}t)</span>`);
        if ((ship.timeslipTurns || 0) > 0)      badges.push(`<span class="status-badge" style="background:#002266;color:#88aaff;" data-tooltip="Time-slipped — state resets in ${ship.timeslipTurns} more turn${ship.timeslipTurns !== 1 ? 's' : ''}.">Slipped (${ship.timeslipTurns}t)</span>`);
        if (ship.cloaked)                       badges.push('<span class="status-badge status-cloaked" data-tooltip="Cloaked — invisible to lasers and ramming. Revealed by damage or using an ability.">Cloaked</span>');
        if (ship.isDrone)                       badges.push(`<span class="status-badge status-drone" data-tooltip="Combat drone — acts independently each turn, expires after ${ship.droneLifetime ?? '?'} more turn${(ship.droneLifetime ?? 0) !== 1 ? 's' : ''}.">Drone (${ship.droneLifetime ?? '?'}t)</span>`);
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
        const { selectable = false, showStats = false, selectedShip = null, activeShip = null, bars = true, isEnemy = false } = options;

        const extraHeaders = showStats ? '<th data-tooltip-title="Laser" data-tooltip-body="Base damage per shot. Scales laser range.">LZR</th><th data-tooltip-title="Engine" data-tooltip-body="Movement range per action and ram damage.">ENG</th><th data-tooltip-title="Radar" data-tooltip-body="Shot accuracy and maximum firing range.">RDR</th>' : '';

        const rows = ships.map((ship, i) => {
            const hullPct = ship.hull / ship.maxHull;
            const hullColor = hullPct > 0.5 ? '#00ffff' : hullPct > 0.25 ? '#ffff00' : '#ff3333';
            const isSelected  = selectedShip && ship === selectedShip;
            const isActive    = activeShip   && ship === activeShip;
            const isDead = !ship.alive;
            const isFled = ship.fled && ship.alive;

            const nameLabel = ship.name || String(i + 1);
            const levelLabel = (ship.level && ship.level > 1) ? ` <span style="color:#ffdd44;font-size:0.75em;">Lv${ship.level}</span>` : '';
            const typeDesc = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType)?.description || '';
            const tipAttr  = typeDesc ? ` data-tooltip="${typeDesc}"` : '';
            const numCell = isDead
                ? `<span style="color:#ff3333;"${tipAttr}>${nameLabel}</span>${levelLabel}`
                : isFled
                ? `<span style="color:#ffaa44;"${tipAttr}>${nameLabel} (fled)</span>${levelLabel}`
                : `<span style="cursor:help;"${tipAttr}>${nameLabel}</span>${levelLabel}`;

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

            const classes = ['ship-table-row', isActive ? 'active-turn' : (isSelected ? 'selected' : ''), isDead ? 'destroyed' : '']
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
            <thead><tr><th>Ship</th><th data-tooltip-title="Hull" data-tooltip-body="Hit points — ship is destroyed at 0.">Hull</th><th data-tooltip-title="Shields" data-tooltip-body="Absorb damage before hull. Recharge by skipping a turn.">Shield</th>${extraHeaders}</tr></thead>
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
            <thead><tr><th>Ship</th><th data-tooltip-title="Hull" data-tooltip-body="Hit points — ship is destroyed at 0.">Hull</th><th data-tooltip-title="Shields" data-tooltip-body="Absorb damage before hull. Recharge by skipping a turn.">Shield</th><th data-tooltip-title="Laser" data-tooltip-body="Base damage per shot. Scales laser range.">LZR</th><th data-tooltip-title="Engine" data-tooltip-body="Movement range per action and ram damage.">ENG</th><th data-tooltip-title="Radar" data-tooltip-body="Shot accuracy and maximum firing range.">RDR</th><th>Cost</th><th data-tooltip="Net cost after trading in your selected ship.">Net</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    static renderPlayerStatusHtml(gameState, tableOptions = {}) {
        const bounty = gameState.bounty || 0;
        const bountyHtml = bounty > 0
            ? `<p style="color:#ff4444;font-weight:bold;">Bounty: ${bounty} cr</p>`
            : '';
        const fame = gameState.fame || 0;
        const fameColor = fame > 0 ? '#44ff88' : fame < 0 ? '#ff6644' : '#aaa';
        const fameSign = fame > 0 ? '+' : '';
        const fameHtml = `<p>Fame: <span style="color:${fameColor};font-weight:${fame !== 0 ? 'bold' : 'normal'};">${fameSign}${fame}</span></p>`;
        const contracts = gameState.contracts || 0;
        const contractsHtml = contracts > 0
            ? `<p>Contracts: <span style="color:#44ffdd;font-weight:bold;">${contracts}</span></p>`
            : '';
        const day = Math.round(gameState.day || 1);
        const playerFactionData = gameState.playerFaction && typeof PLAYER_FACTIONS !== 'undefined'
            ? PLAYER_FACTIONS.find(f => f.id === gameState.playerFaction) : null;
        const factionHtml = playerFactionData
            ? `<p>Faction: <span style="color:${playerFactionData.color};font-weight:bold;">${playerFactionData.name}</span></p>`
            : '';
        const nameHtml = gameState.playerName && gameState.playerName !== 'Commander'
            ? `<p style="color:#ccc;">Cmdr ${gameState.playerName}</p>`
            : '';

        // Commander level / EXP bar
        const exp   = gameState.exp || 0;
        const level = commanderLevel(exp);
        const prog  = expProgress(exp);
        const expBarHtml = prog.needed !== null
            ? (() => {
                const pct = Math.min(100, (prog.current / prog.needed) * 100).toFixed(1);
                return `<div style="margin:0.2em 0 0.1em;">
                    <div style="font-size:0.8em;color:#aaff44;margin-bottom:2px;">Lv ${level} &nbsp;·&nbsp; ${prog.current}/${prog.needed} EXP</div>
                    <div style="height:4px;background:#222;border-radius:2px;">
                        <div style="width:${pct}%;height:100%;background:#aaff44;border-radius:2px;"></div>
                    </div>
                </div>`;
              })()
            : `<div style="font-size:0.8em;color:#aaff44;margin:0.2em 0;">Lv ${level} &nbsp;·&nbsp; Max Level</div>`;

        const pendingPerkPoints = level - (gameState.perks || []).length;
        const levelUpBtnHtml = pendingPerkPoints > 0
            ? `<button id="openPerksBtn" class="btn-primary" style="width:100%;margin-top:0.3em;font-size:0.8em;padding:0.3em 0.6em;">Level Up! (${pendingPerkPoints} point${pendingPerkPoints > 1 ? 's' : ''} available)</button>`
            : `<button id="openPerksBtn" class="btn-secondary" style="width:100%;margin-top:0.3em;font-size:0.8em;padding:0.3em 0.6em;">Commander Perks</button>`;

        return `<div class="header-3">Player Status</div>
                ${nameHtml}
                <p>Credits: ${gameState.credits} &nbsp;·&nbsp; <span style="color:#aaa;">Day ${day}</span></p>
                ${factionHtml}
                ${fameHtml}
                ${bountyHtml}
                ${contractsHtml}
                ${expBarHtml}
                ${levelUpBtnHtml}
                ${this.renderShipTable(gameState.playerShips, tableOptions)}`;
    }

    static updatePlayerStatusPanel(gameState) {
        const el = document.getElementById('playerStatusPanel');
        if (!el) return;
        el.innerHTML = this.renderPlayerStatusHtml(gameState);
        const btn = document.getElementById('openPerksBtn');
        if (btn) btn.onclick = () => GameController.openPerksScreen();
    }

    static updatePerksScreen(gameState) {
        // Sidebar
        const sidebar = document.getElementById('perksPlayerPanel');
        if (sidebar) sidebar.innerHTML = this.renderPlayerStatusHtml(gameState);
        const sideBtn = sidebar ? sidebar.querySelector('#openPerksBtn') : null;
        if (sideBtn) sideBtn.style.display = 'none';

        const exp   = gameState.exp || 0;
        const level = commanderLevel(exp);
        const prog  = expProgress(exp);
        const perks = gameState.perks || [];
        const spentPoints = perks.length;
        const availablePoints = level - spentPoints;

        const expBarHtml = prog.needed !== null
            ? (() => {
                const pct = Math.min(100, (prog.current / prog.needed) * 100).toFixed(1);
                return `<div style="margin-bottom:0.5em;">
                    <div style="font-size:0.9em;color:#aaff44;margin-bottom:4px;">
                        Commander Level ${level} &nbsp;·&nbsp; ${prog.current} / ${prog.needed} EXP to Level ${level + 1}
                    </div>
                    <div style="height:8px;background:#222;border-radius:4px;">
                        <div style="width:${pct}%;height:100%;background:#aaff44;border-radius:4px;transition:width 0.3s;"></div>
                    </div>
                </div>`;
              })()
            : `<div style="color:#aaff44;margin-bottom:0.5em;">Commander Level ${level} — Maximum Level Reached</div>`;

        const pointsHtml = availablePoints > 0
            ? `<div style="color:#ffdd44;font-weight:bold;margin-bottom:0.75em;">Unspent Perk Points: ${availablePoints}</div>`
            : `<div style="color:#666;margin-bottom:0.75em;">No perk points available — earn more EXP in combat.</div>`;

        const perkRows = (CONSTANTS.PERKS || []).map(perk => {
            const owned = perks.includes(perk.id);
            const prereqMet = !perk.requires || perks.includes(perk.requires);
            const canBuy = !owned && prereqMet && availablePoints > 0;
            const statusLabel = owned
                ? `<span style="color:#00ff88;font-weight:bold;">Unlocked</span>`
                : (!prereqMet ? `<span style="color:#555;">Locked</span>` : '');

            return `<tr>
                <td style="white-space:nowrap;color:${owned ? '#00ff88' : prereqMet ? '#eee' : '#666'};">${perk.name}</td>
                <td style="color:#aaa;font-size:0.9em;">${perk.desc}</td>
                <td style="text-align:center;">${perk.fleetSize} ships</td>
                <td style="text-align:right;">${statusLabel}</td>
                <td>${canBuy ? `<button class="btn-primary btn-sm" data-buy-perk="${perk.id}">Unlock (1 pt)</button>` : ''}</td>
            </tr>`;
        }).join('');

        document.getElementById('perksContent').innerHTML = `
            <div class="station-section">
                ${expBarHtml}
                ${pointsHtml}
                <div class="header-3" style="margin-bottom:0.4em;">Leadership Perks</div>
                <p style="color:#aaa;font-size:0.88em;margin-bottom:0.5em;">
                    Each leadership perk costs 1 perk point and expands your maximum fleet size by 1.
                </p>
                <table class="ship-status-table" style="width:100%;">
                    <thead><tr><th>Perk</th><th>Description</th><th>Fleet Size</th><th>Status</th><th></th></tr></thead>
                    <tbody>${perkRows}</tbody>
                </table>
            </div>`;

        document.querySelectorAll('[data-buy-perk]').forEach(btn => {
            btn.addEventListener('click', () => {
                const perkId = btn.dataset.buyPerk;
                const perkDef = (CONSTANTS.PERKS || []).find(p => p.id === perkId);
                if (!perkDef) return;
                const gs = gameState;
                const level2 = commanderLevel(gs.exp || 0);
                const spent  = (gs.perks || []).length;
                if (level2 - spent <= 0) return;
                const prereqOk = !perkDef.requires || (gs.perks || []).includes(perkDef.requires);
                if (!prereqOk) return;
                if ((gs.perks || []).includes(perkId)) return;
                gs.perks = [...(gs.perks || []), perkId];
                this.updatePerksScreen(gs);
            });
        });
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
        currentActions.innerHTML = `<button id="showSystemButton" class="btn-primary">Visit Station</button>`;
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
                return connected ? connected.name : null;
            }).filter(Boolean).join(', ') || 'None';
            const stationLabel = { shipyard: 'Shipyard', blackmarket: 'Black Market', mechanic: 'Mechanic', courthouse: 'Courthouse', marketplace: 'Marketplace' }[sys.stationType] || 'None';
            content.innerHTML = `
                <div class="station-section">
                    <p><strong>Status:</strong> Visited</p>
                    <p><strong>Tier:</strong> ${sys.tier}</p>
                    <p><strong>Routes forward:</strong> ${connections}</p>
                    <p><strong>Station:</strong> ${stationLabel}</p>
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

    static showTravelScreen(gameState, fromSystem, toSystem, routeData, encounters) {
        this.showScreen('travelScreen');

        const tierLabel = toSystem.isQueenPlanet ? 'Alien Queen\'s Lair' : `Tier ${toSystem.tier}`;
        document.getElementById('travelHeader').textContent = `Traveling to ${toSystem.name}`;
        document.getElementById('travelSubheader').textContent = tierLabel;
        document.getElementById('travelOriginLabel').textContent = fromSystem.name;
        document.getElementById('travelDestLabel').textContent = toSystem.name;

        const panel = document.getElementById('travelPlayerPanel');
        if (panel) panel.innerHTML = this.renderPlayerStatusHtml(gameState, { showStats: true });

        // Encounter markers
        const markersEl = document.getElementById('travelEncounterMarkers');
        if (markersEl) {
            markersEl.innerHTML = (encounters || []).map(enc => {
                const fd = CONSTANTS.FACTIONS.find(f => f.id === enc.faction);
                const color = fd ? fd.color : '#ffffff';
                const tipText = fd ? `${fd.name} encounter (${enc.size} ships)` : 'Unknown encounter';
                return `<div class="travel-encounter-marker" style="left:${enc._crossT * 100}%;border-color:${color};color:${color};" data-tooltip="${tipText}">!</div>`;
            }).join('');
        }

        // Route info
        const info = document.getElementById('travelRouteInfo');
        if (info && routeData) {
            const strLabel = routeData.fleetStrength <= 3 ? 'Low' : routeData.fleetStrength <= 6 ? 'Medium' : 'High';
            const encCount = (encounters || []).length;
            info.innerHTML = `Threat: <strong>${strLabel}</strong> (${routeData.fleetStrength}/10) &nbsp;·&nbsp; ${encCount} encounter${encCount !== 1 ? 's' : ''} on this route`;
        } else if (info) {
            info.textContent = '';
        }

        const currentProgress = (typeof galaxyRenderer !== 'undefined' && galaxyRenderer && galaxyRenderer._travelAnim)
            ? galaxyRenderer._travelAnim.progress : 0;
        this.updateTravelProgress(currentProgress);
        this.startTravelLoop();
    }

    static updateTravelProgress(progress) {
        const pct = Math.round(progress * 100);
        const fill = document.getElementById('travelProgressFill');
        if (fill) fill.style.width = pct + '%';
        const ship = document.getElementById('travelShipMarker');
        if (ship) ship.style.left = pct + '%';
        const label = document.getElementById('travelProgressPct');
        if (label) label.textContent = pct + '%';
    }

    static startTravelLoop() {
        if (this._travelLoopRunning) return;
        this._travelLoopRunning = true;
        const tick = () => {
            if (!this._travelLoopRunning || typeof gameState === 'undefined' || gameState.state !== GAME_STATE.TRAVEL) {
                this._travelLoopRunning = false;
                return;
            }
            this._renderTravelCanvas();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    static _renderTravelCanvas() {
        const canvas = document.getElementById('travelCanvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
            canvas.width  = Math.round(rect.width);
            canvas.height = Math.round(rect.height);
            this._travelStars = null; // regenerate for new size
        }
        if (!this._travelStars) {
            this._travelStars = Array.from({ length: 200 }, () => ({
                x: Math.random(), y: Math.random(),
                b: Math.floor(140 + Math.random() * 116),
            }));
        }

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Starry background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        this._travelStars.forEach(s => {
            ctx.fillStyle = `rgb(${s.b},${s.b},${s.b})`;
            ctx.fillRect(Math.round(s.x * w), Math.round(s.y * h), 1, 1);
        });
        ctx.strokeStyle = '#334466';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, w, h);

        const progress = (typeof galaxyRenderer !== 'undefined' && galaxyRenderer && galaxyRenderer._travelAnim)
            ? galaxyRenderer._travelAnim.progress : 0;
        const tss = typeof _travelScreenState !== 'undefined' ? _travelScreenState : null;

        const margin = 72;
        const trackY = Math.round(h * 0.48);
        const fromX  = margin;
        const toX    = w - margin;
        const shipX  = fromX + (toX - fromX) * progress;

        // Dashed route line
        ctx.strokeStyle = '#1a2a3a';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 9]);
        ctx.beginPath();
        ctx.moveTo(fromX, trackY);
        ctx.lineTo(toX, trackY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Traveled portion glow
        if (progress > 0.005) {
            const grad = ctx.createLinearGradient(fromX, 0, shipX, 0);
            grad.addColorStop(0, 'rgba(0,200,80,0.04)');
            grad.addColorStop(1, 'rgba(0,255,120,0.18)');
            ctx.fillStyle = grad;
            ctx.fillRect(fromX, trackY - 2, shipX - fromX, 4);
        }

        // Origin system
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(fromX, trackY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Destination system
        const isQueen = tss && tss.to && tss.to.isQueenPlanet;
        ctx.fillStyle = isQueen ? '#ff4400' : '#888';
        ctx.beginPath();
        ctx.arc(toX, trackY, 8, 0, Math.PI * 2);
        ctx.fill();
        if (isQueen) {
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 380);
            ctx.strokeStyle = `rgba(255,68,0,${pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(toX, trackY, 14, 0, Math.PI * 2);
            ctx.stroke();
        }

        // System name labels
        const labelY = trackY + 26;
        ctx.font = '11px Courier New';
        ctx.textAlign = 'center';
        if (tss) {
            ctx.fillStyle = '#888';
            ctx.fillText(tss.from.name, fromX, labelY);
            ctx.fillStyle = isQueen ? '#ff8844' : '#bbb';
            ctx.fillText(tss.to.name, toX, labelY);
        }
        ctx.textAlign = 'left';

        // Exhaust trail
        if (progress > 0.01) {
            const trailLen = Math.min(100, (shipX - fromX) * 0.55);
            const exGrad = ctx.createLinearGradient(shipX - trailLen, 0, shipX, 0);
            exGrad.addColorStop(0, 'rgba(0,255,136,0)');
            exGrad.addColorStop(1, 'rgba(0,255,136,0.22)');
            ctx.fillStyle = exGrad;
            ctx.fillRect(shipX - trailLen, trackY - 4, trailLen, 8);
        }

        // Ship sprite / polygon
        const leaderShip = typeof gameState !== 'undefined'
            ? gameState.playerShips.find(s => s.alive) : null;
        const typeData = leaderShip
            ? CONSTANTS.SHIP_TYPES.find(t => t.type === leaderShip.shipType) : null;
        const verts    = typeData ? typeData.vertices
            : [[2.2, 0], [0.2, -1.0], [-0.6, -1.4], [-1.2, -0.4], [-1.2, 0.4], [-0.6, 1.4], [0.2, 1.0]];
        const spriteId  = leaderShip ? leaderShip.shipType.toLowerCase().replace(/ /g, '_') : null;
        const spriteImg = (typeof spriteSystem !== 'undefined' && spriteId)
            ? spriteSystem.getImage(spriteId) : null;
        const sizeMult  = typeData?.sizeMult ?? 1;
        const S         = 20 * sizeMult;

        ctx.save();
        ctx.translate(shipX, trackY);
        if (spriteImg) {
            const sw = S * 5;
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(spriteImg, -sw / 2, -sw / 2, sw, sw);
        } else {
            ctx.fillStyle = '#cccccc';
            drawShipShape(ctx, verts, S);
            ctx.fill();
        }
        ctx.restore();
    }

    static updateSelectedRouteSection(gameState, route) {
        const section = document.getElementById('selectedRouteSection');
        if (!section) return;
        if (!route) { section.style.display = 'none'; return; }

        section.style.display = '';
        const routeData = gameState.routes ? gameState.routes.get(route.routeKey) : null;
        document.getElementById('selectedRouteName').textContent = `${route.from.name} → ${route.to.name}`;

        const info = document.getElementById('selectedRouteInfo');
        if (info && routeData) {
            const tierLabel = route.to.isQueenPlanet ? 'Alien Queen\'s Lair' : `Tier ${route.to.tier}`;
            const hazards = [];
            if (routeData.hasAsteroids) hazards.push('Asteroids');
            if (routeData.cloudType) hazards.push(`${routeData.cloudType.charAt(0).toUpperCase() + routeData.cloudType.slice(1)} clouds`);
            const hazardLine = hazards.length ? `<span style="color:#ffcc44;">${hazards.join(', ')}</span>` : '<span style="color:#555;">None</span>';
            info.innerHTML = `<p style="color:#aaa;font-size:0.85em;margin:0.2em 0;">${tierLabel}</p>
                <p style="color:#aaa;font-size:0.85em;margin:0.2em 0;">1–${routeData.maxEncounters} encounters</p>
                <p style="font-size:0.85em;margin:0.3em 0 0;">Hazards: ${hazardLine}</p>`;
        } else if (info) {
            info.innerHTML = '<p style="color:#555;font-size:0.85em;">No route data.</p>';
        }

        const actions = document.getElementById('selectedRouteActions');
        if (actions) {
            const isPlayerRoute = gameState.currentSystem
                && gameState.currentSystem.id === route.from.id
                && gameState.currentSystem.connections.includes(route.to.id);
            actions.innerHTML = isPlayerRoute
                ? `<button id="travelRouteBtn" class="btn-primary">Travel</button>`
                : '';
            const btn = document.getElementById('travelRouteBtn');
            if (btn) btn.onclick = () => GameController.travelToSystem(route.to);
        }
    }

}
