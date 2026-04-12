import { Helmet } from "react-helmet-async";

const BASE_URL = "https://muuney.app";
const OG_IMAGE = "https://muuney.com.br/og-image-hub.png";

interface HubSEOProps {
  title: string;
  description: string;
  path?: string;
}

/**
 * Reusable SEO Helmet for Hub pages.
 * Renders title, description, OG, and Twitter tags.
 */
export const HubSEO = ({ title, description, path }: HubSEOProps) => {
  const fullTitle = `${title} | muuney.hub`;
  const url = path ? `${BASE_URL}${path}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={OG_IMAGE} />
      {url && <meta property="og:url" content={url} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
    </Helmet>
  );
};
