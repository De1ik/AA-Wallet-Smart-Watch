# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Set up environment variables

   Create a `.env` file in the root directory with the following variables:

   ```env
   # Test mode configuration
   PRIVATE_KEY_TEST=true
   PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
   KERNEL=0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A

   # Development shortcuts
   SKIP_SEED=true

   # ZeroDev Configuration (if needed for other parts)
   ZERODEV_RPC=https://rpc.zerodev.app/api/v2/bundler/YOUR_PROJECT_ID
   ZERODEV_PROJECT_ID=YOUR_PROJECT_ID

   # Server Configuration
   PORT=4000
   
   ```

   **Environment Variables:**
   - `PRIVATE_KEY_TEST`: Set to `true` for test mode, `false` or omit for production
   - `PRIVATE_KEY`: Private key for testing (when `PRIVATE_KEY_TEST=true`)
   - `KERNEL`: Kernel address to use as public address in test mode
   - `SKIP_SEED`: Set to `true` to skip seed phrase verification during wallet creation
   - `ZERODEV_RPC`: Your ZeroDev RPC URL
   - `ZERODEV_PROJECT_ID`: Your ZeroDev project ID
   - `PORT`: Server port (default: 4000)

   **Note:** Environment variables are now managed through `app.config.ts` and accessed via the config utility in `utils/config.ts`. This provides better type safety and centralized configuration management.

3. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Smart Watch Integration

The app includes smart watch integration for Apple Watch connectivity. This feature allows users to create delegated keys for secure transactions directly from their Apple Watch.

### Requirements

For Apple Watch functionality:

- iPhone with iOS 9.0 or later
- Apple Watch with watchOS 2.0 or later
- Apple Watch paired with the iPhone
- Dejest app installed on both iPhone and Apple Watch

### Implementation Notes

- The implementation uses native iOS WatchConnectivity framework
- Real Apple Watch communication requires the native bridge to be properly implemented
- The bridge provides secure key generation and transaction signing capabilities

### Smart Watch Features

- **Delegated Key Creation**: Generate secure keys on the Apple Watch
- **Transaction Signing**: Sign transactions directly from the watch
- **Permission Management**: Configure access levels (sudo vs restricted)
- **Real-time Connection Status**: Monitor watch connectivity

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
