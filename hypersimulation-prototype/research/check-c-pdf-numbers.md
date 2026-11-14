# check-c-pdf-numbers (worker report, 2026-11-03)

Firecrawl credits ran out mid-run (resets 2026-11-04 03:48Z). Items 1, 2, 4 and 5 were read from the document text or page images. Items 3, 7 and 8 are NOT FOUND or only found second-hand.

1. Kim 2024 (IEEE EMBC) - CONFIRMED (one page, read as an image)
- Equation (2), the Pandolf form: M_P = 1.5*W + 2.0*(W+L)*(L/W)^2 + eta*(W+L)*(1.5*V^2 + 0.35*V*G). Units are watts.
- Equation (3): CF = eta*[(G*(W+L)*V)/3.5 - ((W+L)*(G+6)^2)/W) + (25-V^2)]. Equation (1): M_F = (M_P - CF)*DF. Equation (4): DF = (1/D)*e^(-(1/D)).
- Variables: W body weight kg, L external load kg, V speed m/s, G grade %, eta terrain coefficient, D delay.
- Table I regression of the proposed model against K5 measurements: intercept 201.80 (SE 16.00), slope x 0.95 (SE 0.01). The conventional model gave 234.82 and 0.50.
- Data: 4 subjects, JSC Rock Yard, Earth, up to 20 min, self-paced.
- Valid ranges: NOT FOUND (none stated). Mars gravity: NOT FOUND. The paper is Earth-only and lists lunar south pole sites as future work.
- Primary source: https://ntrs.nasa.gov/api/citations/20240001423/downloads/IEEE%20EMBC%202024.pdf

2. Kluis 2022 - NOT FOUND
- The file is a 1-page extended abstract. It gives no numbers on metabolic rate, speed, incline or gravity.
- It says the NASA Marquez model extrapolates Apollo data, assuming one constant walking velocity per terrain slope.
- It describes the Norcross MKIII tests (varying speed, pressure, incline, gravity) but quotes no values.
- It says the planned work is a body-weight-support rig study at a range of gravity levels.
- Source: https://bhp.engr.tamu.edu/wp-content/uploads/sites/212/2022/02/Kluis-et-al.-2022-A-METHODOLOGY-FOR-ANALYZING-AND-IMPROVING-EVA-PERFORMANCE.pdf

3. Apollo walkback memo - NOT FOUND (primary text unread)
- The nasa.gov URL returned 404 to WebFetch. The UNT archive copy came back empty.
- Second-hand only, from a search summary, UNVERIFIED: 1200 BTU/hr at 3.3 km/hr (Moon), 1440 BTU/hr with a 20% pad for walkback, max walking radius 3.1 km from 0.95 hr of oxygen. The summary itself warned the OCR is garbled.
- Orchestrator should download and Read the PDF to confirm.

4. D-RATS 2022 - PARTIAL (Earth analog, Black Point Lava Flow near Flagstaff, for a lunar rover)
- I read the text by grep only, so there are no page numbers. Flight rule: "The Rover will not be driven on slopes exceeding 20 degrees" (Earth/Moon).
- Flight rules: crew distance from the pressurized rover (PR) must not exceed 2 km. EV crew distance from one another must not exceed 100 m.
- Crab limit: 18 degrees.
- Gen 1B rover: 2 crew for 14 days. The Artemis baseline is 30 days, with 28 days of logistics plus 3 days of contingency.
- A 12-degree rocky slope test at about 8 km/h (5 mph) used Toyota Tacoma trucks, not the rover.
- Rover speed vs slope: NOT FOUND in the text sampled.
- Source: https://ntrs.nasa.gov/api/citations/20230017073/downloads/D-RATS%202022%20Test%20Report%20Final.pdf

5. Exploration Zone abstracts - PARTIAL (a full table was not built)
- Sample from the text, all Mars:
| Zone | Coordinates |
|---|---|
| East Melas | centre about 11.7 S, 290.0 E |
| Gale | about -4.5965 lat, 137.4019 lon (MSL ellipse centre; a 25 km EZ is also proposed) |
| Unnamed in my grep, a northern-plains zone | 22.3 N, 48.3 W; elevation -2 km; slopes <8 deg |
| Unnamed in my grep, Valles Marineris area | lat -3.0 to -6.2, lon -36.7 to -33.6; 100 km EZ (lon sign as printed) |
- Jezero, Deuteronilus, Protonilus, Arcadia and Kasei were not located by my regex.
- NASA 2015 call latitude and elevation limits: NOT FOUND. A grep for the 50 degree latitude figure returned nothing.
- Source: https://www.nasa.gov/wp-content/uploads/2015/06/mars-c-abstracts_in_order_of_presentation10242015_0.pdf

6. Judging 2022 - exact criteria CONFIRMED, but source UNVERIFIED
- Per your correction: I had already opened the spaceapps-prod S3 URL before the message arrived (WebFetch, then Read of the saved copy). Treat everything below as unverified.
- The only spaceappschallenge.org link found was https://www-2022.spaceappschallenge.org/resources/. It would not resolve (DNS error) and I did not confirm any guide link on it.
- Unverified content, Judging & Awards Guide dated Oct 1-2, 2022, page 8, criteria and no weights stated: Impact, Creativity, Validity, Relevance, Presentation.
- The guide says "While many Space Apps teams consider the first four judging criteria carefully... pay equal attention to the final criterion: presentation."
- Official-domain verdict: NOT FOUND.

7. NASA-STD-3001 surface EVA limits - NOT FOUND
- The Rev D URL returned 404 and Rev F was not opened. No EVA duration, suited slope or walkback figure was verified from the standard.
- NTRS figure for suited walking speed or slope limit on Mars: NOT FOUND.
- Unverified search-snippet hints only: HLS EVA up to 8 hr (6 plus or minus 2 hr) and a 2 km radius (TBR), both Moon; a 10 km Apollo-based walkback assumption cited by a Texas Tech thesis.
- Candidate PDFs to Read: https://www.nasa.gov/wp-content/uploads/2020/10/2022-04-08_nasa-std-3001_vol_2_rev_c_final.pdf and https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf

8. Special Regions - NOT FOUND on a page I opened
- The USGS page and the core.ac.uk PDF both returned 403.
- Search snippet only, UNVERIFIED, Mars: temperature at least 255 K (-18 C), lowered from 258 K in 2006; water activity at least 0.6 (no evidence of cell division or metabolism below it).
- The snippet comes from a conference abstract rather than Rummel et al. 2014, Astrobiology 14(11):887-968, DOI 10.1089/ast.2014.1227.

Saved raw files, in /Users/ardasarikaya/.claude/projects/-Users-ardasarikaya-Desktop-Business-Arda-AI-OS--claude-worktrees-nice-vaughan-48d3f0/37ee352c-5a12-469a-870d-5f5d3a6063ee/tool-results/:
- mcp-12333db2-6471-4b0e-9131-7b0f7f6134aa-firecrawl_scrape-1793743428690.txt (zone abstracts)
- mcp-12333db2-6471-4b0e-9131-7b0f7f6134aa-firecrawl_scrape-1793743530984.txt (D-RATS)

Not done: no zone table beyond the four rows above, no wider sweep of D-RATS speed data, no check that the judging guide appears on an official domain.
