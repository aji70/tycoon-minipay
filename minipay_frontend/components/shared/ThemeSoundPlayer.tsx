'use client';

import { useEffect, useRef } from 'react';
import useSound from 'use-sound';

type ThemeSoundPlayerProps = {
  playing: boolean;
};

/**
 * Mount only after the user enables theme audio so /sound/monopoly-theme.mp3
 * is not fetched on initial load.
 *
 * Performance: defers audio fetch until playing=true (user interaction trigger).
 * This prevents unnecessary 1.3MB download on page load.
 */
export default function ThemeSoundPlayer({ playing }: ThemeSoundPlayerProps) {
  const hasInitialized = useRef(false);

  // Only initialize sound when playing is true (user has clicked sound button)
  // This defers the 1.3MB fetch until necessary
  const [play, { pause }] = useSound('/sound/monopoly-theme.mp3', {
    volume: 0.5,
    loop: true,
    // Lazy load: only preload audio when component mounts (user already clicked)
    onload: () => {
      hasInitialized.current = true;
    },
  });

  useEffect(() => {
    if (playing && hasInitialized.current) {
      void play();
    } else {
      pause();
    }
  }, [playing, play, pause]);

  return null;
}
