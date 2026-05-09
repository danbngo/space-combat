// Galaxy Rendering System
class GalaxyRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size to match wrapper
        this.resizeCanvas();
        
        this.mouseX = 0;
        this.mouseY = 0;
        this.hoveredSystem = null;
        this.selectedSystem = null;
        this.hoveredRoute = null;
        this.selectedRoute = null;
        this.hoveredFleet = null;
        this.isDragging = false;
        this.dragged = false;
        this.lastDragX = 0;
        this.lastDragY = 0;
        
        // Tooltip hover timers
        this.tooltipShowTimer = null;
        this.tooltipHideTimer = null;
        this.tooltipVisible = false;
        
        // Scale and translate for camera
        this.scaleX = 1;
        this.scaleY = 1;
        this.translateX = 0;
        this.translateY = 0;
        
        this.zoom = CONSTANTS.GALAXY_DEFAULT_ZOOM;
        this.minZoom = CONSTANTS.GALAXY_MIN_ZOOM;
        this.maxZoom = CONSTANTS.GALAXY_MAX_ZOOM;
        
        this._loopRunning = false;
        this._snapBackTimer = null;

        this._stars = Array.from({ length: 200 }, () => ({
            x: Math.random(), y: Math.random(),
            b: Math.floor(180 + Math.random() * 76)
        }));
        this.visibleUnseenIds = new Set();

        // Don't fit/reset zoom here - will be done after canvas is properly sized
        this.setupEventListeners();
    }
    
    resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientHeight;
        console.log(`[GalaxyCanvas] Resized to ${this.canvas.width}x${this.canvas.height}`);
    }
    
    fitGalaxyToCanvas() {
        const padding = CONSTANTS.GALAXY_CANVAS_PADDING;
        const availableWidth = this.canvas.width - padding * 2;
        const availableHeight = this.canvas.height - padding * 2;
        
        this.scaleX = availableWidth / CONSTANTS.GALAXY_WIDTH;
        this.scaleY = availableHeight / CONSTANTS.GALAXY_HEIGHT;
        
        // Use smaller scale to maintain aspect ratio
        const scale = Math.min(this.scaleX, this.scaleY);
        this.scaleX = scale;
        this.scaleY = scale;
    }
    
    updateZoom() {
        // No forced centering — panning is unrestricted; snap-back handles off-screen ship.
    }
    
    setZoom(newZoom, focusX, focusY, source = 'button') {
        const oldZoom = this.zoom;
        const boundedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        const galaxyX = (focusX - this.translateX) / zoomedScaleX;
        const galaxyY = (focusY - this.translateY) / zoomedScaleY;
        
        this.zoom = boundedZoom;
        const newZoomedScaleX = this.scaleX * this.zoom;
        const newZoomedScaleY = this.scaleY * this.zoom;
        
        this.translateX = focusX - galaxyX * newZoomedScaleX;
        this.translateY = focusY - galaxyY * newZoomedScaleY;
        
        this.updateZoom();
        console.log(`[GalaxyZoom] ${source} applied zoom from ${oldZoom.toFixed(2)} to ${this.zoom.toFixed(2)}; focus canvas (${focusX.toFixed(1)}, ${focusY.toFixed(1)}) galaxy (${galaxyX.toFixed(1)}, ${galaxyY.toFixed(1)}) translate (${this.translateX.toFixed(1)}, ${this.translateY.toFixed(1)})`);
        if (typeof gameState !== 'undefined') {
            this.render(gameState.systems, gameState.currentSystem);
        }
    }
    
    zoomIn(centerX, centerY, source = 'button') {
        const focusX = centerX !== undefined ? centerX : this.canvas.width / 2;
        const focusY = centerY !== undefined ? centerY : this.canvas.height / 2;
        console.log(`[GalaxyZoom] ${source} requested zoom in at canvas point (${focusX.toFixed(1)}, ${focusY.toFixed(1)}) current zoom ${this.zoom.toFixed(2)}`);
        this.setZoom(this.zoom * CONSTANTS.GALAXY_ZOOM_STEP, focusX, focusY, source);
    }

    zoomOut(centerX, centerY, source = 'button') {
        const focusX = centerX !== undefined ? centerX : this.canvas.width / 2;
        const focusY = centerY !== undefined ? centerY : this.canvas.height / 2;
        console.log(`[GalaxyZoom] ${source} requested zoom out at canvas point (${focusX.toFixed(1)}, ${focusY.toFixed(1)}) current zoom ${this.zoom.toFixed(2)}`);
        this.setZoom(this.zoom / CONSTANTS.GALAXY_ZOOM_STEP, focusX, focusY, source);
    }
    
    initializeZoom() {
        this.fitGalaxyToCanvas();
        this.resetZoom();
    }
    
    centerOnSystem(system) {
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        
        this.translateX = this.canvas.width / 2 - system.x * zoomedScaleX;
        this.translateY = this.canvas.height / 2 - system.y * zoomedScaleY;
        
        this.updateZoom();
        console.log(`[GalaxyZoom] centered on system "${system.name}" at zoom ${this.zoom.toFixed(2)}`);
    }
    
    resetZoom() {
        this.zoom = CONSTANTS.GALAXY_DEFAULT_ZOOM;
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;

        if (typeof gameState !== 'undefined' && gameState.currentSystem) {
            this.translateX = this.canvas.width / 2 - gameState.currentSystem.x * zoomedScaleX;
            this.translateY = this.canvas.height / 2 - gameState.currentSystem.y * zoomedScaleY;
        } else {
            this.translateX = (this.canvas.width - CONSTANTS.GALAXY_WIDTH * zoomedScaleX) / 2;
            this.translateY = (this.canvas.height - CONSTANTS.GALAXY_HEIGHT * zoomedScaleY) / 2;
        }

        this.updateZoom();
        console.log(`[GalaxyZoom] reset zoom to ${this.zoom.toFixed(2)} centered on player system`);
        if (typeof gameState !== 'undefined') {
            this.render(gameState.systems, gameState.currentSystem);
        }
    }
    
    pan(deltaX, deltaY) {
        this.translateX -= deltaX;
        this.translateY -= deltaY;
        this.updateZoom();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        this.canvas.addEventListener('wheel', (e) => this.onMouseWheel(e), { passive: false });
    }
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        if (this.isDragging) {
            const dx = this.mouseX - this.lastDragX;
            const dy = this.mouseY - this.lastDragY;
            if (dx !== 0 || dy !== 0) {
                this.dragged = true;
                this.lastDragX = this.mouseX;
                this.lastDragY = this.mouseY;
                this.pan(-dx, -dy);
                if (typeof gameState !== 'undefined') {
                    this.render(gameState.systems, gameState.currentSystem);
                }
            }
            return;
        }

        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        const galaxyX = (this.mouseX - this.translateX) / zoomedScaleX;
        const galaxyY = (this.mouseY - this.translateY) / zoomedScaleY;

        const oldHovered = this.hoveredSystem;
        const oldRoute   = this.hoveredRoute;
        const oldFleet   = this.hoveredFleet;
        this.hoveredSystem = this.getSystemAtPosition(galaxyX, galaxyY);
        this.hoveredFleet  = this.hoveredSystem ? null : this.getFleetAtPosition(galaxyX, galaxyY);
        this.hoveredRoute  = (this.hoveredSystem || this.hoveredFleet) ? null : this.getRouteAtPosition(galaxyX, galaxyY);

        const sysChanged   = this.hoveredSystem?.id !== oldHovered?.id;
        const fleetChanged = this.hoveredFleet?.fleet !== oldFleet?.fleet;
        const routeChanged = this.hoveredRoute?.routeKey !== oldRoute?.routeKey;

        if (sysChanged || fleetChanged || routeChanged) {
            const nowHovering = this.hoveredSystem || this.hoveredFleet || this.hoveredRoute;
            const wasHovering = oldHovered || oldFleet || oldRoute;
            if (nowHovering && !wasHovering) this.scheduleTooltipShow();
            else if (!nowHovering && wasHovering) this.scheduleTooltipHide();
            else if (nowHovering && wasHovering) { this.scheduleTooltipHide(); this.scheduleTooltipShow(); }
            if (typeof gameState !== 'undefined') {
                this.render(gameState.systems, gameState.currentSystem);
            }
        }

    }
    
    // Start a travel animation from fromSystem to toSystem. avgEngine drives transit speed.
    startTravelAnim(fromSystem, toSystem, avgEngine = 10) {
        this._travelAnim = { from: fromSystem, to: toSystem, progress: 0, avgEngine };
    }

    // Animate from current progress to endPct then call onDone.
    // Duration is proportional to galaxy-space distance so visual speed is constant.
    animateTravelSegment(endPct, onDone) {
        if (!this._travelAnim) { onDone(); return; }
        const startPct = this._travelAnim.progress;
        if (startPct >= endPct) { onDone(); return; }
        const routeLen = distance(
            this._travelAnim.from.x, this._travelAnim.from.y,
            this._travelAnim.to.x,   this._travelAnim.to.y
        );
        const speed  = (this._travelAnim.avgEngine || 10) * CONSTANTS.GALAXY_TRAVEL_SPEED_FACTOR;
        const segDur = Math.max(80, ((endPct - startPct) * routeLen) / speed);
        const start = performance.now();
        const tick = (now) => {
            if (!this._travelAnim) return;
            const t = Math.min(1, (now - start) / segDur);
            this._travelAnim.progress = startPct + (endPct - startPct) * t;
            if (typeof gameState !== 'undefined' && gameState.state === GAME_STATE.TRAVEL) {
                if (typeof UISystem !== 'undefined') UISystem.updateTravelProgress(this._travelAnim.progress);
            } else {
                this.render(gameState.systems, this._travelAnim.from);
            }
            if (t < 1) requestAnimationFrame(tick);
            else onDone();
        };
        requestAnimationFrame(tick);
    }

    drawTravelingShip(from, to, progress) {
        const leaderShip = typeof gameState !== 'undefined'
            ? gameState.playerShips.find(s => s.alive)
            : null;
        const typeData = leaderShip
            ? CONSTANTS.SHIP_TYPES.find(t => t.type === leaderShip.shipType)
            : null;
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];

        const zx = this.scaleX * this.zoom;
        const zy = this.scaleY * this.zoom;
        const sx = this.translateX + (from.x + (to.x - from.x) * progress) * zx;
        const sy = this.translateY + (from.y + (to.y - from.y) * progress) * zy;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const S = 8;

        this.ctx.save();
        this.ctx.translate(sx, sy);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = '#00ff88';
        drawShipShape(this.ctx, verts, S);
        this.ctx.fill();
        this.ctx.restore();
    }

    startLoop() {
        if (this._loopRunning) return;
        this._loopRunning = true;
        const tick = () => {
            if (!this._loopRunning || typeof gameState === 'undefined' || gameState.state !== GAME_STATE.GALAXY) {
                this._loopRunning = false;
                return;
            }
            if (gameState.systems && gameState.currentSystem) {
                this.render(gameState.systems, gameState.currentSystem);
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    drawStationaryShip(system) {
        const leaderShip = typeof gameState !== 'undefined'
            ? gameState.playerShips.find(s => s.alive)
            : null;
        const typeData = leaderShip
            ? CONSTANTS.SHIP_TYPES.find(t => t.type === leaderShip.shipType)
            : null;
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];

        const zx = this.scaleX * this.zoom;
        const zy = this.scaleY * this.zoom;
        const cx = this.translateX + system.x * zx;
        const cy = this.translateY + system.y * zy;
        const S = 8 * (typeData?.sizeMult ?? 1.0);
        const orbitR = CONSTANTS.GALAXY_SYSTEM_RADIUS + S + 3;
        // one full revolution every 2 seconds
        const orbitAngle = (Date.now() / 2000) * Math.PI * 2;
        const sx = cx + orbitR * Math.cos(orbitAngle);
        const sy = cy + orbitR * Math.sin(orbitAngle);
        // tangent to the orbit circle — ship always points in direction of travel
        const shipAngle = orbitAngle + Math.PI / 2;

        this.ctx.save();
        this.ctx.translate(sx, sy);
        this.ctx.rotate(shipAngle);

        const spriteId  = leaderShip ? leaderShip.shipType.toLowerCase().replace(/ /g, '_') : null;
        const spriteImg = spriteId && typeof spriteSystem !== 'undefined' ? spriteSystem.getImage(spriteId) : null;
        if (spriteImg) {
            const spriteScale = (S * 2) / Math.max(spriteImg.naturalWidth, spriteImg.naturalHeight);
            spriteSystem.draw(this.ctx, spriteId, 0, 0, Math.PI / 2, spriteScale);
        } else {
            this.ctx.fillStyle = '#cccccc';
            drawShipShape(this.ctx, verts, S);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    onClick(e) {
        if (this._travelAnim) return;
        if (this.dragged) {
            this.dragged = false;
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        const galaxyX = (x - this.translateX) / zoomedScaleX;
        const galaxyY = (y - this.translateY) / zoomedScaleY;
        
        const clickedSystem = this.getSystemAtPosition(galaxyX, galaxyY);
        
        const selectionChanged = (clickedSystem && (!this.selectedSystem || this.selectedSystem.id !== clickedSystem.id)) || 
                                (!clickedSystem && this.selectedSystem);
        
        if (clickedSystem) {
            this.selectedSystem = clickedSystem;
            this.selectedRoute = null;
            if (typeof gameState !== 'undefined') {
                gameState.selectedSystem = clickedSystem;
                gameState.selectedRoute  = null;
            }
            if (typeof gameState !== 'undefined' && clickedSystem) {
                this.centerOnSystem(clickedSystem);
                this.render(gameState.systems, gameState.currentSystem);
            }
        } else {
            const clickedRoute = this.getRouteAtPosition(galaxyX, galaxyY);
            if (clickedRoute) {
                this.selectedRoute = clickedRoute;
                this.selectedSystem = null;
                if (typeof gameState !== 'undefined') {
                    gameState.selectedRoute  = clickedRoute;
                    gameState.selectedSystem = null;
                }
                if (typeof gameState !== 'undefined') this.render(gameState.systems, gameState.currentSystem);
                if (typeof UISystem !== 'undefined') {
                    UISystem.updateSelectedRouteSection(gameState, clickedRoute);
                    UISystem.updateSelectedSystemSection(gameState);
                }
                return;
            }
            this.selectedSystem = null;
            this.selectedRoute  = null;
            if (typeof gameState !== 'undefined') {
                gameState.selectedSystem = null;
                gameState.selectedRoute  = null;
            }
            if (typeof gameState !== 'undefined') this.render(gameState.systems, gameState.currentSystem);
        }

        if (selectionChanged && typeof gameState !== 'undefined' && typeof UISystem !== 'undefined') {
            UISystem.updateSelectedRouteSection(gameState, null);
            UISystem.updateCurrentSystemSection(gameState);
            UISystem.updateSelectedSystemSection(gameState);
        }
    }
    
    onMouseLeave() {
        this.hoveredSystem = null;
        this.hoveredRoute = null;
        this.hoveredFleet = null;
        this.scheduleTooltipHide();
        if (this.isDragging) this._scheduleSnapBack();
        this.isDragging = false;
        this.dragged = false;
        if (typeof gameState !== 'undefined') {
            this.render(gameState.systems, gameState.currentSystem);
        }
    }

    onMouseDown(e) {
        if (e.button !== 0) return;
        if (this._snapBackTimer) { clearTimeout(this._snapBackTimer); this._snapBackTimer = null; }
        const rect = this.canvas.getBoundingClientRect();
        this.lastDragX = e.clientX - rect.left;
        this.lastDragY = e.clientY - rect.top;
        this.isDragging = true;
        this.dragged = false;
    }

    onMouseUp() {
        this.isDragging = false;
        this._scheduleSnapBack();
    }
    
    onMouseWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        const galaxyX = (mouseX - this.translateX) / zoomedScaleX;
        const galaxyY = (mouseY - this.translateY) / zoomedScaleY;

        if (Math.abs(e.deltaY) > 0) {
            if (e.deltaY < 0) {
                this.zoomIn(mouseX, mouseY, 'wheel');
            } else {
                this.zoomOut(mouseX, mouseY, 'wheel');
            }
        } else {
            const panX = e.deltaX;
            const panY = e.deltaY;
            console.log(`[GalaxyZoom] wheel panning canvas delta (${panX.toFixed(1)}, ${panY.toFixed(1)}) at canvas point (${mouseX.toFixed(1)}, ${mouseY.toFixed(1)}) galaxy (${galaxyX.toFixed(1)}, ${galaxyY.toFixed(1)})`);
            this.pan(panX, panY);
            if (typeof gameState !== 'undefined') {
                this.render(gameState.systems, gameState.currentSystem);
            }
        }
    }
    
    getSystemAtPosition(x, y, radius = 15) {
        // This will be set by the renderer
        if (!window.galaxyMapSystems) {
            console.log(`[GalaxyMouse] getSystemAtPosition: no systems available (galaxyMapSystems not set)`);
            return null;
        }
        
        const zoomedScaleX = this.scaleX * this.zoom;
        const hitRadius = CONSTANTS.GALAXY_SYSTEM_HIT_RADIUS / zoomedScaleX;
        
        let closest = null;
        let closestDist = hitRadius;
        
        for (let system of window.galaxyMapSystems) {
            if (!system.seen && !this.visibleUnseenIds.has(system.id)) continue;
            const dist = distance(x, y, system.x, system.y);
            if (dist <= hitRadius) {
                closest = system;
                closestDist = dist;
                break;
            }
        }
        
        if (closest) {
            console.log(`[GalaxyMouse] hit detected: galaxy pos (${x.toFixed(1)}, ${y.toFixed(1)}) hitRadius ${hitRadius.toFixed(1)} match "${closest.name}" dist ${closestDist.toFixed(1)} zoom ${this.zoom.toFixed(2)}`);
        }
        return closest;
    }
    
    getRouteAtPosition(galaxyX, galaxyY) {
        if (!window.galaxyMapSystems || typeof gameState === 'undefined' || !gameState.routes) return null;
        const threshold = 7 / (this.scaleX * this.zoom);
        let closest = null;
        let closestDist = threshold;
        for (const sys of window.galaxyMapSystems) {
            if (!sys.seen || !sys.connections) continue;
            for (const connId of sys.connections) {
                const other = window.galaxyMapSystems.find(s => s.id === connId);
                if (!other || !other.seen) continue;
                const d = distancePointToLineSegment(galaxyX, galaxyY, sys.x, sys.y, other.x, other.y);
                if (d < closestDist) {
                    closestDist = d;
                    closest = { from: sys, to: other, routeKey: getRouteKey(sys.id, connId) };
                }
            }
        }
        return closest;
    }

    updateRouteTooltip(route, currentSystem) {
        const tooltip = document.getElementById('systemTooltip');
        if (!tooltip) return;
        const routeData = (typeof gameState !== 'undefined' && gameState.routes)
            ? gameState.routes.get(route.routeKey) : null;
        const tierLabel = route.to.isQueenPlanet ? 'Queen\'s Lair' : `Tier ${route.to.tier}`;

        let html = `<strong>${route.from.name} → ${route.to.name}</strong>`;
        if (routeData) {
            const strLabel = routeData.fleetStrength <= 3 ? 'Low' : routeData.fleetStrength <= 6 ? 'Medium' : 'High';
            const encLabel = routeData.maxEncounters === 1 ? '1 enc.' : `1–${routeData.maxEncounters} enc.`;
            html += `<br>${tierLabel} · ${strLabel} threat · ${encLabel}`;
            const topFactions = Object.entries(routeData.factionWeights)
                .filter(([, w]) => w > 5).sort(([, a], [, b]) => b - a).slice(0, 2);
            if (topFactions.length) {
                const names = topFactions.map(([id]) => {
                    const fd = CONSTANTS.FACTIONS.find(f => f.id === id);
                    return fd ? fd.name : id;
                });
                html += `<br>${names.join(', ')}`;
            }
            const hazards = [];
            if (routeData.hasAsteroids) hazards.push('Asteroids');
            if (routeData.cloudType) hazards.push(`${routeData.cloudType.charAt(0).toUpperCase() + routeData.cloudType.slice(1)} clouds`);
            html += `<br>Hazards: ${hazards.length ? `<span style="color:#ffcc44;">${hazards.join(', ')}</span>` : '<span style="color:#666;">None</span>'}`;
        } else {
            html += `<br>${tierLabel}`;
        }

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';

        // Position tooltip — flip left/above if near canvas edges
        const tw = tooltip.offsetWidth  || 180;
        const th = tooltip.offsetHeight || 70;
        const cx = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect().left : 0;
        const cy = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect().top  : 0;
        const cw = this.canvas.clientWidth  || this.canvas.width;
        const ch = this.canvas.clientHeight || this.canvas.height;
        const absX = this.mouseX;
        const absY = this.mouseY;
        const gap = 12;
        const left = (absX + gap + tw > cw) ? absX - tw - gap : absX + gap;
        const top  = (absY + gap + th > ch) ? absY - th - gap : absY + gap;
        tooltip.style.left = left + 'px';
        tooltip.style.top  = top  + 'px';
    }

    render(systems, currentSystem) {
        this.clear();
        
        // Store systems in window for getSystemAtPosition
        window.galaxyMapSystems = systems;
        
        // Draw all connections first (all gray)
        this.drawAllConnections(systems);
        
        // Draw connections from current system in white (overlays gray)
        this.drawCurrentSystemConnections(systems, currentSystem);
        
        // Draw line to current hovering or selected system
        if (this.hoveredSystem && this.hoveredSystem.id !== currentSystem.id) {
            const dist = distance(currentSystem.x, currentSystem.y, this.hoveredSystem.x, this.hoveredSystem.y);
            const isConnected = currentSystem.connections && currentSystem.connections.includes(this.hoveredSystem.id);
            if (isConnected) {
                // Highlight the entire path to hovered system
                this.drawPathToSystem(systems, currentSystem, this.hoveredSystem, '#ffffff');
            }
        }
        
        if (this.selectedSystem && this.selectedSystem.id !== currentSystem.id) {
            const isConnected = currentSystem.connections && currentSystem.connections.includes(this.selectedSystem.id);
            if (isConnected) {
                this.drawConnectionLine(currentSystem, this.selectedSystem, '#00ffff', 3);
            }
        }

        // Highlighted hovered route (yellow) and selected route (orange glow)
        if (this.selectedRoute) {
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = '#00ffff';
            this.drawConnectionLine(this.selectedRoute.from, this.selectedRoute.to, '#00ffff', 4);
            this.ctx.shadowBlur = 0;
        }
        if (this.hoveredRoute && this.hoveredRoute.routeKey !== this.selectedRoute?.routeKey) {
            this.drawConnectionLine(this.hoveredRoute.from, this.hoveredRoute.to, '#ffffff', 4);
        }
        
        // Draw all systems
        const travelFromId = this._travelAnim ? this._travelAnim.from.id : null;
        systems.forEach(system => {
            const isReachable = currentSystem.connections && currentSystem.connections.includes(system.id);
            const isHovered = this.hoveredSystem && this.hoveredSystem.id === system.id;
            const isSelected = this.selectedSystem && this.selectedSystem.id === system.id;
            const isCurrent = system.id === currentSystem.id;
            const isTransitOrigin = travelFromId !== null && system.id === travelFromId;

            this.drawSystem(system, isReachable, isHovered, isSelected, isCurrent, isTransitOrigin);
        });

        // Draw enemy fleet icons on routes
        this.drawFleetIcons(systems);

        // Draw player ship — traveling or stationary at current system
        if (this._travelAnim) {
            this.drawTravelingShip(this._travelAnim.from, this._travelAnim.to, this._travelAnim.progress);
        } else if (currentSystem) {
            this.drawStationaryShip(currentSystem);
        }

        // Draw tooltip
        if (this.tooltipVisible) {
            if (this.hoveredSystem) {
                this.updateTooltip(this.hoveredSystem, currentSystem);
            } else if (this.hoveredFleet) {
                this.drawFleetTooltip(this.hoveredFleet);
            } else if (this.hoveredRoute) {
                this.updateRouteTooltip(this.hoveredRoute, currentSystem);
            } else {
                this.hideTooltip();
            }
        } else {
            this.hideTooltip();
        }
    }
    
    clear() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this._stars.forEach(s => {
            this.ctx.fillStyle = `rgb(${s.b},${s.b},${s.b})`;
            this.ctx.fillRect(s.x * this.canvas.width, s.y * this.canvas.height, 1, 1);
        });
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawAllConnections(systems) {
        const drawnPairs = new Set();
        this.visibleUnseenIds = new Set();

        systems.forEach(system => {
            if (!system.connections) return;
            system.connections.forEach(connId => {
                const pairKey = getRouteKey(system.id, connId);
                if (drawnPairs.has(pairKey)) return;
                drawnPairs.add(pairKey);
                const otherSystem = systems.find(s => s.id === connId);
                if (!otherSystem) return;
                if (system.seen && otherSystem.seen) {
                    this.drawConnectionLine(system, otherSystem, '#808080');
                } else if (system.seen || otherSystem.seen) {
                    this.drawConnectionLine(system, otherSystem, '#2a2a3a');
                    if (!system.seen) this.visibleUnseenIds.add(system.id);
                    if (!otherSystem.seen) this.visibleUnseenIds.add(otherSystem.id);
                }
            });
        });
    }
    
    drawCurrentSystemConnections(systems, currentSystem) {
        // Draw connections from current system in light gray
        if (!currentSystem.connections) return;
        
        this.ctx.strokeStyle = '#c0c0c0';
        this.ctx.lineWidth = 2;
        
        currentSystem.connections.forEach(connId => {
            const otherSystem = systems.find(s => s.id === connId);
            if (otherSystem) {
                this.drawConnectionLine(currentSystem, otherSystem, '#c0c0c0');
            }
        });
    }
    
    drawPathToSystem(systems, startSystem, endSystem, color) {
        const path = this.findPath(systems, startSystem, endSystem);
        if (!path || path.length < 2) return;
        
        // Draw connections along the path
        for (let i = 0; i < path.length - 1; i++) {
            this.drawConnectionLine(path[i], path[i + 1], color);
        }
        
        // Highlight systems along the path (except start and end which are already highlighted)
        for (let i = 1; i < path.length - 1; i++) {
            const system = path[i];
            const zoomedScaleX = this.scaleX * this.zoom;
            const zoomedScaleY = this.scaleY * this.zoom;
            const x = this.translateX + system.x * zoomedScaleX;
            const y = this.translateY + system.y * zoomedScaleY;
            const fixedRadius = CONSTANTS.GALAXY_SYSTEM_RADIUS;

            // Draw system circle in white
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, fixedRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    findPath(systems, start, end) {
        if (start.id === end.id) return [start];
        
        const systemMap = new Map();
        systems.forEach(system => systemMap.set(system.id, system));
        
        const queue = [[start]];
        const visited = new Set([start.id]);
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (current.id === end.id) {
                return path;
            }
            
            if (current.connections) {
                for (const connId of current.connections) {
                    if (!visited.has(connId)) {
                        visited.add(connId);
                        const neighbor = systemMap.get(connId);
                        if (neighbor) {
                            queue.push([...path, neighbor]);
                        }
                    }
                }
            }
        }
        
        return null; // No path found
    }
    
    drawConnectionLine(system1, system2, color, width = 2) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        
        const x1 = this.translateX + system1.x * zoomedScaleX;
        const y1 = this.translateY + system1.y * zoomedScaleY;
        const x2 = this.translateX + system2.x * zoomedScaleX;
        const y2 = this.translateY + system2.y * zoomedScaleY;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }
    
    // Draw a station shape: 'circle' | 'diamond' | 'triangle'
    _drawStationShape(x, y, r, shape) {
        this.ctx.beginPath();
        if (shape === 'diamond') {
            this.ctx.moveTo(x,     y - r);
            this.ctx.lineTo(x + r, y);
            this.ctx.lineTo(x,     y + r);
            this.ctx.lineTo(x - r, y);
        } else if (shape === 'triangle') {
            this.ctx.moveTo(x,                    y - r);
            this.ctx.lineTo(x + r * 0.866,        y + r * 0.5);
            this.ctx.lineTo(x - r * 0.866,        y + r * 0.5);
        } else {
            this.ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        this.ctx.closePath();
    }

    drawSystem(system, isReachable, isHovered, isSelected, isCurrent, isTransitOrigin = false) {
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        const x = this.translateX + system.x * zoomedScaleX;
        const y = this.translateY + system.y * zoomedScaleY;
        const r = CONSTANTS.GALAXY_SYSTEM_RADIUS;

        if (!system.seen) {
            if (!this.visibleUnseenIds.has(system.id)) return;
            this.ctx.fillStyle = '#2a2a44';
            this.ctx.beginPath();
            this.ctx.arc(x, y, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#6666aa';
            this.ctx.font = `bold ${Math.round(r * 1.4)}px Courier New`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('?', x, y);
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
            return;
        }

        // Shape and base color by station type
        const stationShape = { shipyard: 'circle', mechanic: 'diamond', courthouse: 'triangle' };
        const stationBaseColor = { shipyard: '#4488ff', mechanic: '#ffaa00', courthouse: '#cc66ff' };
        const shape = system.isQueenPlanet ? 'circle' : (stationShape[system.stationType] || 'circle');
        const baseColor = system.isQueenPlanet ? '#ff4400' : (stationBaseColor[system.stationType] || '#808080');

        // State-driven color overlay
        let color;
        if (isHovered)        color = '#ffffff';
        else if (isCurrent)   color = '#00ff00';
        else if (isTransitOrigin) color = '#1a5c1a';
        else if (isReachable) color = baseColor;
        else                  color = system.isQueenPlanet ? '#ff4400' : '#555577';

        // Fill shape
        this.ctx.fillStyle = color;
        this._drawStationShape(x, y, r, shape);
        this.ctx.fill();

        // Selected ring
        if (isSelected) {
            this.ctx.strokeStyle = '#00ffff';
            this.ctx.lineWidth = 2;
            this._drawStationShape(x, y, r + 4, shape);
            this.ctx.stroke();
        }

        // Hover ring
        if (isHovered) {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1.5;
            this._drawStationShape(x, y, r + 3, shape);
            this.ctx.stroke();
        }

        // Pulsing ring for alien queen's lair
        if (system.isQueenPlanet) {
            const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 400);
            this.ctx.strokeStyle = `rgba(255, 68, 0, ${pulse})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, r + 7, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }
    
    updateTooltip(system, currentSystem) {
        const tooltip = document.getElementById('systemTooltip');
        if (!tooltip) return;

        if (!system.seen) {
            tooltip.innerHTML = `<strong>Unknown Region</strong><br>Unexplored territory`;
        } else {
            const tierLabel = system.isQueenPlanet ? 'Alien Queen\'s Lair' : `Tier ${system.tier}`;
            const stationLabel = {
                shipyard:   '⬡ Shipyard Station',
                mechanic:   '◆ Mechanic Station',
                courthouse: '▲ Courthouse Station',
            }[system.stationType] || '';
            const stationColor = {
                shipyard:   '#4488ff',
                mechanic:   '#ffaa00',
                courthouse: '#cc66ff',
            }[system.stationType] || '#aaa';

            let html = `<strong>${system.name}</strong><br>${tierLabel}`;
            if (stationLabel) html += `<br><span style="color:${stationColor}">${stationLabel}</span>`;
            tooltip.innerHTML = html;
        }

        tooltip.style.display = 'block';
        const tw = tooltip.offsetWidth  || 160;
        const th = tooltip.offsetHeight || 50;
        const cw = this.canvas.clientWidth  || this.canvas.width;
        const ch = this.canvas.clientHeight || this.canvas.height;
        const gap = 12;
        tooltip.style.left = ((this.mouseX + gap + tw > cw) ? this.mouseX - tw - gap : this.mouseX + gap) + 'px';
        tooltip.style.top  = ((this.mouseY + gap + th > ch) ? this.mouseY - th - gap : this.mouseY + gap) + 'px';
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('systemTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    scheduleTooltipShow() {
        // Clear any existing hide timer
        if (this.tooltipHideTimer) {
            clearTimeout(this.tooltipHideTimer);
            this.tooltipHideTimer = null;
        }
        
        this.tooltipShowTimer = setTimeout(() => {
            if (this.hoveredSystem || this.hoveredFleet || this.hoveredRoute) {
                this.tooltipVisible = true;
                if (this.hoveredSystem) {
                    this.updateTooltip(this.hoveredSystem, gameState.currentSystem);
                } else if (this.hoveredFleet) {
                    this.drawFleetTooltip(this.hoveredFleet);
                } else {
                    this.updateRouteTooltip(this.hoveredRoute, gameState.currentSystem);
                }
            }
            this.tooltipShowTimer = null;
        }, CONSTANTS.GALAXY_TOOLTIP_DELAY);
    }
    
    scheduleTooltipHide() {
        // Clear any existing show timer
        if (this.tooltipShowTimer) {
            clearTimeout(this.tooltipShowTimer);
            this.tooltipShowTimer = null;
        }
        
        this.tooltipHideTimer = setTimeout(() => {
            this.tooltipVisible = false;
            this.hideTooltip();
            this.tooltipHideTimer = null;
        }, CONSTANTS.GALAXY_TOOLTIP_DELAY);
    }
    
    _scheduleSnapBack() {
        if (this._snapBackTimer) clearTimeout(this._snapBackTimer);
        this._snapBackTimer = setTimeout(() => {
            this._snapBackTimer = null;
            this._checkAndSnapBack();
        }, 2500);
    }

    _checkAndSnapBack() {
        if (typeof gameState === 'undefined' || !gameState.currentSystem) return;
        let gx, gy;
        if (this._travelAnim) {
            const a = this._travelAnim;
            gx = a.from.x + (a.to.x - a.from.x) * a.progress;
            gy = a.from.y + (a.to.y - a.from.y) * a.progress;
        } else {
            gx = gameState.currentSystem.x;
            gy = gameState.currentSystem.y;
        }
        const zx = this.scaleX * this.zoom;
        const zy = this.scaleY * this.zoom;
        const sx = this.translateX + gx * zx;
        const sy = this.translateY + gy * zy;
        const pad = 60;
        const inView = sx >= pad && sx <= this.canvas.width  - pad
                    && sy >= pad && sy <= this.canvas.height - pad;
        if (!inView) this._animateSnapTo(gx, gy);
    }

    _animateSnapTo(gx, gy) {
        const zx = this.scaleX * this.zoom;
        const zy = this.scaleY * this.zoom;
        const toX = this.canvas.width  / 2 - gx * zx;
        const toY = this.canvas.height / 2 - gy * zy;
        const fromX = this.translateX;
        const fromY = this.translateY;
        const dur = 700;
        const t0 = performance.now();
        const tick = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
            this.translateX = fromX + (toX - fromX) * e;
            this.translateY = fromY + (toY - fromY) * e;
            if (typeof gameState !== 'undefined' && gameState.systems && gameState.currentSystem) {
                this.render(gameState.systems, gameState.currentSystem);
            }
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    drawFleetIcons(systems) {
        if (!gameState || !gameState.routes) return;
        const systemMap = new Map(systems.map(s => [s.id, s]));
        const zx = this.scaleX * this.zoom;
        const zy = this.scaleY * this.zoom;

        for (const sys of systems) {
            if (!sys.seen || !sys.connections) continue;
            for (const connId of sys.connections) {
                const other = systemMap.get(connId);
                if (!other || !other.seen) continue;
                const routeKey = getRouteKey(sys.id, connId);
                const routeData = gameState.routes.get(routeKey);
                if (!routeData || !routeData.fleets) continue;
                const angle = Math.atan2(other.y - sys.y, other.x - sys.x);
                for (const fleet of routeData.fleets) {
                    if (fleet.done) continue;
                    const gx = sys.x + (other.x - sys.x) * fleet._crossT;
                    const gy = sys.y + (other.y - sys.y) * fleet._crossT;
                    const cx = this.translateX + gx * zx;
                    const cy = this.translateY + gy * zy;
                    const isHov = this.hoveredFleet && this.hoveredFleet.fleet === fleet;
                    this.drawFleetIcon(fleet, cx, cy, angle, isHov);
                }
            }
        }
    }

    drawFleetIcon(fleet, cx, cy, angle, isHovered) {
        const factionData = CONSTANTS.FACTIONS.find(f => f.id === fleet.faction);
        const color = factionData ? factionData.color : '#ffffff';
        const typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === fleet.leaderType);
        const verts = typeData ? typeData.vertices : [[1, 0], [-1, -1], [-0.5, 0], [-1, 1]];
        const S = isHovered ? 9 : 7;

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(angle);
        if (isHovered) {
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = color;
        }
        this.ctx.fillStyle = color;
        drawShipShape(this.ctx, verts, S);
        this.ctx.fill();
        this.ctx.restore();

        // Size badge — circle + ship count
        const badgeX = cx + 7;
        const badgeY = cy - 7;
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(badgeX, badgeY, 5.5, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.font = 'bold 8px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#000000';
        this.ctx.fillText(fleet.size, badgeX, badgeY);
        this.ctx.restore();
    }

    getFleetAtPosition(galaxyX, galaxyY) {
        if (!gameState || !gameState.routes || !window.galaxyMapSystems) return null;
        const systems = window.galaxyMapSystems;
        const systemMap = new Map(systems.map(s => [s.id, s]));
        const hitRadius = 12 / (this.scaleX * this.zoom);

        for (const sys of systems) {
            if (!sys.seen || !sys.connections) continue;
            for (const connId of sys.connections) {
                const other = systemMap.get(connId);
                if (!other || !other.seen) continue;
                const routeKey = getRouteKey(sys.id, connId);
                const routeData = gameState.routes.get(routeKey);
                if (!routeData || !routeData.fleets) continue;
                for (const fleet of routeData.fleets) {
                    if (fleet.done) continue;
                    const gx = sys.x + (other.x - sys.x) * fleet._crossT;
                    const gy = sys.y + (other.y - sys.y) * fleet._crossT;
                    if (distance(galaxyX, galaxyY, gx, gy) <= hitRadius) {
                        return { fleet, fromSys: sys, toSys: other, routeKey };
                    }
                }
            }
        }
        return null;
    }

    drawFleetTooltip(hoveredFleetInfo) {
        const tooltip = document.getElementById('systemTooltip');
        if (!tooltip) return;
        const { fleet, routeKey } = hoveredFleetInfo;
        const factionData = CONSTANTS.FACTIONS.find(f => f.id === fleet.faction);
        const factionName = factionData ? factionData.name : fleet.faction;
        const factionColor = factionData ? factionData.color : '#ffffff';
        const threatLabel = fleet.fleetStrength <= 3 ? 'Low' : fleet.fleetStrength <= 6 ? 'Medium' : 'High';

        const routeData = routeKey && gameState && gameState.routes ? gameState.routes.get(routeKey) : null;
        const hazards = [];
        if (routeData) {
            if (routeData.hasAsteroids) hazards.push('Asteroids');
            if (routeData.cloudType) hazards.push(`${routeData.cloudType.charAt(0).toUpperCase() + routeData.cloudType.slice(1)} clouds`);
        }

        let html = `<strong style="color:${factionColor}">${factionName} Fleet</strong><br>`;
        html += `${fleet.size} ships · ${fleet.leaderType}<br>`;
        html += `Threat: ${threatLabel} (${fleet.fleetStrength}/10)`;
        if (fleet.isQueenFight) html += `<br><span style="color:#ff4400;">Alien Queen — Boss Fight</span>`;
        if (hazards.length > 0) html += `<br><span style="color:#ffcc44;">Hazards: ${hazards.join(', ')}</span>`;

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        const tw2 = tooltip.offsetWidth  || 160;
        const th2 = tooltip.offsetHeight || 60;
        const cw2 = this.canvas.clientWidth  || this.canvas.width;
        const ch2 = this.canvas.clientHeight || this.canvas.height;
        const gap2 = 12;
        tooltip.style.left = ((this.mouseX + gap2 + tw2 > cw2) ? this.mouseX - tw2 - gap2 : this.mouseX + gap2) + 'px';
        tooltip.style.top  = ((this.mouseY + gap2 + th2 > ch2) ? this.mouseY - th2 - gap2 : this.mouseY + gap2) + 'px';
    }

    clearSelection() {
        this.selectedSystem = null;
    }
}

let galaxyRenderer = null;

function initGalaxyRenderer() {
    galaxyRenderer = new GalaxyRenderer('galaxyCanvas');
}
