// Combat System
class Combat {
    constructor(playerShips, enemyShips, options = {}) {
        this.playerShips = playerShips;
        this.enemyShips = enemyShips;

        // options.enemyFirst — AI acts before player on round 1
        // options.ambush    — enemy starts with 0 shields, facing away from arena center
        this.options = options;

        this.state = COMBAT_STATE.PLAYER_TURN;
        this.round = 1;
        this.currentShipIndex = 0;
        this.turn = 0;

        this.centerX = CONSTANTS.GAME_WIDTH / 2;
        this.centerY = CONSTANTS.GAME_HEIGHT / 2;
        this.arenaRadius = CONSTANTS.COMBAT_ARENA_RADIUS;

        this.animations = [];
        this.combatLog = [];
        this.resolving = false;
        this.won = false;
        this.lost = false;
        this.playerRetreated = false;
        this.fleedPlayerShips = [];
        this.fleedEnemyShips = [];
        this.selectedCombatShip = null;
        this.playerMode = null; // 'move' | 'fire' | null
        this.encounterFaction = options.encounterFaction || null;

        this.asteroids  = [];
        this.clouds     = [];
        this.cloudType  = null;

        // EXP tracking — accumulates during combat, flushed to gameState on end
        this.expGained = 0;
        this._expAwardedFor = new Set(); // ship objects already awarded exp

        this.initAsteroids();
        this.initClouds();
        this.initializeShipPositions(options.ambush);
        // Apply start-of-turn effects for the first player ship (unless enemy goes first)
        if (!options.enemyFirst) {
            const firstAlive = this.playerShips.find(s => s.alive);
            if (firstAlive) this.applyStartOfTurnEffects(firstAlive);
        }
    }

    initializeShipPositions(ambush = false) {
        const minDist = this.arenaRadius * 0.25;
        const maxDist = this.arenaRadius * 0.75;
        const MIN_SEP = 65;
        const MAX_TRIES = 50;
        const SHIP_R   = CONSTANTS.ASTEROID_SHIP_RADIUS;
        const placed = [];

        const clearOfAsteroids = (px, py) =>
            this.asteroids.every(a => distance(px, py, a.x, a.y) >= a.radius + SHIP_R + 8);

        const placeShip = (ship, arcCenter, faceAway = false) => {
            let px, py, ok = false;
            for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
                const r   = randomFloat(minDist, maxDist);
                const ang = arcCenter + randomFloat(-Math.PI / 4, Math.PI / 4);
                px = this.centerX + Math.cos(ang) * r;
                py = this.centerY + Math.sin(ang) * r;
                if (placed.every(p => distance(p.x, p.y, px, py) >= MIN_SEP) && clearOfAsteroids(px, py)) {
                    ok = true;
                    break;
                }
            }
            ship.x = px;
            ship.y = py;
            placed.push({ x: px, y: py });
            const toCenter = Math.atan2(this.centerY - ship.y, this.centerX - ship.x);
            const facing = faceAway ? toCenter + Math.PI : toCenter;
            ship.rotation = facing;
            ship.targetRotation = facing;
            ship.inCombat = true;
        };

        // Player ships: 90° arc on the left (±45° from west = π)
        this.playerShips.forEach(ship => placeShip(ship, Math.PI));
        // Enemy ships: 90° arc on the right; face away from center on ambush
        this.enemyShips.forEach(ship => placeShip(ship, 0, ambush));

        // Last resort: remove any asteroid still overlapping a ship after placement
        const allShips = [...this.playerShips, ...this.enemyShips];
        this.asteroids = this.asteroids.filter(a =>
            allShips.every(s => distance(s.x, s.y, a.x, a.y) >= a.radius + SHIP_R + 8)
        );

        if (ambush) {
            this.enemyShips.forEach(ship => { ship.shields = 0; });
            this.addLog('Ambush! Enemy caught off-guard — shields down, backs turned.');
        }
    }

    initAsteroids() {
        // If a route flag is set, use it directly; otherwise fall back to random chance
        if (this.options.hasAsteroids === false) return;
        if (this.options.hasAsteroids !== true && Math.random() > CONSTANTS.ASTEROID_SPAWN_CHANCE) return;
        const count = randomInt(CONSTANTS.ASTEROID_MIN_COUNT, CONSTANTS.ASTEROID_MAX_COUNT);
        const placed = [];

        for (let n = 0; n < count; n++) {
            const radius = randomFloat(CONSTANTS.ASTEROID_MIN_RADIUS, CONSTANTS.ASTEROID_MAX_RADIUS);
            let ax, ay, ok = false;

            for (let attempt = 0; attempt < 30; attempt++) {
                const ang  = randomFloat(0, Math.PI * 2);
                const dist = randomFloat(this.arenaRadius * 0.1, this.arenaRadius * 0.82);
                ax = this.centerX + Math.cos(ang) * dist;
                ay = this.centerY + Math.sin(ang) * dist;

                const nearOther = placed.some(p => distance(p.x, p.y, ax, ay) < radius + p.radius + 8);
                if (!nearOther) { ok = true; break; }
            }

            if (ok) {
                this.asteroids.push(new Asteroid(ax, ay, radius));
                placed.push({ x: ax, y: ay, radius });
            }
        }
    }

    initClouds() {
        // If a route cloud flag is set use it; null = no clouds; undefined = random fallback
        if (this.options.cloudType === null) return;
        if (this.options.cloudType !== undefined) {
            this.cloudType = this.options.cloudType;
        } else {
            if (Math.random() > CONSTANTS.CLOUD_SPAWN_CHANCE) return;
            const types = CONSTANTS.CLOUD_TYPES;
            this.cloudType = types[Math.floor(Math.random() * types.length)];
        }
        const count = randomInt(CONSTANTS.CLOUD_MIN_COUNT, CONSTANTS.CLOUD_MAX_COUNT);

        for (let n = 0; n < count; n++) {
            const ry    = randomFloat(CONSTANTS.CLOUD_MINOR_MIN, CONSTANTS.CLOUD_MINOR_MAX);
            const rx    = ry * randomFloat(CONSTANTS.CLOUD_ASPECT_MIN, CONSTANTS.CLOUD_ASPECT_MAX);
            const angle = randomFloat(0, Math.PI);
            let cx, cy, ok = false;

            for (let attempt = 0; attempt < 30; attempt++) {
                const ang  = randomFloat(0, Math.PI * 2);
                const dist = randomFloat(0, this.arenaRadius * 0.8);
                cx = this.centerX + Math.cos(ang) * dist;
                cy = this.centerY + Math.sin(ang) * dist;

                const candidate = new DustCloud(cx, cy, rx, ry, angle, this.cloudType);
                if (!this.clouds.some(c => candidate.overlaps(c))) { ok = true; break; }
            }

            if (ok) this.clouds.push(new DustCloud(cx, cy, rx, ry, angle, this.cloudType));
        }
    }

    isShipInCloud(ship) {
        return this.clouds.some(c => c.containsPoint(ship.x, ship.y));
    }

    isShipDusty(ship) {
        return this.cloudType === 'dust' && this.isShipInCloud(ship);
    }

    updateStatusFlags() {
        for (const ship of [...this.playerShips, ...this.enemyShips]) {
            if (!this.isShipInCloud(ship)) continue;
            if (this.cloudType === 'dust')   ship.dustTurns   = 1;
            else if (this.cloudType === 'ice')    ship.iceTurns    = 1;
            else if (this.cloudType === 'plasma') ship.plasmaTurns = 1;
        }
    }

    updateAsteroidPhysics(deltaTime) {
        const dt = deltaTime / 1000;
        let anySettled = false;
        for (const asteroid of this.asteroids) {
            if (!asteroid.isMoving) continue;
            asteroid.update(dt);
            if (!asteroid.isMoving) anySettled = true;
        }
        this.checkAsteroidShipCollisions();
        if (anySettled) this.resolveOverlaps();
    }

    checkAsteroidShipCollisions() {
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s.alive || (!s.noCorpse));
        const SHIP_R = CONSTANTS.ASTEROID_SHIP_RADIUS;
        const toSplit = []; // collect splits to apply after iteration

        // Iterate snapshot so splitAsteroid mutations don't affect the loop
        for (const asteroid of [...this.asteroids]) {
            if (!asteroid.isMoving) {
                asteroid._activeCollisions.clear();
                continue;
            }

            for (const ship of allShips) {
                const dist = distance(asteroid.x, asteroid.y, ship.x, ship.y);
                const minDist = SHIP_R * (ship.sizeMult ?? 1.0) + asteroid.radius;

                if (dist < minDist) {
                    if (!asteroid._activeCollisions.has(ship.name)) {
                        asteroid._activeCollisions.add(ship.name);
                        if (!ship.alive) {
                            // Dead ship: just get nudged by asteroid, no damage
                            const knockSrcX = asteroid._debrisSourceX !== undefined ? asteroid._debrisSourceX : asteroid.x;
                            const knockSrcY = asteroid._debrisSourceY !== undefined ? asteroid._debrisSourceY : asteroid.y;
                            const ang = Math.atan2(ship.y - knockSrcY, ship.x - knockSrcX);
                            ship.x += Math.cos(ang) * CONSTANTS.ASTEROID_KNOCKBACK * 0.5;
                            ship.y += Math.sin(ang) * CONSTANTS.ASTEROID_KNOCKBACK * 0.5;
                            toSplit.push({ asteroid, ang });
                        } else if ((ship.phasedTurns || 0) > 0) {
                            // phased — pass through, no damage or knockback
                        } else if (!ship.collisionImmune) {
                            ship.hull = Math.max(0, ship.hull - CONSTANTS.ASTEROID_COLLISION_DAMAGE);
                            if (ship.hull <= 0) ship.alive = false;
                            ship.triggerHitFlash(CONSTANTS.ASTEROID_COLLISION_DAMAGE, 0);
                            this.addFloatingText(`-${CONSTANTS.ASTEROID_COLLISION_DAMAGE}`, '#ff4444', ship.x, ship.y - 8);
                            this.addLog(`${this._shipLabel(ship)}: hit by asteroid!`);
                        } else {
                            this.addLog(`${this._shipLabel(ship)}: hit by asteroid! (dampened)`);
                        }

                        // Debris pushes away from the originating ship; random asteroids push away from impact point
                        const knockSrcX = asteroid._debrisSourceX !== undefined ? asteroid._debrisSourceX : asteroid.x;
                        const knockSrcY = asteroid._debrisSourceY !== undefined ? asteroid._debrisSourceY : asteroid.y;
                        const ang = Math.atan2(ship.y - knockSrcY, ship.x - knockSrcX);
                        if ((ship.anchoredTurns || 0) <= 0 && (ship.phasedTurns || 0) <= 0) {
                            ship.targetX = ship.x + Math.cos(ang) * CONSTANTS.ASTEROID_KNOCKBACK;
                            ship.targetY = ship.y + Math.sin(ang) * CONSTANTS.ASTEROID_KNOCKBACK;
                            ship.isMoving = true;
                            ship._moveStarted = false;
                        }

                        if (!ship.alive) {
                            this.addAnimation({ type: 'explosion', x: ship.x, y: ship.y, duration: CONSTANTS.EXPLOSION_DURATION });
                            this.addLog(`${this._shipLabel(ship)}: destroyed by asteroid!`);
                        }

                        // Asteroid splits on impact instead of deflecting
                        toSplit.push({ asteroid, ang });
                    }
                } else {
                    asteroid._activeCollisions.delete(ship.name);
                }
            }
        }

        toSplit.forEach(({ asteroid, ang }) => this.splitAsteroid(asteroid, ang));
    }

    resolveOverlaps() {
        if (this.state === COMBAT_STATE.ENDED) return;
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s.alive);
        const SHIP_R = CONSTANTS.ASTEROID_SHIP_RADIUS;
        const newlyDead = [];
        const asteroidsToSplit = [];

        // Accumulate per-ship knockback impulses so multiple overlapping ships get a net push
        const knockbackMap = new Map();
        const addKnockback = (ship, dx, dy) => {
            if ((ship.anchoredTurns || 0) > 0) return;
            if ((ship.phasedTurns || 0) > 0) return;
            if (!knockbackMap.has(ship)) knockbackMap.set(ship, { dx: 0, dy: 0 });
            const k = knockbackMap.get(ship);
            k.dx += dx;
            k.dy += dy;
        };

        if (!this._overlapDamagedPairs) this._overlapDamagedPairs = new Set();

        // Ship-ship: compute pushes but don't apply positions yet (applied as animation below)
        for (let i = 0; i < allShips.length; i++) {
            for (let j = i + 1; j < allShips.length; j++) {
                const a = allShips[i], b = allShips[j];
                if (!a.alive || !b.alive) continue;
                const dist = distance(a.x, a.y, b.x, b.y);
                const minDist = SHIP_R * (a.sizeMult ?? 1.0) + SHIP_R * (b.sizeMult ?? 1.0);
                if (dist < minDist) {
                    const overlap = minDist - dist;
                    const ang = dist > 0.1 ? Math.atan2(b.y - a.y, b.x - a.x) : randomFloat(0, Math.PI * 2);
                    const push = (overlap + 15) * 0.5;
                    addKnockback(a, -Math.cos(ang) * push, -Math.sin(ang) * push);
                    addKnockback(b,  Math.cos(ang) * push,  Math.sin(ang) * push);

                    if (a.isPlayer !== b.isPlayer) {
                        const pairKey = `${i}-${j}`;
                        if (!this._overlapDamagedPairs.has(pairKey)) {
                            this._overlapDamagedPairs.add(pairKey);
                            const dmg = CONSTANTS.ASTEROID_COLLISION_DAMAGE;
                            if (!a.collisionImmune) {
                                a.hull = Math.max(0, a.hull - dmg);
                                if (a.hull <= 0 && a.alive) { a.alive = false; newlyDead.push(a); }
                                a.triggerHitFlash(dmg, 0);
                                this.addFloatingText(`-${dmg}`, '#ff4444', a.x, a.y - 6);
                            }
                            if (!b.collisionImmune) {
                                b.hull = Math.max(0, b.hull - dmg);
                                if (b.hull <= 0 && b.alive) { b.alive = false; newlyDead.push(b); }
                                b.triggerHitFlash(dmg, 0);
                                this.addFloatingText(`-${dmg}`, '#ff4444', b.x, b.y - 6);
                            }
                            this.addLog(`${this._shipLabel(a)} ↔ ${this._shipLabel(b)}: collision!`);
                        }
                    }
                }
            }
        }

        // Apply knockback as ~500ms animations so ships visibly drift apart
        for (const [ship, push] of knockbackMap) {
            ship.targetX = ship.x + push.dx;
            ship.targetY = ship.y + push.dy;
            ship._moveDuration = 500;
            ship._moveElapsed = 0;
            ship._moveStarted = false;
            ship.isMoving = true;
        }

        // Ship-asteroid: immediate push (asteroid is a solid obstacle)
        for (const ship of allShips) {
            if (!ship.alive) continue;
            for (let k = 0; k < this.asteroids.length; k++) {
                const asteroid = this.asteroids[k];
                const dist = distance(ship.x, ship.y, asteroid.x, asteroid.y);
                const minDist = SHIP_R * (ship.sizeMult ?? 1.0) + asteroid.radius;
                if (dist < minDist) {
                    const overlap = minDist - dist;
                    const ang = dist > 0.1 ? Math.atan2(ship.y - asteroid.y, ship.x - asteroid.x) : randomFloat(0, Math.PI * 2);
                    ship.x += Math.cos(ang) * (overlap + 8);
                    ship.y += Math.sin(ang) * (overlap + 8);

                    const pairKey = `ship${ship.name}-ast${k}`;
                    if (!this._overlapDamagedPairs.has(pairKey)) {
                        this._overlapDamagedPairs.add(pairKey);
                        const dmg = CONSTANTS.ASTEROID_COLLISION_DAMAGE;
                        if (!ship.collisionImmune) {
                            ship.hull = Math.max(0, ship.hull - dmg);
                            if (ship.hull <= 0 && ship.alive) { ship.alive = false; newlyDead.push(ship); }
                            ship.triggerHitFlash(dmg, 0);
                            this.addFloatingText(`-${dmg}`, '#ff4444', ship.x, ship.y - 6);
                            this.addLog(`${this._shipLabel(ship)}: hit asteroid!`);
                        } else {
                            this.addLog(`${this._shipLabel(ship)}: hit asteroid! (dampened)`);
                        }
                        asteroidsToSplit.push({ asteroid, ang: Math.atan2(asteroid.y - ship.y, asteroid.x - ship.x) });
                    }
                }
            }
        }

        // Alive ship vs dead ship (corpse) — alive ship takes collision damage, dead ship gets nudged
        const deadShips = [...this.playerShips, ...this.enemyShips].filter(s => !s.alive && !s.noCorpse);
        for (const dead of deadShips) {
            for (const alive of allShips) {
                if (!alive.alive) continue;
                const dist = distance(alive.x, alive.y, dead.x, dead.y);
                const minDist = SHIP_R * (alive.sizeMult ?? 1.0) + SHIP_R * (dead.sizeMult ?? 1.0);
                if (dist < minDist) {
                    const overlap = minDist - dist;
                    const ang = dist > 0.1 ? Math.atan2(alive.y - dead.y, alive.x - dead.x) : randomFloat(0, Math.PI * 2);
                    const push = (overlap + 15) * 0.5;
                    addKnockback(alive, Math.cos(ang) * push, Math.sin(ang) * push);
                    // Nudge dead ship in opposite direction by the same amount
                    dead.x -= Math.cos(ang) * push;
                    dead.y -= Math.sin(ang) * push;
                    const pairKey = `alv${alive.name}-dsh${dead.name}`;
                    if (!this._overlapDamagedPairs.has(pairKey)) {
                        this._overlapDamagedPairs.add(pairKey);
                        if (!alive.collisionImmune && (alive.phasedTurns || 0) <= 0) {
                            const dmg = CONSTANTS.ASTEROID_COLLISION_DAMAGE;
                            alive.hull = Math.max(0, alive.hull - dmg);
                            if (alive.hull <= 0 && alive.alive) { alive.alive = false; newlyDead.push(alive); }
                            alive.triggerHitFlash(dmg, 0);
                            this.addFloatingText(`-${dmg}`, '#ff4444', alive.x, alive.y - 6);
                            this.addLog(`${this._shipLabel(alive)}: collided with wreck of ${dead.name}!`);
                        }
                    }
                }
            }
        }

        this._overlapDamagedPairs = new Set();

        asteroidsToSplit.forEach(({ asteroid, ang }) => this.splitAsteroid(asteroid, ang));

        newlyDead.forEach(ship => {
            this.addAnimation({ type: 'explosion', x: ship.x, y: ship.y, duration: CONSTANTS.EXPLOSION_DURATION });
            this.addLog(`${this._shipLabel(ship)}: destroyed in collision!`);
        });
    }

    splitAsteroid(asteroid, impactAngle) {
        const idx = this.asteroids.indexOf(asteroid);
        if (idx === -1) return;
        this.asteroids.splice(idx, 1);

        const newRadius = asteroid.radius / 1.5;
        if (newRadius < CONSTANTS.ASTEROID_MIN_SPLIT_RADIUS) {
            this.addAnimation({ type: 'explosion', x: asteroid.x, y: asteroid.y, duration: 250, totalDuration: 250 });
            return;
        }

        // Smaller fragments have increasing chance to disintegrate rather than split
        const logRange = Math.log(CONSTANTS.ASTEROID_MAX_RADIUS / CONSTANTS.ASTEROID_MIN_SPLIT_RADIUS);
        const destroyChance = Math.min(1, Math.log(CONSTANTS.ASTEROID_MAX_RADIUS / newRadius) / logRange);
        if (Math.random() < destroyChance) {
            this.addAnimation({ type: 'explosion', x: asteroid.x, y: asteroid.y, duration: 250, totalDuration: 250 });
            this.addLog('Asteroid disintegrated!');
            return;
        }

        const speed = CONSTANTS.ASTEROID_SPLIT_SPEED;
        const perp1 = impactAngle + Math.PI / 2;
        const perp2 = impactAngle - Math.PI / 2;
        const offset = newRadius * 0.6;
        const pvx = (asteroid.vx || 0) * 0.4;
        const pvy = (asteroid.vy || 0) * 0.4;

        const c1 = new Asteroid(
            asteroid.x + Math.cos(perp1) * offset,
            asteroid.y + Math.sin(perp1) * offset,
            newRadius,
            Math.cos(perp1) * speed + pvx,
            Math.sin(perp1) * speed + pvy
        );
        const c2 = new Asteroid(
            asteroid.x + Math.cos(perp2) * offset,
            asteroid.y + Math.sin(perp2) * offset,
            newRadius,
            Math.cos(perp2) * speed + pvx,
            Math.sin(perp2) * speed + pvy
        );
        this.asteroids.push(c1, c2);
        this.addFloatingText('Split!', '#ffaa44', asteroid.x, asteroid.y - 12);
        this.addLog('Asteroid split!');
    }

    getAsteroidAtPosition(wx, wy) {
        for (const asteroid of this.asteroids) {
            if (distance(asteroid.x, asteroid.y, wx, wy) <= asteroid.radius) return asteroid;
        }
        return null;
    }

    _decloakDephase(ship) {
        ship.decloak();
        if (ship.dephase()) {
            this.addFloatingText('Phase broken!', '#aaeeff', ship.x, ship.y - 18);
            this.addLog(`${this._shipLabel(ship)}: phase ended — action taken`);
        }
    }

    _guardFrenzied(ship) {
        if ((ship.frenzyTurns || 0) > 0) {
            this.addLog(`${this._shipLabel(ship)}: cannot use abilities while frenzied`);
            this.addFloatingText('FRENZIED!', '#ff2244', ship.x, ship.y - 12);
            return true;
        }
        return false;
    }

    playerShootAtAsteroid(shooter, asteroid) {
        this._decloakDephase(shooter);
        const maxRange = this.getShootRange(shooter);
        const dist = distance(shooter.x, shooter.y, asteroid.x, asteroid.y);
        const hitChance = 1 - (Math.min(1, dist / maxRange) * 0.5);
        const impactAngle = Math.atan2(asteroid.y - shooter.y, asteroid.x - shooter.x);

        // Check for obstructions between shooter and asteroid
        const obstruction = this.getPathObstructions(shooter, asteroid);
        const laserEnd = obstruction ? obstruction.entity : asteroid;

        this.addAnimation({
            type: 'laser',
            from: { x: shooter.x, y: shooter.y },
            to:   { x: laserEnd.x, y: laserEnd.y },
            duration: CONSTANTS.COMBAT_ANIMATION_SPEED,
            totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED
        });
        this.addFloatingText('Fire!', '#ff8800', shooter.x, shooter.y - 12);
        this.addLog(`${this._shipLabel(shooter)}: shot at asteroid`);

        const self = this;
        setTimeout(() => {
            if (obstruction) {
                self.addFloatingText('Missed!', '#555555', asteroid.x, asteroid.y - 6);
                self._applyLaserHitToObstruction(shooter, obstruction, asteroid);
            } else if (Math.random() < hitChance) {
                self.splitAsteroid(asteroid, impactAngle);
            } else {
                self.addFloatingText('Miss!', '#555555', asteroid.x, asteroid.y - 6);
                self.addLog(`${self._shipLabel(shooter)}: missed asteroid`);
            }
        }, CONSTANTS.COMBAT_ANIMATION_SPEED);

        shooter.actionsRemaining = Math.max(0, shooter.actionsRemaining - 1);
        this.checkAutoAdvance(shooter);
        UISystem.updateCombatScreen(gameState, this);
    }

    playerRamAsteroid(rammer, asteroid) {
        const ang = Math.atan2(asteroid.y - rammer.y, asteroid.x - rammer.x);
        const selfDmg = randomInt(1, Math.max(1, Math.floor(rammer.engine / 2)));

        if (!rammer.collisionImmune) {
            rammer.hull = Math.max(0, rammer.hull - selfDmg);
            if (rammer.hull <= 0) rammer.alive = false;
            rammer.triggerHitFlash(selfDmg, 0);
        }

        rammer.targetX = asteroid.x - Math.cos(ang) * (asteroid.radius + CONSTANTS.SHIP_SIZE * 2 * (rammer.sizeMult ?? 1.0));
        rammer.targetY = asteroid.y - Math.sin(ang) * (asteroid.radius + CONSTANTS.SHIP_SIZE * 2 * (rammer.sizeMult ?? 1.0));
        rammer.targetRotation = ang;
        rammer.isMoving = true;
        rammer._moveStarted = false;
        rammer.actionsRemaining = Math.max(0, rammer.actionsRemaining - 1);

        this.addFloatingText('Ram!', '#ff8800', rammer.x, rammer.y - 12);
        if (rammer.collisionImmune) {
            this.addFloatingText('Nullified!', '#88ff88', rammer.x, rammer.y - 6);
            this.addLog(`${this._shipLabel(rammer)}: rammed asteroid (dampened)`);
        } else {
            this.addFloatingText(`-${selfDmg}`, '#ff4444', rammer.x, rammer.y - 6);
            this.addLog(`${this._shipLabel(rammer)}: rammed asteroid (-${selfDmg} self hull)`);
        }

        const travelDist = distance(rammer.x, rammer.y, rammer.targetX, rammer.targetY);
        const delay = Math.ceil(travelDist / CONSTANTS.SHIP_ANIMATION_SPEED);
        const self = this;
        setTimeout(() => self.splitAsteroid(asteroid, ang), delay);

        if (!rammer.alive) {
            this.addAnimation({ type: 'explosion', x: rammer.x, y: rammer.y, duration: CONSTANTS.EXPLOSION_DURATION });
            this.addLog(`${this._shipLabel(rammer)}: destroyed!`);
        }

        this.checkAutoAdvance(rammer);
        UISystem.updateCombatScreen(gameState, this);
    }

    _isPhysicallyMoving() {
        for (const ship of [...this.playerShips, ...this.enemyShips]) {
            if (ship.isMoving) return true;
        }
        for (const asteroid of this.asteroids) {
            if (asteroid.isMoving) return true;
        }
        return false;
    }

    update(deltaTime) {
        const wasAnimating = this.isAnimating();
        const wasPhysicallyMoving = this._isPhysicallyMoving();
        this.updateShipAnimations(deltaTime);
        this.updateAsteroidPhysics(deltaTime);
        this.updateAnimationTimers(deltaTime);
        this._checkNewExpEvents();
        this.checkCombatEnd();
        if (wasAnimating && !this.isAnimating()) {
            // Only resolve overlaps when ships/asteroids actually moved — laser-only
            // animations don't physically displace ships, so skipping avoids spurious
            // collision flashes on unrelated nearby ships after a shot.
            if (wasPhysicallyMoving) this.resolveOverlaps();
            this.checkCombatEnd();
            if (this.state === COMBAT_STATE.PLAYER_TURN) {
                UISystem.updateCombatScreen(gameState, this);
            }
        }
        // Blink teleports without isMoving — check overlaps once blinkRing animation clears
        if (this._pendingOverlapCheck && !this.isAnimating()) {
            this._pendingOverlapCheck = false;
            this.resolveOverlaps();
        }
        this.updateStatusFlags();
        if (renderingSystem) {
            this.render();
        }
    }

    updateShipAnimations(deltaTime) {
        [this.playerShips, this.enemyShips].forEach(fleet => {
            fleet.forEach(ship => {
                if (!ship.alive) {
                    ship.isMoving = false;
                    ship._moveStarted = false;
                    return;
                }

                if (ship.isMoving) {
                    // Re-initialize if first frame of move or if target changed
                    if (!ship._moveStarted ||
                        ship._moveTargetX !== ship.targetX || ship._moveTargetY !== ship.targetY) {
                        ship._moveStartX = ship.x;
                        ship._moveStartY = ship.y;
                        ship._moveTargetX = ship.targetX;
                        ship._moveTargetY = ship.targetY;
                        ship._moveTotalDist = Math.max(1, distance(ship.x, ship.y, ship.targetX, ship.targetY));
                        ship._moveProgress = 0;
                        ship._moveElapsed = 0;
                        ship._moveStarted = true;
                    }

                    // Fixed-duration moves (e.g. knockback) use elapsed time; others use speed/distance
                    if (ship._moveDuration) {
                        ship._moveElapsed += deltaTime;
                        ship._moveProgress = Math.min(1, ship._moveElapsed / ship._moveDuration);
                    } else {
                        ship._moveProgress = Math.min(1,
                            ship._moveProgress + (deltaTime * CONSTANTS.SHIP_ANIMATION_SPEED) / ship._moveTotalDist);
                    }

                    // Smoothstep easing: p(t) = 3t²−2t³ — slow start, fast middle, slow end
                    const t = ship._moveProgress;
                    const st = t * t * (3 - 2 * t);
                    ship.x = ship._moveStartX + (ship.targetX - ship._moveStartX) * st;
                    ship.y = ship._moveStartY + (ship.targetY - ship._moveStartY) * st;

                    if (ship._moveProgress >= 1) {
                        ship.x = ship.targetX;
                        ship.y = ship.targetY;
                        ship.isMoving = false;
                        ship._moveStarted = false;
                        ship._moveDuration = null;
                        ship._moveElapsed = 0;
                    }
                }

                let rotDiff = normalizeAngle(ship.targetRotation - ship.rotation);
                if (Math.abs(rotDiff) > CONSTANTS.ROTATION_SNAP_THRESHOLD) {
                    ship.rotation += rotDiff * CONSTANTS.ROTATION_LERP_FACTOR;
                } else {
                    ship.rotation = ship.targetRotation;
                }
            });
        });

        // Staged escape: mark → wait for motion to stop → fade 1s → "Escaped!" text → remove
        const ESCAPE_FADE_MS = 1000;
        for (const fleet of [this.playerShips, this.enemyShips]) {
            fleet.forEach(s => {
                if (!s.alive) return;
                // Step 1: just crossed boundary — mark as escaping
                if (!s._escaping && !isShipInCombatArena(s, this.centerX, this.centerY, this.arenaRadius)) {
                    s._escaping = true;
                }
                // Step 2: motion finished — start fade timer
                if (s._escaping && !s.isMoving && !s._escapeFadeStart) {
                    s._escapeFadeStart = Date.now();
                }
            });
        }

        // Step 3: fade complete — show text and remove
        const self = this;
        const completedPlayers = this.playerShips.filter(s => s._escapeFadeStart && Date.now() - s._escapeFadeStart >= ESCAPE_FADE_MS);
        completedPlayers.forEach(s => {
            s.fled = true;
            self.fleedPlayerShips.push(s);
            self.playerRetreated = true;
            self.addFloatingText('Escaped!', '#88ff88', s.x, s.y - 12);
            self.addLog(`${self._shipLabel(s)}: Escaped!`);
            self.awardCombatExp(CONSTANTS.EXP_PER_SHIP_FLED || 5, s);
        });
        this.playerShips = this.playerShips.filter(s => !s.fled);

        const completedEnemies = this.enemyShips.filter(s => s._escapeFadeStart && Date.now() - s._escapeFadeStart >= ESCAPE_FADE_MS);
        completedEnemies.forEach(s => {
            s.fled = true;
            self.fleedEnemyShips.push(s);
            self.addFloatingText('Escaped!', '#ff8888', s.x, s.y - 12);
            self.addLog(`${self._shipLabel(s)}: Escaped!`);
        });
        this.enemyShips = this.enemyShips.filter(s => !s.fled);
    }

    getShootRange(ship) {
        const base = ship.radar * CONSTANTS.SHOOT_RANGE_BASE;
        return (ship.superchargedTurns || 0) > 0 ? base * 2 : base;
    }

    getTractorBeamRange(ship) {
        return ship.engine * (CONSTANTS.COMBAT_MOVE_OVAL_OFFSET + CONSTANTS.COMBAT_MOVE_OVAL_MAJOR) * CONSTANTS.AFTERBURNER_RANGE_MULT * 0.75;
    }

    isAnimating() {
        if (this.animations.some(a => a.type === 'laser' || a.type === 'chaingunBurst' || a.type === 'plasmaRound')) return true;
        for (const ship of [...this.playerShips, ...this.enemyShips]) {
            if (ship.isMoving) return true;
        }
        for (const asteroid of this.asteroids) {
            if (asteroid.isMoving) return true;
        }
        return false;
    }

    render() {
        renderingSystem.clear();
        renderingSystem.drawCombatArena(this.centerX, this.centerY, this.arenaRadius);

        const activeTurnShip = this.state === COMBAT_STATE.PLAYER_TURN
            ? this.playerShips[this.currentShipIndex]
            : null;

        // Draw range indicators only when mode is active and nothing is animating
        if (activeTurnShip && activeTurnShip.alive && !this.isAnimating()) {
            if (this.playerMode === 'move' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawMovementRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawMoveCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
            if (this.playerMode === 'fire' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawShootRange(activeTurnShip);
            }
            if (this.playerMode === 'blink' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawBlinkRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawBlinkCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
            if (this.playerMode === 'afterburner' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawAfterburnerRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawAfterburnerCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
            if (this.playerMode === 'bomb' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawBombRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawBombCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
            if (this.playerMode === 'tractor_beam' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawTractorBeamRange(activeTurnShip);
            }
            if (this.playerMode === 'emp_blast' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawEmpRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawEmpCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
            if (this.playerMode === 'repair_beam' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawRepairBeamRange(activeTurnShip);
            }
            if (this.playerMode === 'supercharge' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawSuperchargeRange(activeTurnShip);
            }
            if (this.playerMode === 'flash' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawFlashRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawFlashCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
            if (this.playerMode === 'possess' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawPossessRange(activeTurnShip);
            }
            if (this.playerMode === 'debris_field' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawDebrisFieldRange(activeTurnShip);
            }
            if (this.playerMode === 'mark' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawMarkRange(activeTurnShip);
            }
            if (this.playerMode === 'chaingun' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawChaingunRange(activeTurnShip);
            }
            if (this.playerMode === 'plasma_cannon' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawPlasmaRange(activeTurnShip);
            }
            if (this.playerMode === 'rocket_launcher' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawRocketRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawRocketCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
            if (this.playerMode === 'anchor' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawAnchorRange(activeTurnShip);
            }
            if (this.playerMode === 'siphon' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawSiphonRange(activeTurnShip);
            }
            if (this.playerMode === 'swap' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawSwapRange(activeTurnShip);
            }
            if (this.playerMode === 'absorb' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawAbsorbRange(activeTurnShip);
            }
            if (this.playerMode === 'ravager' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawRavagerRange(activeTurnShip);
            }
            if (this.playerMode === 'webbing' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawWebbingRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawWebbingCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
            if (this.playerMode === 'timeslip' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawTimeslipRange(activeTurnShip);
            }
            if (this.playerMode === 'frenzy' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawFrenzyRange(activeTurnShip);
            }
            if (this.playerMode === 'possess' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawPossessRange(activeTurnShip);
            }
            if (this.playerMode === 'neutralize' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawNeutralizeRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawNeutralizeCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
            if (this.playerMode === 'gamma_ray' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawGammaRayRange(activeTurnShip);
            }
            if (this.playerMode === 'stasis_field' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawStasisCastRange(activeTurnShip);
                if (renderingSystem.hoveredWorldX !== null) {
                    renderingSystem.drawStasisCursor(activeTurnShip, renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                }
            }
        }

        let hoveredShip = null;
        let hoveredAsteroid = null;
        if (renderingSystem.hoveredWorldX !== null) {
            const rawShip = this.getShipAtPosition(renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY, this.playerMode);
            if (rawShip) {
                hoveredShip = (!this.playerMode || this.playerMode === 'salvage' || this.isInteractableInMode(activeTurnShip, rawShip, null)) ? rawShip : null;
            } else {
                const rawAst = this.getAsteroidAtPosition(renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                if (rawAst) hoveredAsteroid = (!this.playerMode || this.isInteractableInMode(activeTurnShip, null, rawAst)) ? rawAst : null;
            }
        }

        const dimming = activeTurnShip && activeTurnShip.alive && !this.isAnimating() && this.playerMode;

        // Clouds — drawn first, behind everything
        this.clouds.forEach(cloud => renderingSystem.drawCloud(cloud));

        // Stasis fields — drawn above clouds, below ships
        if (this.stasisFields) {
            this.stasisFields.forEach(f => renderingSystem.drawStasisField(f));
        }

        // Draw wreckage first so it sits below living ships (skip noCorpse units)
        const inSalvageMode = this.playerMode === 'salvage';
        [this.playerShips, this.enemyShips].forEach(fleet => {
            fleet.forEach(ship => {
                if (!ship.alive && !ship.noCorpse) {
                    const isSalvageHovered = inSalvageMode && ship === hoveredShip;
                    const isDimmedWreck = inSalvageMode && ship.isPlayer ? !ship.isPlayer : false; // dim enemy wrecks in salvage
                    renderingSystem.drawShip(ship, false, false, isSalvageHovered, !inSalvageMode && false, true);
                }
            });
        });

        // Draw asteroids above wreckage, below living ships
        this.asteroids.forEach(asteroid => {
            let astDimmed = false;
            if (dimming && activeTurnShip) {
                if (this.playerMode === 'fire') {
                    const shootRange = this.getShootRange(activeTurnShip);
                    const inRange = distance(activeTurnShip.x, activeTurnShip.y, asteroid.x, asteroid.y) <= shootRange;
                    const inZone  = isInFiringZone(activeTurnShip, asteroid);
                    astDimmed = !(inRange && inZone);
                } else if (this.playerMode === 'chaingun') {
                    const shootRange = this.getShootRange(activeTurnShip);
                    const inRange = distance(activeTurnShip.x, activeTurnShip.y, asteroid.x, asteroid.y) <= shootRange;
                    astDimmed = !(inRange && isInFiringZone(activeTurnShip, asteroid));
                } else if (this.playerMode === 'plasma_cannon') {
                    const shootRange = this.getShootRange(activeTurnShip) * CONSTANTS.PLASMA_RANGE_MULT;
                    const inRange = distance(activeTurnShip.x, activeTurnShip.y, asteroid.x, asteroid.y) <= shootRange;
                    astDimmed = !(inRange && isInFiringZone(activeTurnShip, asteroid));
                } else if (this.playerMode === 'tractor_beam') {
                    const tractorRange = this.getTractorBeamRange(activeTurnShip);
                    const dist = distance(activeTurnShip.x, activeTurnShip.y, asteroid.x, asteroid.y);
                    const ang = Math.atan2(asteroid.y - activeTurnShip.y, asteroid.x - activeTurnShip.x);
                    const localAng = normalizeAngle(ang - activeTurnShip.rotation);
                    astDimmed = !(dist <= tractorRange && Math.abs(localAng) <= CONSTANTS.TRACTOR_BEAM_HALF_ANGLE);
                }
            }
            renderingSystem.drawAsteroid(asteroid, astDimmed, asteroid === hoveredAsteroid);
        });

        // Draw bombs (alive, static, special rendering)
        [this.playerShips, this.enemyShips].forEach(fleet => {
            fleet.forEach(ship => {
                if (ship.alive && ship.isBomb) renderingSystem.drawBomb(ship);
            });
        });

        // Draw alive ships (excluding bombs which are already drawn)
        [this.playerShips, this.enemyShips].forEach(fleet => {
            fleet.forEach(ship => {
                if (ship.alive && !ship.isBomb) {
                    const isActiveTurn = ship === activeTurnShip;
                    const isSelected = ship === this.selectedCombatShip && !this.playerMode;
                    const isHovered = ship === hoveredShip;

                    let isDimmed = false;
                    if (isActiveTurn) {
                        isDimmed = false;
                    } else if (dimming) {
                        if (this.playerMode === 'fire') {
                            const shootRange = this.getShootRange(activeTurnShip);
                            const inRange = distance(activeTurnShip.x, activeTurnShip.y, ship.x, ship.y) <= shootRange;
                            isDimmed = !(inRange && !ship.isPlayer && isInFiringZone(activeTurnShip, ship));
                        } else if (this.playerMode === 'chaingun') {
                            const shootRange = this.getShootRange(activeTurnShip);
                            const inRange = distance(activeTurnShip.x, activeTurnShip.y, ship.x, ship.y) <= shootRange;
                            isDimmed = !(inRange && !ship.isPlayer && isInFiringZone(activeTurnShip, ship));
                        } else if (this.playerMode === 'plasma_cannon') {
                            const shootRange = this.getShootRange(activeTurnShip) * CONSTANTS.PLASMA_RANGE_MULT;
                            const inRange = distance(activeTurnShip.x, activeTurnShip.y, ship.x, ship.y) <= shootRange;
                            isDimmed = !(inRange && !ship.isPlayer && isInFiringZone(activeTurnShip, ship));
                        } else if (this.playerMode === 'move') {
                            isDimmed = !(!ship.isPlayer && isWithinMovementOval(activeTurnShip, ship.x, ship.y));
                        } else if (this.playerMode === 'tractor_beam') {
                            const tractorRange = this.getTractorBeamRange(activeTurnShip);
                            const inRange = distance(activeTurnShip.x, activeTurnShip.y, ship.x, ship.y) <= tractorRange;
                            const validTractorTarget = ship !== activeTurnShip && inRange &&
                                (ship.isPlayer || isInTractorBeamCone(activeTurnShip, ship));
                            isDimmed = !validTractorTarget;
                        } else if (this.playerMode === 'repair_beam') {
                            isDimmed = false; // cone is always shown; don't dim
                        } else if (this.playerMode === 'supercharge') {
                            const range = activeTurnShip.radar * CONSTANTS.SHOOT_RANGE_BASE * 0.75;
                            const halfAngle = CONSTANTS.SUPERCHARGE_CONE_HALF_ANGLE;
                            const dist = distance(activeTurnShip.x, activeTurnShip.y, ship.x, ship.y);
                            const ang = Math.atan2(ship.y - activeTurnShip.y, ship.x - activeTurnShip.x);
                            const localAng = normalizeAngle(ang - activeTurnShip.rotation);
                            const inCone = dist <= range && Math.abs(localAng) <= halfAngle;
                            const isAlly = ship.isPlayer === activeTurnShip.isPlayer;
                            isDimmed = !(ship !== activeTurnShip && isAlly && inCone);
                        } else if (this.playerMode === 'possess') {
                            const dist = distance(activeTurnShip.x, activeTurnShip.y, ship.x, ship.y);
                            isDimmed = !(ship !== activeTurnShip && dist <= CONSTANTS.POSSESS_RANGE);
                        } else if (this.playerMode === 'timeslip') {
                            const dist = distance(activeTurnShip.x, activeTurnShip.y, ship.x, ship.y);
                            isDimmed = !(ship !== activeTurnShip && dist <= CONSTANTS.TIMESLIP_RANGE && !(ship.timeslipTurns || 0));
                        } else if (this.playerMode === 'salvage') {
                            isDimmed = true; // dim all living ships in salvage mode
                        }
                    } else {
                        isDimmed = ship.isPlayer && ship.actionsRemaining === 0;
                    }

                    const escapeAlpha = ship._escapeFadeStart
                        ? Math.max(0, 1 - (Date.now() - ship._escapeFadeStart) / 1000)
                        : 1;
                    renderingSystem.drawShip(ship, isActiveTurn, isSelected, isHovered, isDimmed, false, ship.cloaked, escapeAlpha);
                    if ((!ship.cloaked || ship.isPlayer) && !ship._escapeFadeStart) renderingSystem.drawShipBars(ship);
                }
            });
        });

        // Draw phase indicators on phased ships (drawn above ships)
        [...this.playerShips, ...this.enemyShips].forEach(ship => {
            if (ship.alive && (ship.phasedTurns || 0) > 0) renderingSystem.drawPhaseIndicator(ship);
        });

        this.animations.forEach(anim => {
            if (anim.type === 'laser') {
                const progress = anim.totalDuration > 0 ? 1 - anim.duration / anim.totalDuration : 1;
                renderingSystem.drawLaser(anim.from, anim.to, progress, anim.color || null);
            } else if (anim.type === 'explosion') {
                const elapsed = anim.totalDuration - anim.duration;
                const progress = anim.totalDuration > 0 ? elapsed / anim.totalDuration : 0;
                renderingSystem.drawExplosion(anim.x, anim.y, progress);
            } else if (anim.type === 'blinkRing') {
                const elapsed = anim.totalDuration - anim.duration;
                const progress = anim.totalDuration > 0 ? elapsed / anim.totalDuration : 0;
                renderingSystem.drawBlinkRing(anim.x, anim.y, progress);
            } else if (anim.type === 'afterburnerTrail') {
                const elapsed = anim.totalDuration - anim.duration;
                const progress = anim.totalDuration > 0 ? elapsed / anim.totalDuration : 0;
                renderingSystem.drawAfterburnerTrail(anim.startX, anim.startY, anim.ship.x, anim.ship.y, anim.endX, anim.endY, progress);
            } else if (anim.type === 'warheadBlast') {
                const elapsed = anim.totalDuration - anim.duration;
                const progress = anim.totalDuration > 0 ? elapsed / anim.totalDuration : 0;
                renderingSystem.drawWarheadBlast(anim.x, anim.y, progress);
            } else if (anim.type === 'empBlast') {
                const elapsed = anim.totalDuration - anim.duration;
                const progress = anim.totalDuration > 0 ? elapsed / anim.totalDuration : 0;
                renderingSystem.drawEmpBlast(anim.x, anim.y, progress);
            } else if (anim.type === 'flashBlast') {
                const elapsed = anim.totalDuration - anim.duration;
                const progress = anim.totalDuration > 0 ? elapsed / anim.totalDuration : 0;
                renderingSystem.drawFlashBlast(anim.x, anim.y, progress);
            } else if (anim.type === 'tractorBeam') {
                const progress = anim.totalDuration > 0 ? 1 - anim.duration / anim.totalDuration : 1;
                renderingSystem.drawTractorBeam(anim.from, anim.to, progress);
            } else if (anim.type === 'chaingunRound') {
                const progress = anim.totalDuration > 0 ? 1 - anim.duration / anim.totalDuration : 1;
                renderingSystem.drawChaingunRound(anim.from, anim.to, progress);
            } else if (anim.type === 'plasmaRound') {
                const progress = anim.totalDuration > 0 ? 1 - anim.duration / anim.totalDuration : 1;
                renderingSystem.drawPlasmaRound(anim.from, anim.to, progress);
            } else if (anim.type === 'rocketBlast') {
                const elapsed = anim.totalDuration - anim.duration;
                const progress = anim.totalDuration > 0 ? elapsed / anim.totalDuration : 0;
                renderingSystem.drawRocketBlast(anim.x, anim.y, progress);
            } else if (anim.type === 'floatingText') {
                const elapsed = anim.totalDuration - anim.duration;
                renderingSystem.drawFloatingText(anim.text, anim.color, anim.worldX, anim.worldY, elapsed, anim.totalDuration);
            }
        });
    }

    // Returns the first entity that intercepts the laser path, or null.
    // Each candidate in the path (asteroids + same-faction ships) has a 50% chance
    // to intercept; they are tested closest-first so they stack multiplicatively.
    getPathObstructions(shooter, target) {
        const sx = shooter.x, sy = shooter.y;
        const tx = target.x,  ty = target.y;
        const segLenSq = (tx - sx) ** 2 + (ty - sy) ** 2;
        if (segLenSq === 0) return null;

        const candidates = [];

        for (const asteroid of this.asteroids) {
            if (asteroid === target) continue; // don't treat target as its own obstruction
            const t = ((asteroid.x - sx) * (tx - sx) + (asteroid.y - sy) * (ty - sy)) / segLenSq;
            if (t <= 0.05 || t >= 0.95) continue;
            const d = distancePointToLineSegment(asteroid.x, asteroid.y, sx, sy, tx, ty);
            if (d <= asteroid.radius) {
                candidates.push({ entity: asteroid, type: 'asteroid', dist: distance(sx, sy, asteroid.x, asteroid.y) });
            }
        }

        const allShips = [...this.playerShips, ...this.enemyShips];
        for (const ship of allShips) {
            if (ship === shooter || ship === target) continue;
            if (!ship.alive) {
                // Dead ship (corpse): can block shots regardless of faction
                if (ship.noCorpse || ship.cloaked) continue;
                const t = ((ship.x - sx) * (tx - sx) + (ship.y - sy) * (ty - sy)) / segLenSq;
                if (t <= 0.05 || t >= 0.95) continue;
                const d = distancePointToLineSegment(ship.x, ship.y, sx, sy, tx, ty);
                if (d <= CONSTANTS.SHIP_SIZE * 3 * (ship.sizeMult ?? 1.0)) {
                    candidates.push({ entity: ship, type: 'dead_ship', dist: distance(sx, sy, ship.x, ship.y) });
                }
                continue;
            }
            if (ship.cloaked) continue;
            // For ship targets only same faction can intercept; for asteroid targets any ship can
            if (target.isPlayer !== undefined && ship.isPlayer !== target.isPlayer) continue;
            const t = ((ship.x - sx) * (tx - sx) + (ship.y - sy) * (ty - sy)) / segLenSq;
            if (t <= 0.05 || t >= 0.95) continue;
            const d = distancePointToLineSegment(ship.x, ship.y, sx, sy, tx, ty);
            if (d <= CONSTANTS.SHIP_SIZE * 3 * (ship.sizeMult ?? 1.0)) {
                candidates.push({ entity: ship, type: 'ship', dist: distance(sx, sy, ship.x, ship.y) });
            }
        }

        candidates.sort((a, b) => a.dist - b.dist);
        for (const c of candidates) {
            if (Math.random() < 0.5) return c;
        }
        return null;
    }

    getShipAtPosition(wx, wy, mode = null) {
        // Salvage mode: only return dead player ships (non-corpse)
        if (mode === 'salvage') {
            for (const ship of this.playerShips) {
                if (ship.alive || ship.noCorpse) continue;
                const hitRadius = CONSTANTS.SHIP_SIZE * 3 * (ship.sizeMult ?? 1.0);
                if (distance(ship.x, ship.y, wx, wy) <= hitRadius) return ship;
            }
            return null;
        }
        for (const fleet of [this.playerShips, this.enemyShips]) {
            for (const ship of fleet) {
                if (!ship.alive) continue;
                if (ship.cloaked && !ship.isPlayer) continue; // invisible to click
                if ((ship.phasedTurns || 0) > 0 && !ship.isPlayer) continue; // phased = untargetable
                const hitRadius = CONSTANTS.SHIP_SIZE * 3 * (ship.sizeMult ?? 1.0);
                if (distance(ship.x, ship.y, wx, wy) <= hitRadius) return ship;
            }
        }
        return null;
    }

    isInteractableInMode(active, ship, asteroid) {
        const mode = this.playerMode;
        if (!active || !active.alive || active.actionsRemaining <= 0) return true;
        if (ship) {
            if (mode === 'move') {
                const isRammable = (!ship.isPlayer || ship.isBomb) && !ship.cloaked;
                return isRammable && isWithinMovementOval(active, ship.x, ship.y);
            } else if (mode === 'fire') {
                if (ship.isPlayer || ship.cloaked) return false;
                return distance(active.x, active.y, ship.x, ship.y) <= this.getShootRange(active) && isInFiringZone(active, ship);
            } else if (mode === 'tractor_beam') {
                if (ship === active) return false;
                const inRange = distance(active.x, active.y, ship.x, ship.y) <= this.getTractorBeamRange(active);
                return inRange && (ship.isPlayer || isInTractorBeamCone(active, ship));
            } else if (mode === 'supercharge') {
                if (ship === active || ship.isBomb || ship.isPlayer === !active.isPlayer) return false;
                const range = active.radar * CONSTANTS.SHOOT_RANGE_BASE * 0.75;
                const dist = distance(active.x, active.y, ship.x, ship.y);
                const localAng = normalizeAngle(Math.atan2(ship.y - active.y, ship.x - active.x) - active.rotation);
                return dist <= range && Math.abs(localAng) <= CONSTANTS.SUPERCHARGE_CONE_HALF_ANGLE;
            } else if (mode === 'possess') {
                return ship !== active && distance(active.x, active.y, ship.x, ship.y) <= CONSTANTS.POSSESS_RANGE;
            } else if (mode === 'mark') {
                const dist = distance(active.x, active.y, ship.x, ship.y);
                const localAng = normalizeAngle(Math.atan2(ship.y - active.y, ship.x - active.x) - active.rotation);
                return dist <= CONSTANTS.MARK_RANGE && Math.abs(localAng) <= CONSTANTS.MARK_CONE_HALF_ANGLE;
            } else if (mode === 'chaingun') {
                if (ship.isPlayer || ship.cloaked) return false;
                return distance(active.x, active.y, ship.x, ship.y) <= this.getShootRange(active) && isInFiringZone(active, ship);
            } else if (mode === 'plasma_cannon') {
                if (ship.isPlayer || ship.cloaked) return false;
                return distance(active.x, active.y, ship.x, ship.y) <= this.getShootRange(active) * CONSTANTS.PLASMA_RANGE_MULT && isInFiringZone(active, ship);
            } else if (mode === 'anchor') {
                if (ship === active || ship.cloaked) return false;
                const dist = distance(active.x, active.y, ship.x, ship.y);
                const localAng = normalizeAngle(Math.atan2(ship.y - active.y, ship.x - active.x) - active.rotation);
                return dist <= CONSTANTS.ANCHOR_RANGE && Math.abs(localAng) <= CONSTANTS.ANCHOR_CONE_HALF_ANGLE;
            } else if (mode === 'siphon') {
                return ship !== active && distance(active.x, active.y, ship.x, ship.y) <= CONSTANTS.SIPHON_RANGE;
            } else if (mode === 'swap') {
                if (ship === active || ship.cloaked || (ship.phasedTurns || 0) > 0) return false;
                return distance(active.x, active.y, ship.x, ship.y) <= CONSTANTS.SWAP_RANGE;
            } else if (mode === 'absorb') {
                return ship !== active && ship.alive && distance(active.x, active.y, ship.x, ship.y) <= CONSTANTS.ABSORB_RANGE;
            } else if (mode === 'ravager') {
                if (ship.isPlayer || ship.cloaked || (ship.phasedTurns || 0) > 0) return false;
                return distance(active.x, active.y, ship.x, ship.y) <= this.getShootRange(active) * CONSTANTS.RAVAGER_RANGE_MULT && isInFiringZone(active, ship);
            } else if (mode === 'timeslip') {
                return ship !== active && distance(active.x, active.y, ship.x, ship.y) <= CONSTANTS.TIMESLIP_RANGE && !(ship.timeslipTurns || 0);
            } else if (mode === 'salvage') {
                return !ship.alive && !ship.noCorpse && ship.isPlayer;
            } else if (mode === 'neutralize' || mode === 'gamma_ray') {
                return false; // these don't target ships directly
            }
            return true;
        }
        if (asteroid) {
            if (mode === 'move') return isWithinMovementOval(active, asteroid.x, asteroid.y);
            if (mode === 'fire') {
                return distance(active.x, active.y, asteroid.x, asteroid.y) <= this.getShootRange(active) && isInFiringZone(active, asteroid);
            }
            if (mode === 'tractor_beam') {
                const dist = distance(active.x, active.y, asteroid.x, asteroid.y);
                const localAng = normalizeAngle(Math.atan2(asteroid.y - active.y, asteroid.x - active.x) - active.rotation);
                return dist <= this.getTractorBeamRange(active) && Math.abs(localAng) <= CONSTANTS.TRACTOR_BEAM_HALF_ANGLE;
            }
            return true;
        }
        return false;
    }

    _shipLabel(ship) {
        const color = ship.isPlayer ? '#44ffff' : '#ff6666';
        return `<span style="color:${color}">${ship.name}</span>`;
    }

}
