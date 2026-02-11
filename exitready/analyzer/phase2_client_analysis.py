# phase2_client_analysis.py
"""
Phase 2: Comprehensive Client Risk Analysis
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from phase2_churn_analysis import ChurnAnalyzer

class ClientAnalyzer:
    """Comprehensive client risk and concentration analysis"""
    
    def __init__(self, gl_data, ar_data, monthly_financials):
        self.gl_data = gl_data
        self.ar_data = ar_data
        self.monthly_financials = monthly_financials
        self.flags = []
    
    def analyze_all(self):
        """Run all client analyses"""
        print("   • Client concentration analysis...")
        self._analyze_client_concentration()
        
        print("   • Client churn analysis...")
        self._analyze_client_churn()
        
        print("   • Client volatility patterns...")
        self._analyze_client_volatility()
        
        print("   • Client payment behavior...")
        self._analyze_client_payment_patterns()
        
        print("   • Client profitability analysis...")
        self._analyze_client_profitability()
        
        print("   • New client dependency...")
        self._analyze_new_client_dependency()
        
        print("   • Related party analysis...")
        self._analyze_related_parties()
        
        return self.flags
    
    def _analyze_client_concentration(self):
        """Analyze client concentration risks"""
        # Focus on last 6 months of revenue data
        cutoff_date = self.ar_data['month_end_date'].max() - pd.DateOffset(months=6)
        recent_ar_data = self.ar_data[self.ar_data['month_end_date'] >= cutoff_date]
        
        client_revenues = recent_ar_data.groupby('client_name')['original_amount'].sum().sort_values(ascending=False)
        total_revenue = client_revenues.sum()
        
        if total_revenue > 0:
            # Single largest client
            top_1_pct = client_revenues.iloc[0] / total_revenue if len(client_revenues) > 0 else 0
            if top_1_pct > 0.15:
                severity = 'Critical' if top_1_pct > 0.30 else 'High' if top_1_pct > 0.25 else 'Medium'
                self.flags.append({
                    'flag': 'Single Client Dependency',
                    'severity': severity,
                    'detail': f'Largest client: {top_1_pct:.1%} of revenue ({client_revenues.index[0]}) - last 6 months',
                    'impact': 'Critical business risk if client is lost',
                    'action': 'Develop strategy to reduce dependency on largest client',
                    'amount': client_revenues.iloc[0] if len(client_revenues) > 0 else 0,
                    'period': 'Last 6 months'
                })
            
            # Top 3 clients
            if len(client_revenues) >= 3:
                top_3_pct = client_revenues.head(3).sum() / total_revenue
                if top_3_pct > 0.50:
                    severity = 'High' if top_3_pct > 0.70 else 'Medium'
                    top_3_clients = ', '.join(client_revenues.head(3).index.tolist())
                    self.flags.append({
                        'flag': 'High Client Concentration - Top 3',
                        'severity': severity,
                        'detail': f'Top 3 clients: {top_3_pct:.1%} of revenue ({top_3_clients}) - last 6 months',
                        'impact': 'High dependency on few clients',
                        'action': 'Diversify client base beyond top 3',
                        'amount': client_revenues.head(3).sum(),
                        'period': 'Last 6 months'
                    })
            
            # Top 5 clients
            if len(client_revenues) >= 5:
                top_5_pct = client_revenues.head(5).sum() / total_revenue
                if top_5_pct > 0.40:
                    severity = 'High' if top_5_pct > 0.60 else 'Medium'
                    top_5_clients = ', '.join(client_revenues.head(5).index.tolist())
                    self.flags.append({
                        'flag': 'High Client Concentration - Top 5',
                        'severity': severity,
                        'detail': f'Top 5 clients: {top_5_pct:.1%} of revenue ({top_5_clients}) - last 6 months',
                        'impact': 'High dependency risk',
                        'action': 'Diversify client base',
                        'amount': client_revenues.head(5).sum(),
                        'period': 'Last 6 months'
                    })
            
            # Client base size analysis
            total_clients = len(client_revenues)
            if total_clients < 10:
                severity = 'High' if total_clients < 5 else 'Medium'
                self.flags.append({
                    'flag': 'Small Client Base',
                    'severity': severity,
                    'detail': f'Only {total_clients} total clients',
                    'impact': 'Limited diversification and growth options',
                    'action': 'Expand client acquisition efforts',
                    'amount': total_revenue / total_clients if total_clients > 0 else 0,
                    'period': 'Overall'
                })
    
    def _analyze_client_churn(self):
        """Analyze client churn patterns using sophisticated ChurnAnalyzer"""
        try:
            # Build client collections matrix for churn analysis
            from data_processor import DataProcessor
            processor = DataProcessor()
            processor.gl_data = self.gl_data  # Set the GL data
            client_collections_df = processor.build_client_collections_matrix()
            
            # Use the sophisticated ChurnAnalyzer with client collections data
            churn_analyzer = ChurnAnalyzer(
                self.gl_data, 
                self.ar_data, 
                self.monthly_financials,
                client_collections_df=client_collections_df
            )
            churn_flags = churn_analyzer.analyze_all()
            
            # Add churn flags to our main flags list
            self.flags.extend(churn_flags)
            
            # Store churn analyzer for potential use in reporting
            self.churn_analyzer = churn_analyzer
            
        except Exception as e:
            # Fallback to basic churn analysis if sophisticated analyzer fails
            print(f"   Warning: Advanced churn analysis failed ({e}), using basic analysis")
            self._analyze_basic_client_churn()
    
    def _analyze_basic_client_churn(self):
        """Basic client churn analysis (fallback method)"""
        # Get clients by time period to identify churn
        month_ends = sorted(self.ar_data['month_end_date'].unique())
        
        if len(month_ends) < 6:
            return
        
        # Compare recent vs prior periods
        cutoff_date = month_ends[-3]  # 3 months ago
        
        recent_clients = set(self.ar_data[
            self.ar_data['month_end_date'] >= cutoff_date
        ]['client_name'].unique())
        
        prior_clients = set(self.ar_data[
            self.ar_data['month_end_date'] < cutoff_date
        ]['client_name'].unique())
        
        if len(prior_clients) > 0:
            lost_clients = prior_clients - recent_clients
            new_clients = recent_clients - prior_clients
            retained_clients = recent_clients & prior_clients
            
            churn_rate = len(lost_clients) / len(prior_clients) if len(prior_clients) > 0 else 0
            
            if churn_rate > 0.20:
                severity = 'Critical' if churn_rate > 0.40 else 'High'
                self.flags.append({
                    'flag': 'High Client Churn Rate',
                    'severity': severity,
                    'detail': f'{churn_rate:.1%} client churn rate ({len(lost_clients)} of {len(prior_clients)} clients lost)',
                    'impact': 'Revenue instability and growth challenges',
                    'action': 'Investigate churn causes and improve client retention',
                    'amount': len(lost_clients),
                    'period': 'Last 3 months'
                })
            
            # Analyze revenue impact of churned clients
            if lost_clients:
                churned_revenue = self.ar_data[
                    (self.ar_data['client_name'].isin(lost_clients)) &
                    (self.ar_data['month_end_date'] < cutoff_date)
                ]['original_amount'].sum()
                
                total_prior_revenue = self.ar_data[
                    self.ar_data['month_end_date'] < cutoff_date
                ]['original_amount'].sum()
                
                if total_prior_revenue > 0:
                    churned_revenue_pct = churned_revenue / total_prior_revenue
                    
                    if churned_revenue_pct > 0.15:
                        severity = 'Critical' if churned_revenue_pct > 0.30 else 'High'
                        self.flags.append({
                            'flag': 'High-Value Client Churn',
                            'severity': severity,
                            'detail': f'Lost clients represented {churned_revenue_pct:.1%} of revenue',
                            'impact': 'Significant revenue loss from churn',
                            'action': 'Focus on retaining high-value clients',
                            'amount': churned_revenue,
                            'period': 'Lost revenue'
                        })
    
    def _analyze_client_volatility(self):
        """Analyze client revenue volatility"""
        client_monthly = self.ar_data.groupby(['client_name', 'month_end_date'])['original_amount'].sum().reset_index()
        
        # Focus on last 3 months for major client determination
        cutoff_date = self.ar_data['month_end_date'].max() - pd.DateOffset(months=3)
        recent_data = client_monthly[client_monthly['month_end_date'] >= cutoff_date]
        recent_total_revenue = recent_data['original_amount'].sum()
        
        for client in client_monthly['client_name'].unique():
            client_data = client_monthly[client_monthly['client_name'] == client].sort_values('month_end_date')
            if len(client_data) > 3:
                revenues = client_data['original_amount'].values
                mean_revenue = np.mean(revenues)
                cv = np.std(revenues) / mean_revenue if mean_revenue > 0 else 0
                
                # Calculate client percentage based on RECENT 3 months, not all-time
                recent_client_data = recent_data[recent_data['client_name'] == client]
                recent_client_revenue = recent_client_data['original_amount'].sum()
                client_revenue_pct = recent_client_revenue / recent_total_revenue if recent_total_revenue > 0 else 0
                
                # Flag major clients with high volatility (5% of RECENT revenue, not all-time)
                if cv > 1.0 and client_revenue_pct > 0.05:
                    severity = 'High' if cv > 2.0 or client_revenue_pct > 0.15 else 'Medium'
                    
                    # Build detailed monthly revenue breakdown
                    monthly_details = []
                    for _, row in client_data.iterrows():
                        month_str = row['month_end_date'].strftime('%Y-%m')
                        amount_str = f"${row['original_amount']:,.0f}"
                        monthly_details.append(f"{month_str}: {amount_str}")
                    
                    monthly_breakdown = "; ".join(monthly_details)
                    
                    # Calculate min/max for additional context
                    min_revenue = revenues.min()
                    max_revenue = revenues.max()
                    revenue_range = max_revenue - min_revenue
                    
                    self.flags.append({
                        'flag': 'Major Client Revenue Volatility',
                        'severity': severity,
                        'detail': f'{client}: {cv:.1f} volatility coefficient ({client_revenue_pct:.1%} of last 3 months revenue). Monthly revenues: {monthly_breakdown}. Range: ${min_revenue:,.0f} to ${max_revenue:,.0f} (${revenue_range:,.0f} swing)',
                        'impact': 'Unpredictable revenue from major client',
                        'action': f'Review service agreement and relationship with {client}',
                        'amount': mean_revenue,
                        'period': 'Per client analysis'
                    })
    
    def _analyze_client_payment_patterns(self):
        """Analyze client payment behavior patterns"""
        # Focus on last 3 months for major client determination
        cutoff_date = self.ar_data['month_end_date'].max() - pd.DateOffset(months=3)
        recent_ar_data = self.ar_data[self.ar_data['month_end_date'] >= cutoff_date]
        
        # Analyze payment timing by client
        client_payment_stats = self.ar_data.groupby('client_name').agg({
            'days_outstanding': ['mean', 'max'],
            'current_balance': 'sum',
            'original_amount': 'sum'
        }).round(2)
        
        client_payment_stats.columns = ['avg_days', 'max_days', 'current_balance', 'total_revenue']
        client_payment_stats = client_payment_stats[client_payment_stats['total_revenue'] > 0]
        
        # Calculate recent revenue for major client determination
        recent_client_revenues = recent_ar_data.groupby('client_name')['original_amount'].sum()
        recent_total_revenue = recent_client_revenues.sum()
        
        for client, stats in client_payment_stats.iterrows():
            # Use RECENT 3 months revenue to determine if client is major (5% threshold)
            recent_client_revenue = recent_client_revenues.get(client, 0)
            client_revenue_pct = recent_client_revenue / recent_total_revenue if recent_total_revenue > 0 else 0
            
            # Flag major clients with poor payment patterns (5% of RECENT revenue, not all-time)
            if client_revenue_pct > 0.05:  # Major clients only (>5% of last 3 months revenue)
                if stats['avg_days'] > 75:
                    severity = 'High' if stats['avg_days'] > 100 else 'Medium'
                    self.flags.append({
                        'flag': 'Major Client Poor Payment Pattern',
                        'severity': severity,
                        'detail': f'{client}: {stats["avg_days"]:.0f} average days outstanding ({client_revenue_pct:.1%} of last 3 months revenue)',
                        'impact': 'Cash flow impact from slow-paying major client',
                        'action': f'Address payment terms with {client}',
                        'amount': stats['current_balance'],
                        'period': 'Current'
                    })
                
                if stats['max_days'] > 120:
                    self.flags.append({
                        'flag': 'Major Client Extended Payment Delays',
                        'severity': 'Medium',
                        'detail': f'{client}: {stats["max_days"]:.0f} maximum days outstanding ({client_revenue_pct:.1%} of last 3 months revenue)',
                        'impact': 'Risk of bad debt from major client',
                        'action': f'Review credit terms for {client}',
                        'amount': stats['current_balance'],
                        'period': 'Historical max'
                    })
    
    def _analyze_client_profitability(self):
        """Analyze client profitability patterns"""
        # This is simplified - in practice would need detailed cost allocation
        client_revenues = self.ar_data.groupby('client_name')['original_amount'].sum()
        total_revenue = client_revenues.sum()
        
        if total_revenue > 0:
            # Identify clients below minimum revenue thresholds
            small_clients = client_revenues[client_revenues < (total_revenue * 0.02)]  # <2% of revenue
            
            if len(small_clients) > 0:
                small_client_count = len(small_clients)
                total_clients = len(client_revenues)
                small_client_pct = small_client_count / total_clients
                
                if small_client_pct > 0.50:  # More than 50% of clients are small
                    self.flags.append({
                        'flag': 'High Proportion of Small Clients',
                        'severity': 'Medium',
                        'detail': f'{small_client_pct:.1%} of clients generate <2% of revenue each',
                        'impact': 'Potential profitability issues with small clients',
                        'action': 'Review profitability of small clients and consider minimum fees',
                        'amount': small_clients.sum(),
                        'period': 'Overall'
                    })
    
    def _analyze_new_client_dependency(self):
        """Analyze dependency on new clients"""
        # Identify new clients (first appearance in AR data)
        client_first_dates = self.ar_data.groupby('client_name')['month_end_date'].min()
        
        # Consider clients from last 6 months as "new"
        cutoff_date = self.ar_data['month_end_date'].max() - pd.DateOffset(months=6)
        new_clients = client_first_dates[client_first_dates >= cutoff_date].index
        
        if len(new_clients) > 0:
            new_client_revenue = self.ar_data[
                self.ar_data['client_name'].isin(new_clients)
            ]['original_amount'].sum()
            
            total_revenue = self.ar_data['original_amount'].sum()
            
            if total_revenue > 0:
                new_client_pct = new_client_revenue / total_revenue
                
                if new_client_pct > 0.30:
                    severity = 'High' if new_client_pct > 0.50 else 'Medium'
                    self.flags.append({
                        'flag': 'High Dependency on New Clients',
                        'severity': severity,
                        'detail': f'{new_client_pct:.1%} of revenue from clients acquired in last 6 months',
                        'impact': 'Revenue sustainability concerns - new clients not yet proven',
                        'action': 'Focus on client retention and relationship development',
                        'amount': new_client_revenue,
                        'period': 'Last 6 months'
                    })
    
    def _analyze_related_parties(self):
        """Analyze related party transactions"""
        # Look for potential related party indicators in client names
        client_names = self.ar_data['client_name'].str.lower()
        
        # Common related party indicators
        related_indicators = [
            'holding', 'group', 'family', 'trust', 'llc', 'partnership',
            'management', 'consulting', 'advisory'
        ]
        
        potential_related = []
        for indicator in related_indicators:
            matches = self.ar_data[client_names.str.contains(indicator, na=False)]
            if len(matches) > 0:
                potential_related.extend(matches['client_name'].unique())
        
        # Also look for clients with similar names (potential related entities)
        client_list = self.ar_data['client_name'].unique()
        similar_groups = []
        
        for i, client1 in enumerate(client_list):
            for client2 in client_list[i+1:]:
                # Enhanced similarity check
                words1 = client1.lower().split()
                words2 = client2.lower().split()
                
                # Remove common business suffixes for better matching
                business_suffixes = {'llc', 'inc', 'inc.', 'corp', 'corp.', 'ltd', 'ltd.', 'co', 'co.', 'company', 'partners', 'partnership'}
                words1_clean = [w for w in words1 if w not in business_suffixes]
                words2_clean = [w for w in words2 if w not in business_suffixes]
                
                # Check for various similarity patterns
                common_words = set(words1_clean) & set(words2_clean)
                
                is_similar = False
                similarity_reason = ""
                
                # Pattern 1: 2+ significant words in common (original logic)
                if len(common_words) >= 2:
                    is_similar = True
                    similarity_reason = f"{len(common_words)} words in common"
                
                # Pattern 2: One client name is a subset of another (e.g., "Lantern" vs "Lantern Growth")
                elif len(words1_clean) > 0 and len(words2_clean) > 0:
                    if set(words1_clean).issubset(set(words2_clean)) or set(words2_clean).issubset(set(words1_clean)):
                        is_similar = True
                        similarity_reason = "one name is subset of another"
                
                # Pattern 3: Significant word overlap with business suffixes
                elif len(common_words) >= 1 and len(words1_clean) <= 2 and len(words2_clean) <= 2:
                    # For short names, 1 common word + business suffix might indicate relation
                    if any(suffix in words1 for suffix in business_suffixes) and any(suffix in words2 for suffix in business_suffixes):
                        is_similar = True
                        similarity_reason = "common core name with business suffixes"
                
                if is_similar:
                    similar_groups.append([client1, client2, similarity_reason])
        
        if potential_related or similar_groups:
            total_revenue = self.ar_data['original_amount'].sum()
            
            if potential_related:
                related_revenue = self.ar_data[
                    self.ar_data['client_name'].isin(potential_related)
                ]['original_amount'].sum()
                
                if total_revenue > 0:
                    related_pct = related_revenue / total_revenue
                    
                    if related_pct > 0.15:
                        self.flags.append({
                            'flag': 'Potential Related Party Revenue',
                            'severity': 'Medium',
                            'detail': f'{related_pct:.1%} of revenue from potential related parties',
                            'impact': 'Related party transaction disclosure and independence concerns',
                            'action': 'Review and properly disclose related party relationships',
                            'amount': related_revenue,
                            'period': 'Overall'
                        })
            
            if similar_groups:
                # Format the similar client groups for display
                similar_names_detail = []
                for group in similar_groups:
                    if len(group) == 3:  # New format with similarity reason
                        client1, client2, reason = group
                        similar_names_detail.append(f"({client1}, {client2} - {reason})")
                    else:  # Old format for backward compatibility
                        similar_names_detail.append(f"({', '.join(group)})")
                
                similar_names_text = "; ".join(similar_names_detail)
                
                self.flags.append({
                    'flag': 'Clients with Similar Names Detected',
                    'severity': 'Low',
                    'detail': f'{len(similar_groups)} groups of clients with similar names found: {similar_names_text}',
                    'impact': 'Potential undisclosed related party relationships',
                    'action': 'Verify independence of similarly named clients',
                    'amount': 0,
                    'period': 'Overall'
                })
