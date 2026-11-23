import type { Href } from 'expo-router';

type BackRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
};

/** Go back when the stack allows it; otherwise land on `fallback` so GO_BACK never fires empty. */
export function safeBack(router: BackRouter, fallback: Href = '/home') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
