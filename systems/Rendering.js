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
                    const hitRadius = CONSTANTS.SHIP_SIZE * 3;
                    const hovered = [...combat.playerShips, ...combat.enemyShips].find(
                        s => s.alive && distance(s.x, s.y, world.x, world.y) <= hitRadius
                    ) || null;
                    if (hovered !== this._lastHoveredDebugShip) {
                        this._lastHoveredDebugShip = hovered;
                        if (hovered) {
                            const dist       = distance(active.x, active.y, hovered.x, hovered.y);
                            const shootRange = active.radar * CONSTANTS.SHOOT_RANGE_BASE;
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

    // isActiveTurn = green ring, isSelected = cyan dashed ring, isHovered = highlight, isDimmed = faded, isWreck = destroyed, isCloaked = stealth, escapeAlpha = fade-out 0→1
    drawShip(ship, isActiveTurn = false, isSelected = false, isHovered = false, isDimmed = false, isWreck = false, isCloaked = false, escapeAlpha = 1) {
        if (isCloaked && !ship.isPlayer) return; // enemy cloaked ships are completely invisible
        this.ctx.save();
        if (escapeAlpha < 1) this.ctx.globalAlpha = escapeAlpha;
        else if (isCloaked) this.ctx.globalAlpha = 0.5; // player cloaked ships: 50% transparent
        else if (isWreck) this.ctx.globalAlpha = 0.55;
        else if (isDimmed) this.ctx.globalAlpha = 0.25;
        const SIZE = CONSTANTS.SHIP_SIZE;

        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];

        // Ring radius just outside the ship's furthest vertex
        const maxDist = Math.max(...verts.map(v => Math.sqrt(v[0] * v[0] + v[1] * v[1])));
        const RING_R = maxDist * SIZE * 1.3;

        // --- Rotated block: body + shield outline ---
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);

        // Ship body: hull-flash (4-pulse) > hover > default
        const now = Date.now();
        const hullFlashAge = now - (ship._hullFlashStart || 0);
        const hullFlash   = hullFlashAge < 1000 && Math.floor(hullFlashAge / 125) % 2 === 0;
        const shieldFlash = now < (ship._shieldFlashUntil || 0);

        // Try sprite first; fall back to vector polygon if no sprite loaded
        const spriteId  = ship.shipType.toLowerCase().replace(/ /g, '_');
        const spriteImg = spriteSystem.getImage(spriteId);

        if (spriteImg) {
            // Scale sprite so its longest axis matches the ship's vertex bounding diameter
            const worldDiam  = maxDist * SIZE * 2;
            const spriteScale = worldDiam / Math.max(spriteImg.naturalWidth, spriteImg.naturalHeight);

            // Tint: hull-flash overrides everything, otherwise team/role color
            let tint, tintAlpha;
            if (hullFlash) {
                tint = '#880000'; tintAlpha = 0.75;
            } else if (isWreck) {
                tint = ship.isPlayer ? '#222233' : '#550000'; tintAlpha = 0.80;
            } else if (isHovered) {
                tint = '#ffffff'; tintAlpha = 0.30;
            } else if (ship.isDrone) {
                tint = ship.isPlayer ? '#ffaa33' : '#ff7700'; tintAlpha = 0.50;
            } else {
                tint = ship.isPlayer ? '#3399ff' : '#ff3333'; tintAlpha = 0.35;
            }

            // Draw at origin — ctx is already translated+rotated to ship space; alpha=1 inherits outer
            spriteSystem.draw(this.ctx, spriteId, 0, 0, 0, spriteScale, { tint, tintAlpha });
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
                fillColor = ship.isDrone ? (ship.isPlayer ? '#ffaa33' : '#ff7700') : (ship.isPlayer ? '#aaaaaa' : '#ff3333');
            }
            this.ctx.fillStyle = fillColor;
            drawShipShape(this.ctx, verts, SIZE);
            this.ctx.fill();
        }

        // Shield outline — skip for wreckage, works for both sprite and vector modes
        if (!isWreck && (ship.shields > 0 || shieldFlash)) {
            const alpha = shieldFlash ? 1 : 0.8;
            this.ctx.strokeStyle = shieldFlash ? `rgba(255,0,0,${alpha})` : `rgba(0,200,255,${alpha})`;
            this.ctx.lineWidth = 1 / this.zoom;
            drawShipShape(this.ctx, verts, SIZE * 1.5);
            this.ctx.stroke();
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

            this.ctx.restore();
        }

        this.ctx.restore(); // outer save
    }

    // Small hull + shield bars drawn in world space just above the ship
    drawShipBars(ship) {
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];
        // Top of shield outline for this ship type (max vertical vertex × shield scale)
        const maxSide = Math.max(...verts.map(v => Math.abs(v[1]))) * CONSTANTS.SHIP_SIZE * 1.5;
        const yBase = -(maxSide + 3); // 3 units above shield top

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

        this.ctx.restore();
    }

    // Dashed oval shifted forward — shows where the ship can move this turn
    drawMovementRange(ship) {
        const offset = ship.engine * CONSTANTS.COMBAT_MOVE_OVAL_OFFSET;
        const major  = ship.engine * CONSTANTS.COMBAT_MOVE_OVAL_MAJOR;
        const minor  = ship.engine * CONSTANTS.COMBAT_MOVE_OVAL_MINOR;
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        this.ctx.strokeStyle = 'rgba(120, 255, 120, 0.55)';
        this.ctx.fillStyle   = 'rgba(120, 255, 120, 0.05)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.ellipse(offset, 0, major, minor, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    // Small green dot at cursor, clamped to movement oval
    drawMoveCursor(ship, wx, wy) {
        const clamped = clampToMovementOval(ship, wx, wy);
        const inside = isWithinMovementOval(ship, wx, wy);
        this.ctx.save();
        this.ctx.fillStyle = inside ? 'rgba(120,255,120,0.95)' : 'rgba(120,255,120,0.6)';
        this.ctx.beginPath();
        this.ctx.arc(clamped.x, clamped.y, 4 / this.zoom, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    // Port & starboard firing triangles — each extends perpendicular from the ship's side.
    drawShootRange(ship) {
        const range = ship.radar * CONSTANTS.SHOOT_RANGE_BASE;
        const SIZE  = CONSTANTS.SHIP_SIZE;
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];

        const maxSide    = Math.max(...verts.map(v => Math.abs(v[1])));
        const sideOffset = maxSide * SIZE * 1.15;
        const halfBase   = range * 0.65;

        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        this.ctx.fillStyle   = 'rgba(120, 255, 120, 0.10)';
        this.ctx.strokeStyle = 'rgba(120, 255, 120, 0.45)';
        this.ctx.lineWidth = 0.5 / this.zoom;

        // Port (−Y side)
        this.ctx.beginPath();
        this.ctx.moveTo(0, -sideOffset);
        this.ctx.lineTo(-halfBase, -sideOffset - range);
        this.ctx.lineTo( halfBase, -sideOffset - range);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Starboard (+Y side)
        this.ctx.beginPath();
        this.ctx.moveTo(0,  sideOffset);
        this.ctx.lineTo(-halfBase,  sideOffset + range);
        this.ctx.lineTo( halfBase,  sideOffset + range);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.restore();
    }

    // Dashed circle showing blink teleport range
    drawBlinkRange(ship) {
        const range = CONSTANTS.BLINK_RANGE;
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

    // Small dot at cursor position; purple inside range, dimmed outside
    drawBlinkCursor(ship, wx, wy) {
        const range = CONSTANTS.BLINK_RANGE;
        const dist  = distance(ship.x, ship.y, wx, wy);
        const inside = dist <= range;
        this.ctx.save();
        this.ctx.fillStyle = inside ? 'rgba(180,120,255,0.95)' : 'rgba(180,120,255,0.3)';
        const tx = inside ? wx : ship.x + (wx - ship.x) / dist * range;
        const ty = inside ? wy : ship.y + (wy - ship.y) / dist * range;
        this.ctx.beginPath();
        this.ctx.arc(tx, ty, 4 / this.zoom, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    // 90° steering cone showing afterburner range
    drawAfterburnerRange(ship) {
        const range     = ship.engine * (CONSTANTS.COMBAT_MOVE_OVAL_OFFSET + CONSTANTS.COMBAT_MOVE_OVAL_MAJOR) * CONSTANTS.AFTERBURNER_RANGE_MULT;
        const halfAngle = CONSTANTS.AFTERBURNER_CONE_HALF_ANGLE;

        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        // +x is now forward; cone spans -halfAngle to +halfAngle

        // Filled cone sector
        const grad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, range);
        grad.addColorStop(0, 'rgba(255,140,0,0.13)');
        grad.addColorStop(1, 'rgba(255,140,0,0.03)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.arc(0, 0, range, -halfAngle, halfAngle);
        this.ctx.closePath();
        this.ctx.fill();

        // Cone edge lines (dashed)
        this.ctx.strokeStyle = 'rgba(255,160,40,0.5)';
        this.ctx.lineWidth = 0.8 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0); this.ctx.lineTo(range * Math.cos(-halfAngle), range * Math.sin(-halfAngle));
        this.ctx.moveTo(0, 0); this.ctx.lineTo(range * Math.cos( halfAngle), range * Math.sin( halfAngle));
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Arc at max range
        this.ctx.strokeStyle = 'rgba(255,160,40,0.45)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, range, -halfAngle, halfAngle);
        this.ctx.stroke();

        // Forward center reference line (dashed, dim)
        this.ctx.strokeStyle = 'rgba(255,160,40,0.25)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0); this.ctx.lineTo(range, 0);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.restore();
    }

    // Mouse-tracked aim line + endpoint marker, clamped to the steering cone
    drawAfterburnerCursor(ship, wx, wy) {
        const range     = ship.engine * (CONSTANTS.COMBAT_MOVE_OVAL_OFFSET + CONSTANTS.COMBAT_MOVE_OVAL_MAJOR) * CONSTANTS.AFTERBURNER_RANGE_MULT;
        const halfAngle = CONSTANTS.AFTERBURNER_CONE_HALF_ANGLE;

        const mouseAng = Math.atan2(wy - ship.y, wx - ship.x);
        const relAng   = Math.max(-halfAngle, Math.min(halfAngle, normalizeAngle(mouseAng - ship.rotation)));
        const aimAng   = ship.rotation + relAng;

        const cx = ship.x + Math.cos(aimAng) * range;
        const cy = ship.y + Math.sin(aimAng) * range;

        // Aim line from ship to endpoint
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255,180,60,0.75)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(ship.x, ship.y);
        this.ctx.lineTo(cx, cy);
        this.ctx.stroke();

        // Endpoint tick (perpendicular bar) + forward-pointing chevron
        const hw = CONSTANTS.AFTERBURNER_HALF_WIDTH * 1.5;
        const px = -Math.sin(aimAng), py = Math.cos(aimAng); // perpendicular
        const fx =  Math.cos(aimAng), fy = Math.sin(aimAng); // forward
        this.ctx.strokeStyle = 'rgba(255,200,60,0.95)';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.beginPath();
        // Perpendicular tick
        this.ctx.moveTo(cx - px * hw,       cy - py * hw);
        this.ctx.lineTo(cx + px * hw,       cy + py * hw);
        // Chevron pointing backward (V opening toward ship)
        this.ctx.moveTo(cx - px * hw * 0.5 - fx * hw * 0.6, cy - py * hw * 0.5 - fy * hw * 0.6);
        this.ctx.lineTo(cx,                                   cy);
        this.ctx.lineTo(cx + px * hw * 0.5 - fx * hw * 0.6, cy + py * hw * 0.5 - fy * hw * 0.6);
        this.ctx.stroke();
        this.ctx.restore();
    }

    // Orange gradient trail from startX/Y to the ship's current position; fades as progress→1
    drawAfterburnerTrail(startX, startY, curX, curY, endX, endY, progress) {
        const halfWidth = CONSTANTS.AFTERBURNER_HALF_WIDTH;
        const ang = Math.atan2(endY - startY, endX - startX);
        const len = distance(startX, startY, curX, curY);
        if (len < 1) return;

        const alpha = Math.max(0, 1 - progress);
        this.ctx.save();
        this.ctx.translate(startX, startY);
        this.ctx.rotate(ang);
        const grad = this.ctx.createLinearGradient(0, 0, len, 0);
        grad.addColorStop(0,   `rgba(255, 120, 0, ${(alpha * 0.75).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(255, 200, 50, ${(alpha * 0.55).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(255, 230, 100, 0)`);
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, -halfWidth, len, halfWidth * 2);
        this.ctx.restore();
    }

    drawDroneBlastRange(ship) {
        const radius = CONSTANTS.DRONE_BLAST_RADIUS;
        this.ctx.save();
        this.ctx.fillStyle   = 'rgba(255, 100, 0, 0.08)';
        this.ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
        this.ctx.lineWidth   = 1.5 / this.zoom;
        this.ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    drawRepairBeamRange(ship) {
        const range = ship.radar * CONSTANTS.SHOOT_RANGE_BASE * 1.5;
        this.ctx.save();
        this.ctx.fillStyle   = 'rgba(0, 255, 100, 0.05)';
        this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.6)';
        this.ctx.lineWidth   = 1.5 / this.zoom;
        this.ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    // Forward-cone tractor beam range indicator
    drawEmpRange(ship) {
        const radius = CONSTANTS.WARHEAD_BLAST_RADIUS;
        this.ctx.save();
        this.ctx.fillStyle   = 'rgba(255, 238, 0, 0.07)';
        this.ctx.strokeStyle = 'rgba(255, 238, 0, 0.7)';
        this.ctx.lineWidth   = 1.5 / this.zoom;
        this.ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    drawTractorBeamRange(ship) {
        const range     = ship.engine * (CONSTANTS.COMBAT_MOVE_OVAL_OFFSET + CONSTANTS.COMBAT_MOVE_OVAL_MAJOR) * CONSTANTS.AFTERBURNER_RANGE_MULT;
        const halfAngle = CONSTANTS.TRACTOR_BEAM_HALF_ANGLE;

        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);

        // Filled wedge
        this.ctx.fillStyle = 'rgba(0, 220, 255, 0.06)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.arc(0, 0, range, -halfAngle, halfAngle);
        this.ctx.closePath();
        this.ctx.fill();

        // Dashed border
        this.ctx.strokeStyle = 'rgba(0, 220, 255, 0.55)';
        this.ctx.lineWidth   = 1 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(range * Math.cos(-halfAngle), range * Math.sin(-halfAngle));
        this.ctx.arc(0, 0, range, -halfAngle, halfAngle);
        this.ctx.lineTo(0, 0);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.restore();
    }

    // Cyan beam from puller to target, fading as progress → 1
    drawTractorBeam(from, to, progress) {
        const alpha = Math.max(0, 1 - progress);
        this.ctx.save();
        this.ctx.globalAlpha = alpha;

        // Core beam
        this.ctx.strokeStyle = '#00eeff';
        this.ctx.lineWidth   = (1.5) / this.zoom;
        this.ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Glow
        this.ctx.globalAlpha = alpha * 0.3;
        this.ctx.strokeStyle = '#00eeff';
        this.ctx.lineWidth   = 8 / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();

        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }

    // Warhead targeting: aim circle centered ahead + optional blast-radius preview at cursor
    drawWarheadRange(ship) {
        const launchDist   = CONSTANTS.WARHEAD_LAUNCH_DIST;
        const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
        const blastRadius  = CONSTANTS.WARHEAD_BLAST_RADIUS;
        const cx = ship.x + Math.cos(ship.rotation) * launchDist;
        const cy = ship.y + Math.sin(ship.rotation) * launchDist;

        this.ctx.save();

        // Line from ship to targeting circle center
        this.ctx.strokeStyle = 'rgba(220, 60, 60, 0.4)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(ship.x, ship.y);
        this.ctx.lineTo(cx, cy);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Aim circle (where you can position the detonation)
        this.ctx.strokeStyle = 'rgba(220, 60, 60, 0.7)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([3 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, targetRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Max-reach blast overlay (blast around furthest edge of aim circle — shows worst-case area)
        this.ctx.strokeStyle = 'rgba(220, 60, 60, 0.12)';
        this.ctx.lineWidth = 0.5 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, targetRadius + blastRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Small crosshair at aim-circle center
        const ch = 4 / this.zoom;
        this.ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(cx - ch, cy); this.ctx.lineTo(cx + ch, cy);
        this.ctx.moveTo(cx, cy - ch); this.ctx.lineTo(cx, cy + ch);
        this.ctx.stroke();

        this.ctx.restore();
    }

    drawWarheadCursor(ship, wx, wy) {
        const launchDist   = CONSTANTS.WARHEAD_LAUNCH_DIST;
        const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
        const blastRadius  = CONSTANTS.WARHEAD_BLAST_RADIUS;
        const acx = ship.x + Math.cos(ship.rotation) * launchDist;
        const acy = ship.y + Math.sin(ship.rotation) * launchDist;

        // Clamp cursor to aim circle
        const d = distance(acx, acy, wx, wy);
        const inside = d <= targetRadius;
        const tx = inside ? wx : acx + (wx - acx) / d * targetRadius;
        const ty = inside ? wy : acy + (wy - acy) / d * targetRadius;

        this.ctx.save();

        // Blast radius preview (filled + border)
        this.ctx.fillStyle   = 'rgba(220, 60, 60, 0.08)';
        this.ctx.strokeStyle = inside ? 'rgba(255, 80, 80, 0.65)' : 'rgba(220, 60, 60, 0.3)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(tx, ty, blastRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Crosshair at detonation point
        const ch = 5 / this.zoom;
        this.ctx.strokeStyle = inside ? 'rgba(255, 100, 100, 0.95)' : 'rgba(200, 60, 60, 0.4)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(tx - ch, ty); this.ctx.lineTo(tx + ch, ty);
        this.ctx.moveTo(tx, ty - ch); this.ctx.lineTo(tx, ty + ch);
        this.ctx.stroke();

        this.ctx.restore();
    }

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

    drawLaser(from, to, progress = 1) {
        const TRAIL = 0.18;
        const tipT  = Math.min(1, progress);
        const tailT = Math.max(0, progress - TRAIL);
        const tipX  = from.x + (to.x - from.x) * tipT;
        const tipY  = from.y + (to.y - from.y) * tipT;
        const tailX = from.x + (to.x - from.x) * tailT;
        const tailY = from.y + (to.y - from.y) * tailT;

        this.ctx.strokeStyle = '#ff2222';
        this.ctx.lineWidth = (CONSTANTS.LASER_SIZE * 0.7) / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(tailX, tailY);
        this.ctx.lineTo(tipX, tipY);
        this.ctx.stroke();

        this.ctx.strokeStyle = 'rgba(255,80,80,0.35)';
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
                [0,    'rgba(200, 240, 255, 0.28)'],
                [0.45, 'rgba(160, 220, 255, 0.18)'],
                [0.8,  'rgba(100, 190, 240, 0.07)'],
                [1,    'rgba( 60, 160, 220, 0)'],
            ];
        } else if (cloud.type === 'plasma') {
            stops = [
                [0,    'rgba(255, 160,  60, 0.26)'],
                [0.45, 'rgba(255, 100,  30, 0.16)'],
                [0.8,  'rgba(200,  50,  10, 0.07)'],
                [1,    'rgba(160,  20,   0, 0)'],
            ];
        } else { // dust
            stops = [
                [0,    'rgba(160, 200, 255, 0.22)'],
                [0.45, 'rgba(120, 170, 240, 0.16)'],
                [0.8,  'rgba( 80, 130, 200, 0.06)'],
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
}

let renderingSystem = null;

function initRendering() {
    renderingSystem = new RenderingSystem('combatCanvas');
}
