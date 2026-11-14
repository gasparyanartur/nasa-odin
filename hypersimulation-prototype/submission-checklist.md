# NASA Space Apps 2026 - submission checklist

Built 2026-11-14 from the 2026 pages: Project Submission Guide (https://www.spaceappschallenge.org/resources/project-submission-guide/), Judging & Awards Guide (https://www.spaceappschallenge.org/resources/judging-awards-guide/), legal page (https://www.spaceappschallenge.org/legal/), FAQ (https://www.spaceappschallenge.org/resources/participant-faqs/). Quotes are from those pages. Go through every box before the last save.

Deadline: submission "closes on Sunday, November 15 at 11:59 p.m." in the Local Event time zone. "Only your last saved submission will be reviewed." Edits are allowed until the deadline. A save after the deadline makes the project ineligible.

## 1. Keep from the first hour (running records)

- [ ] Source list: every outside data set, code library, image, text and tool, with its URL and its licence. One line each, added on the day it is first used.
- [ ] AI use log: which AI tool, for what, on which file. The form asks: "Did you utilize any Super Intelligence (SI) tools and software in preparing your solution? If yes, how did you use them?" (The pages call AI "SI".)
- [ ] The idea comes from the team. The guide says SI should not be used to come up with the idea of how to solve the challenge.

## 2. Licence documentation (legal page)

- [ ] Every non-NASA data set and code item is "freely and publicly available without restriction" or under an open source licence. Check against section 8 of `resource-catalogue.md`: nothing from HOLD or DROP is in the project.
- [ ] Each licence is named in the project documentation (README of the repository). "NASA will not accept or post any Solutions that do not include appropriate license documentation."
- [ ] The team's own work has a named open licence in the repository. With none named, NASA distributes it under Apache 2.0.
- [ ] Layers made from ShareAlike sources (the 200 m terrain blend with HRSC, the Montabone dust maps) carry the same ShareAlike licence.
- [ ] Data-use terms of each non-US-government website are followed (Resources tab rule).
- [ ] No copyrighted music, image or text without permission. No figure copied from a paper.

## 3. Citations

- [ ] Field "Space Agency Partner Data and Other References": lists all data, resources and tools, and "any code, text, and images (even if they are open source or freely available)".
- [ ] Field "NASA Data": names the NASA data and resources used. At least one is needed for a Global Award.
- [ ] Credit lines as each source asks (for example NASA/JPL/University of Arizona for HiRISE; NASA/JPL/MSSS/The Murray Lab for the CTX mosaic; ESA/DLR/FU Berlin for HRSC).

## 4. AI ("SI") disclosure and marking

- [ ] Field "Use of Super Intelligence (SI)" is filled from the AI use log.
- [ ] AI-generated images and videos: "Must include a visible watermark to indicate SI generation."
- [ ] AI-generated audio: acknowledged "in descriptive text and metadata".
- [ ] AI-generated code and data: acknowledged "in descriptive text and metadata" (README statement plus a note in the files or commit history).
- [ ] No AI-generated content uses, contains or changes NASA branding: no NASA logo, flag or mission identifier.
- [ ] Before the last save: add the AI-use statement to the README and fill the form field 'Use of Super Intelligence (SI)', including that AI proposed the stations, tasks and assumption values (deferred on 2026-11-14 at Arda's instruction).

Draft sentences for that line (2026-11-14, NOT approved by the team lead; not in the README or the form yet; change them if a station, task or value changes):

README, section "AI use":
> The idea came from the team: a Mars map, a route planner and a helmet display. We used an AI assistant (Claude, by Anthropic) to test that idea against the available NASA data. It recommended one walk at one place, and the team lead approved that direction. The assistant wrote the code, the data scripts, the tests and most of this documentation. It also proposed the eight stations, the task at each station and the assumption values, such as walking speed and work time. The team lead approved them. Each value with no source is labelled "assumption" in the app. No image in this project is AI-made. Each AI-written commit says so in its message, and each generated file carries a header line.

Form field "Use of Super Intelligence (SI)":
> Yes. We used Claude (Anthropic). The idea is ours: a Mars map, a route planner and a helmet display. The AI checked the idea against NASA data and recommended one walk at the Gale crater boxwork ridges, which the team lead approved. The AI wrote the code, data scripts, tests and documentation. It proposed the stations, the station tasks and the assumption values, which the team lead approved. No images or video are AI-made. AI-written code is marked in the commit messages and in file headers.

If the tour film (`tools/film`) is shown outside the team: its narration is AI-made audio (ElevenLabs) and the description must say so.

## 5. Demo

- [ ] One of: a slide deck of at most 7 slides (title and introduction slides count), or a video of 30 seconds or less. Over the limit means not eligible for Global Judging.
- [ ] Slides are in English. A video in another language has English subtitles.
- [ ] Slides name the team, the members and the challenge.
- [ ] The link is public: no password, no permission request, no registration. Test it in a private browser window.
- [ ] No image, video, audio or likeness of any person under 18.
- [ ] Written consent from every identifiable person shown (legal page, per the 2026-11-03 reading).

## 6. Project link

- [ ] "Link to Final Project" is public and opens without login. The repository is switched from private to public only on Arda's word, before the last save.
- [ ] Test the link in a private browser window. "If judges can't access your project, it can't be evaluated or judged."
- [ ] The project page and all materials are in English.

## 7. Form and team

- [ ] All fields filled: Project Name, High-Level Project Summary, Link to Project Demo, Link to Final Project, Detailed Project Description, Use of SI, NASA Data, Space Agency Partner Data and Other References.
- [ ] The project answers the chosen official challenge: Interplanetary Survival Guide: Martian Map.
- [ ] NASA data is a core part of the solution (Relevance criterion), not a small addition.
- [ ] Every member is registered for the same Local Event, is not on a waitlist, and shows on the Members tab. Team size is 1 to 6.
- [ ] Both declaration boxes ticked: (a) read the guide and agree to the terms and privacy policy; (b) original work, all outside resources in the References field, no copyrighted material without permission.
- [ ] "Submit for Judging" clicked, and the page shows the submission as saved before 11:59 p.m.

## Open points

- The guide does not mark which fields are required, and states no length limits. Check the live form.
- No rule on paid or closed tools was found in the guide, the judging guide or the legal page.
- NASA runs a review for "prohibited bilateral activity with China, or a Chinese-owned entity" at its sole discretion. No team action is known.
- The consent line in section 5 comes from the 2026-11-03 reading of the legal page; the guide itself states only the under-18 rule.
