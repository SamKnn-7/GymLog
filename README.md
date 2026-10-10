# GymLog

A workout and bodyweight tracker that runs in the browser. Log your sets, weigh in once a week, and see at a glance whether you are moving forward: green is progress, red is a decline, grey is no change.

**Try it:** https://samknn-7.github.io/GymLog/

It works on a phone, a tablet or a computer, needs no account, and keeps working with no signal once it has been opened.

## Features

**Logging a workout**

- Last session's numbers sit greyed out in every set. Tick a set to accept them, or type your own and the row colours itself against last time.
- 232 built-in exercises, including 70 Smith machine variations and 61 calisthenics moves, with filters by muscle group and equipment. Add your own at any time.
- Cardio is logged as a time with an optional distance. Holds such as planks are logged as a time.
- Warm-up, drop and failure sets. Warm-ups do not count towards progress.
- Rest timer that starts when a set is ticked off, an elapsed clock, notes, and an alert the moment you beat a personal record.
- Routines you save yourself, plus ten ready-made templates (Push / Pull / Legs, Upper / Lower, Full body, Strength 5×5, Calisthenics, Smith machine).

**Seeing progress**

- Dashboard with weekly goal, week streak, volume, an activity calendar, sets per muscle group, cardio minutes and written insights.
- A progress page for every exercise: estimated one-rep max, top weight, volume or reps over time, personal records and a rep-max table.
- History with a month calendar and search. Any workout can be repeated, edited or saved as a routine.
- Rest days, marked for today or any past day, with an optional note.
- Training times: each workout's start time is taken from the device clock, and the dashboard shows whether mornings or evenings go better.
- Eighteen achievements to unlock.

**Bodyweight**

- Weekly weigh-ins judged against a goal (lose, gain or stay the same) and an optional target weight.
- Smoothed trend line, rate of change per week, projected date for the target, and BMI.
- Optional measurements: body fat, waist, chest, arms, thighs and hips.

**Everything else**

- A short first-run setup for units, bodyweight, goals and starter routines.
- Kilograms or pounds, switchable at any time with existing data converted.
- Light and dark mode.
- Plate calculator and one-rep max calculator.
- Backup export and import, and a CSV export of every set.

## Put it on your phone

Open the link above and tap **Install app**, on the dashboard or under Tools. On Android that installs it straight away. On an iPhone it shows the steps, because iPhones only install from the Share menu:

- **iPhone:** in Safari, tap the Share button, then **Add to Home Screen**.
- **Android:** if the button is not offered, tap the ⋮ menu in Chrome, then **Install app** or **Add to Home screen**.

It then opens full screen from its own icon and works offline.

On an iPhone, install before you start logging: the installed app keeps its own data, separate from Safari. If you have already logged workouts in Safari, export a backup there and import it in the installed app.

## Your data

Everything you log is stored in your browser, on your device. Nothing is sent to a server and there is no account, which also means there is no sync: a phone and a computer each keep their own data.

- Use **Tools → Export backup** now and then, and **Import backup** to move to another device.
- On an iPhone, use the home screen icon. Safari can clear a website's saved data if the site is not opened for about a week; home screen apps are not affected.

## Run it locally

There is nothing to install or build. Either open `index.html` in a browser, or serve the folder:

```bash
python serve.py
```

and open http://localhost:5173. `serve.py` is a small wrapper around Python's built-in web server that stops the browser caching files while you edit them.

## How it is built

Plain HTML, CSS and JavaScript, with no framework, no dependencies and no build step. Charts are drawn as SVG by hand.

```
index.html              the page shell and script list
css/app.css             all styling, light and dark themes
js/util.js              dates, numbers and time formatting
js/library.js           built-in exercises and routine templates
js/store.js             saved state, backups, unit conversion, sample data
js/stats.js             progress, records, streaks, insights, achievements
js/charts.js            line charts, bars, activity calendar
js/ui.js                icons, badges, toasts, dialogs, tooltips
js/timer.js             rest timer
js/core.js              page registry and rendering
js/views/               one file per page, plus the first-run setup
js/app.js               event routing and start-up
sw.js                   service worker for offline use
manifest.webmanifest    home screen name, icon and colours
```

How progress is judged:

- **Strength:** the best set of a session is scored by estimated one-rep max (Epley). A session beats the last one if that score is higher, with total volume and then total reps as tie-breakers. A heavier top weight always counts as progress.
- **Cardio:** further is better; over the same distance, faster is better; with no distance logged, longer is better.
- **Holds:** the longest single hold, then total time.
- **Bodyweight:** a change counts as progress when it moves toward the chosen goal.

## Updating the live site

The site is served by GitHub Pages from the `main` branch, so pushing to `main` publishes it.

When any file changes, bump the `CACHE` name at the top of `sw.js`. Phones keep an offline copy of the app, and the new name is what tells them to fetch the new version. They pick it up on the second open after an update.
