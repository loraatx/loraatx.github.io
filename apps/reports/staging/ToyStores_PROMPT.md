# City Anatomy — Toy Stores Report Prompt

Ready to run. Copy the prompt block into Perplexity (use Research or Pro mode).
Save the full output as `report.md` in this staging folder.

---

## How to use

1. Run the prompt below in Perplexity. No editing needed — the topic is already filled in.
2. Copy the **entire output** (front-matter block through the CSV rows) into a file named `report.md` and save it here.
3. Copy just the CSV rows (after `---CSV---`, including the header) into a file named `data.csv`.
4. Drop your three images into this folder:
   - `image1.png` — a fun, colorful photo representing toy stores or toys generally
   - `image2.png` — a photo of the 1st featured location (storefront or interior)
   - `image3.png` — a photo of the 2nd featured location (storefront or interior)
5. Tell Claude: **"Build the new Product Report from staging."**

---

## The Prompt (copy everything between the triple-dashes)

---
Write a 4–6 page research report on **independent and specialty toy stores** in **Austin, TX** for a local data journalism product called City Anatomy. Cover independent shops, educational toy retailers, and any notable chain toy stores with a strong local presence. Include stores that have closed if they are historically significant to Austin's toy retail scene, and note their status clearly. Use inline footnote citations [n] throughout the body and a numbered References section at the end.

Structure your output **exactly** as follows. Use these exact headings and the front-matter block — do not change the format.

```
---
title: Toy Stores & Children's Specialty Retailers in Greater Austin
subtitle: Independent shops, educational toy specialists, and family-favorite destinations
category: Shopping
accent: #d4380d
slug: austin-toy-stores
featured_location_1: [Exact name of the most well-known or beloved independent toy store you find]
featured_location_2: [Exact name of a second notable independent or specialty toy store]
stats:
  - value: "[total number of stores profiled]"
    label: "Stores Profiled"
  - value: "[number that are independent/locally owned]"
    label: "Locally Owned"
  - value: "[oldest founding year among the stores]"
    label: "Oldest Shop Est."
  - value: "[most common age range served, e.g. 'All Ages' or '0–12']"
    label: "Ages Served"
---
```

## Executive Summary
[2–3 paragraphs: what makes Austin's toy store scene distinctive, the mix of independent vs. chain options, the role of educational and STEM-focused toy shops in a tech-heavy city, and what this report covers. Use footnote citations [n].]

## Austin's Toy Stores

[For each store, use a ### subheading with the exact store name, followed by 2–3 paragraphs covering: address and neighborhood, type of store (independent/educational/chain), target age ranges, standout products or brands carried, price range, whether they offer gift wrapping or wish lists, notable community involvement or events, and current operating status. Note any stores that have closed and explain their significance.]

[Use ### [Exact Store Name] format for every location entry. Cover at least 8–12 stores.]

## Specialty Focus & Age Range Guide

[A Markdown comparison table with columns: Store Name | Type | Best For (age range) | Price Range | Specialty (e.g. STEM/outdoor/classic/collectible) | In-Store Events. Follow with a few paragraphs discussing how to match a store to a child's interests and age, the STEM/educational toy trend in Austin given its tech industry, and the role of toy stores as community gathering spaces.]

## Planning Considerations
- Independent toy stores in Austin often carry unique brands not found at big-box retailers — visit in person rather than searching online for the best selection.
- Many Austin toy stores offer gift-wrapping, wish lists, and registry services that make them especially useful for birthday and holiday shopping.
- STEM and educational toy shops are particularly plentiful in Austin given the city's tech workforce — look for stores near the Domain and North Austin tech corridors.
- Holiday season (October–December) can see limited stock of popular items; call ahead or visit early in the season for the widest selection.
- Several beloved Austin toy stores have closed in recent years — the report notes historical shops so you understand the current landscape in context.

## References
1. [Title](URL) — brief excerpt or description
2. ...
[Continue numbered list through all citations used inline above]

---CSV---
name,address,city,state,zip,latitude,longitude,type,age_range,specialty,website,notes
"[Store Name]","[Street Address]","Austin","TX","[ZIP]",[LAT],[LNG],"[independent|educational|chain|collectible|closed]","[e.g. All Ages | 0-8 | 6-14]","[e.g. STEM | classic | outdoor | collectible | general]","[https://...]","[one sentence]"
[one row per store — include open and closed stores, mark closed ones with type "closed"]
---

**Column notes for this report:**
- `type` — use one of: `independent`, `educational`, `chain`, `collectible`, `closed`
- `age_range` — the primary age range the store serves (e.g. `All Ages`, `0–8`, `6–14`, `Teens & Adults`)
- `specialty` — the store's primary focus: `STEM`, `classic`, `outdoor`, `collectible`, `general`, `arts & crafts`
- Every store mentioned with a ### heading must have a CSV row, including closed ones
- Include lat/lng for every row — geocode from the street address, 6 decimal places

---

## After you run the prompt

Check that the output contains:
- [ ] Front-matter block with all fields filled in (not placeholders)
- [ ] `featured_location_1` and `featured_location_2` are real store names matching `### Name` headings
- [ ] `stats:` has 4 entries with real values
- [ ] Numbered `[n]` citations throughout the body
- [ ] A `## References` section with numbered links
- [ ] A `---CSV---` separator followed by CSV rows
- [ ] `type`, `age_range`, and `specialty` columns present in every CSV row
- [ ] Every `### Name` heading has a matching CSV row

If any of these are missing, re-prompt Perplexity asking it to add the missing piece.
