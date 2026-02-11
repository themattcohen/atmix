# phase3_collection_analysis.py
"""
Phase 3: Collection & Cash Flow Analysis
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class CollectionAnalyzer:
    """Comprehensive collection and cash flow analysis"""
    
    def __init__(self, gl_data, ar_data, monthly_financials):
        self.gl_data = gl_data
        self.ar_data = ar_data
        self.monthly_financials = monthly_financials
        self.flags = []
    
    def analyze_all(self):
        """Run all collection analyses"""
        print("   • AR aging deterioration...")
        self._analyze_ar_aging_trends()
        
        print("   • Collection efficiency...")
        self._analyze_collection_efficiency()
        
        print("   • DSO trends...")
        self._analyze_dso_trends()
        
        print("   • Write-off patterns...")
        self._analyze_writeoff_patterns()
        
        print("   • Cash flow quality...")
        self._analyze_cash_flow_quality()
        
        print("   • Working capital trends...")
        self._analyze_working_capital()
        
        print("   • Bad debt indicators...")
        self._analyze_bad_debt_indicators()
        
        return self.flags
    
    def _analyze_ar_aging_trends(self):
        """Analyze AR aging deterioration trends"""
        month_ends = sorted(self.ar_data['month_end_date'].unique())
        
        if len(month_ends) < 6:
            return
        
        # Track aging trends over time
        aging_trends = []
        
        for month_end in month_ends:
            month_ar = self.ar_data[self.ar_data['month_end_date'] == month_end]
            if len(month_ar) > 0:
                total_balance = month_ar['current_balance'].sum()
                
                if total_balance > 0:
                    # Calculate aging buckets
                    current_30 = month_ar[month_ar['days_outstanding'] <= 30]['current_balance'].sum()
                    days_31_60 = month_ar[(month_ar['days_outstanding'] > 30) & 
                                         (month_ar['days_outstanding'] <= 60)]['current_balance'].sum()
                    days_61_90 = month_ar[(month_ar['days_outstanding'] > 60) & 
                                         (month_ar['days_outstanding'] <= 90)]['current_balance'].sum()
                    over_90 = month_ar[month_ar['days_outstanding'] > 90]['current_balance'].sum()
                    
                    aging_trends.append({
                        'month': month_end,
                        'total': total_balance,
                        'current_30_pct': current_30 / total_balance,
                        'days_31_60_pct': days_31_60 / total_balance,
                        'days_61_90_pct': days_61_90 / total_balance,
                        'over_90_pct': over_90 / total_balance,
                        'over_60_pct': (days_61_90 + over_90) / total_balance, 'detail_ref': ''
})
        
        if len(aging_trends) >= 6:
            # Analyze recent vs prior periods
            recent_3 = aging_trends[-3:]
            prior_3 = aging_trends[-6:-3]
            
            recent_over_90 = np.mean([a['over_90_pct'] for a in recent_3])
            prior_over_90 = np.mean([a['over_90_pct'] for a in prior_3])
            
            # Flag deteriorating aging
            if recent_over_90 > 0.20:
                severity = 'Critical' if recent_over_90 > 0.35 else 'High'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'High Aged Receivables >90 Days',
                    'severity': severity,
                    'detail': f'{recent_over_90:.1%} of AR over 90 days',
                    'impact': 'High bad debt risk and cash flow issues',
                    'action': 'Implement aggressive collection procedures for aged receivables',
                    'amount': aging_trends[-1]['total'] * recent_over_90,
                    'period': 'Current'
                })
            
            # Flag deteriorating trend
            deterioration = recent_over_90 - prior_over_90
            if deterioration > 0.05:  # 5 percentage point increase
                severity = 'High' if deterioration > 0.10 else 'Medium'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'Deteriorating AR Aging Trend',
                    'severity': severity,
                    'detail': f'Aging >90 days increased by {deterioration:.1%} over 3 months',
                    'impact': 'Worsening collection efficiency',
                    'action': 'Review collection procedures and client payment terms',
                    'amount': aging_trends[-1]['total'] * deterioration,
                    'period': 'Trend analysis'
                })
    
    def _analyze_collection_efficiency(self):
        """Analyze collection efficiency metrics"""
        current_ar = self.ar_data[self.ar_data['month_end_date'] == self.ar_data['month_end_date'].max()]
        
        if len(current_ar) > 0:
            total_balance = current_ar['current_balance'].sum()
            
            if total_balance > 0:
                # Current collection ratios
                over_60_balance = current_ar[current_ar['days_outstanding'] > 60]['current_balance'].sum()
                over_90_balance = current_ar[current_ar['days_outstanding'] > 90]['current_balance'].sum()
                over_120_balance = current_ar[current_ar['days_outstanding'] > 120]['current_balance'].sum()
                
                over_60_pct = over_60_balance / total_balance
                over_90_pct = over_90_balance / total_balance
                over_120_pct = over_120_balance / total_balance
                
                # Flag concerning aging levels
                if over_60_pct > 0.30:
                    severity = 'High' if over_60_pct > 0.45 else 'Medium'
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'High Receivables Over 60 Days',
                        'severity': severity,
                        'detail': f'{over_60_pct:.1%} of AR over 60 days old',
                        'impact': 'Collection efficiency concerns',
                        'action': 'Strengthen collection procedures for 60+ day receivables',
                        'amount': over_60_balance,
                        'period': 'Current'
                    })
                
                if over_120_pct > 0.15:
                    severity = 'Critical' if over_120_pct > 0.25 else 'High'
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'Excessive Receivables Over 120 Days',
                        'severity': severity,
                        'detail': f'{over_120_pct:.1%} of AR over 120 days old',
                        'impact': 'High probability of bad debt',
                        'action': 'Consider write-off and legal collection for 120+ day receivables',
                        'amount': over_120_balance,
                        'period': 'Current'
                    })
    
    def _analyze_dso_trends(self):
        """Analyze Days Sales Outstanding trends"""
        month_ends = sorted(self.ar_data['month_end_date'].unique())
        
        if len(month_ends) < 6:
            return
        
        dso_trends = []
        
        for month_end in month_ends:
            month_ar = self.ar_data[self.ar_data['month_end_date'] == month_end]
            if len(month_ar) > 0:
                total_balance = month_ar['current_balance'].sum()
                if total_balance > 0:
                    # Weighted average DSO
                    weighted_days = (month_ar['current_balance'] * month_ar['days_outstanding']).sum() / total_balance
                    dso_trends.append({'month': month_end, 'dso': weighted_days, 'detail_ref': ''
})
        
        if len(dso_trends) >= 6:
            current_dso = dso_trends[-1]['dso']
            prior_dso = dso_trends[-6]['dso']
            
            # Flag high current DSO
            if current_dso > 60:
                severity = 'Critical' if current_dso > 90 else 'High' if current_dso > 75 else 'Medium'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'High Days Sales Outstanding',
                    'severity': severity,
                    'detail': f'Current DSO: {current_dso:.0f} days',
                    'impact': 'Extended cash conversion cycle affecting liquidity',
                    'action': 'Implement strategies to reduce DSO to <45 days',
                    'amount': current_dso,
                    'period': 'Current'
                })
            
            # Flag deteriorating DSO trend
            dso_change = current_dso - prior_dso
            if dso_change > 10:  # 10+ day increase
                severity = 'High' if dso_change > 20 else 'Medium'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'Deteriorating DSO Trend',
                    'severity': severity,
                    'detail': f'DSO increased by {dso_change:.0f} days over 6 months',
                    'impact': 'Worsening cash flow timing',
                    'action': 'Investigate causes of DSO deterioration',
                    'amount': dso_change,
                    'period': '6-month trend'
                })
    
    def _analyze_writeoff_patterns(self):
        """Analyze write-off patterns and trends"""
        # Find write-off transactions in GL
        writeoff_data = self.gl_data[
            self.gl_data['description'].str.contains(
                'write.?off|bad.?debt|uncollect|loss', case=False, na=False)
        ].copy()
        
        if len(writeoff_data) > 0:
            annual_revenue = sum([m['p_and_l']['revenue'] for m in self.monthly_financials.values()])
            annual_writeoffs = abs(writeoff_data['net_amount'].sum())
            
            if annual_revenue > 0:
                writeoff_pct = annual_writeoffs / annual_revenue
                
                if writeoff_pct > 0.03:  # >3% writeoffs
                    severity = 'Critical' if writeoff_pct > 0.08 else 'High' if writeoff_pct > 0.05 else 'Medium'
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'High Write-Off Rate',
                        'severity': severity,
                        'detail': f'Write-offs: {writeoff_pct:.1%} of revenue',
                        'impact': 'Poor realization rates affecting profitability',
                        'action': 'Review credit policies and collection procedures',
                        'amount': annual_writeoffs,
                        'period': 'Annual'
                    })
            
            # Analyze write-off timing patterns
            writeoff_data['month'] = writeoff_data['transaction_date'].dt.month
            writeoff_data['quarter'] = writeoff_data['transaction_date'].dt.quarter
            
            # Check for quarter-end write-off bunching
            q4_writeoffs = writeoff_data[writeoff_data['quarter'] == 4]['net_amount'].sum()
            total_writeoffs = writeoff_data['net_amount'].sum()
            
            if abs(total_writeoffs) > 0:
                q4_pct = abs(q4_writeoffs) / abs(total_writeoffs)
                
                if q4_pct > 0.40:  # >40% in Q4
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'Quarter-End Write-Off Bunching',
                        'severity': 'Medium',
                        'detail': f'{q4_pct:.1%} of write-offs in Q4',
                        'impact': 'Potential earnings management through write-off timing',
                        'action': 'Review write-off timing and approval procedures',
                        'amount': abs(q4_writeoffs),
                        'period': 'Q4 concentration'
                    })
    
    def _analyze_cash_flow_quality(self):
        """Analyze cash flow vs earnings quality"""
        if len(self.monthly_financials) < 6:
            return
        
        recent_months = list(self.monthly_financials.values())[-6:]
        total_ni = sum([(
    m['p_and_l'].get('revenue', 0)
    - m['p_and_l'].get('cogs', 0)
    - m['p_and_l'].get('operating_expenses', 0)
    + m['p_and_l'].get('other_income', 0)
    - m['p_and_l'].get('other_expenses', 0)
) for m in recent_months])
        total_revenue = sum([m['p_and_l']['revenue'] for m in recent_months])
        
        if total_revenue > 0:
            # Flag unusually high margins (potential accrual manipulation)
            ni_margin = total_ni / total_revenue
            if ni_margin > 0.25:  # >25% net margin is high for professional services
                severity = 'Medium' if ni_margin < 0.35 else 'High'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'Unusually High Profit Margins',
                    'severity': severity,
                    'detail': f'Net income margin: {ni_margin:.1%}',
                    'impact': 'Potential expense deferral or revenue acceleration',
                    'action': 'Review expense recognition and accrual policies',
                    'amount': total_ni,
                    'period': 'Last 6 months'
                })
        
        # Analyze AR growth vs revenue growth
        ar_dates = sorted(self.ar_data['month_end_date'].unique())
        
        # Check if we have enough data for comparison (need at least 7 dates to look back 6 months)
        if len(self.monthly_financials) >= 12 and len(ar_dates) >= 7:
            current_6_revenue = sum([m['p_and_l']['revenue'] for m in recent_months])
            prior_6_revenue = sum([m['p_and_l']['revenue'] for m in list(self.monthly_financials.values())[-12:-6]])
            
            current_ar = self.ar_data[self.ar_data['month_end_date'] == self.ar_data['month_end_date'].max()]['current_balance'].sum()
            prior_ar_date = ar_dates[-7]  # 6 months ago (now safe because we checked length)
            prior_ar = self.ar_data[self.ar_data['month_end_date'] == prior_ar_date]['current_balance'].sum()
            
            if prior_6_revenue > 0 and prior_ar > 0:
                revenue_growth = (current_6_revenue - prior_6_revenue) / prior_6_revenue
                ar_growth = (current_ar - prior_ar) / prior_ar
                
                # AR growing much faster than revenue
                if ar_growth > revenue_growth + 0.20:  # AR growth >20pp higher than revenue growth
                    severity = 'High' if ar_growth > revenue_growth + 0.35 else 'Medium'
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'AR Growth Exceeds Revenue Growth',
                        'severity': severity,
                        'detail': f'AR growth: {ar_growth:.1%} vs Revenue growth: {revenue_growth:.1%}',
                        'impact': 'Potential quality of earnings issues',
                        'action': 'Investigate AR growth causes and collection efficiency',
                        'amount': current_ar - (prior_ar * (1 + revenue_growth)),
                        'period': '6-month comparison'
                    })
        elif len(ar_dates) < 7:
            # Add a flag indicating insufficient data for this analysis
            self.flags.append({
                'detail_ref': '',
                'flag': 'Insufficient AR Data for Growth Analysis',
                'severity': 'Low',
                'detail': f'Only {len(ar_dates)} months of AR data available (need 7+ for trend analysis)',
                'impact': 'Cannot perform comprehensive AR growth analysis',
                'action': 'Collect more historical AR data for better trend analysis',
                'amount': 0,
                'period': 'Data limitation'
            })
    
    def _analyze_working_capital(self):
        """Analyze working capital trends"""
        # This would require balance sheet data - simplified analysis using AR
        month_ends = sorted(self.ar_data['month_end_date'].unique())
        
        if len(month_ends) >= 6:
            current_ar = self.ar_data[self.ar_data['month_end_date'] == month_ends[-1]]['current_balance'].sum()
            prior_ar = self.ar_data[self.ar_data['month_end_date'] == month_ends[-6]]['current_balance'].sum()
            
            if prior_ar > 0:
                ar_change_pct = (current_ar - prior_ar) / prior_ar
                
                # Significant AR increase
                if ar_change_pct > 0.30:
                    severity = 'High' if ar_change_pct > 0.50 else 'Medium'
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'Significant AR Balance Increase',
                        'severity': severity,
                        'detail': f'AR balance increased {ar_change_pct:.1%} in 6 months',
                        'impact': 'Working capital strain and collection concerns',
                        'action': 'Review AR growth causes and collection strategies',
                        'amount': current_ar - prior_ar,
                        'period': '6-month change'
                    })
    
    def _analyze_bad_debt_indicators(self):
        """Analyze indicators of potential bad debt"""
        current_ar = self.ar_data[self.ar_data['month_end_date'] == self.ar_data['month_end_date'].max()]
        
        if len(current_ar) > 0:
            # Identify clients with consistently old balances
            problem_clients = current_ar[current_ar['days_outstanding'] > 90]
            
            if len(problem_clients) > 0:
                total_balance = current_ar['current_balance'].sum()
                problem_balance = problem_clients['current_balance'].sum()
                problem_pct = problem_balance / total_balance if total_balance > 0 else 0
                
                # Flag clients with very old balances
                very_old_clients = current_ar[current_ar['days_outstanding'] > 180]
                if len(very_old_clients) > 0:
                    very_old_balance = very_old_clients['current_balance'].sum()
                    very_old_pct = very_old_balance / total_balance if total_balance > 0 else 0
                    
                    if very_old_pct > 0.05:  # >5% of AR over 180 days
                        severity = 'Critical' if very_old_pct > 0.15 else 'High'
                        self.flags.append({
                            'detail_ref': '',
                            'flag': 'Receivables Over 180 Days Outstanding',
                            'severity': severity,
                            'detail': f'{very_old_pct:.1%} of AR over 180 days old',
                            'impact': 'Very high bad debt probability',
                            'action': 'Immediate write-off consideration for 180+ day receivables',
                            'amount': very_old_balance,
                            'period': 'Current'
                        })
                
                # Analyze individual large old balances
                large_old_threshold = total_balance * 0.05  # 5% of total AR
                large_old_balances = problem_clients[
                    problem_clients['current_balance'] > large_old_threshold
                ]
                
                if len(large_old_balances) > 0:
                    for _, client_row in large_old_balances.iterrows():
                        self.flags.append({
                            'detail_ref': '',
                            'flag': 'Large Individual Aged Receivable',
                            'severity': 'High',
                            'detail': f'{client_row["client_name"]}: ${client_row["current_balance"]:,.0f} outstanding for {client_row["days_outstanding"]:.0f} days',
                            'impact': 'Significant bad debt risk from single client',
                            'action': f'Urgent collection action required for {client_row["client_name"]}',
                            'amount': client_row['current_balance'],
                            'period': 'Current'
                        })
            
            # Check for clients with multiple old invoices
            client_old_counts = problem_clients.groupby('client_name').size()
            clients_multiple_old = client_old_counts[client_old_counts > 3]  # >3 old invoices
            
            if len(clients_multiple_old) > 0:
                for client in clients_multiple_old.index:
                    client_balance = current_ar[current_ar['client_name'] == client]['current_balance'].sum()
                    old_count = clients_multiple_old[client]
                    
                    self.flags.append({
                    
                        'detail_ref': '',
                        'flag': 'Client with Multiple Aged Receivables',
                        'severity': 'Medium',
                        'detail': f'{client}: {old_count} receivables >90 days, total ${client_balance:,.0f}',
                        'impact': 'Pattern of payment issues with client',
                        'action': f'Review payment arrangements and credit terms for {client}',
                        'amount': client_balance,
                        'period': 'Current'
                    })
