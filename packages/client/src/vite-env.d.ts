interface ImportMetaEnv {
  /** Game server address; set for the itch.io build (.env.itch). */
  readonly VITE_SERVER_URL?: string;
  /** Public website address used for invite links in the itch.io build. */
  readonly VITE_PUBLIC_URL?: string;
}
