/**
 * Hardcoded list of game servers the landing page offers to players.
 *
 * Each entry is the public origin of a dockerized `declared-server` instance.
 * The join screen polls `<origin>/state` (see `serverInformationEndpoint`) and
 * only shows a server once it responds, so listing an offline origin here is
 * harmless. Add or remove origins as you deploy more server containers.
 */
const servers: Array<string> = ['https://server.decla.red'];

export abstract class Configuration {
  public static async initialize(): Promise<void> {
    // Kept async for call-site compatibility; the server list is static now.
  }

  public static get servers(): Array<string> {
    return servers;
  }
}
