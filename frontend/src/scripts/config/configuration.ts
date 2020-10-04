import firebase from 'firebase/app';
import 'firebase/firebase-remote-config';

export abstract class Configuration {
  private static remoteConfig: firebase.remoteConfig.RemoteConfig;
  private static initialized = false;

  public static async initialize(): Promise<void> {
    const firebaseConfig = {
      apiKey: 'AIzaSyBG85dp-AhaCW-qi_6mu77wDPSipzipIF4',
      authDomain: 'decla-red.firebaseapp.com',
      projectId: 'decla-red',
      appId: '1:635208271441:web:c910843ae7e0549dadda70',
    };

    firebase.initializeApp(firebaseConfig);

    this.remoteConfig = firebase.remoteConfig();

    this.remoteConfig.settings = {
      minimumFetchIntervalMillis: 0, // todo: 3600 * 1000,
      fetchTimeoutMillis: 15 * 1000,
    } as any;

    await this.remoteConfig.ensureInitialized();
    await this.remoteConfig.fetchAndActivate();

    this.initialized = true;
  }

  public static get servers(): Array<string> {
    if (!this.initialized) {
      throw new Error('Configuration should be initialized');
    }

    return JSON.parse(this.remoteConfig.getValue('online_servers').asString());
  }
}
