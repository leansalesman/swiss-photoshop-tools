# Marketplace kit (drafts)

Everything needed for the Adobe Marketplace listings that can be prepared ahead of time. These are drafts: review them, fill in the placeholders, and check the policy pages with someone qualified before publishing. They aren't legal advice.

| Path | What it is |
|---|---|
| `listings.md` | Paste-ready listing text for SwissGrid and SwissType (name, subtitle, description, tags, release notes, screenshot plan) and the publisher profile. |
| `icons/` | Listing icons at 48, 96 and 192 px for both plugins, plus the `.svg` masters to edit. |
| `site/` | A small public website: `index.html` (help for both plugins), `privacy.html`, `terms.html`. The listings link to these. |

The same icon artwork is also inside each plugin (`*-UXP/icons/`: panel 23/46 px, plugin list 24/48 px) and referenced from each `manifest.json`.

## Placeholders to fill in

They're shown as `[brackets]`, highlighted in yellow on the web pages.

- `[publisher name]`: your name or brand, the same as on your Adobe publisher profile
- `[support email]`
- `[date]`: the effective date of the privacy policy and terms
- `[year]`: the footer copyright
- `[state / country]`: the governing law in the terms
- `[a few business days]`: how fast you'll answer support emails
- `[SwissGrid Marketplace link]`, `[SwissType Marketplace link]`: these exist after the listings are approved
- `[site]`: the web address where you publish `site/`, used in `listings.md`

## Publishing the website

The GitHub repo is private, so the site needs a public home of its own. Any static host works, because it's plain HTML and CSS. For example:

- **GitHub Pages:** create a new **public** repository (for example `swiss-tools-site`), upload the contents of `site/`, then go to Settings > Pages > Deploy from branch `main`. The address will look like `https://leansalesman.github.io/swiss-tools-site/`.
- **Netlify Drop:** drag the `site/` folder onto app.netlify.com/drop.

Don't turn on GitHub Pages for `swiss-photoshop-tools` itself. That would publish the plugin source code.

## Still needed

- **Screenshots** at 1360 × 800 px, taken in real Photoshop. `listings.md` lists which shots to take.
- **Plugin IDs:** the Adobe-assigned IDs go in each `manifest.json`, then the `.ccx` packages get rebuilt.
