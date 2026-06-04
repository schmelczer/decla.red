import { init as plausibleInit } from '@plausible-analytics/tracker';

const ANALYTICS_AUTO_CAPTURE_PAGEVIEWS = true;
const ANALYTICS_DOMAIN = 'decla.red';
const ANALYTICS_ENDPOINT = 'https://stats.schmelczer.dev/status';
const ANALYTICS_LOGGING = process.env.NODE_ENV !== 'production';

try {
  plausibleInit({
    domain: ANALYTICS_DOMAIN,
    endpoint: ANALYTICS_ENDPOINT,
    autoCapturePageviews: ANALYTICS_AUTO_CAPTURE_PAGEVIEWS,
    logging: ANALYTICS_LOGGING,
  });
} catch (error) {
  console.warn('Could not initialize analytics.', error);
}
