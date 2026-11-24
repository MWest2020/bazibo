# Google Search Console for bazibo.nl: steps for Mark

Search Console shows how Google sees the site (which pages are indexed, what people searched
for, errors). It adds nothing to the site: no script, no cookie, nothing on visitors. The data
comes from Google's own search, so the privacy pages need no change.

Verification is by a **DNS record**, so nothing in `web/` changes. (The other methods, an HTML
file or a meta tag, would mean a pull request; the DNS record also covers http, https and www.)

## Steps (about 10 minutes, plus waiting for DNS)

1. Open https://search.google.com/search-console and sign in with the Google account of the
   Play Console (then the two can be linked later).
2. **Property toevoegen** (Add property) → choose **Domein** (Domain, the left box) → type
   `bazibo.nl` → **Doorgaan** (Continue). The labels below are the Dutch ones, English in brackets.
3. Google shows a TXT record like `google-site-verification=AbC123...`. Click **Kopiëren** (Copy).
   Leave this window open.
4. In a new tab: https://account.yourhosting.nl/ → **Domeinnamen** → `bazibo.nl` →
   **DNS beheer** → **Voeg record toe**. DNS is edited here, not in Plesk (homelab runbook
   `bazibo-nl.md`).
   - Type: `TXT`
   - Naam: leave empty (the domain itself, `bazibo.nl`)
   - Waarde: the copied `google-site-verification=...` text, without quotes
   - TTL: 3600
   - **Wijzigingen opslaan**.

   Add a **new** record. Do not edit the existing TXT record at `bazibo.nl`
   (`v=spf1 include:_spf.yourfilter.nl mx a ~all`): that one is the mail's SPF and must stay.
5. Check that it is there (from any terminal; it can take a few minutes up to an hour):

   ```
   dig +short TXT bazibo.nl @ns50.premiumdns-yourhosting.net
   ```

   Both lines should show: the `v=spf1 ...` one and the `google-site-verification=...` one.
6. Back in Search Console: **Verifiëren** (Verify). If it says not found, wait an hour and try again.
   Keep the TXT record for good: removing it ends the verification.
7. **Sitemaps** (left menu) → type `sitemap.xml` → **Indienen** (Submit). Status should become
   "Geslaagd" (Success) with 9 pages found.
8. **URL-inspectie** (search bar at the top) for each of these, then **Indexering aanvragen** (Request indexing):
   - `https://bazibo.nl/?lang=nl`
   - `https://bazibo.nl/nl/plannen/`
   - `https://bazibo.nl/?lang=en`
9. Optional, same data for Bing (and DuckDuckGo, which uses Bing): https://www.bing.com/webmasters
   → sign in → **Importeren uit Google Search Console**. No second DNS record needed.

## After a week or two

- **Prestaties**: which searches show bazibo.nl. Compare with the words in
  `docs/marketing/aso-proposal.md`; that is the cheapest feedback on the titles.
- **Pagina's**: every page in the sitemap should be "Geïndexeerd". The redirect pages
  (`/privacy/`, `/plannen/`, ...) show as "Uitgesloten door noindex", which is right.
- The GitHub Pages mirror (`mwest2020.github.io/bazibo/`) is not a property; its pages name
  bazibo.nl as canonical, so Google should fold them into bazibo.nl.

## Check the rich data (optional)

https://search.google.com/test/rich-results with `https://bazibo.nl/` shows the schema.org
`MobileApplication` block. Google shows a software-app rich result (stars, price) only when the
page also has ratings or reviews; we do not add those by hand (that would be made up). The block
still tells Google what Bazibo is, what it costs and where to get it.
