import { create } from 'zustand';
import type { AppId } from './AppViews';

/** What the Apps pane is showing: a tile app, My Profile, or the grid. */
export type OpenableApp = AppId | 'profile';

type State = {
  open: OpenableApp | undefined;
  setOpen: (open: OpenableApp | undefined) => void;
};

/** Shared so the avatar / sidebar can open My Profile inside Apps (same pane as Music). */
export const useOpenApp = create<State>((set) => ({
  open: undefined,
  setOpen: (open) => set({ open }),
}));

/** Jump to Apps and show My Profile in the apps pane (not a separate tab). */
export function openMyProfile(router: { navigate: (href: '/apps') => void }) {
  useOpenApp.getState().setOpen('profile');
  router.navigate('/apps');
}
