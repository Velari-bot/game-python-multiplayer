"""
Arena event system for Duel Dome.
"""
import random
from typing import Dict, Optional


class ArenaEventManager:
    """Manages arena events and their effects."""
    
    EVENT_TYPES = [
        'low_gravity',
        'fast_mode',
        'shrinking',
        'invert_controls',
        'reverse_gravity',
        'double_dash',
        'darkness',
        'shrink_zone'
    ]
    
    def __init__(self):
        self.current_event: Optional[str] = None
        self.event_duration: float = 0.0
        self.event_start_time: float = 0.0
        self.base_radius: float = 400.0
        self.target_radius: float = 400.0
        self.shrink_start_time: float = 0.0
        self.next_event_time: float = 15.0  # Trigger event every 15 seconds
        self.last_event_time: float = 0.0
    
    def trigger_random_event(self, game_state, force_event: Optional[str] = None) -> str:
        """Trigger a random arena event."""
        # Clear previous event first
        self.clear_event(game_state)
        
        self.current_event = force_event or random.choice(self.EVENT_TYPES)
        self.event_start_time = 0.0
        self.event_duration = 10.0  # Events last 10 seconds
        
        # Apply event effects
        if self.current_event == 'low_gravity':
            game_state.event_multipliers['gravity'] = 0.3
        elif self.current_event == 'fast_mode':
            game_state.event_multipliers['move_speed'] = 1.5  # +50% speed
            game_state.event_multipliers['bullet_speed'] = 1.5
        elif self.current_event == 'shrinking':
            game_state.arena_radius = self.base_radius
            self.target_radius = self.base_radius * 0.5
            self.shrink_start_time = 0.0
        elif self.current_event == 'invert_controls':
            game_state.event_multipliers['controls_inverted'] = 1.0
        elif self.current_event == 'reverse_gravity':
            game_state.event_multipliers['gravity'] = -0.5  # Float upward
        elif self.current_event == 'double_dash':
            game_state.event_multipliers['dash_count'] = 2.0  # 2 dashes before cooldown
        elif self.current_event == 'darkness':
            game_state.event_multipliers['darkness'] = 1.0
        elif self.current_event == 'shrink_zone':
            # Slower shrink than regular shrinking
            game_state.arena_radius = self.base_radius
            self.target_radius = self.base_radius * 0.7
            self.shrink_start_time = 0.0
        
        game_state.arena_event = self.current_event
        return self.current_event
    
    def clear_event(self, game_state):
        """Clear current event and reset multipliers."""
        if self.current_event == 'low_gravity' or self.current_event == 'reverse_gravity':
            game_state.event_multipliers['gravity'] = 1.0
        elif self.current_event == 'fast_mode':
            game_state.event_multipliers['move_speed'] = 1.0
            game_state.event_multipliers['bullet_speed'] = 1.0
        elif self.current_event == 'shrinking' or self.current_event == 'shrink_zone':
            game_state.arena_radius = self.base_radius
        elif self.current_event == 'invert_controls':
            game_state.event_multipliers['controls_inverted'] = 0.0
        elif self.current_event == 'double_dash':
            game_state.event_multipliers['dash_count'] = 1.0
        elif self.current_event == 'darkness':
            game_state.event_multipliers['darkness'] = 0.0
        
        self.current_event = None
        game_state.arena_event = None
    
    def update(self, dt: float, game_state):
        """Update active event and trigger new events every 15 seconds."""
        import time
        
        current_time = time.time()
        
        # Auto-trigger events every 15 seconds during active rounds
        if game_state.round_active and game_state.match_active:
            if self.last_event_time == 0.0:
                self.last_event_time = current_time
            
            time_since_last_event = current_time - self.last_event_time
            
            if time_since_last_event >= self.next_event_time:
                # Trigger new random event
                self.trigger_random_event(game_state)
                self.last_event_time = current_time
                
                # Notify clients of new event
                return True  # Signal that new event was triggered
        
        # Update event duration
        if self.current_event:
            self.event_start_time += dt
            
            # Auto-clear events after duration
            if self.event_start_time >= self.event_duration:
                old_event = self.current_event
                self.clear_event(game_state)
                # Only return True if event actually changed
                return old_event is not None
        
        # Update shrinking effects
        if self.current_event == 'shrinking' or self.current_event == 'shrink_zone':
            self.shrink_start_time += dt
            shrink_duration = 10.0 if self.current_event == 'shrinking' else 15.0
            
            if self.shrink_start_time < shrink_duration:
                # Linear interpolation
                progress = self.shrink_start_time / shrink_duration
                current_radius = self.base_radius - (self.base_radius - self.target_radius) * progress
                game_state.arena_radius = max(self.target_radius, current_radius)
            else:
                game_state.arena_radius = self.target_radius
        
        return False

