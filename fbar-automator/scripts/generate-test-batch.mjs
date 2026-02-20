#!/usr/bin/env node
// ---------------------------------------------------------------------------
// generate-test-batch.mjs — Standalone FinCEN FBAR XML Batch Generator
// ---------------------------------------------------------------------------
// Generates a schema-compliant XML batch with 26 Activities (FBAR filings)
// for BSA E-Filing sandbox testing. Uses TCC = "TBSATEST".
//
// Schema: EFL_FBARXBatchSchema.xsd v1.2
// Namespace: www.fincen.gov/base (prefix: fc2)
//
// IMPORTANT: All SSNs/EINs/PTINs are FAKE test data.
// SSNs use 900-999 range (IRS-designated test range).
// ---------------------------------------------------------------------------

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// SeqNum counter — globally unique across entire XML document
// ---------------------------------------------------------------------------
let seqNum = 0;
function nextSeq() {
  return String(++seqNum);
}

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Transmitter config (same for all Activities)
// ---------------------------------------------------------------------------
const TRANSMITTER = {
  name: "All Solutions Consulting",
  tin: "883761328",
  tcc: "TBSATEST",
  phone: "3035551234",
  contactFirst: "Matthew",
  contactLast: "Cohen",
  address: {
    street: "6732 W Coal Mine Ave Ste 451",
    city: "Littleton",
    state: "CO",
    zip: "80123",
    country: "US",
  },
};

// ---------------------------------------------------------------------------
// Preparer config (same for all Activities)
// ---------------------------------------------------------------------------
const PREPARER = {
  firstName: "Matthew",
  lastName: "Cohen",
  phone: "3035551234",
  ptin: "P99999999",
  firmName: "All Solutions Consulting",
  firmEin: "883761328",
  address: {
    street: "6732 W Coal Mine Ave Ste 451",
    city: "Littleton",
    state: "CO",
    zip: "80123",
    country: "US",
  },
};

// ---------------------------------------------------------------------------
// Test filer data — 26 fake filers with diverse scenarios
// ---------------------------------------------------------------------------
const FILERS = [
  // --- Activities 1-5: Single bank account, various countries ---
  {
    first: "John", last: "Testman", ssn: "900111001", dob: "19800115",
    street: "100 Main St", city: "Denver", state: "CO", zip: "80201", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Swiss National Bank", num: "CH1234567890", maxVal: "15000", instCity: "Zurich", instCountry: "CH", instStreet: "Bahnhofstrasse 1", instZip: "8001" },
    ],
  },
  {
    first: "Jane", last: "Testwoman", ssn: "900111002", dob: "19850622",
    street: "200 Oak Ave", city: "Boulder", state: "CO", zip: "80301", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "HSBC Holdings", num: "GB9876543210", maxVal: "25000", instCity: "London", instCountry: "GB", instStreet: "8 Canada Square", instZip: "E145HQ" },
    ],
  },
  {
    first: "Robert", last: "Testson", ssn: "900111003", dob: "19750310",
    street: "300 Pine Rd", city: "Aurora", state: "CO", zip: "80010", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Deutsche Bank AG", num: "DE1122334455", maxVal: "50000", instCity: "Frankfurt", instCountry: "DE", instStreet: "Taunusanlage 12", instZip: "60325" },
    ],
  },
  {
    first: "Maria", last: "Testinez", ssn: "900111004", dob: "19900805",
    street: "400 Elm Blvd", city: "Lakewood", state: "CO", zip: "80226", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Banco Santander", num: "ES5566778899", maxVal: "12000", instCity: "Madrid", instCountry: "ES", instStreet: "Paseo de Pereda 9", instZip: "28014" },
    ],
  },
  {
    first: "David", last: "Testberg", ssn: "900111005", dob: "19880120",
    street: "500 Cedar Ln", city: "Arvada", state: "CO", zip: "80002", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Mizuho Financial Group", num: "JP1234509876", maxVal: "75000", instCity: "Tokyo", instCountry: "JP", instStreet: "1-5-5 Otemachi", instZip: "1008176" },
    ],
  },
  // --- Activities 6-10: Two accounts each (bank + securities) ---
  {
    first: "Sarah", last: "Testwell", ssn: "900222001", dob: "19820714",
    street: "601 Birch Way", city: "Westminster", state: "CO", zip: "80030", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Credit Suisse", num: "CH9988776655", maxVal: "30000", instCity: "Zurich", instCountry: "CH", instStreet: "Paradeplatz 8", instZip: "8001" },
      { type: "2", eType: "141", name: "UBS Securities", num: "CH5544332211", maxVal: "45000", instCity: "Basel", instCountry: "CH", instStreet: "Aeschenvorstadt 1", instZip: "4002" },
    ],
  },
  {
    first: "Michael", last: "Testworth", ssn: "900222002", dob: "19770319",
    street: "702 Spruce Dr", city: "Thornton", state: "CO", zip: "80229", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Barclays Bank", num: "GB1122334456", maxVal: "20000", instCity: "London", instCountry: "GB", instStreet: "1 Churchill Place", instZip: "E145HP" },
      { type: "2", eType: "141", name: "IG Group Holdings", num: "GB6677889900", maxVal: "35000", instCity: "London", instCountry: "GB", instStreet: "195 Cannon St", instZip: "EC4A5EN" },
    ],
  },
  {
    first: "Emily", last: "Testfield", ssn: "900222003", dob: "19930228",
    street: "803 Maple Ct", city: "Broomfield", state: "CO", zip: "80020", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Commerzbank AG", num: "DE9988776655", maxVal: "18000", instCity: "Frankfurt", instCountry: "DE", instStreet: "Kaiserplatz", instZip: "60311" },
      { type: "2", eType: "141", name: "DeGiro BV", num: "NL1234567890", maxVal: "22000", instCity: "Amsterdam", instCountry: "NL", instStreet: "Amstelplein 1", instZip: "1096HA" },
    ],
  },
  {
    first: "James", last: "Testington", ssn: "900222004", dob: "19690501",
    street: "904 Aspen Pl", city: "Longmont", state: "CO", zip: "80501", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Societe Generale", num: "FR1234567890", maxVal: "40000", instCity: "Paris", instCountry: "FR", instStreet: "29 Boulevard Haussmann", instZip: "75009" },
      { type: "2", eType: "141", name: "Euronext Paris", num: "FR9876543210", maxVal: "55000", instCity: "Paris", instCountry: "FR", instStreet: "14 Place des Reflets", instZip: "92054" },
    ],
  },
  {
    first: "Patricia", last: "Testwood", ssn: "900222005", dob: "19810930",
    street: "1005 Willow Rd", city: "Louisville", state: "CO", zip: "80027", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "National Australia Bank", num: "AU1234567890", maxVal: "28000", instCity: "Melbourne", instCountry: "AU", instStreet: "800 Bourke St", instZip: "3008" },
      { type: "2", eType: "141", name: "ASX Limited", num: "AU9876543210", maxVal: "32000", instCity: "Sydney", instCountry: "AU", instStreet: "20 Bridge St", instZip: "2000" },
    ],
  },
  // --- Activities 11-15: Three accounts each (bank + securities + other) ---
  {
    first: "William", last: "Testmore", ssn: "900333001", dob: "19720415",
    street: "1101 Juniper Ave", city: "Golden", state: "CO", zip: "80401", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Bank of China", num: "CN1234567890", maxVal: "60000", instCity: "Beijing", instCountry: "CN", instStreet: "1 Fuxingmen Nei Dajie", instZip: "100818" },
      { type: "2", eType: "141", name: "China Securities", num: "CN9876543210", maxVal: "45000", instCity: "Shanghai", instCountry: "CN", instStreet: "689 Guangdong Rd", instZip: "200001" },
      { type: "999", eType: "141", name: "China Insurance Fund", num: "CN5555666677", maxVal: "20000", instCity: "Beijing", instCountry: "CN", instStreet: "15 Financial St", instZip: "100032", otherTypeText: "Insurance policy" },
    ],
  },
  {
    first: "Linda", last: "Testview", ssn: "900333002", dob: "19860701",
    street: "1202 Fir St", city: "Englewood", state: "CO", zip: "80110", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Rabobank", num: "NL9988776655", maxVal: "35000", instCity: "Utrecht", instCountry: "NL", instStreet: "Croeselaan 18", instZip: "3521CB" },
      { type: "2", eType: "141", name: "ING Securities", num: "NL1122334455", maxVal: "28000", instCity: "Amsterdam", instCountry: "NL", instStreet: "Bijlmerdreef 106", instZip: "1102CT" },
      { type: "999", eType: "141", name: "Dutch Pension Trust", num: "NL7788990011", maxVal: "15000", instCity: "The Hague", instCountry: "NL", instStreet: "Bezuidenhoutseweg 30", instZip: "2594AV", otherTypeText: "Pension fund" },
    ],
  },
  {
    first: "Richard", last: "Testhill", ssn: "900333003", dob: "19780823",
    street: "1303 Poplar Ln", city: "Centennial", state: "CO", zip: "80112", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Royal Bank of Canada", num: "CA1234567890", maxVal: "55000", instCity: "Toronto", instCountry: "CA", instState: "ON", instStreet: "200 Bay St", instZip: "M5J2J5" },
      { type: "2", eType: "141", name: "TD Securities", num: "CA9876543210", maxVal: "42000", instCity: "Toronto", instCountry: "CA", instState: "ON", instStreet: "66 Wellington St W", instZip: "M5K1A2" },
      { type: "999", eType: "141", name: "Canadian RESP Trust", num: "CA5555666677", maxVal: "18000", instCity: "Montreal", instCountry: "CA", instState: "QC", instStreet: "1250 Rene-Levesque Blvd", instZip: "H3B4W8", otherTypeText: "Education savings plan" },
    ],
  },
  {
    first: "Barbara", last: "Testdale", ssn: "900333004", dob: "19910112",
    street: "1404 Hickory Ct", city: "Parker", state: "CO", zip: "80134", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Nordea Bank", num: "SE1234567890", maxVal: "48000", instCity: "Stockholm", instCountry: "SE", instStreet: "Hamngatan 10", instZip: "10571" },
      { type: "2", eType: "141", name: "Handelsbanken Capital", num: "SE9876543210", maxVal: "33000", instCity: "Stockholm", instCountry: "SE", instStreet: "Kungstradgardsgatan 2", instZip: "10670" },
      { type: "999", eType: "141", name: "Swedish Investment Fund", num: "SE5555666677", maxVal: "22000", instCity: "Gothenburg", instCountry: "SE", instStreet: "Ostra Hamngatan 16", instZip: "41109", otherTypeText: "Investment fund" },
    ],
  },
  {
    first: "Thomas", last: "Testbrook", ssn: "900333005", dob: "19840607",
    street: "1505 Sycamore Way", city: "Castle Rock", state: "CO", zip: "80104", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "DBS Bank", num: "SG1234567890", maxVal: "70000", instCity: "Singapore", instCountry: "SG", instStreet: "12 Marina Blvd", instZip: "018982" },
      { type: "2", eType: "141", name: "SGX Securities", num: "SG9876543210", maxVal: "38000", instCity: "Singapore", instCountry: "SG", instStreet: "2 Shenton Way", instZip: "068804" },
      { type: "999", eType: "141", name: "Singapore Savings Bond", num: "SG5555666677", maxVal: "25000", instCity: "Singapore", instCountry: "SG", instStreet: "10 Shenton Way", instZip: "079117", otherTypeText: "Government savings bond" },
    ],
  },
  // --- Activities 16-18: Multiple bank accounts (various countries) ---
  {
    first: "Charles", last: "Testjoint", ssn: "900444001", dob: "19760320",
    street: "1601 Walnut Blvd", city: "Highlands Ranch", state: "CO", zip: "80129", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Banco Bradesco", num: "BR1234567890", maxVal: "40000", instCity: "Sao Paulo", instCountry: "BR", instStreet: "Cidade de Deus", instZip: "06029900" },
      { type: "2", eType: "141", name: "B3 Exchange", num: "BR9876543210", maxVal: "25000", instCity: "Sao Paulo", instCountry: "BR", instStreet: "Rua XV de Novembro 275", instZip: "01013001" },
    ],
  },
  {
    first: "Susan", last: "Testpair", ssn: "900444002", dob: "19830918",
    street: "1702 Cherry Rd", city: "Parker", state: "CO", zip: "80134", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Scotiabank", num: "CA1111222233", maxVal: "52000", instCity: "Toronto", instCountry: "CA", instState: "ON", instStreet: "44 King St W", instZip: "M5H1H1" },
      { type: "1", eType: "141", name: "CIBC", num: "CA4444555566", maxVal: "38000", instCity: "Toronto", instCountry: "CA", instState: "ON", instStreet: "81 Bay St", instZip: "M5J0E7" },
    ],
  },
  {
    first: "Daniel", last: "Testdual", ssn: "900444003", dob: "19710204",
    street: "1803 Peach Ave", city: "Littleton", state: "CO", zip: "80123", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "ANZ Banking Group", num: "AU1111222233", maxVal: "65000", instCity: "Melbourne", instCountry: "AU", instStreet: "833 Collins St", instZip: "3008" },
      { type: "2", eType: "141", name: "Macquarie Securities", num: "AU4444555566", maxVal: "30000", instCity: "Sydney", instCountry: "AU", instStreet: "50 Martin Place", instZip: "2000" },
    ],
  },
  // --- Activities 19-21: Higher value accounts ---
  {
    first: "Nancy", last: "Testsign", ssn: "900555001", dob: "19890411",
    street: "1901 Plum St", city: "Denver", state: "CO", zip: "80220", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Standard Chartered Bank", num: "HK1234567890", maxVal: "90000", instCity: "Hong Kong", instCountry: "HK", instStreet: "32nd Fl Standard Chartered Tower", instZip: "" },
    ],
  },
  {
    first: "Mark", last: "Testauth", ssn: "900555002", dob: "19740625",
    street: "2001 Grape Ln", city: "Aurora", state: "CO", zip: "80012", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "BNP Paribas", num: "FR1111222233", maxVal: "120000", instCity: "Paris", instCountry: "FR", instStreet: "16 Boulevard des Italiens", instZip: "75009" },
    ],
  },
  {
    first: "Karen", last: "Testpower", ssn: "900555003", dob: "19860930",
    street: "2101 Fig Way", city: "Lakewood", state: "CO", zip: "80226", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Bank of Ireland", num: "IE1234567890", maxVal: "55000", instCity: "Dublin", instCountry: "IE", instStreet: "40 Mespil Rd", instZip: "D04C2N4" },
    ],
  },
  // --- Activities 22-23: Unknown maximum value ---
  {
    first: "Steven", last: "Testunknown", ssn: "900666001", dob: "19950315",
    street: "2201 Olive Ct", city: "Arvada", state: "CO", zip: "80004", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Banco de Chile", num: "CL1234567890", maxVal: "0", unknownValue: true, instCity: "Santiago", instCountry: "CL", instStreet: "Paseo Ahumada 251", instZip: "8320000" },
    ],
  },
  {
    first: "Lisa", last: "Testmystery", ssn: "900666002", dob: "19870720",
    street: "2301 Lemon Blvd", city: "Westminster", state: "CO", zip: "80030", country: "US",
    accounts: [
      { type: "2", eType: "141", name: "Moscow Exchange", num: "RU9876543210", maxVal: "0", unknownValue: true, instCity: "Moscow", instCountry: "RU", instStreet: "Vozdvizhenka St 4/7", instZip: "125009" },
    ],
  },
  // --- Activities 24-25: Mixed account types ---
  {
    first: "Kevin", last: "Testmix", ssn: "900777001", dob: "19790108",
    street: "2401 Mango Ave", city: "Golden", state: "CO", zip: "80401", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Industrial Bank of Korea", num: "KR1234567890", maxVal: "35000", instCity: "Seoul", instCountry: "KR", instStreet: "50 Eulji-ro", instZip: "04538" },
      { type: "2", eType: "141", name: "Korea Investment Corp", num: "KR9876543210", maxVal: "48000", instCity: "Seoul", instCountry: "KR", instStreet: "12 Yeouido-dong", instZip: "07326" },
      { type: "999", eType: "141", name: "Korean Life Insurance", num: "KR5555666677", maxVal: "22000", instCity: "Seoul", instCountry: "KR", instStreet: "27 Sejong-daero 9-gil", instZip: "04513", otherTypeText: "Life insurance policy" },
    ],
  },
  {
    first: "Angela", last: "Testvariety", ssn: "900777002", dob: "19881215",
    street: "2501 Coconut Rd", city: "Thornton", state: "CO", zip: "80229", country: "US",
    accounts: [
      { type: "1", eType: "141", name: "Itau Unibanco", num: "BR5555111122", maxVal: "42000", instCity: "Sao Paulo", instCountry: "BR", instStreet: "Praca Alfredo Egydio de Souza Aranha 100", instZip: "04344902" },
      { type: "2", eType: "141", name: "BTG Pactual", num: "BR6666222233", maxVal: "28000", instCity: "Rio de Janeiro", instCountry: "BR", instStreet: "Praia de Botafogo 501", instZip: "22250040" },
      { type: "1", eType: "141", name: "Banco do Brasil", num: "BR7777333344", maxVal: "55000", instCity: "Brasilia", instCountry: "BR", instStreet: "SBS Q1 Bl G", instZip: "70073901" },
    ],
  },
  // --- Activity 26: Maximum variety (4 accounts) ---
  {
    first: "Christopher", last: "Testmax", ssn: "900888001", dob: "19700303",
    street: "2601 Papaya Ln", city: "Centennial", state: "CO", zip: "80112", country: "US",
    has25Plus: true,
    accounts: [
      { type: "1", eType: "141", name: "Bank of New Zealand", num: "NZ1234567890", maxVal: "38000", instCity: "Wellington", instCountry: "NZ", instStreet: "1 Willis St", instZip: "6011" },
      { type: "2", eType: "141", name: "NZX Securities", num: "NZ9876543210", maxVal: "22000", instCity: "Wellington", instCountry: "NZ", instStreet: "Level 1 NZX Centre", instZip: "6011" },
      { type: "1", eType: "141", name: "Westpac NZ", num: "NZ5555666677", maxVal: "47000", instCity: "Auckland", instCountry: "NZ", instStreet: "16 Takutai Square", instZip: "1010" },
      { type: "999", eType: "141", name: "NZ Super Fund", num: "NZ8888999900", maxVal: "15000", instCity: "Auckland", instCountry: "NZ", instStreet: "21 Queen St", instZip: "1010", otherTypeText: "Superannuation fund" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Today's date as YYYYMMDD
// ---------------------------------------------------------------------------
const now = new Date();
const TODAY = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// XML generation helpers
// ---------------------------------------------------------------------------

function xmlAddress(street, city, state, country, zip) {
  const s = nextSeq();
  // Schema order: RawCityText, RawCountryCodeText, RawStateCodeText, RawStreetAddress1Text, RawZIPCode
  let xml = `            <fc2:Address SeqNum="${s}">\n`;
  xml += `              <fc2:RawCityText>${esc(city)}</fc2:RawCityText>\n`;
  xml += `              <fc2:RawCountryCodeText>${esc(country)}</fc2:RawCountryCodeText>\n`;
  if (state) xml += `              <fc2:RawStateCodeText>${esc(state)}</fc2:RawStateCodeText>\n`;
  xml += `              <fc2:RawStreetAddress1Text>${esc(street)}</fc2:RawStreetAddress1Text>\n`;
  if (zip) xml += `              <fc2:RawZIPCode>${esc(zip)}</fc2:RawZIPCode>\n`;
  xml += `            </fc2:Address>\n`;
  return xml;
}

function xmlPhone(phone) {
  const s = nextSeq();
  return `            <fc2:PhoneNumber SeqNum="${s}">\n              <fc2:PhoneNumberText>${esc(phone)}</fc2:PhoneNumberText>\n            </fc2:PhoneNumber>\n`;
}

function xmlPartyId(numText, typeCode) {
  const s = nextSeq();
  return `            <fc2:PartyIdentification SeqNum="${s}">\n              <fc2:PartyIdentificationNumberText>${esc(numText)}</fc2:PartyIdentificationNumberText>\n              <fc2:PartyIdentificationTypeCode>${esc(typeCode)}</fc2:PartyIdentificationTypeCode>\n            </fc2:PartyIdentification>\n`;
}

// ---------------------------------------------------------------------------
// Build a single Activity element
// ---------------------------------------------------------------------------
function buildActivity(filer, calendarYear) {
  const actSeq = nextSeq();
  const has25Plus = filer.has25Plus ?? false;
  const hasSigAuth = false; // All accounts are type 141 (separately owned) for this test batch

  // --- Activity-level fields (schema order) ---
  // 1. ApprovalOfficialSignatureDateText
  // 2. EFilingPriorDocumentNumber — OMITTED (not an amendment, type is xsd:long)
  // 3. ThirdPartyPreparerIndicator
  let xml = `    <fc2:Activity SeqNum="${actSeq}">\n`;
  xml += `      <fc2:ApprovalOfficialSignatureDateText>${TODAY}</fc2:ApprovalOfficialSignatureDateText>\n`;
  xml += `      <fc2:ThirdPartyPreparerIndicator>Y</fc2:ThirdPartyPreparerIndicator>\n`;

  // --- ActivityAssociation (required) ---
  const assocSeq = nextSeq();
  xml += `      <fc2:ActivityAssociation SeqNum="${assocSeq}">\n`;
  xml += `        <fc2:CorrectsAmendsPriorReportIndicator></fc2:CorrectsAmendsPriorReportIndicator>\n`;
  xml += `      </fc2:ActivityAssociation>\n`;

  // --- Party[0]: Transmitter (type 35) ---
  const txSeq = nextSeq();
  xml += `      <fc2:Party SeqNum="${txSeq}">\n`;
  xml += `        <fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>\n`;
  const txNameSeq = nextSeq();
  // Entity name uses RawPartyFullName (NOT RawPartyLegalName!)
  xml += `        <fc2:PartyName SeqNum="${txNameSeq}">\n`;
  xml += `          <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n`;
  xml += `          <fc2:RawPartyFullName>${esc(TRANSMITTER.name)}</fc2:RawPartyFullName>\n`;
  xml += `        </fc2:PartyName>\n`;
  xml += xmlAddress(TRANSMITTER.address.street, TRANSMITTER.address.city, TRANSMITTER.address.state, TRANSMITTER.address.country, TRANSMITTER.address.zip);
  xml += xmlPhone(TRANSMITTER.phone);
  // Two PartyIdentification elements: TIN (type 4 = EIN for transmitter) + TCC (type 28)
  xml += xmlPartyId(TRANSMITTER.tin, "4");
  xml += xmlPartyId(TRANSMITTER.tcc, "28");
  xml += `      </fc2:Party>\n`;

  // --- Party[1]: Transmitter Contact (type 37) ---
  // FinCEN business rules: type 37 uses RawPartyFullName (entity/org name), NOT individual name fields.
  // A2 error: individual name fields are "inappropriate" for party type 37.
  const tcSeq = nextSeq();
  xml += `      <fc2:Party SeqNum="${tcSeq}">\n`;
  xml += `        <fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>\n`;
  const tcNameSeq = nextSeq();
  xml += `        <fc2:PartyName SeqNum="${tcNameSeq}">\n`;
  xml += `          <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n`;
  xml += `          <fc2:RawPartyFullName>${esc(TRANSMITTER.name)}</fc2:RawPartyFullName>\n`;
  xml += `        </fc2:PartyName>\n`;
  xml += `      </fc2:Party>\n`;

  // --- Party[2]: Filer (type 15) ---
  const filerSeq = nextSeq();
  xml += `      <fc2:Party SeqNum="${filerSeq}">\n`;
  xml += `        <fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>\n`;
  // Schema order for PartyType children:
  // FilerFinancialInterest25ForeignAccountIndicator, FilerTypeIndividualIndicator,
  // IndividualBirthDateText, SignatureAuthoritiesIndicator
  xml += `        <fc2:FilerFinancialInterest25ForeignAccountIndicator>${has25Plus ? "Y" : "N"}</fc2:FilerFinancialInterest25ForeignAccountIndicator>\n`;
  xml += `        <fc2:FilerTypeIndividualIndicator>Y</fc2:FilerTypeIndividualIndicator>\n`;
  if (filer.dob) {
    xml += `        <fc2:IndividualBirthDateText>${esc(filer.dob)}</fc2:IndividualBirthDateText>\n`;
  }
  xml += `        <fc2:SignatureAuthoritiesIndicator>${hasSigAuth ? "Y" : "N"}</fc2:SignatureAuthoritiesIndicator>\n`;
  // PartyName — individual: LastName before FirstName (schema order)
  const filerNameSeq = nextSeq();
  xml += `        <fc2:PartyName SeqNum="${filerNameSeq}">\n`;
  xml += `          <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n`;
  xml += `          <fc2:RawEntityIndividualLastName>${esc(filer.last)}</fc2:RawEntityIndividualLastName>\n`;
  xml += `          <fc2:RawIndividualFirstName>${esc(filer.first)}</fc2:RawIndividualFirstName>\n`;
  xml += `        </fc2:PartyName>\n`;
  xml += xmlAddress(filer.street, filer.city, filer.state, filer.country, filer.zip);
  // PartyIdentification: SSN (type 1)
  xml += xmlPartyId(filer.ssn, "1");
  xml += `      </fc2:Party>\n`;

  // --- Party[3]: Preparer (type 57) ---
  const prepSeq = nextSeq();
  xml += `      <fc2:Party SeqNum="${prepSeq}">\n`;
  xml += `        <fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>\n`;
  const prepNameSeq = nextSeq();
  xml += `        <fc2:PartyName SeqNum="${prepNameSeq}">\n`;
  xml += `          <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n`;
  xml += `          <fc2:RawEntityIndividualLastName>${esc(PREPARER.lastName)}</fc2:RawEntityIndividualLastName>\n`;
  xml += `          <fc2:RawIndividualFirstName>${esc(PREPARER.firstName)}</fc2:RawIndividualFirstName>\n`;
  xml += `        </fc2:PartyName>\n`;
  xml += xmlAddress(PREPARER.address.street, PREPARER.address.city, PREPARER.address.state, PREPARER.address.country, PREPARER.address.zip);
  xml += xmlPhone(PREPARER.phone);
  // PTIN (type 31)
  xml += xmlPartyId(PREPARER.ptin, "31");
  xml += `      </fc2:Party>\n`;

  // --- Party[4]: Preparer Firm (type 56) ---
  const firmSeq = nextSeq();
  xml += `      <fc2:Party SeqNum="${firmSeq}">\n`;
  xml += `        <fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>\n`;
  const firmNameSeq = nextSeq();
  // Entity name uses RawPartyFullName
  xml += `        <fc2:PartyName SeqNum="${firmNameSeq}">\n`;
  xml += `          <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n`;
  xml += `          <fc2:RawPartyFullName>${esc(PREPARER.firmName)}</fc2:RawPartyFullName>\n`;
  xml += `        </fc2:PartyName>\n`;
  // EIN (type 2) for preparer firm — type 2 = standard EIN (type 4 is transmitter-only)
  xml += xmlPartyId(PREPARER.firmEin, "2");
  xml += `      </fc2:Party>\n`;

  // --- Account elements ---
  let accountLevelPartyCount = 0;
  for (const acct of filer.accounts) {
    const acctSeq = nextSeq();
    xml += `      <fc2:Account SeqNum="${acctSeq}">\n`;
    // Schema order: AccountMaximumValueAmountText, AccountNumberText, AccountTypeCode,
    // EFilingAccountTypeCode, OtherAccountTypeText, UnknownMaximumValueIndicator, then nested Party
    // FinCEN rule A20: When UnknownMaximumValueIndicator=Y, OMIT AccountMaximumValueAmountText
    if (!acct.unknownValue) {
      xml += `        <fc2:AccountMaximumValueAmountText>${esc(acct.maxVal)}</fc2:AccountMaximumValueAmountText>\n`;
    }
    xml += `        <fc2:AccountNumberText>${esc(acct.num)}</fc2:AccountNumberText>\n`;
    xml += `        <fc2:AccountTypeCode>${esc(acct.type)}</fc2:AccountTypeCode>\n`;
    xml += `        <fc2:EFilingAccountTypeCode>${esc(acct.eType)}</fc2:EFilingAccountTypeCode>\n`;
    // FinCEN rule D10: AccountTypeCode=999 requires OtherAccountTypeText
    if (acct.type === "999" && acct.otherTypeText) {
      xml += `        <fc2:OtherAccountTypeText>${esc(acct.otherTypeText)}</fc2:OtherAccountTypeText>\n`;
    }
    if (acct.unknownValue) {
      xml += `        <fc2:UnknownMaximumValueIndicator>Y</fc2:UnknownMaximumValueIndicator>\n`;
    }
    // Nested Party: Financial Institution (type 41)
    const fiSeq = nextSeq();
    xml += `        <fc2:Party SeqNum="${fiSeq}">\n`;
    xml += `          <fc2:ActivityPartyTypeCode>41</fc2:ActivityPartyTypeCode>\n`;
    const fiNameSeq = nextSeq();
    // Entity name uses RawPartyFullName
    xml += `          <fc2:PartyName SeqNum="${fiNameSeq}">\n`;
    xml += `            <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n`;
    xml += `            <fc2:RawPartyFullName>${esc(acct.name)}</fc2:RawPartyFullName>\n`;
    xml += `          </fc2:PartyName>\n`;
    // Address for FI (required per Account>Party schema — minOccurs not specified, defaults to 1)
    const fiAddrSeq = nextSeq();
    xml += `          <fc2:Address SeqNum="${fiAddrSeq}">\n`;
    xml += `            <fc2:RawCityText>${esc(acct.instCity)}</fc2:RawCityText>\n`;
    xml += `            <fc2:RawCountryCodeText>${esc(acct.instCountry)}</fc2:RawCountryCodeText>\n`;
    // FinCEN rule D18: CA/MX addresses need RawStateCodeText (province/state)
    if (acct.instState) xml += `            <fc2:RawStateCodeText>${esc(acct.instState)}</fc2:RawStateCodeText>\n`;
    xml += `            <fc2:RawStreetAddress1Text>${esc(acct.instStreet)}</fc2:RawStreetAddress1Text>\n`;
    if (acct.instZip) xml += `            <fc2:RawZIPCode>${esc(acct.instZip)}</fc2:RawZIPCode>\n`;
    xml += `          </fc2:Address>\n`;
    xml += `        </fc2:Party>\n`;
    accountLevelPartyCount++;
    xml += `      </fc2:Account>\n`;
  }

  // --- ForeignAccountActivity (required) ---
  const faaSeq = nextSeq();
  xml += `      <fc2:ForeignAccountActivity SeqNum="${faaSeq}">\n`;
  // FinCEN rule C44: When 25+ indicator=Y, must include ForeignAccountHeldQuantityText
  if (has25Plus) {
    xml += `        <fc2:ForeignAccountHeldQuantityText>30</fc2:ForeignAccountHeldQuantityText>\n`;
  }
  xml += `        <fc2:ReportCalendarYearText>${calendarYear}</fc2:ReportCalendarYearText>\n`;
  xml += `      </fc2:ForeignAccountActivity>\n`;

  xml += `    </fc2:Activity>\n`;

  return { xml, accountCount: filer.accounts.length, partyCount: accountLevelPartyCount };
}

// ---------------------------------------------------------------------------
// Build complete batch XML document
// ---------------------------------------------------------------------------
function buildBatch() {
  // Reset SeqNum counter
  seqNum = 0;

  const calendarYear = "2025";
  let totalActivityCount = 0;
  let totalAccountCount = 0;
  let totalPartyCount = 0;

  // Build all Activity elements first to get counts
  const activityXmls = [];
  for (const filer of FILERS) {
    const result = buildActivity(filer, calendarYear);
    activityXmls.push(result.xml);
    totalActivityCount++;
    totalAccountCount += result.accountCount;
    totalPartyCount += result.partyCount;
  }

  // Assemble full XML document
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<fc2:EFilingBatchXML\n`;
  xml += `  ActivityCount="${totalActivityCount}"\n`;
  xml += `  PartyCount="${totalPartyCount}"\n`;
  xml += `  AccountCount="${totalAccountCount}"\n`;
  xml += `  JointlyOwnedOwnerCount="0"\n`;
  xml += `  NoFIOwnerCount="0"\n`;
  xml += `  ConsolidatedOwnerCount="0"\n`;
  xml += `  xsi:schemaLocation="www.fincen.gov/base EFL_FBARXBatchSchema.xsd"\n`;
  xml += `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
  xml += `  xmlns:fc2="www.fincen.gov/base">\n`;
  xml += `  <fc2:FormTypeCode>FBARX</fc2:FormTypeCode>\n`;

  for (const actXml of activityXmls) {
    xml += actXml;
  }

  xml += `</fc2:EFilingBatchXML>\n`;

  return { xml, totalActivityCount, totalAccountCount, totalPartyCount };
}

// ---------------------------------------------------------------------------
// Validation — check the generated XML before writing
// ---------------------------------------------------------------------------
function validateXml(xml, stats) {
  const errors = [];
  const warnings = [];

  // 1. Check root element
  if (!xml.includes("<fc2:EFilingBatchXML")) errors.push("Missing root element");
  if (!xml.includes("<fc2:FormTypeCode>FBARX</fc2:FormTypeCode>")) errors.push("Missing/wrong FormTypeCode");

  // 2. Check Activity count
  const activityMatches = xml.match(/<fc2:Activity SeqNum=/g);
  if (!activityMatches || activityMatches.length !== stats.totalActivityCount) {
    errors.push(`ActivityCount mismatch: header=${stats.totalActivityCount}, actual=${activityMatches?.length}`);
  }

  // 3. Check required party types per activity
  const type35Count = (xml.match(/<fc2:ActivityPartyTypeCode>35<\/fc2:ActivityPartyTypeCode>/g) || []).length;
  const type37Count = (xml.match(/<fc2:ActivityPartyTypeCode>37<\/fc2:ActivityPartyTypeCode>/g) || []).length;
  const type15Count = (xml.match(/<fc2:ActivityPartyTypeCode>15<\/fc2:ActivityPartyTypeCode>/g) || []).length;
  const type41Count = (xml.match(/<fc2:ActivityPartyTypeCode>41<\/fc2:ActivityPartyTypeCode>/g) || []).length;

  if (type35Count !== stats.totalActivityCount) errors.push(`Transmitter (35) count: ${type35Count}, expected: ${stats.totalActivityCount}`);
  if (type37Count !== stats.totalActivityCount) errors.push(`Contact (37) count: ${type37Count}, expected: ${stats.totalActivityCount}`);
  if (type15Count !== stats.totalActivityCount) errors.push(`Filer (15) count: ${type15Count}, expected: ${stats.totalActivityCount}`);
  if (type41Count !== stats.totalAccountCount) errors.push(`FI (41) count: ${type41Count}, expected: ${stats.totalAccountCount}`);

  // 4. Check SeqNum uniqueness
  const seqNums = [];
  const seqPattern = /SeqNum="(\d+)"/g;
  let match;
  while ((match = seqPattern.exec(xml)) !== null) {
    seqNums.push(match[1]);
  }
  const seqSet = new Set(seqNums);
  if (seqSet.size !== seqNums.length) {
    const dupes = seqNums.filter((n, i) => seqNums.indexOf(n) !== i);
    errors.push(`Duplicate SeqNums: ${[...new Set(dupes)].join(", ")}`);
  }

  // 5. Check date formats (YYYYMMDD)
  const dates = xml.match(/<fc2:ApprovalOfficialSignatureDateText>([^<]+)<\/fc2:ApprovalOfficialSignatureDateText>/g) || [];
  for (const d of dates) {
    const val = d.replace(/<[^>]+>/g, "");
    if (val && !/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(val)) {
      errors.push(`Invalid date: ${val}`);
    }
  }
  const birthDates = xml.match(/<fc2:IndividualBirthDateText>([^<]+)<\/fc2:IndividualBirthDateText>/g) || [];
  for (const d of birthDates) {
    const val = d.replace(/<[^>]+>/g, "");
    if (val && !/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(val)) {
      errors.push(`Invalid birth date: ${val}`);
    }
  }

  // 6. Verify NO RawPartyLegalName exists (the bug we're fixing!)
  if (xml.includes("RawPartyLegalName")) {
    errors.push("CRITICAL: Found RawPartyLegalName — must use RawPartyFullName for entity names");
  }

  // 7. Verify RawPartyFullName IS used for entities
  if (!xml.includes("RawPartyFullName")) {
    errors.push("Missing RawPartyFullName — entity names not properly set");
  }

  // 8. Verify EFilingPriorDocumentNumber is NOT present (we omit it for non-amendments)
  if (xml.includes("EFilingPriorDocumentNumber")) {
    errors.push("EFilingPriorDocumentNumber should be omitted for non-amendment filings");
  }

  // 9. Check account amounts are non-negative integers (when present)
  const amounts = xml.match(/<fc2:AccountMaximumValueAmountText>([^<]+)<\/fc2:AccountMaximumValueAmountText>/g) || [];
  for (const a of amounts) {
    const val = a.replace(/<[^>]+>/g, "");
    if (!/^\d+$/.test(val)) {
      errors.push(`Invalid amount: ${val}`);
    }
    if (val === "0") {
      errors.push(`Amount is 0 — if unknown, use UnknownMaximumValueIndicator and omit amount`);
    }
  }

  // 14. Verify PartyIdentificationTypeCode per party type (FinCEN User Guide v1.4 p.29)
  // Type 35 (Transmitter): code 4 (TIN) + 28 (TCC) only
  // Type 56 (Preparer Firm): code 2 (EIN) or 9 (Foreign TIN) only
  // Type 15 (Filer): code 1/2/6/9/999
  // Type 57 (Preparer): code 1/9/31
  {
    const type35Section = xml.slice(
      xml.indexOf("<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>") || 0,
      xml.indexOf("<fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>") || xml.length
    );
    if (type35Section.includes("<fc2:PartyIdentificationTypeCode>2</fc2:PartyIdentificationTypeCode>")) {
      errors.push("Transmitter (type 35) uses type code 2 — must be 4 (A23 rejection)");
    }
    const type56Section = xml.slice(
      xml.indexOf("<fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>") || 0,
      xml.indexOf("<fc2:Account ") || xml.length
    );
    if (type56Section.includes("<fc2:PartyIdentificationTypeCode>4</fc2:PartyIdentificationTypeCode>")) {
      errors.push("Preparer Firm (type 56) uses type code 4 — must be 2 (J38 rejection)");
    }
  }

  // 15. Verify PreparerFilingSignatureIndicator is NOT present with ThirdPartyPreparerIndicator
  if (xml.includes("PreparerFilingSignatureIndicator") && xml.includes("ThirdPartyPreparerIndicator")) {
    errors.push("PreparerFilingSignatureIndicator conflicts with ThirdPartyPreparerIndicator");
  }

  // 16. Verify AccountTypeCode=999 has OtherAccountTypeText
  const type999Accounts = xml.match(/<fc2:AccountTypeCode>999<\/fc2:AccountTypeCode>/g) || [];
  const otherTextCount = (xml.match(/<fc2:OtherAccountTypeText>/g) || []).length;
  if (type999Accounts.length !== otherTextCount) {
    errors.push(`AccountTypeCode=999 count (${type999Accounts.length}) != OtherAccountTypeText count (${otherTextCount})`);
  }

  // 10. Check TCC is TBSATEST
  if (!xml.includes(">TBSATEST<")) {
    errors.push("TCC is not TBSATEST — required for sandbox testing");
  }

  // 11. Check no leading/trailing whitespace in values (v1.2 requirement)
  const valuePattern = />(\s+\S|\S+\s+)</g;
  let wsMatch;
  while ((wsMatch = valuePattern.exec(xml)) !== null) {
    const val = wsMatch[1];
    if (val.startsWith(" ") || val.startsWith("\t") || val.endsWith(" ") || val.endsWith("\t")) {
      warnings.push(`Possible leading/trailing whitespace in value near position ${wsMatch.index}`);
    }
  }

  // 12. Check calendar year
  if (!xml.includes("<fc2:ReportCalendarYearText>2025</fc2:ReportCalendarYearText>")) {
    errors.push("Missing or incorrect ReportCalendarYearText");
  }

  // 13. Verify minimum 25 activities for test batch
  if (stats.totalActivityCount < 25) {
    warnings.push(`Only ${stats.totalActivityCount} activities — FinCEN recommends at least 25 for testing`);
  }

  return { errors, warnings, seqNumCount: seqNums.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log("=== FinCEN FBAR Test Batch XML Generator ===\n");
console.log(`Date: ${TODAY}`);
console.log(`TCC: TBSATEST (sandbox test)`);
console.log(`Calendar Year: 2025`);
console.log(`Filers: ${FILERS.length}\n`);

const { xml, totalActivityCount, totalAccountCount, totalPartyCount } = buildBatch();
const validation = validateXml(xml, { totalActivityCount, totalAccountCount, totalPartyCount });

console.log("--- Batch Statistics ---");
console.log(`Activities: ${totalActivityCount}`);
console.log(`Accounts:   ${totalAccountCount}`);
console.log(`FI Parties: ${totalPartyCount}`);
console.log(`SeqNums:    ${validation.seqNumCount} (all unique: ${validation.errors.filter((e) => e.includes("SeqNum")).length === 0 ? "YES" : "NO"})`);
console.log(`XML size:   ${(xml.length / 1024).toFixed(1)} KB\n`);

if (validation.errors.length > 0) {
  console.error("!!! VALIDATION ERRORS !!!");
  for (const e of validation.errors) console.error(`  ERROR: ${e}`);
  process.exit(1);
}

if (validation.warnings.length > 0) {
  console.warn("--- Warnings ---");
  for (const w of validation.warnings) console.warn(`  WARN: ${w}`);
}

console.log("\n--- Validation: ALL CHECKS PASSED ---\n");

// Write XML file
const outputPath = join(__dirname, "..", "test-fbar-batch-2025.xml");
writeFileSync(outputPath, xml, "utf-8");
console.log(`XML written to: ${outputPath}`);
console.log(`\nNext steps:`);
console.log(`1. Download the FBAR Batch PDF from the BSA E-Filing sandbox`);
console.log(`2. Open the Batch PDF in Adobe Reader`);
console.log(`3. Attach this XML file to the Batch PDF`);
console.log(`4. Sign with PIN: 92922117`);
console.log(`5. Upload the signed PDF on the File Now page`);
console.log(`6. Enter PIN again and submit`);
