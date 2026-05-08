# Staging — Product Reports

Drop files here to trigger a new report build. See `PROMPT.md` for the
Perplexity prompt to generate them.

## Files expected in this folder

| File | Source | Notes |
|------|--------|-------|
| `report.md` | Perplexity output | Full text with front-matter + body + `---CSV---` + CSV rows |
| `data.csv` | Extracted from `report.md` | Rows below `---CSV---`; header row included |
| `image1.png` | You provide | Topic hero photo (pool, golf hole, guitar, etc.) |
| `image2.png` | You provide | Photo of 1st featured location |
| `image3.png` | You provide | Photo of 2nd featured location |

## How to build

Once all 5 files are in this folder, tell Claude:

> **"Build the new Product Report from staging."**

Claude will create the full report at `apps/reports/{slug}/` and clear staging when done.

## Quick checklist before triggering a build

- [ ] `report.md` has front-matter block with `title`, `subtitle`, `category`, `accent`, `slug`, `featured_location_1`, `featured_location_2`, `stats`
- [ ] `report.md` has `---CSV---` separator and CSV rows at the end
- [ ] `data.csv` has `latitude` and `longitude` columns for every row
- [ ] `image1.png`, `image2.png`, `image3.png` are present
