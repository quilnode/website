export default {
  fetch(request, env) {
    // Serve built HTML pages directly; preserve real 404s without an SPA fallback.
    return env.ASSETS.fetch(request);
  },
};
