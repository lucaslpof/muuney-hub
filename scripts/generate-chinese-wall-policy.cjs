// Chinese Wall Policy — Muuney ↔ LPA Wealth
// Formal document generator (CVM Res. 19/2021 compliance + RCVM 175 + LGPD)

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, TabStopType, TabStopPosition,
} = require("docx");

const GREEN = "0B6C3E";
const DARK = "0A0A0A";

const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

// ---------- helpers ----------
const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, bold: true, font: "Arial", size: 30, color: GREEN })],
  spacing: { before: 360, after: 180 },
});

const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, bold: true, font: "Arial", size: 26, color: DARK })],
  spacing: { before: 240, after: 120 },
});

const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text, bold: true, font: "Arial", size: 22, color: DARK })],
  spacing: { before: 180, after: 100 },
});

const P = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, font: "Arial", size: 22, ...opts })],
  spacing: { after: 120, line: 300 },
  alignment: AlignmentType.JUSTIFIED,
});

const Bold = (text) => new TextRun({ text, bold: true, font: "Arial", size: 22 });
const Plain = (text) => new TextRun({ text, font: "Arial", size: 22 });

const Bullet = (runs) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: runs,
  spacing: { after: 80, line: 280 },
  alignment: AlignmentType.JUSTIFIED,
});

const Numbered = (runs) => new Paragraph({
  numbering: { reference: "numbered", level: 0 },
  children: runs,
  spacing: { after: 80, line: 280 },
  alignment: AlignmentType.JUSTIFIED,
});

const cell = (text, { bold = false, fill, width = 4680 } = {}) => new TableCell({
  borders,
  width: { size: width, type: WidthType.DXA },
  shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 100, bottom: 100, left: 140, right: 140 },
  children: [new Paragraph({
    children: [new TextRun({ text, font: "Arial", size: 20, bold, color: fill === GREEN ? "FFFFFF" : DARK })],
  })],
});

// ---------- content ----------

const frontCover = [
  new Paragraph({ children: [new TextRun({ text: "MUUNEY · LPA WEALTH", font: "Arial", size: 18, color: GREEN, bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 1400, after: 360 } }),
  new Paragraph({ children: [new TextRun({ text: "POLÍTICA DE SEGREGAÇÃO DE ATIVIDADES", font: "Arial", size: 44, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 180 } }),
  new Paragraph({ children: [new TextRun({ text: "(Chinese Wall)", font: "Arial", size: 36, bold: true, color: GREEN })], alignment: AlignmentType.CENTER, spacing: { after: 720 } }),
  new Paragraph({ children: [new TextRun({ text: "Emitente: Lucas Pimentel Oliveira Freitas (Sócio-administrador)", font: "Arial", size: 22 })], alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
  new Paragraph({ children: [new TextRun({ text: "Entidades: Muuney (fintech/hub de inteligência) e LPA Wealth (consultoria patrimonial)", font: "Arial", size: 22 })], alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
  new Paragraph({ children: [new TextRun({ text: "Referências: Resolução CVM 19/2021 · Resolução CVM 179/2023 · Resolução CVM 175/2022 · LGPD (Lei 13.709/2018)", font: "Arial", size: 20, color: "555555", italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 360 } }),
  new Paragraph({ children: [new TextRun({ text: "Versão 1.0 · Vigência: 18/04/2026 · Revisão anual obrigatória", font: "Arial", size: 20, bold: true })], alignment: AlignmentType.CENTER }),
  new Paragraph({ children: [new TextRun({ text: "Classificação: INTERNO — distribuir apenas a sócios, colaboradores e prestadores vinculados", font: "Arial", size: 18, italics: true, color: "777777" })], alignment: AlignmentType.CENTER, spacing: { before: 180 } }),
];

const section1 = [
  H1("1. Objeto e finalidade"),
  P(
    "Esta Política de Segregação de Atividades (doravante “Política” ou “Chinese Wall”) tem por objeto estabelecer regras, controles e responsabilidades que assegurem a independência operacional e a integridade informacional entre as atividades conduzidas sob as marcas Muuney e LPA Wealth, bem como a proteção dos clientes contra conflitos de interesse, uso indevido de informação privilegiada e contaminação entre linhas de negócio."
  ),
  P(
    "A Política aplica-se aos sócios, administradores, empregados, estagiários, consultores e demais prestadores de serviço que tenham acesso, ainda que eventual, a informações de clientes, carteiras, roadmap de produtos, bases de dados regulatórias tratadas pela Muuney ou a qualquer sistema interno das entidades."
  ),
  H2("1.1 Referências normativas"),
  Bullet([Bold("CVM Resolução 19/2021"), Plain(" — consultoria de valores mobiliários (LPA Wealth).")]),
  Bullet([Bold("CVM Resolução 179/2023"), Plain(" — deveres fiduciários e conduta (agentes autônomos / AAIs clientes B2B da Muuney).")]),
  Bullet([Bold("CVM Resolução 175/2022"), Plain(" — fundos de investimento (base regulatória dos dados estruturados ingeridos pelo muuney.hub).")]),
  Bullet([Bold("Lei 13.709/2018 (LGPD)"), Plain(" — proteção de dados pessoais.")]),
  Bullet([Bold("Circular Bacen 3.978/2020"), Plain(" — prevenção à lavagem de dinheiro (PLD/FT), no que for aplicável à base de clientes 1P.")]),
];

const section2 = [
  H1("2. Mapa das entidades e segregação estrutural"),
  P("O ecossistema possui três entidades operacionais, organizadas conforme a seguinte matriz:"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2100, 2300, 2500, 2460],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell("Entidade", { bold: true, fill: GREEN, width: 2100 }),
          cell("Natureza", { bold: true, fill: GREEN, width: 2300 }),
          cell("Público / clientela", { bold: true, fill: GREEN, width: 2500 }),
          cell("Enquadramento regulatório", { bold: true, fill: GREEN, width: 2460 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Muuney (muuney.app)", { bold: true, width: 2100 }),
          cell("Fintech B2C — gestão financeira pessoal (PFM)", { width: 2300 }),
          cell("Pessoas físicas (Gen Z / Millennials)", { width: 2500 }),
          cell("Integração Pluggy / Open Finance; sem oferta de valor mobiliário", { width: 2460 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Muuney (muuney.hub)", { bold: true, width: 2100 }),
          cell("Plataforma B2B de inteligência de mercado para AAIs", { width: 2300 }),
          cell("Agentes autônomos de investimento e escritórios", { width: 2500 }),
          cell("Consome somente dados regulatórios públicos (BACEN SGS, CVM CDA/FIDC/FII/FIP, 160/400/476). SEM Pluggy.", { width: 2460 }),
        ],
      }),
      new TableRow({
        children: [
          cell("LPA Wealth", { bold: true, width: 2100 }),
          cell("Consultoria patrimonial e de valores mobiliários", { width: 2300 }),
          cell("Clientes HNW / famílias", { width: 2500 }),
          cell("CVM Res. 19/2021 — registro do consultor e prestação de serviços de consultoria de VM", { width: 2460 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Multi Cifras", { bold: true, width: 2100 }),
          cell("Hub de crédito empresarial (siloado)", { width: 2300 }),
          cell("PME / corporate", { width: 2500 }),
          cell("Correspondente bancário; sem interface com LPA / Muuney", { width: 2460 }),
        ],
      }),
    ],
  }),
  P("", {}),
  H2("2.1 Princípio estrutural de segregação"),
  P(
    "A Muuney (enquanto fintech e hub) e a LPA Wealth (enquanto consultoria) são pessoas jurídicas distintas, operando sob CNPJs próprios, com contabilidade, contas bancárias, sistemas de e-mail corporativo, repositórios de código, bases de dados, políticas de acesso e provedores de nuvem segregados. Sócios e colaboradores podem atuar em mais de uma entidade, observada a matriz de responsabilidades da Seção 5 e as vedações da Seção 4."
  ),
  P(
    "Multi Cifras é entidade estrategicamente independente (silo informacional), sem fluxo de dados, referral ou integração operacional com Muuney ou LPA Wealth."
  ),
];

const section3 = [
  H1("3. Segregação informacional (barreira de informação)"),
  H2("3.1 Categorias de informação sensível"),
  Numbered([Bold("Informação confidencial de cliente LPA Wealth"), Plain(": carteira, patrimônio declarado, rebalanceamentos, cartas de recomendação, plano patrimonial, perfil de suitability, documentos societários e sucessórios, comunicações pessoais.")]),
  Numbered([Bold("Informação confidencial de cliente Muuney 1P (muuney.app)"), Plain(": dados pessoais (CPF, e-mail), saldos agregados via Pluggy, transações categorizadas, metas, nudges personalizados.")]),
  Numbered([Bold("Informação confidencial de AAI/escritório cliente (muuney.hub)"), Plain(": carteiras próprias ou de clientes cadastradas, queries, insights salvos, configurações de alerta, métricas de uso.")]),
  Numbered([Bold("Informação material não-pública (MNPI)"), Plain(": dados de emissores, fundos ou veículos que sejam objeto de relacionamento direto entre LPA e gestoras/administradoras (ex.: acesso privilegiado a carteira-alvo de FIP em captação) antes de sua divulgação pública.")]),
  Numbered([Bold("Informação estratégica do grupo"), Plain(": roadmap de produto, termos comerciais de parcerias, cap table, métricas de negócio e fluxo de caixa.")]),
  H2("3.2 Regra geral"),
  P(
    "Nenhuma das categorias acima pode transitar entre as entidades sem: (i) base legal explícita (ex.: consentimento documentado do cliente); (ii) finalidade legítima, específica e compatível com a coleta original; e (iii) registro em log de acesso auditável."
  ),
  H2("3.3 Controles técnicos"),
  Bullet([Bold("Bases de dados distintas"), Plain(": o projeto Supabase da Muuney não contém tabela de clientes LPA; a base LPA (controlada por sistemas próprios da consultoria) não é exposta à aplicação muuney.app nem ao muuney.hub.")]),
  Bullet([Bold("Controle de acesso por função"), Plain(": RLS (Row-Level Security) no Supabase garante que usuários B2B do muuney.hub só enxergam seus próprios portfolios; clientes muuney.app só enxergam seus próprios dados. Tier admin é restrito ao sócio-administrador e só pode ser atribuído manualmente.")]),
  Bullet([Bold("Credenciais segregadas"), Plain(": chaves de API, secrets e tokens do muuney.app, muuney.hub e LPA Wealth ficam em cofres separados, com rotação ≥ anual e acesso registrado.")]),
  Bullet([Bold("Logs imutáveis"), Plain(": qualquer acesso elevado a dados de cliente é logado em ", { italics: false }), Bold("audit_logs"), Plain(" (Supabase), com retenção mínima de 5 anos.")]),
  Bullet([Bold("E-mails corporativos distintos"), Plain(": comunicações com clientes LPA ocorrem via domínio próprio da LPA; comunicações Muuney ocorrem via @muuney.com.br. Não é permitido o encaminhamento cruzado de comunicações de clientes entre domínios.")]),
  H2("3.4 Controles físicos e organizacionais"),
  Bullet([Plain("Reuniões envolvendo informação privilegiada de cliente LPA ocorrem em sessões fechadas, sem participação de colaboradores dedicados exclusivamente à Muuney, ressalvada a figura do sócio-administrador.")]),
  Bullet([Plain("Documentos físicos (contratos, procurações, termos de adesão) são armazenados em local distinto das operações Muuney.")]),
  Bullet([Plain("Colaboradores que transitam entre as entidades assinam termo de confidencialidade específico, com cláusula de segregação funcional.")]),
];

const section4 = [
  H1("4. Vedações e conflitos de interesse"),
  H2("4.1 Vedações absolutas"),
  Bullet([Plain("Utilizar dados de clientes LPA Wealth para alimentar, treinar ou calibrar modelos, nudges ou funcionalidades do muuney.app e do muuney.hub.")]),
  Bullet([Plain("Utilizar dados de clientes muuney.app (PFM) para produzir recomendação personalizada de investimento, atividade privativa de consultor autorizado pela CVM.")]),
  Bullet([Plain("Oferecer, ainda que indiretamente, serviços da LPA Wealth dentro do muuney.app ou do muuney.hub sem que: (a) o usuário tenha consentido explicitamente no recebimento dessa comunicação; (b) exista separação visual e contratual clara entre as marcas.")]),
  Bullet([Plain("Usar MNPI (informação material não-pública) recebida em contexto LPA para embasar qualquer ranking, alerta ou insight público no muuney.hub.")]),
  Bullet([Plain("Compartilhar credenciais, tokens ou acessos administrativos entre as entidades, ainda que por comodidade operacional.")]),
  Bullet([Plain("Operar em nome próprio ou de terceiros valores mobiliários com base em MNPI obtida em função da consultoria LPA.")]),
  H2("4.2 Conflitos presumidos e tratamento"),
  P("São presumidos como de conflito, exigindo tratamento formal:"),
  Bullet([Bold("Parcerias com gestoras/administradoras"), Plain(" que também possuam veículos cobertos pelo muuney.hub como dado público. Tratamento: divulgação prévia no ranking/insight sempre que o veículo for objeto de parceria comercial ou de remuneração.")]),
  Bullet([Bold("Compensação variável cruzada"), Plain(": nenhum colaborador Muuney pode ser remunerado com base em indicações para a LPA (ou vice-versa) sem autorização expressa do sócio-administrador e registro em ", { italics: false }), Bold("compliance_register"), Plain(".")]),
  Bullet([Bold("Investimentos pessoais"), Plain(": sócios e colaboradores com acesso a MNPI devem observar janelas de black-out e o ", { italics: false }), Bold("Código de Conduta"), Plain(" anexo (a ser emitido como documento separado).")]),
];

const section5 = [
  H1("5. Governança e responsabilidades"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell("Função", { bold: true, fill: GREEN, width: 3120 }),
          cell("Responsável", { bold: true, fill: GREEN, width: 3120 }),
          cell("Atribuições-chave", { bold: true, fill: GREEN, width: 3120 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Diretor de Compliance e DPO", { bold: true, width: 3120 }),
          cell("Lucas Pimentel Oliveira Freitas (acumulada até contratação de 3º)", { width: 3120 }),
          cell("Aprovar a Política, investigar violações, interface com CVM / ANPD, relatórios anuais", { width: 3120 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Responsável Técnico Muuney", { bold: true, width: 3120 }),
          cell("Lucas Pimentel Oliveira Freitas", { width: 3120 }),
          cell("Garantir RLS, logs, rotação de secrets, isolamento de bases, gestão de incidentes", { width: 3120 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Responsável LPA Wealth (Consultor)", { bold: true, width: 3120 }),
          cell("Lucas Pimentel Oliveira Freitas (CVM Res. 19/2021)", { width: 3120 }),
          cell("Custódia de documentos de cliente, suitability, carta anual, relacionamento com gestoras", { width: 3120 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Comitê de Ética e Conflitos", { bold: true, width: 3120 }),
          cell("Sócio-administrador + 1 membro externo (a indicar até 31/12/2026)", { width: 3120 }),
          cell("Julgar casos de conflito, aprovar exceções, revisar sanções", { width: 3120 }),
        ],
      }),
    ],
  }),
  P("", {}),
  P("Enquanto não houver segregação formal entre as funções acima, o sócio-administrador declara conhecer o conflito de interesses derivado da acumulação e compromete-se a: (i) documentar toda decisão relevante em ata; (ii) submeter revisão anual desta Política ao membro externo do Comitê de Ética; e (iii) buscar a contratação de um(a) Encarregado(a) de Proteção de Dados (DPO) e de um(a) oficial de compliance independente assim que a operação justificar."),
];

const section6 = [
  H1("6. Tratamento de dados pessoais (LGPD)"),
  P("As entidades atuam como controladoras independentes dos dados que coletam diretamente de seus respectivos clientes. Não há compartilhamento automático de bases."),
  H2("6.1 Bases legais"),
  Bullet([Bold("Muuney.app"), Plain(": execução de contrato (Termos de Uso) e consentimento específico para integração Pluggy/Open Finance.")]),
  Bullet([Bold("Muuney.hub"), Plain(": execução de contrato B2B; dados consumidos das fontes regulatórias públicas (BACEN/CVM) são dados de pessoas jurídicas / veículos, não se enquadrando em regime de dados pessoais.")]),
  Bullet([Bold("LPA Wealth"), Plain(": execução de contrato de consultoria, cumprimento de obrigação regulatória (CVM) e, quando aplicável, consentimento para operações específicas.")]),
  H2("6.2 Direitos dos titulares"),
  P("Pedidos de acesso, correção, anonimização, portabilidade ou eliminação são recebidos pelo canal dpo@muuney.com.br (ou dpo@lpawealth.com.br, conforme a entidade), com SLA de resposta de 15 dias."),
  H2("6.3 Incidentes"),
  P("Qualquer incidente que envolva dado pessoal, credencial, integridade de base ou suspeita de acesso não autorizado deve ser reportado ao Diretor de Compliance em até 24h. Incidentes com potencial de dano significativo são comunicados à ANPD em até 72h, observada a orientação vigente."),
];

const section7 = [
  H1("7. Monitoramento, testes e sanções"),
  H2("7.1 Monitoramento contínuo"),
  Bullet([Plain("Revisão trimestral dos logs de acesso a dados de cliente (Supabase audit_logs + infra).")]),
  Bullet([Plain("Teste anual de permissões RLS por usuário-tipo (free/pro/admin).")]),
  Bullet([Plain("Reconciliação anual da matriz de responsabilidades vs. folha de pagamento das entidades.")]),
  H2("7.2 Testes periódicos"),
  Bullet([Plain("Tentativa controlada de leitura de tabela LPA por usuário Muuney ≥ 1x ao ano.")]),
  Bullet([Plain("Revisão de secrets e rotação de tokens em cada encerramento de trimestre.")]),
  Bullet([Plain("Simulação de incidente (tabletop) ≥ 1x ao ano.")]),
  H2("7.3 Sanções"),
  P("A violação desta Política sujeita o agente às sanções previstas em contrato e em lei, incluindo advertência, suspensão, rescisão por justa causa, responsabilização civil e criminal e comunicação aos órgãos reguladores competentes."),
];

const section8 = [
  H1("8. Vigência, revisão e comunicação"),
  P("Esta Política entra em vigor em 18/04/2026, é revisada no mínimo anualmente ou sempre que houver alteração regulatória, estrutural ou tecnológica relevante, e é comunicada a todos os colaboradores mediante termo de ciência anexo."),
  P("Versões anteriores são mantidas em arquivo por pelo menos 5 (cinco) anos, conforme retenção regulatória aplicável."),
];

const section9 = [
  H1("9. Termo de ciência"),
  P("Declaro ter lido, compreendido e aceito integralmente os termos desta Política de Segregação de Atividades (Chinese Wall) entre Muuney e LPA Wealth, comprometendo-me a observá-la em todas as atividades que exerço no contexto das entidades."),
  new Paragraph({ children: [new TextRun({ text: " ", font: "Arial", size: 22 })], spacing: { after: 480 } }),
  new Paragraph({
    children: [
      new TextRun({ text: "Nome: ______________________________________________", font: "Arial", size: 22 }),
    ],
    spacing: { after: 240 },
  }),
  new Paragraph({
    children: [
      new TextRun({ text: "CPF: ________________________________________________", font: "Arial", size: 22 }),
    ],
    spacing: { after: 240 },
  }),
  new Paragraph({
    children: [
      new TextRun({ text: "Cargo / função: ______________________________________", font: "Arial", size: 22 }),
    ],
    spacing: { after: 240 },
  }),
  new Paragraph({
    children: [
      new TextRun({ text: "Entidade(s): (   ) Muuney    (   ) LPA Wealth    (   ) Ambas", font: "Arial", size: 22 }),
    ],
    spacing: { after: 360 },
  }),
  new Paragraph({
    children: [
      new TextRun({ text: "Data: ____/____/________", font: "Arial", size: 22 }),
      new TextRun({ text: "\tAssinatura: ______________________________", font: "Arial", size: 22 }),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { after: 480 },
  }),
  new Paragraph({ children: [new TextRun({ text: "—", font: "Arial", size: 22 })], alignment: AlignmentType.CENTER, spacing: { after: 360 } }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: "Aprovação do Diretor de Compliance / Sócio-administrador", font: "Arial", size: 22, bold: true }),
    ],
    spacing: { after: 360 },
  }),
  new Paragraph({
    children: [
      new TextRun({ text: "Nome: Lucas Pimentel Oliveira Freitas", font: "Arial", size: 22 }),
    ],
    spacing: { after: 180 },
  }),
  new Paragraph({
    children: [
      new TextRun({ text: "Data: 18/04/2026", font: "Arial", size: 22 }),
      new TextRun({ text: "\tAssinatura: ______________________________", font: "Arial", size: 22 }),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
  }),
];

const doc = new Document({
  creator: "Muuney · LPA Wealth",
  title: "Política de Segregação de Atividades (Chinese Wall)",
  description: "Política formal de Chinese Wall entre Muuney e LPA Wealth (CVM Res. 19/2021, 179/2023, 175/2022, LGPD)",
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: GREEN },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbered", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "MUUNEY · LPA WEALTH", font: "Arial", size: 18, color: GREEN, bold: true }),
              new TextRun({ text: "\tChinese Wall — v1.0", font: "Arial", size: 18, color: "777777" }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 4 } },
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "INTERNO — uso restrito a sócios e colaboradores", font: "Arial", size: 16, color: "777777", italics: true }),
              new TextRun({ text: "\tPágina ", font: "Arial", size: 16, color: "555555" }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "555555" }),
              new TextRun({ text: " de ", font: "Arial", size: 16, color: "555555" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 16, color: "555555" }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          }),
        ],
      }),
    },
    children: [
      ...frontCover,
      new Paragraph({ children: [], pageBreakBefore: true }),
      ...section1,
      ...section2,
      ...section3,
      ...section4,
      ...section5,
      ...section6,
      ...section7,
      ...section8,
      new Paragraph({ children: [], pageBreakBefore: true }),
      ...section9,
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  const out = path.join(__dirname, "..", "chinese-wall-policy-muuney-lpa.docx");
  fs.writeFileSync(out, buffer);
  console.log("OK:", out, buffer.length, "bytes");
});
