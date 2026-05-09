// Rendering System
class RenderingSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this._mouseIsDown = false;
        this._dragMoved = false;
        this._lastMouseX = 0;
        this._lastMouseY = 0;
        this.hoveredWorldX = null;
        this.hoveredWorldY = null;
        this._stars = Array.from({ length: 150 }, () => ({
            x: Math.random(), y: Math.random(),
            b: Math.floor(180 + Math.random() * 76)
        }));
    }

    resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        if (wrapper) {
            const w = wrapper.clientWidth;
            const h = wrapper.clientHeight;
            if (w > 0 && h > 0) {
                this.canvas.width = w;
                this.canvas.height = h;
            }
        }
    }

    fitArenaToCanvas() {
        const radius = CONSTANTS.COMBAT_ARENA_RADIUS;
        const cx = CONSTANTS.GAME_WIDTH / 2;
        const cy = CONSTANTS.GAME_HEIGHT / 2;
        const padding = 40;
        const scaleX = (this.canvas.width - padding * 2) / (radius * 2);
        const scaleY = (this.canvas.height - padding * 2) / (radius * 2);
        this.zoom = Math.min(scaleX, scaleY, 2.5) * 2;
        this.panX = this.canvas.width / 2 - cx * this.zoom;
        this.panY = this.canvas.height / 2 - cy * this.zoom;
    }

    zoomIn() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const worldBefore = this.screenToWorld(cx, cy);
        this.zoom = Math.min(this.zoom * 1.2, 5);
        this.panX = cx - worldBefore.x * this.zoom;
        this.panY = cy - worldBefore.y * this.zoom;
    }

    zoomOut() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const worldBefore = this.screenToWorld(cx, cy);
        this.zoom = Math.max(this.zoom / 1.2, 0.8);
        this.panX = cx - worldBefore.x * this.zoom;
        this.panY = cy - worldBefore.y * this.zoom;
    }

    worldToScreen(wx, wy) {
        return { x: wx * this.zoom + this.panX, y: wy * this.zoom + this.panY };
    }

    screenToWorld(sx, sy) {
        return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom };
    }

    initCombatEventListeners(onClickWorld) {
        this._onClickWorld = onClickWorld;
        if (this._combatListenersInited) return;
        this._combatListenersInited = true;

        this.canvas.addEventListener('mousedown', (e) => {
            this._mouseIsDown = true;
            this._dragMoved = false;
            this._dragDist = 0;
            this._lastMouseX = e.clientX;
            this._lastMouseY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const world = this.screenToWorld(sx, sy);
            this.hoveredWorldX = world.x;
            this.hoveredWorldY = world.y;

            // Debug logging during targeting modes
            if (combat && combat.playerMode && !this._mouseIsDown) {
                const active = combat.playerShips[combat.currentShipIndex];
                if (active && active.alive) {
                    const hovered = [...combat.playerShips, ...combat.enemyShips].find(
                        s => s.alive && distance(s.x, s.y, world.x, world.y) <= CONSTANTS.SHIP_SIZE * 3 * (s.sizeMult ?? 1.0)
                    ) || null;
                    if (hovered !== this._lastHoveredDebugShip) {
                        this._lastHoveredDebugShip = hovered;
                        if (hovered) {
                            const dist       = distance(active.x, active.y, hovered.x, hovered.y);
                            const shootRange = (active.radar * CONSTANTS.SHOOT_RANGE_BASE) * ((active.superchargedTurns || 0) > 0 ? 2 : 1);
                            const inRange    = dist <= shootRange;
                            const inZone     = isInFiringZone(active, hovered);
                            const inOval     = isWithinMovementOval(active, hovered.x, hovered.y);
                            const selectable = combat.playerMode === 'fire'
                                ? (!hovered.isPlayer && inRange && inZone && active.actionsRemaining > 0)
                                : (!hovered.isPlayer && inOval  && active.actionsRemaining > 0);
                            console.log(
                                `[hover:${combat.playerMode}] ${hovered.name}`,
                                `pos=(${hovered.x.toFixed(1)},${hovered.y.toFixed(1)})`,
                                `dist=${dist.toFixed(1)} shootRange=${shootRange.toFixed(1)}`,
                                `inRange=${inRange} inZone=${inZone} inOval=${inOval}`,
                                `isEnemy=${!hovered.isPlayer} actions=${active.actionsRemaining}`,
                                `→ selectable=${selectable}`,
                                `| activeRot=${(active.rotation * 180 / Math.PI).toFixed(1)}°`
                            );
                        }
                    }
                }
            }

            if (this._mouseIsDown) {
                const dx = e.clientX - this._lastMouseX;
                const dy = e.clientY - this._lastMouseY;
                if (dx !== 0 || dy !== 0) {
                    this.panX += dx;
                    this.panY += dy;
                    // Accumulate total distance; suppress click only after crossing threshold
                    this._dragDist += Math.sqrt(dx * dx + dy * dy);
                    if (this._dragDist > 4) this._dragMoved = true;
                }
                this._lastMouseX = e.clientX;
                this._lastMouseY = e.clientY;
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this._mouseIsDown = false;
            if (!this._dragMoved) {
                const rect = this.canvas.getBoundingClientRect();
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;
                const world = this.screenToWorld(sx, sy);
                if (this._onClickWorld) this._onClickWorld(world.x, world.y);
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this._mouseIsDown = false;
            this.hoveredWorldX = null;
            this.hoveredWorldY = null;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const worldBefore = this.screenToWorld(sx, sy);
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            this.zoom = Math.max(0.8, Math.min(5, this.zoom * factor));
            this.panX = sx - worldBefore.x * this.zoom;
            this.panY = sy - worldBefore.y * this.zoom;
        }, { passive: false });
    }

    clear() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this._stars.forEach(s => {
            this.ctx.fillStyle = `rgb(${s.b},${s.b},${s.b})`;
            this.ctx.fillRect(s.x * this.canvas.width, s.y * this.canvas.height, 1, 1);
        });
        this.ctx.setTransform(this.zoom, 0, 0, this.zoom, this.panX, this.panY);
    }

    drawCombatArena(centerX, centerY, radius) {
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.fillStyle = '#666666';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 3 / this.zoom, 0, Math.PI * 2);
        this.ctx.fill();
    }

    // Returns the hex color for a ship's current most-prominent status effect, or null
    _lerpColor(colA, colB, t) {
        const r1 = parseInt(colA.slice(1, 3), 16), g1 = parseInt(colA.slice(3, 5), 16), b1 = parseInt(colA.slice(5, 7), 16);
        const r2 = parseInt(colB.slice(1, 3), 16), g2 = parseInt(colB.slice(3, 5), 16), b2 = parseInt(colB.slice(5, 7), 16);
        const r  = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0');
        const g  = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0');
        const b  = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    _statusEffectColor(ship) {
        if ((ship.markedTurns || 0) > 0)       return '#ff8800';
        if ((ship.berserkTurns || 0) > 0)      return '#ff44ff';
        if ((ship.superchargedTurns || 0) > 0) return '#ffee00';
        if ((ship.blindedTurns || 0) > 0)      return '#ffffff';
        if (ship.statusEffect === 'dust')       return '#6688cc';
        if (ship.statusEffect === 'ice')        return '#44ccff';
        if (ship.statusEffect === 'plasma')     return '#ff8833';
        if (ship.cloaked && ship.isPlayer)      return '#aaffee';
        return null;
    }

    _statusEffectLabel(ship) {
        if ((ship.markedTurns || 0) > 0)       return 'MARK';
        if ((ship.berserkTurns || 0) > 0)      return 'BSRK';
        if ((ship.superchargedTurns || 0) > 0) return 'SUPR';
        if ((ship.blindedTurns || 0) > 0)      return 'BLND';
        if (ship.statusEffect === 'dust')       return 'DUST';
        if (ship.statusEffect === 'ice')        return 'FRZN';
        if (ship.statusEffect === 'plasma')     return 'HEAT';
        if (ship.cloaked && ship.isPlayer)      return 'INVS';
        return null;
    }

    // isActiveTurn = green ring, isSelected = cyan dashed ring, isHovered = highlight, isDimmed = faded, isWreck = destroyed, isCloaked = stealth, escapeAlpha = fade-out 0→1
    drawShip(ship, isActiveTurn = false, isSelected = false, isHovered = false, isDimmed = false, isWreck = false, isCloaked = false, escapeAlpha = 1) {
        if (isCloaked && !ship.isPlayer) return; // enemy cloaked ships are completely invisible
        this.ctx.save();
        if (escapeAlpha < 1) this.ctx.globalAlpha = escapeAlpha;
        else if (isCloaked) this.ctx.globalAlpha = 0.5; // player cloaked ships: 50% transparent
        else if (isWreck) this.ctx.globalAlpha = 0.55;
        // isDimmed uses brightness filter on the body block only — rings stay at full alpha
        const SIZE = CONSTANTS.SHIP_SIZE * (ship.sizeMult ?? 1.0);

        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];

        // Ring radius just outside the ship's furthest vertex
        const maxDist = Math.max(...verts.map(v => Math.sqrt(v[0] * v[0] + v[1] * v[1])));
        const RING_R = maxDist * SIZE * 1.3;

        // --- Rotated block: body + shield outline ---
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        if (isDimmed) this.ctx.filter = 'brightness(30%)';

        // Ship body: hull-flash (4-pulse) > hover > default
        const now = Date.now();
        const hullFlashAge = now - (ship._hullFlashStart || 0);
        const hullFlash   = hullFlashAge < 1000 && Math.floor(hullFlashAge / 125) % 2 === 0;
        const shieldFlash = now < (ship._shieldFlashUntil || 0);

        // Try sprite first; fall back to vector polygon if no sprite loaded
        const spriteId  = ship.shipType.toLowerCase().replace(/ /g, '_');
        const spriteImg = spriteSystem.getImage(spriteId);

        if (spriteImg) {
            const worldDiam   = maxDist * SIZE * 2;
            const spriteScale = worldDiam / Math.max(spriteImg.naturalWidth, spriteImg.naturalHeight);

            // Shield glow — single tinted draw with shadow blur; normal sprite draw follows and overlaps it,
            // leaving only the shadow halo (which lives in the transparent pixels outside the sprite) visible.
            if (!isWreck && (ship.shields > 0 || shieldFlash)) {
                const glowColor = shieldFlash ? '#ff2222' : '#00c8ff';
                const outerAlpha = this.ctx.globalAlpha;
                const shieldFrac = shieldFlash ? 1.0 : (ship.maxShields > 0 ? ship.shields / ship.maxShields : 0);
                this.ctx.save();
                this.ctx.globalAlpha = outerAlpha * 0.85 * Math.max(0.15, shieldFrac);
                this.ctx.shadowColor = glowColor;
                this.ctx.shadowBlur = 10;
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
                spriteSystem.draw(this.ctx, spriteId, 0, 0, Math.PI / 2, spriteScale, { tint: glowColor, tintAlpha: 1.0 });
                this.ctx.restore();
            }

            // Tint: hull-flash > wreck > hover > faction/player color
            let tint, tintAlpha;
            if (hullFlash) {
                tint = '#880000'; tintAlpha = 0.75;
            } else if (isWreck) {
                tint = ship.isPlayer ? '#222233' : '#550000'; tintAlpha = 0.80;
            } else if (isHovered) {
                tint = '#ffffff'; tintAlpha = 0.30;
            } else if (ship.isDrone) {
                tint = ship.isPlayer ? '#ffaa33' : '#ff7700'; tintAlpha = 0.50;
            } else if (ship.isPlayer) {
                tint = '#cccccc'; tintAlpha = 0.35;
            } else {
                tint = ship.factionColor || '#ff4444'; tintAlpha = 0.45;
            }

            // Lerp tint toward status effect color in a single draw — avoids white-flash
            // from re-rendering the sprite's natural colors as a second overlay pass.
            const statusColor = !hullFlash && !isWreck ? this._statusEffectColor(ship) : null;
            if (statusColor) {
                const pulseFrac = (Math.sin((Date.now() % 2000) / 2000 * Math.PI * 2) * 0.5 + 0.5);
                tint = this._lerpColor(tint, statusColor, pulseFrac * 0.8);
            }

            // Sprites face up; +π/2 rotates them to face the game's +X forward direction.
            spriteSystem.draw(this.ctx, spriteId, 0, 0, Math.PI / 2, spriteScale, { tint, tintAlpha });
        } else {
            // Vector fallback
            let fillColor;
            if (isWreck) {
                fillColor = ship.isPlayer ? '#333333' : '#880000';
            } else if (hullFlash) {
                fillColor = '#880000';
            } else if (isHovered) {
                fillColor = ship.isPlayer ? '#ffffff' : '#ffaaaa';
            } else {
                fillColor = ship.isDrone ? (ship.isPlayer ? '#ffaa33' : '#ff7700') : (ship.isPlayer ? '#aaaaaa' : (ship.factionColor || '#ff3333'));
            }
            // Lerp fill color toward status effect color for a smooth single-pass pulse
            const statusColorVec = !hullFlash && !isWreck ? this._statusEffectColor(ship) : null;
            if (statusColorVec) {
                const pulseFrac = (Math.sin((Date.now() % 2000) / 2000 * Math.PI * 2) * 0.5 + 0.5);
                fillColor = this._lerpColor(fillColor, statusColorVec, pulseFrac * 0.8);
            }
            this.ctx.fillStyle = fillColor;
            drawShipShape(this.ctx, verts, SIZE);
            this.ctx.fill();

            // Polygon shield outline (vector ships only)
            if (!isWreck && (ship.shields > 0 || shieldFlash)) {
                const alpha = shieldFlash ? 1 : 0.8;
                const glowColor = shieldFlash ? `rgba(255,0,0,${alpha})` : `rgba(0,200,255,${alpha})`;
                this.ctx.strokeStyle = glowColor;
                this.ctx.shadowColor = glowColor;
                this.ctx.shadowBlur = 10;
                this.ctx.lineWidth = 1 / this.zoom;
                drawShipShape(this.ctx, verts, SIZE * 1.5);
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
            }
        }

        this.ctx.restore();

        // --- Non-rotated block: rings — skip for wreckage ---
        if (!isWreck) {
            this.ctx.save();
            this.ctx.translate(ship.x, ship.y);

            if (isActiveTurn) {
                this.ctx.strokeStyle = '#00ff44';
                this.ctx.lineWidth = 2.5 / this.zoom;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, RING_R, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            if (isSelected) {
                this.ctx.strokeStyle = '#00ffff';
                this.ctx.lineWidth = 2 / this.zoom;
                this.ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
                this.ctx.beginPath();
                this.ctx.arc(0, 0, RING_R, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }

            // Berserk: pulsing magenta glow ring
            if ((ship.berserkTurns || 0) > 0) {
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
                this.ctx.strokeStyle = `rgba(255, 44, 255, ${0.6 + pulse * 0.4})`;
                this.ctx.lineWidth = (2 + pulse * 2) / this.zoom;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, RING_R * 1.2, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            // Marked: pulsing orange targeting ring with crosshair ticks
            if ((ship.markedTurns || 0) > 0) {
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
                this.ctx.strokeStyle = `rgba(255, 136, 0, ${0.65 + pulse * 0.35})`;
                this.ctx.lineWidth = (1.5 + pulse * 1.5) / this.zoom;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, RING_R * 1.25, 0, Math.PI * 2);
                this.ctx.stroke();
                // Four tick marks at cardinal angles
                const tickR = RING_R * 1.25;
                const tickLen = 4 / this.zoom;
                [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
                    this.ctx.beginPath();
                    this.ctx.moveTo(dx * (tickR - tickLen), dy * (tickR - tickLen));
                    this.ctx.lineTo(dx * (tickR + tickLen), dy * (tickR + tickLen));
                    this.ctx.stroke();
                });
            }

            this.ctx.restore();
        }

        this.ctx.restore(); // outer save
    }

    // Small hull + shield bars drawn in world space just above the ship
    drawShipBars(ship) {
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];
        // Top of shield outline for this ship type (max vertical vertex × shield scale)
        const maxSide = Math.max(...verts.map(v => Math.abs(v[1]))) * CONSTANTS.SHIP_SIZE * (ship.sizeMult ?? 1.0) * 1.5;
        const yBase = -(maxSide + 10); // lifted to leave gap below bars for status text

        const W = 20, H = 1.8, GAP = 1;

        const now = Date.now();

        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);

        // Hull bar — current value, then flash overlays pre-damage width in red
        const hullPct = Math.max(0, ship.hull / ship.maxHull);
        const hullFlashAge = now - (ship._hullFlashStart || 0);
        const hullBarFlash = hullFlashAge < 1000 && Math.floor(hullFlashAge / 125) % 2 === 0;
        const hullColor = hullPct > 0.5 ? '#00aa44' : hullPct > 0.25 ? '#ccaa00' : '#cc2200';
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(-W / 2, yBase - H, W, H);
        this.ctx.fillStyle = hullColor;
        this.ctx.fillRect(-W / 2, yBase - H, W * hullPct, H);
        if (hullBarFlash && ship._hullFlashPct > 0) {
            this.ctx.fillStyle = '#ff2222';
            this.ctx.fillRect(-W / 2, yBase - H, W * ship._hullFlashPct, H);
        }

        // Shield bar — current value, damage flash (red), recharge flash (cyan)
        if (ship.maxShields > 0) {
            const shPct = Math.max(0, ship.shields / ship.maxShields);
            const shFlashAge = now - (ship._shieldBarFlashStart || 0);
            const shBarFlash = shFlashAge < 1000 && Math.floor(shFlashAge / 125) % 2 === 0;
            const shRechargeAge = now - (ship._shieldRechargeFlashStart || 0);
            const shRechargeFlash = shRechargeAge < 1000 && Math.floor(shRechargeAge / 125) % 2 === 0;
            this.ctx.fillStyle = '#0a1820';
            this.ctx.fillRect(-W / 2, yBase - H - GAP - H, W, H);
            if (shPct > 0) {
                this.ctx.fillStyle = '#0088bb';
                this.ctx.fillRect(-W / 2, yBase - H - GAP - H, W * shPct, H);
            }
            if (shBarFlash && ship._shieldFlashPct > 0) {
                this.ctx.fillStyle = '#ff2222';
                this.ctx.fillRect(-W / 2, yBase - H - GAP - H, W * ship._shieldFlashPct, H);
            }
            if (shRechargeFlash && ship._shieldRechargePct > 0) {
                this.ctx.fillStyle = '#00ffff';
                this.ctx.fillRect(-W / 2, yBase - H - GAP - H, W * ship._shieldRechargePct, H);
            }
        }

        // Status effect label in the gap between bars and ship top
        const statusLabel = this._statusEffectLabel(ship);
        const statusColor = this._statusEffectColor(ship);
        if (statusLabel && statusColor) {
            this.ctx.font = `5px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'alphabetic';
            this.ctx.fillStyle = statusColor;
            this.ctx.fillText(statusLabel, 0, -maxSide);
        }

        this.ctx.restore();
    }

    // Dashed oval shifted forward — shows where the ship can move this turn
    drawWarheadBlast(x, y, progress) {
        const blastR = CONSTANTS.WARHEAD_BLAST_RADIUS;
        const alpha  = Math.max(0, 1 - progress);

        this.ctx.save();

        // Expanding outer shockwave ring
        const outerR = blastR * (0.2 + progress * 0.95);
        this.ctx.globalAlpha = alpha * 0.9;
        this.ctx.strokeStyle = '#ff4400';
        this.ctx.lineWidth   = (4 * (1 - progress * 0.8)) / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(x, y, Math.max(0.5, outerR), 0, Math.PI * 2);
        this.ctx.stroke();

        // Second ring slightly behind
        if (progress > 0.1) {
            const innerR = blastR * (0.2 + (progress - 0.1) * 0.8);
            this.ctx.globalAlpha = alpha * 0.6;
            this.ctx.strokeStyle = '#ffaa00';
            this.ctx.lineWidth   = (2.5 * (1 - progress * 0.7)) / this.zoom;
            this.ctx.beginPath();
            this.ctx.arc(x, y, Math.max(0.5, innerR), 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Central flash (first 30% of animation only)
        if (progress < 0.3) {
            const flashT  = 1 - progress / 0.3;
            const flashR  = blastR * 0.45 * flashT;
            this.ctx.globalAlpha = flashT * 0.55;
            this.ctx.fillStyle   = '#ffdd44';
            this.ctx.beginPath();
            this.ctx.arc(x, y, Math.max(0.5, flashR), 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }

    drawFlashBlast(x, y, progress) {
        const blastR = CONSTANTS.FLASH_BLAST_RADIUS;
        const alpha  = Math.max(0, 1 - progress);
        this.ctx.save();

        // Bright white-yellow expanding fill
        const r = blastR * (0.1 + progress * 0.9);
        this.ctx.globalAlpha = alpha * (progress < 0.2 ? 0.9 : 0.5);
        this.ctx.fillStyle   = '#ffffcc';
        this.ctx.beginPath();
        this.ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
        this.ctx.fill();

        // Outer ring
        this.ctx.globalAlpha = alpha * 0.85;
        this.ctx.strokeStyle = '#ffff44';
        this.ctx.lineWidth   = (3 * (1 - progress * 0.8)) / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(x, y, Math.max(0.5, blastR * (0.15 + progress * 0.85)), 0, Math.PI * 2);
        this.ctx.stroke();

        // Inner burst flash
        if (progress < 0.25) {
            const flashT = 1 - progress / 0.25;
            this.ctx.globalAlpha = flashT * 0.7;
            this.ctx.fillStyle   = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(x, y, Math.max(0.5, blastR * 0.5 * flashT), 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }

    drawEmpBlast(x, y, progress) {
        const blastR = CONSTANTS.WARHEAD_BLAST_RADIUS;
        const alpha  = Math.max(0, 1 - progress);

        this.ctx.save();

        // Expanding outer shockwave ring (cyan/electric)
        const outerR = blastR * (0.2 + progress * 0.95);
        this.ctx.globalAlpha = alpha * 0.9;
        this.ctx.strokeStyle = '#00ddff';
        this.ctx.lineWidth   = (4 * (1 - progress * 0.8)) / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(x, y, Math.max(0.5, outerR), 0, Math.PI * 2);
        this.ctx.stroke();

        if (progress > 0.1) {
            const innerR = blastR * (0.2 + (progress - 0.1) * 0.8);
            this.ctx.globalAlpha = alpha * 0.6;
            this.ctx.strokeStyle = '#88ffff';
            this.ctx.lineWidth   = (2.5 * (1 - progress * 0.7)) / this.zoom;
            this.ctx.beginPath();
            this.ctx.arc(x, y, Math.max(0.5, innerR), 0, Math.PI * 2);
            this.ctx.stroke();
        }

        if (progress < 0.3) {
            const flashT = 1 - progress / 0.3;
            const flashR = blastR * 0.45 * flashT;
            this.ctx.globalAlpha = flashT * 0.45;
            this.ctx.fillStyle   = '#aaffff';
            this.ctx.beginPath();
            this.ctx.arc(x, y, Math.max(0.5, flashR), 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }

    drawBomb(bomb) {
        if (!bomb.alive) return;
        const size = CONSTANTS.SHIP_SIZE * 2.5;
        const pulse = Math.abs(Math.sin(Date.now() / 300));

        this.ctx.save();
        this.ctx.translate(bomb.x, bomb.y);

        // Outer ring — flashes faster when last turn
        const speed = bomb.bombLifetime <= 1 ? 150 : 300;
        const fastPulse = Math.abs(Math.sin(Date.now() / speed));
        this.ctx.strokeStyle = `rgba(255, ${Math.floor(60 + fastPulse * 120)}, 0, 0.9)`;
        this.ctx.lineWidth = (2 * (0.5 + fastPulse * 0.5)) / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size + 2 / this.zoom, 0, Math.PI * 2);
        this.ctx.stroke();

        // Body
        this.ctx.fillStyle = bomb.isPlayer ? '#cc7700' : '#882200';
        this.ctx.strokeStyle = '#ff4400';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Inner pulse glow
        this.ctx.fillStyle = `rgba(255, 200, 0, ${pulse * 0.55})`;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
        this.ctx.fill();

        // Lifetime countdown
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${Math.round(9 / this.zoom)}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(bomb.bombLifetime.toString(), 0, 0);

        this.ctx.restore();

        this.drawShipBars(bomb);
    }

    // Expanding ring used for blink departure / arrival flash
    drawBlinkRing(x, y, progress) {
        const maxR = 28;
        const r    = maxR * progress;
        const alpha = Math.max(0, 1 - progress);
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.strokeStyle = '#cc99ff';
        this.ctx.lineWidth = (2.5 * (1 - progress * 0.6)) / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawChaingunRange(ship) {
        const range = ship.radar * CONSTANTS.SHOOT_RANGE_BASE;
        const SIZE  = CONSTANTS.SHIP_SIZE * (ship.sizeMult ?? 1.0);
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];
        const halfBase = range * 0.65;
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        this.ctx.fillStyle   = 'rgba(255, 136, 0, 0.10)';
        this.ctx.strokeStyle = 'rgba(255, 136, 0, 0.45)';
        this.ctx.lineWidth = 0.5 / this.zoom;
        if (ship.shipType && ship.shipType.startsWith('Alien')) {
            const maxSide = Math.max(...verts.map(v => Math.abs(v[1])));
            const sideOffset = maxSide * SIZE * 1.15;
            this.ctx.beginPath(); this.ctx.moveTo(0, -sideOffset); this.ctx.lineTo(-halfBase, -sideOffset - range); this.ctx.lineTo(halfBase, -sideOffset - range); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.moveTo(0,  sideOffset); this.ctx.lineTo(-halfBase,  sideOffset + range); this.ctx.lineTo(halfBase,  sideOffset + range); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        } else {
            const maxFwd = Math.max(...verts.map(v => Math.abs(v[0])));
            const fwdOffset = maxFwd * SIZE * 1.15;
            this.ctx.beginPath(); this.ctx.moveTo(fwdOffset, 0); this.ctx.lineTo(fwdOffset + range, -halfBase); this.ctx.lineTo(fwdOffset + range, halfBase); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        }
        this.ctx.restore();
    }

    drawPlasmaRange(ship) {
        const range = ship.radar * CONSTANTS.SHOOT_RANGE_BASE * CONSTANTS.PLASMA_RANGE_MULT;
        const SIZE  = CONSTANTS.SHIP_SIZE * (ship.sizeMult ?? 1.0);
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];
        const halfBase = range * 0.65;
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        this.ctx.fillStyle   = 'rgba(100, 255, 150, 0.10)';
        this.ctx.strokeStyle = 'rgba(100, 255, 150, 0.45)';
        this.ctx.lineWidth = 0.5 / this.zoom;
        if (ship.shipType && ship.shipType.startsWith('Alien')) {
            const maxSide = Math.max(...verts.map(v => Math.abs(v[1])));
            const sideOffset = maxSide * SIZE * 1.15;
            this.ctx.beginPath(); this.ctx.moveTo(0, -sideOffset); this.ctx.lineTo(-halfBase, -sideOffset - range); this.ctx.lineTo(halfBase, -sideOffset - range); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.moveTo(0,  sideOffset); this.ctx.lineTo(-halfBase,  sideOffset + range); this.ctx.lineTo(halfBase,  sideOffset + range); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        } else {
            const maxFwd = Math.max(...verts.map(v => Math.abs(v[0])));
            const fwdOffset = maxFwd * SIZE * 1.15;
            this.ctx.beginPath(); this.ctx.moveTo(fwdOffset, 0); this.ctx.lineTo(fwdOffset + range, -halfBase); this.ctx.lineTo(fwdOffset + range, halfBase); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        }
        this.ctx.restore();
    }

    drawRocketRange(ship) {
        const launchDist   = CONSTANTS.WARHEAD_LAUNCH_DIST;
        const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
        const blastRadius  = CONSTANTS.ROCKET_BLAST_RADIUS;
        const cx = ship.x + Math.cos(ship.rotation) * launchDist;
        const cy = ship.y + Math.sin(ship.rotation) * launchDist;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 100, 50, 0.4)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath(); this.ctx.moveTo(ship.x, ship.y); this.ctx.lineTo(cx, cy); this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = 'rgba(255, 100, 50, 0.7)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([3 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath(); this.ctx.arc(cx, cy, targetRadius, 0, Math.PI * 2); this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = 'rgba(255, 100, 50, 0.12)';
        this.ctx.lineWidth = 0.5 / this.zoom;
        this.ctx.beginPath(); this.ctx.arc(cx, cy, targetRadius + blastRadius, 0, Math.PI * 2); this.ctx.stroke();
        const ch = 4 / this.zoom;
        this.ctx.strokeStyle = 'rgba(255, 100, 50, 0.8)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath(); this.ctx.moveTo(cx - ch, cy); this.ctx.lineTo(cx + ch, cy); this.ctx.moveTo(cx, cy - ch); this.ctx.lineTo(cx, cy + ch); this.ctx.stroke();
        this.ctx.restore();
    }

    drawRocketCursor(ship, wx, wy) {
        const launchDist   = CONSTANTS.WARHEAD_LAUNCH_DIST;
        const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
        const blastRadius  = CONSTANTS.ROCKET_BLAST_RADIUS;
        const acx = ship.x + Math.cos(ship.rotation) * launchDist;
        const acy = ship.y + Math.sin(ship.rotation) * launchDist;
        const d = distance(acx, acy, wx, wy);
        const inside = d <= targetRadius;
        const tx = inside ? wx : acx + (wx - acx) / d * targetRadius;
        const ty = inside ? wy : acy + (wy - acy) / d * targetRadius;
        this.ctx.save();
        this.ctx.fillStyle   = 'rgba(255, 100, 50, 0.08)';
        this.ctx.strokeStyle = inside ? 'rgba(255, 100, 50, 0.65)' : 'rgba(255, 100, 50, 0.3)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath(); this.ctx.arc(tx, ty, blastRadius, 0, Math.PI * 2); this.ctx.fill(); this.ctx.stroke();
        const ch = 5 / this.zoom;
        this.ctx.strokeStyle = inside ? 'rgba(255, 100, 50, 0.95)' : 'rgba(255, 100, 50, 0.4)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath(); this.ctx.moveTo(tx - ch, ty); this.ctx.lineTo(tx + ch, ty); this.ctx.moveTo(tx, ty - ch); this.ctx.lineTo(tx, ty + ch); this.ctx.stroke();
        this.ctx.restore();
    }

    drawChaingunRound(from, to, progress = 1) {
        const t  = Math.min(1, progress);
        const x  = from.x + (to.x - from.x) * t;
        const y  = from.y + (to.y - from.y) * t;
        const t2 = Math.max(0, t - 0.15);
        const tx = from.x + (to.x - from.x) * t2;
        const ty = from.y + (to.y - from.y) * t2;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255,136,0,0.55)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath(); this.ctx.moveTo(tx, ty); this.ctx.lineTo(x, y); this.ctx.stroke();
        this.ctx.fillStyle = '#ffaa33';
        this.ctx.beginPath(); this.ctx.arc(x, y, 2.5 / this.zoom, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.restore();
    }

    drawPlasmaRound(from, to, progress = 1) {
        const t  = Math.min(1, progress);
        const x  = from.x + (to.x - from.x) * t;
        const y  = from.y + (to.y - from.y) * t;
        const t2 = Math.max(0, t - 0.22);
        const tx = from.x + (to.x - from.x) * t2;
        const ty = from.y + (to.y - from.y) * t2;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(100,255,160,0.40)';
        this.ctx.lineWidth = 2.5 / this.zoom;
        this.ctx.beginPath(); this.ctx.moveTo(tx, ty); this.ctx.lineTo(x, y); this.ctx.stroke();
        this.ctx.shadowColor = '#88ffaa';
        this.ctx.shadowBlur  = 14;
        this.ctx.fillStyle   = '#ccffdd';
        this.ctx.beginPath(); this.ctx.arc(x, y, 4 / this.zoom, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.shadowBlur = 0;
        this.ctx.restore();
    }

    drawRocketBlast(x, y, progress = 0) {
        const peakAt = 0.3;
        const sizeFactor = progress < peakAt ? progress / peakAt : 1 - (progress - peakAt) / (1 - peakAt);
        const maxSize = CONSTANTS.ROCKET_BLAST_RADIUS;
        const size = Math.max(0.1, maxSize * sizeFactor);
        const alpha = Math.max(0, 1 - progress);
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = '#ff4400';
        this.ctx.beginPath(); this.ctx.arc(x, y, size, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.beginPath(); this.ctx.arc(x, y, size * 0.55, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.strokeStyle = '#ff6600';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.beginPath(); this.ctx.arc(x, y, size * 1.4, 0, Math.PI * 2); this.ctx.stroke();
        this.ctx.restore();
    }

    drawLaser(from, to, progress = 1, colorScheme = null) {
        const TRAIL = 0.18;
        const tipT  = Math.min(1, progress);
        const tailT = Math.max(0, progress - TRAIL);
        const tipX  = from.x + (to.x - from.x) * tipT;
        const tipY  = from.y + (to.y - from.y) * tipT;
        const tailX = from.x + (to.x - from.x) * tailT;
        const tailY = from.y + (to.y - from.y) * tailT;

        const core  = colorScheme === 'repulsor' ? '#cc88ff' : colorScheme === 'ravager' ? '#ff4400' : colorScheme === 'attractor' ? '#00ddcc' : colorScheme === 'ion' ? '#44ddff' : '#ff2222';
        const glow  = colorScheme === 'repulsor' ? 'rgba(180,100,255,0.35)' : colorScheme === 'ravager' ? 'rgba(255,100,0,0.4)' : colorScheme === 'attractor' ? 'rgba(0,200,180,0.4)' : colorScheme === 'ion' ? 'rgba(60,200,255,0.4)' : 'rgba(255,80,80,0.35)';

        this.ctx.strokeStyle = core;
        this.ctx.lineWidth = (CONSTANTS.LASER_SIZE * 0.7) / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(tailX, tailY);
        this.ctx.lineTo(tipX, tipY);
        this.ctx.stroke();

        this.ctx.strokeStyle = glow;
        this.ctx.lineWidth = (CONSTANTS.LASER_SIZE * 2) / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(tailX, tailY);
        this.ctx.lineTo(tipX, tipY);
        this.ctx.stroke();
    }

    drawExplosion(x, y, progress = 0) {
        // Grow to peak at 35% progress, then shrink; opacity fades 1→0 throughout
        const peakAt = 0.35;
        const sizeFactor = progress < peakAt
            ? progress / peakAt
            : 1 - (progress - peakAt) / (1 - peakAt);
        const maxSize = 20;
        const size = Math.max(0.1, maxSize * sizeFactor);
        const alpha = Math.max(0, 1 - progress);

        this.ctx.save();
        this.ctx.globalAlpha = alpha;

        this.ctx.fillStyle = '#ff6600';
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 1.7, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.restore();
    }

    drawStats(text, x, y, color = '#00ffff') {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = color;
        this.ctx.font = '12px Courier New';
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
    }

    drawFloatingText(text, color, worldX, worldY, elapsed, totalDuration) {
        const progress = elapsed / totalDuration;
        const alpha = Math.max(0, 1 - progress);
        const floatY = worldY - 28 * progress;
        const screen = this.worldToScreen(worldX, floatY);
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 13px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'rgba(0,0,0,0.9)';
        this.ctx.shadowBlur = 3;
        this.ctx.fillText(text, screen.x, screen.y);
        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 0;
        this.ctx.textAlign = 'left';
        this.ctx.restore();
    }

    drawAsteroid(asteroid, isDimmed = false, isHovered = false) {
        const verts = asteroid.vertices;
        if (!verts || verts.length < 3) return;
        this.ctx.save();
        if (isDimmed) this.ctx.globalAlpha = 0.3;
        this.ctx.translate(asteroid.x, asteroid.y);
        this.ctx.rotate(asteroid.rotation);

        if (isHovered) {
            this.ctx.strokeStyle = 'rgba(255, 210, 80, 0.7)';
            this.ctx.lineWidth = 1.5 / this.zoom;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, asteroid.radius * 1.25, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.beginPath();
        this.ctx.moveTo(verts[0][0], verts[0][1]);
        for (let i = 1; i < verts.length; i++) {
            this.ctx.lineTo(verts[i][0], verts[i][1]);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = isHovered ? '#554433' : '#443322';
        this.ctx.fill();
        this.ctx.strokeStyle = isHovered ? '#bbaa77' : '#887755';
        this.ctx.lineWidth = 1.2 / this.zoom;
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawCloud(cloud) {
        // Colour palette per cloud type
        let stops;
        if (cloud.type === 'ice') {
            stops = [
                [0,    'rgba(200, 240, 255, 0.38)'],
                [0.55, 'rgba(160, 220, 255, 0.28)'],
                [0.85, 'rgba(100, 190, 240, 0.14)'],
                [1,    'rgba( 60, 160, 220, 0)'],
            ];
        } else if (cloud.type === 'plasma') {
            stops = [
                [0,    'rgba(255, 160,  60, 0.36)'],
                [0.55, 'rgba(255, 100,  30, 0.24)'],
                [0.85, 'rgba(200,  50,  10, 0.12)'],
                [1,    'rgba(160,  20,   0, 0)'],
            ];
        } else { // dust
            stops = [
                [0,    'rgba(160, 200, 255, 0.32)'],
                [0.55, 'rgba(120, 170, 240, 0.22)'],
                [0.85, 'rgba( 80, 130, 200, 0.10)'],
                [1,    'rgba( 60, 100, 180, 0)'],
            ];
        }

        this.ctx.save();
        this.ctx.translate(cloud.x, cloud.y);
        this.ctx.rotate(cloud.angle);
        this.ctx.scale(cloud.rx, cloud.ry);

        const grad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        stops.forEach(([offset, color]) => grad.addColorStop(offset, color));

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 1, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    drawDamageNumber(x, y, damage, isHealed = false) {
        const screenPos = this.worldToScreen(x, y);
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = isHealed ? '#00ffff' : '#ff6600';
        this.ctx.font = 'bold 14px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(damage, screenPos.x, screenPos.y);
        this.ctx.textAlign = 'left';
        this.ctx.restore();
    }

    drawSwapRange(ship) {
        const range = CONSTANTS.SWAP_RANGE;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(180, 120, 255, 0.6)';
        this.ctx.fillStyle   = 'rgba(180, 120, 255, 0.05)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    drawAbsorbRange(ship) {
        const range = CONSTANTS.ABSORB_RANGE;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 140, 60, 0.7)';
        this.ctx.fillStyle   = 'rgba(255, 140, 60, 0.08)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    drawRavagerRange(ship) {
        const range = ship.radar * CONSTANTS.SHOOT_RANGE_BASE * CONSTANTS.RAVAGER_RANGE_MULT;
        const SIZE  = CONSTANTS.SHIP_SIZE * (ship.sizeMult ?? 1.0);
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];
        const maxSide  = Math.max(...verts.map(v => Math.abs(v[1])));
        const sideOffset = maxSide * SIZE * 1.15;
        const halfBase   = range * 0.65;
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        this.ctx.fillStyle   = 'rgba(255, 70, 0, 0.10)';
        this.ctx.strokeStyle = 'rgba(255, 70, 0, 0.50)';
        this.ctx.lineWidth = 0.5 / this.zoom;
        this.ctx.beginPath(); this.ctx.moveTo(0, -sideOffset); this.ctx.lineTo(-halfBase, -sideOffset - range); this.ctx.lineTo(halfBase, -sideOffset - range); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.moveTo(0,  sideOffset); this.ctx.lineTo(-halfBase,  sideOffset + range); this.ctx.lineTo(halfBase,  sideOffset + range); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        this.ctx.restore();
    }

    drawStasisCastRange(ship) {
        const castRange = CONSTANTS.STASIS_CAST_RANGE;
        const fieldRadius = CONSTANTS.STASIS_RADIUS;
        const cx = ship.x + Math.cos(ship.rotation) * castRange * 0.5;
        const cy = ship.y + Math.sin(ship.rotation) * castRange * 0.5;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(100, 230, 255, 0.5)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, castRange, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    drawStasisCursor(ship, wx, wy) {
        const castRange = CONSTANTS.STASIS_CAST_RANGE;
        const fieldRadius = CONSTANTS.STASIS_RADIUS;
        const d = Math.sqrt((wx - ship.x) ** 2 + (wy - ship.y) ** 2);
        const tx = d > castRange ? ship.x + (wx - ship.x) / d * castRange : wx;
        const ty = d > castRange ? ship.y + (wy - ship.y) / d * castRange : wy;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(100, 230, 255, 0.8)';
        this.ctx.fillStyle   = 'rgba(100, 230, 255, 0.10)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(tx, ty, fieldRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawStasisField(field) {
        const r = field.radius;
        if (r <= 0) return;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(100, 230, 255, 0.65)';
        this.ctx.fillStyle   = 'rgba(100, 230, 255, 0.12)';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(field.x, field.y, r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        // Inner pulse ring
        const innerR = r * 0.5;
        this.ctx.strokeStyle = 'rgba(150, 240, 255, 0.3)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(field.x, field.y, innerR, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawPhaseIndicator(ship) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.45 + 0.15 * Math.sin(Date.now() / 200);
        this.ctx.strokeStyle = '#aaeeff';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
        const r = CONSTANTS.SHIP_SIZE * 2.5 * (ship.sizeMult ?? 1.0);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, r, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    drawNeutralizeRange(ship) {
        const launchDist   = CONSTANTS.WARHEAD_LAUNCH_DIST;
        const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
        const cx = ship.x + Math.cos(ship.rotation) * launchDist;
        const cy = ship.y + Math.sin(ship.rotation) * launchDist;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(200, 255, 100, 0.4)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath(); this.ctx.moveTo(ship.x, ship.y); this.ctx.lineTo(cx, cy); this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = 'rgba(200, 255, 100, 0.7)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([3 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath(); this.ctx.arc(cx, cy, targetRadius, 0, Math.PI * 2); this.ctx.stroke();
        this.ctx.setLineDash([]);
        const ch = 4 / this.zoom;
        this.ctx.strokeStyle = 'rgba(200, 255, 100, 0.8)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath(); this.ctx.moveTo(cx - ch, cy); this.ctx.lineTo(cx + ch, cy); this.ctx.moveTo(cx, cy - ch); this.ctx.lineTo(cx, cy + ch); this.ctx.stroke();
        this.ctx.restore();
    }

    drawNeutralizeCursor(ship, wx, wy) {
        const launchDist   = CONSTANTS.WARHEAD_LAUNCH_DIST;
        const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
        const blastRadius  = CONSTANTS.NEUTRALIZE_BLAST_RADIUS;
        const acx = ship.x + Math.cos(ship.rotation) * launchDist;
        const acy = ship.y + Math.sin(ship.rotation) * launchDist;
        const d = distance(acx, acy, wx, wy);
        const inside = d <= targetRadius;
        const tx = inside ? wx : acx + (wx - acx) / d * targetRadius;
        const ty = inside ? wy : acy + (wy - acy) / d * targetRadius;
        this.ctx.save();
        this.ctx.fillStyle   = 'rgba(200, 255, 100, 0.08)';
        this.ctx.strokeStyle = inside ? 'rgba(200, 255, 100, 0.65)' : 'rgba(200, 255, 100, 0.3)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath(); this.ctx.arc(tx, ty, blastRadius, 0, Math.PI * 2); this.ctx.fill(); this.ctx.stroke();
        this.ctx.restore();
    }

    drawGammaRayRange(ship) {
        const range    = ship.radar * CONSTANTS.SHOOT_RANGE_BASE;
        const halfAngle = CONSTANTS.GAMMA_RAY_HALF_ANGLE;
        const SIZE     = CONSTANTS.SHIP_SIZE * (ship.sizeMult ?? 1.0);
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts    = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];
        const maxFwd   = Math.max(...verts.map(v => Math.abs(v[0])));
        const fwdOff   = maxFwd * SIZE * 1.15;
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        this.ctx.fillStyle   = 'rgba(180, 255, 80, 0.12)';
        this.ctx.strokeStyle = 'rgba(180, 255, 80, 0.6)';
        this.ctx.lineWidth = 0.5 / this.zoom;
        const halfBase = Math.tan(halfAngle) * range;
        this.ctx.beginPath(); this.ctx.moveTo(fwdOff, 0); this.ctx.lineTo(fwdOff + range, -halfBase); this.ctx.lineTo(fwdOff + range, halfBase); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        this.ctx.restore();
    }
}

let renderingSystem = null;

function initRendering() {
    renderingSystem = new RenderingSystem('combatCanvas');
}
