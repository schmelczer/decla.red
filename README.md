# doppler

A 2-dimensional multiplayer game utilising ray tracing.

> **Available at [doppler.schmelczer.dev](https://doppler.schmelczer.dev).**

![screenshot of in-game fight](media/game-pc.png)
![three screenshots taken at iPhone SE screen size](media/collage-iphone.png)

For optimised 2D ray tracing, [SDF-2D](https://github.com/schmelczerandras/sdf-2d) is used.

## Development

Run `npm install && npm run init` once, then `npm run dev`. Run `npm test` for
regressions, `npm run lint:check` for formatting and lint, and `npm run build` for
all production bundles. Tests rebuild the shared library before running.

The website's server list is hardcoded in
[`frontend/src/scripts/configuration.ts`](frontend/src/scripts/configuration.ts) —
edit it to add or remove game-server origins.

Run the server image locally:

```sh
docker build -t doppler-server .
docker run -p 3000:3000 doppler-server --name "My server" --playerLimit 16
```
