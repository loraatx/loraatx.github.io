# City Anatomy — Perplexity Report Prompt Template

Copy the block below into Perplexity. Fill in the bracketed parts before running.
Save the full output as `report.md` in this staging folder.

---

## How to use

1. Fill in `[TOPIC]`, `[CITY]`, the two featured locations, and the attribute column names.
2. Run the prompt in Perplexity (use the "Research" or "Pro" mode for best sourcing).
3. Copy the **entire output** (front-matter block through the CSV rows) into a file named `report.md` and save it here.
4. Export or manually copy the CSV rows into a file named `data.csv` (just the rows after `---CSV---`, with the header row).
5. Drop your three images into this folder:
   - `image1.png` — a photo representing the topic (e.g. a bike, a pool, a golf hole)
   - `image2.png` — a photo of the 1st featured location
   - `image3.png` — a photo of the 2nd featured location
6. Tell Claude: **"Build the new Product Report from staging."**

---

## The Prompt (copy everything between the triple-dashes)

---
Write a 4–6 page research report on **[TOPIC]** in **[CITY, TX]** for a local data
journalism product called City Anatomy. Use inline footnote citations [n] throughout
the body and a numbered References section at the end.

Structure your output **exactly** as follows. Use these exact headings and the
front-matter block — do not change the format.

\```
---
title: [Full descriptive report title, e.g. "Vintage Guitar Shops in Greater Austin"]
subtitle: [One-line description, e.g. "Independent dealers, consignment, and repair specialists"]
category: [Shopping | Recreation | City Gov]
accent: #[A hex color that fits the topic — earthy for outdoors, bold for retail, etc.]
slug: austin-[kebab-case-topic, e.g. "austin-vintage-guitar"]
featured_location_1: [Exact name of the 1st highlighted location — will get a photo]
featured_location_2: [Exact name of the 2nd highlighted location — will get a photo]
stats:
  - value: "[e.g. 12]"
    label: "[e.g. Locations Profiled]"
  - value: "[e.g. 4]"
    label: "[e.g. Categories]"
  - value: "[e.g. Since 1987]"
    label: "[e.g. Oldest Shop]"
  - value: "[e.g. $50–$5,000]"
    label: "[e.g. Typical Price Range]"
---
\```

## Executive Summary
[2–3 paragraphs: what this topic is, why it matters in [CITY], what the report covers,
and what makes [CITY]'s scene distinctive. Use footnote citations [n].]

## [Thematic Section Title — e.g. "The Locations" or "Market Overview"]
[Narrative paragraphs about the topic landscape. For each individual location, use
a ### subheading with the exact location name, followed by 1–3 paragraphs of detail:
address, what makes it notable, offerings, pricing if available, hours, etc.]

[Use ### [Exact Name] format for every individual location entry.]

## [Second Thematic Section — e.g. "Pricing & Inventory" or "Planning Your Visit"]
[Comparison tables, pricing breakdowns, or contextual information. Use Markdown
table syntax for any structured data.]

## Planning Considerations
- [Practical bullet 1 for someone using this report]
- [Practical bullet 2]
- [Practical bullet 3]
- [Practical bullet 4]
- [Practical bullet 5]

## References
1. [Title](URL) — brief excerpt or description
2. ...
[Continue numbered list through all citations used inline above]

---CSV---
name,address,city,state,zip,latitude,longitude,type,[ATTR1],[ATTR2],website,notes
"[Location Name]","[Street Address]","[CITY]","TX","[ZIP]",[LAT],[LNG],"[Type]","[attr1 value]","[attr2 value]","[https://...]","[short note]"
[one row per location, including all locations mentioned in the report]
---

**Column naming rules for the CSV:**
- `name` — display name (matches ### headings exactly)
- `address` — street address only (no city/state)
- `latitude`, `longitude` — decimal degrees, 6 decimal places
- `type` — categorical (2–8 distinct values), used as a map filter
- `[ATTR1]`, `[ATTR2]` — 1–2 additional categorical or short-text attributes
  relevant to this topic (e.g. `sells_ebikes`, `has_fitting`, `admission_fee`,
  `par`, `capacity`). Use snake_case column names.
- `website` — full https:// URL
- `notes` — one sentence of context

**Required:** Every location mentioned with a ### heading must have a CSV row.
Include lat/lng for every row — geocode from the address.

---

## After you run the prompt

Check that the output contains:
- [ ] Front-matter block (between `---` fences) with all 7+ fields
- [ ] `featured_location_1` and `featured_location_2` match two `### Name` headings
- [ ] `stats:` block has 3–4 entries
- [ ] Numbered `[n]` citations throughout the body
- [ ] A `## References` section with numbered links
- [ ] A `---CSV---` separator followed by CSV rows
- [ ] Every `### Name` location has a matching CSV row

If any of these are missing, re-prompt Perplexity asking it to add the missing piece.
