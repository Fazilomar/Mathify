#!/usr/bin/env python3
"""Add the Mathify OAuth callback intent filter to a generated Capacitor app."""

from pathlib import Path


MANIFEST = Path('frontend/android/app/src/main/AndroidManifest.xml')
MARKER = '<!-- Mathify OAuth deep link -->'
FILTER = f'''        {MARKER}
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="mathify" android:host="oauth" android:path="/callback" />
        </intent-filter>'''


def main():
    if not MANIFEST.exists():
        raise SystemExit(f'Missing generated manifest: {MANIFEST}')
    content = MANIFEST.read_text()
    if MARKER in content:
        return
    activity_end = content.find('</activity>')
    if activity_end < 0:
        raise SystemExit('Could not find the Capacitor activity in AndroidManifest.xml')
    content = content[:activity_end] + FILTER + '\n' + content[activity_end:]
    MANIFEST.write_text(content)


if __name__ == '__main__':
    main()