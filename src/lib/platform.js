/** Browser hints are advisory. Safari's “Intel Mac OS X” also describes Apple silicon. */
export function classifyPlatform({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
  architecture = "",
} = {}) {
  const hints = `${platform} ${userAgent}`;
  if (/android/i.test(hints))
    return { os: "Android", architecture: "unknown", supported: false };
  if (/iphone|ipod/i.test(hints))
    return { os: "iOS", architecture: "unknown", supported: false };
  if (/ipad/i.test(hints) || (/mac/i.test(hints) && maxTouchPoints > 1)) {
    return { os: "iPadOS", architecture: "unknown", supported: false };
  }
  if (/win/i.test(hints))
    return { os: "Windows", architecture: "unknown", supported: false };
  if (/cros/i.test(hints))
    return { os: "ChromeOS", architecture: "unknown", supported: false };
  if (/linux/i.test(hints))
    return { os: "Linux", architecture: "unknown", supported: false };
  if (/mac/i.test(hints)) {
    const arch = /^(arm|arm64|aarch64)$/i.test(architecture)
      ? "arm64"
      : /^(x86|x86_64|x64)$/i.test(architecture)
        ? "intel"
        : "unknown";
    return { os: "macOS", architecture: arch, supported: arch !== "intel" };
  }
  return { os: "unknown", architecture: "unknown", supported: null };
}

export function readPlatform(navigatorLike) {
  return classifyPlatform({
    userAgent: navigatorLike.userAgent,
    platform: navigatorLike.userAgentData?.platform || navigatorLike.platform,
    maxTouchPoints: navigatorLike.maxTouchPoints,
  });
}

/** Optional architecture hints stay in memory and are never sent to a service. */
export async function detectPlatform(navigatorLike, timeoutMs = 800) {
  const initial = readPlatform(navigatorLike);
  if (
    initial.os !== "macOS" ||
    !navigatorLike.userAgentData?.getHighEntropyValues
  )
    return initial;
  let timer;
  try {
    const hints = await Promise.race([
      navigatorLike.userAgentData.getHighEntropyValues(["architecture"]),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({}), timeoutMs);
      }),
    ]);
    return classifyPlatform({
      userAgent: navigatorLike.userAgent,
      platform: navigatorLike.userAgentData.platform || navigatorLike.platform,
      maxTouchPoints: navigatorLike.maxTouchPoints,
      architecture: hints?.architecture,
    });
  } catch {
    return initial;
  } finally {
    clearTimeout(timer);
  }
}
