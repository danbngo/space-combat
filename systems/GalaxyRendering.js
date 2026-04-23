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
            // Re-render to remove hover color
            if (typeof gameState !== 'undefined') {
                this.render(gameState.systems, gameState.currentSystem);
            }
        }
        
        if (this.hoveredSystem && (!oldHovered || oldHovered.id !== this.hoveredSystem.id)) {
            console.log(`[GalaxyMouse] HOVER: mouse(screen: ${this.mouseX.toFixed(1)}, ${this.mouseY.toFixed(1)}) canvas(${galaxyX.toFixed(1)}, ${galaxyY.toFixed(1)}) hovered "${this.hoveredSystem.name}"`);
            this.scheduleTooltipShow();
            // Re-render to show hover color change
            if (typeof gameState !== 'undefined') {
                this.render(gameState.systems, gameState.currentSystem);
            }
        }
    }
    
    onClick(e) {
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
            console.log(`[GalaxyMouse] click selected: canvas (${x.toFixed(1)}, ${y.toFixed(1)}) galaxy (${galaxyX.toFixed(1)}, ${galaxyY.toFixed(1)}) system "${clickedSystem.name}" (${oldSelected ? 'was: ' + oldSelected.name : 'was: nothing'})`);
            
            // Center on the selected system and re-render
            if (typeof gameState !== 'undefined' && clickedSystem) {
                this.centerOnSystem(clickedSystem);
                this.render(gameState.systems, gameState.currentSystem);
            }
        } else {
            const old = this.selectedSystem;
            this.selectedSystem = null;
            console.log(`[GalaxyMouse] click on nothing: canvas (${x.toFixed(1)}, ${y.toFixed(1)}) galaxy (${galaxyY.toFixed(1)}, ${galaxyY.toFixed(1)}) ${old ? 'deselected ' + old.name : 'nothing was selected'}`);
            
            // Re-render for deselection
            if (typeof gameState !== 'undefined') {
                this.render(gameState.systems, gameState.currentSystem);
            }
        }

        // Update UI only for non-visual changes (like updating the current system section)
        if (selectionChanged && typeof gameState !== 'undefined' && typeof UISystem !== 'undefined') {
            // Only update the UI elements that don't affect zoom/camera
            UISystem.updateCurrentSystemSection(gameState);
        }
    }
    
    onMouseLeave() {
        if (this.hoveredSystem) {
            console.log(`[GalaxyMouse] LEAVE: mouse(screen: ${this.mouseX.toFixed(1)}, ${this.mouseY.toFixed(1)}) left canvas, unhovered "${this.hoveredSystem.name}"`);
        }
        this.hoveredSystem = null;
        this.scheduleTooltipHide();
        this.isDragging = false;
        this.dragged = false;
        // Re-render to remove hover color
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
        
        // Draw all systems
        systems.forEach(system => {
            const isReachable = currentSystem.connections && currentSystem.connections.includes(system.id);
            const isHovered = this.hoveredSystem && this.hoveredSystem.id === system.id;
            const isSelected = this.selectedSystem && this.selectedSystem.id === system.id;
            const isCurrent = system.id === currentSystem.id;
            
            this.drawSystem(system, isReachable, isHovered, isSelected, isCurrent);
        });
        
        // Draw tooltip if hovering and tooltip is scheduled to be visible
        if (this.tooltipVisible && this.hoveredSystem) {
            this.updateTooltip(this.hoveredSystem, currentSystem);
        } else if (!this.tooltipVisible) {
            this.hideTooltip();
        }
    }
    
    clear() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw border
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawAllConnections(systems) {
        // Draw all connections as gray
        this.ctx.strokeStyle = '#808080';
        this.ctx.lineWidth = 1;
        
        const drawnPairs = new Set();
        
        systems.forEach(system => {
            if (system.connections) {
                system.connections.forEach(connId => {
                    // Create a unique key for this pair to avoid drawing twice
                    const pairKey = [system.id, connId].sort().join('-');
                    if (!drawnPairs.has(pairKey)) {
                        const otherSystem = systems.find(s => s.id === connId);
                        if (otherSystem) {
                            this.drawConnectionLine(system, otherSystem, '#808080');
                            drawnPairs.add(pairKey);
                        }
                    }
                });
            }
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
    
    drawSystem(system, isReachable, isHovered, isSelected, isCurrent) {
        const zoomedScaleX = this.scaleX * this.zoom;
        const zoomedScaleY = this.scaleY * this.zoom;
        const x = this.translateX + system.x * zoomedScaleX;
        const y = this.translateY + system.y * zoomedScaleY;
        
        const fixedRadius = CONSTANTS.GALAXY_SYSTEM_RADIUS;
        
        // Determine color based on new scheme
        let color;
        if (isHovered) {
            color = '#ffffff'; // White for hovered systems
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
        
        // Draw enemy marker if has enemy fleet
        if (system.hasEnemyFleet && !isCurrent) {
            this.ctx.fillStyle = '#ff3333';
            const markerSize = 2;
            this.ctx.fillRect(x + fixedRadius + 2, y - markerSize, 4, markerSize * 2);
        }
    }
    
    updateTooltip(system, currentSystem) {
        const tooltip = document.getElementById('systemTooltip');
        if (!tooltip) return;
        
        const dist = distance(currentSystem.x, currentSystem.y, system.x, system.y);
        const reachable = dist <= CONSTANTS.MAX_TRAVEL_DISTANCE;
        const travelInfo = reachable ? `Distance: ${dist.toFixed(0)} ly` : `Too far: ${dist.toFixed(0)} ly`;
        
        let html = `<strong>${system.name}</strong><br>`;
        html += `${travelInfo}<br>`;
        html += `Visited: ${system.visited ? 'Yes' : 'No'}<br>`;
        html += `Enemy Fleet: ${system.hasEnemyFleet ? 'Yes' : 'No'}`;
        
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
