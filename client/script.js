/**
 * Screen Manager - Handle screen transitions
 */
class ScreenManager {
    constructor() {
        this.currentScreen = 'home';
        this.screens = {
            home: 'screen-home',
            findGame: 'screen-find-game',
            lobby: 'screen-lobby',
            gameplay: 'screen-gameplay',
            roundEnd: 'screen-round-end',
            matchEnd: 'screen-match-end'
        };
    }
    
    show(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(screenId => {
            const el = document.getElementById(screenId);
            if (el) {
                el.classList.remove('active');
            }
        });
        
        // Show requested screen
        const targetScreen = this.screens[screenName];
        if (targetScreen) {
            const el = document.getElementById(targetScreen);
            if (el) {
                el.classList.add('active');
                this.currentScreen = screenName;
            }
        }
    }
    
    getCurrentScreen() {
        return this.currentScreen;
    }
}

/**
 * Duel Dome Client - WebSocket game client
 */
class DuelDomeClient {
    constructor() {
        // Initialize screen manager
        this.screenManager = new ScreenManager();
        
        // Get canvas - may not exist if we're on home screen
        this.canvas = document.getElementById('game-canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        } else {
            this.ctx = null;
        }
        
        this.ws = null;
        this.playerId = null;
        this.gameState = null;
        this.lastState = null;
        this.inputState = {
            w: false, a: false, s: false, d: false,
            shoot: false, dash: false
        };
        this.keys = {};
        this.interpolationBuffer = [];
        this.renderTime = 0;
        this.lastInputSend = 0;
        this.lastStateUpdate = Date.now();
        this.gameCode = null;
        this.isHost = false;
        
        // Visual effects tracking
        this.playerTrails = {}; // player_id -> [{x, y, time, opacity}]
        this.bulletTrails = {}; // bullet_id -> [{x, y, time, opacity}]
        this.particles = []; // {x, y, vx, vy, life, maxLife, color, size}
        this.impactEffects = []; // {x, y, time, color}
        this.lastPlayerPositions = {}; // player_id -> {x, y}
        this.dashEffects = []; // {x, y, angle, time, playerId}
        this.screenShake = {x: 0, y: 0, time: 0};
        this.backgroundParticles = []; // Pre-generated particles
        this.lastDashTimes = {}; // Track when players dashed for effects
        
        // Sound system
        this.sounds = {};
        this.initSoundSystem();
        
        // Combo/notification tracking
        this.comboNotifications = []; // {text, x, y, time, color}
        this.styleMeter = 0; // 0-100
        this.styleMeterActive = false;
        
        // Setup UI event handlers
        this.setupUIHandlers();
        
        // Setup mobile controls
        this.setupMobileControls();
        
        // Start on home screen
        this.screenManager.show('home');
        
        // Setup ping monitoring
        this.startPingMonitor();
    }
    
    setupUIHandlers() {
        // Home screen buttons
        const btnJoin = document.getElementById('btn-join-game');
        const btnCreate = document.getElementById('btn-create-game');
        
        if (btnJoin) {
            btnJoin.addEventListener('click', () => this.showFindGame());
        }
        
        if (btnCreate) {
            btnCreate.addEventListener('click', () => this.createGame());
        }
        
        // Find game modal
        const btnCloseFind = document.getElementById('btn-close-find');
        const btnJoinCode = document.getElementById('btn-join-code');
        const inputCode = document.getElementById('input-game-code');
        
        // Match end buttons
        const btnPlayAgain = document.getElementById('btn-play-again');
        const btnBackToMenuEnd = document.getElementById('btn-back-to-menu-end');
        
        if (btnPlayAgain) {
            btnPlayAgain.addEventListener('click', () => this.playAgain());
        }
        
        if (btnBackToMenuEnd) {
            btnBackToMenuEnd.addEventListener('click', () => this.backToMenu());
        }
        
        if (btnCloseFind) {
            btnCloseFind.addEventListener('click', () => this.screenManager.show('home'));
        }
        
        if (btnJoinCode) {
            btnJoinCode.addEventListener('click', () => {
                const code = inputCode?.value?.trim().toUpperCase();
                if (code) {
                    this.joinGame(code);
                }
            });
        }
        
        // Lobby buttons
        const btnCopy = document.getElementById('btn-copy-code');
        const btnStart = document.getElementById('btn-start-match');
        const btnLeave = document.getElementById('btn-leave-lobby');
        
        if (btnCopy) {
            btnCopy.addEventListener('click', () => this.copyGameCode());
        }
        
        if (btnStart) {
            btnStart.addEventListener('click', () => this.startMatch());
        }
        
        if (btnLeave) {
            btnLeave.addEventListener('click', () => this.leaveLobby());
        }
        
    }
    
    showFindGame() {
        this.screenManager.show('findGame');
        const input = document.getElementById('input-game-code');
        if (input) {
            input.focus();
        }
    }
    
    createGame() {
        // Generate random game code
        this.gameCode = this.generateGameCode();
        this.isHost = true;
        
        // Show lobby
        this.screenManager.show('lobby');
        this.updateLobbyDisplay();
        
        // Connect to server (will be handled by server to create room)
        this.connectToGame(this.gameCode);
    }
    
    joinGame(code) {
        this.gameCode = code.toUpperCase();
        this.isHost = false;
        
        // Show lobby
        this.screenManager.show('lobby');
        this.updateLobbyDisplay();
        
        // Connect to server with game code
        this.connectToGame(code);
    }
    
    generateGameCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    updateLobbyDisplay() {
        const codeDisplay = document.getElementById('display-game-code');
        if (codeDisplay && this.gameCode) {
            codeDisplay.textContent = this.gameCode;
        }
    }
    
    copyGameCode() {
        if (this.gameCode && navigator.clipboard) {
            navigator.clipboard.writeText(this.gameCode).then(() => {
                const btn = document.getElementById('btn-copy-code');
                if (btn) {
                    const original = btn.textContent;
                    btn.textContent = '✓';
                    setTimeout(() => {
                        btn.textContent = original;
                    }, 2000);
                }
            });
        }
    }
    
    leaveLobby() {
        if (this.ws) {
            this.ws.close(1000, 'User left lobby'); // Normal closure
        }
        this.ws = null; // Clear reference
        this.screenManager.show('home');
        this.gameCode = null;
        this.isHost = false;
    }
    
    startMatch() {
        // Either player can start (no host/guest distinction in single-room mode)
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('Starting match...');
            this.ws.send(JSON.stringify({
                type: 'start_match'
            }));
        } else {
            console.error('Cannot start match - not connected to server');
        }
    }
    
    playAgain() {
        // Send start_match message to backend to start a new match
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('Play Again - restarting match...');
            this.ws.send(JSON.stringify({
                type: 'start_match'
            }));
        } else {
            console.error('Cannot restart - not connected to server');
            // Fall back to lobby
            this.screenManager.show('lobby');
            this.updateLobbyDisplay();
        }
    }
    
    backToMenu() {
        if (this.ws) {
            this.ws.close(1000, 'User returned to menu'); // Normal closure
        }
        this.ws = null; // Clear reference
        this.screenManager.show('home');
        this.gameCode = null;
        this.isHost = false;
        // Reset game state
        if (this.canvas) {
            this.canvas.width = 0;
            this.canvas.height = 0;
        }
    }
    
    startPingMonitor() {
        let lastPingTime = Date.now();
        setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const now = Date.now();
                const ping = now - lastPingTime;
                lastPingTime = now;
                
                const pingEl = document.getElementById('ping-indicator');
                const hudPing = document.getElementById('hud-ping');
                
                if (pingEl) {
                    pingEl.textContent = `Ping: ${ping}ms`;
                }
                if (hudPing) {
                    hudPing.textContent = `Ping: ${ping}ms`;
                }
            }
        }, 2000); // Update every 2 seconds
    }
    
    // Initialize gameplay (called when match starts)
    initGameplay() {
        console.log('[initGameplay] Starting...');
        
        if (!this.canvas) {
            this.canvas = document.getElementById('game-canvas');
            if (this.canvas) {
                this.ctx = this.canvas.getContext('2d');
                console.log('[initGameplay] Canvas initialized');
            } else {
                console.error('[initGameplay] Canvas not found!');
                return;
            }
        }
        
        if (this.canvas && this.ctx) {
            this.resizeCanvas();
            console.log('[initGameplay] Canvas resized');
            
            // Only setup input handlers once
            if (!this.inputHandlersSetup) {
                window.addEventListener('resize', () => this.resizeCanvas());
                this.setupInputHandlers();
                this.inputHandlersSetup = true;
                console.log('[initGameplay] Input handlers setup');
            }
            
            // Initialize background particles
            if (!this.backgroundParticles || this.backgroundParticles.length === 0) {
                this.initBackgroundParticles();
                console.log('[initGameplay] Background particles initialized');
            }
            
            // Start render loop (if not already running)
            if (!this.rendering) {
                this.lastRenderTime = performance.now();
                this.rendering = true;
                this.render();
                console.log('[initGameplay] Render loop started');
            }
            
            console.log('[initGameplay] Complete!');
        }
    }
    
    initBackgroundParticles() {
        // Generate ~30 background particles
        this.backgroundParticles = [];
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 600;
            this.backgroundParticles.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                size: 1 + Math.random() * 2,
                opacity: 0.2 + Math.random() * 0.3,
                speed: 0.2 + Math.random() * 0.3,
                angle: Math.random() * Math.PI * 2
            });
        }
    }
    
    initSoundSystem() {
        // Initialize sound effects (using Web Audio API for lightweight sounds)
        // For now, we'll create placeholder audio contexts that can be enhanced
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Audio context not available:', e);
            this.audioContext = null;
        }
    }
    
    playSound(type) {
        // Lightweight sound generation using Web Audio API
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Different frequencies for different events
            const frequencies = {
                'shoot': 800,
                'dash': 200,
                'hit': 100,
                'kill': 50,
                'powerup': 600,
                'combo': 400
            };
            
            const freq = frequencies[type] || 440;
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            oscillator.type = type === 'hit' ? 'sawtooth' : 'sine';
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        } catch (e) {
            // Silently fail if audio not available
        }
    }
    
    showComboNotification(text, x, y, color = '#FFFF00') {
        this.comboNotifications.push({
            text: text,
            x: x,
            y: y,
            time: 2000,
            color: color
        });
    }
    
    resizeCanvas() {
        // Maintain square aspect ratio, use smaller dimension to prevent stretching
        const container = this.canvas.parentElement;
        const containerWidth = container ? container.clientWidth : window.innerWidth;
        const containerHeight = container ? container.clientHeight : window.innerHeight;
        const size = Math.min(containerWidth, containerHeight) * 0.9;
        
        // Set canvas internal dimensions (resolution)
        this.canvas.width = size;
        this.canvas.height = size;
        
        // Set canvas CSS size to maintain aspect ratio
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.maxHeight = '100%';
        this.canvas.style.margin = 'auto';
        this.canvas.style.display = 'block';
        
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.scale = this.canvas.width / 1000; // Base arena is 800 units wide
    }
    
    connect() {
        // Get backend URL from environment or use default
        // For Vercel: set VITE_WS_BACKEND_URL in environment variables
        // For local dev: uses localhost
        const getBackendUrl = () => {
            // Method 1: Check for window environment variable (set via build script or runtime)
            if (window.WS_BACKEND_URL) {
                return window.WS_BACKEND_URL;
            }
            // Method 2: Check for meta tag (alternative method for deployment)
            const metaTag = document.querySelector('meta[name="ws-backend-url"]');
            if (metaTag && metaTag.content && metaTag.content.trim()) {
                return metaTag.content.trim();
            }
            // Method 3: Check for data attribute on script tag
            const scriptTag = document.querySelector('script[data-ws-backend-url]');
            if (scriptTag && scriptTag.dataset.wsBackendUrl) {
                return scriptTag.dataset.wsBackendUrl;
            }
            // Default: use same host (for local dev or same-domain setups)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${protocol}//${window.location.host}/ws`;
        };
        
        const wsUrl = getBackendUrl();
        console.log('Connecting to:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        this.updateConnectionStatus('Connecting...');
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        
        this.ws.onopen = () => {
            this.updateConnectionStatus('Connected');
            this.reconnectAttempts = 0; // Reset on successful connection
            // Only change cursor if we're in gameplay
            if (this.screenManager.getCurrentScreen() === 'gameplay') {
                document.body.style.cursor = 'crosshair';
            }
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('Connection Error');
        };
        
        this.ws.onclose = (event) => {
            this.updateConnectionStatus('Disconnected');
            document.body.style.cursor = 'wait';
            
            // Don't reconnect if it was a normal closure (e.g., user left lobby)
            if (event.code === 1000) {
                return;
            }
            
            // Exponential backoff reconnection
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                this.reconnectAttempts++;
                setTimeout(() => {
                    if (this.screenManager.getCurrentScreen() !== 'home') {
                        this.connect();
                    }
                }, delay);
            } else {
                console.error('Max reconnection attempts reached');
                this.updateConnectionStatus('Connection Failed - Please refresh');
            }
        };
        
        // Continuously send input state at ~60Hz for responsive movement
        if (!this.inputInterval) {
            this.inputInterval = setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.sendInput();
                }
            }, 33); // ~30Hz to reduce network load
        }
    }
    
    connectToGame(gameCode) {
        // Just connect - backend doesn't support rooms yet
        // Game code is for display only
        
        // Don't reconnect if already connected!
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            console.log('Already connected, skipping reconnect');
            return;
        }
        
        this.connect();
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'connected':
                this.playerId = message.player_id;
                console.log('Connected! Player ID:', this.playerId);
                console.log('Connection message:', message);
                console.log('Message.players:', message.players);
                console.log('Message.players type:', typeof message.players);
                console.log('Message.players is array?', Array.isArray(message.players));
                
                // Update lobby with player list from server
                // Check if players exists and is valid
                if (message.players !== undefined && message.players !== null) {
                    if (Array.isArray(message.players) && message.players.length > 0) {
                        console.log('Updating lobby from connected message with players:', message.players);
                        this.updateLobbyFromPlayers(message.players);
                    } else {
                        console.log('Players field exists but is empty/invalid:', message.players);
                        // Fall back to updateLobbyOnConnect
                        this.updateLobbyOnConnect();
                    }
                } else {
                    console.log('No players field in connected message, using updateLobbyOnConnect');
                    this.updateLobbyOnConnect();
                }
                
                // If 2 players, show start button for host
                if (message.players_count >= 2 && this.isHost) {
                    const btnStart = document.getElementById('btn-start-match');
                    if (btnStart) {
                        btnStart.classList.remove('hidden');
                    }
                }
                break;
            
            case 'lobby_update':
                // Update lobby when players join/leave
                console.log('Lobby update received:', message);
                if (message.players) {
                    console.log('Updating lobby with players:', message.players);
                    this.updateLobbyFromPlayers(message.players);
                } else {
                    console.warn('Lobby update received but no players array');
                }
                
                // Show start button for host when 2 players
                if (message.players_count >= 2 && this.isHost) {
                    const btnStart = document.getElementById('btn-start-match');
                    if (btnStart) {
                        btnStart.classList.remove('hidden');
                    }
                }
                break;
            
            case 'match_start':
                try {
                    console.log('Match starting - switching to gameplay');
                    // Hide disconnect overlay
                    const disconnectOverlay = document.getElementById('disconnect-overlay');
                    if (disconnectOverlay) {
                        disconnectOverlay.classList.add('hidden');
                    }
                    // Switch to gameplay screen
                    this.screenManager.show('gameplay');
                    this.initGameplay();
                    console.log('Match start complete');
                } catch (error) {
                    console.error('Error during match start:', error);
                }
                break;
            
            case 'round_start':
                // Hide round end screen if visible
                const roundEndScreen = document.getElementById('screen-round-end');
                if (roundEndScreen) {
                    roundEndScreen.classList.remove('active');
                }
                // Ensure gameplay screen is visible and active
                this.screenManager.show('gameplay');
                // Re-initialize gameplay if needed (ensure canvas is set up)
                if (!this.canvas || !this.ctx) {
                    this.initGameplay();
                }
                // Hide any countdown overlay
                const countdownOverlay = document.getElementById('countdown-overlay');
                if (countdownOverlay) {
                    countdownOverlay.classList.add('hidden');
                }
                if (message.round_number) {
                    this.showMessage(`Round ${message.round_number}`, '#00ffaa', 1500);
                }
                if (message.scores) {
                    this.updateScores(message.scores);
                }
                break;
            
            case 'player_disconnected':
                // Show disconnect overlay only if we're in an active match
                if (this.gameState && this.gameState.match_active) {
                    const disconnectOverlay = document.getElementById('disconnect-overlay');
                    if (disconnectOverlay) {
                        disconnectOverlay.classList.remove('hidden');
                    }
                }
                break;
            
            case 'match_end':
                this.handleMatchEnd(message);
                break;
            
            case 'arena_event':
                this.showArenaEvent(message.event);
                break;
            
            case 'game_state':
                console.log('📦 Got game_state:', message.data.match_state, '| players:', Object.keys(message.data.players || {}).length);
                
                // Auto-hide disconnect overlay when 2 players present
                if (message.data.players && Object.keys(message.data.players).length >= 2) {
                    const disconnectOverlay = document.getElementById('disconnect-overlay');
                    if (disconnectOverlay) {
                        disconnectOverlay.classList.add('hidden');
                    }
                }
                
                // Only process game state if match is active or we're on gameplay screen
                // This prevents showing game state in lobby
                if (!this.gameState && message.data.match_state === 'waiting' && !message.data.match_active) {
                    // Just store it for lobby display, but don't switch screens
                    this.gameState = message.data;
                    // Update lobby player slots from game state if in lobby
                    if (this.screenManager.getCurrentScreen() === 'lobby') {
                        this.updateLobbyFromGameState(message.data);
                    }
                    break;
                }
                
                // Check for damage (health decreased)
                const oldHealth = this.gameState?.players?.[this.playerId]?.health;
                const newHealth = message.data.players?.[this.playerId]?.health;
                if (oldHealth !== undefined && newHealth !== undefined && newHealth < oldHealth) {
                    // Player was hit - create impact effect
                    const myPlayer = message.data.players[this.playerId];
                    if (myPlayer) {
                        const attacker = Object.values(message.data.players).find(p => p.id !== this.playerId);
                        const attackerColor = attacker ? '#C77DFF' : '#00BFFF';
                        this.createImpactEffect(myPlayer.x, myPlayer.y, attackerColor);
                        this.playSound('hit');
                    }
                }
                
                // Check for opponent damage
                Object.keys(message.data.players || {}).forEach(playerId => {
                    if (playerId !== this.playerId) {
                        const oldOppHealth = this.gameState?.players?.[playerId]?.health;
                        const newOppHealth = message.data.players[playerId]?.health;
                        if (oldOppHealth !== undefined && newOppHealth !== undefined && newOppHealth < oldOppHealth) {
                            // Opponent was hit
                            const oppPlayer = message.data.players[playerId];
                            if (oppPlayer) {
                                this.createImpactEffect(oppPlayer.x, oppPlayer.y, '#00BFFF');
                                
                                                // Check for combo/chain kill
                                const attacker = message.data.players[this.playerId];
                                if (attacker && attacker.combo_count > 1) {
                                    const screenX = this.centerX + oppPlayer.x * this.scale;
                                    const screenY = this.centerY + oppPlayer.y * this.scale;
                                    this.showComboNotification(`COMBO x${attacker.combo_count}!`, screenX, screenY);
                                    this.playSound('combo');
                                    // Increase style meter on combos
                                    this.styleMeter = Math.min(100, this.styleMeter + 20 * attacker.combo_count);
                                }
                            }
                        }
                    }
                });
                
                this.gameState = message.data;
                this.lastStateUpdate = Date.now(); // Track when state was received
                this.interpolationBuffer.push({
                    state: message.data,
                    timestamp: performance.now()
                });
                // Keep only last 3 states for interpolation
                if (this.interpolationBuffer.length > 3) {
                    this.interpolationBuffer.shift();
                }
                this.updateUI();
                
                // Update lobby player slots from game state if in lobby
                if (this.screenManager.getCurrentScreen() === 'lobby') {
                    this.updateLobbyFromGameState(message.data);
                }
                
                // Handle countdown display
                if (message.data.match_state === 'countdown' && message.data.countdown !== null && message.data.countdown !== undefined) {
                    this.showCountdown(message.data.countdown);
                } else if (message.data.match_state !== 'countdown') {
                    // Countdown ended - hide the overlay
                    const countdownOverlay = document.getElementById('countdown-overlay');
                    if (countdownOverlay) {
                        countdownOverlay.classList.add('hidden');
                    }
                }
                break;
        }
    }
    
    showMessage(text, color = '#00ffaa', duration = 2000) {
        // Use round-end screen for messages
        const roundEndScreen = document.getElementById('screen-round-end');
        const roundEndText = document.getElementById('round-end-text');
        
        if (roundEndScreen && roundEndText) {
            roundEndText.textContent = text;
            roundEndText.style.color = color;
            roundEndScreen.classList.add('active');
            
            if (duration > 0) {
                setTimeout(() => {
                    roundEndScreen.classList.remove('active');
                }, duration);
            }
        } else {
            // Fallback: console log if element doesn't exist
            console.log(`Message: ${text}`);
        }
    }
    
    showCountdown(countdown) {
        // Show countdown overlay on gameplay screen (not round-end screen)
        const countdownOverlay = document.getElementById('countdown-overlay');
        const countdownText = document.getElementById('countdown-text');
        
        if (countdownOverlay && countdownText) {
            if (countdown > 0) {
                countdownText.textContent = countdown.toString();
                countdownOverlay.classList.remove('hidden');
            } else if (countdown === 0) {
                // Show "GO!" and then hide
                countdownText.textContent = 'GO!';
                countdownOverlay.classList.remove('hidden');
                // Hide after "GO!" animation
                setTimeout(() => {
                    if (countdownOverlay) {
                        countdownOverlay.classList.add('hidden');
                    }
                }, 800);
            } else {
                // Countdown is null or < 0 - hide it
                countdownOverlay.classList.add('hidden');
            }
        }
    }
    
    updateScores(scores) {
        // Update score display if available
        const scoreDisplay = document.getElementById('scores');
        if (scoreDisplay) {
            const scoreText = Object.entries(scores)
                .map(([pid, wins]) => `${pid.substring(0, 8)}: ${wins}`)
                .join(' vs ');
            scoreDisplay.textContent = scoreText;
        }
    }
    
    handleMatchEnd(message) {
        const isWinner = message.winner === this.playerId;
        
        // Show match end screen with stats
        this.screenManager.show('matchEnd');
        
        const titleEl = document.getElementById('match-end-title');
        const scoreEl = document.getElementById('match-end-score');
        const statsEl = document.getElementById('match-end-stats');
        
        if (titleEl) {
            titleEl.textContent = isWinner ? '🏆 VICTORY 🏆' : '💀 DEFEAT 💀';
            titleEl.style.color = isWinner ? '#00FFAA' : '#FF0066';
        }
        
        if (scoreEl && message.scores) {
            const myScore = message.scores[this.playerId] || 0;
            const oppId = Object.keys(message.scores).find(id => id !== this.playerId);
            const oppScore = oppId ? (message.scores[oppId] || 0) : 0;
            scoreEl.textContent = `Final Score: ${myScore}-${oppScore}`;
        }
        
        // Display detailed stats
        if (statsEl && message.player_stats) {
            const myStats = message.player_stats[this.playerId] || {};
            const statsHtml = `
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Hits Landed:</span>
                        <span class="stat-value">${myStats.hits_landed || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Accuracy:</span>
                        <span class="stat-value">${myStats.accuracy || 0}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Perfect Dashes:</span>
                        <span class="stat-value">${myStats.perfect_dashes || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Combos:</span>
                        <span class="stat-value">${myStats.combo_count || 0}</span>
                    </div>
                </div>
            `;
            statsEl.innerHTML = statsHtml;
        }
    }
    
    setupMobileControls() {
        // Detect if touch device
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        if (isTouchDevice) {
            const mobileControls = document.getElementById('mobile-controls');
            if (mobileControls) {
                mobileControls.classList.add('active');
            }
        }
        
        // Virtual Joystick
        const joystick = document.getElementById('joystick');
        const joystickStick = document.getElementById('joystick-stick');
        
        if (joystick && joystickStick) {
            let joystickActive = false;
            let joystickCenterX = 60;
            let joystickCenterY = 60;
            
            const updateJoystick = (touchX, touchY) => {
                const rect = joystick.getBoundingClientRect();
                const centerX = rect.left + 60;
                const centerY = rect.top + 60;
                
                let dx = touchX - centerX;
                let dy = touchY - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const maxDistance = 30;
                
                if (distance > maxDistance) {
                    dx = (dx / distance) * maxDistance;
                    dy = (dy / distance) * maxDistance;
                }
                
                joystickStick.style.left = (60 + dx) + 'px';
                joystickStick.style.top = (60 + dy) + 'px';
                
                // Update input state
                const deadzone = 5;
                if (Math.abs(dx) > deadzone || Math.abs(dy) > deadzone) {
                    this.inputState.w = dy < -deadzone;
                    this.inputState.s = dy > deadzone;
                    this.inputState.a = dx < -deadzone;
                    this.inputState.d = dx > deadzone;
                } else {
                    this.inputState.w = false;
                    this.inputState.s = false;
                    this.inputState.a = false;
                    this.inputState.d = false;
                }
            };
            
            const resetJoystick = () => {
                joystickStick.style.left = '30px';
                joystickStick.style.top = '30px';
                this.inputState.w = false;
                this.inputState.s = false;
                this.inputState.a = false;
                this.inputState.d = false;
            };
            
            joystick.addEventListener('touchstart', (e) => {
                e.preventDefault();
                joystickActive = true;
                updateJoystick(e.touches[0].clientX, e.touches[0].clientY);
            });
            
            joystick.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (joystickActive) {
                    updateJoystick(e.touches[0].clientX, e.touches[0].clientY);
                }
            });
            
            joystick.addEventListener('touchend', (e) => {
                e.preventDefault();
                joystickActive = false;
                resetJoystick();
            });
        }
        
        // Shoot Button
        const btnShoot = document.getElementById('btn-mobile-shoot');
        if (btnShoot) {
            btnShoot.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.inputState.shoot = true;
            });
            
            btnShoot.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.inputState.shoot = false;
            });
        }
        
        // Dash Button
        const btnDash = document.getElementById('btn-mobile-dash');
        if (btnDash) {
            btnDash.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.inputState.dash = true;
            });
            
            btnDash.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.inputState.dash = false;
            });
        }
    }
    
    setupInputHandlers() {
        // Prevent default for game keys first
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Keyboard input - handle keydown
        window.addEventListener('keydown', (e) => {
            const key = this.normalizeKey(e.key);
            if (key && !this.keys[key]) {
                this.keys[key] = true;
                this.updateInputState();
                this.sendInput(); // Send immediately on key change
            }
        }, { passive: false });
        
        // Keyboard input - handle keyup
        window.addEventListener('keyup', (e) => {
            const key = this.normalizeKey(e.key);
            if (key && this.keys[key]) {
                this.keys[key] = false;
                this.updateInputState();
                this.sendInput(); // Send immediately on key change
            }
        });
        
        // Also handle keydown repeatedly for held keys
        window.addEventListener('keydown', (e) => {
            const key = this.normalizeKey(e.key);
            if (key) {
                this.keys[key] = true;
                this.updateInputState();
            }
        }, { passive: false });
    }
    
    normalizeKey(key) {
        // Normalize key names for consistent handling
        const lower = key.toLowerCase();
        if (lower === 'shift' || lower === 'shiftleft' || lower === 'shiftright') {
            return 'shift';
        }
        if (lower === ' ') {
            return ' ';
        }
        if (lower === 'arrowup') return 'w';
        if (lower === 'arrowdown') return 's';
        if (lower === 'arrowleft') return 'a';
        if (lower === 'arrowright') return 'd';
        return lower;
    }
    
    updateInputState() {
        this.inputState.w = this.keys['w'] || false;
        this.inputState.a = this.keys['a'] || false;
        this.inputState.s = this.keys['s'] || false;
        this.inputState.d = this.keys['d'] || false;
        this.inputState.shoot = this.keys[' '] || false;
        this.inputState.dash = this.keys['shift'] || false;
    }
    
    sendInput() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Throttle to prevent too many messages
            const now = Date.now();
            if (!this.lastInputSend || now - this.lastInputSend >= 33) { // ~30Hz
                this.lastInputSend = now;
                try {
                    this.ws.send(JSON.stringify({
                        type: 'input',
                        inputs: this.inputState
                    }));
                } catch (e) {
                    console.error('Error sending input:', e);
                }
            }
        }
    }
    
    updateLobbyOnConnect() {
        // Update player 1 slot when we connect
        const status1 = document.getElementById('status-player-1');
        const indicator1 = document.querySelector('#slot-player-1 .slot-indicator');
        const slot1 = document.getElementById('slot-player-1');
        
        if (status1 && this.playerId) {
            status1.textContent = this.playerId.substring(0, 8);
        }
        if (indicator1) {
            indicator1.textContent = '✅';
        }
        if (slot1) {
            slot1.classList.add('ready');
        }
    }
    
    updateLobbyFromPlayers(playersArray) {
        // Update lobby slots from player list
        console.log('updateLobbyFromPlayers called with:', playersArray);
        if (!playersArray || !Array.isArray(playersArray)) {
            console.warn('Invalid playersArray:', playersArray);
            return;
        }
        
        console.log(`Updating lobby for ${playersArray.length} players`);
        
        const status1 = document.getElementById('status-player-1');
        const status2 = document.getElementById('status-player-2');
        const indicator1 = document.querySelector('#slot-player-1 .slot-indicator');
        const indicator2 = document.querySelector('#slot-player-2 .slot-indicator');
        const slot1 = document.getElementById('slot-player-1');
        const slot2 = document.getElementById('slot-player-2');
        
        // Update slot 1
        if (playersArray.length > 0) {
            const p1 = playersArray[0];
            const isMe = p1.id === this.playerId;
            if (status1) {
                status1.textContent = isMe ? 'You' : (p1.name || p1.id.substring(0, 8));
            }
            if (indicator1) {
                indicator1.textContent = '✅';
            }
            if (slot1) {
                slot1.classList.add('ready');
                slot1.classList.remove('disconnected');
            }
        } else {
            if (status1) status1.textContent = 'Waiting...';
            if (indicator1) indicator1.textContent = '⏳';
            if (slot1) {
                slot1.classList.remove('ready');
                slot1.classList.remove('disconnected');
            }
        }
        
        // Update slot 2
        if (playersArray.length > 1) {
            const p2 = playersArray[1];
            const isMe = p2.id === this.playerId;
            if (status2) {
                status2.textContent = isMe ? 'You' : (p2.name || p2.id.substring(0, 8));
            }
            if (indicator2) {
                indicator2.textContent = '✅';
            }
            if (slot2) {
                slot2.classList.add('ready');
                slot2.classList.remove('disconnected');
            }
        } else {
            if (status2) status2.textContent = 'Waiting...';
            if (indicator2) indicator2.textContent = '⏳';
            if (slot2) {
                slot2.classList.remove('ready');
                slot2.classList.remove('disconnected');
            }
        }
        
        // Show start button for host when 2 players
        if (playersArray.length >= 2 && this.isHost) {
            const btnStart = document.getElementById('btn-start-match');
            if (btnStart) {
                btnStart.classList.remove('hidden');
            }
        }
    }
    
    updateLobbyFromGameState(gameState) {
        // Update lobby slots based on actual players in game state
        if (!gameState || !gameState.players) return;
        
        const playerIds = Object.keys(gameState.players);
        const playerArray = playerIds.map(id => ({
            id: id,
            name: id.substring(0, 8),
            ...gameState.players[id]
        }));
        
        // Use the shared update function
        this.updateLobbyFromPlayers(playerArray);
    }
    
    updateUI() {
        if (!this.gameState || !this.playerId || this.screenManager.getCurrentScreen() !== 'gameplay') return;
        
        const player = this.gameState.players[this.playerId];
        const opponent = Object.values(this.gameState.players).find(p => p.id !== this.playerId);
        
        // Update HP displays
        const hp1 = document.getElementById('hp-player-1');
        const hp2 = document.getElementById('hp-player-2');
        
        if (player && hp1) {
            const hp = player.health;
            hp1.textContent = '⚪'.repeat(hp) + '⚫'.repeat(3 - hp);
        }
        
        if (opponent && hp2) {
            const hp = opponent.health;
            hp2.textContent = '⚪'.repeat(hp) + '⚫'.repeat(3 - hp);
        }
        
        // Update scores
        if (this.gameState.scores) {
            const myScore = this.gameState.scores[this.playerId] || 0;
            const oppScore = opponent ? (this.gameState.scores[opponent.id] || 0) : 0;
            const hudScore = document.getElementById('hud-score');
            if (hudScore) {
                hudScore.textContent = `Score: ${myScore}-${oppScore}`;
            }
        }
        
        // Update round number
        if (this.gameState.round_number !== undefined) {
            const hudRound = document.getElementById('hud-round');
            if (hudRound) {
                hudRound.textContent = `Round: ${this.gameState.round_number}`;
            }
        }
        
        // Update arena event display
        if (this.gameState.arena_event) {
            const eventDisplay = document.getElementById('arena-event-display');
            if (eventDisplay) {
                const eventNames = {
                    'low_gravity': 'LOW GRAVITY',
                    'fast_mode': 'FAST MODE',
                    'shrinking': 'SHRINKING ARENA',
                    'invert_controls': 'INVERTED CONTROLS'
                };
                eventDisplay.textContent = eventNames[this.gameState.arena_event] || this.gameState.arena_event.toUpperCase();
            }
        }
        
        // Show round end
        if (this.gameState.round_winner && !this.gameState.round_active) {
            this.screenManager.show('roundEnd');
            const winnerIsMe = this.gameState.round_winner === this.playerId;
            const textEl = document.getElementById('round-end-text');
            if (textEl) {
                textEl.textContent = winnerIsMe ? 'YOU WIN!' : 'YOU LOSE!';
                textEl.style.color = winnerIsMe ? '#00FFAA' : '#FF0066';
            }
        }
        
        // Show match end
        if (this.gameState.winner && this.gameState.match_state === 'match_end') {
            this.screenManager.show('matchEnd');
            const winnerIsMe = this.gameState.winner === this.playerId;
            const titleEl = document.getElementById('match-end-title');
            const scoreEl = document.getElementById('match-end-score');
            
            if (titleEl) {
                titleEl.textContent = winnerIsMe ? '🏆 VICTORY 🏆' : '💀 DEFEAT 💀';
                titleEl.style.color = winnerIsMe ? '#00FFAA' : '#FF0066';
            }
            
            if (scoreEl && this.gameState.scores) {
                const myScore = this.gameState.scores[this.playerId] || 0;
                const oppScore = Object.values(this.gameState.scores).find((s, i, arr) => 
                    Object.keys(this.gameState.scores)[i] !== this.playerId) || 0;
                scoreEl.textContent = `Final Score: ${myScore}-${oppScore}`;
            }
        }
    }
    
    showArenaEvent(eventName) {
        const eventNames = {
            'low_gravity': 'Low Gravity',
            'fast_mode': 'Fast Mode',
            'shrinking': 'Shrinking Arena',
            'invert_controls': 'Inverted Controls',
            'reverse_gravity': 'Reverse Gravity',
            'double_dash': 'Double Dash',
            'darkness': 'Darkness',
            'shrink_zone': 'Shrink Zone'
        };
        
        const displayName = eventNames[eventName] || eventName;
        const eventEl = document.getElementById('arena-event-display');
        
        // Check if element exists before accessing it
        if (!eventEl) {
            console.warn('Arena event display element not found');
            return;
        }
        
        eventEl.textContent = `Event: ${displayName}`;
        
        // Flash animation
        eventEl.style.animation = 'none';
        setTimeout(() => {
            if (eventEl) {
                eventEl.style.animation = 'flash 0.5s ease';
            }
        }, 10);
    }
    
    render() {
        requestAnimationFrame(() => this.render());
        
        // Only render if we have canvas and are in gameplay screen
        if (!this.canvas || !this.ctx || this.screenManager.getCurrentScreen() !== 'gameplay') {
            return;
        }
        
        const now = performance.now();
        const dt = (now - this.lastRenderTime) / 1000;
        this.lastRenderTime = now;
        this.renderTime += dt;
        
        // Apply screen shake
        const shakeOffsetX = this.screenShake.x;
        const shakeOffsetY = this.screenShake.y;
        this.ctx.save();
        this.ctx.translate(shakeOffsetX, shakeOffsetY);
        
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Only show waiting if we don't have game state yet
        if (!this.gameState) {
            this.ctx.restore();
            this.ctx.fillStyle = '#00ffaa';
            this.ctx.font = '24px JetBrains Mono';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Connecting...', this.centerX, this.centerY);
            return;
        }
        
        // If match is active or in countdown, just render the game
        // Don't check player count - trust the server
        if (!this.gameState.match_active && this.gameState.match_state === 'waiting') {
            // Only show waiting screen if truly in lobby (not playing)
            this.ctx.restore();
            this.ctx.fillStyle = '#00ffaa';
            this.ctx.font = '24px JetBrains Mono';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('In Lobby - Click START MATCH', this.centerX, this.centerY);
            return;
        }
        
        // Get interpolated state
        const state = this.getInterpolatedState();
        if (!state) {
            this.ctx.restore();
            return;
        }
        
        const arenaRadius = state.arena_radius || 400;
        const currentTime = Date.now();
        
        // Update visual effects
        this.updateVisualEffects(state, currentTime);
        
        // Draw background particles
        this.drawBackgroundParticles(arenaRadius);
        
        // Draw arena (with gradient and glow)
        this.drawArena(arenaRadius, state.arena_event, state);
        
        // Draw grid (subtle)
        this.drawGrid(arenaRadius);
        
        // Draw player trails
        this.drawPlayerTrails();
        
        // Draw dash streaks
        this.drawDashEffects();
        
        // Draw power-ups
        if (state.powerups) {
            state.powerups.forEach(powerup => {
                this.drawPowerUp(powerup);
            });
        }
        
        // Draw bullets (with trails)
        if (state.bullets) {
            state.bullets.forEach(bullet => {
                this.drawBullet(bullet, state.players);
            });
        }
        
        // Draw bullet trails
        this.drawBulletTrails();
        
        // Draw particles (impacts, etc.)
        this.drawParticles();
        
        // Draw players (with glow and HP indicators)
        Object.values(state.players).forEach(player => {
            const isMe = player.id === this.playerId;
            this.drawPlayer(player, isMe, state);
        });
        
        // Draw impact effects
        this.drawImpactEffects();
        
        // Draw combo notifications
        this.drawComboNotifications();
        
        this.ctx.restore();
        
        // Update last positions for trails
        Object.values(state.players).forEach(player => {
            this.lastPlayerPositions[player.id] = {x: player.x, y: player.y};
        });
    }
    
    getInterpolatedState() {
        if (!this.gameState) return null;
        
        // Client-side prediction: apply local movement to our player
        const predictedState = JSON.parse(JSON.stringify(this.gameState)); // Deep copy
        
        if (predictedState.players[this.playerId]) {
            const myPlayer = predictedState.players[this.playerId];
            const lastUpdateTime = this.lastStateUpdate || Date.now();
            const dt = (Date.now() - lastUpdateTime) / 1000;
            
            // Apply prediction based on current inputs
            if (this.inputState.w || this.inputState.a || this.inputState.s || this.inputState.d) {
                let moveX = 0, moveY = 0;
                if (this.inputState.w) moveY -= 1;
                if (this.inputState.s) moveY += 1;
                if (this.inputState.a) moveX -= 1;
                if (this.inputState.d) moveX += 1;
                
                // Normalize
                const length = Math.sqrt(moveX * moveX + moveY * moveY);
                if (length > 0) {
                    moveX /= length;
                    moveY /= length;
                    
                    // Apply speed (same as server: 200 or 400 for dash)
                    const speed = this.inputState.dash ? 400 : 200;
                    const dx = moveX * speed * dt;
                    const dy = moveY * speed * dt;
                    
                    // Update position (will be corrected by server)
                    myPlayer.x += dx;
                    myPlayer.y += dy;
                    myPlayer.angle = Math.atan2(moveY, moveX);
                }
            }
        }
        
        return predictedState;
    }
    
    updateVisualEffects(state, now) {
        // Update screen shake
        if (this.screenShake.time > 0) {
            this.screenShake.time -= 16; // ~60fps
            const intensity = this.screenShake.time / 100;
            this.screenShake.x = (Math.random() - 0.5) * intensity;
            this.screenShake.y = (Math.random() - 0.5) * intensity;
            if (this.screenShake.time <= 0) {
                this.screenShake.x = 0;
                this.screenShake.y = 0;
            }
        }
        
        // Update player trails
        Object.keys(this.playerTrails).forEach(playerId => {
            if (!state.players[playerId]) {
                delete this.playerTrails[playerId];
                return;
            }
            
            const player = state.players[playerId];
            const lastPos = this.lastPlayerPositions[playerId];
            
            if (lastPos) {
                const dx = player.x - lastPos.x;
                const dy = player.y - lastPos.y;
                const moved = Math.sqrt(dx * dx + dy * dy) > 1;
                
                if (moved) {
                    if (!this.playerTrails[playerId]) {
                        this.playerTrails[playerId] = [];
                    }
                    this.playerTrails[playerId].push({
                        x: player.x,
                        y: player.y,
                        time: now,
                        opacity: 0.4
                    });
                }
            }
            
            // Clean old trails
            this.playerTrails[playerId] = this.playerTrails[playerId].filter(trail => now - trail.time < 200);
        });
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.life -= 16;
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
            return p.life > 0;
        });
        
        // Update impact effects
        this.impactEffects = this.impactEffects.filter(effect => {
            effect.time -= 16;
            return effect.time > 0;
        });
        
        // Update dash effects
        this.dashEffects = this.dashEffects.filter(effect => {
            effect.time -= 16;
            return effect.time > 0;
        });
        
        // Check for new dashes
        Object.values(state.players).forEach(player => {
            if (player.dash_active) {
                const lastDashTime = this.lastDashTimes[player.id] || 0;
                if (now - lastDashTime > 100) {
                    this.lastDashTimes[player.id] = now;
                    this.dashEffects.push({
                        x: player.x,
                        y: player.y,
                        angle: player.angle,
                        time: 150,
                        playerId: player.id
                    });
                    
                    // Add screen shake
                    this.screenShake.time = 100;
                }
            }
        });
    }
    
    drawBackgroundParticles(arenaRadius) {
        this.ctx.fillStyle = 'rgba(0, 191, 255, 0.15)';
        this.backgroundParticles.forEach(p => {
            const screenX = this.centerX + p.x * this.scale;
            const screenY = this.centerY + p.y * this.scale;
            
            // Only draw if within arena
            const dist = Math.sqrt(p.x * p.x + p.y * p.y);
            if (dist < arenaRadius) {
                this.ctx.globalAlpha = p.opacity;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, p.size * this.scale, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
        this.ctx.globalAlpha = 1;
    }
    
    drawArena(arenaRadius, arenaEvent, state) {
        const centerX = this.centerX;
        const centerY = this.centerY;
        const radius = arenaRadius * this.scale;
        
        // Draw arena base (gradient fill)
        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, '#0D0D12');
        gradient.addColorStop(0.7, '#050508');
        gradient.addColorStop(1, '#000000');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Determine glow color based on event
        let glowColor = '#00BFFF'; // Electric Blue default
        if (arenaEvent === 'shrinking' || arenaEvent === 'shrink_zone' || arenaEvent === 'sudden_death') {
            glowColor = '#FF0066'; // Red when shrinking or sudden-death
        } else if (arenaEvent === 'fast_mode') {
            glowColor = '#C77DFF'; // Purple for fast mode
        } else if (arenaEvent === 'reverse_gravity') {
            glowColor = '#FFFF00'; // Yellow for reverse gravity
        } else if (arenaEvent === 'double_dash') {
            glowColor = '#00FFAA'; // Green for double dash
        } else if (arenaEvent === 'darkness') {
            glowColor = '#330033'; // Dark purple for darkness
        }
        
        // Arena health-based pulsing (more red glow when players have low HP)
        const players = state?.players || {};
        let minHealth = 3;
        Object.values(players).forEach(p => {
            if (p.health < minHealth) minHealth = p.health;
        });
        
        // Add red tint based on low HP
        if (minHealth < 2) {
            const redIntensity = (3 - minHealth) * 0.3;
            const redComponent = Math.floor(255 * redIntensity);
            glowColor = `rgb(${redComponent}, ${glowColor === '#FF0066' ? '0' : '100'}, ${glowColor === '#FF0066' ? '102' : '255'})`;
        }
        
        // Pulse effect (sin wave)
        const pulseIntensity = 0.05;
        const pulse = Math.sin(this.renderTime * 2) * pulseIntensity + 1;
        const pulseRadius = radius * pulse;
        
        // Draw glowing border with shadow
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = glowColor;
        this.ctx.strokeStyle = glowColor;
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Inner glow ring
        this.ctx.shadowBlur = 30;
        this.ctx.strokeStyle = glowColor;
        this.ctx.lineWidth = 4;
        this.ctx.globalAlpha = 0.5;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, pulseRadius * 0.95, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 0;
        
        // Draw arena event visuals
        if (arenaEvent === 'fast_mode') {
            // Lightning arcs
            const arcCount = 3;
            for (let i = 0; i < arcCount; i++) {
                const angle = (this.renderTime * 0.5 + i * Math.PI * 2 / arcCount) % (Math.PI * 2);
                const startX = centerX + Math.cos(angle) * radius * 0.8;
                const startY = centerY + Math.sin(angle) * radius * 0.8;
                const endX = centerX + Math.cos(angle) * radius * 0.95;
                const endY = centerY + Math.sin(angle) * radius * 0.95;
                
                this.ctx.strokeStyle = 'rgba(199, 125, 255, 0.6)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();
            }
        } else if (arenaEvent === 'low_gravity' || arenaEvent === 'reverse_gravity') {
            // Floating particles drifting upward
            const particleCount = 8;
            const driftDirection = arenaEvent === 'reverse_gravity' ? -1 : 1;
            for (let i = 0; i < particleCount; i++) {
                const angle = (this.renderTime * 0.3 + i * Math.PI * 2 / particleCount) % (Math.PI * 2);
                const dist = 0.6 + (i % 2) * 0.2;
                const px = centerX + Math.cos(angle) * radius * dist;
                const py = centerY + Math.sin(angle) * radius * dist - driftDirection * (this.renderTime * 15) % (radius * 0.4);
                
                this.ctx.fillStyle = arenaEvent === 'reverse_gravity' ? 'rgba(255, 255, 0, 0.5)' : 'rgba(255, 255, 255, 0.4)';
                this.ctx.beginPath();
                this.ctx.arc(px, py, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        } else if (arenaEvent === 'darkness') {
            // Darken arena except near players
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    drawGrid(arenaRadius) {
        this.ctx.strokeStyle = 'rgba(51, 51, 51, 0.3)';
        this.ctx.lineWidth = 1;
        
        const gridSize = 100;
        const start = -arenaRadius;
        const end = arenaRadius;
        
        // Vertical lines
        for (let x = start; x <= end; x += gridSize) {
            this.ctx.beginPath();
            const screenX = this.centerX + x * this.scale;
            if (screenX >= 0 && screenX <= this.canvas.width) {
                this.ctx.moveTo(screenX, this.centerY - arenaRadius * this.scale);
                this.ctx.lineTo(screenX, this.centerY + arenaRadius * this.scale);
                this.ctx.stroke();
            }
        }
        
        // Horizontal lines
        for (let y = start; y <= end; y += gridSize) {
            this.ctx.beginPath();
            const screenY = this.centerY + y * this.scale;
            if (screenY >= 0 && screenY <= this.canvas.height) {
                this.ctx.moveTo(this.centerX - arenaRadius * this.scale, screenY);
                this.ctx.lineTo(this.centerX + arenaRadius * this.scale, screenY);
                this.ctx.stroke();
            }
        }
    }
    
    drawPlayerTrails() {
        Object.keys(this.playerTrails).forEach(playerId => {
            const trails = this.playerTrails[playerId];
            if (!trails || trails.length < 2) return;
            
            const isMe = playerId === this.playerId;
            const color = isMe ? 'rgba(0, 191, 255, ' : 'rgba(199, 125, 255, ';
            
            for (let i = 0; i < trails.length - 1; i++) {
                const trail = trails[i];
                const nextTrail = trails[i + 1];
                const age = (Date.now() - trail.time) / 200;
                const opacity = Math.max(0, (1 - age) * 0.3);
                
                const x1 = this.centerX + trail.x * this.scale;
                const y1 = this.centerY + trail.y * this.scale;
                const x2 = this.centerX + nextTrail.x * this.scale;
                const y2 = this.centerY + nextTrail.y * this.scale;
                
                this.ctx.strokeStyle = color + opacity + ')';
                this.ctx.lineWidth = 3 * this.scale;
                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
            }
        });
    }
    
    drawDashEffects() {
        this.dashEffects.forEach(effect => {
            const progress = 1 - (effect.time / 150);
            const x = this.centerX + effect.x * this.scale;
            const y = this.centerY + effect.y * this.scale;
            
            // Draw motion streak
            const streakLength = 40 * this.scale;
            const startX = x - Math.cos(effect.angle) * streakLength * progress;
            const startY = y - Math.sin(effect.angle) * streakLength * progress;
            
            this.ctx.strokeStyle = `rgba(0, 191, 255, ${0.5 * (1 - progress)})`;
            this.ctx.lineWidth = 6 * this.scale;
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            // Draw burst effect
            this.ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * (1 - progress)})`;
            this.ctx.shadowBlur = 20 * (1 - progress);
            this.ctx.shadowColor = '#00BFFF';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 10 * this.scale * (1 - progress), 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }
    
    drawPlayer(player, isMe, state) {
        const x = this.centerX + player.x * this.scale;
        const y = this.centerY + player.y * this.scale;
        const baseRadius = 15 * this.scale;
        
        // Player colors
        const playerColor = isMe ? '#00BFFF' : '#C77DFF'; // Electric Blue vs Neon Purple
        const glowColor = isMe ? 'rgba(0, 191, 255, ' : 'rgba(199, 125, 255, ';
        
        // Check if invisible
        const currentTime = Date.now() / 1000;
        const isInvisible = player.invisible_until && currentTime < player.invisible_until;
        if (isInvisible) {
            // Only show faint outline when invisible
            this.ctx.strokeStyle = playerColor + '40';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, baseRadius * 1.2, 0, Math.PI * 2);
            this.ctx.stroke();
            return;  // Don't draw full player when invisible
        }
        
        // Idle pulse animation
        const pulse = Math.sin(this.renderTime * 3) * 0.025 + 1;
        const radius = baseRadius * pulse;
        
        // Draw outer glow ring
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = playerColor;
        this.ctx.strokeStyle = playerColor;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 1.2, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw player core
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, playerColor);
        gradient.addColorStop(0.5, playerColor + '80');
        gradient.addColorStop(1, playerColor + '00');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Inner bright core
        this.ctx.fillStyle = playerColor;
        this.ctx.globalAlpha = 0.8;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
        
        // Direction indicator (shorter line)
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(
            x + Math.cos(player.angle) * radius * 1.3,
            y + Math.sin(player.angle) * radius * 1.3
        );
        this.ctx.stroke();
        
        this.ctx.shadowBlur = 0;
        
        // Draw HP indicator (3 dots above player)
        const hpY = y - radius - 15;
        const dotSize = 4 * this.scale;
        const dotSpacing = 8 * this.scale;
        const startX = x - dotSpacing;
        
        for (let i = 0; i < 3; i++) {
            const dotX = startX + i * dotSpacing;
            const isAlive = player.health > i;
            
            if (isAlive) {
                this.ctx.fillStyle = playerColor;
                this.ctx.shadowBlur = 5;
                this.ctx.shadowColor = playerColor;
            } else {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                this.ctx.shadowBlur = 0;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(dotX, hpY, dotSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.shadowBlur = 0;
        
        // Draw dash burst effect
        if (player.dash_active) {
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.lineWidth = 3;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#FFFF00';
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        // Draw shield effect (blue ring)
        if (player.shields > 0) {
            this.ctx.strokeStyle = '#0066FF';
            this.ctx.lineWidth = 4;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#0066FF';
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius * 1.3, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        // Draw power-up indicator with golden glow for speed boost
        if (player.active_powerup && currentTime < player.powerup_end_time) {
            // Golden pulsing ring for speed boost
            if (player.active_powerup === 'speed_boost') {
                this.ctx.save();
                this.ctx.strokeStyle = '#FFAA00';
                this.ctx.lineWidth = 3;
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#FFAA00';
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 10 + Math.sin(currentTime / 100) * 3, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.restore();
            }
            
            const powerIcons = {
                'speed_boost': '⚡',
                'double_shot': '💥',
                'shield': '💎',
                'invisibility': '💫',
                'ricochet': '🌀'
            };
            const icon = powerIcons[player.active_powerup] || '?';
            const iconY = y - radius - 20;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(icon, x, iconY);
        }
    }
    
    drawBulletTrails() {
        Object.keys(this.bulletTrails).forEach(bulletId => {
            const trails = this.bulletTrails[bulletId];
            if (!trails || trails.length < 2) return;
            
            // Get bullet color from shooter (try to match by position or owner_id)
            let isMe = false;
            if (this.gameState?.bullets) {
                const bullet = this.gameState.bullets.find(b => {
                    const bid = b.id || `${b.x}_${b.y}_${b.owner_id}`;
                    return bid === bulletId;
                });
                if (bullet) {
                    const shooter = Object.values(this.gameState?.players || {}).find(p => p.id === bullet.owner_id);
                    isMe = shooter?.id === this.playerId;
                }
            }
            const color = isMe ? 'rgba(0, 191, 255, ' : 'rgba(199, 125, 255, ';
            
            for (let i = 0; i < trails.length - 1; i++) {
                const trail = trails[i];
                const nextTrail = trails[i + 1];
                const age = (Date.now() - trail.time) / 100;
                const opacity = Math.max(0, (1 - age) * 0.5);
                
                const x1 = this.centerX + trail.x * this.scale;
                const y1 = this.centerY + trail.y * this.scale;
                const x2 = this.centerX + nextTrail.x * this.scale;
                const y2 = this.centerY + nextTrail.y * this.scale;
                
                this.ctx.strokeStyle = color + opacity + ')';
                this.ctx.lineWidth = 2 * this.scale;
                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
            }
        });
    }
    
    drawBullet(bullet, players) {
        const x = this.centerX + bullet.x * this.scale;
        const y = this.centerY + bullet.y * this.scale;
        const radius = 6 * this.scale;
        
        // Get shooter color
        const shooter = Object.values(players || {}).find(p => p.id === bullet.owner_id);
        const isMe = shooter?.id === this.playerId;
        const bulletColor = isMe ? '#00BFFF' : '#C77DFF';
        
        // Calculate angle from velocity
        const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
        const angle = speed > 0 ? Math.atan2(bullet.vy, bullet.vx) : 0;
        
        // Draw bullet trail
        const vx = Math.cos(angle);
        const vy = Math.sin(angle);
        const trailLength = 15 * this.scale;
        const startX = x - vx * trailLength;
        const startY = y - vy * trailLength;
        
        const gradient = this.ctx.createLinearGradient(startX, startY, x, y);
        gradient.addColorStop(0, bulletColor + '00');
        gradient.addColorStop(1, bulletColor + 'FF');
        
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 3 * this.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        
        // Draw bullet core
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = bulletColor;
        this.ctx.fillStyle = bulletColor;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Bright center
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.globalAlpha = 0.9;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 0;
        
        // Add to trail (use position-based ID if bullet.id doesn't exist)
        const bulletId = bullet.id || `${bullet.x}_${bullet.y}_${bullet.owner_id}`;
        if (!this.bulletTrails[bulletId]) {
            this.bulletTrails[bulletId] = [];
        }
        this.bulletTrails[bulletId].push({
            x: bullet.x,
            y: bullet.y,
            time: Date.now(),
            opacity: 0.6
        });
        
        // Clean old trails
        this.bulletTrails[bulletId] = this.bulletTrails[bulletId].filter(t => Date.now() - t.time < 100);
    }
    
    drawParticles() {
        this.particles.forEach(p => {
            const progress = 1 - (p.life / p.maxLife);
            const x = this.centerX + p.x * this.scale;
            const y = this.centerY + p.y * this.scale;
            
            this.ctx.fillStyle = p.color + Math.floor((1 - progress) * 255).toString(16).padStart(2, '0');
            this.ctx.globalAlpha = 1 - progress;
            this.ctx.beginPath();
            this.ctx.arc(x, y, p.size * this.scale * (1 - progress), 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }
    
    drawImpactEffects() {
        this.impactEffects.forEach(effect => {
            const progress = 1 - (effect.time / 200);
            const x = this.centerX + effect.x * this.scale;
            const y = this.centerY + effect.y * this.scale;
            
            // Flash effect
            this.ctx.fillStyle = `rgba(255, 50, 50, ${0.3 * (1 - progress)})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 30 * this.scale * progress, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    drawPowerUp(powerup) {
        if (!powerup || !powerup.x || !powerup.y) return;
        
        const x = this.centerX + powerup.x * this.scale;
        const y = this.centerY + powerup.y * this.scale;
        const radius = 12 * this.scale;
        
        // Power-up colors and icons
        const powerColors = {
            'speed_boost': '#FFFF00',
            'double_shot': '#FF6B00',
            'shield': '#0066FF',
            'invisibility': '#9900FF',
            'ricochet': '#00FF66'
        };
        
        const powerIcons = {
            'speed_boost': '⚡',
            'double_shot': '💥',
            'shield': '💎',
            'invisibility': '💫',
            'ricochet': '🌀'
        };
        
        const color = powerColors[powerup.power_type] || '#FFFFFF';
        const icon = powerIcons[powerup.power_type] || '?';
        
        // Pulsing animation
        const pulse = Math.sin(this.renderTime * 4) * 0.1 + 1;
        
        // Draw glow
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = color;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw core
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.8;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 0.7 * pulse, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw icon (text)
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `${Math.max(10, radius * 0.8 * pulse)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.globalAlpha = 1;
        this.ctx.fillText(icon, x, y);
        
        this.ctx.shadowBlur = 0;
    }
    
    createImpactEffect(x, y, color) {
        // Create impact flash
        this.impactEffects.push({
            x: x,
            y: y,
            time: 200,
            color: color
        });
        
        // Create particle burst
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const speed = 50 + Math.random() * 50;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 300,
                maxLife: 300,
                color: color,
                size: 3 + Math.random() * 2
            });
        }
        
        // Screen shake
        this.screenShake.time = 50;
    }
    
    drawComboNotifications() {
        this.comboNotifications = this.comboNotifications.filter(notif => {
            notif.time -= 16;
            if (notif.time <= 0) return false;
            
            const progress = 1 - (notif.time / 2000);
            const alpha = 1 - progress;
            const y = notif.y - progress * 50;
            
            this.ctx.fillStyle = notif.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            this.ctx.font = 'bold 24px Audiowide';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = notif.color;
            this.ctx.fillText(notif.text, notif.x, y);
            this.ctx.shadowBlur = 0;
            
            return true;
        });
    }
    
    updateConnectionStatus(status) {
        // Safe update - element may not exist in new UI structure
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = status;
        }
        // Update ping indicator if available
        const pingEl = document.getElementById('ping-indicator');
        if (pingEl && status === 'Connected') {
            // Ping will be updated separately
            pingEl.textContent = 'Ping: --';
        }
    }
}

// Initialize client when page loads
let gameClient = null;
window.addEventListener('DOMContentLoaded', () => {
    gameClient = new DuelDomeClient();
});

// Add flash animation
const style = document.createElement('style');
style.textContent = `
    @keyframes flash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }
`;
document.head.appendChild(style);

