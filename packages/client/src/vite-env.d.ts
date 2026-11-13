interface ImportMetaEnv {
  /** Game server address; set for packaged apps (.env.app). */
  readonly VITE_SERVER_URL?: string;
  /** Public website address used for invite links in packaged apps. */
  readonly VITE_PUBLIC_URL?: string;
}
