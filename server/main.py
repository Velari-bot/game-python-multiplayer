"""
FastAPI WebSocket server for Duel Dome.
"""
import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Dict, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from game import GameState
from arena import ArenaEventManager

# Game state
game_state = GameState()
arena_manager = ArenaEventManager()

# WebSocket connections
connections: Dict[str, WebSocket] = {}
connection_to_player_id: Dict[WebSocket, str] = {}
client_ips: Dict[str, str] = {}  # player_id -> client_ip (to prevent multiple tabs)

# Game loop task
game_loop_task: asyncio.Task = None
TICK_RATE = 60  # 60 updates per second for smoother gameplay
TICK_INTERVAL = 1.0 / TICK_RATE


async def game_loop():
    """Main game loop running at TICK_RATE."""
    last_time = time.time()
    
    while True:
        await asyncio.sleep(TICK_INTERVAL)
        current_time = time.time()
        dt = current_time - last_time
        last_time = current_time
        
        # Cap delta time to prevent large jumps
        dt = min(dt, 0.1)
        
        # Update arena events (returns True if new event triggered)
        event_triggered = arena_manager.update(dt, game_state)
        
        # Broadcast new event to all clients if one was triggered
        if event_triggered and connections:
            event_message = json.dumps({
                'type': 'arena_event',
                'event': game_state.arena_event
            })
            for ws in list(connections.values()):
                try:
                    await ws.send_text(event_message)
                except Exception:
                    pass
        
        # Update game state
        game_state.update(dt)
        
        # Auto-suspend if no players for 60s
        if not connections and game_state.last_update:
            if time.time() - game_state.last_update > 60.0:
                # Auto-suspend game loop
                return
        
        # Broadcast game state to all connected clients (during match)
        # Also send lobby state when waiting for match to start
        if connections:
            # Send lobby state when in waiting state (before match starts)
            # Send more frequently (every 500ms) so lobby updates are visible
            if len(game_state.players) >= 1 and game_state.match_state == "waiting" and not game_state.match_active:
                # Only send every 0.5 seconds to avoid spam
                current_time = time.time()
                if not hasattr(game_state, 'last_lobby_update'):
                    game_state.last_lobby_update = 0
                
                if current_time - game_state.last_lobby_update >= 0.5:
                    game_state.last_lobby_update = current_time
                    players_list = [
                        {'id': pid, 'name': pid[:8]} 
                        for pid in game_state.players.keys()
                    ]
                    lobby_update = json.dumps({
                        'type': 'lobby_update',
                        'players': players_list,
                        'players_count': len(game_state.players)
                    })
                    for ws in list(connections.values()):
                        try:
                            await ws.send_text(lobby_update)
                        except Exception:
                            pass
            
            # Broadcast game state during active match
            # CRITICAL: Only remove players in websocket_endpoint's finally block
            # The game loop should NOT aggressively remove players on send failures
            # This prevents removing players prematurely when connections are temporarily unstable
            if game_state.round_active or game_state.match_state in ["countdown", "round_end", "match_end"]:
                state_dict = game_state.to_dict()
                message = json.dumps({
                    'type': 'game_state',
                    'data': state_dict
                })
                
                # Send to all connected clients
                # If send fails, don't immediately remove - connection might recover
                for player_id, ws in list(connections.items()):
                    try:
                        await ws.send_text(message)
                    except Exception as e:
                        # Log but don't remove - websocket_endpoint will handle actual disconnects
                        # This prevents race conditions where a player is removed while still connected
                        print(f"Game loop: Failed to send to {player_id} (might be temporary): {e}")
                        # Don't remove here - let the websocket_endpoint's finally block handle it
            
            # Handle match state transitions
            if game_state.match_state == "countdown" and game_state.countdown == 0:
                # Countdown finished - start round
                pass  # Round is already started by handle_countdown
            
            # Check for round end
            if not game_state.round_active and game_state.round_winner:
                # Round ended - award point and check match end
                if game_state.match_state != "match_end":
                    await asyncio.sleep(2.0)  # Show round end for 2s
                    
                    if len(game_state.players) == 2:
                        # Check if match should end (3 wins)
                        if game_state.check_match_end():
                            # Match over - send stats
                            match_end_message = json.dumps({
                                'type': 'match_end',
                                'winner': game_state.winner,
                                'scores': game_state.scores,
                                'player_stats': game_state.player_stats
                            })
                            for ws in list(connections.values()):
                                try:
                                    await ws.send_text(match_end_message)
                                except Exception:
                                    pass
                            
                            # Wait 10s then reset
                            await asyncio.sleep(10.0)
                            game_state.scores.clear()
                            game_state.round_number = 0
                            game_state.match_active = False
                            game_state.match_state = "waiting"
                        else:
                            # Start new round with event
                            event = arena_manager.trigger_random_event(game_state)
                            game_state.start_round()
                            
                            # Notify clients of new event and round start
                            event_message = json.dumps({
                                'type': 'arena_event',
                                'event': event
                            })
                            round_start_message = json.dumps({
                                'type': 'round_start',
                                'round_number': game_state.round_number,
                                'scores': game_state.scores
                            })
                            for ws in list(connections.values()):
                                try:
                                    await ws.send_text(event_message)
                                    await ws.send_text(round_start_message)
                                except Exception:
                                    pass
            
            # Handle match end state
            if game_state.match_state == "match_end":
                # Match is over, waiting for reset
                pass


def start_game_loop():
    """Start the game loop asyncio task."""
    global game_loop_task
    if game_loop_task is None or game_loop_task.done():
        game_loop_task = asyncio.create_task(game_loop())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for FastAPI."""
    # Startup
    start_game_loop()
    yield
    # Shutdown
    global game_loop_task
    if game_loop_task and not game_loop_task.done():
        game_loop_task.cancel()
        try:
            await game_loop_task
        except asyncio.CancelledError:
            pass


app = FastAPI(lifespan=lifespan)

# CORS configuration for web deployment
# Allow all origins in production, or specify your Vercel domain
allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")

# Add Vercel domain explicitly
if allowed_origins == ["*"]:
    allowed_origins = [
        "*",  # Allow all for development
        "https://game-python-multiplayer.vercel.app",
        "http://localhost:3000",
        "http://localhost:8000"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Handle WebSocket connections."""
    await websocket.accept()
    player_id = None
    
    try:
        # Get client IP to prevent multiple connections
        client_host = websocket.client.host if websocket.client else "unknown"
        
        # Assign player ID FIRST
        player_id = str(uuid.uuid4())
        
        # Check if this IP already has a connection (prevent multiple tabs from same IP)
        # Only disconnect if same IP - different IPs should be allowed
        disconnected_existing = False
        for existing_id, existing_ip in list(client_ips.items()):
            if existing_ip == client_host and existing_id != player_id and existing_id in connections:
                # Same IP trying to connect again - close old connection (duplicate tab)
                print(f"⚠️  Duplicate IP {client_host} detected. Closing old connection {existing_id}")
                try:
                    await connections[existing_id].close()
                except:
                    pass
                # Clean up old connection
                if existing_id in connections:
                    del connections[existing_id]
                if existing_id in client_ips:
                    del client_ips[existing_id]
                # Remove from game state
                game_state.remove_player(existing_id)
                disconnected_existing = True
                print(f"After removing duplicate: {len(game_state.players)} players remaining")
        
        # Now add this connection
        connections[player_id] = websocket
        connection_to_player_id[websocket] = player_id
        client_ips[player_id] = client_host
        
        # Debug: Show current players before adding
        print(f"Before add_player: {len(game_state.players)} players in game_state")
        print(f"Current players: {list(game_state.players.keys())}")
        
        # Add player to game
        can_start = game_state.add_player(player_id)
        
        # Debug: Show current players after adding
        print(f"After add_player: {len(game_state.players)} players in game_state")
        print(f"Current players: {list(game_state.players.keys())}")
        
        # Prepare player list for lobby
        players_list = [
            {'id': str(pid), 'name': str(pid)[:8]} 
            for pid in game_state.players.keys()
        ]
        
        # Send initial connection message
        # Use json.dumps to ensure proper serialization
        connection_message = {
            'type': 'connected',
            'player_id': str(player_id),
            'can_start': bool(can_start),
            'players_count': int(len(game_state.players)),
            'players': players_list  # Make sure this is included
        }
        # Debug: print what we're sending
        print(f"Sending connection message to {player_id}:")
        print(f"  players_list: {players_list}")
        print(f"  players_count: {len(game_state.players)}")
        print(f"  connection_message: {connection_message}")
        
        # Send as JSON string to ensure proper serialization
        await websocket.send_text(json.dumps(connection_message))
        
        # Send lobby update to ALL connected clients when player joins
        # Send immediately so all clients see updated player list
        # IMPORTANT: Send to ALL connections, not just active ones
        lobby_update_data = {
            'type': 'lobby_update',
            'players': players_list,
            'players_count': len(game_state.players),
            'game_code': None
        }
        print(f"Broadcasting lobby update to {len(connections)} connections: {lobby_update_data}")
        lobby_update = json.dumps(lobby_update_data)
        
        sent_count = 0
        for player_id_in_conn, ws in list(connections.items()):
            try:
                await ws.send_text(lobby_update)
                sent_count += 1
                print(f"  ✓ Sent to {player_id_in_conn}")
            except Exception as e:
                print(f"  ✗ Error sending to {player_id_in_conn}: {e}")
        print(f"Successfully sent lobby update to {sent_count}/{len(connections)} connections")
        
        # If we have 2 players, show start button but don't auto-start
        # Host needs to click "START MATCH" button
        # We'll handle start_match message separately
        
        # Handle incoming messages
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get('type')
                
                if msg_type == 'input':
                    # Update player inputs
                    inputs = message.get('inputs', {})
                    game_state.update_player_inputs(player_id, inputs)
                elif msg_type == 'start_match':
                    # Host wants to start match
                    if player_id == list(connections.keys())[0] and len(game_state.players) == 2:
                        # First player (host) wants to start
                        if not game_state.match_active:
                            arena_manager.clear_event(game_state)
                            game_state.start_match()
                            
                            # Notify all players that match is starting
                            start_message = json.dumps({
                                'type': 'match_start'
                            })
                            for ws in list(connections.values()):
                                try:
                                    await ws.send_text(start_message)
                                except Exception:
                                    pass
                
            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"Error handling message: {e}")
    
    except WebSocketDisconnect:
        print(f"WebSocket disconnect for {player_id}")
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Clean up on disconnect
        if player_id:
            disconnect_time = time.time()
            print(f"\n=== Player {player_id} DISCONNECTING ===")
            print(f"Before cleanup: {len(connections)} connections, {len(game_state.players)} players")
            
            # Remove from active connections FIRST
            if player_id in connections:
                del connections[player_id]
                print(f"Removed {player_id} from connections dict")
            if player_id in client_ips:
                del client_ips[player_id]
            
            # Check if we should keep player in game_state for reconnect window
            # Only remove if reconnect window expired
            keep_in_state = False
            if player_id in game_state.disconnected_players:
                time_since_disconnect = time.time() - game_state.disconnected_players[player_id]
                if time_since_disconnect < game_state.reconnect_window:
                    keep_in_state = True
                    print(f"Player {player_id} disconnected recently ({time_since_disconnect:.1f}s ago), keeping in game_state for reconnect")
            
            if not keep_in_state:
                game_state.remove_player(player_id, disconnect_time)
            else:
                # Just mark as disconnected but keep in players list
                print(f"Player {player_id} marked as disconnected but kept in game_state")
            
            print(f"After cleanup: {len(connections)} connections, {len(game_state.players)} players")
            print(f"Remaining players in game_state: {list(game_state.players.keys())}\n")
            
            # Notify remaining players about disconnect
            if len(connections) >= 1:
                disconnect_message = json.dumps({
                    'type': 'player_disconnected',
                    'player_id': player_id,
                    'waiting_for_reconnect': True
                })
                for ws in list(connections.values()):
                    try:
                        await ws.send_text(disconnect_message)
                    except Exception:
                        pass
            
            # If we lost a player, pause the game
            if len(connections) < 2:
                game_state.round_active = False
                game_state.match_state = "waiting"
            
            # Send final lobby update to remaining players showing who's left
            if len(connections) > 0:
                players_list = [
                    {'id': pid, 'name': pid[:8]} 
                    for pid in game_state.players.keys()
                ]
                disconnect_lobby_update = json.dumps({
                    'type': 'lobby_update',
                    'players': players_list,
                    'players_count': len(game_state.players)
                })
                for ws in list(connections.values()):
                    try:
                        await ws.send_text(disconnect_lobby_update)
                    except Exception:
                        pass


# Serve static files from client directory
CLIENT_DIR = os.path.join(os.path.dirname(__file__), "..", "client")

try:
    app.mount("/static", StaticFiles(directory=CLIENT_DIR), name="static")
except Exception:
    pass


@app.get("/")
async def root():
    """Serve the main game page."""
    try:
        html_path = os.path.join(CLIENT_DIR, "index.html")
        return FileResponse(html_path)
    except Exception:
        return {"message": "Client files not found. Please check that client/index.html exists."}


@app.get("/health")
async def health():
    """Health check endpoint for deployment monitoring."""
    return {
        "status": "ok",
        "service": "duel-dome",
        "connections": len(connections),
        "players": len(game_state.players),
        "match_active": game_state.match_active
    }


@app.get("/style.css")
async def style():
    """Serve CSS file."""
    try:
        css_path = os.path.join(CLIENT_DIR, "style.css")
        return FileResponse(css_path, media_type="text/css")
    except Exception:
        return {"error": "CSS file not found"}


@app.get("/script.js")
async def script():
    """Serve JavaScript file."""
    try:
        js_path = os.path.join(CLIENT_DIR, "script.js")
        return FileResponse(js_path, media_type="application/javascript")
    except Exception:
        return {"error": "JavaScript file not found"}


if __name__ == "__main__":
    # Allow port to be configured via environment variable
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)

