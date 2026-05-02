// AI System
class AISystem {
    // Move toward nearest arena edge — used when fleeing, constrained to movement oval
    static flee(aiShip, combat) {
        const ang = Math.atan2(aiShip.y - combat.centerY, aiShip.x - combat.centerX);
        const farX = aiShip.x + Math.cos(ang) * aiShip.engine * 20;
        const farY = aiShip.y + Math.sin(ang) * aiShip.engine * 20;
        const dest = clampToMovementOval(aiShip, farX, farY);
        const moveDist = distance(aiShip.x, aiShip.y, dest.x, dest.y);
        aiShip.targetX = dest.x;
        aiShip.targetY = dest.y;
        aiShip.targetRotation = ang;
        aiShip.isMoving = true;
        console.log(`[AI ${aiShip.name}] FLEE toward arena edge ang=${(ang * 180 / Math.PI).toFixed(0)}° dist=${moveDist.toFixed(0)}`);
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
        // Drone AI: detonate if an enemy is within blast radius
        if (aiShip.isDrone) {
            const blastRadius = CONSTANTS.DRONE_BLAST_RADIUS;
            const enemiesInBlast = playerShips.filter(s => s.alive && !s.cloaked && distance(aiShip.x, aiShip.y, s.x, s.y) <= blastRadius);
            if (enemiesInBlast.length >= 1 && Math.random() < 0.65) {
                combat.performDroneDetonate(aiShip);
                return;
            }
            // Drone acts normally (move/shoot) if not detonating
        }

        // Overheated: cannot use any abilities or shoot — just move
        if (aiShip.statusEffect === 'plasma') {
            const aliveTargets = playerShips.filter(s => s.alive && !s.cloaked);
            if (aliveTargets.length > 0) this.moveAction(aiShip, playerShips, combat);
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

        // Repair ship AI: repair the most damaged ally if in range
        if (aiShip.specialMoves && aiShip.specialMoves.includes('repair_beam')) {
            const cd = (aiShip.specialMoveCooldowns || {})['repair_beam'] || 0;
            if (cd === 0) {
                const repairRange = combat.getRepairBeamRange(aiShip);
                const candidates = combat.enemyShips.filter(s =>
                    s !== aiShip && s.alive && !s.isDrone &&
                    s.hull < s.maxHull * 0.75 &&
                    distance(aiShip.x, aiShip.y, s.x, s.y) <= repairRange &&
                    isInFiringZone(aiShip, s)
                );
                if (candidates.length > 0) {
                    const mostDamaged = candidates.reduce((a, b) => (a.hull / a.maxHull < b.hull / b.maxHull) ? a : b);
                    combat.playerRepairBeam(aiShip, mostDamaged);
                    return;
                }
            }
        }

        const alivePlayerShips = playerShips.filter(s => s.alive && !s.cloaked);
        if (alivePlayerShips.length === 0) return;

        const hullPct = aiShip.hull / aiShip.maxHull;

        // Deterministic flee: critical hull, or shields gone + hull below half
        if (hullPct < 0.25 || (aiShip.shields <= 0 && hullPct < 0.5)) {
            console.log(`[AI ${aiShip.name}] FLEE (critical) hull=${aiShip.hull}/${aiShip.maxHull} shields=${aiShip.shields}`);
            this.flee(aiShip, combat);
            return;
        }

        // Find nearest player ship
        let nearestDist = Infinity, nearestPlayer = null;
        alivePlayerShips.forEach(s => {
            const d = distance(aiShip.x, aiShip.y, s.x, s.y);
            if (d < nearestDist) { nearestDist = d; nearestPlayer = s; }
        });

        const shootRange = aiShip.radar * CONSTANTS.SHOOT_RANGE_BASE;
        const dangerZone = shootRange * CONSTANTS.AI_RETREAT_DANGER_RANGE;

        // Probabilistic tactical retreat for moderately damaged ships
        const healthFactor = 1 - hullPct;
        const proximityFactor = Math.max(0, 1 - nearestDist / dangerZone);
        const retreatThreshold = healthFactor * proximityFactor * CONSTANTS.AI_RETREAT_CHANCE;

        if (Math.random() < retreatThreshold) {
            console.log(`[AI ${aiShip.name}] RETREAT (tactical) threshold=${retreatThreshold.toFixed(2)} hp=${aiShip.hull}/${aiShip.maxHull}`);
            this.flee(aiShip, combat);
            return;
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
        const shootRange = aiShip.radar * CONSTANTS.SHOOT_RANGE_BASE;
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

        // Filter to targets within the port/starboard firing zone
        const validTargets = inRange.filter(s => isInFiringZone(aiShip, s));

        if (validTargets.length === 0) {
            // In range but not broadsiding — move in whichever direction achieves the broadside angle.
            let nearest = inRange[0], nearestDist = distance(aiShip.x, aiShip.y, inRange[0].x, inRange[0].y);
            inRange.forEach(s => {
                const d = distance(aiShip.x, aiShip.y, s.x, s.y);
                if (d < nearestDist) { nearestDist = d; nearest = s; }
            });

            const ang = Math.atan2(nearest.y - aiShip.y, nearest.x - aiShip.x);
            const rotPort = normalizeAngle(ang + Math.PI / 2);
            const rotStbd = normalizeAngle(ang - Math.PI / 2);
            const portDelta = Math.abs(normalizeAngle(rotPort - aiShip.rotation));
            const stbdDelta = Math.abs(normalizeAngle(rotStbd - aiShip.rotation));
            const side      = portDelta < stbdDelta ? 'port' : 'stbd';
            const moveAngle = portDelta < stbdDelta ? rotPort : rotStbd;

            const farX = aiShip.x + Math.cos(moveAngle) * aiShip.engine * 20;
            const farY = aiShip.y + Math.sin(moveAngle) * aiShip.engine * 20;
            const clamped = clampToMovementOval(aiShip, farX, farY);
            const dest    = this.avoidObstacles(aiShip, clamped.x, clamped.y, combat);

            const moveDist = distance(aiShip.x, aiShip.y, dest.x, dest.y);
            if (moveDist > 0.5) {
                aiShip.targetX        = dest.x;
                aiShip.targetY        = dest.y;
                aiShip.targetRotation = Math.atan2(dest.y - aiShip.y, dest.x - aiShip.x);
                aiShip.isMoving       = true;
            }
            console.log(`[AI ${aiShip.name}] STRAFE to ${side} broadside toward ${nearest.name} moveDist=${moveDist.toFixed(0)}`);
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

        const result = aiShip.shootAt(bestTarget, shootRange);

        // Dust cloud: flat 50% additional miss if shooter or target is inside a cloud
        if (result.hit && (combat.isShipDusty(aiShip) || combat.isShipDusty(bestTarget))) {
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
                t.takeDamage(result.damage);
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
