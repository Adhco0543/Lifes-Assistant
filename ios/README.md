# Life’s Assistant native room scanning

This iOS companion wraps the existing Life’s Assistant workspace in `WKWebView` and adds a native **Scan room** action. On supported LiDAR-equipped iPhone and iPad devices, Apple RoomPlan guides the scan, estimates room length, width, and ceiling height, and recognizes fixtures and furniture. The scan is sent to the open Spatial Workspace, where dimensions and detected items can be reviewed, removed, supplemented, and saved.

## Run the draft on a LiDAR device

1. Open `LifesAssistant.xcodeproj` on a Mac with Xcode 16 or newer.
2. In the app target’s **Signing & Capabilities**, select the Apple Developer team used for device installation.
3. Run the app on a LiDAR-equipped iPhone or iPad. The Simulator can build and open the workspace, but it cannot perform a real RoomPlan capture.
4. Paste the current Life’s Assistant preview URL into the connection screen. For a protected Vercel preview, paste its full share link. Sign in to the app, then open **Spatial Workspace**.
5. Tap **Scan room**, move slowly so the camera sees each wall and corner, then tap **Finish scan**. Dimensions and detected items are imported automatically.
6. Remove a detected item from the room list or tap an open part of the measured plan to add an item. Tap **Save workspace** to persist the result.

The preview URL is saved in the app’s local device settings only. A Vercel share link is temporary and should not be committed into the project.

## Review limitations

- RoomPlan requires a supported LiDAR device and permission to use its camera. On unsupported devices, the web workspace’s tape-measure and WebXR point-measurement fallbacks remain available.
- RoomPlan dimensions and detected object bounds are estimates. Verify critical sizes on site before quoting or ordering materials.
- The iOS project is unsigned. Xcode signing with the owner’s Apple team is needed to install it on a phone or distribute it through TestFlight.
- Room capture cannot be exercised in this Linux workspace. The GitHub macOS workflow compiles the iOS Simulator target; a LiDAR-device scan remains a manual check.
