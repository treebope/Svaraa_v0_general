import { Linking } from 'react-native';

/** The emergency services number (India). A drill never dials it. */
export const EMERGENCY_NUMBER = '112';

export const telUrl = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`;

/**
 * Opens the phone's dialer with the number filled in. The app cannot place a call by itself: iPhone always asks the
 * person to tap Call, and once the dialer opens we cannot tell whether the call was answered. Returns false if the
 * device could not open it (no phone app, e.g. a desktop browser).
 */
export async function dial(number: string): Promise<boolean> {
  try {
    await Linking.openURL(telUrl(number));
    return true;
  } catch {
    return false;
  }
}
