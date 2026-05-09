// Combat turn management — extends Combat.prototype
// Loaded after Combat.js

Combat.prototype.applyStartOfTurnEffects = function(ship) {
        if (!ship || !ship.alive) return;
        if (!ship.modules || !ship.modules.some(m => m.id === 'combat_ai')) return;
        const mod = CONSTANTS.MODULES.find(m => m.id === 'combat_ai');
        if (mod && Math.random() < mod.effect.chance) {
            ship.actionsRemaining++;
            this.addLog(`${ship.name}: Combat AI fires — bonus action! (${ship.actionsRemaining} actions this turn)`);
            this.addFloatingText('+1 Action!', '#00ff88', ship.x, ship.y - 16);
        }
};

Combat.prototype.nextPlayerShip = function() {
        if (this.state !== COMBAT_STATE.PLAYER_TURN) return;

        let nextIndex = this.currentShipIndex + 1;
        while (nextIndex < this.playerShips.length && (!this.playerShips[nextIndex].alive || this.playerShips[nextIndex].isBomb || this.playerShips[nextIndex].isSwarmlet || this.playerShips[nextIndex].isTorpedo)) {
            nextIndex++;
        }

        if (nextIndex >= this.playerShips.length) {
            this.endPlayerTurn();
        } else {
            this.currentShipIndex = nextIndex;
            this.playerMode = null;
            const nextShip = this.playerShips[nextIndex];
            if (nextShip.isDrone) {
                UISystem.updateCombatScreen(gameState, this);
                setTimeout(() => this.processDroneTurn(nextShip), CONSTANTS.AI_DECISION_DELAY);
            } else if ((nextShip.berserkTurns || 0) > 0) {
                UISystem.updateCombatScreen(gameState, this);
                setTimeout(() => this.processBerserkPlayerTurn(nextShip), CONSTANTS.AI_DECISION_DELAY);
            } else if ((nextShip.stasisTurns || 0) > 0) {
                // Stasis — auto-skip this ship's turn
                this.addFloatingText('Stasis!', '#88eeff', nextShip.x, nextShip.y - 12);
                this.addLog(`${this._shipLabel(nextShip)}: cannot act — in stasis!`);
                UISystem.updateCombatScreen(gameState, this);
                setTimeout(() => this.nextPlayerShip(), CONSTANTS.AI_DECISION_DELAY);
            } else {
                this.applyStartOfTurnEffects(nextShip);
                UISystem.updateCombatScreen(gameState, this);
            }
        }
};

    // Run AI actions for a player-owned drone. Called instead of waiting for player input.
Combat.prototype.processDroneTurn = function(drone) {
        if (!drone.alive) {
            if (this.state === COMBAT_STATE.PLAYER_TURN) this.nextPlayerShip();
            return;
        }

        if (drone.actionsRemaining <= 0) {
            if (this.state === COMBAT_STATE.PLAYER_TURN) this.nextPlayerShip();
            return;
        }

        drone.actionsRemaining--;
        AISystem.decideAction(drone, this.enemyShips, this);
        UISystem.updateCombatScreen(gameState, this);
        setTimeout(() => this.processDroneTurn(drone), CONSTANTS.AI_DECISION_DELAY);
};

Combat.prototype.endPlayerTurn = function() {
        this.state = COMBAT_STATE.ENEMY_TURN;
        UISystem.updateCombatScreen(gameState, this);
        this.beginEnemyTurn();
};

Combat.prototype.beginEnemyTurn = function() {
        this.state = COMBAT_STATE.RESOLVING;
        UISystem.updateCombatScreen(gameState, this);

        setTimeout(() => {
            this.resolveEnemyActions();
        }, CONSTANTS.AI_DECISION_DELAY);
};

Combat.prototype.resolveEnemyActions = function() {
        const aliveEnemies = this.enemyShips.filter(s => s.alive);
        const self = this;

        function processShip(idx) {
            if (idx >= aliveEnemies.length) {
                self.checkCombatEnd();
                if (self.state !== COMBAT_STATE.ENDED) self.endEnemyTurn();
                return;
            }

            const ship = aliveEnemies[idx];

            function doAction() {
                if (ship.actionsRemaining <= 0) {
                    setTimeout(() => processShip(idx + 1), CONSTANTS.AI_DECISION_DELAY);
                    return;
                }
                // Stasis: cannot act
                if ((ship.stasisTurns || 0) > 0) {
                    ship.actionsRemaining = 0;
                    setTimeout(() => processShip(idx + 1), CONSTANTS.AI_DECISION_DELAY);
                    return;
                }
                ship.actionsRemaining--;
                if ((ship.berserkTurns || 0) > 0) {
                    const allTargets = [...self.playerShips, ...self.enemyShips].filter(s => s.alive && s !== ship && !s.isBomb);
                    AISystem.berserkAction(ship, allTargets, self);
                } else {
                    AISystem.decideAction(ship, self.playerShips, self);
                }
                setTimeout(doAction, CONSTANTS.AI_DECISION_DELAY);
            }

            doAction();
        }

        processShip(0);
};


Combat.prototype.checkAutoAdvance = function(ship) {
        if (ship.actionsRemaining === 0) {
            const self = this;
            setTimeout(() => {
                if (self.state === COMBAT_STATE.PLAYER_TURN) {
                    self.nextPlayerShip();
                }
            }, 500);
        }
};

Combat.prototype.moveTowardShip = function(mover, target) {
        const dist = distance(mover.x, mover.y, target.x, target.y);
        if (dist > 0) {
            mover.moveToward(target.x, target.y, mover.getMaxMoveDistance());
        }
};

Combat.prototype.addLog = function(msg) {
        this.combatLog.unshift(msg);
};

Combat.prototype.addFloatingText = function(text, color, worldX, worldY) {
        this.animations.push({
            type: 'floatingText',
            text, color,
            worldX: worldX + randomInt(-8, 8),
            worldY,
            duration: 1200,
            totalDuration: 1200
        });
};

Combat.prototype.addAnimation = function(animation) {
        if (animation.duration !== undefined && animation.totalDuration === undefined) {
            animation.totalDuration = animation.duration;
        }
        this.animations.push(animation);
};

Combat.prototype.updateAnimationTimers = function(deltaTime) {
        for (let i = this.animations.length - 1; i >= 0; i--) {
            this.animations[i].duration -= deltaTime;
            if (this.animations[i].duration <= 0) {
                this.animations.splice(i, 1);
            }
        }
};

Combat.prototype.endEnemyTurn = function() {
        // Drone lifetime countdown — just expire quietly (no explosion)
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.isDrone || !ship.alive) return;
            ship.droneLifetime--;
            if (ship.droneLifetime <= 0) {
                ship.hull = 0;
                ship.alive = false;
                this.addFloatingText('Expired', '#ffaa44', ship.x, ship.y - 12);
            } else {
                this.addFloatingText(`${ship.droneLifetime}t left`, '#ffaa44', ship.x, ship.y - 18);
            }
        });

        // Bomb countdown — detonate on expiry
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.isBomb || !ship.alive) return;
            ship.bombLifetime--;
            if (ship.bombLifetime <= 0) {
                this.performBombDetonate(ship);
            }
        });

        // Supercharge expiry
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.alive || !(ship.superchargedTurns > 0)) return;
            ship.superchargedTurns--;
            if (ship.superchargedTurns === 0) {
                this.addFloatingText('Supercharge faded', '#ffdd00', ship.x, ship.y - 12);
                this.addLog(`${this._shipLabel(ship)}: supercharge expired`);
            }
        });

        // Berserk expiry
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.alive || !(ship.berserkTurns > 0)) return;
            ship.berserkTurns--;
            if (ship.berserkTurns === 0) {
                this.addFloatingText('Berserk faded', '#ff44ff', ship.x, ship.y - 12);
                this.addLog(`${this._shipLabel(ship)}: berserk expired`);
            }
        });

        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if ((ship.blindedTurns || 0) > 0) {
                ship.blindedTurns--;
                if (ship.blindedTurns === 0) {
                    this.addFloatingText('Sight restored', '#ffffaa', ship.x, ship.y - 12);
                    this.addLog(`${this._shipLabel(ship)}: blindness expired`);
                }
            }
        });

        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if ((ship.markedTurns || 0) > 0) {
                ship.markedTurns--;
                if (ship.markedTurns === 0) {
                    this.addFloatingText('Mark faded', '#ff8800', ship.x, ship.y - 12);
                    this.addLog(`${this._shipLabel(ship)}: mark expired`);
                }
            }
        });

        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (ship.cloaked) {
                ship.cloakTurnsRemaining--;
                if (ship.cloakTurnsRemaining <= 0) {
                    ship.decloak();
                    this.addFloatingText('Decloaked', '#88ffcc', ship.x, ship.y - 12);
                    this.addLog(`${this._shipLabel(ship)}: cloak expired`);
                }
            }
        });

        // Anchor expiry
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if ((ship.anchoredTurns || 0) > 0) {
                ship.anchoredTurns--;
                if (ship.anchoredTurns === 0) {
                    this.addFloatingText('Anchor released', '#6699ff', ship.x, ship.y - 12);
                    this.addLog(`${this._shipLabel(ship)}: anchor released`);
                }
            }
        });

        // Phase expiry
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if ((ship.phasedTurns || 0) > 0) {
                ship.phasedTurns--;
                if (ship.phasedTurns === 0) {
                    this.addFloatingText('Phase ended', '#aaeeff', ship.x, ship.y - 12);
                    this.addLog(`${this._shipLabel(ship)}: phase ended`);
                }
            }
        });

        // Doom detonation
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.alive || !(ship.doomTurns > 0)) return;
            ship.doomTurns--;
            if (ship.doomTurns === 0) {
                this._performDoomDetonate(ship);
            }
        });

        // Mirror lifetime
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.isMirror || !ship.alive) return;
            ship.mirrorLifetime--;
            if (ship.mirrorLifetime <= 0) {
                ship.hull = 0; ship.alive = false;
                this.addFloatingText('Mirror faded', '#cc88ff', ship.x, ship.y - 12);
                this.addLog(`${this._shipLabel(ship)}: mirror faded`);
            } else {
                this.addFloatingText(`${ship.mirrorLifetime}t`, '#cc88ff', ship.x, ship.y - 18);
            }
        });

        // Stasis field: apply STASIS, shrink, decrement
        if (this.stasisFields && this.stasisFields.length > 0) {
            const allShips = [...this.playerShips, ...this.enemyShips];
            allShips.forEach(ship => {
                if (ship.alive && this.isShipInStasis(ship)) {
                    ship.stasisTurns = 1; // refreshed each round you're inside
                    this.addFloatingText('STASIS', '#88eeff', ship.x, ship.y - 12);
                }
            });
            for (let i = this.stasisFields.length - 1; i >= 0; i--) {
                const f = this.stasisFields[i];
                f.turnsRemaining--;
                f.radius = f.initialRadius * (f.turnsRemaining / CONSTANTS.STASIS_TURNS);
                if (f.turnsRemaining <= 0) this.stasisFields.splice(i, 1);
            }
        }
        // Stasis expiry on ships
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if ((ship.stasisTurns || 0) > 0) {
                ship.stasisTurns--;
            }
        });

        // Web expiry
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if ((ship.webTurns || 0) > 0) {
                ship.webTurns--;
                if (ship.webTurns === 0) {
                    this.addFloatingText('Web cleared', '#00ccaa', ship.x, ship.y - 12);
                    this.addLog(`${this._shipLabel(ship)}: web cleared`);
                }
            }
        });

        // Timeslip recovery
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if ((ship.timeslipTurns || 0) <= 0) return;
            ship.timeslipTurns--;
            if (ship.timeslipTurns === 0 && ship.timeslipData) {
                const d = ship.timeslipData;
                ship.x = d.x; ship.y = d.y; ship.rotation = d.rotation;
                ship.targetX = d.x; ship.targetY = d.y; ship.targetRotation = d.rotation;
                ship.hull = Math.min(d.hull, ship.maxHull);
                ship.shields = Math.min(d.shields, ship.maxShields);
                ship.actionsRemaining = d.actionsRemaining;
                ship.specialMoveCooldowns = Object.assign({}, d.cooldowns);
                if (ship.timeslipPunish) {
                    for (const id of Object.keys(ship.specialMoveCooldowns)) {
                        const move = CONSTANTS.SPECIAL_MOVES[id];
                        if (move) ship.specialMoveCooldowns[id] = move.cooldown;
                    }
                    ship.timeslipPunish = false;
                }
                ship.timeslipData = null;
                this.addAnimation({ type: 'blinkRing', x: ship.x, y: ship.y, radius: 40, duration: 500, totalDuration: 500 });
                this.addFloatingText('Reversed!', '#88aaff', ship.x, ship.y - 18);
                this.addLog(`${this._shipLabel(ship)}: time slip activated — state reset!`);
            }
        });

        // Frenzy countdown — backlash damage on expiry
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.alive || (ship.frenzyTurns || 0) <= 0) return;
            ship.frenzyTurns--;
            if (ship.frenzyTurns === 0) {
                const dmg = Math.min(5, ship.hull - 1);
                if (dmg > 0) {
                    ship.hull -= dmg;
                    ship.triggerHitFlash(dmg, 0);
                    this.addFloatingText(`-${dmg} backlash`, '#ff2244', ship.x, ship.y - 8);
                }
                this.addFloatingText('Frenzy over', '#ff8800', ship.x, ship.y - 12);
                this.addLog(`${this._shipLabel(ship)}: frenzy ended${dmg > 0 ? ` — ${dmg} backlash damage` : ''}`);
            }
        });

        // Swarmlet movement and attack
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.isSwarmlet || !ship.alive) return;
            const enemies = (ship.isPlayer ? this.enemyShips : this.playerShips).filter(s => s.alive && !s.isBomb && !s.isSwarmlet && !s.isTorpedo);
            if (enemies.length > 0) {
                let nearest = null, nearestDist = Infinity;
                enemies.forEach(e => {
                    const d = distance(ship.x, ship.y, e.x, e.y);
                    if (d < nearestDist) { nearestDist = d; nearest = e; }
                });
                const hitRadius = CONSTANTS.ASTEROID_SHIP_RADIUS * ((nearest.sizeMult ?? 1.0) + (ship.sizeMult ?? 1.0));
                if (nearest && nearestDist <= hitRadius) {
                    const ramDmg = Math.max(2, Math.round(ship.engine * 0.25));
                    const result = nearest.takeDamage(ramDmg);
                    nearest.triggerHitFlash(result.hullDmg, result.shieldAbsorb);
                    ship.alive = false;
                    this.addAnimation({ type: 'explosion', x: ship.x, y: ship.y, duration: 300, totalDuration: 300 });
                    this.addFloatingText(`-${ramDmg}`, '#ff4444', nearest.x, nearest.y - 6);
                    this.addLog(`Swarmlet rammed ${this._shipLabel(nearest)} for ${ramDmg}!`);
                    if (!nearest.alive) {
                        this.addAnimation({ type: 'explosion', x: nearest.x, y: nearest.y, duration: CONSTANTS.EXPLOSION_DURATION, totalDuration: CONSTANTS.EXPLOSION_DURATION });
                        this.addLog(`${this._shipLabel(nearest)}: destroyed by swarmlet!`);
                    }
                } else if (nearest) {
                    const ang = Math.atan2(nearest.y - ship.y, nearest.x - ship.x);
                    ship.targetX = ship.x + Math.cos(ang) * ship.engine;
                    ship.targetY = ship.y + Math.sin(ang) * ship.engine;
                    ship.targetRotation = ang;
                    ship.isMoving = true;
                    ship._moveStarted = false;
                }
            }
        });

        // Swarmlet lifetime
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.isSwarmlet || !ship.alive) return;
            ship.swarmletLifetime--;
            if (ship.swarmletLifetime <= 0) {
                ship.alive = false;
                this.addFloatingText('Expired', '#ff8800', ship.x, ship.y - 12);
                this.addLog(`Swarmlet expired`);
            } else {
                this.addFloatingText(`${ship.swarmletLifetime}t`, '#ff8800', ship.x, ship.y - 18);
            }
        });

        // Torpedo movement and detonation
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.isTorpedo || !ship.alive) return;
            const enemies = (ship.isPlayer ? this.enemyShips : this.playerShips).filter(s => s.alive && !s.isBomb && !s.isTorpedo && !s.isSwarmlet);
            if (enemies.length === 0 || ship.torpedoLifetime <= 0) {
                this._detonateTorpedo(ship);
                return;
            }
            let nearest = null, nearestDist = Infinity;
            enemies.forEach(e => {
                const d = distance(ship.x, ship.y, e.x, e.y);
                if (d < nearestDist) { nearestDist = d; nearest = e; }
            });
            const hitRadius = CONSTANTS.ASTEROID_SHIP_RADIUS * ((nearest.sizeMult ?? 1.0) + (ship.sizeMult ?? 1.0)) + ship.engine;
            if (nearestDist <= hitRadius) {
                ship.x = nearest.x;
                ship.y = nearest.y;
                this._detonateTorpedo(ship);
            } else {
                const ang = Math.atan2(nearest.y - ship.y, nearest.x - ship.x);
                ship.targetX = ship.x + Math.cos(ang) * ship.engine;
                ship.targetY = ship.y + Math.sin(ang) * ship.engine;
                ship.targetRotation = ang;
                ship.isMoving = true;
                ship._moveStarted = false;
                ship.torpedoLifetime--;
                if (ship.torpedoLifetime <= 0) this._detonateTorpedo(ship);
                else this.addFloatingText(`${ship.torpedoLifetime}t`, '#ff6600', ship.x, ship.y - 18);
            }
        });

        // Hull and shield regen modules
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (!ship.alive) return;
            if ((ship.hullRegenPerRound || 0) > 0 && ship.hull < ship.maxHull) {
                const regen = Math.min(ship.hullRegenPerRound, ship.maxHull - ship.hull);
                ship.hull += regen;
                this.addFloatingText(`+${regen}`, '#88ff88', ship.x, ship.y - 12);
                this.addLog(`${this._shipLabel(ship)}: hull regen +${regen}`);
            }
            if ((ship.shieldRegenPerRound || 0) > 0 && ship.shields < ship.maxShields) {
                const regen = Math.min(ship.shieldRegenPerRound, ship.maxShields - ship.shields);
                ship.shields += regen;
                this.addFloatingText(`+${regen}`, '#4488ff', ship.x, ship.y - 16);
                this.addLog(`${this._shipLabel(ship)}: shield regen +${regen}`);
            }
        });

        this.playerShips.forEach(ship => {
            ship.resetTurn();
            if (ship.specialMoveCooldowns) {
                for (const id of Object.keys(ship.specialMoveCooldowns)) {
                    if (ship.specialMoveCooldowns[id] > 0) ship.specialMoveCooldowns[id]--;
                }
            }
        });
        this.enemyShips.forEach(ship => {
            ship.resetTurn();
            if (ship.specialMoveCooldowns) {
                for (const id of Object.keys(ship.specialMoveCooldowns)) {
                    if (ship.specialMoveCooldowns[id] > 0) ship.specialMoveCooldowns[id]--;
                }
            }
        });

        // Berserk ships get double actions
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (ship.alive && (ship.berserkTurns || 0) > 0) ship.actionsRemaining *= 2;
        });

        // Frenzy: +1 action (applied after resetTurn)
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (ship.alive && (ship.frenzyTurns || 0) > 0) ship.actionsRemaining++;
        });

        this.round++;
        this.currentShipIndex = 0;
        while (this.currentShipIndex < this.playerShips.length &&
            (!this.playerShips[this.currentShipIndex].alive || this.playerShips[this.currentShipIndex].isBomb || this.playerShips[this.currentShipIndex].isSwarmlet || this.playerShips[this.currentShipIndex].isTorpedo)) {
            this.currentShipIndex++;
        }
        this.playerMode = null;
        this.state = COMBAT_STATE.PLAYER_TURN;
        const firstShip = this.playerShips[this.currentShipIndex];
        if (firstShip) {
            if (firstShip.isDrone) {
                UISystem.updateCombatScreen(gameState, this);
                setTimeout(() => this.processDroneTurn(firstShip), CONSTANTS.AI_DECISION_DELAY);
            } else if ((firstShip.berserkTurns || 0) > 0) {
                UISystem.updateCombatScreen(gameState, this);
                setTimeout(() => this.processBerserkPlayerTurn(firstShip), CONSTANTS.AI_DECISION_DELAY);
            } else if ((firstShip.stasisTurns || 0) > 0) {
                this.addFloatingText('Stasis!', '#88eeff', firstShip.x, firstShip.y - 12);
                this.addLog(`${this._shipLabel(firstShip)}: cannot act — in stasis!`);
                UISystem.updateCombatScreen(gameState, this);
                setTimeout(() => this.nextPlayerShip(), CONSTANTS.AI_DECISION_DELAY);
            } else {
                this.applyStartOfTurnEffects(firstShip);
                UISystem.updateCombatScreen(gameState, this);
            }
        } else {
            UISystem.updateCombatScreen(gameState, this);
        }
};

Combat.prototype.checkCombatEnd = function() {
        if (this.state === COMBAT_STATE.ENDED) return;
        const alivePlayerShips = this.playerShips.filter(s => s.alive && !s.isDrone && !s.isBomb && !s.isMirror && !s.isSwarmlet && !s.isTorpedo).length;
        const aliveEnemyShips  = this.enemyShips.filter(s => s.alive && !s.isDrone && !s.isBomb && !s.isMirror && !s.isSwarmlet && !s.isTorpedo).length;

        if (aliveEnemyShips === 0) {
            this.won = true;
            this.state = COMBAT_STATE.ENDED;
            this._endedAt = Date.now();
        } else if (alivePlayerShips === 0) {
            if (!this.playerRetreated) this.lost = true;
            this.state = COMBAT_STATE.ENDED;
            this._endedAt = Date.now();
        }
};

Combat.prototype.getRewards = function() {
        const destroyedEnemies = this.enemyShips.filter(s => !s.alive).length;
        return destroyedEnemies * CONSTANTS.CREDITS_PER_ENEMY_DESTROYED;
};
