/**
 * Domain utilities for muuney.hub standalone project.
 * Hub is always the host — no hostname detection needed.
 */

/** Always true — this IS the hub */
export const isHubDomain = () => true;

/** Hub prefix — always empty since hub routes are at root */
export const useHubPrefix = () => "";

/** Get main site URL */
export const getMainSiteUrl = (path = "/") =>
  `https://muuney.com.br${path}`;

/** Get hub URL (self) */
export const getHubUrl = (path = "/") =>
  `https://hub.muuney.com.br${path}`;
