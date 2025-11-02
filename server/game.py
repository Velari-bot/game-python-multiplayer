"""
Game logic for Duel Dome - Player, Bullet, and GameState management.
"""
import math
import time
from typing import Dict, List, Optional
from dataclasses import dataclass, field


@dataclass
class Bullet:
    """Represents a bullet in the game."""
    x: float
    y: float
    vx: float
    vy: float
    owner_id: str
    created_at: float = field(default_factory=time.time)
    lifetime: float = 2.0  # 2 seconds
    ricochet: bool = False  # Power-up: bullets bounce once
    bounces: int = 0
    
    def update(self, dt: float):
        """Update bullet position."""
        self.x += self.vx * dt
        self.y += self.vy * dt
    
    def is_expired(self) -> bool:
        """Check if bullet has exceeded its lifetime."""
        return time.time() - self.created_at > self.lifetime
    
    def bounce(self, arena_radius: float):
        """Bounce bullet off arena edge."""
        if not self.ricochet or self.bounces >= 1:
            return False
        
        distance = math.sqrt(self.x * self.x + self.y * self.y)
        if distance >= arena_radius * 0.9:
            # Reflect velocity
            angle_to_center = math.atan2(self.y, self.x)
            bullet_angle = math.atan2(self.vy, self.vx)
            normal_angle = angle_to_center + math.pi
            reflection_angle = 2 * normal_angle - bullet_angle
            
            speed = math.sqrt(self.vx * self.vx + self.vy * self.vy)
            self.vx = math.cos(reflection_angle) * speed
            self.vy = math.sin(reflection_angle) * speed
            self.bounces += 1
            return True
        return False


@dataclass
class PowerUp:
    """Represents a collectable power-up."""
    x: float
    y: float
    power_type: str  # speed_boost, double_shot, shield, invisibility, ricochet
    created_at: float = field(default_factory=time.time)
    lifetime: float = 15.0  # Despawn after 15 seconds if not collected
    
    def is_expired(self) -> bool:
        """Check if power-up has expired."""
        return time.time() - self.created_at > self.lifetime


@dataclass
class Player:
    """Represents a player in the game."""
    id: str
    x: float
    y: float
    angle: float = 0.0
    vx: float = 0.0
    vy: float = 0.0
    health: int = 3
    shoot_cooldown: float = 0.0
    dash_cooldown: float = 0.0
    dash_active: bool = False
    dash_duration: float = 0.0
    inputs: Dict[str, bool] = field(default_factory=lambda: {
        'w': False, 'a': False, 's': False, 'd': False,
        'shoot': False, 'dash': False
    })
    
    # Power-ups
    active_powerup: Optional[str] = None  # Current power-up type
    powerup_end_time: float = 0.0
    shields: int = 0  # Shield blocks 1 bullet
    invisible_until: float = 0.0
    double_shot_active: bool = False
    
    # Stats tracking
    hits_landed: int = 0
    shots_fired: int = 0
    perfect_dashes: int = 0
    last_kill_time: float = 0.0
    combo_count: int = 0
    last_bullet_near_time: float = 0.0  # For perfect dash detection
    
    # Constants
    MOVE_SPEED: float = 200.0  # pixels per second
    DASH_SPEED: float = 400.0
    DASH_DURATION: float = 0.15  # seconds
    DASH_COOLDOWN: float = 1.0
    SHOOT_COOLDOWN: float = 0.3
    BULLET_SPEED: float = 500.0
    RADIUS: float = 15.0  # collision radius
    
    def update(self, dt: float, arena_radius: float, gravity_mult: float = 1.0):
        """Update player state based on inputs and physics."""
        # Update cooldowns
        self.shoot_cooldown = max(0.0, self.shoot_cooldown - dt)
        if not self.dash_active:
            self.dash_cooldown = max(0.0, self.dash_cooldown - dt)
        
        # Handle dash
        if self.inputs.get('dash', False) and self.dash_cooldown <= 0.0 and not self.dash_active:
            self.dash_active = True
            self.dash_duration = self.DASH_DURATION
            self.dash_cooldown = self.DASH_COOLDOWN
        
        if self.dash_active:
            self.dash_duration -= dt
            if self.dash_duration <= 0.0:
                self.dash_active = False
        
        # Calculate movement
        move_x = 0.0
        move_y = 0.0
        
        if self.inputs.get('w', False):
            move_y -= 1.0
        if self.inputs.get('s', False):
            move_y += 1.0
        if self.inputs.get('a', False):
            move_x -= 1.0
        if self.inputs.get('d', False):
            move_x += 1.0
        
        # Normalize diagonal movement
        if move_x != 0.0 or move_y != 0.0:
            length = math.sqrt(move_x * move_x + move_y * move_y)
            move_x /= length
            move_y /= length
            
            # Apply movement speed (with dash multiplier)
            speed = self.DASH_SPEED if self.dash_active else self.MOVE_SPEED
            self.vx = move_x * speed
            self.vy = move_y * speed
            
            # Update angle to face movement direction
            self.angle = math.atan2(move_y, move_x)
        else:
            # Apply friction
            self.vx *= 0.85
            self.vy *= 0.85
        
        # Apply gravity multiplier (for low_gravity event)
        gravity_drag = 1.0 - (1.0 - gravity_mult) * 0.3
        self.vx *= gravity_drag
        self.vy *= gravity_drag
        
        # Update position
        self.x += self.vx * dt
        self.y += self.vy * dt
        
        # Keep player within arena bounds
        distance_from_center = math.sqrt(self.x * self.x + self.y * self.y)
        if distance_from_center + self.RADIUS > arena_radius:
            # Push player back into arena
            angle_to_center = math.atan2(self.y, self.x)
            max_distance = arena_radius - self.RADIUS
            self.x = math.cos(angle_to_center) * max_distance
            self.y = math.sin(angle_to_center) * max_distance
            # Reflect velocity
            normal_angle = angle_to_center
            self.vx *= -0.5
            self.vy *= -0.5
    
    def can_shoot(self) -> bool:
        """Check if player can shoot."""
        return self.shoot_cooldown <= 0.0
    
    def shoot(self) -> Optional[Bullet]:
        """Create a bullet if cooldown is ready. Returns list for double shot."""
        if not self.can_shoot():
            return None
        
        self.shoot_cooldown = self.SHOOT_COOLDOWN
        self.shots_fired += 1
        
        # Bullet spawns slightly in front of player
        offset = self.RADIUS + 5.0
        bullet_x = self.x + math.cos(self.angle) * offset
        bullet_y = self.y + math.sin(self.angle) * offset
        bullet_vx = math.cos(self.angle) * self.BULLET_SPEED
        bullet_vy = math.sin(self.angle) * self.BULLET_SPEED
        
        bullet = Bullet(bullet_x, bullet_y, bullet_vx, bullet_vy, self.id)
        
        # Apply ricochet power-up
        if self.active_powerup == 'ricochet' and time.time() < self.powerup_end_time:
            bullet.ricochet = True
        
        return bullet
    
    def activate_powerup(self, power_type: str):
        """Activate a power-up effect."""
        self.active_powerup = power_type
        current_time = time.time()
        
        if power_type == 'speed_boost':
            self.powerup_end_time = current_time + 8.0  # 8 seconds (longer duration)
        elif power_type == 'double_shot':
            self.powerup_end_time = current_time + 12.0  # 12 seconds (longer)
            self.double_shot_active = True
        elif power_type == 'shield':
            self.shields = 2  # 2 shields now
        elif power_type == 'invisibility':
            self.invisible_until = current_time + 4.0  # 4 seconds (longer)
        elif power_type == 'ricochet':
            self.powerup_end_time = current_time + 15.0  # 15 seconds
    
    def update_powerups(self, dt: float):
        """Update active power-up effects."""
        current_time = time.time()
        
        # Check for expired power-ups
        if self.active_powerup and current_time >= self.powerup_end_time:
            if self.active_powerup == 'double_shot':
                self.double_shot_active = False
            elif self.active_powerup == 'shield':
                self.shields = 0
            elif self.active_powerup in ['speed_boost', 'ricochet']:
                pass  # Just timed effects
            self.active_powerup = None
        
        if self.invisible_until > 0 and current_time >= self.invisible_until:
            self.invisible_until = 0.0
    
    def take_damage(self, ignore_shield: bool = False):
        """Apply 1 damage to player. Returns True if damage was dealt."""
        if not ignore_shield and self.shields > 0:
            self.shields = 0
            return False  # Shield blocked damage
        
        self.health = max(0, self.health - 1)
        return True
    
    def is_alive(self) -> bool:
        """Check if player is alive."""
        return self.health > 0
    
    def is_invisible(self) -> bool:
        """Check if player is invisible."""
        return time.time() < self.invisible_until


class GameState:
    """Manages the game state and game loop."""
    def __init__(self):
        self.players: Dict[str, Player] = {}
        self.bullets: List[Bullet] = []
        self.powerups: List[PowerUp] = []
        self.base_arena_radius: float = 400.0
        self.arena_radius: float = self.base_arena_radius
        self.next_powerup_spawn: float = 10.0  # First spawn after 10 seconds
        self.last_powerup_spawn: float = 0.0
        self.arena_event: Optional[str] = None
        self.event_multipliers: Dict[str, float] = {
            'move_speed': 1.0,
            'gravity': 1.0,
            'controls_inverted': 0.0,  # 0 = normal, 1 = inverted
            'bullet_speed': 1.0,
            'dash_count': 1.0,
            'darkness': 0.0
        }
        self.round_active: bool = False
        self.match_active: bool = False
        self.winner: Optional[str] = None
        self.round_winner: Optional[str] = None
        self.last_update: float = time.time()
        
        # Match/round management
        self.round_number: int = 0
        self.round_start_time: float = 0.0
        self.round_timeout: float = 120.0  # 2 minutes
        self.match_state: str = "waiting"  # waiting, countdown, playing, round_end, match_end
        self.countdown: int = 0
        self.countdown_start: float = 0.0
        self.sudden_death_active: bool = False
        
        # Player stats for end-of-match display
        self.player_stats: Dict[str, Dict] = {}  # player_id -> stats dict
        
        # Scores
        self.scores: Dict[str, int] = {}  # player_id -> wins
        self.wins_to_win: int = 3
        
        # Respawn management
        self.respawn_times: Dict[str, float] = {}  # player_id -> respawn_time
        self.respawn_delay: float = 3.0
        
        # Disconnect handling
        self.disconnected_players: Dict[str, float] = {}  # player_id -> disconnect_time
        self.reconnect_window: float = 15.0
        
        # Player collision
        self.enable_player_collision: bool = True
    
    def add_player(self, player_id: str) -> bool:
        """Add a player. Returns True if game can start (2 players)."""
        print(f"add_player called for {player_id}")
        print(f"Current players before add: {len(self.players)} - {list(self.players.keys())}")
        
        if len(self.players) >= 2:
            print(f"Already have 2 players, rejecting {player_id}")
            return False
        
        # Don't add if player already exists
        if player_id in self.players:
            print(f"Player {player_id} already exists!")
            return len(self.players) == 2
        
        # Initialize score if new player
        if player_id not in self.scores:
            self.scores[player_id] = 0
        
        # Check for reconnection
        if player_id in self.disconnected_players:
            del self.disconnected_players[player_id]
        
        # Spawn players on opposite sides
        spawn_angle = len(self.players) * math.pi
        spawn_distance = self.arena_radius * 0.6
        x = math.cos(spawn_angle) * spawn_distance
        y = math.sin(spawn_angle) * spawn_distance
        
        self.players[player_id] = Player(
            id=player_id,
            x=x,
            y=y,
            angle=spawn_angle + math.pi
        )
        
        print(f"Added player {player_id}. Now have {len(self.players)} players: {list(self.players.keys())}")
        return len(self.players) == 2
    
    def remove_player(self, player_id: str, disconnect_time: Optional[float] = None):
        """Remove a player. Track disconnect time for reconnection window."""
        print(f"remove_player called for {player_id}")
        print(f"Before remove: {len(self.players)} players in game_state: {list(self.players.keys())}")
        
        if player_id in self.players:
            del self.players[player_id]
            print(f"After remove: {len(self.players)} players in game_state: {list(self.players.keys())}")
        
        # Track disconnect for reconnection window
        if disconnect_time is None:
            disconnect_time = time.time()
        self.disconnected_players[player_id] = disconnect_time
        
        # Only reset match state if we have less than 2 players
        if len(self.players) < 2:
            self.round_active = False
            self.winner = None
            self.match_state = "waiting"
    
    def update_player_inputs(self, player_id: str, inputs: Dict[str, bool]):
        """Update player input state."""
        if player_id in self.players:
            player = self.players[player_id]
            # Apply controls inversion if active
            if self.event_multipliers['controls_inverted'] > 0.5:
                # Invert WASD
                inverted_inputs = {}
                inverted_inputs['w'] = inputs.get('s', False)
                inverted_inputs['s'] = inputs.get('w', False)
                inverted_inputs['a'] = inputs.get('d', False)
                inverted_inputs['d'] = inputs.get('a', False)
                inverted_inputs['shoot'] = inputs.get('shoot', False)
                inverted_inputs['dash'] = inputs.get('dash', False)
                player.inputs.update(inverted_inputs)
            else:
                player.inputs.update(inputs)
    
    def handle_countdown(self, dt: float):
        """Handle countdown state (3...2...1...go)."""
        elapsed = time.time() - self.countdown_start
        
        if self.countdown > 0:
            # Show countdown number
            if elapsed >= 1.0:
                self.countdown -= 1
                self.countdown_start = time.time()
                if self.countdown == 0:
                    # Countdown finished, start round
                    self.match_state = "playing"
                    self.round_active = True
                    self.round_start_time = time.time()
        elif elapsed >= 0.5:  # Show "GO!" for 0.5s then start
            self.match_state = "playing"
            self.round_active = True
            self.round_start_time = time.time()
    
    def handle_respawn(self, dt: float):
        """Handle player respawns after death."""
        current_time = time.time()
        for player_id, respawn_time in list(self.respawn_times.items()):
            if current_time >= respawn_time:
                if player_id in self.players:
                    player = self.players[player_id]
                    # Respawn player
                    spawn_angle = len(self.players) * math.pi / (len(self.players) + 1)
                    spawn_distance = self.arena_radius * 0.6
                    player.x = math.cos(spawn_angle) * spawn_distance
                    player.y = math.sin(spawn_angle) * spawn_distance
                    player.health = 3
                    player.vx = 0.0
                    player.vy = 0.0
                    player.shoot_cooldown = 0.0
                    player.dash_cooldown = 0.0
                    player.dash_active = False
                del self.respawn_times[player_id]
    
    def check_player_collisions(self):
        """Handle player-to-player collisions with pushback."""
        if not self.enable_player_collision:
            return
        
        player_list = list(self.players.values())
        for i, player1 in enumerate(player_list):
            if not player1.is_alive():
                continue
            for player2 in player_list[i+1:]:
                if not player2.is_alive():
                    continue
                
                dx = player2.x - player1.x
                dy = player2.y - player1.y
                distance = math.sqrt(dx * dx + dy * dy)
                min_distance = player1.RADIUS + player2.RADIUS
                
                if distance < min_distance and distance > 0:
                    # Collision! Push apart
                    overlap = min_distance - distance
                    push_x = (dx / distance) * overlap * 0.5
                    push_y = (dy / distance) * overlap * 0.5
                    
                    player1.x -= push_x
                    player1.y -= push_y
                    player2.x += push_x
                    player2.y += push_y
                    
                    # Small velocity adjustment
                    player1.vx *= 0.8
                    player1.vy *= 0.8
                    player2.vx *= 0.8
                    player2.vy *= 0.8
    
    def check_arena_edge_damage(self):
        """Check if players are touching shrinking arena edge and deal damage."""
        if self.arena_event != 'shrinking':
            return
        
        edge_buffer = 20.0  # Damage zone near edge
        for player in self.players.values():
            if not player.is_alive():
                continue
            
            distance = math.sqrt(player.x * player.x + player.y * player.y)
            if distance + player.RADIUS > self.arena_radius - edge_buffer:
                # Too close to edge, take damage
                player.take_damage()
                # Push back slightly
                angle = math.atan2(player.y, player.x)
                player.x = math.cos(angle) * (self.arena_radius * 0.5)
                player.y = math.sin(angle) * (self.arena_radius * 0.5)
    
    def check_round_timeout(self):
        """Check if round has timed out (2 minutes)."""
        if not self.round_active:
            return False
        
        elapsed = time.time() - self.round_start_time
        if elapsed >= self.round_timeout:
            # Round timeout - player with more health wins, or draw
            players_alive = [p for p in self.players.values() if p.is_alive()]
            if len(players_alive) == 0:
                # Both dead - draw
                self.round_winner = None
            elif len(players_alive) == 1:
                # One alive - they win
                self.round_winner = players_alive[0].id
                self.scores[self.round_winner] = self.scores.get(self.round_winner, 0) + 1
            else:
                # Both alive - player with more health wins
                players_health = [(p.id, p.health) for p in players_alive]
                players_health.sort(key=lambda x: x[1], reverse=True)
                if players_health[0][1] > players_health[1][1]:
                    self.round_winner = players_health[0][0]
                    self.scores[self.round_winner] = self.scores.get(self.round_winner, 0) + 1
                else:
                    # Same health - draw
                    self.round_winner = None
            
            self.round_active = False
            return True
        return False
    
    def check_match_end(self):
        """Check if match should end (3 wins) or sudden-death."""
        # Check for sudden-death (2-2 tie)
        player_ids = list(self.scores.keys())
        if len(player_ids) == 2:
            scores = [self.scores.get(pid, 0) for pid in player_ids]
            if scores[0] == 2 and scores[1] == 2:
                # Sudden-death mode - special final round
                if not self.sudden_death_active:
                    self.sudden_death_active = True
                    # Special sudden-death event - no power-ups, no dashes
                    # Clear all power-ups
                    self.powerups.clear()
                    # Disable dashes for all players
                    for player in self.players.values():
                        player.dash_cooldown = 999.0  # Effectively disable
                    return False  # Continue match
        
        # Normal win condition
        for player_id, wins in self.scores.items():
            if wins >= self.wins_to_win:
                self.winner = player_id
                self.match_state = "match_end"
                self.round_active = False
                
                # Collect final stats for all players
                for pid, player in self.players.items():
                    accuracy = (player.hits_landed / player.shots_fired * 100) if player.shots_fired > 0 else 0
                    self.player_stats[pid] = {
                        'hits_landed': player.hits_landed,
                        'shots_fired': player.shots_fired,
                        'accuracy': round(accuracy, 1),
                        'perfect_dashes': player.perfect_dashes,
                        'combo_count': player.combo_count,
                        'wins': self.scores.get(pid, 0)
                    }
                
                if self.sudden_death_active:
                    self.sudden_death_active = False
                return True
        return False
    
    def update(self, dt: float):
        """Update game state for one frame."""
        current_time = time.time()
        
        # Handle countdown state
        if self.match_state == "countdown":
            self.handle_countdown(dt)
            return
        
        # Handle round end / match end
        if self.match_state in ["round_end", "match_end"]:
            return
        
        # Check for disconnect timeout
        for player_id, disconnect_time in list(self.disconnected_players.items()):
            if current_time - disconnect_time > self.reconnect_window:
                # Disconnect timeout - remove from scores if needed
                if player_id in self.scores:
                    del self.scores[player_id]
                del self.disconnected_players[player_id]
        
        if not self.round_active or len(self.players) < 2:
            return
        
        # Check round timeout
        self.check_round_timeout()
        
        # Handle respawns
        self.handle_respawn(dt)
        
        # Apply move speed multiplier (for fast_mode event)
        base_move_speed = Player.MOVE_SPEED
        Player.MOVE_SPEED = base_move_speed * self.event_multipliers['move_speed']
        
        # Update players
        for player in self.players.values():
            if player.is_alive():
                # Update power-up effects
                player.update_powerups(dt)
                
                # Apply speed boost power-up
                speed_multiplier = 1.0
                if player.active_powerup == 'speed_boost' and time.time() < player.powerup_end_time:
                    speed_multiplier = 1.4  # +40% speed
                
                # Apply event multipliers to base speed
                effective_move_speed = Player.MOVE_SPEED * self.event_multipliers['move_speed'] * speed_multiplier
                effective_dash_speed = Player.DASH_SPEED * self.event_multipliers['move_speed'] * speed_multiplier
                
                # Temporarily modify speed for this update
                original_move = Player.MOVE_SPEED
                original_dash = Player.DASH_SPEED
                Player.MOVE_SPEED = effective_move_speed
                Player.DASH_SPEED = effective_dash_speed
                
                player.update(dt, self.arena_radius, self.event_multipliers['gravity'])
                
                # Restore original speeds
                Player.MOVE_SPEED = original_move
                Player.DASH_SPEED = original_dash
                
                # Check for perfect dash (dash within 0.2s of bullet passing nearby)
                if player.dash_active:
                    # Check if any bullet just passed nearby
                    for bullet in self.bullets:
                        if bullet.owner_id == player.id:
                            continue
                        dx = bullet.x - player.x
                        dy = bullet.y - player.y
                        distance = math.sqrt(dx * dx + dy * dy)
                        if distance < 50.0:  # Bullet was near player
                            player.last_bullet_near_time = current_time
                    
                    # Perfect dash detection
                    if current_time - player.last_bullet_near_time < 0.2:
                        player.perfect_dashes += 1
                        player.last_bullet_near_time = 0.0  # Reset
                
                # Handle shooting
                if player.inputs.get('shoot', False):
                    bullet = player.shoot()
                    if bullet:
                        # Prevent too many bullets
                        if len(self.bullets) < 100:
                            self.bullets.append(bullet)
                            
                            # Double shot power-up
                            if player.double_shot_active and time.time() < player.powerup_end_time:
                                # Create second bullet slightly offset
                                offset_angle = 0.1  # 10 degrees offset
                                bullet2_x = player.x + math.cos(player.angle + offset_angle) * (player.RADIUS + 5.0)
                                bullet2_y = player.y + math.sin(player.angle + offset_angle) * (player.RADIUS + 5.0)
                                bullet2_vx = math.cos(player.angle + offset_angle) * Player.BULLET_SPEED
                                bullet2_vy = math.sin(player.angle + offset_angle) * Player.BULLET_SPEED
                                bullet2 = Bullet(bullet2_x, bullet2_y, bullet2_vx, bullet2_vy, player.id)
                                if player.active_powerup == 'ricochet':
                                    bullet2.ricochet = True
                                if len(self.bullets) < 100:
                                    self.bullets.append(bullet2)
        
        # Reset move speed
        Player.MOVE_SPEED = base_move_speed
        
        # Check player collisions
        self.check_player_collisions()
        
        # Check arena edge damage (for shrinking arena)
        self.check_arena_edge_damage()
        
        # Update bullets
        for bullet in self.bullets[:]:
            bullet.update(dt)
            
            # Remove expired bullets
            if bullet.is_expired():
                self.bullets.remove(bullet)
                continue
            
            # Check bullet-arena collision (with ricochet)
            distance = math.sqrt(bullet.x * bullet.x + bullet.y * bullet.y)
            if distance > self.arena_radius:
                # Try to bounce if ricochet is active
                if bullet.ricochet:
                    if bullet.bounce(self.arena_radius):
                        continue  # Bullet bounced, keep it
                # Bullet hit edge and no bounce - remove
                self.bullets.remove(bullet)
                continue
            
            # Check bullet-bullet collision (bullet reflect feature)
            for other_bullet in self.bullets[:]:
                if bullet == other_bullet:
                    continue
                dx = bullet.x - other_bullet.x
                dy = bullet.y - other_bullet.y
                bullet_distance = math.sqrt(dx * dx + dy * dy)
                if bullet_distance < 8.0:  # Bullet collision radius
                    # Bullet reflect - bounce them off each other
                    # Swap velocities for cinematic bounce
                    temp_vx = bullet.vx
                    temp_vy = bullet.vy
                    bullet.vx = other_bullet.vx * 0.8  # Slight speed loss
                    bullet.vy = other_bullet.vy * 0.8
                    other_bullet.vx = temp_vx * 0.8
                    other_bullet.vy = temp_vy * 0.8
                    break  # Only reflect once per frame
            
            # Check bullet-player collision
            for player_id, player in self.players.items():
                if player_id == bullet.owner_id or not player.is_alive():
                    continue
                
                dx = bullet.x - player.x
                dy = bullet.y - player.y
                distance = math.sqrt(dx * dx + dy * dy)
                
                # Skip collision if player is invisible
                if player.is_invisible():
                    continue
                
                if distance < player.RADIUS:
                    # Hit!
                    damage_dealt = player.take_damage()
                    
                    if bullet in self.bullets:
                        self.bullets.remove(bullet)
                    
                    if damage_dealt:
                        # Damage was dealt (not blocked by shield)
                        # Update stats
                        if bullet.owner_id in self.players:
                            attacker = self.players[bullet.owner_id]
                            attacker.hits_landed += 1
                            
                            # Check for chain kill (2 kills within 5 seconds)
                            if not player.is_alive():
                                time_since_last_kill = current_time - attacker.last_kill_time
                                if time_since_last_kill < 5.0:
                                    attacker.combo_count += 1
                                else:
                                    attacker.combo_count = 1
                                attacker.last_kill_time = current_time
                    
                    # Check for round winner
                    if not player.is_alive():
                        self.round_winner = bullet.owner_id
                        self.round_active = False
                        self.match_state = "round_end"
                        # Award point
                        if bullet.owner_id in self.players:
                            self.scores[bullet.owner_id] = self.scores.get(bullet.owner_id, 0) + 1
                        # Schedule respawn (though round will end before respawn completes)
                        self.respawn_times[player_id] = time.time() + self.respawn_delay
                    break
        
        # Spawn power-ups every 10-20 seconds
        self.spawn_powerups(dt)
        
        # Update power-ups (expiration)
        for powerup in self.powerups[:]:
            if powerup.is_expired():
                self.powerups.remove(powerup)
        
        # Check power-up collection
        self.check_powerup_collection()
        
        # Check match end
        self.check_match_end()
    
    def spawn_powerups(self, dt: float):
        """Spawn power-ups randomly every 10-20 seconds."""
        # No power-ups during sudden-death
        if self.sudden_death_active:
            self.powerups.clear()
            return
        
        if not self.round_active or not self.match_active:
            return
        
        current_time = time.time()
        
        if self.last_powerup_spawn == 0.0:
            self.last_powerup_spawn = current_time
        
        # Spawn every 10-20 seconds (randomized)
        time_since_last_spawn = current_time - self.last_powerup_spawn
        if time_since_last_spawn >= self.next_powerup_spawn and len(self.powerups) < 3:
            # Spawn a power-up at random location within arena
            import random
            angle = random.random() * 2 * math.pi
            distance = random.random() * self.arena_radius * 0.6
            x = math.cos(angle) * distance
            y = math.sin(angle) * distance
            
            # Random power-up type
            power_types = ['speed_boost', 'double_shot', 'shield', 'invisibility', 'ricochet']
            power_type = random.choice(power_types)
            
            self.powerups.append(PowerUp(x, y, power_type))
            self.last_powerup_spawn = current_time
            # Next spawn in 10-20 seconds
            self.next_powerup_spawn = 10.0 + random.random() * 10.0
    
    def check_powerup_collection(self):
        """Check if players collect power-ups."""
        for powerup in self.powerups[:]:
            for player_id, player in self.players.items():
                if not player.is_alive():
                    continue
                
                dx = powerup.x - player.x
                dy = powerup.y - player.y
                distance = math.sqrt(dx * dx + dy * dy)
                
                if distance < player.RADIUS + 10.0:  # Collection radius
                    # Player collected power-up
                    player.activate_powerup(powerup.power_type)
                    self.powerups.remove(powerup)
                    break
    
    def start_match(self):
        """Start a new match with countdown."""
        if len(self.players) < 2:
            return
        
        self.round_number = 0
        self.match_active = True
        self.match_state = "countdown"
        self.countdown = 3
        self.countdown_start = time.time()
        
        # Initialize scores
        for player_id in self.players:
            if player_id not in self.scores:
                self.scores[player_id] = 0
        
        # Reset arena
        self.arena_radius = self.base_arena_radius
        
        # Reset sudden-death flag
        self.sudden_death_active = False
        
        # Initialize player stats tracking
        for player_id in self.players:
            if player_id not in self.player_stats:
                player = self.players[player_id]
                self.player_stats[player_id] = {
                    'hits_landed': 0,
                    'shots_fired': 0,
                    'perfect_dashes': 0,
                    'combo_count': 0,
                    'wins': 0
                }
            # Reset stats for new match
            player.hits_landed = 0
            player.shots_fired = 0
            player.perfect_dashes = 0
            player.combo_count = 0
            player.last_kill_time = 0.0
    
    def start_round(self):
        """Reset and start a new round with countdown."""
        if len(self.players) < 2:
            return
        
        self.round_number += 1
        self.match_state = "countdown"
        self.countdown = 3
        self.countdown_start = time.time()
        self.round_winner = None
        
        # Reset player health and positions
        spawn_angle = 0
        spawn_distance = self.arena_radius * 0.6
        for i, (player_id, player) in enumerate(self.players.items()):
            spawn_angle = i * math.pi
            player.x = math.cos(spawn_angle) * spawn_distance
            player.y = math.sin(spawn_angle) * spawn_distance
            player.angle = spawn_angle + math.pi
            player.health = 3
            player.vx = 0.0
            player.vy = 0.0
            player.shoot_cooldown = 0.0
            player.dash_cooldown = 0.0
            player.dash_active = False
        
        # Clear bullets, power-ups, and respawn times
        self.bullets.clear()
        self.powerups.clear()
        self.respawn_times.clear()
        
        # Reset power-ups for players
        for player in self.players.values():
            player.active_powerup = None
            player.powerup_end_time = 0.0
            player.shields = 0
            player.invisible_until = 0.0
            player.double_shot_active = False
            player.dash_cooldown = 0.0  # Re-enable dashes (unless sudden-death)
        
        # Reset arena event
        self.arena_event = None
        for key in self.event_multipliers:
            if key == 'move_speed':
                self.event_multipliers[key] = 1.0
            elif key == 'gravity':
                self.event_multipliers[key] = 1.0
            elif key == 'controls_inverted':
                self.event_multipliers[key] = 0.0
        
        # Note: round_active will be set to True after countdown
        self.round_active = False
    
    def to_dict(self) -> dict:
        """Convert game state to dictionary for JSON serialization."""
        return {
            'players': {
                pid: {
                    'id': p.id,
                    'x': p.x,
                    'y': p.y,
                    'angle': p.angle,
                    'health': p.health,
                    'dash_active': p.dash_active,
                    'active_powerup': p.active_powerup,
                    'powerup_end_time': p.powerup_end_time,
                    'shields': p.shields,
                    'invisible_until': p.invisible_until,
                    'hits_landed': p.hits_landed,
                    'shots_fired': p.shots_fired,
                    'perfect_dashes': p.perfect_dashes,
                    'combo_count': p.combo_count,
                    'vx': p.vx,
                    'vy': p.vy
                }
                for pid, p in self.players.items()
            },
            'bullets': [
                {
                    'x': b.x,
                    'y': b.y,
                    'vx': b.vx,
                    'vy': b.vy,
                    'owner_id': b.owner_id,
                    'ricochet': b.ricochet
                }
                for b in self.bullets
            ],
            'powerups': [
                {
                    'x': p.x,
                    'y': p.y,
                    'power_type': p.power_type,
                    'created_at': p.created_at
                }
                for p in self.powerups
            ],
            'arena_radius': self.arena_radius,
            'arena_event': self.arena_event,
            'round_active': self.round_active,
            'match_state': self.match_state,
            'round_number': self.round_number,
            'countdown': self.countdown if self.match_state == "countdown" else None,
            'round_time_remaining': max(0, self.round_timeout - (time.time() - self.round_start_time)) if self.round_active else None,
            'scores': self.scores.copy(),
            'round_winner': self.round_winner,
            'winner': self.winner,
            'players_count': len(self.players),
            'match_active': self.match_active
        }

