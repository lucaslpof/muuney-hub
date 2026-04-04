import { describe, it, expect } from "vitest";
import { isHubDomain, useHubPrefix, getMainSiteUrl, getHubUrl } from "../domain";

describe("domain utilities", () => {
  it("isHubDomain always returns true (standalone hub)", () => {
    expect(isHubDomain()).toBe(true);
  });

  it("useHubPrefix returns empty string (routes at root)", () => {
    expect(useHubPrefix()).toBe("");
  });

  it("getMainSiteUrl returns muuney.com.br paths", () => {
    expect(getMainSiteUrl("/")).toBe("https://muuney.com.br/");
    expect(getMainSiteUrl("/blog")).toBe("https://muuney.com.br/blog");
  });

  it("getHubUrl returns hub.muuney.com.br paths", () => {
    expect(getHubUrl("/")).toBe("https://hub.muuney.com.br/");
    expect(getHubUrl("/macro")).toBe("https://hub.muuney.com.br/macro");
  });

  it("getMainSiteUrl defaults to /", () => {
    expect(getMainSiteUrl()).toBe("https://muuney.com.br/");
  });
});
