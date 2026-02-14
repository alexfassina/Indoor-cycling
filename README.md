# Indoor Cycling 🚴

A simple Android app for indoor cycling workouts with BLE power and cadence sensors.

## Features

- **Bluetooth LE** connection to power meters (Stages, etc.)
- **Real-time metrics**: Power (W), Cadence (RPM)
- **Session tracking**: Duration, average power, max power
- **Local storage**: Sessions saved on device
- **PWA**: Works offline after install

## Requirements

- Android 8.0+ (API 26+)
- BLE-capable device (smartphone/tablet)
- Compatible power/cadence sensor (Cycling Power Service 0x1818)

## Installation

### Option 1: Download APK
- Go to [Releases](https://github.com/alexfassina/Indoor-cycling/releases)
- Download the latest `indoor-cycling-debug.apk`
- Install on your device (enable "Install from unknown sources")

### Option 2: Obtainium (Recommended)
- Install [Obtainium](https://github.com/ImranR98/Obtainium) from F-Droid/Play Store
- Add this repo URL: `https://github.com/alexfassina/Indoor-cycling`
- Auto-updates enabled!

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Build Android APK
npx cap sync android
npx cap open android
```

## Tech Stack

- Vanilla JavaScript (no framework)
- Vite (build tool)
- Capacitor (Android wrapper)
- Web Bluetooth API

## License

MIT
