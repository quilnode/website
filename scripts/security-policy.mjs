export const contentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self' https://api.github.com",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

export function productionSecurity() {
  return {
    name: "quilnode-security-policy",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: contentSecurityPolicy,
          },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}
