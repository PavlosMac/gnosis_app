export const isRegistrationEnabled = (): boolean =>
  process.env.REGISTRATION_ENABLED === "true";
