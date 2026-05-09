// Rendering range/cursor indicators — extends RenderingSystem.prototype
// Loaded after Rendering.js

RenderingSystem.prototype.drawMovementRange = function(ship) {
        const eng    = getEffectiveEngine(ship);
        const offset = eng * CONSTANTS.COMBAT_MOVE_OVAL_OFFSET;
        const major  = eng * CONSTANTS.COMBAT_MOVE_OVAL_MAJOR;
        const minor  = eng * CONSTANTS.COMBAT_MOVE_OVAL_MINOR;
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
};

    // Small green dot at cursor, clamped to movement oval
RenderingSystem.prototype.drawMoveCursor = function(ship, wx, wy) {
        const clamped = clampToMovementOval(ship, wx, wy);
        const inside = isWithinMovementOval(ship, wx, wy);
        this.ctx.save();
        this.ctx.fillStyle = inside ? 'rgba(120,255,120,0.95)' : 'rgba(120,255,120,0.6)';
        this.ctx.beginPath();
        this.ctx.arc(clamped.x, clamped.y, 4 / this.zoom, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
};

    // Firing zone indicator — forward cone for human ships, port/starboard triangles for alien ships.
RenderingSystem.prototype.drawShootRange = function(ship) {
        const range = ship.radar * CONSTANTS.SHOOT_RANGE_BASE;
        const SIZE  = CONSTANTS.SHIP_SIZE * (ship.sizeMult ?? 1.0);
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === ship.shipType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];
        const halfBase = range * 0.65;

        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        this.ctx.fillStyle   = 'rgba(120, 255, 120, 0.10)';
        this.ctx.strokeStyle = 'rgba(120, 255, 120, 0.45)';
        this.ctx.lineWidth = 0.5 / this.zoom;

        if (ship.shipType && ship.shipType.startsWith('Alien')) {
            // Alien: port & starboard side triangles
            const maxSide    = Math.max(...verts.map(v => Math.abs(v[1])));
            const sideOffset = maxSide * SIZE * 1.15;
            this.ctx.beginPath(); this.ctx.moveTo(0, -sideOffset); this.ctx.lineTo(-halfBase, -sideOffset - range); this.ctx.lineTo(halfBase, -sideOffset - range); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.moveTo(0,  sideOffset); this.ctx.lineTo(-halfBase,  sideOffset + range); this.ctx.lineTo(halfBase,  sideOffset + range); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        } else {
            // Human: single forward cone
            const maxFwd     = Math.max(...verts.map(v => Math.abs(v[0])));
            const fwdOffset  = maxFwd * SIZE * 1.15;
            this.ctx.beginPath(); this.ctx.moveTo(fwdOffset, 0); this.ctx.lineTo(fwdOffset + range, -halfBase); this.ctx.lineTo(fwdOffset + range, halfBase); this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        }

        this.ctx.restore();
};

    // Dashed circle showing blink teleport range
RenderingSystem.prototype.drawBlinkRange = function(ship) {
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
};

    // Small dot at cursor position; purple inside range, dimmed outside
RenderingSystem.prototype.drawBlinkCursor = function(ship, wx, wy) {
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
};

    // Rear cone showing debris field launch direction
RenderingSystem.prototype.drawDebrisFieldRange = function(ship) {
        const halfAngle = CONSTANTS.DEBRIS_FIELD_CONE_HALF_ANGLE;
        const range = ship.engine * (CONSTANTS.COMBAT_MOVE_OVAL_OFFSET + CONSTANTS.COMBAT_MOVE_OVAL_MAJOR) * 1.5;
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation + Math.PI);
        this.ctx.strokeStyle = 'rgba(200, 136, 68, 0.6)';
        this.ctx.fillStyle   = 'rgba(200, 136, 68, 0.07)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.arc(0, 0, range, -halfAngle, halfAngle);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
};

    // Solid circle showing possess (formerly hack) range
RenderingSystem.prototype.drawPossessRange = function(ship) {
        const range = CONSTANTS.POSSESS_RANGE;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 68, 255, 0.7)';
        this.ctx.fillStyle   = 'rgba(255, 68, 255, 0.08)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
};

    // Webbing range circle + cursor (like flash)
RenderingSystem.prototype.drawWebbingRange = function(ship) {
        const range = CONSTANTS.WEBBING_RANGE;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 204, 170, 0.6)';
        this.ctx.fillStyle   = 'rgba(0, 204, 170, 0.06)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
};

RenderingSystem.prototype.drawWebbingCursor = function(ship, wx, wy) {
        const range = CONSTANTS.WEBBING_RANGE;
        const blastRadius = CONSTANTS.WEBBING_BLAST_RADIUS;
        const d = distance(ship.x, ship.y, wx, wy);
        const cx = d > range ? ship.x + (wx - ship.x) / d * range : wx;
        const cy = d > range ? ship.y + (wy - ship.y) / d * range : wy;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 204, 170, 0.8)';
        this.ctx.fillStyle   = 'rgba(0, 204, 170, 0.12)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, blastRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
};

    // Small circle around caster for timeslip targeting
RenderingSystem.prototype.drawTimeslipRange = function(ship) {
        const range = CONSTANTS.TIMESLIP_RANGE;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(136, 170, 255, 0.7)';
        this.ctx.fillStyle   = 'rgba(136, 170, 255, 0.07)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
};

    // Forward cone for frenzy
RenderingSystem.prototype.drawFrenzyRange = function(ship) {
        const halfAngle = CONSTANTS.FRENZY_CONE_HALF_ANGLE;
        const range = CONSTANTS.FRENZY_RANGE;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 34, 68, 0.7)';
        this.ctx.fillStyle   = 'rgba(255, 34, 68, 0.07)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(ship.x, ship.y);
        this.ctx.arc(ship.x, ship.y, range, ship.rotation - halfAngle, ship.rotation + halfAngle);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
};

    // Forward cone showing mark targeting arc
RenderingSystem.prototype.drawMarkRange = function(ship) {
        const halfAngle = CONSTANTS.MARK_CONE_HALF_ANGLE;
        const range = CONSTANTS.MARK_RANGE;
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        this.ctx.strokeStyle = 'rgba(255, 136, 0, 0.7)';
        this.ctx.fillStyle   = 'rgba(255, 136, 0, 0.07)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.arc(0, 0, range, -halfAngle, halfAngle);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
};

    // Forward cone showing anchor targeting arc
RenderingSystem.prototype.drawAnchorRange = function(ship) {
        const halfAngle = CONSTANTS.ANCHOR_CONE_HALF_ANGLE;
        const range = CONSTANTS.ANCHOR_RANGE;
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        this.ctx.strokeStyle = 'rgba(100, 160, 255, 0.7)';
        this.ctx.fillStyle   = 'rgba(100, 160, 255, 0.07)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.arc(0, 0, range, -halfAngle, halfAngle);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
};

    // Small dashed circle showing siphon range
RenderingSystem.prototype.drawSiphonRange = function(ship) {
        const range = CONSTANTS.SIPHON_RANGE;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(180, 100, 255, 0.7)';
        this.ctx.fillStyle   = 'rgba(180, 100, 255, 0.08)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
};

    // Dashed circle showing flash targeting range
RenderingSystem.prototype.drawFlashRange = function(ship) {
        const range = CONSTANTS.FLASH_RANGE;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 140, 0.55)';
        this.ctx.fillStyle   = 'rgba(255, 255, 140, 0.04)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(ship.x, ship.y, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
};

    // Blast-radius preview circle at cursor, clamped to flash range
RenderingSystem.prototype.drawFlashCursor = function(ship, wx, wy) {
        const range       = CONSTANTS.FLASH_RANGE;
        const blastRadius = CONSTANTS.FLASH_BLAST_RADIUS;
        const dist        = distance(ship.x, ship.y, wx, wy);
        const inside      = dist <= range;
        const tx = inside ? wx : ship.x + (wx - ship.x) / dist * range;
        const ty = inside ? wy : ship.y + (wy - ship.y) / dist * range;
        this.ctx.save();
        this.ctx.fillStyle   = 'rgba(255, 255, 140, 0.07)';
        this.ctx.strokeStyle = inside ? 'rgba(255, 255, 80, 0.75)' : 'rgba(255, 255, 140, 0.3)';
        this.ctx.lineWidth   = 1.5 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(tx, ty, blastRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        // Crosshair at center
        const ch = 4 / this.zoom;
        this.ctx.strokeStyle = inside ? 'rgba(255, 255, 80, 0.9)' : 'rgba(255, 255, 140, 0.4)';
        this.ctx.lineWidth   = 1 / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(tx - ch, ty); this.ctx.lineTo(tx + ch, ty);
        this.ctx.moveTo(tx, ty - ch); this.ctx.lineTo(tx, ty + ch);
        this.ctx.stroke();
        this.ctx.restore();
};

    // 90° steering cone showing afterburner range
RenderingSystem.prototype.drawAfterburnerRange = function(ship) {
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
};

    // Mouse-tracked aim line + endpoint marker, clamped to the steering cone
RenderingSystem.prototype.drawAfterburnerCursor = function(ship, wx, wy) {
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
};

    // Orange gradient trail from startX/Y to the ship's current position; fades as progress→1
RenderingSystem.prototype.drawAfterburnerTrail = function(startX, startY, curX, curY, endX, endY, progress) {
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
};

RenderingSystem.prototype.drawRepairBeamRange = function(ship) {
        const range     = ship.radar * CONSTANTS.SHOOT_RANGE_BASE * 1.5;
        const halfAngle = CONSTANTS.REPAIR_BEAM_CONE_HALF_ANGLE;

        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);

        this.ctx.fillStyle = 'rgba(0, 255, 100, 0.10)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.arc(0, 0, range, -halfAngle, halfAngle);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.55)';
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
};

RenderingSystem.prototype.drawSuperchargeRange = function(ship) {
        const range     = ship.radar * CONSTANTS.SHOOT_RANGE_BASE * 0.75;
        const halfAngle = CONSTANTS.SUPERCHARGE_CONE_HALF_ANGLE;

        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);

        this.ctx.fillStyle = 'rgba(255, 220, 0, 0.07)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.arc(0, 0, range, -halfAngle, halfAngle);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.strokeStyle = 'rgba(255, 220, 0, 0.55)';
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
};

RenderingSystem.prototype.drawEmpRange = function(ship) {
        const launchDist   = CONSTANTS.WARHEAD_LAUNCH_DIST;
        const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
        const blastRadius  = CONSTANTS.WARHEAD_BLAST_RADIUS;
        const cx = ship.x + Math.cos(ship.rotation) * launchDist;
        const cy = ship.y + Math.sin(ship.rotation) * launchDist;

        this.ctx.save();

        this.ctx.strokeStyle = 'rgba(100, 220, 255, 0.4)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(ship.x, ship.y);
        this.ctx.lineTo(cx, cy);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.strokeStyle = 'rgba(100, 220, 255, 0.7)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([3 / this.zoom, 3 / this.zoom]);
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, targetRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.strokeStyle = 'rgba(100, 220, 255, 0.12)';
        this.ctx.lineWidth = 0.5 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, targetRadius + blastRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        const ch = 4 / this.zoom;
        this.ctx.strokeStyle = 'rgba(100, 220, 255, 0.8)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(cx - ch, cy); this.ctx.lineTo(cx + ch, cy);
        this.ctx.moveTo(cx, cy - ch); this.ctx.lineTo(cx, cy + ch);
        this.ctx.stroke();

        this.ctx.restore();
};

RenderingSystem.prototype.drawEmpCursor = function(ship, wx, wy) {
        const launchDist   = CONSTANTS.WARHEAD_LAUNCH_DIST;
        const targetRadius = CONSTANTS.WARHEAD_TARGET_RADIUS;
        const blastRadius  = CONSTANTS.WARHEAD_BLAST_RADIUS;
        const acx = ship.x + Math.cos(ship.rotation) * launchDist;
        const acy = ship.y + Math.sin(ship.rotation) * launchDist;

        const d = distance(acx, acy, wx, wy);
        const inside = d <= targetRadius;
        const tx = inside ? wx : acx + (wx - acx) / d * targetRadius;
        const ty = inside ? wy : acy + (wy - acy) / d * targetRadius;

        this.ctx.save();

        this.ctx.fillStyle   = 'rgba(100, 220, 255, 0.08)';
        this.ctx.strokeStyle = inside ? 'rgba(100, 220, 255, 0.65)' : 'rgba(100, 220, 255, 0.3)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(tx, ty, blastRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        const ch = 5 / this.zoom;
        this.ctx.strokeStyle = inside ? 'rgba(100, 220, 255, 0.95)' : 'rgba(100, 220, 255, 0.4)';
        this.ctx.lineWidth = 1.5 / this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(tx - ch, ty); this.ctx.lineTo(tx + ch, ty);
        this.ctx.moveTo(tx, ty - ch); this.ctx.lineTo(tx, ty + ch);
        this.ctx.stroke();

        this.ctx.restore();
};

RenderingSystem.prototype.drawTractorBeamRange = function(ship) {
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
};

    // Cyan beam from puller to target, fading as progress → 1
RenderingSystem.prototype.drawTractorBeam = function(from, to, progress) {
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
};

RenderingSystem.prototype.drawBombRange = function(ship) {
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
};

RenderingSystem.prototype.drawBombCursor = function(ship, wx, wy) {
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
};

