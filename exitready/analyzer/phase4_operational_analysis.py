# phase4_operational_analysis.py
"""
Phase 4: Operational Risk Analysis
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class OperationalAnalyzer:
    """Comprehensive operational risk analysis"""
    
    def __init__(self, gl_data, ar_data, monthly_financials):
        self.gl_data = gl_data
        self.ar_data = ar_data
        self.monthly_financials = monthly_financials
        self.flags = []
    
    def analyze_all(self):
        """Run all operational analyses"""
        print("   • Expense timing manipulation...")
        self._analyze_expense_timing()
        
        print("   • Compensation analysis...")
        self._analyze_compensation_trends()
        
        print("   • Utilization metrics...")
        self._analyze_utilization_indicators()
        
        print("   • Seasonality risks...")
        self._analyze_seasonality_patterns()
        
        print("   • Overhead allocation...")
        self._analyze_overhead_trends()
        
        print("   • Asset quality...")
        self._analyze_asset_patterns()
        
        print("   • Liability timing...")
        self._analyze_liability_timing()
        
        print("   • Service line performance...")
        self._analyze_service_line_performance()
        
        return self.flags
    
    def _analyze_expense_timing(self):
        """Detect expense timing manipulation"""
        expense_data = self.gl_data[
            self.gl_data['account_number'].astype(str).str.startswith(('6', '7', '8'))
        ].copy()
        
        if len(expense_data) == 0:
            return
        
        expense_data['day_of_month'] = expense_data['transaction_date'].dt.day
        expense_data['month_year'] = expense_data['transaction_date'].dt.to_period('M')
        
        for month in expense_data['month_year'].unique():
            month_data = expense_data[expense_data['month_year'] == month]
            total_expenses = abs(month_data['net_amount'].sum())
            
            if total_expenses > 0:
                # Last day expense concentration
                last_day = month_data[month_data['day_of_month'] >= 28]
                last_day_expenses = abs(last_day['net_amount'].sum())
                last_day_pct = last_day_expenses / total_expenses
                
                if last_day_pct > 0.20:
                    severity = 'High' if last_day_pct > 0.35 else 'Medium'
                    self.flags.append({
                        'flag': 'Month-End Expense Bunching',
                        'severity': severity,
                        'detail': f'{last_day_pct:.1%} of {month} expenses in last 3 days',
                        'impact': 'Potential expense timing manipulation',
                        'action': 'Review expense accrual procedures and controls',
                        'amount': last_day_expenses,
                        'period': str(month)
                    })
        
        # Analyze quarter-end expense patterns
        expense_data['quarter'] = expense_data['transaction_date'].dt.quarter
        expense_data['year'] = expense_data['transaction_date'].dt.year
        
        for year in expense_data['year'].unique():
            year_data = expense_data[expense_data['year'] == year]
            total_year_expenses = abs(year_data['net_amount'].sum())
            
            if total_year_expenses > 0:
                q4_expenses = abs(year_data[year_data['quarter'] == 4]['net_amount'].sum())
                q4_pct = q4_expenses / total_year_expenses
                
                # Expect ~25% in Q4, flag if significantly different
                if q4_pct > 0.35:
                    self.flags.append({
                        'flag': 'Q4 Expense Concentration',
                        'severity': 'Medium',
                        'detail': f'{q4_pct:.1%} of {year} expenses in Q4',
                        'impact': 'Potential year-end expense manipulation',
                        'action': 'Review Q4 expense recognition timing',
                        'amount': q4_expenses,
                        'period': f'{year} Q4'
                    })
                elif q4_pct < 0.15:
                    self.flags.append({
                        'flag': 'Unusually Low Q4 Expenses',
                        'severity': 'Medium',
                        'detail': f'Only {q4_pct:.1%} of {year} expenses in Q4',
                        'impact': 'Potential expense deferral to next year',
                        'action': 'Review completeness of Q4 expense recognition',
                        'amount': total_year_expenses * (0.25 - q4_pct),
                        'period': f'{year} Q4'
                    })
    
    def _analyze_compensation_trends(self):
        """Analyze compensation and staffing trends"""
        # Find compensation-related accounts
        compensation_accounts = self.gl_data[
            self.gl_data['account_name'].str.contains(
                'salary|wage|compensation|payroll|bonus', case=False, na=False
            )
        ].copy()
        
        if len(compensation_accounts) > 0:
            annual_compensation = abs(compensation_accounts['net_amount'].sum())
            annual_revenue = sum([m['p_and_l']['revenue'] for m in self.monthly_financials.values()])
            
            if annual_revenue > 0:
                compensation_ratio = annual_compensation / annual_revenue
                
                # Flag high compensation ratios
                if compensation_ratio > 0.60:
                    severity = 'Critical' if compensation_ratio > 0.80 else 'High' if compensation_ratio > 0.70 else 'Medium'
                    self.flags.append({
                        'flag': 'High Compensation to Revenue Ratio',
                        'severity': severity,
                        'detail': f'Compensation: {compensation_ratio:.1%} of revenue',
                        'impact': 'Low profitability, utilization, or pricing issues',
                        'action': 'Review utilization rates, pricing strategy, and staffing levels',
                        'amount': annual_compensation,
                        'period': 'Annual'
                    })
                
                # Flag very low ratios (potential under-accrual)
                elif compensation_ratio < 0.25:
                    self.flags.append({
                        'flag': 'Unusually Low Compensation Ratio',
                        'severity': 'Medium',
                        'detail': f'Compensation only {compensation_ratio:.1%} of revenue',
                        'impact': 'Potential compensation under-accrual',
                        'action': 'Verify completeness of compensation expense recording',
                        'amount': annual_revenue * 0.40 - annual_compensation,
                        'period': 'Annual'
                    })
            
            # Analyze compensation timing patterns
            compensation_accounts['quarter'] = compensation_accounts['transaction_date'].dt.quarter
            quarterly_comp = compensation_accounts.groupby('quarter')['net_amount'].sum().abs()
            
            if len(quarterly_comp) == 4:
                q4_comp_pct = quarterly_comp[4] / quarterly_comp.sum()
                
                # Flag unusual Q4 compensation (bonuses, etc.)
                if q4_comp_pct > 0.35:
                    self.flags.append({
                        'flag': 'High Q4 Compensation Concentration',
                        'severity': 'Medium',
                        'detail': f'{q4_comp_pct:.1%} of annual compensation in Q4',
                        'impact': 'Potential bonus timing or expense manipulation',
                        'action': 'Review Q4 compensation components and timing',
                        'amount': quarterly_comp[4],
                        'period': 'Q4 pattern'
                    })
    
    def _analyze_utilization_indicators(self):
        """Analyze utilization through indirect indicators"""
        # Travel and entertainment expenses as utilization indicator
        travel_accounts = self.gl_data[
            self.gl_data['account_name'].str.contains(
                'travel|entertainment|meal|hotel|transport', case=False, na=False
            )
        ].copy()
        
        if len(travel_accounts) > 0:
            annual_travel = abs(travel_accounts['net_amount'].sum())
            annual_revenue = sum([m['p_and_l']['revenue'] for m in self.monthly_financials.values()])
            
            if annual_revenue > 0:
                travel_ratio = annual_travel / annual_revenue
                
                # Very low travel might indicate low client engagement
                if travel_ratio < 0.005:  # <0.5% of revenue
                    self.flags.append({
                        'flag': 'Very Low Travel and Entertainment Expenses',
                        'severity': 'Low',
                        'detail': f'Travel/entertainment: {travel_ratio:.2%} of revenue',
                        'impact': 'Possible low client engagement or remote work issues',
                        'action': 'Review client engagement levels and business development',
                        'amount': annual_travel,
                        'period': 'Annual'
                    })
                
                # Very high travel might indicate inefficiency
                elif travel_ratio > 0.08:  # >8% of revenue
                    severity = 'Medium' if travel_ratio < 0.12 else 'High'
                    self.flags.append({
                        'flag': 'High Travel and Entertainment Expenses',
                        'severity': severity,
                        'detail': f'Travel/entertainment: {travel_ratio:.1%} of revenue',
                        'impact': 'Potential inefficiency or lack of cost controls',
                        'action': 'Review travel policy and expense controls',
                        'amount': annual_travel,
                        'period': 'Annual'
                    })
        
        # Office expenses as potential indicator
        office_accounts = self.gl_data[
            self.gl_data['account_name'].str.contains(
                'rent|office|utilities|supplies', case=False, na=False
            )
        ].copy()
        
        if len(office_accounts) > 0:
            annual_office = abs(office_accounts['net_amount'].sum())
            annual_revenue = sum([m['p_and_l']['revenue'] for m in self.monthly_financials.values()])
            
            if annual_revenue > 0:
                office_ratio = annual_office / annual_revenue
                
                if office_ratio > 0.20:  # >20% seems high for professional services
                    severity = 'Medium' if office_ratio < 0.30 else 'High'
                    self.flags.append({
                        'flag': 'High Office and Facility Costs',
                        'severity': severity,
                        'detail': f'Office expenses: {office_ratio:.1%} of revenue',
                        'impact': 'High overhead reducing profitability',
                        'action': 'Review facility costs and space utilization',
                        'amount': annual_office,
                        'period': 'Annual'
                    })
    
    def _analyze_seasonality_patterns(self):
        """Analyze seasonality risks"""
        if len(self.monthly_financials) >= 12:
            revenue_by_month = {}
            for month_end, financials in self.monthly_financials.items():
                month_num = pd.to_datetime(month_end).month
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
                        severity = 'Critical' if seasonality_ratio > 4.0 else 'High' if seasonality_ratio > 3.0 else 'Medium'
                        
                        peak_month = list(avg_revenue_by_month.keys())[revenues.index(max_revenue)]
                        low_month = list(avg_revenue_by_month.keys())[revenues.index(min_revenue)]
                        
                        self.flags.append({
                            'flag': 'High Revenue Seasonality',
                            'severity': severity,
                            'detail': f'{seasonality_ratio:.1f}x difference between peak (month {peak_month}) and low (month {low_month})',
                            'impact': 'Cash flow and resource planning difficulties',
                            'action': 'Develop strategies to smooth revenue seasonality',
                            'amount': max_revenue - min_revenue,
                            'period': 'Annual pattern'
                        })
                
                # Check for concerning low months
                low_months = [month for month, revenue in avg_revenue_by_month.items() 
                             if revenue < np.mean(revenues) * 0.60]
                
                if len(low_months) >= 3:
                    self.flags.append({
                        'flag': 'Multiple Low Revenue Months',
                        'severity': 'Medium',
                        'detail': f'{len(low_months)} months with <60% of average revenue',
                        'impact': 'Extended periods of low cash flow',
                        'action': 'Develop counter-seasonal revenue strategies',
                        'amount': np.mean(revenues) * 0.40 * len(low_months),
                        'period': 'Seasonal pattern'
                    })
    
    def _analyze_overhead_trends(self):
        """Analyze overhead cost trends"""
        # Professional fees and other overhead
        overhead_accounts = self.gl_data[
            self.gl_data['account_name'].str.contains(
                'professional|legal|accounting|consulting|insurance|technology', 
                case=False, na=False
            )
        ].copy()
        
        if len(overhead_accounts) > 0:
            annual_overhead = abs(overhead_accounts['net_amount'].sum())
            annual_revenue = sum([m['p_and_l']['revenue'] for m in self.monthly_financials.values()])
            
            if annual_revenue > 0:
                overhead_ratio = annual_overhead / annual_revenue
                
                if overhead_ratio > 0.15:  # >15% of revenue in overhead
                    severity = 'High' if overhead_ratio > 0.25 else 'Medium'
                    self.flags.append({
                        'flag': 'High Overhead Cost Ratio',
                        'severity': severity,
                        'detail': f'Overhead costs: {overhead_ratio:.1%} of revenue',
                        'impact': 'High fixed costs reducing profitability',
                        'action': 'Review overhead cost structure and eliminate non-essential expenses',
                        'amount': annual_overhead,
                        'period': 'Annual'
                    })
    
    def _analyze_asset_patterns(self):
        """Analyze asset-related patterns"""
        # Technology and equipment expenses
        tech_accounts = self.gl_data[
            self.gl_data['account_name'].str.contains(
                'computer|technology|software|equipment|depreciation', 
                case=False, na=False
            )
        ].copy()
        
        if len(tech_accounts) > 0:
            annual_tech = abs(tech_accounts['net_amount'].sum())
            annual_revenue = sum([m['p_and_l']['revenue'] for m in self.monthly_financials.values()])
            
            if annual_revenue > 0:
                tech_ratio = annual_tech / annual_revenue
                
                # Very low tech investment might indicate outdated systems
                if tech_ratio < 0.02:  # <2% of revenue
                    self.flags.append({
                        'flag': 'Low Technology Investment',
                        'severity': 'Medium',
                        'detail': f'Technology expenses: {tech_ratio:.1%} of revenue',
                        'impact': 'Potential technology obsolescence risk',
                        'action': 'Review technology infrastructure and investment needs',
                        'amount': annual_tech,
                        'period': 'Annual'
                    })
                
                # Very high tech costs might indicate inefficiency
                elif tech_ratio > 0.10:  # >10% of revenue
                    self.flags.append({
                        'flag': 'High Technology Costs',
                        'severity': 'Medium',
                        'detail': f'Technology expenses: {tech_ratio:.1%} of revenue',
                        'impact': 'High technology costs affecting profitability',
                        'action': 'Review technology spending efficiency',
                        'amount': annual_tech,
                        'period': 'Annual'
                    })
    
    def _analyze_liability_timing(self):
        """Analyze liability and accrual timing"""
        # Look for accrual-related accounts
        accrual_accounts = self.gl_data[
            self.gl_data['account_name'].str.contains(
                'accrual|payable|liability|provision', 
                case=False, na=False
            )
        ].copy()
        
        if len(accrual_accounts) > 0:
            # Analyze timing of accrual entries
            accrual_accounts['day_of_month'] = accrual_accounts['transaction_date'].dt.day
            
            # Check for month-end accrual bunching
            month_end_accruals = accrual_accounts[accrual_accounts['day_of_month'] >= 28]
            total_accruals = abs(accrual_accounts['net_amount'].sum())
            month_end_total = abs(month_end_accruals['net_amount'].sum())
            
            if total_accruals > 0:
                month_end_pct = month_end_total / total_accruals
                
                if month_end_pct > 0.50:  # >50% of accruals at month-end
                    self.flags.append({
                        'flag': 'Month-End Accrual Bunching',
                        'severity': 'Medium',
                        'detail': f'{month_end_pct:.1%} of accruals processed in last 3 days of months',
                        'impact': 'Potential accrual timing manipulation',
                        'action': 'Review accrual procedures and implement ongoing accruals',
                        'amount': month_end_total,
                        'period': 'Pattern analysis'
                    })
    
    def _analyze_service_line_performance(self):
        """Analyze service line performance if identifiable"""
        # Try to identify service lines from account structure
        revenue_data = self.gl_data[
            self.gl_data['account_number'].astype(str).str.startswith('4')
        ].copy()
        
        if len(revenue_data) > 0:
            # Group by account name to identify service lines
            service_revenues = revenue_data.groupby('account_name')['net_amount'].sum().sort_values(ascending=False)
            total_revenue = service_revenues.sum()
            
            if len(service_revenues) > 1 and total_revenue > 0:
                # Identify declining service lines
                for service in service_revenues.index:
                    service_data = revenue_data[revenue_data['account_name'] == service]
                    service_data = service_data.sort_values('transaction_date')
                    
                    if len(service_data) > 6:
                        # Simple trend analysis - compare first and last quarters
                        service_data['quarter'] = service_data['transaction_date'].dt.to_period('Q')
                        quarterly_revenue = service_data.groupby('quarter')['net_amount'].sum()
                        
                        if len(quarterly_revenue) >= 4:
                            recent_q = quarterly_revenue.iloc[-2:].mean()  # Last 2 quarters
                            early_q = quarterly_revenue.iloc[:2].mean()   # First 2 quarters
                            
                            if early_q > 0:
                                decline_pct = (early_q - recent_q) / early_q
                                service_pct = service_revenues[service] / total_revenue
                                
                                # Flag significant declines in major service lines
                                if decline_pct > 0.25 and service_pct > 0.10:
                                    severity = 'High' if decline_pct > 0.50 else 'Medium'
                                    self.flags.append({
                                        'flag': 'Declining Major Service Line',
                                        'severity': severity,
                                        'detail': f'{service}: {decline_pct:.1%} revenue decline',
                                        'impact': 'Loss of major revenue source',
                                        'action': f'Investigate decline in {service} and develop recovery plan',
                                        'amount': early_q - recent_q,
                                        'period': 'Quarterly trend'
                                    })