/**
 * Hardcoded list of game servers the landing page offers to players.
 *
 * Each entry is the public origin of a dockerized `declared-server` instance.
 * The join screen polls `<origin>/state` (see `serverInformationEndpoint`) and
 * only shows a server once it responds, so listing an offline origin here is
 * harmless. Add or remove origins as you deploy more server containers.
 */
const productionServers: Array<string> = ['https://declared.schmelczer.dev'];

/**
 * When the page is served from localhost (i.e. the webpack-dev-server), also
 * offer the local backend so a `npm start` server can be joined during
 * development. The backend's default port is 3000 (see backend/src/options.ts).
 * In production the hostname is `declared.schmelczer.dev`, so this never leaks.
 */
const isDevelopment =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

const servers: Array<string> = isDevelopment
  ? [`http://${location.hostname}:3000`, ...productionServers]
  : productionServers;

export abstract class Configuration {
  public static async initialize(): Promise<void> {
    // Kept async for call-site compatibility; the server list is static now.
  }

  public static get servers(): Array<string> {
    return servers;
  }
}
