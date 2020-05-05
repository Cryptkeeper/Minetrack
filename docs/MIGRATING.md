# Migrating to Minetrack 5
Minetrack 5 is the first of several upcoming updates designed to address several legacy bugs and design flaws in previous Minetrack versions. As part of this, it modifies some data structures and operational instructions that make the upgrade process more manual than seen previously. This guide covers the distinct differences, with upgrade instructions, to get you started.

## Upgrading Minetrack 5
1. Stop any running instance of Minetrack.
2. If you've cloned the repository, use `git clone https://github.com/Cryptkeeper/Minetrack Minetrack5`. If you've manually downloaded a release or an archive of the repository, download a fresh copy and extract it into a directory named "Minetrack5".
3. Install Node 12.4.0+ (check your version with node -v)
4. Open the directory and execute `npm install --build-from-source`. This will install updated (and new) dependencies needed by the program.
5. If you have `logToDatabase: true` in your `config.json`, make sure to copy your `database.sql` file into the new directory, otherwise you will lose historical server activity and records.
6. Copy your existing `config.json` and `servers.json` files into the new directory.
7. Build your copy of `dist/`.
8. If you have previously configured any `faviconOverride` values within `config.json`, you will need to move them to the updated structure. Create a new directory within your Minetrack folder named `favicons/`.
9. If you have previously configured any `minecraft.json` values not included in the new `minecraft_versions.json` file, you will need to update their structure copy them to the new file.
10. Move your custom favicon images into the directory. 
11. Open `servers.json` in your favorite editor.
12. For any server which you have a custom favicon, set the "favicon" field like so:

```
{
	"name": "Hypixel",
	"ip": "mc.hypixel.net",
	"type": "PC",
	"favicon": "CustomHypixelFavicon.png"
}
```
(Replacing "CustomHypixelFavicon.png" with your file's name.)

Do **NOT** include the `favicons/` path in the value. For example a file, "my-favicon.png" in the directory `favicons/` should be configured using simply "my-favicon.png".

You may delete the `faviconOverride`, `routes` and `versions` portions of your `config.json`, they are no longer supported features. You may delete the `minecraft.json` file, it has been merged into `minecraft_versions.json`.

You're done!

## Building `dist/`
Minetrack now serves a "bundled" copy of the `assets/` directory, instead of the files directly from disk. This optimizes the delivery speed, but requires an additional step when installing Minetrack or when modifying files within `assets/`.

1. `cd` into your Minetrack directory (if not already there).
2. Execute `npm run build` (`npm run dev` is also available, which skips the minimization step and makes active development easier).
3. Run `ls` to ensure the `dist/` directory has been created.

Whenever modifying files within `assets/`, you will need to re-run the `npm run build` step to reflect the changes. Those expert few of you may wish to dig into Parcel's [watch and serve](https://parceljs.org/cli.html#watch) CLI commands.
