# phase1_revenue_analysis.py
"""
Phase 1: Comprehensive Revenue Quality Analysis
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class RevenueAnalyzer:
    """Comprehensive revenue quality analysis"""
    
    def __init__(self, gl_data, ar_data, monthly_financials):
        self.gl_data = gl_data
        self.ar_data = ar_data
        self.monthly_financials = monthly_financials
        self.flags = []
    
    def analyze_all(self):
        """Run all revenue analyses"""
        print("   • Revenue timing manipulation...")
        self._analyze_revenue_timing()
        
        print("   • Revenue recognition quality...")
        self._analyze_revenue_quality()
        
        print("   • Revenue volatility patterns...")
        self._analyze_revenue_volatility()
        
        print("   • Period-end revenue spikes...")
        self._analyze_period_end_spikes()
        
        print("   • Revenue decline trends...")
        self._analyze_revenue_decline()
        
        print("   • Service line concentration...")
        self._analyze_service_line_risk()
        
        print("   • Month-end revenue bunching...")
        self._analyze_month_end_bunching()
        
        print("   • Revenue lumpiness...")
        self._analyze_revenue_lumpiness()
        
        return self.flags
    
    def _analyze_revenue_timing(self):
        """Detect revenue timing manipulation"""
        revenue_data = self.gl_data[
            self.gl_data['account_number'].astype(str).str.startswith('4')
        ].copy()
        
        if len(revenue_data) == 0:
            return
        
        revenue_data['day_of_month'] = revenue_data['transaction_date'].dt.day
        revenue_data['month_year'] = revenue_data['transaction_date'].dt.to_period('M')
        
        for month in revenue_data['month_year'].unique():
            month_data = revenue_data[revenue_data['month_year'] == month]
            total_revenue = month_data['net_amount'].sum()
            
            if total_revenue > 0:
                # Last 3 days of month
                last_3_days = month_data[month_data['day_of_month'] >= 28]
                last_3_days_revenue = last_3_days['net_amount'].sum()
                spike_percentage = last_3_days_revenue / total_revenue
                
                if spike_percentage > 0.15:
                    severity = 'High' if spike_percentage > 0.25 else 'Medium'
                    self.flags.append({
                        'flag': 'Month-End Revenue Spike',
                        'severity': severity,
                        'detail': f'{spike_percentage:.1%} of {month} revenue in last 3 days',
                        'impact': 'Potential revenue manipulation',
                        'action': 'Review revenue recognition policies and timing',
                        'amount': last_3_days_revenue,
                        'period': str(month)
                    })
                
                # Last day concentration
                last_day = month_data[month_data['day_of_month'] >= 30]
                if len(last_day) > 0:
                    last_day_revenue = last_day['net_amount'].sum()
                    last_day_pct = last_day_revenue / total_revenue
                    
                    if last_day_pct > 0.10:
                        self.flags.append({
                            'flag': 'Last-Day Revenue Concentration',
                            'severity': 'Medium',
                            'detail': f'{last_day_pct:.1%} of {month} revenue on last day',
                            'impact': 'Revenue timing concerns',
                            'action': 'Investigate last-day revenue transactions',
                            'amount': last_day_revenue,
                            'period': str(month)
                        })
    
    def _analyze_revenue_quality(self):
        """Analyze overall revenue quality"""
        monthly_revenues = [m['p_and_l']['revenue'] for m in self.monthly_financials.values()]
        
        if len(monthly_revenues) > 6:
            # Revenue coefficient of variation
            revenue_cv = np.std(monthly_revenues) / np.mean(monthly_revenues) if np.mean(monthly_revenues) > 0 else 0
            
            if revenue_cv > 0.30:
                severity = 'High' if revenue_cv > 0.50 else 'Medium'
                self.flags.append({
                    'flag': 'High Revenue Volatility',
                    'severity': severity,
                    'detail': f'Revenue coefficient of variation: {revenue_cv:.1%}',
                    'impact': 'Unpredictable revenue stream affects planning',
                    'action': 'Develop recurring revenue streams and improve forecasting',
                    'amount': np.mean(monthly_revenues),
                    'period': 'Overall'
                })
            
            # Revenue growth consistency
            if len(monthly_revenues) >= 12:
                growth_rates = []
                for i in range(1, len(monthly_revenues)):
                    if monthly_revenues[i-1] > 0:
                        growth_rate = (monthly_revenues[i] - monthly_revenues[i-1]) / monthly_revenues[i-1]
                        growth_rates.append(growth_rate)
                
                if len(growth_rates) > 0:
                    growth_cv = np.std(growth_rates) / (abs(np.mean(growth_rates)) + 0.01)
                    
                    if growth_cv > 2.0:
                        self.flags.append({
                            'flag': 'Inconsistent Revenue Growth',
                            'severity': 'Medium',
                            'detail': f'Highly variable growth patterns',
                            'impact': 'Difficult to predict future performance',
                            'action': 'Analyze growth drivers and stabilize revenue sources',
                            'amount': np.mean(monthly_revenues),
                            'period': 'Growth analysis'
                        })
    
    def _analyze_revenue_volatility(self):
        """Analyze month-to-month revenue volatility"""
        if len(self.monthly_financials) < 6:
            return
        
        revenues = []
        dates = []
        for date, financials in sorted(self.monthly_financials.items()):
            revenues.append(financials['p_and_l']['revenue'])
            dates.append(date)
        
        # Calculate month-to-month changes
        monthly_changes = []
        for i in range(1, len(revenues)):
            if revenues[i-1] != 0:
                change_pct = abs(revenues[i] - revenues[i-1]) / revenues[i-1]
                monthly_changes.append(change_pct)
        
        if monthly_changes:
            avg_volatility = np.mean(monthly_changes)
            max_volatility = max(monthly_changes)
            
            if avg_volatility > 0.20:
                severity = 'High' if avg_volatility > 0.35 else 'Medium'
                self.flags.append({
                    'flag': 'High Month-to-Month Revenue Volatility',
                    'severity': severity,
                    'detail': f'Average monthly change: {avg_volatility:.1%}, Max: {max_volatility:.1%}',
                    'impact': 'Cash flow planning difficulties',
                    'action': 'Investigate revenue volatility causes and smooth revenue streams',
                    'amount': np.mean(revenues),
                    'period': 'Monthly analysis'
                })
    
    def _analyze_period_end_spikes(self):
        """Analyze quarter-end and year-end revenue spikes"""
        revenue_data = self.gl_data[
            self.gl_data['account_number'].astype(str).str.startswith('4')
        ].copy()
        
        if len(revenue_data) == 0:
            return
        
        revenue_data['quarter'] = revenue_data['transaction_date'].dt.quarter
        revenue_data['year'] = revenue_data['transaction_date'].dt.year
        revenue_data['month'] = revenue_data['transaction_date'].dt.month
        
        # Quarter-end analysis (March, June, September, December)
        quarter_end_months = [3, 6, 9, 12]
        
        for year in revenue_data['year'].unique():
            year_data = revenue_data[revenue_data['year'] == year]
            total_year_revenue = year_data['net_amount'].sum()
            
            if total_year_revenue > 0:
                quarter_end_revenue = year_data[
                    year_data['month'].isin(quarter_end_months)
                ]['net_amount'].sum()
                
                quarter_end_pct = quarter_end_revenue / total_year_revenue
                
                # Expect ~33% in quarter-end months (4 months out of 12)
                if quarter_end_pct > 0.45:
                    severity = 'High' if quarter_end_pct > 0.55 else 'Medium'
                    self.flags.append({
                        'flag': 'Quarter-End Revenue Concentration',
                        'severity': severity,
                        'detail': f'{quarter_end_pct:.1%} of {year} revenue in quarter-end months',
                        'impact': 'Potential earnings management',
                        'action': 'Review quarter-end revenue recognition practices',
                        'amount': quarter_end_revenue,
                        'period': str(year)
                    })
    
    def _analyze_revenue_decline(self):
        """Detect concerning revenue decline trends"""
        if len(self.monthly_financials) < 6:
            return
        
        revenues = []
        for date, financials in sorted(self.monthly_financials.items()):
            revenues.append(financials['p_and_l']['revenue'])
        
        # Check for declining trend over last 6 months
        if len(revenues) >= 6:
            recent_6 = revenues[-6:]
            earlier_6 = revenues[-12:-6] if len(revenues) >= 12 else revenues[:-6]
            
            if earlier_6:
                recent_avg = np.mean(recent_6)
                earlier_avg = np.mean(earlier_6)
                
                if earlier_avg > 0:
                    decline_pct = (earlier_avg - recent_avg) / earlier_avg
                    
                    if decline_pct > 0.10:
                        severity = 'Critical' if decline_pct > 0.25 else 'High'
                        self.flags.append({
                            'flag': 'Significant Revenue Decline Trend',
                            'severity': severity,
                            'detail': f'{decline_pct:.1%} revenue decline over 6 months',
                            'impact': 'Business sustainability concerns',
                            'action': 'Immediate investigation of revenue decline causes',
                            'amount': recent_avg - earlier_avg,
                            'period': 'Last 6 months'
                        })
        
        # Check for consecutive declining months
        declining_months = 0
        for i in range(1, len(revenues)):
            if revenues[i] < revenues[i-1]:
                declining_months += 1
            else:
                declining_months = 0
        
        if declining_months >= 3:
            severity = 'High' if declining_months >= 4 else 'Medium'
            self.flags.append({
                'flag': f'{declining_months} Consecutive Months of Revenue Decline',
                'severity': severity,
                'detail': f'Revenue declining for {declining_months} straight months',
                'impact': 'Concerning business trend',
                'action': 'Analyze market conditions and business strategy',
                'amount': revenues[-1] - revenues[-declining_months-1] if len(revenues) > declining_months else 0,
                'period': f'Last {declining_months} months'
            })
    
    def _analyze_service_line_risk(self):
        """Analyze service line concentration risk"""
        # Analyze revenue by service type if account structure allows
        revenue_data = self.gl_data[
            self.gl_data['account_number'].astype(str).str.startswith('4')
        ].copy()
        
        if len(revenue_data) == 0:
            return
        
        # Group by account name/description to identify service lines
        service_revenues = revenue_data.groupby('account_name')['net_amount'].sum().sort_values(ascending=False)
        total_revenue = service_revenues.sum()
        
        if total_revenue > 0 and len(service_revenues) > 1:
            top_service_pct = service_revenues.iloc[0] / total_revenue
            top_3_pct = service_revenues.head(3).sum() / total_revenue
            
            if top_service_pct > 0.60:
                severity = 'High' if top_service_pct > 0.75 else 'Medium'
                self.flags.append({
                    'flag': 'Single Service Line Dependency',
                    'severity': severity,
                    'detail': f'Top service: {top_service_pct:.1%} of revenue ({service_revenues.index[0]})',
                    'impact': 'High concentration risk',
                    'action': 'Diversify service offerings',
                    'amount': service_revenues.iloc[0],
                    'period': 'Overall'
                })
            
            if top_3_pct > 0.85:
                self.flags.append({
                    'flag': 'Limited Service Line Diversification',
                    'severity': 'Medium',
                    'detail': f'Top 3 services: {top_3_pct:.1%} of revenue',
                    'impact': 'Limited revenue diversification',
                    'action': 'Expand service portfolio',
                    'amount': service_revenues.head(3).sum(),
                    'period': 'Overall'
                })
    
    def _analyze_month_end_bunching(self):
        """Analyze revenue bunching at month-end"""
        revenue_data = self.gl_data[
            self.gl_data['account_number'].astype(str).str.startswith('4')
        ].copy()
        
        if len(revenue_data) == 0:
            return
        
        revenue_data['day_of_month'] = revenue_data['transaction_date'].dt.day
        revenue_data['days_from_end'] = revenue_data['transaction_date'].dt.days_in_month - revenue_data['day_of_month']
        
        # Analyze revenue in last 5 days of each month
        last_5_days_revenue = revenue_data[revenue_data['days_from_end'] <= 4]['net_amount'].sum()
        total_revenue = revenue_data['net_amount'].sum()
        
        if total_revenue > 0:
            last_5_days_pct = last_5_days_revenue / total_revenue
            
            # Expect roughly 16% (5/31 days)
            if last_5_days_pct > 0.25:
                severity = 'Medium' if last_5_days_pct < 0.35 else 'High'
                self.flags.append({
                    'flag': 'Month-End Revenue Bunching',
                    'severity': severity,
                    'detail': f'{last_5_days_pct:.1%} of revenue in last 5 days of months',
                    'impact': 'Potential revenue timing issues',
                    'action': 'Review revenue recognition timing controls',
                    'amount': last_5_days_revenue,
                    'period': 'Overall pattern'
                })
    
    def _analyze_revenue_lumpiness(self):
        """Analyze for unusually large individual transactions"""
        revenue_data = self.gl_data[
            self.gl_data['account_number'].astype(str).str.startswith('4')
        ].copy()
        
        if len(revenue_data) == 0:
            return
        
        # Find large individual transactions
        revenue_amounts = revenue_data['net_amount']
        total_revenue = revenue_amounts.sum()
        mean_transaction = revenue_amounts.mean()
        std_transaction = revenue_amounts.std()
        
        if total_revenue > 0 and std_transaction > 0:
            # Find transactions > 3 standard deviations above mean
            large_threshold = mean_transaction + (3 * std_transaction)
            large_transactions = revenue_data[revenue_data['net_amount'] > large_threshold]
            
            if len(large_transactions) > 0:
                large_total = large_transactions['net_amount'].sum()
                large_pct = large_total / total_revenue
                
                if large_pct > 0.20:
                    severity = 'High' if large_pct > 0.35 else 'Medium'
                    self.flags.append({
                        'flag': 'Lumpy Revenue Pattern',
                        'severity': severity,
                        'detail': f'{len(large_transactions)} large transactions = {large_pct:.1%} of revenue',
                        'impact': 'Revenue unpredictability and client dependency',
                        'action': 'Review large transaction sources and reduce lumpiness',
                        'amount': large_total,
                        'period': 'Overall'
                    })
                
                # Check if large transactions are concentrated with few clients
                if 'client_name' in large_transactions.columns:
                    unique_clients = large_transactions['client_name'].nunique()
                    total_clients = revenue_data['client_name'].nunique() if 'client_name' in revenue_data.columns else 1
                    
                    if unique_clients <= 3 and total_clients > 5:
                        self.flags.append({
                            'flag': 'Large Transactions from Few Clients',
                            'severity': 'High',
                            'detail': f'{len(large_transactions)} large transactions from only {unique_clients} clients',
                            'impact': 'High client concentration and revenue risk',
                            'action': 'Diversify client base and reduce dependency',
                            'amount': large_total,
                            'period': 'Overall'
                        })
