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

## Movement and networking

The server owns physics and combat. It simulates at 200 Hz, keeps each player's
latest held movement direction, and sends snapshots at 25 Hz. Clients send input
changes immediately on their next frame and send idle heartbeats at 30 Hz.

The local player replays input from the latest authoritative pose using the same
physics as the server. The acknowledgement includes movement state, remaining leap
cooldown, and the age of the acknowledged input, so the client can align replay
without synchronizing wall clocks. Nearby planets are included even when offscreen
because their gravity affects prediction. Replay stops after 400 ms without a fresh
anchor; only reconciliation corrections are eased over 80 ms. The camera follows
the displayed player directly.

Other objects interpolate snapshots on a server timeline delayed by 100 ms, with
at most 60 ms of extrapolation. Creation and deletion use that same timeline.
Remote effects use that timeline too; feedback for the local player is immediate.
End-of-round slow motion comes from server snapshots and disables local prediction;
outgoing velocity and projectile fade rates are expressed per wall-clock second.
When a connection backs up, regenerable state can be skipped; lifecycle messages
keep their timestamps. The frontend bundles one `gl-matrix` instance so prediction
and server physics both use JavaScript's full numeric precision.

## Deployment

CI/CD runs on Forgejo Actions (`.forgejo/workflows/deploy.yml`). On a push to
`main` it:

- builds the static frontend and rsyncs `frontend/dist/` to the `/pages/declared`
  mount on the runner host (the mount keeps its pre-rebrand name), and
- builds the server image from the root `Dockerfile` and pushes it to the Forgejo
  container registry as `<registry>/<owner>/<repo>-server`.

The registry job needs a `FORGEJO_PACKAGE_TOKEN` secret (with package write
scope) and, optionally, a `CONTAINER_REGISTRY_HOST` variable to override the
registry host.

The website's server list is hardcoded in
[`frontend/src/scripts/configuration.ts`](frontend/src/scripts/configuration.ts) —
edit it to add or remove game-server origins.

Run the server image locally:

```sh
docker build -t doppler-server .
docker run -p 3000:3000 doppler-server --name "My server" --playerLimit 16
```
