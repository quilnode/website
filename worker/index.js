export default {
  fetch(request, env) {
    // This is a single static page, not a client-side router. Preserve real 404s.
    return env.ASSETS.fetch(request);
  },
};
