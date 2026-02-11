"""
Shared instances for the web application
"""
from .session_manager import SessionManager

# Create a single shared session manager instance
session_manager = SessionManager()
