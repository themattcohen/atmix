"""
Session Manager for handling user sessions
Stores session data in memory for MVP
"""
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
import pandas as pd
from pydantic import BaseModel


class SessionData(BaseModel):
    """Session data model"""
    session_id: str
    gl_data: Optional[Any] = None  # Will be DataFrame, but can't serialize directly
    ar_data: Optional[Any] = None  # Will be DataFrame, but can't serialize directly
    coa_mappings: Dict[str, str] = {}
    addbacks: Dict[str, list] = {
        "one_time": [],
        "owner_adj": [],
        "non_recurring": []
    }
    financials: Dict = {}  # Original and adjusted P&L/BS
    analysis_results: Dict = {}  # All 5 phases results
    created_at: datetime = datetime.now()
    last_accessed: datetime = datetime.now()
    gl_filename: Optional[str] = None
    ar_filename: Optional[str] = None
    
    class Config:
        arbitrary_types_allowed = True


class SessionManager:
    """Manages user sessions in memory"""
    
    def __init__(self, session_timeout_hours: int = 24):
        self.sessions: Dict[str, SessionData] = {}
        self.session_timeout = timedelta(hours=session_timeout_hours)
    
    def create_session(self) -> str:
        """Create a new session and return session ID"""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = SessionData(session_id=session_id)
        return session_id
    
    def get_session(self, session_id: str) -> Optional[SessionData]:
        """Get session data by ID"""
        session = self.sessions.get(session_id)
        if session:
            # Update last accessed time
            session.last_accessed = datetime.now()
            # Check if session has expired
            if datetime.now() - session.created_at > self.session_timeout:
                self.delete_session(session_id)
                return None
        return session
    
    def update_session(self, session_id: str, **kwargs) -> bool:
        """Update session data"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        for key, value in kwargs.items():
            if hasattr(session, key):
                setattr(session, key, value)
        
        session.last_accessed = datetime.now()
        return True
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        current_time = datetime.now()
        expired_sessions = []
        
        for session_id, session in self.sessions.items():
            if current_time - session.created_at > self.session_timeout:
                expired_sessions.append(session_id)
        
        for session_id in expired_sessions:
            self.delete_session(session_id)
    
    def get_gl_data(self, session_id: str) -> Optional[pd.DataFrame]:
        """Get GL DataFrame for a session"""
        session = self.get_session(session_id)
        return session.gl_data if session else None
    
    def get_ar_data(self, session_id: str) -> Optional[pd.DataFrame]:
        """Get AR DataFrame for a session"""
        session = self.get_session(session_id)
        return session.ar_data if session else None
    
    def set_gl_data(self, session_id: str, df: pd.DataFrame, filename: str) -> bool:
        """Set GL DataFrame for a session"""
        return self.update_session(session_id, gl_data=df, gl_filename=filename)
    
    def set_ar_data(self, session_id: str, df: pd.DataFrame, filename: str) -> bool:
        """Set AR DataFrame for a session"""
        return self.update_session(session_id, ar_data=df, ar_filename=filename)


# NOTE: Global session manager instance is created in shared_instances.py to avoid duplicates
