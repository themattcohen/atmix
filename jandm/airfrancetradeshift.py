
import json
from datetime import datetime, timedelta
from decimal import Decimal
import uuid
import html
import re
try:
    from requests_oauthlib import OAuth1Session
except ImportError:
    import subprocess
    subprocess.check_call(['pip', 'install', 'requests-oauthlib'])
    from requests_oauthlib import OAuth1Session


def escape_xml_text(text):
    """
    Escape special XML characters and convert newlines to XML entities.
    This ensures line breaks are preserved when rendered in Tradeshift.
    """
    if not text:
        return ''
    escaped = html.escape(str(text), quote=True)
    escaped = escaped.replace('\n', '&#10;')
    escaped = escaped.replace('\r', '&#13;')
    return escaped


# J&M Aircraft banking details (U.S. Bank wire transfer)
JM_BANK_ACCOUNT = "157531166591"
JM_BANK_IBAN = "000000000000000"  # Placeholder — US companies don't have IBAN
JM_BANK_ABA = "122235821"
JM_BANK_SWIFT = "USBKUS44IMT"
JM_BANK_NAME = "U.S. Bank/Private Wealth Management"
JM_BANK_ACCOUNT_NAME = "J and M Aircraft"
JM_WIRE_INSTRUCTION = (
    "IMPORTANT: Payment must be made via international wire transfer. "
    "Do NOT pay via IBAN. Use the following wire details: "
    "Bank: U.S. Bank/Private Wealth Management, "
    "ABA/Routing: 122235821, "
    "Account: 157531166591, "
    "SWIFT/BIC: USBKUS44IMT, "
    "Beneficiary: J and M Aircraft."
)

# OAuth credentials
consumer_key = "OwnAccount"
consumer_secret = "OwnAccount"
resource_owner_key = "u-HXpe7uVRRBeb-3VXF6vGdJphpMSQ"
resource_owner_secret = "h2FfTUpep2znKyvwAQgZadWkZvnznbWrjwxjST8+"
tenant_id = "e34b0e07-414e-4e35-83c5-492deb99ae60"

# Get input parameters - Required
invoice_number = params['invoice_number']
issue_date = params['issue_date']
supplier_name = params['supplier_name']
supplier_email = params.get('supplier_email', '')
supplier_address = params['supplier_address']
customer_name = params['customer_name']
customer_email = params.get('customer_email', '')
customer_address = params['customer_address']
line_items = params['line_items']['data']
due_date = params.get('due_date', '')
po_number = params['po_number']
payment_terms = params['payment_terms']  # MANDATORY - agent must provide net terms

# Get input parameters - Optional with defaults
currency_code = params.get('currency_code', 'USD')
tax_percentage = params.get('tax_percentage', 0)
invoice_notes = params.get('invoice_notes', '')

# Additional parameters from SOP
supplier_tax_id = params.get('supplier_tax_id', '')
supplier_postal_code = params.get('supplier_postal_code', '')
supplier_city = params.get('supplier_city', '')
supplier_country_code = params.get('supplier_country_code', '')
customer_postal_code = params.get('customer_postal_code', '')
customer_city = params.get('customer_city', '')
customer_country_code = params.get('customer_country_code', '')
discounts = Decimal(str(params.get('discounts', 0)))
shipping = Decimal(str(params.get('shipping', 0)))
receiver_company_id = params.get('receiver_company_id', '')
customer_company_account_id = params.get('customer_company_account_id', '')

# NEW PARAMETERS for Air France compliance
delivery_date = params.get('delivery_date', '')  # MANDATORY for Air France
tax_exemption_reason = params.get('tax_exemption_reason', '')  # MANDATORY if 0% tax
general_account = params.get('general_account', '')  # Required if no PO
cost_center = params.get('cost_center', '')  # Required if no PO
ship_date = params.get('ship_date', '')  # Ship date from invoice (used for delivery_date)

# ============================================================================
# AUTO-POPULATION LOGIC - Calculate/default values from available invoice data
# ============================================================================

# 1. AUTO-POPULATE delivery_date from ship_date (ship date available on invoice)
if not delivery_date and ship_date:
    delivery_date = ship_date
elif not delivery_date and issue_date:
    delivery_date = issue_date  # Fallback to issue date if no ship date

# 2. AUTO-POPULATE due_date from ship_date + 30 days
if not due_date:
    base_date_str = ship_date or issue_date  # Prefer ship_date, fall back to issue_date
    if base_date_str:
        try:
            base_dt = datetime.strptime(base_date_str, '%Y-%m-%d')
            due_dt = base_dt + timedelta(days=30)
            due_date = due_dt.strftime('%Y-%m-%d')
        except ValueError:
            pass  # Keep due_date empty if date format is invalid

# 3. AUTO-POPULATE tax_exemption_reason (default to "Export to France" for 0% tax)
if not tax_exemption_reason and float(tax_percentage or 0) == 0:
    tax_exemption_reason = "Export to France"

# ============================================================================

# Country code mapping - normalize common variations to ISO 3166-1 alpha-2
COUNTRY_CODE_MAP = {
    'US': 'US', 'USA': 'US', 'U.S.': 'US', 'U.S.A.': 'US',
    'UNITED STATES': 'US', 'UNITED STATES OF AMERICA': 'US', 'AMERICA': 'US',
    'FR': 'FR', 'FRA': 'FR', 'FRANCE': 'FR', 'FRENCH': 'FR',
    'GB': 'GB', 'UK': 'GB', 'UNITED KINGDOM': 'GB', 'ENGLAND': 'GB', 'GREAT BRITAIN': 'GB',
    'DE': 'DE', 'DEU': 'DE', 'GERMANY': 'DE', 'DEUTSCHLAND': 'DE',
    'CA': 'CA', 'CAN': 'CA', 'CANADA': 'CA',
    'MX': 'MX', 'MEX': 'MX', 'MEXICO': 'MX',
    'JP': 'JP', 'JPN': 'JP', 'JAPAN': 'JP',
    'CN': 'CN', 'CHN': 'CN', 'CHINA': 'CN',
    'AU': 'AU', 'AUS': 'AU', 'AUSTRALIA': 'AU',
    'IT': 'IT', 'ITA': 'IT', 'ITALY': 'IT',
    'ES': 'ES', 'ESP': 'ES', 'SPAIN': 'ES',
    'NL': 'NL', 'NLD': 'NL', 'NETHERLANDS': 'NL', 'HOLLAND': 'NL',
    'BE': 'BE', 'BEL': 'BE', 'BELGIUM': 'BE',
    'CH': 'CH', 'CHE': 'CH', 'SWITZERLAND': 'CH',
    'AT': 'AT', 'AUT': 'AT', 'AUSTRIA': 'AT',
    'SE': 'SE', 'SWE': 'SE', 'SWEDEN': 'SE',
    'NO': 'NO', 'NOR': 'NO', 'NORWAY': 'NO',
    'DK': 'DK', 'DNK': 'DK', 'DENMARK': 'DK',
    'FI': 'FI', 'FIN': 'FI', 'FINLAND': 'FI',
    'PL': 'PL', 'POL': 'PL', 'POLAND': 'PL',
    'BR': 'BR', 'BRA': 'BR', 'BRAZIL': 'BR',
    'IN': 'IN', 'IND': 'IN', 'INDIA': 'IN',
    'SG': 'SG', 'SGP': 'SG', 'SINGAPORE': 'SG',
    'HK': 'HK', 'HKG': 'HK', 'HONG KONG': 'HK',
    'KR': 'KR', 'KOR': 'KR', 'SOUTH KOREA': 'KR', 'KOREA': 'KR',
    'TW': 'TW', 'TWN': 'TW', 'TAIWAN': 'TW',
    'PH': 'PH', 'PHL': 'PH', 'PHILIPPINES': 'PH',
    'TH': 'TH', 'THA': 'TH', 'THAILAND': 'TH',
    'MY': 'MY', 'MYS': 'MY', 'MALAYSIA': 'MY',
    'ID': 'ID', 'IDN': 'ID', 'INDONESIA': 'ID',
    'VN': 'VN', 'VNM': 'VN', 'VIETNAM': 'VN',
    'AE': 'AE', 'ARE': 'AE', 'UAE': 'AE', 'UNITED ARAB EMIRATES': 'AE',
    'SA': 'SA', 'SAU': 'SA', 'SAUDI ARABIA': 'SA',
    'IL': 'IL', 'ISR': 'IL', 'ISRAEL': 'IL',
    'ZA': 'ZA', 'ZAF': 'ZA', 'SOUTH AFRICA': 'ZA',
    'IE': 'IE', 'IRL': 'IE', 'IRELAND': 'IE',
    'PT': 'PT', 'PRT': 'PT', 'PORTUGAL': 'PT',
    'GR': 'GR', 'GRC': 'GR', 'GREECE': 'GR',
    'CZ': 'CZ', 'CZE': 'CZ', 'CZECH REPUBLIC': 'CZ', 'CZECHIA': 'CZ',
    'RO': 'RO', 'ROU': 'RO', 'ROMANIA': 'RO',
    'HU': 'HU', 'HUN': 'HU', 'HUNGARY': 'HU',
    'TR': 'TR', 'TUR': 'TR', 'TURKEY': 'TR',
    'RU': 'RU', 'RUS': 'RU', 'RUSSIA': 'RU',
    'NZ': 'NZ', 'NZL': 'NZ', 'NEW ZEALAND': 'NZ',
}

def normalize_country_code(code):
    """Convert country name/code variations to ISO 3166-1 alpha-2"""
    if not code:
        return ''
    return COUNTRY_CODE_MAP.get(code.upper().strip(), code.upper().strip())

def extract_country_from_address(address):
    """Extract country code from address string by checking last parts"""
    if not address:
        return ''
    parts = address.upper().replace(',', ' ').split()
    for num_words in [1, 2, 3]:
        if len(parts) >= num_words:
            candidate = ' '.join(parts[-num_words:])
            if candidate in COUNTRY_CODE_MAP:
                return COUNTRY_CODE_MAP[candidate]
    return ''

# Known Tradeshift network connections with customer-specific requirements
KNOWN_CUSTOMERS = {
    'AIR FRANCE': {
        'company_account_id': '909060c6-9a85-498e-b01b-5aa25cccebc4',
        'connection_id': 'a92ebb93-2b62-4de5-ae0c-a1c31cc5e736',  # For API linking
        'country_code': 'FR',
        'name': 'Air France Industries',
        'requirements': {
            'delivery_date_mandatory': True,
            'due_date_mandatory': True,
            'invoice_number_max_length': 16,
            'invoice_number_allowed_chars': r'^[a-zA-Z0-9,.\-_]+$',
            'issue_date_max_days_past': 35,
            'tax_exemption_reason_required': True,
            'po_or_account_required': True,
            'payment_terms_mandatory': True,
            'payment_terms_default': '''Payment terms: Net 30 days from invoice date.
Late payment penalties: Interest at 3x the legal rate as per Article L441-10 of the French Commercial Code.
Recovery costs: Minimum flat-rate indemnity of 40 (forty) Euro for recovery costs as per Article D441-5 of the French Commercial Code.'''
        }
    },
}

def detect_known_customer(customer_name):
    """Check if customer matches a known Tradeshift network connection"""
    if not customer_name:
        return None
    name_upper = customer_name.upper().strip()
    for key, data in KNOWN_CUSTOMERS.items():
        if key in name_upper or name_upper in key:
            return data
    return None

def validate_for_customer(customer_data, invoice_data):
    """Validate invoice data against customer-specific requirements"""
    if not customer_data or 'requirements' not in customer_data:
        return []

    errors = []
    req = customer_data['requirements']

    # Invoice number length validation
    if req.get('invoice_number_max_length'):
        if len(invoice_data['invoice_number']) > req['invoice_number_max_length']:
            errors.append(f"Invoice number '{invoice_data['invoice_number']}' exceeds {req['invoice_number_max_length']} characters (has {len(invoice_data['invoice_number'])})")

    # Invoice number character validation
    if req.get('invoice_number_allowed_chars'):
        if not re.match(req['invoice_number_allowed_chars'], invoice_data['invoice_number']):
            errors.append(f"Invoice number '{invoice_data['invoice_number']}' contains invalid characters. Only alphanumeric and , . - _ are allowed")

    # Issue date validation (max days in past)
    if req.get('issue_date_max_days_past'):
        try:
            issue = datetime.strptime(invoice_data['issue_date'], '%Y-%m-%d')
            max_past = datetime.now() - timedelta(days=req['issue_date_max_days_past'])
            if issue < max_past:
                errors.append(f"Issue date {invoice_data['issue_date']} is more than {req['issue_date_max_days_past']} days in the past")
        except ValueError:
            errors.append(f"Invalid issue date format: {invoice_data['issue_date']}")

    # Mandatory field validations
    if req.get('delivery_date_mandatory') and not invoice_data.get('delivery_date'):
        errors.append("Delivery date is MANDATORY for this customer")

    if req.get('due_date_mandatory') and not invoice_data.get('due_date'):
        errors.append("Due date (payment due date) is MANDATORY for this customer")

    # PO or Account requirement
    if req.get('po_or_account_required'):
        has_po = bool(invoice_data.get('po_number'))
        has_account = bool(invoice_data.get('general_account') and invoice_data.get('cost_center'))
        if not has_po and not has_account:
            errors.append("Either PO number OR (general_account AND cost_center) is REQUIRED for this customer")

    # Tax exemption reason
    if req.get('tax_exemption_reason_required'):
        tax_pct = float(invoice_data.get('tax_percentage', 0))
        if tax_pct == 0 and not invoice_data.get('tax_exemption_reason'):
            errors.append("Tax exemption reason is REQUIRED for 0% tax items (e.g., 'Export outside EU', 'Intra-community supply')")

    return errors

print(f"<trace><title>Starting invoice creation</title><data>{{'invoice_number': '{invoice_number}', 'supplier': '{supplier_name}', 'customer': '{customer_name}'}}</data></trace>")

# Detect known customer and get requirements
known_customer = detect_known_customer(customer_name)
if known_customer:
    print(f"<trace><title>Detected known customer</title><data>{{'customer': '{customer_name}', 'matched': '{known_customer['name']}', 'connection_id': '{known_customer.get('connection_id', 'N/A')}'}}</data></trace>")

    # Auto-populate from known customer if not provided
    if not customer_company_account_id:
        customer_company_account_id = known_customer['company_account_id']
    if not customer_country_code:
        customer_country_code = known_customer['country_code']

    # Auto-generate payment terms if required and not provided
    if known_customer.get('requirements', {}).get('payment_terms_mandatory'):
        if not payment_terms:
            payment_terms = known_customer['requirements'].get('payment_terms_default', '')
            print(f"<trace><title>Auto-generated payment terms</title><data>{{'source': 'customer_requirements'}}</data></trace>")

# Prepare invoice data for validation
invoice_data = {
    'invoice_number': invoice_number,
    'issue_date': issue_date,
    'due_date': due_date,
    'delivery_date': delivery_date,
    'po_number': po_number,
    'general_account': general_account,
    'cost_center': cost_center,
    'tax_percentage': tax_percentage,
    'tax_exemption_reason': tax_exemption_reason,
}

# Validate against customer requirements
if known_customer:
    validation_errors = validate_for_customer(known_customer, invoice_data)
    if validation_errors:
        error_list = '\n'.join(f"  - {e}" for e in validation_errors)
        print(f"<trace><title>Validation FAILED</title><data>{{'errors': {validation_errors}}}</data></trace>")
        results = {
            "success": False,
            "error": f"Invoice validation failed for {known_customer['name']}",
            "validation_errors": validation_errors,
            "invoice_number": invoice_number,
            "customer": customer_name,
            "hint": "Please provide all mandatory fields for this customer"
        }
        return results

# Parse supplier address if not provided separately
supplier_state = ''
if not supplier_city and ',' in supplier_address:
    parts = [p.strip() for p in supplier_address.split(',')]
    supplier_street = parts[0] if len(parts) > 0 else supplier_address
    supplier_city = parts[1] if len(parts) > 1 else ''
    if len(parts) > 2:
        last_parts = parts[-1].split()
        if len(last_parts) >= 2:
            supplier_state = last_parts[0]
            supplier_postal_code = last_parts[1] if len(last_parts) > 1 else ''
        else:
            supplier_postal_code = parts[-1]
else:
    supplier_street = supplier_address

# Parse customer address if not provided separately
customer_state = ''
if not customer_city and ',' in customer_address:
    parts = [p.strip() for p in customer_address.split(',')]
    customer_street = parts[0] if len(parts) > 0 else customer_address
    customer_city = parts[1] if len(parts) > 1 else ''
    if len(parts) > 2:
        last_parts = parts[-1].split()
        if len(last_parts) >= 2:
            customer_state = last_parts[0]
            customer_postal_code = last_parts[1] if len(last_parts) > 1 else ''
        else:
            customer_postal_code = parts[-1]
else:
    customer_street = customer_address

# Calculate totals
subtotal = Decimal('0')
for item in line_items:
    line_total = Decimal(str(item['quantity'])) * Decimal(str(item['unit_price']))
    subtotal += line_total

tax_amount = subtotal * Decimal(str(tax_percentage)) / Decimal('100')
grand_total = subtotal + tax_amount + shipping - discounts

print(f"<trace><title>Calculated invoice totals</title><data>{{'subtotal': {subtotal}, 'tax': {tax_amount}, 'shipping': {shipping}, 'discounts': {discounts}, 'grand_total': {grand_total}, 'due_date': '{due_date}', 'delivery_date': '{delivery_date}'}}</data></trace>")

# Build tax exemption reason element (for 0% tax)
tax_exemption_element = ""
if tax_percentage == 0 and tax_exemption_reason:
    tax_exemption_element = f"\n                    <cbc:TaxExemptionReason>{escape_xml_text(tax_exemption_reason)}</cbc:TaxExemptionReason>"

# Build AccountingCost element (if no PO but has account/cost center)
accounting_cost_element = ""
if not po_number and general_account and cost_center:
    accounting_cost_value = f"Account:{general_account};CostCenter:{cost_center}"
    accounting_cost_element = f"\n    <cbc:AccountingCost>{escape_xml_text(accounting_cost_value)}</cbc:AccountingCost>"

# Build invoice lines XML
invoice_lines_xml = ""
for idx, item in enumerate(line_items, 1):
    quantity = Decimal(str(item['quantity']))
    unit_price = Decimal(str(item['unit_price']))
    line_total = quantity * unit_price
    unit_code = item.get('unit', 'EA')
    sku = item.get('sku', '')
    description = item.get('description', '')
    name = item.get('name', description[:50])

    sku_element = ""
    if sku:
        sku_element = f"""
            <cac:SellersItemIdentification>
                <cbc:ID>{sku}</cbc:ID>
            </cac:SellersItemIdentification>"""

    # Escape description and name
    description_escaped = escape_xml_text(description)
    name_escaped = escape_xml_text(name)

    # Line-level accounting cost (if no PO)
    line_accounting_cost = ""
    if not po_number and general_account and cost_center:
        line_accounting_cost = f"\n        <cbc:AccountingCost>Account:{general_account};CostCenter:{cost_center}</cbc:AccountingCost>"

    invoice_lines_xml += f"""
    <cac:InvoiceLine>
        <cbc:ID>{idx}</cbc:ID>{line_accounting_cost}
        <cbc:InvoicedQuantity unitCode="{unit_code}">{float(quantity):.2f}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="{currency_code}">{float(line_total):.2f}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="{currency_code}">0.00</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="{currency_code}">{float(line_total):.2f}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="{currency_code}">0.00</cbc:TaxAmount>
                <cac:TaxCategory>
                    <cbc:ID>E</cbc:ID>
                    <cbc:Percent>{float(tax_percentage)}</cbc:Percent>{tax_exemption_element}
                    <cac:TaxScheme>
                        <cbc:ID>VAT</cbc:ID>
                    </cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Description>{description_escaped}</cbc:Description>
            <cbc:Name>{name_escaped}</cbc:Name>{sku_element}
            <cac:ClassifiedTaxCategory>
                <cbc:ID>E</cbc:ID>
                <cbc:Percent>{float(tax_percentage)}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="{currency_code}">{float(unit_price):.2f}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>"""

# Build optional elements
notes_escaped = escape_xml_text(invoice_notes) if invoice_notes else ""
note_element = f"\n    <cbc:Note>{notes_escaped}</cbc:Note>" if invoice_notes else ""

# Order reference (PO number)
order_ref_element = ""
if po_number:
    order_ref_element = f"""
    <cac:OrderReference>
        <cbc:ID>{escape_xml_text(po_number)}</cbc:ID>
    </cac:OrderReference>"""

# Payment terms (MANDATORY for Air France with specific French law text)
# Tradeshift DOES parse structured PaymentMeans (confirmed by their UBL examples).
# Wire transfer details are ALSO kept here as human-readable backup.
wire_transfer_note = (
    f"\nPayment Due Date: {due_date}\n"
    f"Payment method: International Wire Transfer\n"
    f"Bank: {JM_BANK_NAME}\n"
    f"Account: {JM_BANK_ACCOUNT}\n"
    f"ABA/Routing: {JM_BANK_ABA}\n"
    f"SWIFT/BIC: {JM_BANK_SWIFT}\n"
    f"Beneficiary: {JM_BANK_ACCOUNT_NAME}\n"
    f"NOTE: Do NOT pay via IBAN. Payment must be made via international wire transfer."
)
payment_terms_with_wire = f"{payment_terms}\n{wire_transfer_note}" if payment_terms else wire_transfer_note
payment_terms_escaped = escape_xml_text(payment_terms_with_wire)
payment_terms_element = f"""
    <cac:PaymentTerms>
        <cbc:Note>{payment_terms_escaped}</cbc:Note>
    </cac:PaymentTerms>"""

# Due date element DISABLED — Tradeshift ignores top-level <cbc:DueDate>,
# and <cac:PaymentMeans>/<cbc:PaymentDueDate> triggers unwanted BIC/IBAN section.
# Awaiting Tradeshift support response for correct API approach.
# Due date is still calculated and included in PaymentTerms.Note and results dict.
due_date_element = ""

# Delivery element (MANDATORY for Air France)
delivery_element = ""
if delivery_date:
    delivery_element = f"""
    <cac:Delivery>
        <cbc:ActualDeliveryDate>{delivery_date}</cbc:ActualDeliveryDate>
    </cac:Delivery>"""

# PaymentMeans — due date only. BIC/IBAN section will appear but can be manually X'd out.
payment_means_element = ""
if due_date:
    payment_means_element = f"""
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode listID="UN/ECE 4461">31</cbc:PaymentMeansCode>
        <cbc:PaymentDueDate>{due_date}</cbc:PaymentDueDate>
    </cac:PaymentMeans>"""

supplier_tax_scheme = ""
if supplier_tax_id:
    supplier_tax_scheme = f"""
            <cac:PartyTaxScheme>
                <cbc:CompanyID>{supplier_tax_id}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>"""

customer_contact = ""
if customer_email:
    customer_contact = f"""
            <cac:Contact>
                <cbc:ElectronicMail>{customer_email}</cbc:ElectronicMail>
            </cac:Contact>"""

# Build PartyIdentification elements
supplier_party_id = f"""
            <cac:PartyIdentification>
                <cbc:ID schemeID="TS:ID">{tenant_id}</cbc:ID>
            </cac:PartyIdentification>"""
if supplier_tax_id:
    supplier_party_id += f"""
            <cac:PartyIdentification>
                <cbc:ID schemeID="US:EIN">{supplier_tax_id}</cbc:ID>
            </cac:PartyIdentification>"""

# Customer party ID
customer_party_id = ""
if customer_company_account_id:
    customer_party_id = f"""
            <cac:PartyIdentification>
                <cbc:ID schemeID="TS:ID">{customer_company_account_id}</cbc:ID>
            </cac:PartyIdentification>"""
elif receiver_company_id:
    customer_party_id = f"""
            <cac:PartyIdentification>
                <cbc:ID schemeID="GLN">{receiver_company_id}</cbc:ID>
            </cac:PartyIdentification>"""

# Normalize country codes
supplier_country_code = normalize_country_code(supplier_country_code)
customer_country_code = normalize_country_code(customer_country_code)

# Extract from address if not provided
if not supplier_country_code:
    supplier_country_code = extract_country_from_address(supplier_address)
    if supplier_country_code:
        print(f"<trace><title>Extracted supplier country from address</title><data>{{'country': '{supplier_country_code}'}}</data></trace>")

if not customer_country_code:
    customer_country_code = extract_country_from_address(customer_address)
    if customer_country_code:
        print(f"<trace><title>Extracted customer country from address</title><data>{{'country': '{customer_country_code}'}}</data></trace>")

print(f"<trace><title>Country codes resolved</title><data>{{'supplier_country': '{supplier_country_code}', 'customer_country': '{customer_country_code}'}}</data></trace>")

# Validate country codes
if not supplier_country_code:
    raise ValueError("supplier_country_code is required and could not be extracted from address")
if not customer_country_code:
    raise ValueError("customer_country_code is required and could not be extracted from address")

# Country elements
supplier_country_element = f"""
                <cac:Country>
                    <cbc:IdentificationCode>{supplier_country_code}</cbc:IdentificationCode>
                </cac:Country>"""

customer_country_element = f"""
                <cac:Country>
                    <cbc:IdentificationCode>{customer_country_code}</cbc:IdentificationCode>
                </cac:Country>"""

# Build the complete UBL 2.1 XML invoice
invoice_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>urn:tradeshift.com:ubl-2.1-customization:basic</cbc:CustomizationID>
    <cbc:ProfileID>urn:tradeshift.com:profile:basic:1.0</cbc:ProfileID>
    <cbc:ID>{invoice_number}</cbc:ID>
    <cbc:IssueDate>{issue_date}</cbc:IssueDate>{due_date_element}
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>{note_element}{accounting_cost_element}
    <cbc:DocumentCurrencyCode>{currency_code}</cbc:DocumentCurrencyCode>{order_ref_element}

    <cac:AccountingSupplierParty>
        <cac:Party>{supplier_party_id}
            <cac:PartyName>
                <cbc:Name>{supplier_name}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>{supplier_street}</cbc:StreetName>
                <cbc:CityName>{supplier_city}</cbc:CityName>
                <cbc:PostalZone>{supplier_postal_code}</cbc:PostalZone>
                <cbc:CountrySubentity>{supplier_state}</cbc:CountrySubentity>{supplier_country_element}
            </cac:PostalAddress>{supplier_tax_scheme}
            <cac:Contact>
                <cbc:ElectronicMail>{supplier_email}</cbc:ElectronicMail>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingSupplierParty>

    <cac:AccountingCustomerParty>
        <cac:Party>{customer_party_id}
            <cac:PartyName>
                <cbc:Name>{customer_name}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>{customer_street}</cbc:StreetName>
                <cbc:CityName>{customer_city}</cbc:CityName>
                <cbc:PostalZone>{customer_postal_code}</cbc:PostalZone>
                <cbc:CountrySubentity>{customer_state}</cbc:CountrySubentity>{customer_country_element}
            </cac:PostalAddress>{customer_contact}
        </cac:Party>
    </cac:AccountingCustomerParty>{delivery_element}{payment_means_element}{payment_terms_element}

    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="{currency_code}">{float(tax_amount):.2f}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="{currency_code}">{float(subtotal):.2f}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="{currency_code}">{float(tax_amount):.2f}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>E</cbc:ID>
                <cbc:Percent>{float(tax_percentage)}</cbc:Percent>{tax_exemption_element}
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>

    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="{currency_code}">{float(subtotal):.2f}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="{currency_code}">{float(subtotal):.2f}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="{currency_code}">{float(grand_total):.2f}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="{currency_code}">{float(discounts):.2f}</cbc:AllowanceTotalAmount>
        <cbc:ChargeTotalAmount currencyID="{currency_code}">{float(shipping):.2f}</cbc:ChargeTotalAmount>
        <cbc:PayableAmount currencyID="{currency_code}">{float(grand_total):.2f}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
{invoice_lines_xml}
</Invoice>'''

print(f"<trace><title>Built invoice XML</title><data>{{'xml_size': {len(invoice_xml)}, 'line_count': {len(line_items)}}}</data></trace>")

# Generate a UUID for the document
document_uuid = str(uuid.uuid4())

# Create OAuth1 session
oauth = OAuth1Session(
    client_key=consumer_key,
    client_secret=consumer_secret,
    resource_owner_key=resource_owner_key,
    resource_owner_secret=resource_owner_secret
)

# Prepare API request - ALWAYS create as DRAFT first (two-step process per Tradeshift API)
# Step 1: Create draft with draft=true parameter
# Step 2: Dispatch separately via PUT /documents/{id}/dispatches/{dispatchId} (NOT done here)
url = f"https://api.tradeshift.com/tradeshift/rest/external/documents/{document_uuid}"

query_params = {
    "documentProfileId": "tradeshift.invoice.1.0",
    "draft": "true"  # CRITICAL: Always create as draft - dispatch is a separate step
}

# Note: connectionId query parameter does NOT work for linking - the TS:ID in the XML
# handles connection resolution automatically when draft=true is used
if known_customer and known_customer.get('connection_id'):
    print(f"<trace><title>Known customer detected - connection will be auto-linked via TS:ID</title><data>{{'connection_id': '{known_customer['connection_id']}', 'company_account_id': '{known_customer['company_account_id']}'}}</data></trace>")

print(f"<trace><title>Calling Tradeshift API (DRAFT mode)</title><data>{{'url': '{url}', 'method': 'PUT', 'document_uuid': '{document_uuid}', 'params': {query_params}}}</data></trace>")

headers = {
    "Content-Type": "application/xml",
    "Accept": "application/json",
    "X-Tradeshift-TenantId": tenant_id
}

response = oauth.put(url, data=invoice_xml.encode('utf-8'), headers=headers, params=query_params)

print(f"<trace><title>Received API response</title><data>{{'status_code': {response.status_code}, 'response': '{response.text[:500]}'}}</data></trace>")

# Handle response
if response.status_code in [200, 201, 204]:
    try:
        response_data = response.json()
    except:
        response_data = {"raw_response": response.text}

    review_link = f"https://go.tradeshift.com/#/Tradeshift.ConversationLG/view/{document_uuid}"

    # Build dispatch instructions for later use (dispatch is NEVER automatic)
    dispatch_info = None
    if known_customer and known_customer.get('connection_id'):
        dispatch_info = {
            "endpoint": f"PUT /documents/{document_uuid}/dispatches/{{dispatchId}}",
            "connection_id": known_customer['connection_id'],
            "body": {"ConnectionId": known_customer['connection_id']},
            "warning": "DO NOT dispatch without explicit user approval"
        }

    results = {
        "success": True,
        "document_id": document_uuid,
        "invoice_number": invoice_number,
        "status": "DRAFT - NOT SENT",
        "dispatched": False,
        "created_at": datetime.now().isoformat(),
        "subtotal": str(subtotal),
        "tax_amount": str(tax_amount),
        "shipping": str(shipping),
        "discounts": str(discounts),
        "grand_total": str(grand_total),
        "currency": currency_code,
        "due_date": due_date,
        "delivery_date": delivery_date,
        "line_count": len(line_items),
        "review_link": review_link,
        "api_response": response_data,
        "next_step": "Review the draft invoice in Tradeshift UI. To dispatch, use separate API call.",
        "connection_auto_linked": bool(known_customer and known_customer.get('connection_id')),
        "customer_connection": known_customer['name'] if known_customer else None,
        "dispatch_info": dispatch_info
    }

    print(f"<trace><title>Invoice DRAFT created successfully</title><data>{{'document_id': '{document_uuid}', 'status': 'DRAFT', 'connection_auto_linked': {results['connection_auto_linked']}}}</data></trace>")
else:
    error_message = response.text
    try:
        error_data = response.json()
        error_message = error_data.get('message') or error_data.get('error') or error_data.get('Message') or error_message
    except:
        pass

    results = {
        "success": False,
        "error": f"Failed to create invoice. Status code: {response.status_code}",
        "error_details": error_message,
        "invoice_number": invoice_number,
        "document_uuid": document_uuid
    }

    print(f"<trace><title>Invoice creation failed</title><data>{{'status_code': {response.status_code}, 'error': '{error_message[:200]}'}}</data></trace>")

return results
