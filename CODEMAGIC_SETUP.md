# 🚀 SplitChey - Codemagic CI/CD Setup

This guide explains how to set up automated builds for SplitChey using Codemagic.

## 📋 Prerequisites

### 1. Codemagic Account
- Sign up at [codemagic.io](https://codemagic.io)
- Connect your GitHub/GitLab repository

### 2. Apple Developer Account (for iOS)
- Apple Developer Program membership
- App Store Connect access
- Certificates and provisioning profiles

### 3. Google Play Console (for Android)
- Google Play Console account
- App signing key
- Service account for API access

### 4. Firebase Project (for distribution)
- Firebase project setup
- Service account credentials

## 🔧 Setup Instructions

### Step 1: Repository Setup

1. **Push the configuration files:**
   ```bash
   git add codemagic.yaml
   git add exportOptions.plist
   git add scripts/build.sh
   git commit -m "Add Codemagic CI/CD configuration"
   git push origin main
   ```

### Step 2: Codemagic Project Setup

1. **Create a new project in Codemagic:**
   - Go to [codemagic.io](https://codemagic.io)
   - Click "Add application"
   - Select your repository
   - Choose "React Native" as the project type

2. **Configure the project:**
   - Set the project name to "SplitChey"
   - Select the main branch
   - Enable the workflows you need (iOS, Android, Web)

### Step 3: Environment Variables

#### iOS Variables
Add these environment variables in Codemagic:

```
CM_CERTIFICATE_PASSWORD=your_certificate_password
CM_KEYCHAIN_PASSWORD=your_keychain_password
CM_APP_STORE_CONNECT_ISSUER_ID=your_issuer_id
CM_APP_STORE_CONNECT_API_KEY_ID=your_api_key_id
CM_APP_STORE_CONNECT_API_KEY=your_api_key
CM_DEVELOPMENT_TEAM=your_team_id
CM_PROVISIONING_PROFILE_SPECIFIER=your_profile_name
CM_CERTIFICATE_PATH=/path/to/certificate.p12
CM_PROVISIONING_PROFILE_PATH=/path/to/profile.mobileprovision
```

#### Android Variables
```
CM_KEYSTORE_PATH=base64_encoded_keystore
CM_STORE_PASSWORD=your_keystore_password
CM_KEY_ALIAS=your_key_alias
CM_KEY_PASSWORD=your_key_password
```

#### Firebase Variables
```
CM_FIREBASE_SERVICE_ACCOUNT=base64_encoded_service_account.json
CM_FIREBASE_APP_ID=your_firebase_app_id
```

### Step 4: Code Signing Setup

#### iOS Code Signing
1. **Export your certificates:**
   ```bash
   # Export certificate
   openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt
   
   # Export provisioning profile
   # Download from Apple Developer Portal
   ```

2. **Upload to Codemagic:**
   - Go to your project settings
   - Navigate to "Code signing"
   - Upload your certificate and provisioning profile

#### Android Code Signing
1. **Generate keystore:**
   ```bash
   keytool -genkey -v -keystore splitchey.keystore -alias splitchey -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Upload to Codemagic:**
   - Go to your project settings
   - Navigate to "Code signing"
   - Upload your keystore file

### Step 5: Publishing Configuration

#### App Store Connect
1. **Generate API Key:**
   - Go to App Store Connect
   - Navigate to "Users and Access"
   - Create a new API key
   - Note the Key ID and Issuer ID

2. **Add to Codemagic:**
   - Add the API key as an environment variable
   - Configure the publishing section in `codemagic.yaml`

#### Google Play Console
1. **Create Service Account:**
   - Go to Google Play Console
   - Navigate to "Setup" > "API access"
   - Create a new service account
   - Download the JSON key file

2. **Add to Codemagic:**
   - Add the service account JSON as an environment variable
   - Configure the publishing section in `codemagic.yaml`

#### Firebase App Distribution
1. **Setup Firebase:**
   - Go to Firebase Console
   - Navigate to "App Distribution"
   - Create a new app
   - Note the App ID

2. **Add to Codemagic:**
   - Add the Firebase service account as an environment variable
   - Configure the publishing section in `codemagic.yaml`

## 🔄 Workflow Triggers

### Automatic Triggers
- **Push to main**: Triggers all workflows
- **Pull request**: Triggers test workflows
- **Tag creation**: Triggers release workflows

### Manual Triggers
- **iOS Build**: Manual iOS app build
- **Android Build**: Manual Android app build
- **Web Build**: Manual web app build

## 📱 Build Artifacts

### iOS
- **IPA file**: Ready for App Store submission
- **TestFlight**: Automatic upload to TestFlight
- **Build logs**: Available for debugging

### Android
- **APK file**: Ready for Google Play submission
- **AAB file**: App bundle for Play Store
- **Mapping file**: For crash reporting

### Web
- **Static files**: Ready for deployment
- **Firebase hosting**: Automatic deployment

## 🔔 Notifications

### Email Notifications
- Build start notifications
- Build success/failure notifications
- Release notifications

### Slack Notifications
- Channel: `#builds`
- Real-time build status
- Release announcements

## 🛠️ Local Development

### Build Scripts
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

### Manual Build Commands
```bash
# iOS
npx expo build:ios --non-interactive

# Android
npx expo build:android --non-interactive

# Web
npx expo build:web
```

## 🔍 Troubleshooting

### Common Issues

#### iOS Build Failures
1. **Code signing issues:**
   - Verify certificate and provisioning profile
   - Check team ID and bundle identifier
   - Ensure certificates are not expired

2. **Xcode version issues:**
   - Update Xcode version in Codemagic
   - Check compatibility with Expo SDK

#### Android Build Failures
1. **Keystore issues:**
   - Verify keystore file and passwords
   - Check key alias and passwords
   - Ensure keystore is properly encoded

2. **Gradle issues:**
   - Check Android SDK version
   - Verify build tools version
   - Check for dependency conflicts

#### Web Build Failures
1. **Node.js version issues:**
   - Update Node.js version in Codemagic
   - Check npm package compatibility

2. **Build optimization issues:**
   - Check for large dependencies
   - Optimize bundle size
   - Verify static file generation

### Debug Commands
```bash
# Check Expo CLI version
npx expo --version

# Check Node.js version
node --version

# Check npm version
npm --version

# List installed packages
npm list --depth=0
```

## 📈 Monitoring

### Build Metrics
- Build duration
- Success rate
- Failure analysis
- Performance metrics

### Quality Gates
- Code coverage
- Linting results
- Security scans
- Performance tests

## 🔐 Security

### Secrets Management
- All sensitive data stored as environment variables
- Encrypted at rest
- Rotated regularly
- Access controlled

### Best Practices
- Never commit secrets to repository
- Use different keys for different environments
- Regular security audits
- Monitor for unauthorized access

## 📞 Support

### Codemagic Support
- [Documentation](https://docs.codemagic.io)
- [Community Forum](https://community.codemagic.io)
- [Email Support](mailto:support@codemagic.io)

### SplitChey Team
- Technical issues: tech@splitchey.com
- Build issues: builds@splitchey.com
- Security issues: security@splitchey.com

---

**Last updated**: $(date)
**Version**: 1.0.0 