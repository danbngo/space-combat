// AI System
class AISystem {
    // Berserk: randomly attacks any nearby ship (laser or ram), no abilities
    static berserkAction(ship, allTargets, combat) {
        const shootRange = ship.radar * CONSTANTS.SHOOT_RANGE_BASE;
        const inRange = allTargets.filter(s => distance(ship.x, ship.y, s.x, s.y) <= shootRange);
        const ramTargets = allTargets.filter(s => isWithinMovementOval(ship, s.x, s.y));

        if (inRange.length === 0 && ramTargets.length === 0) {
            // Move toward nearest target
            let nearest = null, nearestDist = Infinity;
            allTargets.forEach(s => {
                const d = distance(ship.x, ship.y, s.x, s.y);
                if (d < nearestDist) { nearestDist = d; nearest = s; }
            });
            if (!nearest) return;
            const angle = Math.atan2(nearest.y - ship.y, nearest.x - ship.x);
            const farX = ship.x + Math.cos(angle) * ship.engine * 20;
            const farY = ship.y + Math.sin(angle) * ship.engine * 20;
            const dest = clampToMovementOval(ship, farX, farY);
            ship.targetX = dest.x; ship.targetY = dest.y;
            ship.targetRotation = Math.atan2(dest.y - ship.y, dest.x - ship.x);
            ship.isMoving = true;
            return;
        }

        // Pick a random target from those reachable
        const candidates = [...new Set([...inRange, ...ramTargets])];
        const target = candidates[Math.floor(Math.random() * candidates.length)];

        if (ramTargets.includes(target) && Math.random() < 0.5) {
            combat.performRam(ship, target, ship.engine);
        } else if (inRange.includes(target) && isInFiringZone(ship, target)) {
            const result = ship.shootAt(target, shootRange);
            const obstruction = combat.getPathObstructions(ship, target);
            const laserEnd = obstruction ? obstruction.entity : target;
            combat.addFloatingText('Fire!', '#ff44ff', ship.x, ship.y - 12);
            combat.addAnimation({ type: 'laser', from: { x: ship.x, y: ship.y }, to: { x: laserEnd.x, y: laserEnd.y }, duration: CONSTANTS.COMBAT_ANIMATION_SPEED, totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED });
            const delay = CONSTANTS.COMBAT_ANIMATION_SPEED;
            const t = target;
            if (obstruction) {
                setTimeout(() => { combat.addFloatingText('Missed!', '#555555', t.x, t.y - 6); combat._applyLaserHitToObstruction(ship, obstruction, t); }, delay);
            } else if (result.hit) {
                const shieldAbsorb = Math.min(result.damage, t.shields);
                const hullDmg = result.damage - shieldAbsorb;
                setTimeout(() => {
                    t.takeDamage(result.damage, true);
                    t.triggerHitFlash(hullDmg, shieldAbsorb);
                    if (shieldAbsorb > 0) combat.addFloatingText(`-${shieldAbsorb}`, '#4488ff', t.x, t.y - 20);
                    if (hullDmg > 0) combat.addFloatingText(`-${hullDmg}`, '#ff4444', t.x, t.y - 6);
                    if (!t.alive) { combat.addAnimation({ type: 'explosion', x: t.x, y: t.y, duration: CONSTANTS.EXPLOSION_DURATION }); combat.addLog(`${combat._shipLabel(t)} destroyed!`); }
                }, delay);
            } else {
                setTimeout(() => combat.addFloatingText('Miss!', '#555555', t.x, t.y - 6), delay);
            }
        } else {
            // Move toward target to get in range
            const angle = Math.atan2(target.y - ship.y, target.x - ship.x);
            const farX = ship.x + Math.cos(angle) * ship.engine * 20;
            const farY = ship.y + Math.sin(angle) * ship.engine * 20;
            const dest = clampToMovementOval(ship, farX, farY);
            ship.targetX = dest.x; ship.targetY = dest.y;
            ship.targetRotation = Math.atan2(dest.y - ship.y, dest.x - ship.x);
            ship.isMoving = true;
        }
    }


    // Move toward nearest arena edge — used when fleeing, constrained to movement oval
    static flee(aiShip, combat) {
        // Fleeing is disabled for enemy ships.
        // This method remains as a placeholder so no action is taken if called unexpectedly.
        return;
    }

    // Nudge a destination away from nearby asteroids and allied ships, then re-clamp to oval
    static avoidObstacles(aiShip, desiredX, desiredY, combat) {
        const AVOID_DIST = CONSTANTS.ASTEROID_SHIP_RADIUS * 4;
        const PUSH = 30;
        let pushX = 0, pushY = 0;

        for (const asteroid of combat.asteroids) {
            const d = distance(desiredX, desiredY, asteroid.x, asteroid.y);
            const clearance = asteroid.radius + CONSTANTS.ASTEROID_SHIP_RADIUS + 8;
            if (d < clearance + AVOID_DIST) {
                const strength = (1 - d / (clearance + AVOID_DIST)) * PUSH;
                const a = Math.atan2(desiredY - asteroid.y, desiredX - asteroid.x);
                pushX += Math.cos(a) * strength;
                pushY += Math.sin(a) * strength;
            }
        }

        for (const ally of combat.enemyShips) {
            if (!ally.alive || ally === aiShip) continue;
            const d = distance(desiredX, desiredY, ally.x, ally.y);
            if (d < CONSTANTS.ASTEROID_SHIP_RADIUS * 3.5) {
                const strength = (1 - d / (CONSTANTS.ASTEROID_SHIP_RADIUS * 3.5)) * PUSH;
                const a = Math.atan2(desiredY - ally.y, desiredX - ally.x);
                pushX += Math.cos(a) * strength;
                pushY += Math.sin(a) * strength;
            }
        }

        return clampToMovementOval(aiShip, desiredX + pushX, desiredY + pushY);
    }

    static decideAction(aiShip, playerShips, combat) {
        // Overheated: cannot use any abilities or shoot — just move
        if ((aiShip.plasmaTurns || 0) > 0) {
            const aliveTargets = playerShips.filter(s => s.alive && !s.cloaked);
            if (aliveTargets.length > 0) this.moveAction(aiShip, playerShips, combat);
            return;
        }

        // Blinded: cannot fire — just move
        if ((aiShip.blindedTurns || 0) > 0) {
            const aliveTargets = playerShips.filter(s => s.alive && !s.cloaked);
            if (aliveTargets.length > 0) this.moveAction(aiShip, playerShips, combat);
            return;
        }

        // Anchored: cannot move — only shoot if in range
        if ((aiShip.anchoredTurns || 0) > 0) {
            const shootRange = combat.getShootRange(aiShip);
            const inRange = playerShips.filter(s => s.alive && !s.cloaked && distance(aiShip.x, aiShip.y, s.x, s.y) <= shootRange);
            if (inRange.length > 0) this.attackAction(aiShip, playerShips, combat);
            return;
        }

        // Carrier AI: summon drone if available and no drone already active
        if (aiShip.specialMoves && aiShip.specialMoves.includes('summon_drone')) {
            const cd = (aiShip.specialMoveCooldowns || {})['summon_drone'] || 0;
            const activeDrones = combat.enemyShips.filter(s => s.isDrone && s.alive).length;
            if (cd === 0 && activeDrones === 0 && Math.random() < 0.6) {
                combat.playerSummonDrone(aiShip);
                return;
            }
        }

        // Repair ship AI: fire forward repair cone if any damaged ally is in it
        if (aiShip.specialMoves && aiShip.specialMoves.includes('repair_beam')) {
            const cd = (aiShip.specialMoveCooldowns || {})['repair_beam'] || 0;
            if (cd === 0) {
                const targets = combat.getRepairBeamConeTargets(aiShip);
                const needsRepair = targets.some(s => s.hull < s.maxHull * 0.75);
                if (needsRepair) {
                    combat.playerRepairBeam(aiShip);
                    return;
                }
            }
        }

        // Supercharge AI: supercharge the most damaged ally in forward cone
        if (aiShip.specialMoves && aiShip.specialMoves.includes('supercharge')) {
            const cd = (aiShip.specialMoveCooldowns || {})['supercharge'] || 0;
            if (cd === 0) {
                const range = aiShip.radar * CONSTANTS.SHOOT_RANGE_BASE * 0.75;
                const halfAngle = CONSTANTS.SUPERCHARGE_CONE_HALF_ANGLE;
                const allies = combat.enemyShips.filter(s => {
                    if (s === aiShip || !s.alive || s.isDrone || s.isBomb) return false;
                    const dist = distance(aiShip.x, aiShip.y, s.x, s.y);
                    if (dist > range) return false;
                    const ang = Math.atan2(s.y - aiShip.y, s.x - aiShip.x);
                    const localAng = normalizeAngle(ang - aiShip.rotation);
                    return Math.abs(localAng) <= halfAngle && s.shields < s.maxShields * 0.5;
                });
                if (allies.length > 0) {
                    const target = allies.reduce((a, b) => (a.shields / a.maxShields < b.shields / b.maxShields) ? a : b);
                    combat.playerSupercharge(aiShip, target);
                    return;
                }
            }
        }

        const alivePlayerShips = playerShips.filter(s => s.alive && !s.cloaked);
        if (alivePlayerShips.length === 0) return;

        // Possess AI: possess nearest player ship in POSSESS_RANGE
        if (aiShip.specialMoves && aiShip.specialMoves.includes('possess')) {
            const cd = (aiShip.specialMoveCooldowns || {})['possess'] || 0;
            if (cd === 0) {
                const target = alivePlayerShips.find(s => distance(aiShip.x, aiShip.y, s.x, s.y) <= CONSTANTS.POSSESS_RANGE);
                if (target) {
                    combat.playerPossess(aiShip, target);
                    return;
                }
            }
        }

        // Swarm AI: release swarm when any player is nearby
        if (aiShip.specialMoves && aiShip.specialMoves.includes('swarm')) {
            const cd = (aiShip.specialMoveCooldowns || {})['swarm'] || 0;
            if (cd === 0 && alivePlayerShips.length > 0) {
                combat.playerSwarm(aiShip);
                return;
            }
        }

        // Webbing AI: web when 2+ players nearby
        if (aiShip.specialMoves && aiShip.specialMoves.includes('webbing')) {
            const cd = (aiShip.specialMoveCooldowns || {})['webbing'] || 0;
            if (cd === 0) {
                const nearby = alivePlayerShips.filter(s => distance(aiShip.x, aiShip.y, s.x, s.y) <= CONSTANTS.WEBBING_RANGE * 1.5);
                if (nearby.length >= 2) {
                    const cx = nearby.reduce((a, s) => a + s.x, 0) / nearby.length;
                    const cy = nearby.reduce((a, s) => a + s.y, 0) / nearby.length;
                    const d = distance(aiShip.x, aiShip.y, cx, cy);
                    const tx = d > CONSTANTS.WEBBING_RANGE ? aiShip.x + (cx - aiShip.x) / d * CONSTANTS.WEBBING_RANGE : cx;
                    const ty = d > CONSTANTS.WEBBING_RANGE ? aiShip.y + (cy - aiShip.y) / d * CONSTANTS.WEBBING_RANGE : cy;
                    combat.playerWebbing(aiShip, tx, ty);
                    return;
                }
            }
        }

        // Timeslip AI: target nearest player not already slipped
        if (aiShip.specialMoves && aiShip.specialMoves.includes('timeslip')) {
            const cd = (aiShip.specialMoveCooldowns || {})['timeslip'] || 0;
            if (cd === 0) {
                const target = alivePlayerShips.find(s =>
                    distance(aiShip.x, aiShip.y, s.x, s.y) <= CONSTANTS.TIMESLIP_RANGE && !(s.timeslipTurns || 0)
                );
                if (target) {
                    combat.playerTimeslip(aiShip, target);
                    return;
                }
            }
        }

        // Frenzy AI: frenzy when hull low or allies nearby
        if (aiShip.specialMoves && aiShip.specialMoves.includes('frenzy')) {
            const cd = (aiShip.specialMoveCooldowns || {})['frenzy'] || 0;
            if (cd === 0 && !(aiShip.frenzyTurns || 0)) {
                const hullPct = aiShip.hull / aiShip.maxHull;
                const alliesNearby = combat.enemyShips.filter(s => s.alive && s !== aiShip && !s.isSwarmlet && !s.isTorpedo && distance(aiShip.x, aiShip.y, s.x, s.y) <= CONSTANTS.FRENZY_RANGE);
                if (hullPct < 0.4 || alliesNearby.length >= 2) {
                    combat.playerFrenzy(aiShip);
                    return;
                }
            }
        }

        // Torpedo AI: launch torpedo when players in general vicinity
        if (aiShip.specialMoves && aiShip.specialMoves.includes('torpedo')) {
            const cd = (aiShip.specialMoveCooldowns || {})['torpedo'] || 0;
            if (cd === 0 && alivePlayerShips.length > 0) {
                const nearestPlayer = alivePlayerShips.reduce((a, b) =>
                    distance(aiShip.x, aiShip.y, a.x, a.y) < distance(aiShip.x, aiShip.y, b.x, b.y) ? a : b
                );
                if (distance(aiShip.x, aiShip.y, nearestPlayer.x, nearestPlayer.y) < 200) {
                    combat.playerTorpedo(aiShip);
                    return;
                }
            }
        }

        // Neutralize AI: fire at centroid of players clustered in range
        if (aiShip.specialMoves && aiShip.specialMoves.includes('neutralize')) {
            const cd = (aiShip.specialMoveCooldowns || {})['neutralize'] || 0;
            if (cd === 0) {
                const launchDist = CONSTANTS.WARHEAD_LAUNCH_DIST;
                const blastR     = CONSTANTS.NEUTRALIZE_BLAST_RADIUS;
                const cx = aiShip.x + Math.cos(aiShip.rotation) * launchDist;
                const cy = aiShip.y + Math.sin(aiShip.rotation) * launchDist;
                const statusTargets = alivePlayerShips.filter(s => distance(s.x, s.y, cx, cy) <= blastR &&
                    ((s.markedTurns||0)>0||(s.superchargedTurns||0)>0||(s.blindedTurns||0)===0));
                if (statusTargets.length > 0 && Math.random() < 0.55) {
                    combat.playerNeutralize(aiShip, cx, cy);
                    return;
                }
            }
        }

        // Gamma Ray AI: fire when enemies are in the forward cone
        if (aiShip.specialMoves && aiShip.specialMoves.includes('gamma_ray')) {
            const cd = (aiShip.specialMoveCooldowns || {})['gamma_ray'] || 0;
            if (cd === 0) {
                const halfAngle = CONSTANTS.GAMMA_RAY_HALF_ANGLE;
                const range     = combat.getShootRange(aiShip);
                const inCone    = alivePlayerShips.filter(s => {
                    const dist = distance(aiShip.x, aiShip.y, s.x, s.y);
                    if (dist > range) return false;
                    const ang = Math.atan2(s.y - aiShip.y, s.x - aiShip.x);
                    return Math.abs(normalizeAngle(ang - aiShip.rotation)) <= halfAngle;
                });
                if (inCone.length > 0 && Math.random() < 0.65) {
                    combat.playerGammaRay(aiShip);
                    return;
                }
            }
        }

        // Salvage AI: revive dead ally when available
        if (aiShip.specialMoves && aiShip.specialMoves.includes('salvage')) {
            const cd = (aiShip.specialMoveCooldowns || {})['salvage'] || 0;
            if (cd === 0) {
                const deadAlly = combat.enemyShips.find(s => !s.alive && !s.noCorpse);
                if (deadAlly) {
                    combat.playerSalvage(aiShip, deadAlly);
                    return;
                }
            }
        }

        // Mark AI: mark the player ship with lowest hull % in the forward cone
        if (aiShip.specialMoves && aiShip.specialMoves.includes('mark')) {
            const cd = (aiShip.specialMoveCooldowns || {})['mark'] || 0;
            if (cd === 0) {
                const halfAngle = CONSTANTS.MARK_CONE_HALF_ANGLE;
                const markRange = CONSTANTS.MARK_RANGE;
                const inCone = alivePlayerShips.filter(s => {
                    if ((s.markedTurns || 0) > 0) return false; // already marked
                    const dist = distance(aiShip.x, aiShip.y, s.x, s.y);
                    if (dist > markRange) return false;
                    const ang = Math.atan2(s.y - aiShip.y, s.x - aiShip.x);
                    return Math.abs(normalizeAngle(ang - aiShip.rotation)) <= halfAngle;
                });
                if (inCone.length > 0) {
                    const target = inCone.reduce((a, b) => (a.hull / a.maxHull < b.hull / b.maxHull) ? a : b);
                    combat.playerMark(aiShip, target);
                    return;
                }
            }
        }

        // Cloak AI: cloak when hull is below 40% and not already cloaked
        if (aiShip.specialMoves && aiShip.specialMoves.includes('cloak') && !aiShip.cloaked) {
            const cd = (aiShip.specialMoveCooldowns || {})['cloak'] || 0;
            if (cd === 0 && aiShip.hull / aiShip.maxHull < 0.4) {
                combat.playerCloak(aiShip);
                return;
            }
        }

        // EMP Blast AI: fire at densest cluster of player ships in targeting zone
        if (aiShip.specialMoves && aiShip.specialMoves.includes('emp_blast')) {
            const cd = (aiShip.specialMoveCooldowns || {})['emp_blast'] || 0;
            if (cd === 0) {
                const launchDist = CONSTANTS.WARHEAD_LAUNCH_DIST;
                const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
                const blastRadius = CONSTANTS.WARHEAD_BLAST_RADIUS;
                // Pick aim circle center ahead of ship, find if any players are in blast radius
                const aimX = aiShip.x + Math.cos(aiShip.rotation) * launchDist;
                const aimY = aiShip.y + Math.sin(aiShip.rotation) * launchDist;
                const inBlast = alivePlayerShips.filter(s => distance(aimX, aimY, s.x, s.y) <= blastRadius);
                if (inBlast.length >= 1 && Math.random() < 0.7) {
                    // Aim at centroid of targets in blast or nearest player
                    let tx = aimX, ty = aimY;
                    if (inBlast.length > 0) {
                        tx = inBlast.reduce((sum, s) => sum + s.x, 0) / inBlast.length;
                        ty = inBlast.reduce((sum, s) => sum + s.y, 0) / inBlast.length;
                        const d = distance(aiShip.x, aiShip.y, tx, ty);
                        if (d > launchDist + targetRadius) {
                            tx = aiShip.x + (tx - aiShip.x) / d * (launchDist + targetRadius * 0.5);
                            ty = aiShip.y + (ty - aiShip.y) / d * (launchDist + targetRadius * 0.5);
                        }
                    }
                    combat.playerEmpBlast(aiShip, tx, ty);
                    return;
                }
            }
        }

        // Bomb AI: plant a bomb near the nearest enemy cluster
        if (aiShip.specialMoves && aiShip.specialMoves.includes('bomb')) {
            const cd = (aiShip.specialMoveCooldowns || {})['bomb'] || 0;
            if (cd === 0) {
                const launchDist = CONSTANTS.WARHEAD_LAUNCH_DIST;
                const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
                const blastRadius = CONSTANTS.WARHEAD_BLAST_RADIUS;
                const aimX = aiShip.x + Math.cos(aiShip.rotation) * launchDist;
                const aimY = aiShip.y + Math.sin(aiShip.rotation) * launchDist;
                const inBlast = alivePlayerShips.filter(s => distance(aimX, aimY, s.x, s.y) <= blastRadius);
                if (inBlast.length >= 1 && Math.random() < 0.5) {
                    let tx = aimX, ty = aimY;
                    if (inBlast.length > 0) {
                        tx = inBlast.reduce((sum, s) => sum + s.x, 0) / inBlast.length;
                        ty = inBlast.reduce((sum, s) => sum + s.y, 0) / inBlast.length;
                        const d = distance(aiShip.x, aiShip.y, tx, ty);
                        if (d > launchDist + targetRadius) {
                            tx = aiShip.x + (tx - aiShip.x) / d * (launchDist + targetRadius * 0.5);
                            ty = aiShip.y + (ty - aiShip.y) / d * (launchDist + targetRadius * 0.5);
                        }
                    }
                    combat.playerPlantBomb(aiShip, tx, ty);
                    return;
                }
            }
        }

        // Flash AI: flash when 2+ player ships are within FLASH_RANGE of the ship
        if (aiShip.specialMoves && aiShip.specialMoves.includes('flash')) {
            const cd = (aiShip.specialMoveCooldowns || {})['flash'] || 0;
            if (cd === 0) {
                const nearby = alivePlayerShips.filter(s => distance(aiShip.x, aiShip.y, s.x, s.y) <= CONSTANTS.FLASH_BLAST_RADIUS);
                if (nearby.length >= 2) {
                    const cx = nearby.reduce((sum, s) => sum + s.x, 0) / nearby.length;
                    const cy = nearby.reduce((sum, s) => sum + s.y, 0) / nearby.length;
                    const d = distance(aiShip.x, aiShip.y, cx, cy);
                    const tx = d > CONSTANTS.FLASH_RANGE ? aiShip.x + (cx - aiShip.x) / d * CONSTANTS.FLASH_RANGE : cx;
                    const ty = d > CONSTANTS.FLASH_RANGE ? aiShip.y + (cy - aiShip.y) / d * CONSTANTS.FLASH_RANGE : cy;
                    combat.playerFlash(aiShip, tx, ty);
                    return;
                }
            }
        }

        // Tractor beam AI: pull nearest enemy ship or nearby asteroid in forward cone
        if (aiShip.specialMoves && aiShip.specialMoves.includes('tractor_beam')) {
            const cd = (aiShip.specialMoveCooldowns || {})['tractor_beam'] || 0;
            if (cd === 0) {
                const tractorRange = combat.getTractorBeamRange(aiShip);
                const inCone = alivePlayerShips.filter(s => {
                    const dist = distance(aiShip.x, aiShip.y, s.x, s.y);
                    if (dist > tractorRange) return false;
                    const ang = Math.atan2(s.y - aiShip.y, s.x - aiShip.x);
                    const localAng = normalizeAngle(ang - aiShip.rotation);
                    return Math.abs(localAng) <= CONSTANTS.TRACTOR_BEAM_HALF_ANGLE;
                });
                // Also consider yanking a nearby asteroid at an enemy
                const asteroidTargets = combat.asteroids.filter(a => {
                    const dist = distance(aiShip.x, aiShip.y, a.x, a.y);
                    if (dist > tractorRange) return false;
                    const ang = Math.atan2(a.y - aiShip.y, a.x - aiShip.x);
                    const localAng = normalizeAngle(ang - aiShip.rotation);
                    return Math.abs(localAng) <= CONSTANTS.TRACTOR_BEAM_HALF_ANGLE;
                });
                if (inCone.length > 0 && Math.random() < 0.6) {
                    const closest = inCone.reduce((a, b) =>
                        distance(aiShip.x, aiShip.y, a.x, a.y) < distance(aiShip.x, aiShip.y, b.x, b.y) ? a : b);
                    combat.playerTractorBeam(aiShip, closest);
                    return;
                } else if (asteroidTargets.length > 0 && Math.random() < 0.4) {
                    const asteroid = asteroidTargets[Math.floor(Math.random() * asteroidTargets.length)];
                    combat.playerTractorBeam(aiShip, asteroid);
                    return;
                }
            }
        }

        // Debris field AI: fire when enemies are roughly behind
        if (aiShip.specialMoves && aiShip.specialMoves.includes('debris_field')) {
            const cd = (aiShip.specialMoveCooldowns || {})['debris_field'] || 0;
            if (cd === 0) {
                const halfAngle = CONSTANTS.DEBRIS_FIELD_CONE_HALF_ANGLE;
                const nearbyEnemies = alivePlayerShips.filter(s => {
                    const ang = Math.atan2(s.y - aiShip.y, s.x - aiShip.x);
                    const localAng = normalizeAngle(ang - aiShip.rotation + Math.PI);
                    return Math.abs(localAng) <= halfAngle;
                });
                if (nearbyEnemies.length >= 1 && Math.random() < 0.55) {
                    combat.playerDebrisField(aiShip);
                    return;
                }
            }
        }

        // Phased ships: just skip if still phased (shouldn't act anyway, but guard)
        if ((aiShip.phasedTurns || 0) > 0) return;

        // Stasis: cannot act
        if ((aiShip.stasisTurns || 0) > 0) return;

        // Phase AI: phase when hull is below 35%
        if (aiShip.specialMoves && aiShip.specialMoves.includes('phase')) {
            const cd = (aiShip.specialMoveCooldowns || {})['phase'] || 0;
            if (cd === 0 && aiShip.hull / aiShip.maxHull < 0.35 && (aiShip.phasedTurns || 0) === 0) {
                combat.playerPhase(aiShip);
                return;
            }
        }

        // Teleport AI: teleport when cornered (hull < 50% and no targets in range)
        if (aiShip.specialMoves && aiShip.specialMoves.includes('teleport')) {
            const cd = (aiShip.specialMoveCooldowns || {})['teleport'] || 0;
            const shootRange = combat.getShootRange(aiShip);
            const inRange = alivePlayerShips.filter(s => distance(aiShip.x, aiShip.y, s.x, s.y) <= shootRange);
            if (cd === 0 && aiShip.hull / aiShip.maxHull < 0.5 && inRange.length === 0 && Math.random() < 0.5) {
                combat.playerTeleport(aiShip);
                return;
            }
        }

        // Swap AI: swap with nearest player ship if they're in range
        if (aiShip.specialMoves && aiShip.specialMoves.includes('swap')) {
            const cd = (aiShip.specialMoveCooldowns || {})['swap'] || 0;
            if (cd === 0) {
                const swapTarget = alivePlayerShips.find(s => distance(aiShip.x, aiShip.y, s.x, s.y) <= CONSTANTS.SWAP_RANGE);
                if (swapTarget && Math.random() < 0.55) {
                    combat.playerSwap(aiShip, swapTarget);
                    return;
                }
            }
        }

        // Absorb AI: drain hull when surrounded
        if (aiShip.specialMoves && aiShip.specialMoves.includes('absorb')) {
            const cd = (aiShip.specialMoveCooldowns || {})['absorb'] || 0;
            if (cd === 0) {
                const nearby = alivePlayerShips.filter(s => distance(aiShip.x, aiShip.y, s.x, s.y) <= CONSTANTS.ABSORB_RANGE);
                if (nearby.length > 0 && Math.random() < 0.65) {
                    combat.playerAbsorb(aiShip);
                    return;
                }
            }
        }

        // Mirror AI: summon a mirror copy at start of combat (when first action)
        if (aiShip.specialMoves && aiShip.specialMoves.includes('summon_mirror')) {
            const cd = (aiShip.specialMoveCooldowns || {})['summon_mirror'] || 0;
            const hasMirror = combat.enemyShips.some(s => s.isMirror && s.alive && s.mirrorOrigin === aiShip);
            if (cd === 0 && !hasMirror && Math.random() < 0.7) {
                combat.playerSummonMirror(aiShip);
                return;
            }
        }

        // Stasis field AI: deploy near player cluster
        if (aiShip.specialMoves && aiShip.specialMoves.includes('stasis_field')) {
            const cd = (aiShip.specialMoveCooldowns || {})['stasis_field'] || 0;
            if (cd === 0) {
                const nearby = alivePlayerShips.filter(s => distance(aiShip.x, aiShip.y, s.x, s.y) <= CONSTANTS.STASIS_CAST_RANGE + CONSTANTS.STASIS_RADIUS);
                if (nearby.length >= 2 && Math.random() < 0.6) {
                    const cx = nearby.reduce((sum, s) => sum + s.x, 0) / nearby.length;
                    const cy = nearby.reduce((sum, s) => sum + s.y, 0) / nearby.length;
                    combat.playerStasisField(aiShip, cx, cy);
                    return;
                }
            }
        }

        // Doom AI: doom self when hull < 20% and enemy ships are nearby
        if (aiShip.specialMoves && aiShip.specialMoves.includes('doom')) {
            const cd = (aiShip.specialMoveCooldowns || {})['doom'] || 0;
            if (cd === 0 && aiShip.hull / aiShip.maxHull < 0.2 && !(aiShip.doomTurns > 0)) {
                const nearby = alivePlayerShips.filter(s => distance(aiShip.x, aiShip.y, s.x, s.y) <= CONSTANTS.DOOM_BLAST_RADIUS * 1.5);
                if (nearby.length > 0) {
                    combat.playerDoom(aiShip);
                    return;
                }
            }
        }

        // Ravager AI: use ravager (shorter range) when in range
        if (aiShip.specialMoves && aiShip.specialMoves.includes('ravager') || aiShip.hasRavager) {
            const ravRange = combat.getShootRange(aiShip) * CONSTANTS.RAVAGER_RANGE_MULT;
            const inRavRange = alivePlayerShips.filter(s => distance(aiShip.x, aiShip.y, s.x, s.y) <= ravRange && isInFiringZone(aiShip, s));
            if (inRavRange.length > 0 && Math.random() < 0.6) {
                const target = inRavRange.reduce((a, b) => (a.hull < b.hull) ? a : b);
                combat.playerRavager(aiShip, target);
                return;
            }
        }

        // Blink AI: blink toward nearest target if they're within blink range but outside shoot range
        if (aiShip.specialMoves && aiShip.specialMoves.includes('blink')) {
            const cd = (aiShip.specialMoveCooldowns || {})['blink'] || 0;
            if (cd === 0) {
                const shootRange = combat.getShootRange(aiShip);
                const nearest = alivePlayerShips.reduce((a, b) =>
                    distance(aiShip.x, aiShip.y, a.x, a.y) < distance(aiShip.x, aiShip.y, b.x, b.y) ? a : b);
                const nearestDist = distance(aiShip.x, aiShip.y, nearest.x, nearest.y);
                if (nearestDist <= CONSTANTS.BLINK_RANGE * 2 && nearestDist > shootRange && Math.random() < 0.5) {
                    const ang = Math.atan2(nearest.y - aiShip.y, nearest.x - aiShip.x);
                    const blinkDist = Math.min(CONSTANTS.BLINK_RANGE, nearestDist - shootRange * 0.5);
                    const bx = aiShip.x + Math.cos(ang) * blinkDist;
                    const by = aiShip.y + Math.sin(ang) * blinkDist;
                    combat.playerBlink(aiShip, bx, by);
                    return;
                }
            }
        }

        // Afterburner AI: dash toward nearest enemy when out of shoot range
        if (aiShip.specialMoves && aiShip.specialMoves.includes('afterburner')) {
            const cd = (aiShip.specialMoveCooldowns || {})['afterburner'] || 0;
            if (cd === 0) {
                const shootRange = combat.getShootRange(aiShip);
                const nearest = alivePlayerShips.reduce((a, b) =>
                    distance(aiShip.x, aiShip.y, a.x, a.y) < distance(aiShip.x, aiShip.y, b.x, b.y) ? a : b);
                const nearestDist = distance(aiShip.x, aiShip.y, nearest.x, nearest.y);
                const maxRange = aiShip.engine * (CONSTANTS.COMBAT_MOVE_OVAL_OFFSET + CONSTANTS.COMBAT_MOVE_OVAL_MAJOR) * CONSTANTS.AFTERBURNER_RANGE_MULT;
                if (nearestDist > shootRange && nearestDist <= maxRange * 1.5 && Math.random() < 0.5) {
                    const ang = Math.atan2(nearest.y - aiShip.y, nearest.x - aiShip.x);
                    const halfAngle = CONSTANTS.AFTERBURNER_CONE_HALF_ANGLE;
                    const localAng = normalizeAngle(ang - aiShip.rotation);
                    if (Math.abs(localAng) <= halfAngle) {
                        const tx = aiShip.x + Math.cos(ang) * Math.min(maxRange, nearestDist * 0.85);
                        const ty = aiShip.y + Math.sin(ang) * Math.min(maxRange, nearestDist * 0.85);
                        combat.playerAfterburner(aiShip, tx, ty);
                        return;
                    }
                }
            }
        }

        const hullPct = aiShip.hull / aiShip.maxHull;
        const isAlien = aiShip.shipType && aiShip.shipType.startsWith('Alien');

        // Deterministic flee: critical hull, or shields gone + hull below half (aliens never flee)
        // Disabled: enemies will continue choosing attack or reposition instead of doing nothing.
        if (!isAlien && (hullPct < 0.25 || (aiShip.shields <= 0 && hullPct < 0.5))) {
            console.log(`[AI ${aiShip.name}] CRITICAL (low hull) hull=${aiShip.hull}/${aiShip.maxHull} shields=${aiShip.shields}`);
        }

        // Find nearest player ship
        let nearestDist = Infinity, nearestPlayer = null;
        alivePlayerShips.forEach(s => {
            const d = distance(aiShip.x, aiShip.y, s.x, s.y);
            if (d < nearestDist) { nearestDist = d; nearestPlayer = s; }
        });

        const shootRange = combat.getShootRange(aiShip);
        const dangerZone = shootRange * CONSTANTS.AI_RETREAT_DANGER_RANGE;

        // Probabilistic tactical retreat for moderately damaged ships (aliens never retreat)
        if (!isAlien) {
            const healthFactor = 1 - hullPct;
            const proximityFactor = Math.max(0, 1 - nearestDist / dangerZone);
            const retreatThreshold = healthFactor * proximityFactor * CONSTANTS.AI_RETREAT_CHANCE;

            if (Math.random() < retreatThreshold) {
                console.log(`[AI ${aiShip.name}] RETREAT CHECK (tactical) threshold=${retreatThreshold.toFixed(2)} hp=${aiShip.hull}/${aiShip.maxHull}`);
            }
        }

        const hasInRangeTargets = alivePlayerShips.some(s =>
            distance(aiShip.x, aiShip.y, s.x, s.y) <= shootRange);

        console.log(`[AI ${aiShip.name}] decide: nearestDist=${nearestDist.toFixed(0)} shootRange=${shootRange.toFixed(0)} inRange=${hasInRangeTargets}`);

        if (hasInRangeTargets) {
            this.attackAction(aiShip, playerShips, combat);
        } else {
            this.moveAction(aiShip, playerShips, combat);
        }
    }

    // Moves toward nearest target within the ship's movement oval
    static moveAction(aiShip, playerShips, combat) {
        let nearest = null;
        let nearestDist = Infinity;

        playerShips.forEach(ship => {
            if (ship.alive && !ship.cloaked) {
                const dist = distance(aiShip.x, aiShip.y, ship.x, ship.y);
                if (dist < nearestDist) { nearestDist = dist; nearest = ship; }
            }
        });

        if (!nearest) return;

        const angle = Math.atan2(nearest.y - aiShip.y, nearest.x - aiShip.x);
        // Desired point far in direction of target — oval clamps it to reachable area
        const farX = aiShip.x + Math.cos(angle) * aiShip.engine * 20;
        const farY = aiShip.y + Math.sin(angle) * aiShip.engine * 20;
        const clamped = clampToMovementOval(aiShip, farX, farY);
        const dest = this.avoidObstacles(aiShip, clamped.x, clamped.y, combat);
        const moveDist = distance(aiShip.x, aiShip.y, dest.x, dest.y);

        aiShip.targetX = dest.x;
        aiShip.targetY = dest.y;
        aiShip.targetRotation = Math.atan2(dest.y - aiShip.y, dest.x - aiShip.x);
        aiShip.isMoving = true;
        console.log(`[AI ${aiShip.name}] MOVE toward ${nearest.name} dist=${nearestDist.toFixed(0)} moveDist=${moveDist.toFixed(0)}`);
    }

    static attackAction(aiShip, playerShips, combat) {
        const shootRange = combat.getShootRange(aiShip);
        const inRange = playerShips.filter(s => s.alive && !s.cloaked && distance(aiShip.x, aiShip.y, s.x, s.y) <= shootRange);

        // Should not happen given decideAction, but guard anyway
        if (inRange.length === 0) {
            console.log(`[AI ${aiShip.name}] ATTACK: no targets in range, falling back to move`);
            this.moveAction(aiShip, playerShips, combat);
            return;
        }

        // Ram if hull healthy and a target is within movement oval
        if (aiShip.hull >= aiShip.maxHull * 0.5) {
            const ramTargets = inRange.filter(s => isWithinMovementOval(aiShip, s.x, s.y));
            if (ramTargets.length > 0 && Math.random() < 0.35) {
                const bestRam = ramTargets.reduce((a, b) =>
                    (a.hull / a.maxHull < b.hull / b.maxHull) ? a : b);
                console.log(`[AI ${aiShip.name}] RAM ${bestRam.name} hull=${aiShip.hull}/${aiShip.maxHull}`);
                combat.performRam(aiShip, bestRam, aiShip.engine);
                return;
            }
        } else {
            console.log(`[AI ${aiShip.name}] SKIP RAM: hull too low (${aiShip.hull}/${aiShip.maxHull})`);
        }

        // Filter to targets within the firing zone (forward cone for humans, side triangles for aliens)
        const validTargets = inRange.filter(s => isInFiringZone(aiShip, s));

        if (validTargets.length === 0) {
            // Not in firing arc — maneuver to acquire target
            let nearest = inRange[0], nearestDist = distance(aiShip.x, aiShip.y, inRange[0].x, inRange[0].y);
            inRange.forEach(s => {
                const d = distance(aiShip.x, aiShip.y, s.x, s.y);
                if (d < nearestDist) { nearestDist = d; nearest = s; }
            });

            const ang = Math.atan2(nearest.y - aiShip.y, nearest.x - aiShip.x);
            let moveAngle;
            if (aiShip.shipType && aiShip.shipType.startsWith('Alien')) {
                // Alien: strafe to get enemy into a broadside (port/starboard) arc
                const rotPort = normalizeAngle(ang + Math.PI / 2);
                const rotStbd = normalizeAngle(ang - Math.PI / 2);
                const portDelta = Math.abs(normalizeAngle(rotPort - aiShip.rotation));
                const stbdDelta = Math.abs(normalizeAngle(rotStbd - aiShip.rotation));
                moveAngle = portDelta < stbdDelta ? rotPort : rotStbd;
                console.log(`[AI ${aiShip.name}] STRAFE to ${portDelta < stbdDelta ? 'port' : 'stbd'} broadside toward ${nearest.name}`);
            } else {
                // Human: rotate to face the enemy (forward-firing)
                moveAngle = ang;
                console.log(`[AI ${aiShip.name}] FACE toward ${nearest.name}`);
            }

            const farX = aiShip.x + Math.cos(moveAngle) * aiShip.engine * 20;
            const farY = aiShip.y + Math.sin(moveAngle) * aiShip.engine * 20;
            const clamped = clampToMovementOval(aiShip, farX, farY);
            const dest    = this.avoidObstacles(aiShip, clamped.x, clamped.y, combat);

            const moveDist = distance(aiShip.x, aiShip.y, dest.x, dest.y);
            if (moveDist > 0.5) {
                aiShip.targetX        = dest.x;
                aiShip.targetY        = dest.y;
                aiShip.targetRotation = moveAngle;
                aiShip.isMoving       = true;
            }
            return;
        }

        // Pick best target in arc (prefer damaged and closer)
        let bestTarget = validTargets[0];
        let bestScore = Infinity;
        validTargets.forEach(target => {
            const targetHealth = target.hull / target.maxHull;
            const dist = distance(aiShip.x, aiShip.y, target.x, target.y);
            const score = targetHealth * 100 + dist * 0.1;
            if (score < bestScore) { bestScore = score; bestTarget = target; }
        });

        const targetMarked = (bestTarget.markedTurns || 0) > 0;
        const result = aiShip.shootAt(bestTarget, shootRange, targetMarked);

        // Dust cloud: flat 50% additional miss — bypassed if target is marked
        if (!targetMarked && result.hit && (combat.isShipDusty(aiShip) || combat.isShipDusty(bestTarget))) {
            if (Math.random() < CONSTANTS.DUST_MISS_CHANCE) {
                result.hit = false; result.damage = 0; result._dustMiss = true;
            }
        }

        const obstruction = combat.getPathObstructions(aiShip, bestTarget);
        const laserEnd = obstruction ? obstruction.entity : bestTarget;

        combat.addFloatingText('Fire!', '#ff8800', aiShip.x, aiShip.y - 12);
        combat.addAnimation({
            type: 'laser',
            from: { x: aiShip.x, y: aiShip.y },
            to:   { x: laserEnd.x, y: laserEnd.y },
            duration: CONSTANTS.COMBAT_ANIMATION_SPEED,
            totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED
        });

        const delay = CONSTANTS.COMBAT_ANIMATION_SPEED;
        const t = bestTarget;
        if (obstruction) {
            setTimeout(() => {
                combat.addFloatingText('Missed!', '#555555', t.x, t.y - 6);
                combat._applyLaserHitToObstruction(aiShip, obstruction, t);
            }, delay);
        } else if (result.hit) {
            const shieldAbsorb = Math.min(result.damage, t.shields);
            const hullDmg = result.damage - shieldAbsorb;
            setTimeout(() => {
                const wasCloak = t.cloaked;
                t.takeDamage(result.damage, true);
                if (wasCloak) combat.addFloatingText('Revealed!', '#88ffcc', t.x, t.y - 30);
                t.triggerHitFlash(hullDmg, shieldAbsorb);
                if (shieldAbsorb > 0) combat.addFloatingText(`-${shieldAbsorb}`, '#4488ff', t.x, t.y - 20);
                if (hullDmg > 0)      combat.addFloatingText(`-${hullDmg}`,      '#ff4444', t.x, t.y - 6);
                const parts = [];
                if (shieldAbsorb > 0) parts.push(`${shieldAbsorb} shld`);
                if (hullDmg > 0)      parts.push(`${hullDmg} hull`);
                combat.addLog(`${combat._shipLabel(aiShip)} → ${combat._shipLabel(t)}: -${parts.join(' -')}`);
                if (!t.alive) {
                    combat.addAnimation({ type: 'explosion', x: t.x, y: t.y, duration: CONSTANTS.EXPLOSION_DURATION });
                    combat.addLog(`${combat._shipLabel(t)} destroyed!`);
                }
            }, delay);
        } else {
            setTimeout(() => {
                const missLabel = result._dustMiss ? 'Dusty Miss!' : 'Miss!';
                const missColor = result._dustMiss ? '#7799cc' : '#555555';
                combat.addFloatingText(missLabel, missColor, t.x, t.y - 6);
                combat.addLog(`${combat._shipLabel(aiShip)} → ${combat._shipLabel(t)}: ${missLabel}`);
            }, delay);
        }
    }
}
