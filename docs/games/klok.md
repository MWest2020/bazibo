# Klok kijken

Learn to tell the time, in `web/games/klok/` (the time logic in `time.js`, pure and tested; the
clock and pictures in `art.js`; the screens in `klok.js`). A friendly alarm clock drawn in code: a
purple rim with two gold bells, numbers 1-12, minute marks, a short orange hour hand and a long
blue minute hand that are easy to tell apart.

- The menu first shows the four kinds of round (the daily rhythm first, for the youngest, the
  digital clock last), then the rounds of one kind by age, with one "Random" card per kind (at the
  tier last played).
- Four kinds of round:
  - **Zet de klok / Set the clock:** turn the hands to a time shown in words and digits ("half
    drie", 2:30). Drag a hand (beyond the short hand's reach a finger always takes the long
    hand; near the centre the short hand wins when it is within 20 degrees, as at 12:00; the long
    hand follows the finger the shortest way round, so passing 12 moves the hour on, also with
    big steps or a fast flick) or tap + and - per hand, then Klaar / Done.
  - **Hoe laat is het? / What time is it?:** pick the time the clock shows from 3 or 4 answers.
    The wrong answers are the mistakes children really make: an hour off ("half drie" is 2:30, not
    3:30), the hands swapped, a step off, and for the oldest the twelve-hour flip (3:47 vs 15:47).
    Each comes from a different kind, never an hour too early and too late together, and the right
    answer is as often the earliest as a middle or the latest time (`npm test` checks no simple rule
    wins more than about 40%).
  - **Dagritme / Daily rhythm** (youngest, whole hours): a picture (breakfast, school, lunch,
    playing outside, dinner, bath, bed) and three clocks with a sun (day) or a moon (evening).
  - **Digitaal / Digital** (ages 7-10, as Dutch schools teach it in groep 4-5), three tiers of
    10 mixed questions: (1) a digital time such as 03:30 to its analogue clock and back, whole
    hours then half hours, 12-hour; (2) quarters then five minutes: set a digital clock with big
    + and − buttons for the hour and the minutes to an analogue clock or to words ("kwart over
    vier"; the clock follows along), and say a digital time in words ("04:25" is "vijf voor half
    vijf"); (3) the 24-hour clock: "14:25" to and from "vijf voor half drie ’s middags" / "twenty-five
    past two in the afternoon", an analogue clock with its part of the day to the 24-hour time, and
    which is later (09:40 or 21:15), with a strip of the day. Parts of the day: 0-6 night, 6-12
    morning, 12-18 afternoon, 18-24 evening. The digital clock is drawn in seven segments (no
    fonts), the hour orange like the short hand and the minutes blue like the long hand; its colon
    blinks calmly. A mistake shows the clock and the digital clock side by side and explains it.
- Five tiers: whole hours (5-6), half hours (6-7), quarters (7-8), five minutes (8-9), single minutes
  and the 24-hour clock with a sun or moon on the face (9-10).
- Dutch phrasing follows the half hour: "vijf voor half drie" (2:25), "tien over half drie"
  (2:40), "kwart voor drie" (2:45); single minutes "acht minuten voor half vier" (3:22). English
  counts past and to the hour. `npm test` checks every 5-minute step of every hour in both
  languages, and that all 720 positions read differently.
- A round is 10 questions; stars by mistakes (none 3, one or two 2, more 1). A mistake shows the
  right time on the clock and explains it ("De grote wijzer staat op de 6 en de kleine wijzer
  staat tussen de 2 en de 3"). The hint lights up the hand to look at.
- Free: every round of whole and half hours (on the clock and on the digital clock), and the daily
  rhythm. Quarters, minutes and the 24-hour clock, and random practice per tier, are in the full
  version (`meta.js`).
- Saved under `games.klok`: stars per round (`dig-t1-1` and so on for the digital rounds), random
  rounds done per mode and tier, the last tier per kind and which how-to cards were seen. A round in progress is kept while the app stays open ("keep playing").
