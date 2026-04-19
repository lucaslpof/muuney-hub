/**
 * PrintFooter.tsx — P1-1 (19/04/2026)
 *
 * Renders a footer that appears *only* in the printed output (class
 * `print-only`, hidden during normal app rendering via index.css). Shows
 * provenance: fund name, data-as-of date, source (BACEN/CVM), generation
 * timestamp + disclaimer. Keeps AAIs compliant when forwarding to clients.
 */

interface Props {
  /** Fund name to echo in the footer (e.g., "FIDC Alpha Senior"). */
  fundName?: string | null;
  /** "Dados de <YYYY-MM-DD>" — data freshness stamp. */
  dataAsOf?: string | null;
  /** Source label (e.g., "CVM Informe FIDC", "BACEN SGS"). */
  source?: string;
}

function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

export function PrintFooter({ fundName, dataAsOf, source }: Props) {
  const now = new Date();
  const generatedAt = now.toLocaleString("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="print-only print-footer" aria-hidden="true">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          fontSize: "9pt",
          color: "#3f3f46",
          borderTop: "1px solid #d4d4d8",
          paddingTop: "8px",
          marginTop: "18pt",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        <div style={{ maxWidth: "62%" }}>
          <div style={{ fontWeight: 600, color: "#0a0a0a" }}>
            {fundName || "Lâmina de fundo"}
          </div>
          <div style={{ marginTop: "2px" }}>
            Dados: {fmtDateBR(dataAsOf)}
            {source ? ` · Fonte: ${source}` : ""}
          </div>
          <div style={{ marginTop: "4px", fontSize: "8pt", color: "#71717a" }}>
            Informações para uso profissional. Não constituem recomendação de
            investimento. Verifique o regulamento do fundo e a adequação ao
            perfil do investidor.
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontWeight: 600, color: "#0B6C3E" }}>muuney.hub</div>
          <div>Gerado em {generatedAt}</div>
          <div style={{ fontSize: "8pt", color: "#71717a" }}>
            hub.muuney.com.br
          </div>
        </div>
      </div>
    </div>
  );
}
