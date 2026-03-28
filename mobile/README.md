# NEXUS Go (Flutter Mobile)

Lightweight mobile client for NEXUS-X — task management, review/approval, and team chat on the go.

## Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) >= 3.2
- Xcode (for iOS) / Android Studio (for Android)

## Setup

```bash
cd mobile

# Get dependencies
flutter pub get

# Run on connected device or simulator
flutter run
```

## Project Structure

```
mobile/
├── lib/
│   ├── main.dart                  # App entry, theme, bottom nav shell
│   ├── screens/
│   │   ├── task_list_screen.dart   # Production task list
│   │   └── review_screen.dart      # Version review & approval
│   └── services/
│       └── api_service.dart        # HTTP client for NEXUS-X API
├── pubspec.yaml
└── README.md
```

## Configuration

The API base URL defaults to `http://localhost:8901/api`. Update `ApiService` with your production URL or use environment configuration.

## Screens

| Tab     | Description                       |
| ------- | --------------------------------- |
| Tasks   | View and manage assigned tasks    |
| Review  | Playlist-based version review     |
| Chat    | Team messaging (placeholder)      |
| Profile | User settings (placeholder)       |
