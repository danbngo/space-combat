// AI System
class AISystem {
    static decideAction(aiShip, playerShips, combat) {
        const aliveEnemies = playerShips.filter(s => s.alive);
        if (aliveEnemies.length === 0) return;

        const aiFleetHealth = combat.enemyShips.reduce((sum, s) => sum + s.hull, 0);
        const playerFleetHealth = playerShips.reduce((sum, s) => sum + s.hull, 0);

        if (aiFleetHealth < playerFleetHealth * CONSTANTS.AI_RETREAT_HEALTH_RATIO && Math.random() < CONSTANTS.AI_RETREAT_CHANCE) {
            // Flee outside arena boundary
            aiShip.x = combat.centerX + combat.arenaRadius * 1.5;
            aiShip.y = combat.centerY;
            return;
        }

        const actionRoll = Math.random();

        if (actionRoll < CONSTANTS.AI_MOVE_CHANCE && !aiShip.hasMovedThisTurn) {
            this.moveAction(aiShip, playerShips, combat);
        } else if (!aiShip.hasActedThisTurn) {
            if (actionRoll < CONSTANTS.AI_ATTACK_CHANCE) {
                this.attackAction(aiShip, playerShips, combat);
            } else {
                aiShip.skipTurn();
            }
        }
    }

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
            const moveDir = randomFloat(0, 1);
            if (moveDir < 0.5) {
                // Move toward
                const angle = Math.atan2(nearest.y - aiShip.y, nearest.x - aiShip.x);
                const moveDistance = aiShip.getMaxMoveDistance() * CONSTANTS.AI_MOVE_TOWARD_FACTOR;
                aiShip.targetX = aiShip.x + Math.cos(angle) * moveDistance;
                aiShip.targetY = aiShip.y + Math.sin(angle) * moveDistance;
                aiShip.targetRotation = angle;
            } else {
                // Strafe around target
                const angle = Math.atan2(nearest.y - aiShip.y, nearest.x - aiShip.x);
                const perpAngle = angle + (randomBool() ? Math.PI / 2 : -Math.PI / 2);
                const moveDistance = aiShip.getMaxMoveDistance() * CONSTANTS.AI_STRAFE_FACTOR;
                aiShip.targetX = aiShip.x + Math.cos(perpAngle) * moveDistance;
                aiShip.targetY = aiShip.y + Math.sin(perpAngle) * moveDistance;
                aiShip.targetRotation = angle;
            }
            aiShip.hasMovedThisTurn = true;
            aiShip.isMoving = true;
        }
    }

    static attackAction(aiShip, playerShips, combat) {
        const validTargets = playerShips.filter(s => s.alive);
        if (validTargets.length === 0) return;

        // Prefer damaged, closer ships; bonus for being in shooting zone
        let bestTarget = validTargets[0];
        let bestScore = Infinity;

        validTargets.forEach(target => {
            const targetHealth = target.hull / target.maxHull;
            const dist = distance(aiShip.x, aiShip.y, target.x, target.y);
            let score = targetHealth * 100 + dist * 0.1;
            if (!this.isInShootingZone(aiShip, target)) score += 50;
            if (score < bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        });

        const angle = Math.atan2(bestTarget.y - aiShip.y, bestTarget.x - aiShip.x);
        aiShip.targetRotation = angle;

        const result = aiShip.shootAt(bestTarget);

        if (result.hit) {
            bestTarget.takeDamage(result.damage);
            combat.addAnimation({
                type: 'laser',
                from: { x: aiShip.x, y: aiShip.y },
                to: { x: bestTarget.x, y: bestTarget.y },
                damage: result.damage,
                duration: CONSTANTS.COMBAT_ANIMATION_SPEED
            });

            if (!bestTarget.alive) {
                combat.addAnimation({
                    type: 'explosion',
                    x: bestTarget.x,
                    y: bestTarget.y,
                    duration: CONSTANTS.EXPLOSION_DURATION
                });
            }
        }
    }

    static isInShootingZone(shooter, target) {
        const angleToTarget = Math.atan2(target.y - shooter.y, target.x - shooter.x);
        const angleDiff = normalizeAngle(angleToTarget - shooter.targetRotation);
        return Math.abs(angleDiff) < CONSTANTS.SHOOTING_ANGLE;
    }
}
