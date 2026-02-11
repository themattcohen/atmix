"""
Pydantic models for COA mapping endpoints
"""
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from enum import Enum


class ConfidenceLevel(str, Enum):
    """Confidence levels for mapping suggestions"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    MANUAL = "manual"


class AccountMapping(BaseModel):
    """Individual account mapping"""
    original_account: str
    account_name: Optional[str] = None
    suggested_mapping: str
    confidence: ConfidenceLevel
    confidence_score: float = Field(ge=0.0, le=1.0)
    is_user_modified: bool = False


class MappingSuggestions(BaseModel):
    """All mapping suggestions for a session"""
    session_id: str
    mappings: List[AccountMapping]
    unmapped_count: int
    high_confidence_count: int
    medium_confidence_count: int
    low_confidence_count: int


class UpdateMappingRequest(BaseModel):
    """Request to update a single mapping"""
    original_account: str
    new_mapping: str


class BulkUpdateMappingsRequest(BaseModel):
    """Request to update multiple mappings"""
    mappings: List[UpdateMappingRequest]


class ConfirmMappingsRequest(BaseModel):
    """Request to confirm final mappings"""
    confirm: bool = True


class MappingConfirmationResponse(BaseModel):
    """Response after confirming mappings"""
    success: bool
    message: str
    total_accounts: int
    mapped_accounts: int
    unmapped_accounts: int
    ready_for_analysis: bool


class StandardAccount(BaseModel):
    """Standard COA account"""
    category: str
    subcategory: str
    account_name: str
    typical_keywords: List[str] = []
