# check-f-suit-safety-documents (worker report, 2026-11-04)

Credits used: about 65 of 300. Method: firecrawl PDF parser, plus Read on a locally saved copy of the Rev C PDF (page numbers below are PDF pages).
1. Apollo walkback memo: NOT FOUND. Walkback speed, metabolic rate and walking radius were not read from the document.
 - nasa.gov URL returns 404 (firecrawl 1 credit, WebFetch also 404).
 - The UNT web-archive copy returns only an empty PDF-viewer shell (9 pages, no text): https://webarchive.library.unt.edu/eot2008/20090109180220/http:/www.hq.nasa.gov/alsj/19790073512_1979073512.pdf . Orchestrator should download it and use Read.
 - UNVERIFIED search-engine summaries conflict. One says Bellcomm "Apollo 15 EVA Capability" (Moon), 1200 BTU/hr at 3.3 km/hr with +20% for walkback. The other says "Apollo 15 EVA Capability and Constraints Envelopes", Case 320, 13 Oct 1970, P. Benjamin, EVA 2 walking max return 3.1 km. Do not use either without reading the PDF.
2. NASA-STD-3001 Vol 2 Rev C (Moon-oriented rationale, approved 2022-04-08; PDF 331 pp). URL: https://www.nasa.gov/wp-content/uploads/2020/10/2022-04-08_nasa-std-3001_vol_2_rev_c_final.pdf
 - Rev F (https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf, approved 2026-07-14, 389 pp) was NOT read beyond the history log. The 389 pages were not affordable, so Rev F changes since Rev C are unchecked.
 - Sections read in Rev C: 6.8 radiation (pp80-81), 11.2-11.5 (pp200-206).
 - EVA duration limit: NOT FOUND as a requirement. The nearest text is the Table 35 note under [V2 11039] (Mars-applicable, not surface-specific): "Total duration in the suit is not to exceed 14 hours" (p205). The table lets inspired CO2 up to 4 mmHg run indefinitely and higher levels for 0.5 to 7 h/day.
 - [V2 11030] rationale, MOON (p202): "During surface EVAs, crewmembers will most likely be suited for 10 hours, including approximately 7 hours expending energy on the lunar surface." It also mentions "a 10-km walk-back in case of rover failure". Both are rationale text, not "shall" limits.
 - [V2 11025]: nutrition for surface EVAs over 4 h or suited activity over 12 h. [V2 11030]: 240 mL/hour water.
 - Metabolic rate limits: NOT FOUND. [V2 11037] (measure) and [V2 11038] (display) give no number.
 - Suited slope limit: NOT FOUND. Walkback or rescue distance requirement: NOT FOUND. [V2 11101] (Incapacitated Crew Rescue) is generic ("Resources shall be provided"), with no distance.
 - Radiation: [V2 6095] says the program shall prevent crew exceeding the Vol 1 limits (PELs). [V2 6097] is ALARA. Vol 2 states no number.
3. Special Regions: CONFIRMED. The two number pairs are different definitions, and 0.5/250 K is not exactly 250 K.
 - Primary: National Academies 2015, Review of the MEPAG Report on Mars Special Regions, ch.1 (quotes Rummel 2014 pp.894-898): https://www.nationalacademies.org/read/21816/chapter/3
 - COSPAR colloquium (Kminek et al. 2010): lower temperature limit -25 C (about 248 K) with water activity 0.5 (the NAP text says "-25 C"). Summary sources round -25 C to 250 K, but that is rounding, not the report text.
 - SR-SAG 2006: -15 C or -20 C including margin, aw 0.62 or 0.5 including margin.
 - SR-SAG2 / Rummel 2014: "lower limit for temperature should be -18 C [255 K] and water activity (aw) above 0.60". This applies to Mars Special Regions and replaces the 2010 limits.
 - So 0.5/250 K is the older COSPAR limit and 0.6/255 K is the newer SR-SAG2 limit. They are two versions of the same Special Region threshold (the secondary Rivera-Valentin 2020 paper, https://pmc.ncbi.nlm.nih.gov/articles/PMC7745847, says the same).
 - Not obtained: Rummel 2014 full text (paywalled at https://journals.sagepub.com/doi/10.1089/ast.2014.1227).
4. Suited speed/slope/metabolic cost at 0.38 g: NOT FOUND in NASA sources I could fetch.
 - Kluis & Diaz-Artiles 2022 (1-page abstract) states the model is Marquez [3] (Marquez & Cummings 2008, J. Aerosp. Comput. Inf. Commun. 5(3):57-71, doi 10.2514/1.26248), "extrapolations of the velocity and metabolic data from Apollo missions", with one constant walking velocity per terrain slope. No equation or table is given. https://bhp.engr.tamu.edu/wp-content/uploads/sites/212/2022/02/Kluis-et-al.-2022-A-METHODOLOGY-FOR-ANALYZING-AND-IMPROVING-EVA-PERFORMANCE.pdf
 - Kluis also cites Norcross et al. 2010 NASA TR (MkIII suit metabolic cost, multiple linear regression over speed, pressure, incline, gravity). That report was not fetched.
 - Marquez & Cummings 2008, first 3 of 15 pages (https://core.ac.uk/download/78055586.pdf), contains no metabolic model. It is about sun and azimuth cost. The 2005 MIT paper only lists "metabolic cost" as a future objective.
 - The Marquez equation is NOT FOUND. Next sources to try: Norcross 2010 on NTRS, and the SEXTANT/BASALT code.
5. Radiation: CONFIRMED (MARS surface, Gale crater, about 300 sols near solar maximum).
 - Hassler et al., Science 2014, 343:1244797, text of the science.org PDF: https://www.science.org/cms/asset/b9057f23-375b-447a-ba62-65a4e7f691a4/pap.pdf
 - Average total GCR dose rate 0.210 +/- 0.040 mGy/day, versus 0.48 +/- 0.08 mGy/day in cruise inside the MSL spacecraft.
 - Average GCR dose equivalent rate on the Mars surface 0.64 +/- 0.12 mSv/day.
 - The 0.67 mSv/day figure from SwRI press (Aug 2012 to Jun 2013) is not the paper's number. The paper also gives about 76 mGy/yr at the surface (Table 3).
 - Dose limit (Moon, Mars and LEO alike): NASA-STD-3001 Vol 1 Rev B, [V1 4030], career effective dose under 600 mSv. Source: OCHMO tech brief OCHMO-TB-020 Rev E, https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf (secondary, Vol 1 not read directly).
 - [V1 4031] solar particle event limit 250 mSv per event. [V1 4032] nuclear technologies 20 mSv per mission year.
 - GCR design limit "under consideration", not adopted: below 1.3 mSv/day in free space and below 0.8 mSv/day for systems on planetary surfaces.
Source quality: NAP, Hassler (Science, peer-reviewed), NASA standards and the OCHMO brief are primary. Kluis is a conference abstract.
