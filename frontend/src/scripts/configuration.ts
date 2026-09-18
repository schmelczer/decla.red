const productionServers: Array<string> = ['https://doppler.schmelczer.dev'];

const isDevelopment =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

export const servers: Array<string> = isDevelopment
  ? [`http://${location.hostname}:3000`, ...productionServers]
  : productionServers;
