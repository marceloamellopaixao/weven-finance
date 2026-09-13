import assert from "node:assert/strict";
import test from "node:test";

import { getPlatformTourConfig, PLATFORM_TOUR_ROUTE_HREFS } from "@/lib/platform-tour/config";
import { ALL_PLATFORM_TOUR_ROUTES } from "@/types/navigation";

test("platform tour route links follow the configured onboarding order", () => {
  const config = getPlatformTourConfig(() => undefined);
  ALL_PLATFORM_TOUR_ROUTES.forEach((route, index) => {
    const next = ALL_PLATFORM_TOUR_ROUTES[index + 1] || null;
    assert.equal(config[route].nextRoute, next);
    assert.equal(config[route].nextHref, next ? PLATFORM_TOUR_ROUTE_HREFS[next].replace("&tour=1", "").replace("?tour=1", "") : null);
  });
});
