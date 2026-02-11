"""
Phase 2 Churn Analysis Module

Implements client churn analysis to identify lost customers and revenue churn patterns.
Provides Logo Churn Rate, MRR Churn Rate, and Customer Lifetime metrics.
"""

import pandas as pd
import numpy as np
import yaml
from typing import Dict, List, Tuple, Optional
from datetime import datetime


class ChurnAnalyzer:
    """
    Analyzes client churn patterns and identifies lost customers.
    
    Calculates:
    - Logo Churn Rate (lost customers / active customers)
    - MRR Churn Rate (lost recurring revenue / total MRR)
    - Customer Lifetime (1 / average monthly churn rate)
    - Seasonality detection
    """
    
    def __init__(self, gl_data: pd.DataFrame, ar_data: pd.DataFrame, monthly_financials: Dict, client_collections_df: pd.DataFrame = None):
        self.gl_data = gl_data
        self.ar_data = ar_data
        self.monthly_financials = monthly_financials
        self.client_collections_df = client_collections_df
        self.thresholds = self._load_thresholds()
        self.client_month_df = None
        self.churn_details = pd.DataFrame()
        
    def _load_thresholds(self) -> Dict:
        """Load churn analysis thresholds from config file."""
        try:
            with open('config/analysis_thresholds.yaml', 'r') as f:
                config = yaml.safe_load(f)
                return config.get('churn', {
                    'logo_churn_warn': 0.05,
                    'logo_churn_crit': 0.10,
                    'mrr_churn_warn': 0.04,
                    'mrr_churn_crit': 0.08,
                    'seasonality_ratio': 0.80
                })
        except Exception:
            return {
                'logo_churn_warn': 0.05,
                'logo_churn_crit': 0.10,
                'mrr_churn_warn': 0.04,
                'mrr_churn_crit': 0.08,
                'seasonality_ratio': 0.80
            }
    
    def analyze_all(self) -> List[Dict]:
        """Run all churn analysis checks and return flags."""
        flags = []
        
        # Build client-month matrix
        self.client_month_df = self._build_client_month_matrix()
        
        if self.client_month_df.empty:
            return flags
        
        # Classify recurring vs one-off revenue
        self.client_month_df = self._classify_recurring_revenue(self.client_month_df)
        
        # Mark activity status and lost customers
        self.client_month_df = self._mark_activity_status(self.client_month_df)
        
        # Calculate monthly churn metrics
        monthly_churn = self._calculate_monthly_churn(self.client_month_df)
        
        # Build churn details for export
        self.churn_details = self._build_churn_details(self.client_month_df)
        
        # Generate flags based on thresholds
        flags.extend(self._build_churn_flags(monthly_churn))
        
        return flags
    
    def _build_client_month_matrix(self) -> pd.DataFrame:
        """Build client × month matrix from client collections data."""
        if self.client_collections_df is None or self.client_collections_df.empty:
            return pd.DataFrame()
        
        # Get month columns (exclude 'name' and 'Total')
        month_cols = [col for col in self.client_collections_df.columns if col not in ['name', 'Total']]
        
        if not month_cols:
            return pd.DataFrame()
        
        # Reshape from wide to long format
        result = []
        for _, row in self.client_collections_df.iterrows():
            client_name = row['name']
            for month_str in month_cols:
                billing_amount = abs(row[month_str])  # Convert to positive
                
                # Convert month string to period
                try:
                    month_period = pd.Period(month_str, freq='ME')
                except:
                    continue
                
                result.append({
                    'client_name': client_name,
                    'month': month_period,
                    'billing_amount': billing_amount,
                    'transaction_count': 1 if billing_amount > 0 else 0
                })
        
        if not result:
            return pd.DataFrame()
        
        df = pd.DataFrame(result)
        return df.sort_values(['client_name', 'month']).reset_index(drop=True)
    
    def _classify_recurring_revenue(self, df: pd.DataFrame) -> pd.DataFrame:
        """Classify revenue streams as recurring vs one-off."""
        df = df.copy()
        df['is_recurring'] = False
        df['billing_frequency'] = 'irregular'  # monthly, quarterly, irregular
        
        for client in df['client_name'].unique():
            client_data = df[df['client_name'] == client].copy()
            
            if len(client_data) < 6:  # Need at least 6 months of data
                continue
            
            # Get non-zero billing months
            active_months = client_data[client_data['billing_amount'] > 0]
            
            if len(active_months) < 3:
                continue
            
            # Analyze billing pattern
            active_months_sorted = active_months.sort_values('month')
            month_diffs = active_months_sorted['month'].diff().dropna()
            
            if len(month_diffs) == 0:
                continue
                
            # Calculate gaps between invoices
            gaps = [diff.n for diff in month_diffs]
            avg_gap = sum(gaps) / len(gaps)
            
            # Classify billing frequency
            if avg_gap <= 1.5:  # Monthly (allowing for some irregularity)
                billing_freq = 'monthly'
                is_recurring = True
            elif 2.5 <= avg_gap <= 3.5:  # Quarterly
                billing_freq = 'quarterly'
                is_recurring = True
            else:
                billing_freq = 'irregular'
                is_recurring = False
            
            # Additional check: coefficient of variation for recurring clients
            if is_recurring:
                cv = active_months['billing_amount'].std() / active_months['billing_amount'].mean()
                if cv > 0.8:  # Too much variation for recurring
                    is_recurring = False
                    billing_freq = 'irregular'
            
            # Mark the client
            df.loc[df['client_name'] == client, 'is_recurring'] = is_recurring
            df.loc[df['client_name'] == client, 'billing_frequency'] = billing_freq
        
        return df
    
    def _mark_activity_status(self, df: pd.DataFrame) -> pd.DataFrame:
        """Mark activity status and identify lost customers."""
        df = df.copy()
        
        # Mark active months (only when there's actual billing)
        df['is_active'] = df['billing_amount'] > 0
        
        # Calculate previous month activity
        df['prev_active'] = df.groupby('client_name')['is_active'].shift(1)
        
        # Identify lost customers based on billing frequency
        df['lost_customer'] = False
        
        for client in df['client_name'].unique():
            client_mask = df['client_name'] == client
            client_data = df[client_mask].copy().sort_values('month')
            
            if client_data.empty:
                continue
            
            # Check if client has at least 6 months of payment history
            active_months = client_data[client_data['billing_amount'] > 0]
            if len(active_months) < 6:
                continue  # Skip clients without sufficient payment history
                
            # Get billing frequency for this client
            billing_freq = client_data['billing_frequency'].iloc[0]
            
            # Determine inactivity threshold based on billing frequency
            if billing_freq == 'monthly':
                inactivity_threshold = 2  # 2 months for monthly clients
            elif billing_freq == 'quarterly':
                inactivity_threshold = 6  # 6 months for quarterly clients (2 quarters)
            else:
                inactivity_threshold = 12  # 12 months for irregular clients
            
            # Find periods of activity and inactivity
            had_revenue = False
            consecutive_inactive = 0
            last_active_month = None
            churn_month_marked = False  # Track if we've already marked this client as churned
            
            for idx, row in client_data.iterrows():
                if row['billing_amount'] > 0:
                    had_revenue = True
                    consecutive_inactive = 0
                    last_active_month = row['month']
                    churn_month_marked = False  # Reset if client becomes active again
                else:
                    if had_revenue:  # Only count inactivity after we've had revenue
                        consecutive_inactive += 1
                        # Mark as lost ONLY in the first month they meet the threshold
                        if consecutive_inactive == inactivity_threshold and not churn_month_marked:
                            df.loc[idx, 'lost_customer'] = True
                            churn_month_marked = True
        
        return df
    
    def _calculate_monthly_churn(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate monthly churn metrics."""
        monthly_metrics = []
        
        for month in df['month'].unique():
            month_data = df[df['month'] == month]
            prev_month_data = df[df['month'] == month - 1] if month > df['month'].min() else pd.DataFrame()
            
            if prev_month_data.empty:
                continue
            
            # Logo churn calculation
            prev_active_customers = prev_month_data[prev_month_data['is_active']]['client_name'].nunique()
            lost_customers = month_data[month_data['lost_customer']]['client_name'].nunique()
            
            logo_churn_rate = lost_customers / prev_active_customers if prev_active_customers > 0 else 0
            
            # MRR churn calculation (for recurring revenue only)
            prev_mrr = prev_month_data[
                (prev_month_data['is_active']) & (prev_month_data['is_recurring'])
            ]['billing_amount'].sum()
            
            lost_mrr = month_data[
                (month_data['lost_customer']) & (month_data['is_recurring'])
            ]['billing_amount'].sum()
            
            mrr_churn_rate = lost_mrr / prev_mrr if prev_mrr > 0 else 0
            
            monthly_metrics.append({
                'month': month,
                'logo_churn_rate': logo_churn_rate,
                'mrr_churn_rate': mrr_churn_rate,
                'lost_customers': lost_customers,
                'lost_mrr': lost_mrr,
                'total_active_customers': prev_active_customers,
                'total_mrr': prev_mrr
            })
        
        return pd.DataFrame(monthly_metrics)
    
    def _build_churn_details(self, df: pd.DataFrame) -> pd.DataFrame:
        """Build detailed churn information for export."""
        lost_customers = df[df['lost_customer']].copy()
        
        if lost_customers.empty:
            return pd.DataFrame()
        
        details = []
        for _, row in lost_customers.iterrows():
            client_name = row['client_name']
            lost_month = row['month']
            
            # Find last active month
            client_data = df[df['client_name'] == client_name]
            last_active = client_data[
                (client_data['is_active']) & (client_data['month'] < lost_month)
            ]['month'].max()
            
            # Calculate lost MRR
            lost_mrr = row['billing_amount'] if row['is_recurring'] else 0
            
            # Months since last invoice
            months_since = (lost_month - last_active).n if pd.notna(last_active) else None
            
            details.append({
                'client_name': client_name,
                'lost_month': str(lost_month),
                'last_invoice_date': str(last_active) if pd.notna(last_active) else 'Unknown',
                'lost_mrr': lost_mrr,
                'months_since_last_invoice': months_since,
                'detail_ref': f"{lost_month}_{client_name}"
            })
        
        return pd.DataFrame(details)
    
    def _build_churn_flags(self, monthly_churn: pd.DataFrame) -> List[Dict]:
        """Generate flags based on churn thresholds."""
        flags = []
        
        if monthly_churn.empty:
            return flags
        
        # Calculate trailing 6-month average for spike detection
        monthly_churn['mrr_churn_6m_avg'] = monthly_churn['mrr_churn_rate'].rolling(6, min_periods=1).mean()
        
        for _, row in monthly_churn.iterrows():
            month = row['month']
            logo_churn = row['logo_churn_rate']
            mrr_churn = row['mrr_churn_rate']
            
            # Get churned customer names for this month
            churned_customers = self._get_churned_customers_for_month(month)
            churned_names = ', '.join(churned_customers) if churned_customers else 'None identified'
            
            # Logo churn flags
            if logo_churn >= self.thresholds['logo_churn_crit']:
                flags.append({
                    'flag': 'High Logo Churn Rate',
                    'severity': 'Critical',
                    'detail': f'Logo churn rate of {logo_churn:.1%} exceeds critical threshold of {self.thresholds["logo_churn_crit"]:.1%}. Churned clients: {churned_names}',
                    'impact': f'Lost {row["lost_customers"]} customers out of {row["total_active_customers"]} active',
                    'action': 'Investigate customer retention strategies and identify reasons for departures',
                    'amount': row['lost_mrr'],
                    'period': str(month),
                    'detail_ref': f'CHURN_LOGO_HIGH_{month}'
                })
            elif logo_churn >= self.thresholds['logo_churn_warn']:
                flags.append({
                    'flag': 'Elevated Logo Churn Rate',
                    'severity': 'Medium',
                    'detail': f'Logo churn rate of {logo_churn:.1%} exceeds warning threshold of {self.thresholds["logo_churn_warn"]:.1%}. Churned clients: {churned_names}',
                    'impact': f'Lost {row["lost_customers"]} customers out of {row["total_active_customers"]} active',
                    'action': 'Monitor customer satisfaction and implement retention measures',
                    'amount': row['lost_mrr'],
                    'period': str(month),
                    'detail_ref': f'CHURN_LOGO_WARN_{month}'
                })
            
            # MRR churn flags
            if mrr_churn >= self.thresholds['mrr_churn_crit']:
                flags.append({
                    'flag': 'High MRR Churn Rate',
                    'severity': 'Critical',
                    'detail': f'MRR churn rate of {mrr_churn:.1%} exceeds critical threshold of {self.thresholds["mrr_churn_crit"]:.1%}',
                    'impact': f'Lost ${row["lost_mrr"]:,.0f} in recurring revenue out of ${row["total_mrr"]:,.0f} total MRR',
                    'action': 'Urgent review of recurring revenue streams and client relationships',
                    'amount': row['lost_mrr'],
                    'period': str(month),
                    'detail_ref': f'CHURN_MRR_HIGH_{month}'
                })
            elif mrr_churn >= self.thresholds['mrr_churn_warn']:
                flags.append({
                    'flag': 'Elevated MRR Churn Rate',
                    'severity': 'Medium',
                    'detail': f'MRR churn rate of {mrr_churn:.1%} exceeds warning threshold of {self.thresholds["mrr_churn_warn"]:.1%}',
                    'impact': f'Lost ${row["lost_mrr"]:,.0f} in recurring revenue out of ${row["total_mrr"]:,.0f} total MRR',
                    'action': 'Review recurring client contracts and engagement quality',
                    'amount': row['lost_mrr'],
                    'period': str(month),
                    'detail_ref': f'CHURN_MRR_WARN_{month}'
                })
            
            # MRR churn spike detection
            if len(monthly_churn) >= 6:
                trailing_avg = row['mrr_churn_6m_avg']
                if mrr_churn > 2 * trailing_avg and trailing_avg > 0:
                    flags.append({
                        'flag': 'MRR Churn Spike',
                        'severity': 'Info',
                        'detail': f'MRR churn rate of {mrr_churn:.1%} is more than 2x the 6-month average of {trailing_avg:.1%}',
                        'impact': f'Unusual spike in revenue churn may indicate systematic issue',
                        'action': 'Investigate causes of sudden increase in churn rate',
                        'amount': row['lost_mrr'],
                        'period': str(month),
                        'detail_ref': f'CHURN_SPIKE_{month}'
                    })
        
        # Seasonality detection
        seasonality_flags = self._detect_seasonality(monthly_churn)
        flags.extend(seasonality_flags)
        
        return flags
    
    def _detect_seasonality(self, monthly_churn: pd.DataFrame) -> List[Dict]:
        """Detect seasonal patterns in churn."""
        flags = []
        
        if len(monthly_churn) < 12:
            return flags
        
        # Group by calendar month
        monthly_churn['calendar_month'] = monthly_churn['month'].dt.month
        seasonal_pattern = monthly_churn.groupby('calendar_month')['mrr_churn_rate'].mean()
        
        # Check if revenue is concentrated in specific months
        total_churn = seasonal_pattern.sum()
        if total_churn > 0:
            # Find top 6 months
            top_6_months = seasonal_pattern.nlargest(6)
            concentration = top_6_months.sum() / total_churn
            
            if concentration >= self.thresholds['seasonality_ratio']:
                month_names = [
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                ]
                top_months = [month_names[m-1] for m in top_6_months.index]
                
                flags.append({
                    'flag': 'Seasonal Churn Pattern',
                    'severity': 'Info',
                    'detail': f'{concentration:.1%} of churn occurs in 6 months: {", ".join(top_months)}',
                    'impact': 'Churn may be seasonal rather than indicative of business issues',
                    'action': 'Consider seasonal factors when interpreting churn metrics',
                    'amount': 0,
                    'period': 'Annual',
                    'detail_ref': 'CHURN_SEASONALITY'
                })
        
        return flags
    
    def _get_churned_customers_for_month(self, month) -> List[str]:
        """Get list of churned customer names for a specific month."""
        if self.client_month_df is None or self.client_month_df.empty:
            return []
        
        churned_in_month = self.client_month_df[
            (self.client_month_df['month'] == month) & 
            (self.client_month_df['lost_customer'])
        ]
        
        return churned_in_month['client_name'].unique().tolist()
    
    def get_churn_details(self) -> pd.DataFrame:
        """Return detailed churn information for export."""
        return self.churn_details
    
    def get_summary_metrics(self) -> Dict:
        """Get summary churn metrics."""
        if self.client_month_df is None or self.client_month_df.empty:
            return {}
        
        monthly_churn = self._calculate_monthly_churn(self.client_month_df)
        
        if monthly_churn.empty:
            return {}
        
        # Calculate LTM (Last 12 Months) metrics
        ltm_data = monthly_churn.tail(12)
        
        avg_logo_churn = ltm_data['logo_churn_rate'].mean()
        avg_mrr_churn = ltm_data['mrr_churn_rate'].mean()
        
        # Customer lifetime calculation
        customer_lifetime = 1 / avg_logo_churn if avg_logo_churn > 0 else float('inf')
        
        return {
            'logo_churn_ltm': avg_logo_churn,
            'mrr_churn_ltm': avg_mrr_churn,
            'customer_lifetime_months': customer_lifetime,
            'latest_month_logo_churn': monthly_churn.iloc[-1]['logo_churn_rate'],
            'latest_month_mrr_churn': monthly_churn.iloc[-1]['mrr_churn_rate']
        }
