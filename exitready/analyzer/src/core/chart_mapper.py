import pandas as pd
import numpy as np
from fuzzywuzzy import fuzz
from typing import Dict, List, Optional, Tuple
import logging
import yaml
from pathlib import Path

class ChartMapper:
    def __init__(self, config_path: str = "config/mapping_settings.yaml"):
        self.logger = logging.getLogger(__name__)
        self.config = self._load_config(config_path)
        self.standard_coa = None
        self.user_overrides = None
        self.fuzzy_threshold = self.config.get('fuzzy_threshold', 60)
        self.strict_mode = self.config.get('strict_mode', False)
        
    def _load_config(self, config_path: str) -> dict:
        """Load configuration from YAML file."""
        try:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            self.logger.warning(f"Config file {config_path} not found, using defaults")
            return {
                'fuzzy_threshold': 60,
                'strict_mode': False,
                'logging_level': 'INFO'
            }
    
    def load_standard_coa(self, file_path: str) -> None:
        """Load the standard Chart of Accounts."""
        try:
            self.standard_coa = pd.read_csv(file_path)
            required_cols = ['category', 'account_name', 'account_number']
            if not all(col in self.standard_coa.columns for col in required_cols):
                raise ValueError(f"Standard CoA must contain columns: {required_cols}")
            self.logger.info(f"Loaded {len(self.standard_coa)} standard CoA entries")
        except Exception as e:
            self.logger.error(f"Error loading standard CoA: {str(e)}")
            raise
    
    def load_user_overrides(self, file_path: str) -> None:
        """Load user mapping overrides."""
        try:
            self.user_overrides = pd.read_csv(file_path)
            required_cols = ['account_name', 'user_mapped_category']
            if not all(col in self.user_overrides.columns for col in required_cols):
                raise ValueError(f"User overrides must contain columns: {required_cols}")
            self.logger.info(f"Loaded {len(self.user_overrides)} user overrides")
        except Exception as e:
            self.logger.error(f"Error loading user overrides: {str(e)}")
            raise
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for comparison (lowercase, strip whitespace)."""
        return str(text).lower().strip()
    
    def _find_user_override(self, account_name: str) -> Optional[str]:
        """Check if there's a user override for this account."""
        if self.user_overrides is None:
            return None
        
        normalized_name = self._normalize_text(account_name)
        matches = self.user_overrides[
            self.user_overrides['account_name'].apply(self._normalize_text) == normalized_name
        ]
        
        if not matches.empty:
            return matches.iloc[0]['user_mapped_category']
        return None
    
    def _find_direct_match(self, account_name: str) -> Optional[Tuple[str, str, str]]:
        """Find direct match in standard CoA."""
        if self.standard_coa is None:
            return None
        
        normalized_name = self._normalize_text(account_name)
        matches = self.standard_coa[
            self.standard_coa['account_name'].apply(self._normalize_text) == normalized_name
        ]
        
        if not matches.empty:
            match = matches.iloc[0]
            return (match['account_number'], match['account_name'], match['category'])
        return None
    
    def _find_fuzzy_match(self, account_name: str) -> Optional[Tuple[str, str, str, float]]:
        """Find fuzzy match in standard CoA."""
        if self.standard_coa is None:
            return None
        
        best_score = 0
        best_match = None
        
        for _, row in self.standard_coa.iterrows():
            score = fuzz.ratio(
                self._normalize_text(account_name),
                self._normalize_text(row['account_name'])
            )
            if score > best_score:
                best_score = score
                best_match = row
        
        if best_score >= self.fuzzy_threshold:
            return (
                best_match['account_number'],
                best_match['account_name'],
                best_match['category'],
                best_score
            )
        return None
    
    def map_account(self, account_name: str) -> Dict:
        """Map a single account to standard CoA."""
        # Try user override first
        override_category = self._find_user_override(account_name)
        if override_category:
            return {
                'standard_account_number': None,
                'standard_account_name': None,
                'category': override_category,
                'mapping_confidence': 100,
                'mapping_source': 'override'
            }
        
        # Try direct match
        direct_match = self._find_direct_match(account_name)
        if direct_match:
            return {
                'standard_account_number': direct_match[0],
                'standard_account_name': direct_match[1],
                'category': direct_match[2],
                'mapping_confidence': 100,
                'mapping_source': 'direct'
            }
        
        # Try fuzzy match
        fuzzy_match = self._find_fuzzy_match(account_name)
        if fuzzy_match:
            return {
                'standard_account_number': fuzzy_match[0],
                'standard_account_name': fuzzy_match[1],
                'category': fuzzy_match[2],
                'mapping_confidence': fuzzy_match[3],
                'mapping_source': 'fuzzy'
            }
        
        # No match found
        return {
            'standard_account_number': None,
            'standard_account_name': None,
            'category': None,
            'mapping_confidence': 0,
            'mapping_source': 'unmapped'
        }
    
    def map_gl_data(self, gl_data: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Map all accounts in GL data to standard CoA."""
        if not all(col in gl_data.columns for col in ['account_number', 'account_name']):
            raise ValueError("GL data must contain 'account_number' and 'account_name' columns")
        
        # Apply mapping to each account
        mapping_results = gl_data['account_name'].apply(self.map_account)
        mapping_df = pd.DataFrame(mapping_results.tolist())
        
        # Combine with original GL data
        mapped_gl = pd.concat([gl_data, mapping_df], axis=1)
        
        # Identify unmapped accounts
        unmapped = mapped_gl[mapped_gl['mapping_source'] == 'unmapped'][
            ['account_number', 'account_name']
        ].drop_duplicates()
        
        if self.strict_mode and not unmapped.empty:
            raise ValueError(
                f"Found {len(unmapped)} unmapped accounts in strict mode. "
                "Please update mappings and try again."
            )
        
        return mapped_gl, unmapped
    
    def save_unmapped_report(self, unmapped_df: pd.DataFrame, output_path: str) -> None:
        """Save report of unmapped accounts."""
        if not unmapped_df.empty:
            unmapped_df.to_csv(output_path, index=False)
            self.logger.info(f"Saved unmapped accounts report to {output_path}")
        else:
            self.logger.info("No unmapped accounts to report") 