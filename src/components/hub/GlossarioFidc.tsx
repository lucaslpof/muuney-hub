/**
 * GlossarioFidc.tsx — V5-D7 (24/04/2026)
 *
 * Collapsible glossary card covering the FIDC vocabulary AAIs need to
 * decode a lâmina. Lives in FidcHub (Visão Geral footer) and FidcLamina
 * (after composition section) so jargão is always one click away.
 *
 * Stack: Tech-Noir card, accent #F97316, native <details>/<summary> (zero
 * animation library cost, full a11y inheritance — ESC closes, tab-nav works,
 * screen-readers announce state). 13 terms in 2-column grid on desktop,
 * single column on mobile.
 *
 * CVM glossary grounded in RCVM 175 + FIDC Informe Mensal schema.
 */

import { BookOpenText } from "lucide-react";

export interface GlossarioFidcProps {
  /** Tech-Noir accent color — defaults to FIDC orange. */
  accent?: string;
  /** Whether the <details> is open by default. */
  defaultOpen?: boolean;
  /** Extra className for layout tweaks. */
  className?: string;
}

interface Term {
  term: string;
  definition: string;
}

const TERMS: Term[] = [
  {
    term: "Subordinação",
    definition:
      "Relação (%) entre cota subordinada e PL total. Funciona como colchão de perda — perdas da carteira são absorvidas pela cota subordinada antes de atingir a sênior. Subordinação baixa (<10%) sinaliza cushion reduzido.",
  },
  {
    term: "PDD — Provisão p/ Devedores Duvidosos",
    definition:
      "Reserva contábil que o fundo constitui para cobrir perdas esperadas na carteira de direitos creditórios. Calculada conforme metodologia prevista no regulamento (histórica, rating, vintage).",
  },
  {
    term: "Índice de Cobertura PDD",
    definition:
      "Razão PDD ÷ Carteira Inadimplente. Valor ≥100% indica que o fundo já provisionou todas as perdas esperadas do estoque vencido; <100% sinaliza sub-provisão.",
  },
  {
    term: "Cedentes",
    definition:
      "Pessoas ou empresas originadoras que vendem direitos creditórios ao FIDC. Quanto maior o número de cedentes, melhor a pulverização. Concentração em um único cedente é risco material.",
  },
  {
    term: "Concentração por Cedente",
    definition:
      "% do PL originado pelo maior cedente. Limites regulatórios tipicamente 20% (multicedente) ou flexibilizados para mono-cedente qualificado com garantias adicionais.",
  },
  {
    term: "Cota Sênior",
    definition:
      "Cota com preferência na distribuição de rendimentos e amortização. Remunera à taxa benchmark (CDI+x%). Menor retorno, menor risco. Amortizada antes das cotas subordinada e mezanino.",
  },
  {
    term: "Cota Mezanino",
    definition:
      "Cota intermediária entre sênior e subordinada. Remuneração superior à sênior, com absorção de perdas antes da sênior mas depois da subordinada. Presente em estruturas mais complexas.",
  },
  {
    term: "Cota Subordinada",
    definition:
      "Última cota a receber amortização. Absorve primeiras perdas da carteira. Retorno residual (após juros das demais classes). Tipicamente detida pelo cedente (skin in the game).",
  },
  {
    term: "Carteira a Vencer",
    definition:
      "Saldo de direitos creditórios ainda no prazo contratual de pagamento. Indicador de qualidade do fluxo futuro do fundo.",
  },
  {
    term: "Carteira Inadimplente",
    definition:
      "Saldo de direitos creditórios vencidos e não pagos. Compõe o numerador da Taxa de Inadimplência do fundo. Deve ser coberta por PDD conforme regulamento.",
  },
  {
    term: "Taxa de Inadimplência",
    definition:
      "Carteira Inadimplente ÷ Carteira Total. Acima de 5% merece atenção; acima de 10% tipicamente implica PDD relevante e pressão sobre rentabilidade da sênior.",
  },
  {
    term: "Lastro (Tipo Principal)",
    definition:
      "Natureza econômica dos direitos creditórios que compõem a carteira — comercial, cartão, judicial, imobiliário, consignado, trabalhista, agronegócio, etc. Define perfil de risco e prazo.",
  },
  {
    term: "Benchmark",
    definition:
      "Indexador de referência da remuneração alvo da cota sênior (CDI, IPCA, IGP-M, SELIC). Spread positivo vs benchmark sinaliza alpha; negativo alerta sobre descolamento de mercado.",
  },
];

export function GlossarioFidc({
  accent = "#F97316",
  defaultOpen = false,
  className = "",
}: GlossarioFidcProps) {
  return (
    <details
      className={`group bg-[#111111] border rounded-lg ${className}`}
      style={{ borderColor: `${accent}33` }}
      open={defaultOpen}
    >
      <summary
        className="cursor-pointer list-none select-none flex items-center gap-2 p-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F97316]/50 rounded-lg"
        aria-label="Alternar glossário FIDC"
      >
        <BookOpenText className="w-3.5 h-3.5" style={{ color: accent }} aria-hidden="true" />
        <span
          className="text-[9px] font-mono uppercase tracking-wider"
          style={{ color: accent }}
        >
          Glossário FIDC
        </span>
        <span className="text-zinc-700 text-[9px]">·</span>
        <span className="text-[10px] font-mono text-zinc-500">
          Subordinação · PDD · Cedentes · Cotas sênior/mezanino/subord
        </span>
        <span
          className="ml-auto text-[9px] font-mono text-zinc-600 group-open:hidden"
          aria-hidden="true"
        >
          + expandir
        </span>
        <span
          className="ml-auto text-[9px] font-mono text-zinc-600 hidden group-open:inline"
          aria-hidden="true"
        >
          − recolher
        </span>
      </summary>

      <div className="px-4 pb-4 pt-1 border-t border-[#1a1a1a]">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3 mt-3">
          {TERMS.map((t) => (
            <div key={t.term}>
              <dt className="text-[11px] font-semibold text-zinc-200 mb-0.5">
                {t.term}
              </dt>
              <dd className="text-[11px] leading-relaxed text-zinc-400">
                {t.definition}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

export default GlossarioFidc;
