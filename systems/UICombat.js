// UI combat screen — extends UISystem
// Loaded after UI.js

UISystem.updateCombatScreen = function(gameState, combat) {
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
            if (isPlayerTurn && activeTurnShip && activeTurnShip.isDrone) {
                actionsHtml = `<p style="color:#ffaa44;font-size:0.85em;text-align:center;margin-top:0.5em;">Drone acting...</p>`;
            } else if (isPlayerTurn && activeTurnShip && (activeTurnShip.berserkTurns || 0) > 0) {
                actionsHtml = `<p style="color:#ff88ff;font-size:0.85em;text-align:center;margin-top:0.5em;">Berserk — out of control! (${activeTurnShip.berserkTurns}t remaining)</p>`;
            } else if (isPlayerTurn && activeTurnShip && activeTurnShip.alive) {
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
                } else if (!isAnimating && mode === 'bomb') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff8844;font-size:0.8em;margin-top:0.5em;text-align:center;">Click within the targeting circle to plant a bomb — detonates after 2 turns, blasting all ships in radius</p>`;
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
                        <p style="color:#44eeff;font-size:0.8em;margin-top:0.5em;text-align:center;">Click within the targeting circle to fire EMP — damages shields and locks abilities on all ships in the blast radius</p>`;
                } else if (!isAnimating && mode === 'repair_beam') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                            <button id="combatConfirmRepairBtn" class="btn-primary">Repair</button>
                        </div>
                        <p style="color:#00ff88;font-size:0.8em;margin-top:0.5em;text-align:center;">Repair beam fires in the forward green cone — restores hull on all allies in range. Click anywhere or Repair to confirm.</p>`;
                } else if (!isAnimating && mode === 'supercharge') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ffdd00;font-size:0.8em;margin-top:0.5em;text-align:center;">Click an allied ship in the yellow forward cone to supercharge them — restores shields and gives 2× stats for 1 turn</p>`;
                } else if (!isAnimating && mode === 'flash') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ffff44;font-size:0.8em;margin-top:0.5em;text-align:center;">Click anywhere within the yellow circle — flash blinds all ships in the blast radius for 2 turns</p>`;
                } else if (!isAnimating && mode === 'possess') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff44ff;font-size:0.8em;margin-top:0.5em;text-align:center;">Click any ship within the magenta circle to possess — target goes berserk for 2 turns, attacking friend and foe alike</p>`;
                } else if (!isAnimating && mode === 'webbing') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#00ccaa;font-size:0.8em;margin-top:0.5em;text-align:center;">Click within the teal circle — web blasts all ships in the area, halving their movement speed for 3 turns</p>`;
                } else if (!isAnimating && mode === 'timeslip') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#88aaff;font-size:0.8em;margin-top:0.5em;text-align:center;">Click any ship in the blue circle — records its state now, resets it in 2 turns</p>`;
                } else if (!isAnimating && mode === 'salvage') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#00ff88;font-size:0.8em;margin-top:0.5em;text-align:center;">Click a destroyed allied ship to salvage it — restores full hull and brings it back to the fight</p>`;
                } else if (!isAnimating && mode === 'neutralize') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ccff66;font-size:0.8em;margin-top:0.5em;text-align:center;">Click within the forward targeting circle — strips all status effects from ships in the blast and disperses clouds</p>`;
                } else if (!isAnimating && mode === 'mark') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff8800;font-size:0.8em;margin-top:0.5em;text-align:center;">Click any ship in the orange cone to mark it — all laser shots auto-hit for 3 turns</p>`;
                } else if (!isAnimating && mode === 'debris_field') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                            <button id="combatConfirmDebrisBtn" class="btn-primary">Launch</button>
                        </div>
                        <p style="color:#cc8844;font-size:0.8em;margin-top:0.5em;text-align:center;">Click anywhere or Launch to hurl 3–5 rocks in the forward cone</p>`;
                } else if (!isAnimating && mode === 'chaingun') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff8800;font-size:0.8em;margin-top:0.5em;text-align:center;">Click an enemy in range — fires 5 rounds, each hits independently, bypasses shields</p>`;
                } else if (!isAnimating && mode === 'plasma_cannon') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#88ffaa;font-size:0.8em;margin-top:0.5em;text-align:center;">Click an enemy in range (75%) — slow round drains shields 1.5× faster</p>`;
                } else if (!isAnimating && mode === 'rocket_launcher') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff6633;font-size:0.8em;margin-top:0.5em;text-align:center;">Click within the targeting circle — guaranteed hit blast damages all ships in radius</p>`;
                } else if (!isAnimating && mode === 'anchor') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#6699ff;font-size:0.8em;margin-top:0.5em;text-align:center;">Click any ship in the forward cone — locks it in place for 2 turns, immune to knockback</p>`;
                } else if (!isAnimating && mode === 'siphon') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#bb66ff;font-size:0.8em;margin-top:0.5em;text-align:center;">Click any ship within the circle — drains 5–10 shields and adds 1 to all its cooldowns</p>`;
                } else if (!isAnimating && mode === 'swap') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#bb88ff;font-size:0.8em;margin-top:0.5em;text-align:center;">Click any ship within 80px — instantly swap positions</p>`;
                } else if (!isAnimating && mode === 'absorb') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff8844;font-size:0.8em;margin-top:0.5em;text-align:center;">Drains hull from all ships in the circle — cannot reduce below 1</p>`;
                } else if (!isAnimating && mode === 'ravager') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#ff4422;font-size:0.8em;margin-top:0.5em;text-align:center;">Click an enemy in range — shorter-range beam that heals you by hull damage dealt</p>`;
                } else if (!isAnimating && mode === 'stasis_field') {
                    actionsHtml = `
                        <div class="combat-action-row">
                            <button id="combatCancelModeBtn" class="btn-secondary">Cancel</button>
                        </div>
                        <p style="color:#88eeff;font-size:0.8em;margin-top:0.5em;text-align:center;">Click within range to deploy a stasis cloud — ships inside cannot act or take damage</p>`;
                } else {
                    const overheated = activeTurnShip.statusEffect === 'plasma';
                    const blinded    = (activeTurnShip.blindedTurns || 0) > 0;
                    const anchored   = (activeTurnShip.anchoredTurns || 0) > 0;
                    const inStasis   = (activeTurnShip.stasisTurns  || 0) > 0;
                    const hasStatus  = !!activeTurnShip.statusEffect;
                    const dis     = !hasActions || isAnimating || inStasis ? 'disabled' : '';
                    const moveDis = !hasActions || isAnimating || anchored || inStasis ? 'disabled' : '';
                    const fireDis = !hasActions || !hasValidTargets || isAnimating || overheated || blinded || inStasis ? 'disabled' : '';

                    // Special move buttons — one per move the ship has
                    const WEAPON_MOVES = new Set(['chaingun', 'plasma_cannon', 'rocket_launcher']);
                    const cooldowns = activeTurnShip.specialMoveCooldowns || {};
                    const weaponMove = (activeTurnShip.specialMoves || []).find(id => WEAPON_MOVES.has(id));

                    const makeSpecialBtn = (moveId) => {
                        const moveDef = CONSTANTS.SPECIAL_MOVES[moveId];
                        if (!moveDef) return '';
                        const cd = cooldowns[moveId] || 0;
                        const onCd          = cd > 0;
                        const cloakBlocked  = moveId === 'cloak' && hasStatus;
                        const flashBlocked  = moveId === 'flash' && blinded;
                        const anchorBlocked = anchored && ['afterburner', 'blink', 'swap', 'teleport'].includes(moveId);
                        const stasisBlocked = inStasis;
                        const btnDis = onCd || !hasActions || isAnimating || overheated || cloakBlocked || flashBlocked || anchorBlocked || stasisBlocked ? 'disabled' : '';
                        const label  = onCd ? `${moveDef.name} (${cd})` : moveDef.name;
                        const color  = onCd || overheated || cloakBlocked || flashBlocked || anchorBlocked || stasisBlocked ? '#555' : '#cc99ff';
                        return `<button class="btn-primary combat-special-btn" ${btnDis} data-move-id="${moveId}" style="color:${color};" data-tooltip="${moveDef.desc}">${label}</button>`;
                    };

                    const specialBtns = (activeTurnShip.specialMoves || [])
                        .filter(id => !WEAPON_MOVES.has(id))
                        .map(makeSpecialBtn).join('');

                    let fireOrWeaponBtn;
                    if (weaponMove) {
                        fireOrWeaponBtn = makeSpecialBtn(weaponMove);
                    } else {
                        fireOrWeaponBtn = `<button id="combatFireBtn" class="btn-primary" ${fireDis} data-tooltip="Fire lasers at an enemy within range and firing arc.">Fire</button>`;
                    }

                    const rechargeTooltip = inStasis ? 'In stasis — cannot act.' :
                        (activeTurnShip.maxShields > 0 && activeTurnShip.shields >= activeTurnShip.maxShields
                        ? 'Pass your turn without acting.'
                        : 'Skip your turn to recharge shields.');
                    actionsHtml = `
                        <div style="text-align:center;font-size:0.8em;color:#aaa;margin-bottom:0.25em;">Actions: ${activeTurnShip.actionsRemaining}/2${inStasis ? ' <span style="color:#88eeff">[STASIS]</span>' : ''}</div>
                        <div class="combat-action-row">
                            <button id="combatMoveBtn" class="btn-primary" ${moveDis} data-tooltip="${anchored ? 'Cannot move — anchored!' : inStasis ? 'Cannot act — in stasis!' : 'Move your ship within range, or click an adjacent enemy to ram.'}">Move${anchored ? ' [Anchored]' : ''}</button>
                            ${fireOrWeaponBtn}
                            <button id="combatSkipBtn" class="btn-secondary" ${dis} data-tooltip="${rechargeTooltip}">${rechargeLabel}</button>
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
};

UISystem.setupCombatButtons = function(gameState, combat, activeTurnShip) {
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

        const confirmRepairBtn = document.getElementById('combatConfirmRepairBtn');
        if (confirmRepairBtn) {
            confirmRepairBtn.onclick = () => {
                if (activeTurnShip && activeTurnShip.alive && activeTurnShip.actionsRemaining > 0) {
                    combat.playerRepairBeam(activeTurnShip);
                }
            };
        }

        const confirmDebrisBtn = document.getElementById('combatConfirmDebrisBtn');
        if (confirmDebrisBtn) {
            confirmDebrisBtn.onclick = () => {
                if (activeTurnShip && activeTurnShip.alive && activeTurnShip.actionsRemaining > 0) {
                    combat.playerDebrisField(activeTurnShip);
                }
            };
        }

        document.querySelectorAll('.combat-special-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const moveId = btn.dataset.moveId;
                const activeShip = combat.playerShips[combat.currentShipIndex];
                if (moveId === 'cloak') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerCloak(activeShip);
                    }
                } else if (moveId === 'summon_drone') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerSummonDrone(activeShip);
                    }
                } else if (moveId === 'phase') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerPhase(activeShip);
                    }
                } else if (moveId === 'doom') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerDoom(activeShip);
                    }
                } else if (moveId === 'teleport') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerTeleport(activeShip);
                    }
                } else if (moveId === 'summon_mirror') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerSummonMirror(activeShip);
                    }
                } else if (moveId === 'absorb') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerAbsorb(activeShip);
                    }
                } else if (moveId === 'swarm') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerSwarm(activeShip);
                    }
                } else if (moveId === 'frenzy') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerFrenzy(activeShip);
                    }
                } else if (moveId === 'torpedo') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerTorpedo(activeShip);
                    }
                } else if (moveId === 'gamma_ray') {
                    if (activeShip && activeShip.alive && activeShip.actionsRemaining > 0) {
                        combat.playerGammaRay(activeShip);
                    }
                } else {
                    // Don't enter targeting mode while frenzied
                    if (activeShip && (activeShip.frenzyTurns || 0) > 0) return;
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
};
    
UISystem.showGameOver = function(won, message = '') {
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
};
