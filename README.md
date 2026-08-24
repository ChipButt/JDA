# Jess' Dog Organiser (JDA)

A mobile-first dog walking and sitting organiser based on the supplied spreadsheet structure.

## Included

- Dog profiles with photo, name, breed, age, owner's name, structured address, entry/key instructions, special requirements and other notes.
- Take a dog photo with the phone camera or choose an existing image.
- Separate walking and sitting toggles with multiple weekly day/time entries.
- Today screen for scheduled jobs.
- Searchable All Dogs directory.
- Weekly Walking and Sitting screens.
- Saved starting location plus walking fields/destinations.
- Route planner that considers pickup times, destination arrival time, time spent at houses and a traffic/parking buffer before suggesting the collection order and leave-by time.
- Finished route can be opened in Google Maps.
- IndexedDB storage on the device for dog records, photos, locations and settings.
- Automatic migration from the earlier localStorage version when existing data is found.
- JSON backup and restore for moving or safeguarding the data.
- PWA/offline support.
- No account, API key or external database signup required.

The app is a static mobile web app hosted from this repository. Jess's private working data is stored in the browser's IndexedDB on her device and is not committed to GitHub.
