import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'be.communica.marchia',
  appName: 'Marchia',
  webDir: 'dist',
  backgroundColor: '#2b2620',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
};

export default config;
