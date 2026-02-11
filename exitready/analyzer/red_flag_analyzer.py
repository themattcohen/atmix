import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class RedFlagAnalyzer:
    """Comprehensive red flag detection for accounting firms based on GL and AR data"""
    
    def __init__(self, gl_data, ar_data, monthly_financials):
        self.gl_data = gl_data
        self.ar_data = ar_data
        self.monthly_financials = monthly_financials
        self.red_flags = []
        
    def run_all_analyses(self):
        """Run ALL red flag detection procedures"""
        print("   Running revenue quality analysis...")
        self._analyze_revenue_timing_issues()
        self._analyze_revenue_recognition_quality()
        
        print("   Running client concentration analysis...")
        self._analyze_client_concentration()
        self._analyze_client_volatility()
        
        print("   Running collection efficiency analysis...")
        self._analyze_ar_aging_deterioration()
        self._analyze_collection_efficiency()
        
        print("   Running cash flow quality analysis...")
        self._analyze_cash_flow_vs_earnings()
        
        print("   Running expense analysis...")
        self._analyze_expense_timing_manipulation()
        
        print("   Running professional services metrics...")
        self._analyze_realization_rates()
        self._analyze_utilization_trends()
        
        print("   Running operational red flags...")
        self._analyze_seasonality_risks()
        
        # Sort red flags by severity and materiality
        self.red_flags.sort(key=lambda x: (
            {'High': 3, 'Medium': 2, 'Low': 1}[x['severity']], 
            abs(x.get('amount', 0))
        ), reverse=True)
        
        return self.red_flags
    
    def _analyze_revenue_timing_issues(self):
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
                last_3_days = month_data[month_data['day_of_month'] >= 28]
                last_3_days_revenue = last_3_days['net_amount'].sum()
                spike_percentage = last_3_days_revenue / total_revenue
                
                if spike_percentage > 0.15:
                    severity = 'High' if spike_percentage > 0.25 else 'Medium'
                    self.red_flags.append({
                        'flag': 'Month-End Revenue Spike',
                        'severity': severity,
                        'detail': f'{spike_percentage:.1%} of {month} revenue in last 3 days',
                        'impact': 'Potential revenue manipulation',
                        'action': 'Review revenue recognition policies',
                        'amount': last_3_days_revenue,
                        'period': str(month)
                    })
    
    def _analyze_revenue_recognition_quality(self):
        """Analyze revenue quality"""
        monthly_revenues = [m['p_and_l']['revenue'] for m in self.monthly_financials.values()]
        
        if len(monthly_revenues) > 6:
            revenue_cv = np.std(monthly_revenues) / np.mean(monthly_revenues) if np.mean(monthly_revenues) > 0 else 0
            
            if revenue_cv > 0.30:
                severity = 'High' if revenue_cv > 0.50 else 'Medium'
                self.red_flags.append({
                    'flag': 'High Revenue Volatility',
                    'severity': severity,
                    'detail': f'Revenue coefficient of variation: {revenue_cv:.1%}',
                    'impact': 'Unpredictable revenue stream',
                    'action': 'Develop recurring revenue streams',
                    'amount': np.mean(monthly_revenues),
                    'period': 'Overall'
                })
    
    def _analyze_client_concentration(self):
        """Analyze client concentration"""
        client_revenues = self.ar_data.groupby('client_name')['original_amount'].sum().sort_values(ascending=False)
        total_revenue = client_revenues.sum()
        
        if total_revenue > 0:
            top_1_pct = client_revenues.iloc[0] / total_revenue if len(client_revenues) > 0 else 0
            if top_1_pct > 0.15:
                severity = 'High' if top_1_pct > 0.25 else 'Medium'
                self.red_flags.append({
                    'flag': 'Single Client Dependency',
                    'severity': severity,
                    'detail': f'Largest client: {top_1_pct:.1%} of revenue',
                    'impact': 'Critical business risk',
                    'action': 'Reduce dependency on largest client',
                    'amount': client_revenues.iloc[0] if len(client_revenues) > 0 else 0,
                    'period': 'Overall'
                })
            
            top_5_pct = client_revenues.head(5).sum() / total_revenue
            if top_5_pct > 0.40:
                severity = 'High' if top_5_pct > 0.60 else 'Medium'
                self.red_flags.append({
                    'flag': 'High Client Concentration - Top 5',
                    'severity': severity,
                    'detail': f'Top 5 clients: {top_5_pct:.1%} of revenue',
                    'impact': 'High dependency risk',
                    'action': 'Diversify client base',
                    'amount': client_revenues.head(5).sum(),
                    'period': 'Overall'
                })
    
    def _analyze_client_volatility(self):
        """Analyze client volatility"""
        client_monthly = self.ar_data.groupby(['client_name', 'month_end_date'])['original_amount'].sum().reset_index()
        total_revenue = self.ar_data['original_amount'].sum()
        
        for client in client_monthly['client_name'].unique():
            client_data = client_monthly[client_monthly['client_name'] == client]
            if len(client_data) > 3:
                revenues = client_data['original_amount'].values
                mean_revenue = np.mean(revenues)
                cv = np.std(revenues) / mean_revenue if mean_revenue > 0 else 0
                client_revenue_pct = np.sum(revenues) / total_revenue if total_revenue > 0 else 0
                
                if cv > 1.0 and client_revenue_pct > 0.05:
                    self.red_flags.append({
                        'flag': 'Major Client Revenue Volatility',
                        'severity': 'Medium',
                        'detail': f'{client}: {cv:.1f} revenue volatility',
                        'impact': 'Unpredictable revenue from major client',
                        'action': f'Review service agreement with {client}',
                        'amount': mean_revenue,
                        'period': 'Per client'
                    })
    
    def _analyze_ar_aging_deterioration(self):
        """Analyze AR aging trends"""
        month_ends = sorted(self.ar_data['month_end_date'].unique())
        
        if len(month_ends) > 3:
            dso_trends = []
            
            for month_end in month_ends:
                month_ar = self.ar_data[self.ar_data['month_end_date'] == month_end]
                if len(month_ar) > 0:
                    total_balance = month_ar['current_balance'].sum()
                    if total_balance > 0:
                        weighted_days = (month_ar['current_balance'] * month_ar['days_outstanding']).sum() / total_balance
                        dso_trends.append(weighted_days)
            
            if len(dso_trends) > 6:
                current_dso = dso_trends[-1] if dso_trends else 0
                if current_dso > 60:
                    severity = 'High' if current_dso > 90 else 'Medium'
                    self.red_flags.append({
                        'flag': 'High Days Sales Outstanding',
                        'severity': severity,
                        'detail': f'Current DSO: {current_dso:.0f} days',
                        'impact': 'Cash flow constraints',
                        'action': 'Implement aggressive collection',
                        'amount': current_dso,
                        'period': 'Current'
                    })
    
    def _analyze_collection_efficiency(self):
        """Analyze collection efficiency"""
        current_ar = self.ar_data[self.ar_data['month_end_date'] == self.ar_data['month_end_date'].max()]
        
        if len(current_ar) > 0:
            total_balance = current_ar['current_balance'].sum()
            
            if total_balance > 0:
                over_90_balance = current_ar[current_ar['days_outstanding'] > 90]['current_balance'].sum()
                over_90_pct = over_90_balance / total_balance
                
                if over_90_pct > 0.20:
                    severity = 'High' if over_90_pct > 0.35 else 'Medium'
                    self.red_flags.append({
                        'flag': 'High Aged Receivables >90 Days',
                        'severity': severity,
                        'detail': f'{over_90_pct:.1%} of AR over 90 days',
                        'impact': 'Bad debt risk',
                        'action': 'Focus on aged receivables collection',
                        'amount': over_90_balance,
                        'period': 'Current'
                    })
    
    def _analyze_cash_flow_vs_earnings(self):
        """Analyze cash flow quality"""
        if len(self.monthly_financials) > 6:
            recent_months = list(self.monthly_financials.values())[-6:]
            total_ni = sum([m['p_and_l']['net_income'] for m in recent_months])
            total_revenue = sum([m['p_and_l']['revenue'] for m in recent_months])
            
            if total_revenue > 0:
                ni_margin = total_ni / total_revenue
                if ni_margin > 0.25:
                    self.red_flags.append({
                        'flag': 'Unusually High Profit Margins',
                        'severity': 'Medium',
                        'detail': f'Net income margin: {ni_margin:.1%}',
                        'impact': 'Potential expense manipulation',
                        'action': 'Review expense recognition policies',
                        'amount': total_ni,
                        'period': 'Last 6 months'
                    })
    
    def _analyze_expense_timing_manipulation(self):
        """Detect expense timing issues"""
        expense_data = self.gl_data[
            self.gl_data['account_number'].astype(str).str.startswith(('6', '7'))
        ].copy()
        
        if len(expense_data) > 0:
            expense_data['day_of_month'] = expense_data['transaction_date'].dt.day
            expense_data['month_year'] = expense_data['transaction_date'].dt.to_period('M')
            
            for month in expense_data['month_year'].unique():
                month_data = expense_data[expense_data['month_year'] == month]
                total_expenses = abs(month_data['net_amount'].sum())
                
                if total_expenses > 0:
                    last_day = month_data[month_data['day_of_month'] >= 28]
                    last_day_expenses = abs(last_day['net_amount'].sum())
                    last_day_pct = last_day_expenses / total_expenses
                    
                    if last_day_pct > 0.20:
                        self.red_flags.append({
                            'flag': 'Month-End Expense Bunching',
                            'severity': 'Medium',
                            'detail': f'{last_day_pct:.1%} of {month} expenses on last day',
                            'impact': 'Potential expense timing manipulation',
                            'action': 'Review expense accrual procedures',
                            'amount': last_day_expenses,
                            'period': str(month)
                        })
    
    def _analyze_realization_rates(self):
        """Analyze billing realization"""
        writeoff_data = self.gl_data[
            self.gl_data.get('description', pd.Series(dtype='object')).str.contains(
                'write.?off|bad.?debt|uncollect', case=False, na=False)
        ].copy()
        
        if len(writeoff_data) > 0:
            annual_revenue = sum([m['p_and_l']['revenue'] for m in self.monthly_financials.values()])
            annual_writeoffs = abs(writeoff_data['net_amount'].sum())
            
            if annual_revenue > 0:
                writeoff_pct = annual_writeoffs / annual_revenue
                
                if writeoff_pct > 0.05:
                    severity = 'High' if writeoff_pct > 0.10 else 'Medium'
                    self.red_flags.append({
                        'flag': 'High Write-Off Percentage',
                        'severity': severity,
                        'detail': f'Write-offs: {writeoff_pct:.1%} of revenue',
                        'impact': 'Poor realization rates',
                        'action': 'Review billing and collection procedures',
                        'amount': annual_writeoffs,
                        'period': 'Annual'
                    })
    
    def _analyze_utilization_trends(self):
        """Analyze utilization"""
        compensation_data = self.gl_data[
            self.gl_data['account_name'].str.contains('Salary|Wage|Compensation', case=False, na=False)
        ].copy()
        
        if len(compensation_data) > 0:
            annual_compensation = abs(compensation_data['net_amount'].sum())
            annual_revenue = sum([m['p_and_l']['revenue'] for m in self.monthly_financials.values()])
            
            if annual_revenue > 0:
                compensation_ratio = annual_compensation / annual_revenue
                
                if compensation_ratio > 0.60:
                    severity = 'High' if compensation_ratio > 0.75 else 'Medium'
                    self.red_flags.append({
                        'flag': 'High Compensation to Revenue Ratio',
                        'severity': severity,
                        'detail': f'Compensation: {compensation_ratio:.1%} of revenue',
                        'impact': 'Low utilization or pricing issues',
                        'action': 'Review utilization and pricing strategy',
                        'amount': annual_compensation,
                        'period': 'Annual'
                    })
    
    def _analyze_seasonality_risks(self):
        """Analyze seasonality"""
        if len(self.monthly_financials) >= 12:
            revenue_by_month = {}
            for month_end, financials in self.monthly_financials.items():
                month_num = month_end.month
                revenue = financials['p_and_l']['revenue']
                
                if month_num not in revenue_by_month:
                    revenue_by_month[month_num] = []
                revenue_by_month[month_num].append(revenue)
            
            if len(revenue_by_month) >= 12:
                avg_revenue_by_month = {}
                for month_num, revenues in revenue_by_month.items():
                    avg_revenue_by_month[month_num] = np.mean(revenues)
                
                revenues = list(avg_revenue_by_month.values())
                max_revenue = max(revenues)
                min_revenue = min(revenues)
                
                if min_revenue > 0:
                    seasonality_ratio = max_revenue / min_revenue
                    
                    if seasonality_ratio > 2.0:
                        severity = 'High' if seasonality_ratio > 3.0 else 'Medium'
                        self.red_flags.append({
                            'flag': 'High Revenue Seasonality',
                            'severity': severity,
                            'detail': f'{seasonality_ratio:.1f}x difference between peak and low months',
                            'impact': 'Cash flow and resource planning difficulties',
                            'action': 'Develop strategies to smooth revenue',
                            'amount': max_revenue - min_revenue,
                            'period': 'Annual pattern'
                        })
    
    def get_summary_stats(self):
        """Get summary statistics"""
        if not self.red_flags:
            return {'total': 0, 'high': 0, 'medium': 0, 'low': 0}
        
        return {
            'total': len(self.red_flags),
            'high': len([f for f in self.red_flags if f['severity'] == 'High']),
            'medium': len([f for f in self.red_flags if f['severity'] == 'Medium']),
            'low': len([f for f in self.red_flags if f['severity'] == 'Low'])
        }
    
    def get_priority_flags(self, limit=10):
        """Get top priority flags"""
        return self.red_flags[:limit]
    
    def get_flags_by_category(self):
        """Group flags by category"""
        categories = {
            'Revenue Quality': [],
            'Client Risk': [],
            'Collection Issues': [],
            'Operational Risk': []
        }
        
        for flag in self.red_flags:
            flag_name = flag['flag'].lower()
            if 'revenue' in flag_name or 'timing' in flag_name:
                categories['Revenue Quality'].append(flag)
            elif 'client' in flag_name or 'concentration' in flag_name:
                categories['Client Risk'].append(flag)
            elif 'receivable' in flag_name or 'collection' in flag_name or 'dso' in flag_name:
                categories['Collection Issues'].append(flag)
            else:
                categories['Operational Risk'].append(flag)
        
        return {k: v for k, v in categories.items() if v}
    
    def export_red_flags(self, filename='red_flags_analysis.xlsx'):
        """Export red flags"""
        if not self.red_flags:
            print("   No red flags to export")
            return None
        
        df = pd.DataFrame(self.red_flags)
        df = df[['flag', 'severity', 'detail', 'impact', 'action', 'amount', 'period']]
        df['priority_rank'] = range(1, len(df) + 1)
        df = df[['priority_rank', 'flag', 'severity', 'detail', 'impact', 'action', 'amount', 'period']]
        
        df.to_excel(filename, index=False)
        print(f"   Red flags exported to {filename}")
        return filename
