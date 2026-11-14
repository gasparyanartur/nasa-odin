# Marswalk tour film
AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

`film.mjs` films a narrated tour of the Marswalk app from the shot list in `storyboard.json`.

## What the film is
- A screen recording of the real app, driven by a script. A headless Chrome opens the app and gets real mouse and key input, one segment of the shot list after the other. The app files are not changed.
- On top of the recording there is a drawn cursor, a click ripple, a magenta highlight frame and a speech bubble. They are added for the film only.
- Under the picture there is a caption band with the narration text.
- The narration audio (`audio/<id>.mp3`) is AI-made. Say so wherever the film is shown, for example in the video description or on the slide that plays it.

## Run
Start the app first (from the project folder):

```
python3 -I tools/dev_server.py --port 8644
```

Then, from `tools/film/`:

```
node film.mjs                          # the whole film, with audio/<id>.mp3 when present
node film.mjs --silent                 # no audio: durations are estimated from the words
node film.mjs --only 05-plan,06-marks  # only these segments (earlier ones play fast, not filmed)
node film.mjs --no-build               # record and write the timeline, no video
node film.mjs --url http://localhost:8650/
```

Needs Node 22 or newer (no npm), Google Chrome in `/Applications`, and `ffmpeg` and `ffprobe` in `/opt/homebrew/bin`.
The script starts its own headless Chrome on port 9344 and stops only that process.

## Output
- `out/marswalk-tour.mp4`: 1920 x 1080, 30 fps, H.264 and AAC. The app picture is 1920 x 970, the caption band 110 px.
- `out/timeline.json`: each segment with its start, end and caption chunks, the capture rate and notes from the run.
- Frames and the Chrome profile go to a scratch folder (`--scratch <dir>`, default in the system temp folder).

## Timing
Each segment lasts as long as its audio file plus 0.6 s; without the file it is the word count / 2.5 s.
Waits (the route, the drop to eye height, RETURN NOW) happen before the narration of their segment starts.
The table `SHOTS` in `film.mjs` maps each segment's "point" and "do" to selectors and timed actions.
