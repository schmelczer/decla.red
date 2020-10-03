import * as firebase from 'firebase/app';
import 'firebase/firebase-remote-config';

export class Configuration {
  public static async initialize(): Promise<void> {
    const firebaseConfig = {
      apiKey: 'AIzaSyBG85dp-AhaCW-qi_6mu77wDPSipzipIF4',
      authDomain: 'decla-red.firebaseapp.com',
      projectId: 'decla-red',
      appId: '1:635208271441:web:c910843ae7e0549dadda70',
    };

    firebase.initializeApp(firebaseConfig);

    const remoteConfig = firebase.remoteConfig();
    remoteConfig.defaultConfig = {
      online_servers: 'hi',
    };

    remoteConfig.settings = {
      minimumFetchIntervalMillis: 3600 * 1000,
      fetchTimeoutMillis: 15 * 1000,
    } as any;

    await remoteConfig.ensureInitialized();
    await remoteConfig.fetchAndActivate();

    console.log(remoteConfig.getValue('online_servers'));
  }
}
