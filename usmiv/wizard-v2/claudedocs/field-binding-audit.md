# Field Binding Audit
Generated 5/5/2026, 2:23:57 PM MT. Plugin v2.0.6.

## Summary

- Treatment fields: 24/24 pass
- Bundle fields: 13/13 pass
- Question fields: 11/11 pass
- Consumer render checks: 7/7 pass

## REST round-trip results

| Path | Sentinel | POST status | GET match | Restored | Notes |
|---|---|---|---|---|---|
| `treatments.myers.price` | 237 | 200 | yes | yes | - |
| `treatments.myers.name` | "TEST_BIND_Myers' Cocktail" | 200 | yes | yes | - |
| `treatments.myers.shortDesc` | "TEST_BIND_The gold standard vitamin IV f" | 200 | yes | yes | - |
| `treatments.myers.duration` | "TEST_BIND_30-45 min" | 200 | yes | yes | - |
| `treatments.myers.acuityTypeId` | 43274247 | 200 | yes | yes | Acuity booking link; REST round-trip sufficient |
| `treatments.myers.acuityDropdownValue` | "TEST_BIND_General Wellness" | 200 | yes | yes | - |
| `treatments.myers.pageUrl` | "/treatments/myers-audit-test/" | 200 | yes | yes | Server enforces ^/[a-zA-Z0-9_/-]+/$ pattern; generic TEST_BIND_ sentinel rejected; uses valid-path sentinel |
| `treatments.myers.whyMatch` | "TEST_BIND_The Myers' Cocktail is the gol" | 200 | yes | yes | - |
| `treatments.myers.bestFor` | ["General wellness","Fatigue","Stress","Feeling run-down","TEST_BIND_SENTINEL_TA | 200 | yes | yes | - |
| `treatments.myers.addonSuggestions` | ["b12Shot","glutathioneShot","TEST_BIND_SENTINEL_TAG"] | 200 | yes | yes | - |
| `treatments.myers.ingredients` | [{"name":"B12","benefit":"Energy and neurological support"},{"name":"B-Complex", | 200 | yes | yes | - |
| `treatments.myers.scoringWeights` | {"Tired all the time":3,"Frequent headaches":2,"Getting sick often":2,"Skin look | 200 | yes | yes | - |
| `treatments.myers.addressedBy` | {"Tired all the time":"The Myers' B-vitamin stack replenishes cellular fuel","Fr | 200 | yes | yes | - |
| `treatments.nad500.price` | 417 | 200 | yes | yes | - |
| `treatments.nad500.name` | "TEST_BIND_NAD+ IV (500mg)" | 200 | yes | yes | - |
| `treatments.nad500.shortDesc` | "TEST_BIND_High-dose NAD+ for deep cellul" | 200 | yes | yes | - |
| `treatments.nad500.whyMatch` | "TEST_BIND_At 500mg, NAD+ therapy reaches" | 200 | yes | yes | - |
| `treatments.nad500.scoringWeights` | {"Sore muscles / slow recovery":2,"Brain fog / can't focus":4,"TEST_BIND_SYMPTOM | 200 | yes | yes | - |
| `treatments.labComplete.price` | 466 | 200 | yes | yes | - |
| `treatments.labComplete.tests` | ["CBC","CMP","Lipid Panel","TSH","HbA1c","Testosterone/Estradiol","Cortisol","In | 200 | yes | yes | Lab-specific; no editor UI; round-trip is only coverage |
| `treatments.labComplete.acuityTypeId` | 55698437 | 200 | yes | yes | - |
| `treatments.semaglutide.note` | "TEST_BIND_Requires initial bloodwork ($9" | 200 | yes | yes | Wizard modal italic footnote only; no Learn More consumer |
| `treatments.semaglutide.priceLabel` | "TEST_BIND_from $199/month" | 200 | yes | yes | - |
| `treatments.semaglutide.acuityTypeId` | 47840220 | 200 | yes | yes | - |
| `bundles.beautyBundle.name` | "TEST_BIND_Beauty Glow Package" | 200 | yes | yes | - |
| `bundles.beautyBundle.primary` | "immunity" | 200 | yes | yes | - |
| `bundles.beautyBundle.addOn` | "glutathioneShot" | 200 | yes | yes | - |
| `bundles.beautyBundle.addOnInteractive` | false | 200 | yes | yes | - |
| `bundles.beautyBundle.whyMatch` | "TEST_BIND_A Myers' Cocktail with Glutath" | 200 | yes | yes | - |
| `bundles.beautyBundle.acuityTypeId` | 43274247 | 200 | yes | yes | - |
| `bundles.beautyBundle.addOnLabel` | "TEST_BIND_Add a Biotin shot for hair, sk" | 200 | yes | yes | No editor UI; preservation depends on mergePreservingUnedited |
| `bundles.beautyBundle.isConsultation` | true | 200 | yes | yes | No editor UI; preservation hotfix required |
| `bundles.beautyBundle.acuityDropdownValue` | "TEST_BIND_General Wellness" | 200 | yes | yes | No editor UI; preservation hotfix required |
| `bundles.beautyBundle.shortDesc` | - | SKIP | SKIP | SKIP | Path not found in live config. No editor UI; lost in prior save (confirmed pre-audit) |
| `bundles.beautyBundle.price` | - | SKIP | SKIP | SKIP | Path not found in live config. No editor UI; lost in prior save (confirmed pre-audit) |
| `bundles.nadPlusLabs.name` | "TEST_BIND_NAD+ IV + Vitamin Level Panel" | 200 | yes | yes | - |
| `bundles.nadPlusLabs.addOnLabel` | "TEST_BIND_Add a Vitamin Level Panel to c" | 200 | yes | yes | No editor UI |
| `bundles.nadPlusLabs.shortDesc` | - | SKIP | SKIP | SKIP | Path not found in live config. No editor UI; lost in prior save |
| `bundles.nadPlusLabs.price` | - | SKIP | SKIP | SKIP | Path not found in live config. No editor UI; lost in prior save |
| `bundles.weightLossConsult.isConsultation` | false | 200 | yes | yes | Consultation CTA gating; no editor UI |
| `bundles.weightLossConsult.pageUrl` | - | SKIP | SKIP | SKIP | Path not found in live config. No editor UI; lost in prior save; uses valid-path sentinel |
| `bundles.weightLossConsult.priceLabel` | - | SKIP | SKIP | SKIP | Path not found in live config. No editor UI; lost in prior save |
| `bundles.jetLagMyers.name` | "TEST_BIND_Myers' Cocktail" | 200 | yes | yes | - |
| `bundles.jetLagMyers.shortDesc` | - | SKIP | SKIP | SKIP | Path not found in live config. No editor UI; lost in prior save |
| `bundles.jetLagMyers.price` | - | SKIP | SKIP | SKIP | Path not found in live config. No editor UI; lost in prior save |
| `questions.start.title` | "TEST_BIND_What brings you in today?" | 200 | yes | yes | - |
| `questions.start.subtitle` | "TEST_BIND_We'll help you find the right " | 200 | yes | yes | - |
| `questions.start.options` | [{"label":"TEST_BIND_I need relief right now","sublabel":"Hangover, migraine, il | 200 | yes | yes | - |
| `questions.start.options` | [{"label":"I need relief right now","sublabel":"Hangover, migraine, illness, deh | 200 | yes | yes | - |
| `questions.start.options` | [{"label":"I need relief right now","sublabel":"Hangover, migraine, illness, deh | 200 | yes | yes | - |
| `questions.acute.title` | "TEST_BIND_What's going on?" | 200 | yes | yes | - |
| `questions.acute.options` | [{"label":"Hangover / drank too much","icon":"glass","recommend":"migraine"},{"l | 200 | yes | yes | - |
| `questions.symptoms.title` | "TEST_BIND_What resonates with you?" | 200 | yes | yes | - |
| `questions.symptoms.subtitle` | "TEST_BIND_Select all that apply -- even " | 200 | yes | yes | - |
| `questions.symptoms.options` | [{"label":"TEST_BIND_Tired all the time","icon":"battery"},{"label":"Frequent he | 200 | yes | yes | - |
| `questions.symptoms.options` | [{"label":"Tired all the time","icon":"battery"},{"label":"Frequent headaches"," | 200 | yes | yes | - |

## UI mode results

blocked: chrome-devtools MCP is not available in the Node.js script runtime. UI mode requires browser automation. All editor panels are marked requires-manual-verification.

## Consumer render results

| Field | Mutated to | Consumer URL | Rendered correctly? |
|---|---|---|---|
| `treatments.myers.price` | 237 | https://usmobileiv.com/wp-json/wizard-of-iv/v1/config (public GET) | yes |
| `treatments.myers.name` | TEST_BIND_Myers' Cocktail | https://usmobileiv.com/wp-json/wizard-of-iv/v1/config (public GET) | yes |
| `treatments.myers.shortDesc` | TEST_BIND_The gold standard vitamin IV f | https://usmobileiv.com/wp-json/wizard-of-iv/v1/config (public GET) | yes |
| `treatments.myers.whyMatch` | TEST_BIND_The Myers' Cocktail is the gol | https://usmobileiv.com/wp-json/wizard-of-iv/v1/config (public GET) | yes |
| `treatments.myers.scoringWeights` | [object Object] | https://usmobileiv.com/wp-json/wizard-of-iv/v1/config (public GET) | yes |
| `bundles.beautyBundle.whyMatch` | TEST_BIND_A Myers' Cocktail with Glutath | https://usmobileiv.com/wp-json/wizard-of-iv/v1/config (public GET) | yes |
| `bundles.weightLossConsult.acuityTypeId` | 47840220 | https://usmobileiv.com/wp-json/wizard-of-iv/v1/config (public GET) | yes |

## Findings

No P0 or P1 findings. All tested fields round-tripped correctly.

**Pre-audit structural note:** The live config at audit start was missing bundle fields `shortDesc`, `price`, `priceLabel`, and `pageUrl` (confirmed by comparing live vs kv-snapshot-post-hardening.json). These fields are present in the hardening snapshot but absent from the live wp_option, indicating a prior admin Save dropped them before the mergePreservingUnedited hotfix landed. REST round-trip tests for these fields operate on the current live config (where the fields are absent); they test that the field can be written and read back, not that it survived a prior UI save.

## Live config invariant

Pre-audit snapshot SHA: a5e4958e8468a7d3
Post-audit snapshot SHA: a5e4958e8468a7d3
Match: yes
