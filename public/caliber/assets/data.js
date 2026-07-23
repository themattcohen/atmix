/*
 * CALIBER: in-memory data (no storage, no fetch). Global namespace.
 *
 * Every value in this object is prototype placeholder data: product names, prices, purities,
 * batch numbers, unit counts, test dates, laboratory names, certificate records, testimonials,
 * and statistics. None of it has been verified against a real laboratory result. It must be
 * replaced with real records before the site is published.
 */
window.CALIBER = {
  brand: { name: "CALIBER", tagline: "Verified to the lot." },

  /* Catalogue. Compounds shown by technical designation + SKU code (research nomenclature). */
  products: [
    { sku:"CAL-PB15", name:"Pentadecapeptide BPC-157", size:"10 mg", price:175, purity:99.3, batch:"014", units:40, lot:"GLD-BLK-014", cat:"Repair", lab:"ACS Peptide Labs", tested:"2026-07-09", blurb:"Body-protection compound, fifteen-amino-acid sequence. Supplied lyophilized." },
    { sku:"CAL-CG50", name:"Copper Peptide GHK-Cu", size:"50 mg", price:99, purity:99.1, batch:"022", units:60, lot:"BLU-GLD-022", cat:"Copper", lab:"ILS Laboratories", tested:"2026-07-11", blurb:"Glycyl-histidyl-lysine copper complex. Supplied lyophilized." },
    { sku:"CAL-TB10", name:"Thymosin β-4 Fragment (TB-500)", size:"10 mg", price:175, purity:98.9, batch:"009", units:30, lot:"GRN-BLK-009", cat:"Repair", lab:"ACS Peptide Labs", tested:"2026-07-08", blurb:"Actin-binding peptide fragment. Supplied lyophilized." },
    { sku:"CAL-SX10", name:"Semax (ACTH 4-10 analog)", size:"10 mg", price:125, purity:99.0, batch:"017", units:40, lot:"WHT-GLD-017", cat:"Neuro", lab:"Kovera Labs", tested:"2026-07-10", blurb:"Heptapeptide analog of corticotropin fragment. Supplied lyophilized." },
    { sku:"CAL-TA10", name:"Tri-Agonist LY3437943", size:"10 mg", price:149, purity:99.4, batch:"031", units:25, lot:"GLD-RED-031", cat:"Metabolic", lab:"ILS Laboratories", tested:"2026-07-12", blurb:"GIP / GLP-1 / glucagon triple receptor agonist. Supplied lyophilized." },
    { sku:"CAL-GB10", name:"GHRH / GHRP Blend (CJC-1295 + Ipamorelin)", size:"10 mg", price:175, purity:98.7, batch:"012", units:30, lot:"BLK-GLD-012", cat:"Secretagogue", lab:"ACS Peptide Labs", tested:"2026-07-07", blurb:"Growth-hormone secretagogue blend, 5 mg / 5 mg. Component split reported." },
    { sku:"CAL-GR05", name:"GRF Analog TH9507 (Tesamorelin)", size:"5 mg", price:150, purity:98.8, batch:"005", units:20, lot:"SLV-BLK-005", cat:"Secretagogue", lab:"Kovera Labs", tested:"2026-07-06", blurb:"Stabilized growth-hormone-releasing factor analog. Supplied lyophilized." },
    { sku:"CAL-EL10", name:"Mitochondrial Peptide SS-31", size:"10 mg", price:99, purity:97.9, batch:"003", units:20, lot:"RED-BLK-003", cat:"Mitochondrial", lab:"ILS Laboratories", tested:"2026-07-05", blurb:"Cardiolipin-associated tetrapeptide. Supplied lyophilized." },
    { sku:"CAL-DA30", name:"Dual Agonist LY3298176", size:"30 mg", price:299, purity:99.5, batch:"028", units:10, lot:"GLD-GRN-028", cat:"Metabolic", lab:"ILS Laboratories", tested:"2026-07-12", blurb:"GIP / GLP-1 dual receptor agonist. Limited synthesis run. Supplied lyophilized." },
    { sku:"CAL-ND1000", name:"NAD+ (β-Nicotinamide Adenine Dinucleotide)", size:"1000 mg", price:275, purity:99.2, batch:"019", units:10, lot:"WHT-BLK-019", cat:"Coenzyme", lab:"Kovera Labs", tested:"2026-07-11", blurb:"Oxidized dinucleotide coenzyme. Limited run. Supplied lyophilized." }
  ],

  /* COA lookup records, keyed by lot. */
  coas: {
    "GLD-BLK-014":{ sku:"CAL-PB15", name:"Pentadecapeptide BPC-157", purity:99.3, identity:"Confirmed", mass:"1419.5 Da", method:"RP-HPLC / MS", lab:"ACS Peptide Labs", date:"2026-07-09", result:"PASS" },
    "BLU-GLD-022":{ sku:"CAL-CG50", name:"Copper Peptide GHK-Cu", purity:99.1, identity:"Confirmed", mass:"340.8 Da", method:"RP-HPLC / MS", lab:"ILS Laboratories", date:"2026-07-11", result:"PASS" },
    "GRN-BLK-009":{ sku:"CAL-TB10", name:"Thymosin β-4 Fragment (TB-500)", purity:98.9, identity:"Confirmed", mass:"4963.4 Da", method:"RP-HPLC / MS", lab:"ACS Peptide Labs", date:"2026-07-08", result:"PASS" },
    "WHT-GLD-017":{ sku:"CAL-SX10", name:"Semax (ACTH 4-10 analog)", purity:99.0, identity:"Confirmed", mass:"813.9 Da", method:"RP-HPLC / MS", lab:"Kovera Labs", date:"2026-07-10", result:"PASS" },
    "GLD-RED-031":{ sku:"CAL-TA10", name:"Tri-Agonist LY3437943", purity:99.4, identity:"Confirmed", mass:"4731.2 Da", method:"RP-HPLC / MS", lab:"ILS Laboratories", date:"2026-07-12", result:"PASS" },
    "BLK-GLD-012":{ sku:"CAL-GB10", name:"GHRH / GHRP Blend (CJC-1295 + Ipamorelin)", purity:98.7, identity:"Confirmed", mass:"CJC-1295 (no DAC): 3367.9 Da · Ipamorelin: 711.9 Da", method:"RP-HPLC / MS", lab:"ACS Peptide Labs", date:"2026-07-07", result:"PASS" },
    "SLV-BLK-005":{ sku:"CAL-GR05", name:"GRF Analog TH9507 (Tesamorelin)", purity:98.8, identity:"Confirmed", mass:"5135.9 Da", method:"RP-HPLC / MS", lab:"Kovera Labs", date:"2026-07-06", result:"PASS" },
    "RED-BLK-003":{ sku:"CAL-EL10", name:"Mitochondrial Peptide SS-31", purity:97.9, identity:"Confirmed", mass:"639.8 Da", method:"RP-HPLC / MS", lab:"ILS Laboratories", date:"2026-07-05", result:"PASS" },
    "GLD-GRN-028":{ sku:"CAL-DA30", name:"Dual Agonist LY3298176", purity:99.5, identity:"Confirmed", mass:"4813.5 Da", method:"RP-HPLC / MS", lab:"ILS Laboratories", date:"2026-07-12", result:"PASS" },
    "WHT-BLK-019":{ sku:"CAL-ND1000", name:"NAD+", purity:99.2, identity:"Confirmed", mass:"663.4 Da", method:"HPLC (260 nm)", lab:"Kovera Labs", date:"2026-07-11", result:"PASS" }
  },

  labs:[
    {name:"ACS Peptide Labs", note:"Identity, purity, contaminant panels"},
    {name:"ILS Laboratories", note:"ISO/IEC 17025, purity + mass + identity"},
    {name:"Kovera Labs", note:"LC-MS identity, endotoxin, sterility"}
  ],

  /* Compliant social proof: quality, trust, service. No health/efficacy claims. */
  reviews:[
    {stars:5, name:"Marcus T.", tag:"Verified buyer", text:"The lot number on the vial matched the COA on the site exactly. First time I have been able to check that. Same-day, in person, done right."},
    {stars:5, name:"Dana R.", tag:"Verified buyer", text:"What sold me was being able to look up the batch before I even reserved. Presentation is a step above anything else I have seen locally."},
    {stars:5, name:"Coach Ivan", tag:"Verified buyer", text:"I recommend it to my clients because I can point them at the actual test report. That is the whole difference."},
    {stars:5, name:"Priya S.", tag:"Verified buyer", text:"Clean packaging, published purity, and a real person behind it. Reserved a limited batch and it was ready the next day."},
    {stars:4, name:"Will B.", tag:"Verified buyer", text:"Pricing is premium, but you are paying for the testing and the local hand-off. Worth it for the peace of mind."},
    {stars:5, name:"Renata K.", tag:"Verified buyer", text:"The batch traceability is the selling point. Every vial ties back to a lab report you can actually read."}
  ],

  stats:{ batches_tested:"120+", avg_purity:"99.1%", labs:"3 independent", turnaround:"Same day, local" },

  faqs:[
    {q:"What does 'research use only' mean here?", a:"Everything CALIBER supplies is sold strictly for laboratory and research use. Products are not drugs, foods, or dietary supplements, are not for human or animal consumption, and are not intended to diagnose, treat, cure, or prevent anything. See the Disclaimer and Terms of Sale."},
    {q:"How is every batch tested?", a:"Each lot is sent to an independent third-party laboratory for identity and purity analysis before it is offered. The Certificate of Analysis is published and tied to the lot number printed on the vial. You can verify any lot on the batch lookup."},
    {q:"Why is availability limited?", a:"Batches are intentionally small. Each is a discrete synthesis run, tested as a unit, and offered until it is gone. When a batch closes it is not restocked; a new batch is tested and released in its place."},
    {q:"Why buy local?", a:"No multi-week wait, no customs exposure on your end, cold chain kept intact, and a real person accountable for what you receive. Hand-off is same day where available."},
    {q:"Do you provide any guidance on use?", a:"No. CALIBER does not provide, and will not provide, any instructions, protocols, or guidance regarding human or animal use, and sells no supplies intended to facilitate such use."},
    {q:"What if a lot ever fails testing?", a:"It is never offered. If an issue is ever identified with a lot you received, it is replaced. Our guarantee is about the material conforming to its published Certificate of Analysis."}
  ]
};
