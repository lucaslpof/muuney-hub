import { Helmet } from "react-helmet-async";

const BASE_URL = "https://hub.muuney.com.br";
const OG_IMAGE = "https://hub.muuney.com.br/og/default.png";

const DEFAULT_KEYWORDS = "inteligência de mercado, dados BACEN, dados CVM, panorama macroeconômico, crédito Brasil, Selic, IPCA, PTAX, fintech B2B, análise financeira";

interface HubSEOProps {
  title: string;
  description: string;
  path?: string;
  keywords?: string;
  type?: "website" | "article";
  image?: string;
  isProtected?: boolean;
}

/**
 * Reusable SEO Helmet for Hub pages.
 * Renders title, description, keywords, canonical URL, OG tags, Twitter tags, and JSON-LD.
 * Adds noindex for authenticated-only pages to prevent indexing login walls.
 */
export const HubSEO = ({
  title,
  description,
  path,
  keywords = DEFAULT_KEYWORDS,
  type = "website",
  image = OG_IMAGE,
  isProtected = true,
}: HubSEOProps) => {
  const fullTitle = `${title} | muuney.hub`;
  const canonicalUrl = path ? `${BASE_URL}${path}` : BASE_URL;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Robots meta for authenticated pages */}
      {isProtected && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:site_name" content="muuney.hub" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": type === "article" ? "Article" : "WebPage",
          "name": fullTitle,
          "description": description,
          "url": canonicalUrl,
          "image": image,
          "isPartOf": {
            "@type": "WebApplication",
            "name": "muuney.hub",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
          },
        })}
      </script>
    </Helmet>
  );
};
