import { init } from '@plausible-analytics/tracker';

try {
  init({
    domain: 'doppler.schmelczer.dev',
    endpoint: 'https://stats.schmelczer.dev/status',
  });
} catch (error) {
  console.warn('Could not initialize analytics.', error);
}
