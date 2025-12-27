import { ExpoConfig, ConfigContext } from 'expo/config';
import 'dotenv/config';

// const DEFAULT_KERNEL = '0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A';
const DEFAULT_ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';


export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Dejest',
  slug: 'Dejest',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'dejest',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.de1ik.Dejest",
  },
  android: {
    package: "com.de1ik.Dejest",
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    PRIVATE_KEY: process.env.IS_SKIP_AUTH === 'true' ? process.env.PRIVATE_KEY : '',
    KERNEL: process.env.IS_SKIP_AUTH === 'true' ? process.env.KERNEL : '',
    ENTRY_POINT: process.env.ENTRY_POINT ?? DEFAULT_ENTRYPOINT,
    SKIP_SEED: process.env.SKIP_SEED === 'true',
    PIMLICIO_RPC: process.env.PIMLICIO_RPC,
    ZERODEV_RPC: process.env.ZERODEV_RPC,
    API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:4000',
    PORT: process.env.PORT ?? '4000',
  },
});
