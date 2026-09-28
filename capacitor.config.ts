import type { CapacitorConfig } from '@capacitor/cli';

const LIVE_API = 'https://bolkarigar.onrender.com';

const config: CapacitorConfig = {
  appId: 'com.bolkarigar.app',
  appName: 'AO',
  webDir: 'public',
  // Local files load from APK; API calls go to LIVE_API via public/native-config.js
  server: {
    androidScheme: 'https',
    appStartPath: 'loginpage.html',
    allowNavigation: [
      'https://app.accountsorbit.com',
      'https://accountsorbit.com',
      'https://www.accountsorbit.com',
      'https://bolkarigar.onrender.com'
    ]
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      showSpinner: true,
      spinnerColor: '#3b82f6'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a'
    }
  }
};

export default config;
