# SplitChey - Expense Management App

This is a [SplitChey](https://splitchey.com) mobile application built with [Expo](https://expo.dev) for managing expenses, splitting bills, and tracking finances with friends and family.

## Features

- **Expense Tracking**: Add and categorize expenses
- **Bill Splitting**: Split expenses with friends and groups
- **Budget Management**: Set budgets and track spending
- **Receipt Scanning**: Scan receipts with OCR technology
- **Offline Support**: Work offline with automatic sync
- **Push Notifications**: Get reminders and alerts
- **Biometric Authentication**: Secure login with fingerprint/face ID
- **Payment Integration**: Stripe and PayPal support
- **Premium Features**: Advanced analytics and unlimited storage

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Native Mobile Features

- **Offline Support**: Track expenses offline with automatic sync
- **Push Notifications**: Expense reminders and budget alerts
- **Biometric Authentication**: Fingerprint/Face ID login
- **Camera Integration**: Receipt scanning with OCR
- **Location Services**: Auto-tag expenses with location
- **Share Functionality**: Share expenses via messaging apps
- **Payment Gateway**: Stripe and PayPal integration

## CI/CD Automation

This project uses **Codemagic** for automated builds and deployments.

### Quick Build Commands

```bash
# Build iOS app
npm run build:ios

# Build Android app
npm run build:android

# Build web app
npm run build:web

# Clean build artifacts
npm run build:clean

# Run tests
npm test

# Run linting
npm run lint:check
```

### Automated Workflows

- **iOS Build**: Automatic iOS app builds with TestFlight deployment
- **Android Build**: Automatic Android app builds with Google Play deployment
- **Web Build**: Automatic web app builds with Firebase hosting
- **Quality Checks**: Automated testing and linting

For detailed setup instructions, see [CODEMAGIC_SETUP.md](./CODEMAGIC_SETUP.md).

## App Branding

**Note**: The app currently uses default Expo icons. To complete the SplitChey branding, update the following files in `assets/images/`:
- `icon.png` - Main app icon
- `adaptive-icon.png` - Android adaptive icon
- `splash-icon.png` - Splash screen icon
- `favicon.png` - Web favicon

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
