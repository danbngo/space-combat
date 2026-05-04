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

        this.asteroids  = [];
        this.clouds     = [];
        this.cloudType  = null;

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
        if (Math.random() > CONSTANTS.ASTEROID_SPAWN_CHANCE) return;
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
        if (Math.random() > CONSTANTS.CLOUD_SPAWN_CHANCE) return;
        const types = CONSTANTS.CLOUD_TYPES;
        this.cloudType = types[Math.floor(Math.random() * types.length)];
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
            const inCloud = this.isShipInCloud(ship);
            ship.statusEffect = inCloud ? this.cloudType : null;
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
        const allShips = [...this.playerShips, ...this.enemyShips].filter(s => s.alive);
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
                        ship.hull = Math.max(0, ship.hull - CONSTANTS.ASTEROID_COLLISION_DAMAGE);
                        if (ship.hull <= 0) ship.alive = false;
                        ship.triggerHitFlash(CONSTANTS.ASTEROID_COLLISION_DAMAGE, 0);
                        this.addFloatingText(`-${CONSTANTS.ASTEROID_COLLISION_DAMAGE}`, '#ff4444', ship.x, ship.y - 8);
                        this.addLog(`${this._shipLabel(ship)}: hit by asteroid!`);

                        // Debris pushes away from the originating ship; random asteroids push away from impact point
                        const knockSrcX = asteroid._debrisSourceX !== undefined ? asteroid._debrisSourceX : asteroid.x;
                        const knockSrcY = asteroid._debrisSourceY !== undefined ? asteroid._debrisSourceY : asteroid.y;
                        const ang = Math.atan2(ship.y - knockSrcY, ship.x - knockSrcX);
                        ship.targetX = ship.x + Math.cos(ang) * CONSTANTS.ASTEROID_KNOCKBACK;
                        ship.targetY = ship.y + Math.sin(ang) * CONSTANTS.ASTEROID_KNOCKBACK;
                        ship.isMoving = true;
                        ship._moveStarted = false;

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
                            a.hull = Math.max(0, a.hull - dmg);
                            b.hull = Math.max(0, b.hull - dmg);
                            if (a.hull <= 0 && a.alive) { a.alive = false; newlyDead.push(a); }
                            if (b.hull <= 0 && b.alive) { b.alive = false; newlyDead.push(b); }
                            a.triggerHitFlash(dmg, 0);
                            b.triggerHitFlash(dmg, 0);
                            this.addFloatingText(`-${dmg}`, '#ff4444', a.x, a.y - 6);
                            this.addFloatingText(`-${dmg}`, '#ff4444', b.x, b.y - 6);
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
                        ship.hull = Math.max(0, ship.hull - dmg);
                        if (ship.hull <= 0 && ship.alive) { ship.alive = false; newlyDead.push(ship); }
                        ship.triggerHitFlash(dmg, 0);
                        this.addFloatingText(`-${dmg}`, '#ff4444', ship.x, ship.y - 6);
                        this.addLog(`${this._shipLabel(ship)}: hit asteroid!`);
                        asteroidsToSplit.push({ asteroid, ang: Math.atan2(asteroid.y - ship.y, asteroid.x - ship.x) });
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

    playerShootAtAsteroid(shooter, asteroid) {
        shooter.decloak();
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

        rammer.hull = Math.max(0, rammer.hull - selfDmg);
        if (rammer.hull <= 0) rammer.alive = false;
        rammer.triggerHitFlash(selfDmg, 0);

        rammer.targetX = asteroid.x - Math.cos(ang) * (asteroid.radius + CONSTANTS.SHIP_SIZE * 2 * (rammer.sizeMult ?? 1.0));
        rammer.targetY = asteroid.y - Math.sin(ang) * (asteroid.radius + CONSTANTS.SHIP_SIZE * 2 * (rammer.sizeMult ?? 1.0));
        rammer.targetRotation = ang;
        rammer.isMoving = true;
        rammer._moveStarted = false;
        rammer.actionsRemaining = Math.max(0, rammer.actionsRemaining - 1);

        this.addFloatingText('Ram!', '#ff8800', rammer.x, rammer.y - 12);
        this.addFloatingText(`-${selfDmg}`, '#ff4444', rammer.x, rammer.y - 6);
        this.addLog(`${this._shipLabel(rammer)}: rammed asteroid (-${selfDmg} self hull)`);

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
        if (this.animations.some(a => a.type === 'laser')) return true;
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
            if (this.playerMode === 'hack' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawHackRange(activeTurnShip);
            }
            if (this.playerMode === 'debris_field' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawDebrisFieldRange(activeTurnShip);
            }
            if (this.playerMode === 'mark' && activeTurnShip.actionsRemaining > 0) {
                renderingSystem.drawMarkRange(activeTurnShip);
            }
        }

        let hoveredShip = null;
        let hoveredAsteroid = null;
        if (renderingSystem.hoveredWorldX !== null) {
            const rawShip = this.getShipAtPosition(renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
            if (rawShip) {
                hoveredShip = (!this.playerMode || this.isInteractableInMode(activeTurnShip, rawShip, null)) ? rawShip : null;
            } else {
                const rawAst = this.getAsteroidAtPosition(renderingSystem.hoveredWorldX, renderingSystem.hoveredWorldY);
                if (rawAst) hoveredAsteroid = (!this.playerMode || this.isInteractableInMode(activeTurnShip, null, rawAst)) ? rawAst : null;
            }
        }

        const dimming = activeTurnShip && activeTurnShip.alive && !this.isAnimating() && this.playerMode;

        // Clouds — drawn first, behind everything
        this.clouds.forEach(cloud => renderingSystem.drawCloud(cloud));

        // Draw wreckage first so it sits below living ships (skip noCorpse units)
        [this.playerShips, this.enemyShips].forEach(fleet => {
            fleet.forEach(ship => {
                if (!ship.alive && !ship.noCorpse) renderingSystem.drawShip(ship, false, false, false, false, true);
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
                        } else if (this.playerMode === 'hack') {
                            const dist = distance(activeTurnShip.x, activeTurnShip.y, ship.x, ship.y);
                            isDimmed = !(ship !== activeTurnShip && dist <= CONSTANTS.HACK_RANGE);
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

        this.animations.forEach(anim => {
            if (anim.type === 'laser') {
                const progress = anim.totalDuration > 0 ? 1 - anim.duration / anim.totalDuration : 1;
                renderingSystem.drawLaser(anim.from, anim.to, progress);
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
            if (ship === shooter || ship === target || !ship.alive || ship.cloaked) continue;
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

    getShipAtPosition(wx, wy) {
        for (const fleet of [this.playerShips, this.enemyShips]) {
            for (const ship of fleet) {
                if (!ship.alive) continue;
                if (ship.cloaked && !ship.isPlayer) continue; // invisible to click
                const hitRadius = CONSTANTS.SHIP_SIZE * 3 * (ship.sizeMult ?? 1.0);
                if (distance(ship.x, ship.y, wx, wy) <= hitRadius) return ship;
            }
        }
        return null;
    }

    applyStartOfTurnEffects(ship) {
        if (!ship || !ship.alive) return;
        if (!ship.modules || !ship.modules.some(m => m.id === 'combat_ai')) return;
        const mod = CONSTANTS.MODULES.find(m => m.id === 'combat_ai');
        if (mod && Math.random() < mod.effect.chance) {
            ship.actionsRemaining++;
            this.addLog(`${ship.name}: Combat AI fires — bonus action! (${ship.actionsRemaining} actions this turn)`);
            this.addFloatingText('+1 Action!', '#00ff88', ship.x, ship.y - 16);
        }
    }

    nextPlayerShip() {
        if (this.state !== COMBAT_STATE.PLAYER_TURN) return;

        let nextIndex = this.currentShipIndex + 1;
        while (nextIndex < this.playerShips.length && (!this.playerShips[nextIndex].alive || this.playerShips[nextIndex].isBomb)) {
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
            } else {
                this.applyStartOfTurnEffects(nextShip);
                UISystem.updateCombatScreen(gameState, this);
            }
        }
    }

    // Run AI actions for a player-owned drone. Called instead of waiting for player input.
    processDroneTurn(drone) {
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
    }

    endPlayerTurn() {
        this.state = COMBAT_STATE.ENEMY_TURN;
        UISystem.updateCombatScreen(gameState, this);
        this.beginEnemyTurn();
    }

    beginEnemyTurn() {
        this.state = COMBAT_STATE.RESOLVING;
        UISystem.updateCombatScreen(gameState, this);

        setTimeout(() => {
            this.resolveEnemyActions();
        }, CONSTANTS.AI_DECISION_DELAY);
    }

    resolveEnemyActions() {
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
            } else if (mode === 'hack') {
                return ship !== active && distance(active.x, active.y, ship.x, ship.y) <= CONSTANTS.HACK_RANGE;
            } else if (mode === 'mark') {
                const dist = distance(active.x, active.y, ship.x, ship.y);
                const localAng = normalizeAngle(Math.atan2(ship.y - active.y, ship.x - active.x) - active.rotation);
                return dist <= CONSTANTS.MARK_RANGE && Math.abs(localAng) <= CONSTANTS.MARK_CONE_HALF_ANGLE;
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

    playerShootAt(shooter, target) {
        if (shooter.statusEffect === 'plasma') {
            this.addLog(`${this._shipLabel(shooter)}: cannot fire — overheated!`);
            return;
        }
        if (shooter.blindedTurns > 0) {
            this.addLog(`${this._shipLabel(shooter)}: cannot fire — blinded!`);
            return;
        }
        shooter.decloak();
        const maxRange = this.getShootRange(shooter);
        const targetMarked = (target.markedTurns || 0) > 0;
        const result = shooter.shootAt(target, maxRange, targetMarked);

        // Dust cloud: flat 50% additional miss — bypassed if target is marked
        if (!targetMarked && result.hit && (this.isShipDusty(shooter) || this.isShipDusty(target))) {
            if (Math.random() < CONSTANTS.DUST_MISS_CHANCE) {
                result.hit = false; result.damage = 0; result._dustMiss = true;
            }
        }

        const obstruction = this.getPathObstructions(shooter, target);
        const laserEnd = obstruction ? obstruction.entity : target;

        this.addFloatingText('Fire!', '#ff8800', shooter.x, shooter.y - 12);
        this.addAnimation({
            type: 'laser',
            from: { x: shooter.x, y: shooter.y },
            to:   { x: laserEnd.x, y: laserEnd.y },
            duration: CONSTANTS.COMBAT_ANIMATION_SPEED,
            totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED
        });

        const self = this;
        const delay = CONSTANTS.COMBAT_ANIMATION_SPEED;

        if (obstruction) {
            setTimeout(() => {
                self.addFloatingText('Missed!', '#555555', target.x, target.y - 6);
                self._applyLaserHitToObstruction(shooter, obstruction, target);
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
    }

    _applyLaserHitToObstruction(shooter, obstruction, originalTarget) {
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
    }

    playerSkipTurn(ship) {
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
    }

    playerBlink(ship, targetX, targetY) {
        ship.decloak();
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
    }

    playerAfterburner(ship, tx, ty) {
        ship.decloak();
        // tx/ty is clamped to the steering cone by the caller; clamp range as a safety net
        const maxRange = ship.engine * (CONSTANTS.COMBAT_MOVE_OVAL_OFFSET + CONSTANTS.COMBAT_MOVE_OVAL_MAJOR) * CONSTANTS.AFTERBURNER_RANGE_MULT;
        const dist = distance(ship.x, ship.y, tx, ty);
        if (dist > maxRange && dist > 0) {
            tx = ship.x + (tx - ship.x) / dist * maxRange;
            ty = ship.y + (ty - ship.y) / dist * maxRange;
        }

        const startX = ship.x, startY = ship.y;
        const enemies = ship.isPlayer ? this.enemyShips : this.playerShips;
        const hitsInPath = enemies.filter(e =>
            e.alive && distancePointToLineSegment(e.x, e.y, startX, startY, tx, ty) <= CONSTANTS.AFTERBURNER_HALF_WIDTH
        );
        const asteroidsInPath = [...this.asteroids].filter(a =>
            distancePointToLineSegment(a.x, a.y, startX, startY, tx, ty) <= CONSTANTS.AFTERBURNER_HALF_WIDTH + a.radius
        );

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

        if (hitsInPath.length > 0 || asteroidsInPath.length > 0) {
            const delay = travelTime;
            const self = this;
            setTimeout(() => {
                hitsInPath.forEach(target => {
                    if (!target.alive) return;
                    const dmg = randomInt(1, Math.max(1, Math.floor(ship.engine / 2)));
                    const shieldAbsorb = Math.min(dmg, target.shields);
                    const hullDmg = dmg - shieldAbsorb;
                    target.takeDamage(dmg);
                    target.triggerHitFlash(hullDmg, shieldAbsorb);
                    if (shieldAbsorb > 0) self.addFloatingText(`-${shieldAbsorb}`, '#4488ff', target.x, target.y - 20);
                    if (hullDmg > 0) self.addFloatingText(`-${hullDmg}`, '#ff4444', target.x, target.y - 6);
                    const parts = [];
                    if (shieldAbsorb > 0) parts.push(`${shieldAbsorb} shld`);
                    if (hullDmg > 0) parts.push(`${hullDmg} hull`);
                    self.addLog(`${self._shipLabel(ship)} afterburner → ${self._shipLabel(target)}: -${parts.join(' -')}`);
                    if (!target.alive) {
                        self.addAnimation({ type: 'explosion', x: target.x, y: target.y, duration: CONSTANTS.EXPLOSION_DURATION });
                        self.addLog(`${self._shipLabel(target)} destroyed!`);
                    }
                });
                asteroidsInPath.forEach(a => {
                    const ang = Math.atan2(a.y - startY, a.x - startX);
                    self.splitAsteroid(a, ang);
                });
            }, delay);
        }

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
    }

    playerPlantBomb(ship, tx, ty) {
        ship.decloak();
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

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
    }

    performBombDetonate(bomb) {
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
    }

    playerEmpBlast(ship, tx, ty) {
        ship.decloak();
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
    }

    playerSummonDrone(carrier) {
        carrier.decloak();
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

        this.checkAutoAdvance(carrier);
        UISystem.updateCombatScreen(gameState, this);
    }

    getRepairBeamRange(ship) {
        return ship.radar * CONSTANTS.SHOOT_RANGE_BASE * 1.5;
    }

    getRepairBeamConeTargets(ship) {
        const range = this.getRepairBeamRange(ship);
        const halfAngle = CONSTANTS.REPAIR_BEAM_CONE_HALF_ANGLE;
        const allies = ship.isPlayer ? this.playerShips : this.enemyShips;
        return allies.filter(s => {
            if (s === ship || !s.alive || s.isBomb) return false;
            const dist = distance(ship.x, ship.y, s.x, s.y);
            if (dist > range) return false;
            const ang = Math.atan2(s.y - ship.y, s.x - ship.x);
            const localAng = normalizeAngle(ang - ship.rotation);
            return Math.abs(localAng) <= halfAngle;
        });
    }

    playerRepairBeam(ship) {
        ship.decloak();
        const targets = this.getRepairBeamConeTargets(ship);

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['repair_beam'] = CONSTANTS.SPECIAL_MOVES.repair_beam.cooldown;
        this.playerMode = null;

        this.addFloatingText('Repair Beam!', '#00ff88', ship.x, ship.y - 12);

        if (targets.length === 0) {
            this.addLog(`${this._shipLabel(ship)} repair beam: no allies in forward cone`);
        } else {
            targets.forEach(target => {
                const hullRestored = Math.min(CONSTANTS.REPAIR_BEAM_HULL, target.maxHull - target.hull);
                target.hull = Math.min(target.maxHull, target.hull + CONSTANTS.REPAIR_BEAM_HULL);
                this.addAnimation({ type: 'tractorBeam', from: { x: ship.x, y: ship.y }, to: { x: target.x, y: target.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
                if (hullRestored > 0) this.addFloatingText(`+${hullRestored} hull`, '#00ff88', target.x, target.y - 6);
                this.addLog(`${this._shipLabel(ship)} repair → ${this._shipLabel(target)}: ${hullRestored > 0 ? `+${hullRestored} hull` : 'full'}`);
            });
        }

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
    }

    playerSupercharge(ship, target) {
        ship.decloak();
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
    }

    playerHack(ship, target) {
        ship.decloak();
        target.berserkTurns = CONSTANTS.BERSERK_TURNS;
        if (target.cloaked) target.decloak();

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['hack'] = CONSTANTS.SPECIAL_MOVES.hack.cooldown;
        this.playerMode = null;

        this.addAnimation({ type: 'tractorBeam', from: { x: ship.x, y: ship.y }, to: { x: target.x, y: target.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
        this.addFloatingText('Hacked!', '#ff44ff', ship.x, ship.y - 12);
        this.addFloatingText('BERSERK!', '#ff44ff', target.x, target.y - 18);
        this.addLog(`${this._shipLabel(ship)} hacked ${this._shipLabel(target)} — BERSERK for ${CONSTANTS.BERSERK_TURNS} turns!`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
    }

    playerMark(ship, target) {
        ship.decloak();
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
    }

    processBerserkPlayerTurn(ship) {
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
    }

    playerFlash(ship, tx, ty) {
        ship.decloak();
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
                t.hull = Math.max(0, t.hull - CONSTANTS.FLASH_DAMAGE);
                if (t.hull <= 0) t.alive = false;
                t.blindedTurns = CONSTANTS.FLASH_BLIND_TURNS;
                t.triggerHitFlash(CONSTANTS.FLASH_DAMAGE, 0);
                self.addFloatingText('Blinded!', '#ffffaa', t.x, t.y - 18);
                self.addFloatingText(`-${CONSTANTS.FLASH_DAMAGE}`, '#ffff44', t.x, t.y - 6);
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
    }

    playerCloak(ship) {
        ship.cloaked = true;
        ship.cloakTurnsRemaining = randomInt(CONSTANTS.CLOAK_MIN_TURNS, CONSTANTS.CLOAK_MAX_TURNS);
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['cloak'] = CONSTANTS.SPECIAL_MOVES.cloak.cooldown;
        this.playerMode = null;

        this.addFloatingText('Cloaked!', '#88ffcc', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: cloaked for ${ship.cloakTurnsRemaining} turns`);
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
    }

    playerTractorBeam(ship, target) {
        ship.decloak();

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
    }

    playerDebrisField(ship) {
        ship.decloak();
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

        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);
        ship.specialMoveCooldowns['debris_field'] = CONSTANTS.SPECIAL_MOVES.debris_field.cooldown;
        this.playerMode = null;

        this.addFloatingText('Debris Field!', '#cc8844', ship.x, ship.y - 12);
        this.addLog(`${this._shipLabel(ship)}: Debris Field — ${count} rocks launched!`);

        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
    }

    playerMoveToPoint(ship, targetX, targetY) {
        const dist = Math.round(distance(ship.x, ship.y, targetX, targetY));
        ship.targetX = targetX;
        ship.targetY = targetY;
        ship.targetRotation = Math.atan2(targetY - ship.y, targetX - ship.x);
        ship.isMoving = true;
        ship.actionsRemaining = Math.max(0, ship.actionsRemaining - 1);

        this.addLog(`${this._shipLabel(ship)} moved ${dist}u`);
        this.checkAutoAdvance(ship);
        UISystem.updateCombatScreen(gameState, this);
    }

    playerRamShip(rammer, target) {
        const dist = distance(rammer.x, rammer.y, target.x, target.y);
        const moveDistance = Math.min(dist, rammer.engine);
        this.performRam(rammer, target, moveDistance);
        UISystem.updateCombatScreen(gameState, this);
    }

    performRam(rammer, target, moveDistance) {
        rammer.decloak();
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
        rammer.hull = Math.max(0, rammer.hull - ramDmg);
        if (rammer.hull <= 0) rammer.alive = false;
        rammer.triggerHitFlash(ramDmg, 0);
        this.addFloatingText(`-${ramDmg}`, '#ff4444', rammer.x, rammer.y - 8);

        this.addLog(`${this._shipLabel(rammer)} rammed ${this._shipLabel(target)}: -${ramDmg} hull self, -${targetDmg} hull target`);

        // Defer target damage, knockback, and explosion until rammer arrives
        const travelDist = distance(rammer.x, rammer.y, rammer.targetX, rammer.targetY);
        const delay = Math.ceil(travelDist / CONSTANTS.SHIP_ANIMATION_SPEED);
        const pushDist = moveDistance * CONSTANTS.RAM_PUSHBACK_FACTOR;
        const self = this;

        setTimeout(() => {
            // Direct hull damage — bypasses shields entirely
            target.hull = Math.max(0, target.hull - targetDmg);
            if (target.hull <= 0) target.alive = false;
            target.triggerHitFlash(targetDmg, 0);
            self.addFloatingText(`-${targetDmg}`, '#ff4444', target.x, target.y - 6);

            target.targetX = target.x + Math.cos(ang) * pushDist;
            target.targetY = target.y + Math.sin(ang) * pushDist;
            target.isMoving = true;

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
    }

    checkAutoAdvance(ship) {
        if (ship.actionsRemaining === 0) {
            const self = this;
            setTimeout(() => {
                if (self.state === COMBAT_STATE.PLAYER_TURN) {
                    self.nextPlayerShip();
                }
            }, 500);
        }
    }

    moveTowardShip(mover, target) {
        const dist = distance(mover.x, mover.y, target.x, target.y);
        if (dist > 0) {
            mover.moveToward(target.x, target.y, mover.getMaxMoveDistance());
        }
    }

    addLog(msg) {
        this.combatLog.unshift(msg);
    }

    addFloatingText(text, color, worldX, worldY) {
        this.animations.push({
            type: 'floatingText',
            text, color,
            worldX: worldX + randomInt(-8, 8),
            worldY,
            duration: 1200,
            totalDuration: 1200
        });
    }

    addAnimation(animation) {
        if (animation.duration !== undefined && animation.totalDuration === undefined) {
            animation.totalDuration = animation.duration;
        }
        this.animations.push(animation);
    }

    updateAnimationTimers(deltaTime) {
        for (let i = this.animations.length - 1; i >= 0; i--) {
            this.animations[i].duration -= deltaTime;
            if (this.animations[i].duration <= 0) {
                this.animations.splice(i, 1);
            }
        }
    }

    endEnemyTurn() {
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

        this.round++;
        this.currentShipIndex = 0;
        while (this.currentShipIndex < this.playerShips.length &&
            (!this.playerShips[this.currentShipIndex].alive || this.playerShips[this.currentShipIndex].isBomb)) {
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
            } else {
                this.applyStartOfTurnEffects(firstShip);
                UISystem.updateCombatScreen(gameState, this);
            }
        } else {
            UISystem.updateCombatScreen(gameState, this);
        }
    }

    checkCombatEnd() {
        if (this.state === COMBAT_STATE.ENDED) return;
        const alivePlayerShips = this.playerShips.filter(s => s.alive && !s.isDrone && !s.isBomb).length;
        const aliveEnemyShips  = this.enemyShips.filter(s => s.alive && !s.isDrone && !s.isBomb).length;

        if (aliveEnemyShips === 0) {
            this.won = true;
            this.state = COMBAT_STATE.ENDED;
            this._endedAt = Date.now();
        } else if (alivePlayerShips === 0) {
            if (!this.playerRetreated) this.lost = true;
            this.state = COMBAT_STATE.ENDED;
            this._endedAt = Date.now();
        }
    }

    getRewards() {
        const destroyedEnemies = this.enemyShips.filter(s => !s.alive).length;
        return destroyedEnemies * CONSTANTS.CREDITS_PER_ENEMY_DESTROYED;
    }
}
