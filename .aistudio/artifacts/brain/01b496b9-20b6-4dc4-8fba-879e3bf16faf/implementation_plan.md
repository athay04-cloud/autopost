# Implementation Plan - Headless & Stealth Chrome Extension for Facebook Auto-Posting

## Proposed Changes

### 1. Chrome Extension Architecture & Stealth Engine (`src/utils/extensionPackage.ts`)
- **Manifest V3 Update**: Version bumped to `1.0.6` with description highlighting Headless & Stealth mode.
- **Minimized Off-screen Popup Window (`executeSingleFacebookGroupPost`)**:
  - Uses `chrome.windows.create` with `state: "minimized"`, `focused: false`, `type: "popup"`, and off-screen coordinates (`left: -25000`, `top: -25000`).
  - Ensures zero visual interruption or new tabs in the active user window.
  - Automatically cleans up and destroys the stealth window (`chrome.windows.remove`) after posting completes or fails.
- **DOM Automation (`executeFacebookPostAutomation`)**:
  - Robust handling of group rules modals, composer pills, and Lexical text editor insertion without duplicating text or touching comments.
- **Standalone Node.js CLI Script (`headless-poster.js`)**:
  - Included inside `EXTENSION_FILES` as a template for users who wish to run Node.js + Puppeteer automation from terminal without keeping the browser open.

### 2. UI & Documentation Integration (`src/components/AccountConnectionModal.tsx`)
- Updated setup instructions and download modals explaining the new Headless / Chromeless Stealth posting feature.

## Verification Plan

### Automated Tests
- Run `compile_applet` to verify TypeScript compilation and build success.
- Run `lint_applet` to check for any lint errors or missing imports.

### Manual Verification
- Review the downloaded extension package structure and test the account connection modal UI.
