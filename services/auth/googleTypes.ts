/** Shared by google.ts and google.web.ts (a file cannot import './google' on web: that resolves to itself). */
export type GoogleResult = { idToken: string; name?: string };

/** Thrown when the person closes the Google window. Not an error to show. */
export class GoogleCancelled extends Error {
  constructor() {
    super('Google sign-in was cancelled');
    this.name = 'GoogleCancelled';
  }
}
