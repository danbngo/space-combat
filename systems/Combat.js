// Combat System
class Combat {
    constructor(playerShips, enemyShips) {
        this.playerShips = playerShips;
        this.enemyShips = enemyShips;
        
        this.state = COMBAT_STATE.PLAYER_TURN;
        this.round = 1;
        this.currentShipIndex = 0;
        this.turn = 0;
        
        this.centerX = CONSTANTS.GAME_WIDTH / 2;
        this.centerY = CONSTANTS.GAME_HEIGHT / 2;
        this.arenaRadius = CONSTANTS.COMBAT_ARENA_RADIUS;
        
        this.animations = [];
        this.resolving = false;
        this.won = false;
        this.lost = false;
        this.playerRetreated = false;
        
        // Initialize ship positions in arena
        this.initializeShipPositions();
    }
    
    initializeShipPositions() {
        const offset = this.arenaRadius * CONSTANTS.COMBAT_FORMATION_OFFSET;
        const spread = CONSTANTS.COMBAT_FORMATION_SPREAD;

        this.playerShips.forEach((ship, index) => {
            const angle = (index / this.playerShips.length) * Math.PI * 2;
            ship.x = this.centerX - offset + Math.cos(angle) * spread;
            ship.y = this.centerY + Math.sin(angle) * spread;
            ship.rotation = 0;
            ship.inCombat = true;
        });

        this.enemyShips.forEach((ship, index) => {
            const angle = (index / this.enemyShips.length) * Math.PI * 2 + Math.PI;
            ship.x = this.centerX + offset + Math.cos(angle) * spread;
            ship.y = this.centerY + Math.sin(angle) * spread;
            ship.rotation = Math.PI;
            ship.inCombat = true;
        });
    }
    
    update(deltaTime) {
        this.updateShipAnimations(deltaTime);
        this.updateAnimationTimers(deltaTime);
        this.checkCombatEnd();
        if (renderingSystem) {
            this.render();
        }
    }

    updateShipAnimations(deltaTime) {
        const speed = deltaTime * CONSTANTS.SHIP_ANIMATION_SPEED;

        [this.playerShips, this.enemyShips].forEach(fleet => {
            fleet.forEach(ship => {
                if (ship.isMoving) {
                    const dist = distance(ship.x, ship.y, ship.targetX, ship.targetY);
                    if (dist < speed * 2) {
                        ship.x = ship.targetX;
                        ship.y = ship.targetY;
                        ship.isMoving = false;
                    } else {
                        const angle = Math.atan2(ship.targetY - ship.y, ship.targetX - ship.x);
                        ship.x += Math.cos(angle) * speed;
                        ship.y += Math.sin(angle) * speed;
                    }
                }

                // Smooth rotation
                let rotDiff = normalizeAngle(ship.targetRotation - ship.rotation);
                if (Math.abs(rotDiff) > CONSTANTS.ROTATION_SNAP_THRESHOLD) {
                    ship.rotation += rotDiff * CONSTANTS.ROTATION_LERP_FACTOR;
                } else {
                    ship.rotation = ship.targetRotation;
                }
            });
        });

        // Remove ships that have fled outside the arena
        this.playerShips = removeShipsOutsideArena(this.playerShips, this.centerX, this.centerY, this.arenaRadius);
        this.enemyShips = removeShipsOutsideArena(this.enemyShips, this.centerX, this.centerY, this.arenaRadius);
    }
    
    render() {
        renderingSystem.clear();
        renderingSystem.drawCombatArena(this.centerX, this.centerY, this.arenaRadius);
        
        // Draw all ships
        [this.playerShips, this.enemyShips].forEach(fleet => {
            fleet.forEach(ship => {
                if (ship.alive) {
                    const isSelected = this.state === COMBAT_STATE.PLAYER_TURN && 
                                     this.playerShips[this.currentShipIndex] === ship;
                    renderingSystem.drawShip(ship, isSelected);
                }
            });
        });
        
        // Draw debug info
        this.drawDebugInfo();
    }
    
    drawDebugInfo() {
        renderingSystem.drawStats(`Round: ${this.round}`, 10, 20);
        renderingSystem.drawStats(`Player Ships: ${this.playerShips.filter(s => s.alive).length}`, 10, 35);
        renderingSystem.drawStats(`Enemy Ships: ${this.enemyShips.filter(s => s.alive).length}`, 10, 50);
    }
    
    nextPlayerShip() {
        if (this.state !== COMBAT_STATE.PLAYER_TURN) return;
        
        // Find next alive ship
        let nextIndex = this.currentShipIndex + 1;
        while (nextIndex < this.playerShips.length && !this.playerShips[nextIndex].alive) {
            nextIndex++;
        }
        
        if (nextIndex >= this.playerShips.length) {
            // All player ships have acted, move to enemy turn
            this.endPlayerTurn();
        } else {
            this.currentShipIndex = nextIndex;
        }
    }
    
    endPlayerTurn() {
        this.state = COMBAT_STATE.ENEMY_TURN;
        this.beginEnemyTurn();
    }
    
    beginEnemyTurn() {
        // AI decides actions for enemy ships
        this.state = COMBAT_STATE.RESOLVING;
        
        setTimeout(() => {
            this.resolveEnemyActions();
        }, CONSTANTS.AI_DECISION_DELAY);
    }
    
    resolveEnemyActions() {
        this.enemyShips.forEach(ship => {
            if (ship.alive && !ship.hasActedThisTurn) {
                AISystem.decideAction(ship, this.playerShips, this);
            }
        });

        this.checkCombatEnd();
        if (this.state !== COMBAT_STATE.ENDED) {
            this.endEnemyTurn();
        }
    }
    
    playerShootAt(shooter, target) {
        const result = shooter.shootAt(target);
        
        if (result.hit) {
            target.takeDamage(result.damage);
            this.addAnimation({
                type: 'laser',
                from: { x: shooter.x, y: shooter.y },
                to: { x: target.x, y: target.y },
                damage: result.damage,
                duration: CONSTANTS.COMBAT_ANIMATION_SPEED
            });
            
            if (!target.alive) {
                this.addAnimation({
                    type: 'explosion',
                    x: target.x,
                    y: target.y,
                    duration: CONSTANTS.EXPLOSION_DURATION
                });
            }
        }
        
        this.nextPlayerShip();
    }
    
    playerSkipTurn(ship) {
        ship.skipTurn();
        this.nextPlayerShip();
    }
    
    moveTowardShip(mover, target) {
        const dist = distance(mover.x, mover.y, target.x, target.y);
        if (dist > 0) {
            mover.moveToward(target.x, target.y, mover.getMaxMoveDistance());
        }
    }
    
    addAnimation(animation) {
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
        // Reset all ship turn states
        this.playerShips.forEach(ship => ship.resetTurn());
        this.enemyShips.forEach(ship => ship.resetTurn());
        
        this.round++;
        this.currentShipIndex = 0;
        this.state = COMBAT_STATE.PLAYER_TURN;
    }
    
    checkCombatEnd() {
        const alivePlayerShips = this.playerShips.filter(s => s.alive).length;
        const aliveEnemyShips = this.enemyShips.filter(s => s.alive).length;
        
        if (aliveEnemyShips === 0) {
            this.won = true;
            this.state = COMBAT_STATE.ENDED;
        } else if (alivePlayerShips === 0) {
            this.lost = true;
            this.state = COMBAT_STATE.ENDED;
        }
    }
    
    playerRetreat() {
        this.playerRetreated = true;
        this.state = COMBAT_STATE.ENDED;
    }
    
    getRewards() {
        const destroyedEnemies = this.enemyShips.filter(s => !s.alive).length;
        return destroyedEnemies * CONSTANTS.CREDITS_PER_ENEMY_DESTROYED;
    }
}
