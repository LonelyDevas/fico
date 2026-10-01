export type AccessToken = {
_id: string,
username: string,
email: string,
status: string,
provider: string,
  firstName?: string;
  lastName?: string;
  /** Chosen profile picture. Empty string means the user removed it on purpose. */
  avatarUrl?: string;
  /** Photo from the Google account, when signed in with Google. */
  googleAvatarUrl?: string;
  exp: number;
  iat: number;
};
