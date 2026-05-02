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
        this.hoveredRouteFleet = null;
        this.routeFleetDots = [];
        this.selectedSystem = null;
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
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        const scaledWidth = CONSTANTS.GALAXY_WIDTH * zoomedScaleX;
        const scaledHeight = CONSTANTS.GALAXY_HEIGHT * zoomedScaleY;
        
        if (scaledWidth <= this.canvas.width) {
            this.translateX = (this.canvas.width - scaledWidth) / 2;
        }
        
        if (scaledHeight <= this.canvas.height) {
            this.translateY = (this.canvas.height - scaledHeight) / 2;
        }
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
        this.hoveredSystem = this.getSystemAtPosition(galaxyX, galaxyY);

        if (oldHovered && (!this.hoveredSystem || this.hoveredSystem.id !== oldHovered.id)) {
            console.log(`[GalaxyMouse] UNHOVER: mouse(screen: ${this.mouseX.toFixed(1)}, ${this.mouseY.toFixed(1)}) canvas(${galaxyX.toFixed(1)}, ${galaxyY.toFixed(1)}) unhovered "${oldHovered.name}"`);
            this.scheduleTooltipHide();
            if (typeof gameState !== 'undefined') {
                this.render(gameState.systems, gameState.currentSystem);
            }
        }

        if (this.hoveredSystem && (!oldHovered || oldHovered.id !== this.hoveredSystem.id)) {
            console.log(`[GalaxyMouse] HOVER: mouse(screen: ${this.mouseX.toFixed(1)}, ${this.mouseY.toFixed(1)}) canvas(${galaxyX.toFixed(1)}, ${galaxyY.toFixed(1)}) hovered "${this.hoveredSystem.name}"`);
            this.scheduleTooltipShow();
            if (typeof gameState !== 'undefined') {
                this.render(gameState.systems, gameState.currentSystem);
            }
        }

        // Fleet dot hover (only when no system is hovered)
        const oldFleetId = this.hoveredRouteFleet ? this.hoveredRouteFleet.dotId : null;
        this.hoveredRouteFleet = this.hoveredSystem ? null : this.getRouteFleetAtPosition(this.mouseX, this.mouseY);
        const newFleetId = this.hoveredRouteFleet ? this.hoveredRouteFleet.dotId : null;
        if (newFleetId !== oldFleetId) {
            if (typeof gameState !== 'undefined') {
                this.render(gameState.systems, gameState.currentSystem);
            }
        }
    }
    
    // Start a travel animation from fromSystem to toSystem. Does not start moving yet.
    startTravelAnim(fromSystem, toSystem) {
        this._travelAnim = { from: fromSystem, to: toSystem, progress: 0 };
    }

    // Animate from current progress to endPct then call onDone.
    animateTravelSegment(endPct, onDone) {
        if (!this._travelAnim) { onDone(); return; }
        const startPct = this._travelAnim.progress;
        if (startPct >= endPct) { onDone(); return; }
        const segDur = Math.max(80, (endPct - startPct) * CONSTANTS.GALAXY_TRAVEL_ANIM_DURATION);
        const start = performance.now();
        const tick = (now) => {
            if (!this._travelAnim) return;
            const t = Math.min(1, (now - start) / segDur);
            this._travelAnim.progress = startPct + (endPct - startPct) * t;
            this.render(gameState.systems, this._travelAnim.from);
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
            const oldSelected = this.selectedSystem;
            this.selectedSystem = clickedSystem;
            if (typeof gameState !== 'undefined') gameState.selectedSystem = clickedSystem;
            console.log(`[GalaxyMouse] click selected: canvas (${x.toFixed(1)}, ${y.toFixed(1)}) galaxy (${galaxyX.toFixed(1)}, ${galaxyY.toFixed(1)}) system "${clickedSystem.name}" (${oldSelected ? 'was: ' + oldSelected.name : 'was: nothing'})`);

            // Center on the selected system and re-render
            if (typeof gameState !== 'undefined' && clickedSystem) {
                this.centerOnSystem(clickedSystem);
                this.render(gameState.systems, gameState.currentSystem);
            }
        } else {
            const old = this.selectedSystem;
            this.selectedSystem = null;
            if (typeof gameState !== 'undefined') gameState.selectedSystem = null;
            console.log(`[GalaxyMouse] click on nothing: canvas (${x.toFixed(1)}, ${y.toFixed(1)}) galaxy (${galaxyY.toFixed(1)}, ${galaxyY.toFixed(1)}) ${old ? 'deselected ' + old.name : 'nothing was selected'}`);

            // Re-render for deselection
            if (typeof gameState !== 'undefined') {
                this.render(gameState.systems, gameState.currentSystem);
            }
        }

        // Update UI only for non-visual changes (like updating the current system section)
        if (selectionChanged && typeof gameState !== 'undefined' && typeof UISystem !== 'undefined') {
            UISystem.updateCurrentSystemSection(gameState);
            UISystem.updateSelectedSystemSection(gameState);
        }
    }
    
    onMouseLeave() {
        if (this.hoveredSystem) {
            console.log(`[GalaxyMouse] LEAVE: mouse(screen: ${this.mouseX.toFixed(1)}, ${this.mouseY.toFixed(1)}) left canvas, unhovered "${this.hoveredSystem.name}"`);
        }
        this.hoveredSystem = null;
        this.hoveredRouteFleet = null;
        this.scheduleTooltipHide();
        this.isDragging = false;
        this.dragged = false;
        if (typeof gameState !== 'undefined') {
            this.render(gameState.systems, gameState.currentSystem);
        }
    }

    onMouseDown(e) {
        if (e.button !== 0) return;

        const rect = this.canvas.getBoundingClientRect();
        this.lastDragX = e.clientX - rect.left;
        this.lastDragY = e.clientY - rect.top;
        this.isDragging = true;
        this.dragged = false;
    }

    onMouseUp() {
        this.isDragging = false;
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
            const dist = distance(currentSystem.x, currentSystem.y, this.selectedSystem.x, this.selectedSystem.y);
            const isConnected = currentSystem.connections && currentSystem.connections.includes(this.selectedSystem.id);
            if (isConnected) {
                this.drawConnectionLine(currentSystem, this.selectedSystem, '#00ffff'); // Cyan for direct connection
            }
        }
        
        // Draw route fleet dots on top of all lines
        this.drawAllRouteFleetDots();

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
        
        // Draw traveling ship on top of everything
        if (this._travelAnim) {
            this.drawTravelingShip(this._travelAnim.from, this._travelAnim.to, this._travelAnim.progress);
        }

        // Draw tooltip
        if (this.hoveredRouteFleet) {
            this.updateRouteFleetTooltip(this.hoveredRouteFleet);
        } else if (this.tooltipVisible && this.hoveredSystem) {
            this.updateTooltip(this.hoveredSystem, currentSystem);
        } else if (!this.tooltipVisible) {
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
        this.routeFleetDots = [];
        this.visibleUnseenIds = new Set();

        systems.forEach(system => {
            if (system.connections) {
                system.connections.forEach(connId => {
                    const pairKey = getRouteKey(system.id, connId);
                    if (!drawnPairs.has(pairKey)) {
                        drawnPairs.add(pairKey);
                        const otherSystem = systems.find(s => s.id === connId);
                        if (otherSystem) {
                            if (system.seen && otherSystem.seen) {
                                this.drawConnectionLine(system, otherSystem, '#808080');
                                if (typeof gameState !== 'undefined' && gameState.routeFleets && gameState.routeFleets.has(pairKey)) {
                                    const zx = this.scaleX * this.zoom;
                                    const zy = this.scaleY * this.zoom;
                                    const routeAngle = Math.atan2(otherSystem.y - system.y, otherSystem.x - system.x);
                                    const encounters = gameState.routeFleets.get(pairKey);
                                    for (const enc of encounters) {
                                        const t = enc.position;
                                        const ex = system.x + (otherSystem.x - system.x) * t;
                                        const ey = system.y + (otherSystem.y - system.y) * t;
                                        const factionData = CONSTANTS.FACTIONS.find(f => f.id === enc.faction);
                                        this.routeFleetDots.push({
                                            dotId: `${pairKey}|${enc.faction}|${t.toFixed(4)}`,
                                            key: pairKey,
                                            faction: enc.faction,
                                            factionName: factionData ? factionData.name : 'Unknown',
                                            color: factionData ? factionData.color : '#ff4444',
                                            x: this.translateX + ex * zx,
                                            y: this.translateY + ey * zy,
                                            size: enc.size,
                                            angle: routeAngle,
                                        });
                                    }
                                }
                            } else if (system.seen || otherSystem.seen) {
                                this.drawConnectionLine(system, otherSystem, '#2a2a3a');
                                if (!system.seen) this.visibleUnseenIds.add(system.id);
                                if (!otherSystem.seen) this.visibleUnseenIds.add(otherSystem.id);
                            }
                        }
                    }
                });
            }
        });
    }

    drawAllRouteFleetDots() {
        const FACTION_SPRITE = { pirates: 'smuggler', police: 'jammer', merchants: 'repair_ship' };
        const fallbackVerts  = [[2.3, 0], [0.3, -1.0], [-1.8, -1.5], [-1.3, 0], [-1.8, 1.5], [0.3, 1.0]];

        for (const dot of this.routeFleetDots) {
            const isHovered  = this.hoveredRouteFleet && this.hoveredRouteFleet.dotId === dot.dotId;
            const S          = isHovered ? 10 : 7;
            const baseColor  = dot.color || '#ff4444';
            const labelColor = isHovered ? '#ffffff' : baseColor;

            this.ctx.save();
            this.ctx.translate(dot.x, dot.y);
            this.ctx.rotate(dot.angle);

            const spriteId  = FACTION_SPRITE[dot.faction];
            const spriteImg = spriteId ? spriteSystem.getImage(spriteId) : null;

            if (spriteImg) {
                const spriteScale = (S * 4) / Math.max(spriteImg.naturalWidth, spriteImg.naturalHeight);
                const tint      = isHovered ? '#ffffff' : baseColor;
                const tintAlpha = isHovered ? 0.20 : 0.50;
                spriteSystem.draw(this.ctx, spriteId, 0, 0, Math.PI / 2, spriteScale, { tint, tintAlpha });
            } else {
                this.ctx.fillStyle = isHovered ? '#ffffff' : baseColor;
                drawShipShape(this.ctx, fallbackVerts, S);
                this.ctx.fill();
                if (isHovered) {
                    this.ctx.strokeStyle = '#ffffff';
                    this.ctx.lineWidth = 1.5;
                    this.ctx.stroke();
                }
            }

            this.ctx.restore();

            // Fleet size number above the dot
            const fontSize = isHovered ? 11 : 9;
            this.ctx.font = `bold ${fontSize}px Courier New`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillStyle = labelColor;
            this.ctx.fillText(String(dot.size), dot.x, dot.y - S - 1);
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
        }
    }

    getRouteFleetAtPosition(screenX, screenY) {
        const HIT_RADIUS = 12;
        for (const dot of this.routeFleetDots) {
            const dx = screenX - dot.x;
            const dy = screenY - dot.y;
            if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) return dot;
        }
        return null;
    }

    updateRouteFleetTooltip(fleet) {
        const tooltip = document.getElementById('systemTooltip');
        if (!tooltip) return;
        tooltip.innerHTML = `<strong>${fleet.factionName} Fleet</strong><br>Ships: ${fleet.size}`;
        tooltip.style.left = (this.mouseX + 10) + 'px';
        tooltip.style.top  = (this.mouseY + 10) + 'px';
        tooltip.style.display = 'block';
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
    
    drawConnectionLine(system1, system2, color) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        
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
    
    drawSystem(system, isReachable, isHovered, isSelected, isCurrent, isTransitOrigin = false) {
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        const x = this.translateX + system.x * zoomedScaleX;
        const y = this.translateY + system.y * zoomedScaleY;
        const fixedRadius = CONSTANTS.GALAXY_SYSTEM_RADIUS;

        if (!system.seen) {
            if (!this.visibleUnseenIds.has(system.id)) return;
            this.ctx.fillStyle = '#2a2a44';
            this.ctx.beginPath();
            this.ctx.arc(x, y, fixedRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#6666aa';
            this.ctx.font = `bold ${Math.round(fixedRadius * 1.4)}px Courier New`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('?', x, y);
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
            return;
        }
        
        // Determine color based on new scheme
        let color;
        if (isHovered) {
            color = '#ffffff'; // White for hovered systems
        } else if (isTransitOrigin) {
            color = '#1a5c1a'; // Dark green — ship has departed, system no longer occupied
        } else if (isCurrent) {
            color = '#00ff00'; // Green for current
        } else if (isReachable) {
            color = '#c0c0c0'; // Light gray for reachable
        } else {
            color = '#808080'; // Gray for others
        }
        
        // Draw system circle with fixed size
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, fixedRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw outer ring if selected
        if (isSelected) {
            this.ctx.strokeStyle = '#00ffff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, fixedRadius + 4, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Draw outer ring if hovered
        if (isHovered) {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.arc(x, y, fixedRadius + 3, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
    }
    
    updateTooltip(system, currentSystem) {
        const tooltip = document.getElementById('systemTooltip');
        if (!tooltip) return;

        if (!system.seen) {
            tooltip.innerHTML = `<strong>Unknown System</strong><br>Unexplored territory`;
            tooltip.style.left = (this.mouseX + 10) + 'px';
            tooltip.style.top = (this.mouseY + 10) + 'px';
            tooltip.style.display = 'block';
            return;
        }

        const dist = distance(currentSystem.x, currentSystem.y, system.x, system.y);
        const reachable = dist <= CONSTANTS.MAX_TRAVEL_DISTANCE;
        const travelInfo = reachable ? `Distance: ${dist.toFixed(0)} ly` : `Too far: ${dist.toFixed(0)} ly`;

        let html = `<strong>${system.name}</strong><br>`;
        html += `${travelInfo}<br>`;
        html += `Visited: ${system.visited ? 'Yes' : 'No'}`;

        const isConnected = currentSystem.connections && currentSystem.connections.includes(system.id);
        if (isConnected && typeof gameState !== 'undefined' && gameState.routeFleets) {
            const routeKey = getRouteKey(currentSystem.id, system.id);
            const encounters = gameState.routeFleets.get(routeKey);
            if (encounters && encounters.length > 0) {
                const summary = encounters.map(e => {
                    const f = CONSTANTS.FACTIONS.find(f => f.id === e.faction);
                    return `<span style="color:${f ? f.color : '#fff'}">${f ? f.name : '?'}(${e.size})</span>`;
                }).join(' ');
                html += `<br>Patrols: ${summary}`;
            } else {
                html += `<br>Patrols: None`;
            }
        }

        if (!reachable) {
            html += '<br><span style="color: #ff6600;">Out of range</span>';
        }

        tooltip.innerHTML = html;

        // Position tooltip at mouse
        tooltip.style.left = (this.mouseX + 10) + 'px';
        tooltip.style.top = (this.mouseY + 10) + 'px';
        tooltip.style.display = 'block';
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
            if (this.hoveredSystem) {
                this.tooltipVisible = true;
                this.updateTooltip(this.hoveredSystem, gameState.currentSystem);
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
    
    clearSelection() {
        this.selectedSystem = null;
    }
}

let galaxyRenderer = null;

function initGalaxyRenderer() {
    galaxyRenderer = new GalaxyRenderer('galaxyCanvas');
}
