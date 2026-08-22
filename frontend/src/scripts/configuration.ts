/**
 * Game server origins. The join screen polls each and only shows those that
 * respond, so listing an offline origin here is harmless.
 */
const productionServers: Array<string> = ['https://declared.schmelczer.dev'];

/**
 * On localhost (webpack-dev-server) also offer the local backend on its default
 * port; in production the page is served from its own hostname, so this never leaks.
 */
const isDevelopment =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

export const servers: Array<string> = isDevelopment
  ? [`http://${location.hostname}:3000`, ...productionServers]
  : productionServers;
