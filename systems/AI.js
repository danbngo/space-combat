// AI System
class AISystem {
    // Move toward nearest arena edge — used when fleeing
    static flee(aiShip, combat) {
        const ang = Math.atan2(aiShip.y - combat.centerY, aiShip.x - combat.centerX);
        aiShip.targetX = combat.centerX + Math.cos(ang) * combat.arenaRadius * 1.5;
        aiShip.targetY = combat.centerY + Math.sin(ang) * combat.arenaRadius * 1.5;
        aiShip.targetRotation = ang;
        aiShip.isMoving = true;
        console.log(`[AI ${aiShip.name}] FLEE toward arena edge ang=${(ang * 180 / Math.PI).toFixed(0)}°`);
    }

    static decideAction(aiShip, playerShips, combat) {
        const alivePlayerShips = playerShips.filter(s => s.alive);
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

    // Always moves toward nearest target — only called when out of range
    static moveAction(aiShip, playerShips, combat) {
        let nearest = null;
        let nearestDist = Infinity;

        playerShips.forEach(ship => {
            if (ship.alive) {
                const dist = distance(aiShip.x, aiShip.y, ship.x, ship.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = ship;
                }
            }
        });

        if (nearest) {
            const angle = Math.atan2(nearest.y - aiShip.y, nearest.x - aiShip.x);
            const moveDistance = aiShip.getMaxMoveDistance() * CONSTANTS.AI_MOVE_TOWARD_FACTOR;
            aiShip.targetX = aiShip.x + Math.cos(angle) * moveDistance;
            aiShip.targetY = aiShip.y + Math.sin(angle) * moveDistance;
            aiShip.targetRotation = angle;
            aiShip.isMoving = true;
            console.log(`[AI ${aiShip.name}] MOVE toward ${nearest.name} dist=${nearestDist.toFixed(0)} moveDist=${moveDistance.toFixed(0)}`);
        }
    }

    static attackAction(aiShip, playerShips, combat) {
        const shootRange = aiShip.radar * CONSTANTS.SHOOT_RANGE_BASE;
        const inRange = playerShips.filter(s => s.alive && distance(aiShip.x, aiShip.y, s.x, s.y) <= shootRange);

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
            // In range but not broadsiding — rotate in place to nearest broadside angle.
            // No movement here: ships face where they move, so we decouple rotation from movement.
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
            const side = portDelta < stbdDelta ? 'port' : 'stbd';
            aiShip.targetRotation = portDelta < stbdDelta ? rotPort : rotStbd;

            console.log(`[AI ${aiShip.name}] ROTATE to ${side} broadside toward ${nearest.name} dist=${nearestDist.toFixed(0)}`);
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
        console.log(`[AI ${aiShip.name}] FIRE at ${bestTarget.name} dist=${distance(aiShip.x, aiShip.y, bestTarget.x, bestTarget.y).toFixed(0)} hit=${result.hit} dmg=${result.damage}`);

        // Pre-calculate damage split — don't apply yet so bars stay at old values until laser lands
        let shieldAbsorb = 0, hullDmg = 0;
        if (result.hit) {
            shieldAbsorb = Math.min(result.damage, bestTarget.shields);
            hullDmg = result.damage - shieldAbsorb;
        }

        combat.addFloatingText('Fire!', '#ff8800', aiShip.x, aiShip.y - 12);

        // Laser for both hit and miss
        combat.addAnimation({
            type: 'laser',
            from: { x: aiShip.x, y: aiShip.y },
            to: { x: bestTarget.x, y: bestTarget.y },
            duration: CONSTANTS.COMBAT_ANIMATION_SPEED,
            totalDuration: CONSTANTS.COMBAT_ANIMATION_SPEED
        });

        const delay = CONSTANTS.COMBAT_ANIMATION_SPEED;
        const t = bestTarget;
        if (result.hit) {
            const sa = shieldAbsorb, hd = hullDmg;
            setTimeout(() => {
                t.takeDamage(result.damage); // apply after laser arrives
                t.triggerHitFlash(hd, sa);
                if (sa > 0) combat.addFloatingText(`-${sa}`, '#4488ff', t.x, t.y - 20);
                if (hd > 0) combat.addFloatingText(`-${hd}`, '#ff4444', t.x, t.y - 6);
                const parts = [];
                if (sa > 0) parts.push(`${sa} shld`);
                if (hd > 0) parts.push(`${hd} hull`);
                combat.addLog(`${combat._shipLabel(aiShip)} → ${combat._shipLabel(t)}: -${parts.join(' -')}`);
                if (!t.alive) {
                    combat.addAnimation({ type: 'explosion', x: t.x, y: t.y, duration: CONSTANTS.EXPLOSION_DURATION });
                    combat.addLog(`${combat._shipLabel(t)} destroyed!`);
                }
            }, delay);
        } else {
            setTimeout(() => {
                combat.addFloatingText('Miss!', '#555555', t.x, t.y - 6);
                combat.addLog(`${combat._shipLabel(aiShip)} → ${combat._shipLabel(t)}: Miss`);
            }, delay);
        }
    }
}
