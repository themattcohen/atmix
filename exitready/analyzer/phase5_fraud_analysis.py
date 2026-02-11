# phase5_fraud_analysis.py
"""
Phase 5: Fraud & Compliance Analysis
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class FraudAnalyzer:
    """Comprehensive fraud and compliance analysis"""
    
    def __init__(self, gl_data, ar_data, monthly_financials):
        self.gl_data = gl_data
        self.ar_data = ar_data
        self.monthly_financials = monthly_financials
        self.flags = []
    
    def analyze_all(self):
        """Run all fraud and compliance analyses"""
        print("   • Round amount analysis...")
        self._analyze_round_amounts()
        
        # print("   • Duplicate transaction analysis...")
        # self._analyze_duplicate_transactions()
        
        print("   • Manual journal entry patterns...")
        self._analyze_manual_entries()
        
        # print("   • Unusual timing patterns...")
        # self._analyze_unusual_timing()
        
        print("   • Large or unusual transactions...")
        self._analyze_outlier_transactions()
        
        print("   • Period-end adjustments...")
        self._analyze_period_end_adjustments()
        
        print("   • Sequential number gaps...")
        self._analyze_sequential_gaps()
        
        print("   • User activity patterns...")
        self._analyze_user_patterns()
        
        return self.flags
    
    def _analyze_round_amounts(self):
        """Detect suspicious round amounts"""
        # Focus on last 6 months of data
        cutoff_date = self.gl_data['transaction_date'].max() - pd.DateOffset(months=6)
        recent_data = self.gl_data[self.gl_data['transaction_date'] >= cutoff_date].copy()
        
        if len(recent_data) == 0:
            return
        
        # Check for unusually high frequency of round amounts
        gl_amounts = recent_data['net_amount'].abs()
        
        # Define round amount patterns
        round_100 = gl_amounts % 100 == 0
        round_1000 = gl_amounts % 1000 == 0
        round_10000 = gl_amounts % 10000 == 0
        
        total_transactions = len(gl_amounts)
        round_100_count = round_100.sum()
        round_1000_count = round_1000.sum()
        round_10000_count = round_10000.sum()
        
        if total_transactions > 0:
            round_100_pct = round_100_count / total_transactions
            round_1000_pct = round_1000_count / total_transactions
            round_10000_pct = round_10000_count / total_transactions
            
            # Flag high concentrations of round amounts
            if round_100_pct > 0.20:  # >20% round to $100
                severity = 'High' if round_100_pct > 0.35 else 'Medium'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'High Frequency of Round Amounts ($100)',
                    'severity': severity,
                    'detail': f'{round_100_pct:.1%} of transactions are round to $100 (last 6 months)',
                    'impact': 'Potential fabricated or estimated transactions',
                    'action': 'Review round amount transactions for supporting documentation',
                    'amount': round_100_count,
                    'period': 'Last 6 months'
                })
            
            if round_1000_pct > 0.10:  # >10% round to $1,000
                severity = 'High' if round_1000_pct > 0.20 else 'Medium'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'High Frequency of Round Amounts ($1,000)',
                    'severity': severity,
                    'detail': f'{round_1000_pct:.1%} of transactions are round to $1,000 (last 6 months)',
                    'impact': 'Potential manipulation or estimation',
                    'action': 'Investigate large round amount transactions',
                    'amount': round_1000_count,
                    'period': 'Last 6 months'
                })
            
            # Large round amounts are especially suspicious - focus on revenue accounts
            revenue_accounts = recent_data[recent_data['standard_account'].astype(str).str.startswith('4')]
            large_round_amounts = revenue_accounts[
                (revenue_accounts['net_amount'].abs() >= 10000) & 
                (revenue_accounts['net_amount'].abs() % 1000 == 0)
            ]
            
            if len(large_round_amounts) > 0:
                # Check for transfers before flagging
                flagged_transactions = []
                
                for _, transaction in large_round_amounts.iterrows():
                    # Check for potential transfers (same amount, same date, opposite signs)
                    same_date_transactions = recent_data[
                        recent_data['transaction_date'].dt.date == transaction['transaction_date'].date()
                    ]
                    
                    # Look for offsetting transaction (same absolute amount, opposite sign)
                    offsetting_transactions = same_date_transactions[
                        (same_date_transactions['net_amount'].abs() == abs(transaction['net_amount'])) &
                        (same_date_transactions['net_amount'] * transaction['net_amount'] < 0)  # Opposite signs
                    ]
                    
                    # If no offsetting transaction found, flag it
                    if len(offsetting_transactions) == 0:
                        flagged_transactions.append(transaction)
                
                if len(flagged_transactions) > 0:
                    # Get account details for flagged transactions
                    flagged_accounts = set()
                    flagged_periods = set()
                    total_flagged_amount = 0
                    
                    for transaction in flagged_transactions:
                        flagged_accounts.add(f"{transaction['account_number']} ({transaction['account_name']})")
                        flagged_periods.add(transaction['transaction_date'].strftime('%Y-%m'))
                        total_flagged_amount += abs(transaction['net_amount'])
                    
                    accounts_text = "; ".join(list(flagged_accounts)[:3])  # Limit to first 3 accounts
                    if len(flagged_accounts) > 3:
                        accounts_text += f" and {len(flagged_accounts) - 3} more"
                    
                    periods_text = "; ".join(sorted(list(flagged_periods)))
                    
                    large_round_pct = len(flagged_transactions) / len(revenue_accounts[revenue_accounts['net_amount'].abs() >= 10000]) if len(revenue_accounts[revenue_accounts['net_amount'].abs() >= 10000]) > 0 else 0
                    
                    if large_round_pct > 0.30 or len(flagged_transactions) > 2:
                        self.flags.append({
                            'detail_ref': '',
                            'flag': 'Large Transactions with Round Amounts',
                            'severity': 'High',
                            'detail': f'{len(flagged_transactions)} large round amount transactions (>$10K) in revenue accounts. Accounts: {accounts_text}. Periods: {periods_text}',
                            'impact': 'High risk of fabricated large transactions',
                            'action': 'Immediate review of large round amount transactions in specified accounts and periods',
                            'amount': total_flagged_amount,
                            'period': 'Last 6 months'
                        })
    
    def _analyze_duplicate_transactions(self):
        """Detect potential duplicate transactions"""
        # Look for transactions with same amount, account, and date
        gl_subset = self.gl_data[['transaction_date', 'account_number', 'net_amount', 'description']].copy()
        
        # Group by key fields to find potential duplicates
        duplicate_groups = gl_subset.groupby(['transaction_date', 'account_number', 'net_amount']).size()
        duplicates = duplicate_groups[duplicate_groups > 1]
        
        if len(duplicates) > 0:
            total_duplicate_amount = 0
            duplicate_transaction_count = 0
            
            for (date, account, amount), count in duplicates.items():
                duplicate_amount = abs(amount) * (count - 1)  # Exclude one legitimate transaction
                total_duplicate_amount += duplicate_amount
                duplicate_transaction_count += (count - 1)
            
            if duplicate_transaction_count > 0:
                severity = 'Critical' if duplicate_transaction_count > 10 else 'High' if duplicate_transaction_count > 5 else 'Medium'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'Potential Duplicate Transactions',
                    'severity': severity,
                    'detail': f'{duplicate_transaction_count} potential duplicate transactions found',
                    'impact': 'Risk of double-counting and financial misstatement',
                    'action': 'Review and eliminate duplicate transactions',
                    'amount': total_duplicate_amount,
                    'period': 'Overall'
                })
        
        # Also check for near-duplicates (same amount, similar dates)
        for account in self.gl_data['account_number'].unique():
            account_data = self.gl_data[self.gl_data['account_number'] == account].copy()
            account_data = account_data.sort_values('transaction_date')
            
            # Look for same amounts within 3 days
            for i in range(len(account_data)):
                current_row = account_data.iloc[i]
                next_rows = account_data.iloc[i+1:i+4]  # Next 3 transactions
                
                same_amount_nearby = next_rows[
                    (next_rows['net_amount'] == current_row['net_amount']) &
                    (abs((next_rows['transaction_date'] - current_row['transaction_date']).dt.days) <= 3)
                ]
                
                if len(same_amount_nearby) > 0:
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'Near-Duplicate Transaction Pattern',
                        'severity': 'Medium',
                        'detail': f'Same amount ${abs(current_row["net_amount"]):,.2f} in account {account} within 3 days',
                        'impact': 'Potential data entry errors or duplicate processing',
                        'action': 'Review transactions with same amounts in short timeframes',
                        'amount': abs(current_row['net_amount']),
                        'period': f'Around {current_row["transaction_date"].date()}'
                    })
                    break  # Only flag once per account
    
    def _analyze_manual_entries(self):
        """Analyze manual journal entry patterns"""
        # Identify potential manual entries by description patterns
        manual_indicators = [
            'journal', 'adjustment', 'correction', 'manual', 'je', 'adj',
            'accrual', 'reversal', 'reclassification', 'reclass'
        ]
        
        manual_entries = self.gl_data[
            self.gl_data['description'].str.contains(
                '|'.join(manual_indicators), case=False, na=False
            )
        ].copy()
        
        if len(manual_entries) > 0:
            total_transactions = len(self.gl_data)
            manual_count = len(manual_entries)
            manual_pct = manual_count / total_transactions
            
            # High frequency of manual entries
            if manual_pct > 0.15:  # >15% manual entries
                severity = 'High' if manual_pct > 0.25 else 'Medium'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'High Frequency of Manual Journal Entries',
                    'severity': severity,
                    'detail': f'{manual_pct:.1%} of transactions appear to be manual entries',
                    'impact': 'High manual intervention increases error and fraud risk',
                    'action': 'Review manual entry procedures and automate where possible',
                    'amount': manual_count,
                    'period': 'Overall'
                })
            
            # Analyze timing of manual entries
            manual_entries['day_of_month'] = manual_entries['transaction_date'].dt.day
            month_end_manual = manual_entries[manual_entries['day_of_month'] >= 28]
            
            if len(manual_entries) > 0:
                month_end_pct = len(month_end_manual) / len(manual_entries)
                
                if month_end_pct > 0.40:  # >40% of manual entries at month-end
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'Month-End Manual Entry Concentration',
                        'severity': 'Medium',
                        'detail': f'{month_end_pct:.1%} of manual entries at month-end',
                        'impact': 'Potential period-end manipulation',
                        'action': 'Review month-end manual entries for appropriateness',
                        'amount': len(month_end_manual),
                        'period': 'Month-end pattern'
                    })
            
            # Large manual entries with transfer detection
            large_manual = manual_entries[manual_entries['net_amount'].abs() > 
                                        manual_entries['net_amount'].abs().quantile(0.90)]
            
            if len(large_manual) > 0:
                # Group by date and amount to detect transfers
                reported_entries = set()
                
                for _, entry in large_manual.iterrows():
                    if abs(entry['net_amount']) > 10000:  # Large amounts
                        entry_id = f"{entry['transaction_date'].date()}_{abs(entry['net_amount']):.2f}"
                        
                        # Skip if already reported as part of a transfer
                        if entry_id in reported_entries:
                            continue
                        
                        # Check for potential transfers (same amount, same date, opposite signs)
                        same_date_transactions = manual_entries[
                            manual_entries['transaction_date'].dt.date == entry['transaction_date'].date()
                        ]
                        
                        # Look for offsetting transaction (same absolute amount, opposite sign)
                        offsetting_transactions = same_date_transactions[
                            (same_date_transactions['net_amount'].abs() == abs(entry['net_amount'])) &
                            (same_date_transactions['net_amount'] * entry['net_amount'] < 0)  # Opposite signs
                        ]
                        
                        if len(offsetting_transactions) > 0:
                            # This is a transfer - report both accounts together
                            offsetting_entry = offsetting_transactions.iloc[0]
                            
                            # Get account details for both sides
                            from_account = entry['account_name'] if entry['net_amount'] < 0 else offsetting_entry['account_name']
                            to_account = offsetting_entry['account_name'] if entry['net_amount'] < 0 else entry['account_name']
                            
                            self.flags.append({
                                'detail_ref': '',
                                'flag': 'Large Manual Journal Entry (Transfer)',
                                'severity': 'Medium',
                                'detail': f'Manual transfer: ${abs(entry["net_amount"]):,.0f} from {from_account} to {to_account} on {entry["transaction_date"].date()}',
                                'impact': 'Large manual transfer requires verification',
                                'action': f'Review documentation and authorization for large manual transfer',
                                'amount': abs(entry['net_amount']),
                                'period': str(entry['transaction_date'].date())
                            })
                            
                            # Mark both entries as reported
                            reported_entries.add(entry_id)
                            offsetting_id = f"{offsetting_entry['transaction_date'].date()}_{abs(offsetting_entry['net_amount']):.2f}"
                            reported_entries.add(offsetting_id)
                        else:
                            # Single-sided manual entry (more suspicious)
                            self.flags.append({
                                'detail_ref': '',
                                'flag': 'Large Manual Journal Entry',
                                'severity': 'High',
                                'detail': f'Manual entry: ${abs(entry["net_amount"]):,.0f} in {entry["account_name"]} on {entry["transaction_date"].date()}',
                                'impact': 'High-value single-sided manual adjustment risk',
                                'action': f'Review documentation for large manual entry',
                                'amount': abs(entry['net_amount']),
                                'period': str(entry['transaction_date'].date())
                            })
                            
                            reported_entries.add(entry_id)
    
    def _analyze_unusual_timing(self):
        """Analyze unusual transaction timing patterns"""
        # Weekend transactions
        self.gl_data['day_of_week'] = self.gl_data['transaction_date'].dt.dayofweek
        weekend_transactions = self.gl_data[self.gl_data['day_of_week'].isin([5, 6])]  # Saturday, Sunday
        
        if len(weekend_transactions) > 0:
            total_transactions = len(self.gl_data)
            weekend_pct = len(weekend_transactions) / total_transactions
            
            if weekend_pct > 0.05:  # >5% weekend transactions
                severity = 'Medium' if weekend_pct < 0.10 else 'High'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'High Weekend Transaction Activity',
                    'severity': severity,
                    'detail': f'{weekend_pct:.1%} of transactions on weekends',
                    'impact': 'Unusual timing may indicate backdating or manipulation',
                    'action': 'Review weekend transactions for business justification',
                    'amount': len(weekend_transactions),
                    'period': 'Weekend pattern'
                })
        
        # Holiday transactions (simplified - major holidays)
        holiday_dates = [
            '2022-01-01', '2022-07-04', '2022-12-25',
            '2023-01-01', '2023-07-04', '2023-12-25',
            '2024-01-01', '2024-07-04', '2024-12-25'
        ]
        
        holiday_transactions = self.gl_data[
            self.gl_data['transaction_date'].dt.strftime('%Y-%m-%d').isin(holiday_dates)
        ]
        
        if len(holiday_transactions) > 0:
            self.flags.append({
                'detail_ref': '',
                'flag': 'Holiday Transaction Activity',
                'severity': 'Medium',
                'detail': f'{len(holiday_transactions)} transactions on major holidays',
                'impact': 'Unusual timing requires investigation',
                'action': 'Review holiday transactions for legitimacy',
                'amount': len(holiday_transactions),
                'period': 'Holiday dates'
            })
        
        # After-hours transactions (if timestamp available)
        # This would need time data - simplified version
        
        # Very late month entries (after month-end)
        self.gl_data['days_after_month_end'] = (
            self.gl_data['transaction_date'] - 
            self.gl_data['transaction_date'].dt.to_period('M').dt.end_time
        ).dt.days
        
        late_entries = self.gl_data[self.gl_data['days_after_month_end'] > 5]  # >5 days after month-end
        
        if len(late_entries) > 0:
            total_transactions = len(self.gl_data)
            late_pct = len(late_entries) / total_transactions
            
            if late_pct > 0.10:  # >10% late entries
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'High Frequency of Late Period Entries',
                    'severity': 'Medium',
                    'detail': f'{late_pct:.1%} of transactions entered >5 days after month-end',
                    'impact': 'Potential period-end cutoff issues',
                    'action': 'Review late entries and improve cutoff procedures',
                    'amount': len(late_entries),
                    'period': 'Late entry pattern'
                })
    
    def _analyze_outlier_transactions(self):
        """Detect outlier transactions that may indicate fraud"""
        amounts = self.gl_data['net_amount'].abs()
        
        # Statistical outliers (>3 standard deviations)
        mean_amount = amounts.mean()
        std_amount = amounts.std()
        outlier_threshold = mean_amount + (3 * std_amount)
        
        outliers = self.gl_data[amounts > outlier_threshold]
        
        # Track reported outliers to avoid duplicates
        reported_outliers = set()
        
        if len(outliers) > 0:
            for _, outlier in outliers.iterrows():
                if abs(outlier['net_amount']) > 50000:  # Focus on large outliers
                    # Create unique identifier for this transaction
                    outlier_id = f"{outlier['transaction_date'].date()}_{abs(outlier['net_amount']):.2f}_{outlier['account_number']}"
                    
                    # Skip if already reported
                    if outlier_id in reported_outliers:
                        continue
                    
                    # Check for potential transfers (same amount, same date, opposite signs)
                    same_date_transactions = self.gl_data[
                        self.gl_data['transaction_date'].dt.date == outlier['transaction_date'].date()
                    ]
                    
                    # Look for offsetting transaction (same absolute amount, opposite sign)
                    offsetting_transactions = same_date_transactions[
                        (same_date_transactions['net_amount'].abs() == abs(outlier['net_amount'])) &
                        (same_date_transactions['net_amount'] * outlier['net_amount'] < 0)  # Opposite signs
                    ]
                    
                    # If we find an offsetting transaction, it's likely a transfer - skip reporting
                    if len(offsetting_transactions) > 0:
                        continue
                    
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'Statistical Outlier Transaction',
                        'severity': 'High',
                        'detail': f'Outlier: ${abs(outlier["net_amount"]):,.0f} in {outlier["account_name"]}',
                        'impact': 'Unusually large transaction requires verification',
                        'action': f'Review supporting documentation for outlier transaction',
                        'amount': abs(outlier['net_amount']),
                        'period': str(outlier['transaction_date'].date())
                    })
                    
                    # Mark as reported
                    reported_outliers.add(outlier_id)
        
        # Comment out approval threshold analysis as requested
        # # Transactions just under common approval thresholds
        # threshold_amounts = [9999, 4999, 999]  # Common approval thresholds minus $1
        # 
        # for threshold in threshold_amounts:
        #     near_threshold = self.gl_data[
        #         (amounts >= threshold) & (amounts <= threshold + 50)
        #     ]
        #     
        #     if len(near_threshold) > 2:  # Multiple transactions near threshold
        #         self.flags.append({
        #             'detail_ref': '',
        #             'flag': f'Transactions Near Approval Threshold (${threshold:,})',
        #             'severity': 'Medium',
        #             'detail': f'{len(near_threshold)} transactions near ${threshold:,} threshold',
        #             'impact': 'Potential approval limit avoidance',
        #             'action': f'Review transactions near ${threshold:,} approval threshold',
        #             'amount': len(near_threshold),
        #             'period': 'Pattern analysis'
        #         })
    
    def _analyze_period_end_adjustments(self):
        """Analyze period-end adjustment patterns"""
        # Focus on last 3 days of quarters
        quarter_ends = []
        for year in self.gl_data['transaction_date'].dt.year.unique():
            for quarter in [1, 2, 3, 4]:
                if quarter == 1:
                    end_date = pd.Timestamp(f'{year}-03-31')
                elif quarter == 2:
                    end_date = pd.Timestamp(f'{year}-06-30')
                elif quarter == 3:
                    end_date = pd.Timestamp(f'{year}-09-30')
                else:
                    end_date = pd.Timestamp(f'{year}-12-31')
                quarter_ends.append(end_date)
        
        period_end_adjustments = []
        for end_date in quarter_ends:
            start_date = end_date - pd.Timedelta(days=2)
            period_transactions = self.gl_data[
                (self.gl_data['transaction_date'] >= start_date) &
                (self.gl_data['transaction_date'] <= end_date)
            ]
            
            # Look for adjustment-type transactions
            adjustments = period_transactions[
                period_transactions['description'].str.contains(
                    'adj|accrual|provision|reserve|write', case=False, na=False
                )
            ]
            
            if len(adjustments) > 0:
                period_end_adjustments.extend(adjustments.to_dict('records'))
        
        if len(period_end_adjustments) > 0:
            total_adjustment_amount = sum([abs(adj['net_amount']) for adj in period_end_adjustments])
            
            # High volume of period-end adjustments
            if len(period_end_adjustments) > 10:
                severity = 'High' if len(period_end_adjustments) > 20 else 'Medium'
                self.flags.append({
                    'detail_ref': '',
                    'flag': 'High Volume Period-End Adjustments',
                    'severity': severity,
                    'detail': f'{len(period_end_adjustments)} adjustments in last 3 days of quarters',
                    'impact': 'Potential earnings management',
                    'action': 'Review period-end adjustment procedures and documentation',
                    'amount': total_adjustment_amount,
                    'period': 'Quarter-end pattern'
                })
    
    def _analyze_sequential_gaps(self):
        """Analyze for gaps in check sequential numbering"""
        # Focus only on check transactions
        check_transactions = self.gl_data[
            self.gl_data['description'].str.contains(r'check|chk|ck\s*#', case=False, na=False)
        ]
        
        if len(check_transactions) == 0:
            return
        
        # Extract check numbers from descriptions
        import re
        check_numbers = []
        
        for desc in check_transactions['description']:
            # Look for check number patterns: "Check #1234", "Chk 1234", "Check 1234", etc.
            numbers = re.findall(r'(?:check|chk|ck)\s*#?\s*(\d{3,})', str(desc), re.IGNORECASE)
            if numbers:
                check_numbers.extend([int(num) for num in numbers])
        
        if len(check_numbers) > 5:  # Need reasonable sample size
            check_numbers = sorted(list(set(check_numbers)))  # Remove duplicates and sort
            gaps = []
            
            for i in range(1, len(check_numbers)):
                gap = check_numbers[i] - check_numbers[i-1]
                if gap > 10:  # Significant gap in check sequence
                    gaps.append({
                        'gap_size': gap - 1,  # Actual missing checks
                        'from_check': check_numbers[i-1],
                        'to_check': check_numbers[i]
                    })
            
            if gaps:
                # Report largest gaps
                large_gaps = [g for g in gaps if g['gap_size'] > 50]
                
                if large_gaps:
                    max_gap = max(large_gaps, key=lambda x: x['gap_size'])
                    total_missing = sum(g['gap_size'] for g in large_gaps)
                    
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'Large Check Sequence Gaps',
                        'severity': 'Medium',
                        'detail': f'{total_missing} missing check numbers found. Largest gap: {max_gap["gap_size"]} checks between #{max_gap["from_check"]} and #{max_gap["to_check"]}',
                        'impact': 'Potential missing check transactions or unauthorized check usage',
                        'action': 'Review check register for missing check numbers and investigate gaps',
                        'amount': total_missing,
                        'period': 'Check sequence analysis'
                    })
    
    def _analyze_user_patterns(self):
        """Analyze user activity patterns if user data available"""
        # This would typically require user/creator fields
        # Simplified analysis based on available data patterns
        
        # Check for unusual concentration of transactions by time patterns
        self.gl_data['hour'] = self.gl_data['transaction_date'].dt.hour
        
        # If we had user data, we could look for:
        # - Users entering transactions at unusual hours
        # - High concentration of manual entries by specific users
        # - Users with access to inappropriate accounts
        
        # For now, flag transactions at unusual hours (if timestamp available)
        if self.gl_data['hour'].nunique() > 1:  # Has hour information
            after_hours = self.gl_data[
                (self.gl_data['hour'] < 7) | (self.gl_data['hour'] > 19)
            ]
            
            if len(after_hours) > 0:
                total_transactions = len(self.gl_data)
                after_hours_pct = len(after_hours) / total_transactions
                
                if after_hours_pct > 0.10:  # >10% after hours
                    self.flags.append({
                        'detail_ref': '',
                        'flag': 'High After-Hours Transaction Activity',
                        'severity': 'Medium',
                        'detail': f'{after_hours_pct:.1%} of transactions after hours (before 7am or after 7pm)',
                        'impact': 'Unusual access patterns may indicate unauthorized activity',
                        'action': 'Review after-hours transaction authorization and access controls',
                        'amount': len(after_hours),
                        'period': 'After-hours pattern'
                    })
