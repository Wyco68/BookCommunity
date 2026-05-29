import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  motionEnabled: boolean;
  soundEnabled: boolean;
  setMotionEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      motionEnabled: true,
      soundEnabled: false, // Default muted for safety
      setMotionEnabled: (enabled) => set({ motionEnabled: enabled }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
    }),
    {
      name: 'bookcom-settings',
    }
  )
);
