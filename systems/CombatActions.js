// Combat player action methods — extends Combat.prototype
// Loaded after Combat.js

Combat.prototype.playerShootAt = function(shooter, target) {
        if (shooter.statusEffect === 'plasma') {
            this.addLog(`${this._shipLabel(shooter)}: cannot fire — overheated!`);
            return;
        }
        if (shooter.blindedTurns > 0) {
            this.addLog(`${this._shipLabel(shooter)}: cannot fire — blinded!`);
            return;
        }
        this._decloakDephase(shooter);
        const maxRange = this.getShootRange(shooter);
        const targetMarked = (target.markedTurns || 0) > 0;
        const result = shooter.shootAt(target, maxRange, targetMarked);

        // Dust cloud: flat 50% additional miss — bypassed if target is marked
        if (!targetMarked && result.hit && (this.isShipDusty(shooter) || this.isShipDusty(target))) {
            if (Math.random() < CONSTANTS.DUST_MISS_CHANCE) {
                result.hit = false; result.damage = 0; result._dustMiss = true;
            }
        }

        // Deflector: check before animation — 20% chance to reflect the shot back
        if (result.hit && !result._dustMiss && (target.projectileReflectChance || 0) > 0 && Math.random() < target.projectileReflectChance) {
            result._reflected = true;
        }

        const obstruction = this.getPathObstructions(shooter, target);
        const laserEnd = obstruction ? obstruction.entity : target;

        this.addFloatingText('Fire!', '#ff8800', shooter.x, shooter.y - 12);
        this.addAnimation({
            type: 'laser',
            from: { x: shooter.x, y: shooter.y },
            to:   { x: laserEnd.x, y: laserEnd.y },
            duration: CONSTANTS.COMBAT_ANIMATION_SPEED,
            totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED,
            color: shooter.hasRepulsor ? 'repulsor' : shooter.hasAttractor ? 'attractor' : shooter.hasIonLaser ? 'ion' : null,
        });

        const self = this;
        const delay = CONSTANTS.COMBAT_ANIMATION_SPEED;

        if (obstruction) {
            setTimeout(() => {
                self.addFloatingText('Missed!', '#555555', target.x, target.y - 6);
                self._applyLaserHitToObstruction(shooter, obstruction, target);
            }, delay);
        } else if (result._reflected) {
            setTimeout(() => {
                self.addFloatingText('Reflected!', '#88ffff', target.x, target.y - 16);
                const shieldAbsorb = Math.min(result.damage, shooter.shields);
                const hullDmg = result.damage - shieldAbsorb;
                shooter.takeDamage(result.damage, true);
                shooter.triggerHitFlash(hullDmg, shieldAbsorb);
                if (shieldAbsorb > 0) self.addFloatingText(`-${shieldAbsorb}`, '#4488ff', shooter.x, shooter.y - 20);
                if (hullDmg > 0)      self.addFloatingText(`-${hullDmg}`,      '#ff4444', shooter.x, shooter.y - 6);
                self.addLog(`${self._shipLabel(target)}: deflected shot! ${self._shipLabel(shooter)} takes -${result.damage}`);
                if (!shooter.alive) {
                    self.addAnimation({ type: 'explosion', x: shooter.x, y: shooter.y, duration: CONSTANTS.EXPLOSION_DURATION });
                    self.addLog(`${self._shipLabel(shooter)} destroyed!`);
                }
            }, delay);
        } else if (result.hit) {
            const shieldAbsorb = Math.min(result.damage, target.shields);
            const hullDmg = result.damage - shieldAbsorb;
            setTimeout(() => {
                const wasCloak = target.cloaked;
                target.takeDamage(result.damage, true);
                if (wasCloak) self.addFloatingText('Revealed!', '#88ffcc', target.x, target.y - 30);
                target.triggerHitFlash(hullDmg, shieldAbsorb);
                if (shieldAbsorb > 0) self.addFloatingText(`-${shieldAbsorb}`, '#4488ff', target.x, target.y - 20);
                if (hullDmg > 0)      self.addFloatingText(`-${hullDmg}`,      '#ff4444', target.x, target.y - 6);
                const parts = [];
                if (shieldAbsorb > 0) parts.push(`${shieldAbsorb} shld`);
                if (hullDmg > 0)      parts.push(`${hullDmg} hull`);
                self.addLog(`${self._shipLabel(shooter)} → ${self._shipLabel(target)}: -${parts.join(' -')}`);
                if (!target.alive) {
                    self.addAnimation({ type: 'explosion', x: target.x, y: target.y, duration: CONSTANTS.EXPLOSION_DURATION });
                    self.addLog(`${self._shipLabel(target)} destroyed!`);
                }
                // Repulsor: small knockback on hit (blocked if target is anchored)
                if (shooter.hasRepulsor && (target.anchoredTurns || 0) <= 0) {
                    const ang = Math.atan2(target.y - shooter.y, target.x - shooter.x);
                    target.targetX = target.x + Math.cos(ang) * CONSTANTS.REPULSOR_KNOCKBACK;
                    target.targetY = target.y + Math.sin(ang) * CONSTANTS.REPULSOR_KNOCKBACK;
                    target._moveDuration = 300;
                    target._moveElapsed  = 0;
                    target._moveStarted  = false;
                    target.isMoving = true;
                }
                // Attractor: pull toward shooter on hit (blocked if target is anchored)
                if (shooter.hasAttractor && (target.anchoredTurns || 0) <= 0 && target.alive) {
                    const ang = Math.atan2(shooter.y - target.y, shooter.x - target.x);
                    target.targetX = target.x + Math.cos(ang) * CONSTANTS.ATTRACTOR_KNOCKBACK;
                    target.targetY = target.y + Math.sin(ang) * CONSTANTS.ATTRACTOR_KNOCKBACK;
                    target._moveDuration = 300;
                    target._moveElapsed  = 0;
                    target._moveStarted  = false;
                    target.isMoving = true;
                }
                // Scatter: 50% mini-blink on hit
                if (target.hasScatter && (target.anchoredTurns || 0) <= 0 && Math.random() < 0.5) {
                    self._applyScatterBlink(target);
                }
            }, delay);
        } else {
            setTimeout(() => {
                const missLabel = result._dustMiss ? 'Dusty Miss!' : 'Miss!';
                const missColor = result._dustMiss ? '#7799cc' : '#555555';
                self.addFloatingText(missLabel, missColor, target.x, target.y - 6);
                self.addLog(`${self._shipLabel(shooter)} → ${self._shipLabel(target)}: ${missLabel}`);
            }, delay);
        }

        shooter.actionsRemaining = Math.max(0, shooter.actionsRemaining - 1);
        this.checkAutoAdvance(shooter);
};

Combat.prototype._applyLaserHitToObstruction = function(shooter, obstruction, originalTarget) {
        // Roll miss chance for the interceptor based on distance vs shoot range
        const maxRange = this.getShootRange(shooter);
        const dist = obstruction.dist !== undefined ? obstruction.dist
            : distance(shooter.x, shooter.y, obstruction.entity.x, obstruction.entity.y);
        const hitChance = 1 - (Math.min(1, dist / maxRange) * 0.5);
        if (Math.random() >= hitChance) {
            this.addFloatingText('Grazed!', '#555555', obstruction.entity.x, obstruction.entity.y - 6);
            this.addLog(`${this._shipLabel(shooter)} → laser grazed interceptor (miss)`);
            return;
        }

        if (obstruction.type === 'asteroid') {
            const ang = Math.atan2(obstruction.entity.y - shooter.y, obstruction.entity.x - shooter.x);
            this.addLog(`${this._shipLabel(shooter)} → laser blocked by asteroid`);
            this.splitAsteroid(obstruction.entity, ang);
        } else if (obstruction.type === 'dead_ship') {
            // Dead ship wreck absorbs the shot — no damage, just a deflection
            this.addFloatingText('Deflected!', '#888888', obstruction.entity.x, obstruction.entity.y - 8);
            this.addLog(`${this._shipLabel(shooter)} → laser deflected by wreck of ${obstruction.entity.name}`);
        } else {
            const blocker = obstruction.entity;
            const dmg = shooter.laserDamage;
            const wasCloak = blocker.cloaked;
            const { shieldAbsorb, hullDmg } = blocker.takeDamage(dmg, true);
            if (wasCloak) this.addFloatingText('Revealed!', '#88ffcc', blocker.x, blocker.y - 30);
            blocker.triggerHitFlash(hullDmg, shieldAbsorb);
            if (shieldAbsorb > 0) this.addFloatingText(`-${shieldAbsorb}`, '#4488ff', blocker.x, blocker.y - 20);
            if (hullDmg > 0)      this.addFloatingText(`-${hullDmg}`,      '#ff4444', blocker.x, blocker.y - 6);
            const parts = [];
            if (shieldAbsorb > 0) parts.push(`${shieldAbsorb} shld`);
            if (hullDmg > 0)      parts.push(`${hullDmg} hull`);
            this.addLog(`${this._shipLabel(shooter)} → laser blocked by ${this._shipLabel(blocker)}: -${parts.join(' -')}`);
            if (!blocker.alive) {
                this.addAnimation({ type: 'explosion', x: blocker.x, y: blocker.y, duration: CONSTANTS.EXPLOSION_DURATION });
                this.addLog(`${this._shipLabel(blocker)} destroyed!`);
            }
        }
};

Combat.prototype.playerChaingun = function(shooter, target) {
        if (shooter.statusEffect === 'plasma') { this.addLog(`${this._shipLabel(shooter)}: cannot fire — overheated!`); return; }
        if (shooter.blindedTurns > 0)           { this.addLog(`${this._shipLabel(shooter)}: cannot fire — blinded!`);   return; }
        this._decloakDephase(shooter);

        const maxRange  = this.getShootRange(shooter);
        const perRound  = Math.max(1, Math.round(shooter.laserDamage * CONSTANTS.CHAINGUN_DAMAGE_MULT));
        const dist      = distance(shooter.x, shooter.y, target.x, target.y);
        // 2× normal miss chance: normal is dist/maxRange * 0.5, so 2× = dist/maxRange * 1.0
        const hitChance = Math.max(0, 1 - Math.min(1, dist / maxRange));
        const roundDur  = Math.round(CONSTANTS.COMBAT_ANIMATION_SPEED * 0.55);
        const stagger   = 85;
        const burstDur  = (CONSTANTS.CHAINGUN_ROUNDS - 1) * stagger + roundDur + 20;

        this.addAnimation({ type: 'chaingunBurst', duration: burstDur, totalDuration: burstDur });
        this.addFloatingText('Chaingun!', '#ff8800', shooter.x, shooter.y - 12);
        this.addLog(`${this._shipLabel(shooter)} → ${this._shipLabel(target)}: Chaingun (${CONSTANTS.CHAINGUN_ROUNDS} rounds, bypasses shields)`);

        const self = this;
        for (let i = 0; i < CONSTANTS.CHAINGUN_ROUNDS; i++) {
            const yOff = 6 + i * 7;
            setTimeout(() => {
                self.addAnimation({ type: 'chaingunRound', from: { x: shooter.x, y: shooter.y }, to: { x: target.x, y: target.y }, duration: roundDur, totalDuration: roundDur });
                setTimeout(() => {
                    if (!target.alive) return;
                    if (Math.random() < hitChance) {
                        // Bypasses shields — hull damage only
                        target.hull = Math.max(0, target.hull - perRound);
                        if (target.hull <= 0) target.alive = false;
                        target._hullFlashStart = Date.now();
                        target._hullFlashPct   = Math.min(1, (target.hull + perRound) / target.maxHull);
                        self.addFloatingText(`-${perRound}`, '#ff8800', target.x + randomInt(-4, 4), target.y - yOff);
                        if (!target.alive) {
                            self.addAnimation({ type: 'explosion', x: target.x, y: target.y, duration: CONSTANTS.EXPLOSION_DURATION, totalDuration: CONSTANTS.EXPLOSION_DURATION });
                            self.addLog(`${self._shipLabel(target)} destroyed!`);
                        }
                    } else {
                        self.addFloatingText('Miss!', '#555555', target.x + randomInt(-4, 4), target.y - yOff);
                    }
                }, roundDur);
            }, i * stagger);
        }

        shooter.actionsRemaining = Math.max(0, shooter.actionsRemaining - 1);
        shooter.specialMoveCooldowns['chaingun'] = CONSTANTS.SPECIAL_MOVES.chaingun.cooldown;
        this.playerMode = null;
        this.checkAutoAdvance(shooter);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerPlasmaCannon = function(shooter, target) {
        if (shooter.statusEffect === 'plasma') { this.addLog(`${this._shipLabel(shooter)}: cannot fire — overheated!`); return; }
        if (shooter.blindedTurns > 0)           { this.addLog(`${this._shipLabel(shooter)}: cannot fire — blinded!`);   return; }
        this._decloakDephase(shooter);

        const maxRange    = this.getShootRange(shooter) * CONSTANTS.PLASMA_RANGE_MULT;
        const targetMarked = (target.markedTurns || 0) > 0;
        const dist        = distance(shooter.x, shooter.y, target.x, target.y);
        const hitChance   = targetMarked ? 1 : 1 - (Math.min(1, dist / maxRange) * 0.5);
        const animDur     = Math.round(CONSTANTS.COMBAT_ANIMATION_SPEED * 1.8);

        this.addFloatingText('Plasma!', '#88ffaa', shooter.x, shooter.y - 12);
        this.addAnimation({ type: 'plasmaRound', from: { x: shooter.x, y: shooter.y }, to: { x: target.x, y: target.y }, duration: animDur, totalDuration: animDur });

        const self = this;
        setTimeout(() => {
            if (!target.alive) return;
            if (Math.random() >= hitChance) {
                self.addFloatingText('Miss!', '#555555', target.x, target.y - 6);
                self.addLog(`${self._shipLabel(shooter)} → ${self._shipLabel(target)}: plasma miss`);
                return;
            }
            // Two separate damage rolls: one vs shields, one direct to hull
            const shieldDmg = target.shields > 0 ? randomInt(1, shooter.laserDamage) : 0;
            const hullDmg   = randomInt(1, shooter.laserDamage);
            target.shields  = Math.max(0, target.shields - shieldDmg);
            target.hull     = Math.max(0, target.hull - hullDmg);
            if (target.hull <= 0) target.alive = false;
            target.triggerHitFlash(hullDmg, shieldDmg);
            if (shieldDmg > 0) self.addFloatingText(`-${shieldDmg}`, '#44ff88', target.x, target.y - 20);
            if (hullDmg > 0)   self.addFloatingText(`-${hullDmg}`,   '#ff4444', target.x, target.y - 6);
            const parts = [];
            if (shieldDmg > 0) parts.push(`${shieldDmg} shld`);
            if (hullDmg > 0)   parts.push(`${hullDmg} hull`);
            self.addLog(`${self._shipLabel(shooter)} → ${self._shipLabel(target)}: plasma -${parts.join(' -')}`);
            if (!target.alive) {
                self.addAnimation({ type: 'explosion', x: target.x, y: target.y, duration: CONSTANTS.EXPLOSION_DURATION, totalDuration: CONSTANTS.EXPLOSION_DURATION });
                self.addLog(`${self._shipLabel(target)} destroyed!`);
            }
        }, animDur);

        shooter.actionsRemaining = Math.max(0, shooter.actionsRemaining - 1);
        shooter.specialMoveCooldowns['plasma_cannon'] = CONSTANTS.SPECIAL_MOVES.plasma_cannon.cooldown;
        this.playerMode = null;
        this.checkAutoAdvance(shooter);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerRocketLauncher = function(shooter, tx, ty) {
        if (this._guardFrenzied(shooter)) return;
        this._decloakDephase(shooter);

        const blastRadius = CONSTANTS.ROCKET_BLAST_RADIUS;
        const allShips    = [...this.playerShips, ...this.enemyShips];
        const inBlast     = allShips.filter(s => s !== shooter && s.alive && distance(s.x, s.y, tx, ty) <= blastRadius);

        shooter.actionsRemaining = Math.max(0, shooter.actionsRemaining - 1);
        shooter.specialMoveCooldowns['rocket_launcher'] = CONSTANTS.SPECIAL_MOVES.rocket_launcher.cooldown;
        this.playerMode = null;

        this.addFloatingText('Rockets!', '#ff6633', shooter.x, shooter.y - 12);
        this.addLog(`${this._shipLabel(shooter)}: Rocket!`);

        const blastDur = 600;
        this.addAnimation({ type: 'rocketBlast', x: tx, y: ty, duration: blastDur, totalDuration: blastDur });

        const self = this;
        setTimeout(() => {
            inBlast.forEach(target => {
                if (!target.alive) return;
                const dmg = Math.max(1, shooter.laserDamage + randomInt(-2, 2));
                const { shieldAbsorb, hullDmg } = target.takeDamage(dmg, false);
                target.triggerHitFlash(hullDmg, shieldAbsorb);
                if (shieldAbsorb > 0) self.addFloatingText(`-${shieldAbsorb}`, '#4488ff', target.x, target.y - 20);
                if (hullDmg > 0)      self.addFloatingText(`-${hullDmg}`,      '#ff4444', target.x, target.y - 6);
                const parts = [];
                if (shieldAbsorb > 0) parts.push(`${shieldAbsorb} shld`);
                if (hullDmg > 0)      parts.push(`${hullDmg} hull`);
                self.addLog(`${self._shipLabel(shooter)} rocket → ${self._shipLabel(target)}: -${parts.join(' -')}`);
                if (!target.alive) {
                    self.addAnimation({ type: 'explosion', x: target.x, y: target.y, duration: CONSTANTS.EXPLOSION_DURATION, totalDuration: CONSTANTS.EXPLOSION_DURATION });
                    self.addLog(`${self._shipLabel(target)} destroyed!`);
                }
            });
            if (inBlast.length === 0) self.addLog(`${self._shipLabel(shooter)} rocket: no ships in blast`);
        }, blastDur * 0.35);

        this.checkAutoAdvance(shooter);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerSkipTurn = function(ship) {
        const shieldBefore = ship.shields;
        ship.skipTurn();
        const recharged = ship.shields - shieldBefore;
        if (recharged > 0) {
            ship._shieldRechargeFlashStart = Date.now();
            ship._shieldRechargePct = Math.min(1, ship.shields / ship.maxShields);
            this.addFloatingText(`+${recharged}`, '#00ffff', ship.x, ship.y - 8);
            this.addLog(`${this._shipLabel(ship)}: +${recharged} shld`);
        } else {
            this.addLog(`${this._shipLabel(ship)}: wait`);
        }
        this.checkAutoAdvance(ship);
};

Combat.prototype.playerBlink = function(ship, targetX, targetY) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const departX = ship.x, departY = ship.y;

        // Instant teleport — skip movement animation entirely
        ship.x = targetX;
        ship.y = targetY;
        ship.targetX = targetX;
        ship.targetY = targetY;
        ship._moveStarted = false;
        ship.isMoving = false;

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);

        // Expanding ring at departure + arrival
        const ringDur = 350;
        this.addAnimation({ type: 'blinkRing', x: departX, y: departY, duration: ringDur, totalDuration: ringDur });
        this.addAnimation({ type: 'blinkRing', x: targetX,  y: targetY,  duration: ringDur, totalDuration: ringDur });
        this.addFloatingText('Blink!', '#bb88ff', departX, departY - 12);
        this.addLog(`${this._shipLabel(ship)} blinked`);

        ship.specialMoveCooldowns['blink'] = CONSTANTS.SPECIAL_MOVES.blink.cooldown;
        this._pendingOverlapCheck = true;
        this.playerMode = null;
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerAfterburner = function(ship, tx, ty) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        // tx/ty is clamped to the steering cone by the caller; clamp range as a safety net
        const maxRange = ship.engine * (CONSTANTS.COMBAT_MOVE_OVAL_OFFSET + CONSTANTS.COMBAT_MOVE_OVAL_MAJOR) * CONSTANTS.AFTERBURNER_RANGE_MULT;
        const rawDist = distance(ship.x, ship.y, tx, ty);
        if (rawDist > maxRange && rawDist > 0) {
            tx = ship.x + (tx - ship.x) / rawDist * maxRange;
            ty = ship.y + (ty - ship.y) / rawDist * maxRange;
        }

        const startX = ship.x, startY = ship.y;
        const pathDist = distance(startX, startY, tx, ty);
        const dirX = pathDist > 0 ? (tx - startX) / pathDist : 1;
        const dirY = pathDist > 0 ? (ty - startY) / pathDist : 0;

        // Project a position onto the path; returns t ∈ [0, 1]
        const projectT = (ox, oy) => pathDist > 0
            ? Math.max(0, Math.min(1, ((ox - startX) * dirX + (oy - startY) * dirY) / pathDist))
            : 0;

        const enemies = ship.isPlayer ? this.enemyShips : this.playerShips;
        const hitsInPath = enemies.filter(e =>
            e.alive && distancePointToLineSegment(e.x, e.y, startX, startY, tx, ty) <= CONSTANTS.AFTERBURNER_HALF_WIDTH
        );
        const asteroidsInPath = [...this.asteroids].filter(a =>
            distancePointToLineSegment(a.x, a.y, startX, startY, tx, ty) <= CONSTANTS.AFTERBURNER_HALF_WIDTH + a.radius
        );

        // Find the first (closest) obstacle — afterburner stops there
        const SHIP_R = CONSTANTS.ASTEROID_SHIP_RADIUS;
        let firstT = 1.0, firstShip = null, firstAsteroid = null;
        for (const e of hitsInPath) {
            const t = projectT(e.x, e.y);
            if (t < firstT) { firstT = t; firstShip = e; firstAsteroid = null; }
        }
        for (const a of asteroidsInPath) {
            const t = projectT(a.x, a.y);
            if (t < firstT) { firstT = t; firstAsteroid = a; firstShip = null; }
        }

        const hasCollision = firstShip !== null || firstAsteroid !== null;

        // Stop just before the first obstacle so resolveOverlaps handles the bounce
        if (hasCollision) {
            const stopRadius = firstShip
                ? SHIP_R * ((ship.sizeMult ?? 1) + (firstShip.sizeMult ?? 1)) + 4
                : SHIP_R + (firstAsteroid ? firstAsteroid.radius : 0) + 4;
            const stopDist = Math.max(0, firstT * pathDist - stopRadius);
            tx = startX + dirX * stopDist;
            ty = startY + dirY * stopDist;
        }

        ship.targetX = tx;
        ship.targetY = ty;
        ship.targetRotation = Math.atan2(ty - startY, tx - startX);
        ship.isMoving = true;
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);

        const travelDist = distance(startX, startY, tx, ty);
        const travelTime = Math.max(200, travelDist / CONSTANTS.SHIP_ANIMATION_SPEED);
        const trailDuration = travelTime + 500;
        this.addAnimation({
            type: 'afterburnerTrail',
            startX, startY, ship,
            endX: tx, endY: ty,
            duration: trailDuration, totalDuration: trailDuration
        });

        this.addFloatingText('Afterburner!', '#ff8800', startX, startY - 12);
        this.addLog(`${this._shipLabel(ship)}: Afterburner!`);

        ship.specialMoveCooldowns['afterburner'] = CONSTANTS.SPECIAL_MOVES.afterburner.cooldown;
        this.playerMode = null;

        if (hasCollision) {
            const delay = travelTime;
            const self = this;
            setTimeout(() => {
                if (firstShip && firstShip.alive) {
                    const dmg = randomInt(1, Math.max(1, Math.floor(ship.engine / 2)));
                    const shieldAbsorb = Math.min(dmg, firstShip.shields);
                    const hullDmg = dmg - shieldAbsorb;
                    firstShip.takeDamage(dmg);
                    firstShip.triggerHitFlash(hullDmg, shieldAbsorb);
                    if (shieldAbsorb > 0) self.addFloatingText(`-${shieldAbsorb}`, '#4488ff', firstShip.x, firstShip.y - 20);
                    if (hullDmg > 0) self.addFloatingText(`-${hullDmg}`, '#ff4444', firstShip.x, firstShip.y - 6);
                    const parts = [];
                    if (shieldAbsorb > 0) parts.push(`${shieldAbsorb} shld`);
                    if (hullDmg > 0) parts.push(`${hullDmg} hull`);
                    self.addLog(`${self._shipLabel(ship)} afterburner → ${self._shipLabel(firstShip)}: -${parts.join(' -')}`);
                    if (!firstShip.alive) {
                        self.addAnimation({ type: 'explosion', x: firstShip.x, y: firstShip.y, duration: CONSTANTS.EXPLOSION_DURATION });
                        self.addLog(`${self._shipLabel(firstShip)} destroyed!`);
                    }
                }
                if (firstAsteroid) {
                    const ang = Math.atan2(firstAsteroid.y - startY, firstAsteroid.x - startX);
                    self.splitAsteroid(firstAsteroid, ang);
                }
                self._pendingOverlapCheck = true;
            }, delay);
        }

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerPlantBomb = function(ship, tx, ty) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const bombStats = { hull: CONSTANTS.BOMB_HULL, shields: 0, laser: 0, radar: 0, engine: 0, type: 'Bomb' };
        const bomb = new Ship(tx, ty, ship.isPlayer, ship.rotation, bombStats);
        bomb.isBomb = true;
        bomb.noCorpse = true;
        bomb.bombLifetime = CONSTANTS.BOMB_LIFETIME;
        bomb.specialMoves = [];
        bomb.specialMoveCooldowns = {};
        bomb.builtinModules = [];
        bomb.modules = [];
        bomb.actionsRemaining = 0;
        bomb.inCombat = true;
        bomb.name = 'Bomb';

        if (ship.isPlayer) {
            this.playerShips.push(bomb);
        } else {
            this.enemyShips.push(bomb);
        }

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['bomb'] = CONSTANTS.SPECIAL_MOVES.bomb.cooldown;
        this.playerMode = null;

        this.addAnimation({ type: 'blinkRing', x: tx, y: ty, duration: 400, totalDuration: 400 });
        this.addFloatingText('Bomb planted!', '#ff8844', ship.x, ship.y - 16);
        this.addLog(`${this._shipLabel(ship)}: Bomb planted — detonates in ${CONSTANTS.BOMB_LIFETIME} turns!`);
        this._pendingOverlapCheck = true;

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.performBombDetonate = function(bomb) {
        const blastRadius = CONSTANTS.WARHEAD_BLAST_RADIUS;
        const tx = bomb.x, ty = bomb.y;
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s !== bomb && s.alive);
        const inBlast = allShips.filter(s => distance(s.x, s.y, tx, ty) <= blastRadius);

        bomb.hull = 0;
        bomb.alive = false;

        this.addFloatingText('BOOM!', '#ff4400', tx, ty - 12);
        this.addLog('Bomb detonated!');
        const blastDur = 750;
        this.addAnimation({ type: 'warheadBlast', x: tx, y: ty, duration: blastDur, totalDuration: blastDur });

        const self = this;
        setTimeout(() => {
            inBlast.forEach(target => {
                if (!target.alive) return;
                const dist = distance(tx, ty, target.x, target.y);
                const falloff = Math.max(0, 1 - dist / blastRadius);
                const maxDmg = Math.max(1, Math.round(CONSTANTS.WARHEAD_MAX_DAMAGE * falloff));
                const dmg = randomInt(1, maxDmg);
                const shieldAbsorb = Math.min(dmg, target.shields);
                const hullDmg = dmg - shieldAbsorb;
                const wasCloak = target.cloaked;
                target.takeDamage(dmg);
                if (wasCloak) self.addFloatingText('Revealed!', '#88ffcc', target.x, target.y - 30);
                target.triggerHitFlash(hullDmg, shieldAbsorb);
                if (shieldAbsorb > 0) self.addFloatingText(`-${shieldAbsorb}`, '#4488ff', target.x, target.y - 20);
                if (hullDmg > 0)      self.addFloatingText(`-${hullDmg}`,      '#ff4444', target.x, target.y - 6);
                const parts = [];
                if (shieldAbsorb > 0) parts.push(`${shieldAbsorb} shld`);
                if (hullDmg > 0)      parts.push(`${hullDmg} hull`);
                self.addLog(`Bomb → ${self._shipLabel(target)}: -${parts.join(' -')}`);
                const knockbackDist = Math.round(CONSTANTS.WARHEAD_KNOCKBACK * falloff);
                if (knockbackDist > 0 && dist > 0) {
                    const ang = Math.atan2(target.y - ty, target.x - tx);
                    target.targetX = target.x + Math.cos(ang) * knockbackDist;
                    target.targetY = target.y + Math.sin(ang) * knockbackDist;
                    target.targetRotation = ang;
                    target.isMoving = true;
                    target._moveStarted = false;
                }
                if (!target.alive) {
                    self.addAnimation({ type: 'explosion', x: target.x, y: target.y, duration: CONSTANTS.EXPLOSION_DURATION });
                    self.addLog(`${self._shipLabel(target)} destroyed!`);
                }
            });
            if (inBlast.length === 0) self.addLog('Bomb: no ships in blast radius');
            self.asteroids.filter(a => distance(a.x, a.y, tx, ty) <= blastRadius)
                .forEach(a => self.splitAsteroid(a, Math.atan2(a.y - ty, a.x - tx)));
            self.checkCombatEnd();
        }, blastDur * 0.2);

        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerEmpBlast = function(ship, tx, ty) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const blastRadius = CONSTANTS.WARHEAD_BLAST_RADIUS;
        const allShips = [...this.playerShips, ...this.enemyShips];
        const inBlast = allShips.filter(s =>
            s !== ship && s.alive && distance(s.x, s.y, tx, ty) <= blastRadius
        );

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['emp_blast'] = CONSTANTS.SPECIAL_MOVES.emp_blast.cooldown;
        this.playerMode = null;

        this.addFloatingText('EMP!', '#44eeff', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: EMP Blast!`);

        const blastDur = 750;
        this.addAnimation({ type: 'empBlast', x: tx, y: ty, duration: blastDur, totalDuration: blastDur });

        const self = this;
        setTimeout(() => {
            inBlast.forEach(target => {
                if (!target.alive) return;
                const dist = distance(tx, ty, target.x, target.y);
                const falloff = Math.max(0, 1 - dist / blastRadius);

                target.decloak();
                const maxDmg = Math.max(1, Math.round(CONSTANTS.WARHEAD_MAX_DAMAGE * falloff));
                const dmg = randomInt(1, maxDmg);
                const shieldDmg = Math.min(dmg, target.shields);
                target.shields = Math.max(0, target.shields - shieldDmg);
                if (shieldDmg > 0) {
                    target.triggerHitFlash(0, shieldDmg);
                    self.addFloatingText(`-${shieldDmg}`, '#44eeff', target.x, target.y - 20);
                }

                if (target.specialMoveCooldowns && target.specialMoves) {
                    target.specialMoves.forEach(moveId => {
                        const moveDef = CONSTANTS.SPECIAL_MOVES[moveId];
                        if (moveDef) target.specialMoveCooldowns[moveId] = moveDef.cooldown;
                    });
                }
                self.addFloatingText('JAMMED', '#44eeff', target.x, target.y - 6);
                self.addLog(`${self._shipLabel(ship)} EMP → ${self._shipLabel(target)}: -${shieldDmg} shields, abilities jammed`);
            });

            if (inBlast.length === 0) self.addLog(`${self._shipLabel(ship)} EMP: no ships in range`);
        }, blastDur * 0.2);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerSummonDrone = function(carrier) {
        if (this._guardFrenzied(carrier)) return;
        this._decloakDephase(carrier);
        const spawnDist = CONSTANTS.ASTEROID_SHIP_RADIUS * 2 + 8;
        const SHIP_R    = CONSTANTS.ASTEROID_SHIP_RADIUS;
        let sx, sy;
        // Try 8 evenly-spaced angles around the carrier; pick first clear of asteroids
        let placed = false;
        for (let i = 0; i < 8; i++) {
            const ang = carrier.rotation + Math.PI * 0.5 + (Math.PI * 2 / 8) * i;
            const cx = Math.max(50, Math.min(CONSTANTS.GAME_WIDTH  - 50, carrier.x + Math.cos(ang) * spawnDist));
            const cy = Math.max(50, Math.min(CONSTANTS.GAME_HEIGHT - 50, carrier.y + Math.sin(ang) * spawnDist));
            if (this.asteroids.every(a => distance(cx, cy, a.x, a.y) >= a.radius + SHIP_R + 8)) {
                sx = cx; sy = cy; placed = true; break;
            }
        }
        if (!placed) { sx = carrier.x; sy = carrier.y; } // absolute fallback

        const droneStats = { hull: CONSTANTS.DRONE_HULL, shields: 0, laser: CONSTANTS.DRONE_LASER, radar: CONSTANTS.DRONE_RADAR, engine: CONSTANTS.DRONE_ENGINE, type: 'Drone' };
        const drone = new Ship(sx, sy, carrier.isPlayer, carrier.rotation, droneStats);
        drone.isDrone = true;
        drone.noCorpse = true;
        drone.droneLifetime = CONSTANTS.DRONE_LIFETIME;
        drone.specialMoves = [];
        drone.specialMoveCooldowns = {};
        drone.builtinModules = [];
        drone.modules = [];
        drone.actionsRemaining = 0;
        drone.inCombat = true;
        drone.name = 'Drone';

        if (carrier.isPlayer) {
            this.playerShips.push(drone);
        } else {
            this.enemyShips.push(drone);
        }

        carrier.actionsRemaining = Math.max(0, carrier.actionsRemaining - 1);
        carrier.specialMoveCooldowns['summon_drone'] = CONSTANTS.SPECIAL_MOVES.summon_drone.cooldown;
        this.playerMode = null;

        this.addAnimation({ type: 'blinkRing', x: sx, y: sy, duration: 400, totalDuration: 400 });
        this.addFloatingText('Drone deployed!', '#88ffcc', carrier.x, carrier.y - 16);
        this.addLog(`${this._shipLabel(carrier)}: Combat drone deployed`);
        this._pendingOverlapCheck = true;

        this.checkAutoAdvance(carrier);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.getRepairBeamRange = function(ship) {
        return ship.radar * CONSTANTS.SHOOT_RANGE_BASE * 0.75;
};

Combat.prototype.getRepairBeamConeTargets = function(ship) {
        const range = this.getRepairBeamRange(ship);
        const halfAngle = CONSTANTS.REPAIR_BEAM_CONE_HALF_ANGLE;
        const allShips = [...this.playerShips, ...this.enemyShips];
        return allShips.filter(s => {
            if (s === ship || s.isBomb) return false;
            // Include dead ships (for resurrection) and living ships (for healing)
            const dist = distance(ship.x, ship.y, s.x, s.y);
            if (dist > range) return false;
            const ang = Math.atan2(s.y - ship.y, s.x - ship.x);
            const localAng = normalizeAngle(ang - ship.rotation);
            return Math.abs(localAng) <= halfAngle;
        });
};

Combat.prototype.playerRepairBeam = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const targets = this.getRepairBeamConeTargets(ship);

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['repair_beam'] = CONSTANTS.SPECIAL_MOVES.repair_beam.cooldown;
        this.playerMode = null;

        this.addFloatingText('Repair Beam!', '#00ff88', ship.x, ship.y - 12);

        if (targets.length === 0) {
            this.addLog(`${this._shipLabel(ship)} repair beam: no ships in forward cone`);
        } else {
            targets.forEach(target => {
                this.addAnimation({ type: 'tractorBeam', from: { x: ship.x, y: ship.y }, to: { x: target.x, y: target.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
                if (!target.alive) {
                    // Resurrect dead ship
                    target.alive = true;
                    target.hull  = 1;
                    target.shields = 0;
                    this.addFloatingText('Revived!', '#00ff88', target.x, target.y - 6);
                    this.addLog(`${this._shipLabel(ship)} repair → ${this._shipLabel(target)}: REVIVED!`);
                } else {
                    const heal = randomInt(CONSTANTS.REPAIR_BEAM_HULL_MIN, CONSTANTS.REPAIR_BEAM_HULL_MAX);
                    const hullRestored = Math.min(heal, target.maxHull - target.hull);
                    target.hull = Math.min(target.maxHull, target.hull + heal);
                    if (hullRestored > 0) this.addFloatingText(`+${hullRestored} hull`, '#00ff88', target.x, target.y - 6);
                    this.addLog(`${this._shipLabel(ship)} repair → ${this._shipLabel(target)}: ${hullRestored > 0 ? `+${hullRestored} hull` : 'full'}`);
                }
            });
        }

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerSupercharge = function(ship, target) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        target.shields = target.maxShields;
        target.superchargedTurns = 1;

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['supercharge'] = CONSTANTS.SPECIAL_MOVES.supercharge.cooldown;
        this.playerMode = null;

        this.addAnimation({ type: 'tractorBeam', from: { x: ship.x, y: ship.y }, to: { x: target.x, y: target.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
        this.addFloatingText('Supercharge!', '#ffdd00', ship.x, ship.y - 12);
        this.addFloatingText('SUPERCHARGED!', '#ffdd00', target.x, target.y - 18);
        this.addFloatingText('+shields', '#00ffff', target.x, target.y - 6);
        this.addLog(`${this._shipLabel(ship)} → ${this._shipLabel(target)}: SUPERCHARGED! Shields fully restored`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerPossess = function(ship, target) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        target.berserkTurns = CONSTANTS.BERSERK_TURNS;
        if (target.cloaked) target.decloak();

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['possess'] = CONSTANTS.SPECIAL_MOVES.possess.cooldown;
        this.playerMode = null;

        this.addAnimation({ type: 'tractorBeam', from: { x: ship.x, y: ship.y }, to: { x: target.x, y: target.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
        this.addFloatingText('Possessed!', '#ff44ff', ship.x, ship.y - 12);
        this.addFloatingText('BERSERK!', '#ff44ff', target.x, target.y - 18);
        this.addLog(`${this._shipLabel(ship)} possessed ${this._shipLabel(target)} — BERSERK for ${CONSTANTS.BERSERK_TURNS} turns!`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerSwarm = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const count = CONSTANTS.SWARM_COUNT;
        for (let i = 0; i < count; i++) {
            const angle = ship.rotation + (i / count) * Math.PI * 2;
            const spawnDist = CONSTANTS.SHIP_SIZE * 3;
            const swarmlet = new Ship(
                ship.x + Math.cos(angle) * spawnDist,
                ship.y + Math.sin(angle) * spawnDist,
                ship.isPlayer, angle,
                { hull: CONSTANTS.SWARM_HULL, shields: 0, laser: 0, radar: 0, engine: CONSTANTS.SWARM_ENGINE, type: 'Swarmlet' }
            );
            swarmlet.isSwarmlet = true;
            swarmlet.swarmletLifetime = CONSTANTS.SWARM_LIFETIME;
            swarmlet.noCorpse = true;
            if (ship.isPlayer) this.playerShips.push(swarmlet);
            else this.enemyShips.push(swarmlet);
            this.addAnimation({ type: 'blinkRing', x: swarmlet.x, y: swarmlet.y, radius: 15, duration: 250, totalDuration: 250 });
        }
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['swarm'] = CONSTANTS.SPECIAL_MOVES.swarm.cooldown;
        this.playerMode = null;
        this.addFloatingText(`Swarm x${count}!`, '#ff8800', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: released ${count} swarmlets!`);
        this._pendingOverlapCheck = true;
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerWebbing = function(ship, tx, ty) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const range = CONSTANTS.WEBBING_RANGE;
        const blastRadius = CONSTANTS.WEBBING_BLAST_RADIUS;
        const d = distance(ship.x, ship.y, tx, ty);
        if (d > range) { tx = ship.x + (tx - ship.x) / d * range; ty = ship.y + (ty - ship.y) / d * range; }
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s.alive && !s.isSwarmlet && !s.isTorpedo);
        const hit = allShips.filter(s => distance(tx, ty, s.x, s.y) <= blastRadius);
        this.addAnimation({ type: 'flashBlast', x: tx, y: ty, duration: 500, totalDuration: 500 });
        this.addFloatingText('Webbing!', '#00ccaa', ship.x, ship.y - 12);
        const self = this;
        setTimeout(() => {
            hit.forEach(t => {
                t.webTurns = CONSTANTS.WEB_TURNS;
                self.addFloatingText('WEBBED!', '#00ccaa', t.x, t.y - 18);
            });
            self.addLog(`${self._shipLabel(ship)} → ${hit.length} ship(s) webbed for ${CONSTANTS.WEB_TURNS} turns`);
        }, 300);
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['webbing'] = CONSTANTS.SPECIAL_MOVES.webbing.cooldown;
        this.playerMode = null;
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerTimeslip = function(ship, target) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        target.timeslipData = {
            x: target.x, y: target.y, rotation: target.rotation,
            hull: target.hull, shields: target.shields,
            actionsRemaining: target.actionsRemaining,
            cooldowns: Object.assign({}, target.specialMoveCooldowns || {}),
        };
        target.timeslipTurns = CONSTANTS.TIMESLIP_RECOVERY_TURNS;
        // If the caster has the timeslip module, punish the target's cooldowns on recovery
        const casterHasModule = ship.builtinModules.includes('alien_timeslip') ||
            (ship.modules || []).some(m => m.id === 'alien_timeslip');
        target.timeslipPunish = casterHasModule;
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['timeslip'] = CONSTANTS.SPECIAL_MOVES.timeslip.cooldown;
        this.playerMode = null;
        this.addAnimation({ type: 'tractorBeam', from: { x: ship.x, y: ship.y }, to: { x: target.x, y: target.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
        this.addFloatingText('Time Slip!', '#88aaff', ship.x, ship.y - 12);
        this.addFloatingText('SLIPPED', '#88aaff', target.x, target.y - 18);
        this.addLog(`${this._shipLabel(ship)} → ${this._shipLabel(target)}: time-slipped — resets in ${CONSTANTS.TIMESLIP_RECOVERY_TURNS} turns!`);
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerFrenzy = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const halfAngle = CONSTANTS.FRENZY_CONE_HALF_ANGLE;
        const range = CONSTANTS.FRENZY_RANGE;
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s.alive && !s.isBomb && !s.isSwarmlet && !s.isTorpedo);
        const inCone = allShips.filter(s => {
            if (s === ship) return true;
            const dist = distance(ship.x, ship.y, s.x, s.y);
            if (dist > range) return false;
            const ang = Math.atan2(s.y - ship.y, s.x - ship.x);
            return Math.abs(normalizeAngle(ang - ship.rotation)) <= halfAngle;
        });
        inCone.forEach(t => {
            t.frenzyTurns = CONSTANTS.FRENZY_TURNS;
            this.addFloatingText('FRENZIED!', '#ff2244', t.x, t.y - 18);
        });
        const cx = ship.x + Math.cos(ship.rotation) * range / 2;
        const cy = ship.y + Math.sin(ship.rotation) * range / 2;
        this.addAnimation({ type: 'flashBlast', x: cx, y: cy, duration: 400, totalDuration: 400 });
        this.addFloatingText('Frenzy!', '#ff2244', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)} → Frenzy: ${inCone.length} ship(s) frenzied for ${CONSTANTS.FRENZY_TURNS} turns!`);
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['frenzy'] = CONSTANTS.SPECIAL_MOVES.frenzy.cooldown;
        this.playerMode = null;
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerNeutralize = function(ship, tx, ty) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);

        const blastRadius = CONSTANTS.NEUTRALIZE_BLAST_RADIUS;
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s.alive && distance(s.x, s.y, tx, ty) <= blastRadius);

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['neutralize'] = CONSTANTS.SPECIAL_MOVES.neutralize.cooldown;
        this.playerMode = null;

        this.addFloatingText('Neutralize!', '#ccff66', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: Neutralize!`);

        const blastDur = 600;
        this.addAnimation({ type: 'empBlast', x: tx, y: ty, duration: blastDur, totalDuration: blastDur });

        const self = this;
        setTimeout(() => {
            // Strip all status effects from ships in blast
            allShips.forEach(target => {
                if (!target.alive) return;
                const stripped = [];
                if ((target.markedTurns || 0) > 0)       { target.markedTurns = 0;       stripped.push('mark'); }
                if ((target.berserkTurns || 0) > 0)      { target.berserkTurns = 0;      stripped.push('berserk'); }
                if ((target.superchargedTurns || 0) > 0) { target.superchargedTurns = 0; stripped.push('supercharge'); }
                if ((target.blindedTurns || 0) > 0)      { target.blindedTurns = 0;      stripped.push('blind'); }
                if ((target.anchoredTurns || 0) > 0)     { target.anchoredTurns = 0;     stripped.push('anchor'); }
                if ((target.webTurns || 0) > 0)          { target.webTurns = 0;          stripped.push('web'); }
                if ((target.frenzyTurns || 0) > 0)       { target.frenzyTurns = 0;       stripped.push('frenzy'); }
                if ((target.timeslipTurns || 0) > 0)     { target.timeslipTurns = 0; target.timeslipData = null; stripped.push('timeslip'); }
                if (target.cloaked)                       { target.decloak();             stripped.push('cloak'); }
                if (stripped.length > 0) {
                    self.addFloatingText('CLEANSED', '#ccff66', target.x, target.y - 6);
                    self.addLog(`${self._shipLabel(ship)} neutralized ${self._shipLabel(target)}: cleared ${stripped.join(', ')}`);
                }
            });

            // Remove clouds overlapping the blast area
            const before = self.clouds.length;
            self.clouds = self.clouds.filter(c => distance(c.x, c.y, tx, ty) > blastRadius + Math.max(c.rx, c.ry));
            if (self.clouds.length < before) {
                self.addLog(`${self._shipLabel(ship)}: ${before - self.clouds.length} cloud(s) dispersed`);
            }
            if (allShips.length === 0 && self.clouds.length === before) {
                self.addLog(`${self._shipLabel(ship)}: Neutralize — nothing in range`);
            }
        }, blastDur * 0.2);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerGammaRay = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);

        const range     = this.getShootRange(ship);
        const halfAngle = CONSTANTS.GAMMA_RAY_HALF_ANGLE;
        const allShips  = [...this.playerShips, ...this.enemyShips].filter(s => s.alive && s !== ship);
        const inCone    = allShips.filter(s => {
            const dist = distance(ship.x, ship.y, s.x, s.y);
            if (dist > range) return false;
            const ang = Math.atan2(s.y - ship.y, s.x - ship.x);
            return Math.abs(normalizeAngle(ang - ship.rotation)) <= halfAngle;
        });
        const inConeAsteroids = this.asteroids.filter(a => {
            const dist = distance(ship.x, ship.y, a.x, a.y);
            if (dist > range) return false;
            const ang = Math.atan2(a.y - ship.y, a.x - ship.x);
            return Math.abs(normalizeAngle(ang - ship.rotation)) <= halfAngle;
        });

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['gamma_ray'] = CONSTANTS.SPECIAL_MOVES.gamma_ray.cooldown;
        this.playerMode = null;

        // Beam animation from ship toward forward
        const beamEndX = ship.x + Math.cos(ship.rotation) * range;
        const beamEndY = ship.y + Math.sin(ship.rotation) * range;
        const animDur  = CONSTANTS.COMBAT_ANIMATION_SPEED;
        this.addAnimation({ type: 'laser', from: { x: ship.x, y: ship.y }, to: { x: beamEndX, y: beamEndY }, duration: animDur, totalDuration: animDur, color: 'ion' });

        this.addFloatingText('Gamma Ray!', '#bbff44', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: Gamma Ray — ${inCone.length} target(s) in cone`);

        const self = this;
        setTimeout(() => {
            inCone.forEach(t => {
                if (!t.alive) return;
                const dmg = randomInt(1, 5);
                const { shieldAbsorb, hullDmg } = t.takeDamage(dmg, true);
                t.triggerHitFlash(hullDmg, shieldAbsorb);
                if (shieldAbsorb > 0) self.addFloatingText(`-${shieldAbsorb}`, '#4488ff', t.x, t.y - 20);
                if (hullDmg > 0)      self.addFloatingText(`-${hullDmg}`,      '#bbff44', t.x, t.y - 6);
                self.addLog(`${self._shipLabel(ship)} γ ${self._shipLabel(t)}: -${dmg} damage`);
                if (!t.alive) {
                    self.addAnimation({ type: 'explosion', x: t.x, y: t.y, duration: CONSTANTS.EXPLOSION_DURATION });
                    self.addLog(`${self._shipLabel(t)} destroyed!`);
                }
            });
            inConeAsteroids.forEach(a => {
                a.radius = Math.max(0, a.radius - randomInt(1, 3));
                if (a.radius <= 0) {
                    const idx = self.asteroids.indexOf(a);
                    if (idx !== -1) self.asteroids.splice(idx, 1);
                }
            });
        }, animDur);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerSalvage = function(ship, target) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        // Restore the dead ship
        target.hull = target.maxHull;
        target.shields = 0;
        target.alive = true;
        target.actionsRemaining = 0;
        target.frenzyTurns = 0;
        target.timeslipTurns = 0;
        target.timeslipData = null;
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['salvage'] = CONSTANTS.SPECIAL_MOVES.salvage.cooldown;
        this.playerMode = null;
        this.addAnimation({ type: 'tractorBeam', from: { x: ship.x, y: ship.y }, to: { x: target.x, y: target.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
        this.addAnimation({ type: 'blinkRing', x: target.x, y: target.y, radius: 35, duration: 600, totalDuration: 600 });
        this.addFloatingText('Salvage!', '#00ff88', ship.x, ship.y - 12);
        this.addFloatingText('REVIVED!', '#00ff88', target.x, target.y - 18);
        this.addLog(`${this._shipLabel(ship)} salvaged ${target.name} — restored to full hull!`);
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerTorpedo = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const spawnX = ship.x + Math.cos(ship.rotation) * CONSTANTS.SHIP_SIZE * 4;
        const spawnY = ship.y + Math.sin(ship.rotation) * CONSTANTS.SHIP_SIZE * 4;
        const torpedo = new Ship(spawnX, spawnY, ship.isPlayer, ship.rotation,
            { hull: 20, shields: 0, laser: 0, radar: 0, engine: CONSTANTS.TORPEDO_ENGINE, type: 'Torpedo' }
        );
        torpedo.isTorpedo = true;
        torpedo.torpedoLifetime = CONSTANTS.TORPEDO_LIFETIME;
        torpedo.noCorpse = true;
        if (ship.isPlayer) this.playerShips.push(torpedo);
        else this.enemyShips.push(torpedo);
        this.addAnimation({ type: 'blinkRing', x: spawnX, y: spawnY, radius: 12, duration: 250, totalDuration: 250 });
        this.addFloatingText('Torpedo!', '#ff6600', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: torpedo launched!`);
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['torpedo'] = CONSTANTS.SPECIAL_MOVES.torpedo.cooldown;
        this.playerMode = null;
        this._pendingOverlapCheck = true;
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype._detonateTorpedo = function(ship) {
        const tx = ship.x, ty = ship.y;
        const blastRadius = CONSTANTS.TORPEDO_BLAST_RADIUS;
        ship.alive = false;
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s !== ship && s.alive && !s.isTorpedo && !s.isSwarmlet);
        this.addAnimation({ type: 'warheadBlast', x: tx, y: ty, radius: blastRadius, duration: 500, totalDuration: 500 });
        this.addLog('Torpedo detonated!');
        const self = this;
        setTimeout(() => {
            allShips.filter(s => distance(s.x, s.y, tx, ty) <= blastRadius).forEach(t => {
                const ratio = Math.max(0, 1 - distance(t.x, t.y, tx, ty) / blastRadius);
                const dmg = Math.max(1, Math.round(CONSTANTS.WARHEAD_MAX_DAMAGE * ratio));
                const result = t.takeDamage(dmg);
                t.triggerHitFlash(result.hullDmg, result.shieldAbsorb);
                if (result.hullDmg > 0) self.addFloatingText(`-${result.hullDmg}`, '#ff4444', t.x, t.y - 6);
                if ((t.anchoredTurns || 0) <= 0 && (t.phasedTurns || 0) <= 0) {
                    const knockAng = Math.atan2(t.y - ty, t.x - tx);
                    const knockDist = CONSTANTS.WARHEAD_KNOCKBACK * ratio;
                    t.targetX = t.x + Math.cos(knockAng) * knockDist;
                    t.targetY = t.y + Math.sin(knockAng) * knockDist;
                    t._moveDuration = 400;
                    t._moveElapsed = 0;
                    t._moveStarted = false;
                    t.isMoving = true;
                }
                if (!t.alive) {
                    self.addAnimation({ type: 'explosion', x: t.x, y: t.y, duration: CONSTANTS.EXPLOSION_DURATION, totalDuration: CONSTANTS.EXPLOSION_DURATION });
                    self.addLog(`${self._shipLabel(t)}: destroyed by torpedo!`);
                }
            });
        }, 300);
};

Combat.prototype.playerMark = function(ship, target) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        target.markedTurns = CONSTANTS.MARK_TURNS;
        if (target.cloaked) target.decloak();

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['mark'] = CONSTANTS.SPECIAL_MOVES.mark.cooldown;
        this.playerMode = null;

        this.addAnimation({ type: 'tractorBeam', from: { x: ship.x, y: ship.y }, to: { x: target.x, y: target.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
        this.addFloatingText('Marked!', '#ff8800', ship.x, ship.y - 12);
        this.addFloatingText('MARKED!', '#ff8800', target.x, target.y - 18);
        this.addLog(`${this._shipLabel(ship)} marked ${this._shipLabel(target)} — auto-hit for ${CONSTANTS.MARK_TURNS} turns!`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerAnchor = function(ship, target) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        target.anchoredTurns = CONSTANTS.ANCHOR_TURNS;
        if (target.cloaked) target.decloak();

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['anchor'] = CONSTANTS.SPECIAL_MOVES.anchor.cooldown;
        this.playerMode = null;

        this.addAnimation({ type: 'tractorBeam', from: { x: ship.x, y: ship.y }, to: { x: target.x, y: target.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
        this.addFloatingText('Anchored!', '#6699ff', ship.x, ship.y - 12);
        this.addFloatingText('ANCHORED!', '#6699ff', target.x, target.y - 18);
        this.addLog(`${this._shipLabel(ship)} anchored ${this._shipLabel(target)} — cannot move for ${CONSTANTS.ANCHOR_TURNS} turns!`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerSiphon = function(ship, target) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const shieldDrain = Math.min(target.shields, randomInt(CONSTANTS.SIPHON_SHIELD_MIN, CONSTANTS.SIPHON_SHIELD_MAX));
        target.shields = Math.max(0, target.shields - shieldDrain);
        ship.shields = Math.min(ship.maxShields, ship.shields + shieldDrain);

        // Add 1 to all of the target's active cooldowns
        if (target.specialMoveCooldowns) {
            for (const id of Object.keys(target.specialMoveCooldowns)) {
                if (target.specialMoveCooldowns[id] > 0) target.specialMoveCooldowns[id]++;
            }
        }

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['siphon'] = CONSTANTS.SPECIAL_MOVES.siphon.cooldown;
        this.playerMode = null;

        this.addAnimation({ type: 'tractorBeam', from: { x: target.x, y: target.y }, to: { x: ship.x, y: ship.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
        this.addFloatingText('Siphon!', '#bb66ff', ship.x, ship.y - 12);
        if (shieldDrain > 0) {
            this.addFloatingText(`-${shieldDrain}`, '#4488ff', target.x, target.y - 6);
            this.addFloatingText(`+${shieldDrain} shields`, '#4488ff', ship.x, ship.y - 6);
        }
        this.addLog(`${this._shipLabel(ship)} siphoned ${this._shipLabel(target)}: -${shieldDrain} shields, cooldowns +1`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype._applyScatterBlink = function(ship) {
        const ang = randomFloat(0, Math.PI * 2);
        const nx = ship.x + Math.cos(ang) * CONSTANTS.SCATTER_BLINK_DIST;
        const ny = ship.y + Math.sin(ang) * CONSTANTS.SCATTER_BLINK_DIST;
        ship.x = nx; ship.y = ny;
        ship.targetX = nx; ship.targetY = ny;
        ship._moveStarted = false;
        const ringDur = 200;
        this.addAnimation({ type: 'blinkRing', x: nx, y: ny, duration: ringDur, totalDuration: ringDur });
        this.addFloatingText('Scatter!', '#bb88ff', nx, ny - 12);
        this._pendingOverlapCheck = true;
};

Combat.prototype.playerSwap = function(ship, target) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const sx = ship.x, sy = ship.y, sr = ship.rotation;
        const tx = target.x, ty = target.y, tr = target.rotation;

        ship.x = tx; ship.y = ty; ship.targetX = tx; ship.targetY = ty;
        ship.rotation = tr; ship.targetRotation = tr;
        ship._moveStarted = false;

        target.x = sx; target.y = sy; target.targetX = sx; target.targetY = sy;
        target.rotation = sr; target.targetRotation = sr;
        target._moveStarted = false;

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['swap'] = CONSTANTS.SPECIAL_MOVES.swap.cooldown;
        this.playerMode = null;

        const ringDur = 350;
        this.addAnimation({ type: 'blinkRing', x: sx, y: sy, duration: ringDur, totalDuration: ringDur });
        this.addAnimation({ type: 'blinkRing', x: tx, y: ty, duration: ringDur, totalDuration: ringDur });
        this.addFloatingText('Swap!', '#bb88ff', sx, sy - 12);
        this.addLog(`${this._shipLabel(ship)} swapped with ${this._shipLabel(target)}`);

        this._pendingOverlapCheck = true;
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerSummonMirror = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const spawnDist = CONSTANTS.ASTEROID_SHIP_RADIUS * 2 + 8;
        const ang = ship.rotation + Math.PI / 2;
        const sx = ship.x + Math.cos(ang) * spawnDist;
        const sy = ship.y + Math.sin(ang) * spawnDist;

        const mirrorStats = { hull: ship.maxHull, shields: ship.maxShields, laser: ship.laserDamage, radar: ship.radar, engine: ship.engine, type: ship.shipType };
        const mirror = new Ship(sx, sy, ship.isPlayer, ship.rotation, mirrorStats);
        mirror.isMirror = true;
        mirror.noCorpse = true;
        mirror.mirrorLifetime = 2;
        mirror.mirrorOrigin = ship;
        mirror.specialMoves = [];
        mirror.specialMoveCooldowns = {};
        mirror.builtinModules = [];
        mirror.modules = [];
        mirror.actionsRemaining = 0;
        mirror.inCombat = true;
        mirror.name = ship.name;
        mirror.shipType = ship.shipType;
        mirror.sizeMult = ship.sizeMult;

        // 50% chance to swap positions with caster
        if (Math.random() < 0.5) {
            mirror.x = ship.x; mirror.y = ship.y;
            mirror.targetX = ship.x; mirror.targetY = ship.y;
            mirror.rotation = ship.rotation; mirror.targetRotation = ship.rotation;
            ship.x = sx; ship.y = sy;
            ship.targetX = sx; ship.targetY = sy;
            ship._moveStarted = false;
        }

        if (ship.isPlayer) {
            this.playerShips.push(mirror);
        } else {
            this.enemyShips.push(mirror);
        }

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['summon_mirror'] = CONSTANTS.SPECIAL_MOVES.summon_mirror.cooldown;
        this.playerMode = null;

        const ringDur = 400;
        this.addAnimation({ type: 'blinkRing', x: mirror.x, y: mirror.y, duration: ringDur, totalDuration: ringDur });
        this.addFloatingText('Mirror!', '#cc88ff', ship.x, ship.y - 16);
        this.addLog(`${this._shipLabel(ship)}: Mirror summoned`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerDoom = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        ship.doomTurns = CONSTANTS.DOOM_TURNS;

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['doom'] = CONSTANTS.SPECIAL_MOVES.doom.cooldown;
        this.playerMode = null;

        this.addFloatingText('DOOM!', '#ff2200', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: DOOMED — will explode next round!`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerPhase = function(ship) {
        ship.phasedTurns = CONSTANTS.PHASE_TURNS;

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['phase'] = CONSTANTS.SPECIAL_MOVES.phase.cooldown;
        this.playerMode = null;

        this.addFloatingText('PHASE!', '#aaeeff', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: Phased for ${CONSTANTS.PHASE_TURNS} turns — untargetable and invincible`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerAbsorb = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const range = CONSTANTS.ABSORB_RANGE;
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s.alive && s !== ship && distance(ship.x, ship.y, s.x, s.y) <= range);

        let totalAbsorbed = 0;
        allShips.forEach(target => {
            const canDrain = Math.max(0, target.hull - 1);
            if (canDrain <= 0) return;
            const drain = randomInt(1, canDrain);
            target.hull -= drain;
            if (target.hull <= 0) { target.hull = 1; }
            target.triggerHitFlash(drain, 0);
            ship.hull = Math.min(ship.maxHull, ship.hull + drain);
            totalAbsorbed += drain;
            this.addFloatingText(`-${drain}`, '#ff4444', target.x, target.y - 6);
            this.addAnimation({ type: 'tractorBeam', from: { x: target.x, y: target.y }, to: { x: ship.x, y: ship.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
        });

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['absorb'] = CONSTANTS.SPECIAL_MOVES.absorb.cooldown;
        this.playerMode = null;

        this.addFloatingText('Absorb!', '#ff8844', ship.x, ship.y - 12);
        if (totalAbsorbed > 0) this.addFloatingText(`+${totalAbsorbed} hull`, '#88ff88', ship.x, ship.y - 6);
        this.addLog(`${this._shipLabel(ship)}: Absorb — drained ${totalAbsorbed} hull from ${allShips.length} ship(s)`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerTeleport = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const departX = ship.x, departY = ship.y;
        const r = randomFloat(0, this.arenaRadius * 0.85);
        const ang = randomFloat(0, Math.PI * 2);
        const nx = this.centerX + Math.cos(ang) * r;
        const ny = this.centerY + Math.sin(ang) * r;
        const nr = randomFloat(0, Math.PI * 2);

        ship.x = nx; ship.y = ny; ship.targetX = nx; ship.targetY = ny;
        ship.rotation = nr; ship.targetRotation = nr;
        ship._moveStarted = false;

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['teleport'] = CONSTANTS.SPECIAL_MOVES.teleport.cooldown;
        this.playerMode = null;

        const ringDur = 350;
        this.addAnimation({ type: 'blinkRing', x: departX, y: departY, duration: ringDur, totalDuration: ringDur });
        this.addAnimation({ type: 'blinkRing', x: nx, y: ny, duration: ringDur, totalDuration: ringDur });
        this.addFloatingText('Teleport!', '#bb88ff', departX, departY - 12);
        this.addLog(`${this._shipLabel(ship)}: Teleported!`);

        this._pendingOverlapCheck = true;
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerStasisField = function(ship, tx, ty) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        // Clamp to cast range
        const d = distance(ship.x, ship.y, tx, ty);
        const castRange = CONSTANTS.STASIS_CAST_RANGE;
        if (d > castRange && d > 0) { tx = ship.x + (tx - ship.x) / d * castRange; ty = ship.y + (ty - ship.y) / d * castRange; }

        const field = {
            x: tx, y: ty,
            radius: CONSTANTS.STASIS_RADIUS,
            turnsRemaining: CONSTANTS.STASIS_TURNS,
            initialRadius: CONSTANTS.STASIS_RADIUS,
        };
        if (!this.stasisFields) this.stasisFields = [];
        this.stasisFields.push(field);

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['stasis_field'] = CONSTANTS.SPECIAL_MOVES.stasis_field.cooldown;
        this.playerMode = null;

        this.addAnimation({ type: 'blinkRing', x: tx, y: ty, duration: 500, totalDuration: 500 });
        this.addFloatingText('Stasis!', '#88eeff', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: Stasis Field deployed`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerRavager = function(shooter, target) {
        if (this._guardFrenzied(shooter)) return;
        if (shooter.statusEffect === 'plasma') { this.addLog(`${this._shipLabel(shooter)}: cannot fire — overheated!`); return; }
        if (shooter.blindedTurns > 0)           { this.addLog(`${this._shipLabel(shooter)}: cannot fire — blinded!`);   return; }
        this._decloakDephase(shooter);

        const maxRange = this.getShootRange(shooter) * CONSTANTS.RAVAGER_RANGE_MULT;
        const dist     = distance(shooter.x, shooter.y, target.x, target.y);
        if (dist > maxRange) { this.addLog(`${this._shipLabel(shooter)}: target out of ravager range`); return; }

        const targetMarked = (target.markedTurns || 0) > 0;
        const hitChance = targetMarked ? 1 : 1 - (Math.min(1, dist / maxRange) * 0.5);

        this.addFloatingText('Ravager!', '#ff4422', shooter.x, shooter.y - 12);
        this.addAnimation({
            type: 'laser',
            from: { x: shooter.x, y: shooter.y },
            to:   { x: target.x, y: target.y },
            duration: CONSTANTS.COMBAT_ANIMATION_SPEED,
            totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED,
            color: 'ravager',
        });

        const self = this;
        setTimeout(() => {
            if (!target.alive) return;
            if (Math.random() >= hitChance) {
                self.addFloatingText('Miss!', '#555555', target.x, target.y - 6);
                self.addLog(`${self._shipLabel(shooter)} → ${self._shipLabel(target)}: ravager miss`);
                return;
            }
            const dmg = Math.max(1, shooter.laserDamage + randomInt(-2, 2));
            const { shieldAbsorb, hullDmg } = target.takeDamage(dmg, true);
            target.triggerHitFlash(hullDmg, shieldAbsorb);
            if (shieldAbsorb > 0) self.addFloatingText(`-${shieldAbsorb}`, '#4488ff', target.x, target.y - 20);
            if (hullDmg > 0)      self.addFloatingText(`-${hullDmg}`,      '#ff4444', target.x, target.y - 6);
            // Heal attacker by hull damage dealt
            if (hullDmg > 0) {
                const healed = Math.min(hullDmg, shooter.maxHull - shooter.hull);
                shooter.hull = Math.min(shooter.maxHull, shooter.hull + hullDmg);
                if (healed > 0) self.addFloatingText(`+${healed}`, '#88ff88', shooter.x, shooter.y - 6);
            }
            const parts = [];
            if (shieldAbsorb > 0) parts.push(`${shieldAbsorb} shld`);
            if (hullDmg > 0)      parts.push(`${hullDmg} hull`);
            self.addLog(`${self._shipLabel(shooter)} ravager → ${self._shipLabel(target)}: -${parts.join(' -')}`);
            if (!target.alive) {
                self.addAnimation({ type: 'explosion', x: target.x, y: target.y, duration: CONSTANTS.EXPLOSION_DURATION, totalDuration: CONSTANTS.EXPLOSION_DURATION });
                self.addLog(`${self._shipLabel(target)} destroyed!`);
            }
        }, CONSTANTS.COMBAT_ANIMATION_SPEED);

        shooter.actionsRemaining = Math.max(0, shooter.actionsRemaining - 1);
        this.playerMode = null;
        this.checkAutoAdvance(shooter);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype._performDoomDetonate = function(ship) {
        const tx = ship.x, ty = ship.y;
        const blastRadius = CONSTANTS.DOOM_BLAST_RADIUS;
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s !== ship && s.alive);
        const inBlast = allShips.filter(s => distance(s.x, s.y, tx, ty) <= blastRadius);

        ship.hull = 0; ship.alive = false;
        this.addFloatingText('DOOM!', '#ff2200', tx, ty - 12);
        this.addLog(`${this._shipLabel(ship)}: DOOMED — detonated!`);
        const blastDur = 600;
        this.addAnimation({ type: 'warheadBlast', x: tx, y: ty, duration: blastDur, totalDuration: blastDur });

        const self = this;
        setTimeout(() => {
            inBlast.forEach(target => {
                if (!target.alive) return;
                const dist = distance(tx, ty, target.x, target.y);
                const falloff = Math.max(0, 1 - dist / blastRadius);
                const dmg = Math.max(1, Math.round(CONSTANTS.WARHEAD_MAX_DAMAGE * 0.5 * falloff));
                const { shieldAbsorb, hullDmg } = target.takeDamage(dmg);
                target.triggerHitFlash(hullDmg, shieldAbsorb);
                if (shieldAbsorb > 0) self.addFloatingText(`-${shieldAbsorb}`, '#4488ff', target.x, target.y - 20);
                if (hullDmg > 0)      self.addFloatingText(`-${hullDmg}`,      '#ff2200', target.x, target.y - 6);
                if (!target.alive) {
                    self.addAnimation({ type: 'explosion', x: target.x, y: target.y, duration: CONSTANTS.EXPLOSION_DURATION });
                    self.addLog(`${self._shipLabel(target)} destroyed!`);
                }
            });
            self.checkCombatEnd();
        }, blastDur * 0.25);
};

Combat.prototype.isShipInStasis = function(ship) {
        if (!this.stasisFields) return false;
        return this.stasisFields.some(f => distance(ship.x, ship.y, f.x, f.y) <= f.radius);
};

Combat.prototype.processBerserkPlayerTurn = function(ship) {
        if (!ship.alive || (ship.berserkTurns || 0) <= 0) {
            if (this.state === COMBAT_STATE.PLAYER_TURN) this.nextPlayerShip();
            return;
        }
        if (ship.actionsRemaining <= 0) {
            if (this.state === COMBAT_STATE.PLAYER_TURN) this.nextPlayerShip();
            return;
        }

        ship.actionsRemaining--;
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s.alive && s !== ship && !s.isBomb);
        AISystem.berserkAction(ship, allShips, this);
        UISystem.updateCombatScreen(gameState, this);
        setTimeout(() => this.processBerserkPlayerTurn(ship), CONSTANTS.AI_DECISION_DELAY);
};

Combat.prototype.playerFlash = function(ship, tx, ty) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const range       = CONSTANTS.FLASH_RANGE;
        const blastRadius = CONSTANTS.FLASH_BLAST_RADIUS;

        // Clamp origin to range
        const d = distance(ship.x, ship.y, tx, ty);
        if (d > range) { tx = ship.x + (tx - ship.x) / d * range; ty = ship.y + (ty - ship.y) / d * range; }

        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s.alive);
        const hit = allShips.filter(s => distance(tx, ty, s.x, s.y) <= blastRadius);

        this.addAnimation({ type: 'flashBlast', x: tx, y: ty, duration: 500, totalDuration: 500 });
        this.addFloatingText('Flash!', '#ffffaa', ship.x, ship.y - 12);

        const self = this;
        setTimeout(() => {
            hit.forEach(t => {
                const flashDmg = randomInt(CONSTANTS.FLASH_DAMAGE_MIN, CONSTANTS.FLASH_DAMAGE_MAX);
                t.hull = Math.max(0, t.hull - flashDmg);
                if (t.hull <= 0) t.alive = false;
                t.blindedTurns = CONSTANTS.FLASH_BLIND_TURNS;
                t.triggerHitFlash(flashDmg, 0);
                self.addFloatingText('Blinded!', '#ffffaa', t.x, t.y - 18);
                self.addFloatingText(`-${flashDmg}`, '#ffff44', t.x, t.y - 6);
                if (!t.alive) {
                    self.addAnimation({ type: 'explosion', x: t.x, y: t.y, duration: CONSTANTS.EXPLOSION_DURATION, totalDuration: CONSTANTS.EXPLOSION_DURATION });
                    self.addLog(`${self._shipLabel(t)}: destroyed!`);
                }
            });
            self.addLog(`${self._shipLabel(ship)} Flash → ${hit.length} ship(s) blinded`);
        }, 300);

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['flash'] = CONSTANTS.SPECIAL_MOVES.flash.cooldown;
        this.playerMode = null;
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerCloak = function(ship) {
        ship.cloaked = true;
        ship.cloakTurnsRemaining = randomInt(CONSTANTS.CLOAK_MIN_TURNS, CONSTANTS.CLOAK_MAX_TURNS);
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['cloak'] = CONSTANTS.SPECIAL_MOVES.cloak.cooldown;
        this.playerMode = null;

        this.addFloatingText('Cloaked!', '#88ffcc', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: cloaked for ${ship.cloakTurnsRemaining} turns`);
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerTractorBeam = function(ship, target) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);

        this.addAnimation({
            type: 'tractorBeam',
            from: { x: ship.x, y: ship.y },
            to:   { x: target.x, y: target.y },
            duration: CONSTANTS.COMBAT_ANIMATION_SPEED,
            totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED
        });

        const dx = target.x - ship.x;
        const dy = target.y - ship.y;

        if (target instanceof Asteroid) {
            // Pull asteroid 1/3 of the way toward ship; give it a velocity toward the ship
            const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            target.x -= dx / 3;
            target.y -= dy / 3;
            target.vx = (-dx / dist) * CONSTANTS.ASTEROID_SPLIT_SPEED;
            target.vy = (-dy / dist) * CONSTANTS.ASTEROID_SPLIT_SPEED;
            target.isMoving = true;
            this.addFloatingText('Tractor!', '#00eeff', target.x, target.y - 6);
            this.addLog(`${this._shipLabel(ship)} tractor beam → asteroid`);
        } else {
            // Ship: target moves 1/3 toward puller, puller moves 1/6 toward target
            target.targetX = target.x - dx / 3;
            target.targetY = target.y - dy / 3;
            target.targetRotation = Math.atan2(ship.y - target.y, ship.x - target.x);
            target.isMoving = true;
            target._moveStarted = false;
            this.addLog(`${this._shipLabel(ship)} tractor beam → ${this._shipLabel(target)}`);
        }

        ship.targetX = ship.x + dx / 6;
        ship.targetY = ship.y + dy / 6;
        ship.targetRotation = Math.atan2(target.y - ship.y, target.x - ship.x);
        ship.isMoving = true;
        ship._moveStarted = false;

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['tractor_beam'] = CONSTANTS.SPECIAL_MOVES.tractor_beam.cooldown;
        this.playerMode = null;

        this.addFloatingText('Tractor Beam!', '#00eeff', ship.x, ship.y - 12);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerDebrisField = function(ship) {
        if (this._guardFrenzied(ship)) return;
        this._decloakDephase(ship);
        const count = randomInt(CONSTANTS.DEBRIS_FIELD_MIN, CONSTANTS.DEBRIS_FIELD_MAX);
        const halfAngle = CONSTANTS.DEBRIS_FIELD_CONE_HALF_ANGLE;
        const launchDist = CONSTANTS.DEBRIS_FIELD_LAUNCH_DIST;
        const speed = CONSTANTS.DEBRIS_FIELD_SPEED;
        const radius = CONSTANTS.ASTEROID_MIN_RADIUS;
        const srcX = ship.x, srcY = ship.y;

        for (let i = 0; i < count; i++) {
            const spread = randomFloat(-halfAngle, halfAngle);
            const ang = ship.rotation + Math.PI + spread;
            const ax = ship.x + Math.cos(ang) * launchDist;
            const ay = ship.y + Math.sin(ang) * launchDist;
            const asteroidSpeed = speed * randomFloat(0.45, 1.0);
            const asteroid = new Asteroid(ax, ay, radius, Math.cos(ang) * asteroidSpeed, Math.sin(ang) * asteroidSpeed);
            asteroid._debrisSourceX = srcX;
            asteroid._debrisSourceY = srcY;
            this.asteroids.push(asteroid);
        }

        // Momentum: debris fires backward, ship lurches forward
        ship.targetX = ship.x + Math.cos(ship.rotation) * CONSTANTS.DEBRIS_MOMENTUM;
        ship.targetY = ship.y + Math.sin(ship.rotation) * CONSTANTS.DEBRIS_MOMENTUM;
        ship._moveDuration = 250;
        ship._moveElapsed  = 0;
        ship._moveStarted  = false;
        ship.isMoving = true;

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['debris_field'] = CONSTANTS.SPECIAL_MOVES.debris_field.cooldown;
        this.playerMode = null;

        this.addFloatingText('Debris Field!', '#cc8844', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: Debris Field — ${count} rocks launched!`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerMoveToPoint = function(ship, targetX, targetY) {
        if ((ship.anchoredTurns || 0) > 0) {
            this.addLog(`${this._shipLabel(ship)}: cannot move — anchored!`);
            this.addFloatingText('Anchored!', '#6699ff', ship.x, ship.y - 12);
            return;
        }
        const dist = Math.round(distance(ship.x, ship.y, targetX, targetY));
        ship.targetX = targetX;
        ship.targetY = targetY;
        ship.targetRotation = Math.atan2(targetY - ship.y, targetX - ship.x);
        ship.isMoving = true;
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);

        this.addLog(`${this._shipLabel(ship)} moved ${dist}u`);
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.playerRamShip = function(rammer, target) {
        if ((rammer.anchoredTurns || 0) > 0) {
            this.addLog(`${this._shipLabel(rammer)}: cannot ram — anchored!`);
            this.addFloatingText('Anchored!', '#6699ff', rammer.x, rammer.y - 12);
            return;
        }
        if ((target.phasedTurns || 0) > 0) {
            this.addLog(`${this._shipLabel(rammer)}: target is phased — cannot ram!`);
            return;
        }
        const dist = distance(rammer.x, rammer.y, target.x, target.y);
        const moveDistance = Math.min(dist, rammer.engine);
        this.performRam(rammer, target, moveDistance);
        UISystem.updateCombatScreen(gameState, this);
};

Combat.prototype.performRam = function(rammer, target, moveDistance) {
        this._decloakDephase(rammer);
        this.addFloatingText('Ram!', '#ff8800', rammer.x, rammer.y - 12);
        // Random 1–engine damage; target takes 2× — both bypass shields (direct hull)
        const ramDmg = randomInt(1, rammer.engine);
        const targetDmg = ramDmg * 2;

        const ang = Math.atan2(target.y - rammer.y, target.x - rammer.x);
        // Stop just outside collision radius so resolveOverlaps doesn't immediately re-damage both ships
        const ramStopDist = CONSTANTS.ASTEROID_SHIP_RADIUS * ((rammer.sizeMult ?? 1.0) + (target.sizeMult ?? 1.0)) + 8;
        rammer.targetX = target.x - Math.cos(ang) * ramStopDist;
        rammer.targetY = target.y - Math.sin(ang) * ramStopDist;
        rammer.targetRotation = ang;
        rammer.isMoving = true;
        rammer.actionsRemaining = Math.max(0, rammer.actionsRemaining - 1); // costs 1 action like a move

        // Rammer self-damage immediately — direct hull, no shields
        if (rammer.collisionImmune) {
            this.addFloatingText('Nullified!', '#88ff88', rammer.x, rammer.y - 8);
        } else {
            rammer.hull = Math.max(0, rammer.hull - ramDmg);
            if (rammer.hull <= 0) rammer.alive = false;
            rammer.triggerHitFlash(ramDmg, 0);
            this.addFloatingText(`-${ramDmg}`, '#ff4444', rammer.x, rammer.y - 8);
        }

        this.addLog(`${this._shipLabel(rammer)} rammed ${this._shipLabel(target)}: -${rammer.collisionImmune ? 0 : ramDmg} hull self, -${target.collisionImmune ? 0 : targetDmg} hull target`);

        // Defer target damage, knockback, and explosion until rammer arrives
        const travelDist = distance(rammer.x, rammer.y, rammer.targetX, rammer.targetY);
        const delay = Math.ceil(travelDist / CONSTANTS.SHIP_ANIMATION_SPEED);
        const pushDist = moveDistance * CONSTANTS.RAM_PUSHBACK_FACTOR;
        const self = this;

        setTimeout(() => {
            // Direct hull damage — bypasses shields entirely
            if (target.collisionImmune) {
                self.addFloatingText('Nullified!', '#88ff88', target.x, target.y - 6);
            } else {
                target.hull = Math.max(0, target.hull - targetDmg);
                if (target.hull <= 0) target.alive = false;
                target.triggerHitFlash(targetDmg, 0);
                self.addFloatingText(`-${targetDmg}`, '#ff4444', target.x, target.y - 6);
            }

            if ((target.anchoredTurns || 0) <= 0) {
                target.targetX = target.x + Math.cos(ang) * pushDist;
                target.targetY = target.y + Math.sin(ang) * pushDist;
                target.isMoving = true;
            }
            // Scatter: 50% mini-blink on ram
            if (target.hasScatter && (target.anchoredTurns || 0) <= 0 && Math.random() < 0.5) {
                self._applyScatterBlink(target);
            }

            if (!target.alive) {
                self.addAnimation({ type: 'explosion', x: target.x, y: target.y, duration: CONSTANTS.EXPLOSION_DURATION });
                self.addLog(`${self._shipLabel(target)} destroyed!`);
            }
            if (!rammer.alive) {
                self.addAnimation({ type: 'explosion', x: rammer.x, y: rammer.y, duration: CONSTANTS.EXPLOSION_DURATION });
                self.addLog(`${self._shipLabel(rammer)} destroyed!`);
            }
        }, delay);

        this.checkAutoAdvance(rammer);
};

