const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;
console.log(
  "[DEBUG auth.config] CLERK_JWT_ISSUER_DOMAIN:",
  domain ?? "UNDEFINED",
);

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
};
