import { describe, expect, it } from "vitest";
import { isHttpsRequest, isLocalHostname, isRemoteRequest } from "./auth";

describe("isLocalHostname", () => {
  it("accepts this computer and the home network", () => {
    for (const h of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "192.168.1.23:3000", "10.0.0.5", "172.20.1.1", "my-mac.local:3000"]) {
      expect(isLocalHostname(h)).toBe(true);
    }
  });
  it("rejects internet hostnames", () => {
    for (const h of ["abc-def.trycloudflare.com", "example.com", "8.8.8.8", "172.32.0.1", "localhost.evil.com"]) {
      expect(isLocalHostname(h)).toBe(false);
    }
  });
});

describe("isRemoteRequest", () => {
  it("treats tunnel traffic as remote even if Host is localhost", () => {
    expect(isRemoteRequest(new Headers({ host: "localhost:3000" }))).toBe(false);
    expect(isRemoteRequest(new Headers({ host: "localhost:3000", "cf-ray": "abc" }))).toBe(true);
    expect(isRemoteRequest(new Headers({ host: "x.trycloudflare.com" }))).toBe(true);
    // 外部の Host を X-Forwarded-Host で隠そうとしても外部とみなす
    expect(isRemoteRequest(new Headers({ host: "x.trycloudflare.com", "x-forwarded-host": "localhost" }))).toBe(true);
  });
});

describe("isHttpsRequest", () => {
  it("detects https directly or through a proxy", () => {
    expect(isHttpsRequest("http://localhost:3000/api", new Headers())).toBe(false);
    expect(isHttpsRequest("http://localhost:3000/api", new Headers({ "x-forwarded-proto": "https" }))).toBe(true);
    expect(isHttpsRequest("https://example.com/api", new Headers())).toBe(true);
  });
});
