# Avaliação de Compliance CVM e LGPD — Ecossistema Muuney

**Data:** 01 de abril de 2026  
**Escopo:** muuney.app (PFM) e muuney.hub (Market Intelligence)  
**Entidades:** Muuney (fintech) e LPA Wealth (consultoria CVM-registrada)  
**Prepared by:** Compliance & Legal Review  

---

## Sumário Executivo

Este documento avalia a conformidade dos produtos Muuney com as regulamentações da **CVM (Comissão de Valores Mobiliários)**, **Bacen (Banco Central)** e **LGPD (Lei Geral de Proteção de Dados)**. Ambos os produtos operam dentro de marcos regulatórios viáveis, com **riscos médios controlados** através de estrutura de disclaimers, segregação de dados (Chinese Wall) e base legal clara para tratamento de dados pessoais.

**Conclusões principais:**
- ✅ Muuney.app (PFM): Enquadramento regulatório claro — informação financeira pública, sem recomendação personalizada
- ⚠️ Muuney.hub (Market Intelligence): Risco moderado de caracterização como "casa de análise" — requer disclaimers robustos e conformidade com regulação de acesso a dados CVM/B3
- ✅ LGPD: Base legal claramente documentada (consentimento + execução de contrato) para ambos os produtos
- 🔴 Crítico: Implementar Chinese Wall formal entre Muuney e LPA Wealth para evitar insider information

---

## PARTE 1: ANÁLISE CVM

### 1.1 Enquadramento Regulatório — Muuney.app (PFM)

#### Produto
- Agregador de contas bancárias via Open Finance (Pluggy)
- Categorização automática de gastos
- Relatórios financeiros via WhatsApp
- Cálculo de score financeiro pessoal
- **NÃO oferece** recomendação de investimentos
- **NÃO executa** operações financeiras
- **NÃO é** instituição financeira

#### Enquadramento CVM

**Status: VERDE (Conforme)**

**Justificativa:**
- Muuney.app fornece **informação financeira pública** (agregação de dados do próprio usuário)
- Não caracteriza "consultoria de valores mobiliários" (Res. CVM 19/2021) porque:
  - Não oferece recomendação personalizada sobre títulos ou fundos
  - Score financeiro é métrica de saúde geral, não análise de valores mobiliários
  - Categorização de gastos é gestão de caixa pessoal, não consultoria
- Não caracteriza "análise de valores mobiliários" (IN CVM 617) porque:
  - Não emite parecer ou recomendação sobre papéis específicos
  - Não agregua dados para análise de mercado (dados são privados do usuário)
- Modelos similares (Nubank Money, GuiaBolso) operam sem registro CVM neste segmento

#### Obrigações Específicas

| Obrigação | Descrição | Status |
|-----------|-----------|--------|
| **Disclaimer de não-consultoria** | Informar explicitamente que não é consultoria de investimentos | ⚠️ DEVE IMPLEMENTAR |
| **Política de privacidade LGPD** | Detalhar coleta, uso e compartilhamento de dados financeiros | ⚠️ DEVE IMPLEMENTAR |
| **Conformidade Open Finance** | Obter consentimento para coleta via Pluggy conforme Bacen | ⚠️ DEVE IMPLEMENTAR |
| **Proteção de dados bancários** | Aplicar controles de segurança conforme Res. CMN 4.893/2021 | ⚠️ DEVE IMPLEMENTAR |
| **PLD/FT** | Monitorar para padrões anormais de movimento (se aplicável) | ✅ N/A para PFM puro |

#### Ações Requeridas

**Curto prazo (30 dias):**
1. Inserir disclaimer na homepage, após login e em cada relatório:
   ```
   "Muuney fornece informações agregadas de gestão financeira pessoal
   e cálculo de score com base em seus próprios dados bancários.
   Não oferece recomendação de investimentos, consultoria de valores
   mobiliários ou qualquer análise personalizada sobre títulos.
   Para investimentos, consulte um consultor de investimentos registrado
   na CVM (Res. 19/2021)."
   ```

2. Revisar Termos de Uso para remover qualquer linguagem que implique recomendação ou análise de investimentos.

3. Implementar política de privacidade LGPD completa (ver seção 2).

**Médio prazo (90 dias):**
4. Documentar fluxo de dados com Pluggy (Relação Controladora-Operadora).
5. Implementar controles de segurança conforme Res. CMN 4.893/2021 (criptografia em trânsito, autenticação MFA, logs auditados).
6. Criar procedimento de resposta a incidente de segurança (ANPD + Bacen).

---

### 1.2 Enquadramento Regulatório — Muuney.hub (Market Intelligence)

#### Produto
- Plataforma B2B + B2C de análise de mercado financeiro
- 5 módulos: Panorama Macro, Overview Crédito, Fundos, Empresas, Educacional
- Dados de fontes públicas oficiais (Bacen, CVM, B3)
- Análises e estatísticas agregadas
- **NÃO emite** relatórios personalizados com recomendação
- **NÃO oferece** consultoria
- **Modelo:** B2B (assessores, consultores, gestoras) + B2C (investidores)

#### Enquadramento CVM

**Status: AMARELO (Requer Adequação)**

**Justificativa - Risco de Caracterização como "Casa de Análise":**

A linha entre "publicação de análises de mercado" e "análise de valores mobiliários" é tênue na regulação CVM:

1. **IN CVM 617 e Res. CVM 19/2021** definem "analista de valores mobiliários" como pessoa física/jurídica que:
   - Produz análise técnica ou fundamentalista sobre valores mobiliários
   - Divulga parecer ou recomendação sobre títulos
   - Recomenda "comprar", "vender" ou "manter"

2. **Muuney.hub oferece análises de fundos, crédito e empresas**, que PODEM ser interpretadas como análise de valores mobiliários se:
   - Contiverem recomendação explícita ("este fundo está em oportunidade de compra")
   - Contiverem avaliação comparativa entre fundos/títulos
   - Forem personalizadas por usuário

3. **Diferencial chave:** se o conteúdo for puramente **educacional/informativo** (histórico de dados, indicadores, estatísticas) sem recomendação, enquadra-se em "informação pública". Se contiver análise interpretativa com direcionamento, requer registro CVM.

#### Análise por Módulo

| Módulo | Conteúdo | Risco CVM | Enquadramento |
|--------|----------|-----------|---------------|
| **Panorama Macro** | Indicadores econômicos, inflação, taxa Selic, câmbio | BAIXO | Informação educacional pública |
| **Overview Crédito** | Dados de endividamento por segmento, ratings de crédito | MÉDIO | Análise de mercado (requer disclaimer) |
| **Fundos** | Performance histórica, composição, volatilidade de fundos | ALTO | Potencial análise de VM — requer disclaimer robusto |
| **Empresas** | Dados financeiros públicas (B3), valuation agregado | ALTO | Potencial análise de VM — requer disclaimer robusto |
| **Educacional** | Cursos, glossário, guias de investimento | BAIXO | Educação financeira pública |

#### Obrigações Específicas

| Obrigação | Descrição | Status |
|-----------|-----------|--------|
| **Disclaimer forte sobre análise** | Informar que NÃO é casa de análise, não oferece recomendação | 🔴 CRÍTICO |
| **Termos de uso de dados CVM/B3** | Verificar se redistribuição de dados requer aprovação | ⚠️ DEVE VERIFICAR |
| **Chinese Wall (com LPA Wealth)** | Garantir que análises não usem informação não-pública de clientes LPA | 🔴 CRÍTICO |
| **Controle de acesso (B2B)** | Se assessores/gestoras acessarem dados, aplicar regras de MOI (conflito de interesse) | ⚠️ DEVE IMPLEMENTAR |
| **Auditoria de conteúdo** | Revisar periodicamente análises para garantir conformidade com "não recomendação" | ⚠️ DEVE IMPLEMENTAR |

#### Ações Requeridas

**Urgente (15 dias):**
1. **Revisar cada análise de fundo e empresa** para garantir que NÃO contém:
   - "Recomendamos comprar..."
   - "Melhor opção em sua faixa de renda"
   - "Tendência clara de valorização"
   - Comparações diretas com "vencer" ou "perder"

2. Inserir disclaimer em cada página de análise:
   ```
   "As informações e análises apresentadas são fornecidas apenas
   para fins educacionais e informativos. Não constituem recomendação,
   consultoria ou análise de valores mobiliários. Muuney não é casa de
   análise ou consultora de investimentos registrada na CVM.
   
   Fundos de investimento envolvem riscos. Leia o prospecto e
   regulamento antes de investir. Para recomendação personalizada,
   consulte um consultor de investimentos CVM-registrado."
   ```

3. Implementar **aviso de conflito de interesse** se usuário for vinculado a LPA Wealth.

**Curto prazo (30 dias):**
4. Verificar **Termos de Uso** de acesso a dados CVM/B3:
   - Confirmar se Muuney.hub pode redistribuir análises de fundos (ANBID, Cetip, etc.)
   - Confirmar se pode agregar dados de empresas B3
   - Documentar aprovações ou licenças necessárias

5. Criar **Policy de Chinese Wall**:
   - Usuários internos (LPA Wealth) NÃO podem acessar análises de seus clientes em muuney.hub
   - Dados de clientes LPA NÃO alimentam análises agregadas de muuney.hub
   - Logs de acesso auditados

6. Implementar **auditoria mensal** de conteúdo:
   - Revisar 10% de análises quanto a disclaimers e linguagem
   - Documentar conclusões e ações corretivas

**Médio prazo (90 dias):**
7. Considerar **parecer jurídico formal** da CVM se houver dúvida sobre caracterização como "casa de análise" após adequações acima.

---

### 1.3 Regulação Bacen e Open Finance

#### Enquadramento Muuney.app

**Status: VERDE (Conforme com Condições)**

**Aplicável:**
- **Res. BCB 32/2020** — Open Finance (Iniciador de Dados)
- **Res. CMN 4.893/2021** — Segurança cibernética para instituições financeiras
- **Res. BCB 80/2021** — Instituições de pagamento (se Muuney oferecer fungibilidade de fundos)

**Obrigações:**

| Obrigação | Descrição | Status |
|-----------|-----------|--------|
| **Consentimento Open Finance** | Obter consentimento explícito para compartilhamento de dados com Pluggy | ⚠️ IMPLEMENTAR |
| **Aviso ao cliente** | Informar que Muuney acessa dados via Open Finance e como são usados | ⚠️ IMPLEMENTAR |
| **Segurança cibernética** | Aplicar controles de autenticação, criptografia, monitoramento | ⚠️ IMPLEMENTAR |
| **Disponibilidade de dados** | Guardar dados financeiros por 7 anos (per Bacen) | ⚠️ IMPLEMENTAR |
| **Direito de portabilidade** | Permitir que cliente exporte seus dados em formato aberto | ⚠️ IMPLEMENTAR |

#### Enquadramento Muuney.hub

**Status: VERDE (Conforme)**

Muuney.hub NÃO é Iniciador de Dados (não acessa dados bancários do usuário via Open Finance). Acessa apenas dados públicos de Bacen/B3, portanto:
- Não requer consentimento Open Finance
- Não está sujeito a Res. CMN 4.893/2021 (segurança cibernética para IFs) — aplica-se LGPD apenas
- Deve observar Termos de Uso de Bacen/B3 para redistribuição

---

### 1.4 Chinese Wall entre Muuney e LPA Wealth

#### Contexto
- Muuney: Fintech PFM + Market Intelligence (não-regulada como IF ou consultor CVM)
- LPA Wealth: Consultoria de investimentos CVM-registrada

#### Risco
Se usuários de muuney.app forem clientes LPA Wealth, existe risco de:
1. Muuney.app utilizar dados de posição de investimento (via Pluggy) para informar recomendações em muuney.hub
2. Analistas de LPA Wealth acessarem análises de muuney.hub sobre seus próprios clientes (insider information)
3. Conflito de interesse não-revelado se muuney.hub recomendar fundo que LPA Wealth administra

#### Obrigações CVM (Res. CVM 19/2021, Art. 27)

LPA Wealth DEVE manter:
- Política formal de Chinese Wall escrita
- Segregação física/lógica entre Muuney e LPA Wealth
- Auditorias periódicas de conformidade
- Registro de acessos entre as entidades

#### Ações Requeridas

**Urgente (15 dias):**
1. Publicar **Política de Chinese Wall formal**, cobrindo:
   - Proibição de compartilhamento de dados pessoais entre Muuney e LPA sem consentimento
   - Proibição de analistas LPA acessarem muuney.hub sobre seus próprios clientes
   - Regime de sanções internas por violação

2. Implementar **flag técnico** em banco de dados:
   - Quando cliente LPA Wealth fizer login em muuney.app, bloquear compartilhamento de dados com LPA
   - Quando cliente Muuney.app solicitar consultoria de LPA, gerar aviso de conflito

**Médio prazo (90 dias):**
3. Realizar **auditoria de conformidade** semestral
4. Documentar **logs de acesso** entre sistemas (SIEMs)
5. Treinar equipes LPA + Muuney sobre política

---

## PARTE 2: ANÁLISE LGPD

### 2.1 Fluxos de Dados — Muuney.app

#### Dados Coletados

| Categoria | Fonte | Volume | Sensibilidade |
|-----------|-------|--------|----------------|
| **Dados pessoais básicos** | Cadastro (CPF, nome, email, telefone) | Atômico | MÉDIA |
| **Dados bancários** | Pluggy (contas, agência, saldo, histórico transações) | Contínuo (semanal) | ALTA |
| **Dados de gastos** | Categorização automática (loja, valor, categoria) | Contínuo (daily) | ALTA |
| **Dados de dispositivo** | IP, User-Agent, timestamps, geolocalização | Contínuo | MÉDIA |
| **Dados comportamentais** | Cliques, visualizações, buscar patterns | Contínuo | BAIXA |

#### Base Legal por Operação

| Operação | Base Legal | Justificativa | Status |
|----------|-----------|---------------|--------|
| **Coleta via Pluggy (Open Finance)** | Consentimento (art. 7º, I) | Usuário autoriza Muuney a acessar dados bancários | ✅ REQUER CONSENTIMENTO EXPLÍCITO |
| **Processamento PFM (categorização, score)** | Execução de contrato (art. 7º, V) | Fornecimento do serviço de gestão financeira | ✅ CONFORME |
| **Armazenamento de dados financeiros** | Execução de contrato + Obrigação legal (art. 7º, II) | Lei define retenção de 7 anos para instituições financeiras | ✅ CONFORME |
| **Envio de relatórios via WhatsApp** | Consentimento (art. 7º, I) | Usuário aceita receber mensagens | ✅ REQUER OPT-IN |
| **Análises agregadas (market intelligence)** | Legítimo interesse (art. 7º, IX) | Melhorar produto e identificar padrões de risco | ⚠️ REQUER TESTE DE BALANCEAMENTO |
| **Marketing/Newsletter** | Consentimento (art. 7º, I) | Envio de promoções requer opt-in | ⚠️ IMPLEMENTAR OPT-IN |

#### Compartilhamento de Dados

| Destinatário | Dados | Base Legal | Risco |
|--------------|-------|-----------|-------|
| **Pluggy** | Consentimento para acesso (intermediário de dados) | Consentimento + Contrato de DPA | ✅ BAIXO |
| **LPA Wealth** | Nenhum (Chinese Wall) | Não aplicável | ✅ SEGREGADO |
| **Provedores de infraestrutura** (AWS, etc.) | Dados criptografados | Contrato de DPA | ✅ BAIXO |
| **Bacen/CVM** | Informações de conformidade (se requerido) | Obrigação legal | ✅ CONFORME |
| **Terceiros (marketing, analytics)** | Dados agregados/anonimizados | Legítimo interesse | ⚠️ REQUER CONSENTIMENTO |

#### Retenção de Dados

| Dado | Prazo | Justificativa |
|-----|-------|---------------|
| Dados bancários | 7 anos | Obrigação Bacen (não em poder de Muuney, mas em logs de acesso) |
| Dados transacionais | 5 anos pós-encerramento | Conformidade com retenção de registros financeiros |
| Dados de dispositivo/comportamento | 12 meses | Legítimo interesse (auditoria, fraude) |
| Dados de consentimento | Indefinido | Necessário para comprovar base legal |

#### Direitos dos Titulares

Implementar procedimento para atender em prazo de 15 dias:

| Direito | Implementação |
|--------|----------------|
| **Confirmação de tratamento** | Verificar se dados do usuário estão armazenados |
| **Acesso** | Exportar em formato estruturado (JSON/CSV) |
| **Correção** | Permitir edição de dados pessoais (nome, email, etc.) |
| **Portabilidade** | Exportar dados financeiros em formato aberto |
| **Eliminação ("direito ao esquecimento")** | Apagar dados ao encerramento de conta, preservando logs conforme obrigação legal |
| **Revogação de consentimento** | Parar de coletar via Pluggy; manter dados históricos |

---

### 2.2 Fluxos de Dados — Muuney.hub

#### Dados Coletados

| Categoria | Fonte | Volume | Sensibilidade |
|-----------|-------|--------|----------------|
| **Dados pessoais (B2B)** | Cadastro de assessores/gestores (CPF, CNPJ, email) | Atômico | BAIXA |
| **Dados pessoais (B2C)** | Cadastro de usuários (nome, email, interesses) | Atômico | BAIXA |
| **Dados de acesso** | IP, timestamps, páginas visualizadas | Contínuo | BAIXA |
| **Dados de mercado** | Públicos (Bacen, CVM, B3) | Agregado | PÚBLICA |

#### Base Legal por Operação

| Operação | Base Legal | Status |
|----------|-----------|--------|
| **Cadastro e autenticação** | Execução de contrato (art. 7º, V) | ✅ CONFORME |
| **Rastreamento de acesso (analytics)** | Legítimo interesse (art. 7º, IX) | ⚠️ REQUER CONSENTIMENTO PRÉVIO |
| **Envio de updates de mercado** | Consentimento (art. 7º, I) | ⚠️ REQUER OPT-IN |
| **Segmentação por perfil** | Legítimo interesse + consentimento | ⚠️ IMPLEMENTAR CONSENTIMENTO |

#### Compartilhamento de Dados

Muuney.hub não compartilha dados pessoais com terceiros. Dados de mercado são públicos.

---

### 2.3 RIPD (Relatório de Impacto à Proteção de Dados)

#### Quando é obrigatório?

Segundo ANPD, RIPD é obrigatório quando há "tratamento de grande volume de dados pessoais que acarrete alto risco aos direitos dos titulares".

**Para Muuney.app:** ✅ RECOMENDADO (dados bancários = sensíveis)  
**Para Muuney.hub:** ✅ NÃO OBRIGATÓRIO (dados pessoais limitados) — OPCIONAL como boa prática

#### Estrutura do RIPD — Muuney.app

**1. Descrição do Tratamento**
- Muuney.app agrega contas bancárias de clientes via Open Finance (Pluggy)
- Processa transações para categorização automática de gastos
- Calcula score financeiro baseado em histórico de caixa

**2. Necessidade e Proporcionalidade**
- Necessidade: Essencial para fornecer o serviço PFM
- Proporcionalidade: Coleta apenas dados necessários para cálculo de score e categorização
- Alternativas: Não há modelo sem acesso a dados bancários

**3. Análise de Risco**

| Risco | Probabilidade | Impacto | Mitigação | Nível Final |
|------|--------------|--------|-----------|-------------|
| **Vazamento de dados bancários (breach)** | Baixa (0-20%) | CRÍTICO | MFA, criptografia, SOC 24/7, seguro cyber | MÉDIO |
| **Acesso não autorizado por funcionário** | Muito Baixa (0-5%) | CRÍTICO | Segregação de funções, logs auditados, 2FA | BAIXO |
| **Compartilhamento indevido com LPA** | Muito Baixa (0-5%) | ALTO | Chinese Wall, flags de sistema, auditoria | BAIXO |
| **Violação de consentimento Open Finance** | Baixa (0-20%) | MÉDIO | Ler consentimento a cada acesso, revogar fácil | MÉDIO |
| **Retenção excessiva de dados** | Baixa (0-20%) | MÉDIO | Política de retenção, arquivamento 7 anos | MÉDIO |
| **Negação de direitos dos titulares** | Muito Baixa (0-5%) | MÉDIO | Processo automatizado de SAR, SLA 15 dias | BAIXO |

**4. Medidas de Mitigação**

- Autenticação MFA obrigatória
- Criptografia AES-256 em repouso, TLS 1.3 em trânsito
- DPA com Pluggy e provedores de infraestrutura
- Política de retenção de 7 anos com arquivo seguro
- Auditoria trienal de segurança por terceiro
- Seguro cyber com cobertura de notificação de incidente
- Treinamento LGPD para equipe (anual)

**5. Dados Transferidos Internacionalmente**

Se dados armazenados em AWS/GCP (EUA):
- Implementar Standard Contractual Clauses (SCC)
- Realizar adequacy assessment de jurisdição
- Documentar decisão de transferência

---

### 2.4 Política de Privacidade — Checklist de Requisitos LGPD

Uma Política de Privacidade conforme LGPD DEVE conter:

#### ✅ Obrigatório (Art. 14 LGPD)

- [ ] Identidade da Controladora (razão social, CNPJ, contato)
- [ ] Tipos de dados pessoais coletados (banco de dados, categorias)
- [ ] Finalidade do tratamento (gestão de conta, conformidade, analytics)
- [ ] Base legal para cada tratamento (consentimento, contrato, obrigação legal, legítimo interesse)
- [ ] Categorias de destinatários (Pluggy, provedores infraestrutura, reguladores)
- [ ] Prazo de retenção ou critério de eliminação
- [ ] Direitos dos titulares (confirmação, acesso, correção, portabilidade, eliminação, revogação)
- [ ] Como exercer direitos (email, formulário, SAR)
- [ ] Informações sobre transferência internacional (se aplicável)
- [ ] Política de cookies e rastreamento

#### ⚠️ Altamente Recomendado

- [ ] Descrição técnica de segurança (criptografia, MFA, segregação)
- [ ] Processo de resposta a incidente de dados (Bacen, ANPD)
- [ ] Contato do Encarregado (DPO)
- [ ] Mapa de fluxo de dados (diagrama)
- [ ] Informações sobre processamento por terceiros (DPA)
- [ ] Explicação em linguagem acessível (não só legal)

#### Checklist de Implementação

- [ ] Política redigida em linguagem clara e acessível
- [ ] Disponível em página dedicada (/privacidade)
- [ ] Aceita explicitamente durante onboarding
- [ ] Versionamento com data de atualização
- [ ] Aviso de mudanças com 30 dias de antecedência
- [ ] Disponível em idiomas operados (PT-BR, EN mínimo)

---

### 2.5 Incidente de Segurança — Plano de Resposta

#### Fases de Resposta

**Fase 1: Contenção (0-2 horas)**
1. Isolar sistema afetado (desconectar da rede se necessário)
2. Preservar logs e evidências
3. Identificar escopo: quantos registros, quais dados
4. Notificar Chief Security Officer (CSO) e Legal

**Fase 2: Avaliação (2-24 horas)**
1. Determinar tipo de incidente (acesso não autorizado, malware, vazamento, etc.)
2. Identificar se dados pessoais/sensíveis foram expostos
3. Avaliar risco aos direitos dos titulares (classificação: BAIXO / MÉDIO / ALTO)
4. Notificar Bacen (obrigatório para instituições financeiras)

**Fase 3: Notificação (0-72 horas conforme LGPD)**

| Risco | Notificar ANPD | Notificar Titulares | Timeline |
|------|---|---|---|
| **BAIXO** | Não (documentar razão) | Não | Documentar em 10 dias |
| **MÉDIO** | Recomendado | Sim (se risco relevante) | 72 horas idealmente |
| **ALTO** | Sim (obrigatório) | Sim | Imediatamente |

**Notificação ANPD:** Enviar formulário em https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd

**Notificação Bacen:** Para muuney.app, seguir Res. CMN 4.893/2021 (comunicação de incidentes cibernéticos)

**Fase 4: Remediação (24-7 dias)**
1. Corrigir vulnerabilidade
2. Implementar patches/atualizações
3. Realizar auditoria forense completa
4. Documentar root cause analysis
5. Comunicar timeline de resolução aos afetados

**Fase 5: Pós-Incidente (7-30 dias)**
1. Relatório completo à liderança
2. Análise de lessons learned
3. Atualizações de política/processo
4. Notificação de resolução aos titulares
5. Manter documentação por 3 anos

#### Plano de Comunicação

**Template de Notificação a Titulares (ALTO RISCO):**

```
Assunto: Notificação de Incidente de Segurança de Dados

Caro Cliente,

Identificamos um incidente de segurança que pode ter afetado seus dados pessoais.

Dados potencialmente afetados: [CPF, email, histórico de transações]
Data do incidente: [data]
Data da descoberta: [data]
Status: [Em investigação / Contido / Resolvido]

Ações que tomamos:
- Isolamos o acesso não autorizado
- Realizamos investigação forense
- Implementamos proteções adicionais

O que você pode fazer:
- Monitorar sua conta para atividade suspeita
- Considerar mudança de senha
- Verificar extratos bancários

Contato: [DPO email], [suporte phone]
Mais informações: [link para página de incidente]
```

---

### 2.6 Processamento por Terceiros — Data Processing Agreements (DPA)

#### Pluggy

**Papel:** Operadora de dados (coleta dados bancários em nome de Muuney)

**DPA Requerido:** ✅ CRÍTICO

**Cláusulas Essenciais:**
- [ ] Escopo: quais dados, qual finalidade
- [ ] Instruções do Controlador: Muuney determina o quê, Pluggy o como
- [ ] Subprocessadores: se Pluggy usa terceiros, deve notificar Muuney
- [ ] Segurança: padrão mínimo (ISO 27001, SOC 2)
- [ ] Confidencialidade: obrigação de sigilo de funcionários
- [ ] Direitos dos titulares: como Pluggy auxilia Muuney a responder SAR
- [ ] Transferência internacional: se aplicável
- [ ] Término: eliminação de dados ao final do contrato
- [ ] Auditoria: direito de Muuney auditar Pluggy conforme LGPD

**Status:** ⚠️ VERIFICAR se existe e está atualizado conforme LGPD

#### Provedores de Infraestrutura (AWS, GCP, etc.)

**Papel:** Operadores de dados (armazenam dados em data centers)

**DPA Requerido:** ✅ SIM

**Verificação:**
- [ ] AWS Data Processing Addendum (DPA) assinado?
- [ ] GCP assinado Data Processing Addendum?
- [ ] Cláusulas de criptografia em repouso?
- [ ] Cláusulas de transferência internacional (SCC)?

**Status:** ⚠️ VERIFICAR

---

## PARTE 3: CONFORMIDADE BACEN E OPEN FINANCE

### 3.1 Regulação de Open Finance (Res. BCB 32/2020)

#### Aplicável a: Muuney.app

**Muuney é Iniciador de Dados** — acessa dados de clientes via API de Open Finance (Pluggy)

#### Obrigações

| Obrigação | Descrição | Status |
|-----------|-----------|--------|
| **Consentimento explícito** | Obter consentimento ANTES de acessar dados via Open Finance | ⚠️ IMPLEMENTAR |
| **Aviso ao cliente** | Informar claramente que Muuney acessa dados via Open Finance | ⚠️ IMPLEMENTAR |
| **Divulgação de operadora** | Revelar qual intermediária (Pluggy) está sendo usada | ⚠️ IMPLEMENTAR |
| **Segurança de dados** | Aplicar padrão mínimo de segurança (Res. CMN 4.893/2021) | ⚠️ IMPLEMENTAR |
| **Direito de revogação** | Permitir que cliente revogue acesso a qualquer momento | ⚠️ IMPLEMENTAR |
| **Portabilidade** | Permitir exportar dados em formato padronizado | ⚠️ IMPLEMENTAR |

#### Implementação Técnica

**Tela de Consentimento (Obrigatória):**
```
AUTORIZAÇÃO DE ACESSO A DADOS FINANCEIROS VIA OPEN FINANCE

Muuney solicita sua autorização para acessar via Open Finance (intermediária: Pluggy):
☐ Contas correntes e poupança
☐ Histórico de transações (últimos 12 meses)
☐ Dados de investimentos

Finalidade: Gestão de finanças pessoais e cálculo de score financeiro

Você pode revogar essa autorização a qualquer momento em Configurações > Open Finance

[ AUTORIZAR ]  [ RECUSAR ]
```

**Status de Consentimento (Dashboard do Cliente):**
- Data de autorização
- Próxima data de renovação (se obrigatório)
- Opção de revogar com 1 clique
- Histórico de acessos (logs)

---

### 3.2 Segurança Cibernética (Res. CMN 4.893/2021)

#### Aplicável a: Muuney.app (se usar dados de instituição financeira)

**Disclaimer:** Muuney.app não é instituição financeira, mas ao acessar dados via Open Finance, está sujeita a padrões mínimos.

#### Controles Obrigatórios

| Controle | Descrição | Status |
|----------|-----------|--------|
| **Autenticação** | MFA obrigatório para acesso a contas | ⚠️ IMPLEMENTAR |
| **Criptografia em repouso** | AES-256 ou superior | ⚠️ VERIFICAR |
| **Criptografia em trânsito** | TLS 1.3 para HTTPS | ⚠️ VERIFICAR |
| **Gestão de acesso** | Segmentação de privilégios (least privilege) | ⚠️ IMPLEMENTAR |
| **Auditoria de logs** | Logs imutáveis por 7 anos | ⚠️ IMPLEMENTAR |
| **Detecção de intrusão** | IDS/IPS monitorado 24/7 | ⚠️ IMPLEMENTAR |
| **Backup e disaster recovery** | RTO < 4h, RPO < 1h | ⚠️ VERIFICAR |
| **Plano de resposta a incidente** | Testado anualmente | ⚠️ IMPLEMENTAR |

#### Comunicação de Incidentes ao Bacen

Se ocorrer incidente cibernético com impacto operacional:
- **Timeline:** Comunicar ao Bacen em até 2 dias úteis
- **Conteúdo:** Descrição do incidente, impacto, medidas tomadas
- **Contato:** [Bacen Segurança da Informação - DSOP]

---

## PARTE 4: SÍNTESE E PRIORIZAÇÃO DE AÇÕES

### 4.1 Matriz de Risco Consolidada

| Item | Entidade | Risco CVM | Risco LGPD | Risco Bacen | Risco Total | Prioridade |
|------|----------|-----------|-----------|------------|-------------|-----------|
| **Muuney.app — Disclaimer** | Muuney | MÉDIO | BAIXO | BAIXO | MÉDIO | 🔴 URGENTE |
| **Muuney.app — Consentimento Open Finance** | Muuney | BAIXO | MÉDIO | MÉDIO | MÉDIO | 🔴 URGENTE |
| **Muuney.app — Segurança cibernética** | Muuney | BAIXO | ALTO | ALTO | ALTO | 🔴 URGENTE |
| **Muuney.hub — Disclaimer + análise de conteúdo** | Muuney | ALTO | BAIXO | BAIXO | ALTO | 🔴 URGENTE |
| **Muuney.hub — Termos de uso CVM/B3** | Muuney | MÉDIO | BAIXO | BAIXO | MÉDIO | 🟡 CURTO PRAZO |
| **Chinese Wall (Muuney ↔ LPA)** | Ambas | ALTO | ALTO | MÉDIO | ALTO | 🔴 URGENTE |
| **Política de Privacidade LGPD** | Ambas | BAIXO | ALTO | BAIXO | ALTO | 🔴 URGENTE |
| **RIPD (Muuney.app)** | Muuney | BAIXO | MÉDIO | BAIXO | MÉDIO | 🟡 CURTO PRAZO |
| **DPA com Pluggy** | Muuney | BAIXO | ALTO | MÉDIO | ALTO | 🔴 URGENTE |
| **Incidente de Resposta + Bacen Protocol** | Muuney | BAIXO | MÉDIO | ALTO | MÉDIO | 🟡 CURTO PRAZO |

---

### 4.2 Roadmap de Implementação

#### 🔴 FASE 1: URGENTE (15 dias)

**Semana 1-2:**
1. Redigir e publicar disclaimer unificado para Muuney.app (acima)
2. Revisar cada análise de Muuney.hub para remover linguagem de recomendação
3. Inserir disclaimer em Muuney.hub
4. Implementar flag técnico de Chinese Wall (bloqueio de compartilhamento LPA)
5. Publicar Política Formal de Chinese Wall

**Semana 2:**
6. Verificar DPA com Pluggy — solicitar atualização LGPD se necessário
7. Implementar consentimento explícito de Open Finance (tela de aceitar/recusar)
8. Redigir Política de Privacidade LGPD completa (seção 2.4)

#### 🟡 FASE 2: CURTO PRAZO (30-90 dias)

**Mês 1:**
9. Implementar auditoria de conteúdo mensal (Muuney.hub)
10. Verificar Termos de Uso de CVM/B3 para redistribuição de dados
11. Documento de conformidade com Res. CMN 4.893/2021 (segurança cibernética)
12. Treinar equipe Muuney + LPA sobre Chinese Wall e LGPD

**Mês 2:**
13. Redigir e publicar RIPD de Muuney.app (seção 2.3)
14. Implementar processo de SAR (Subject Access Request) automatizado
15. Testar plano de resposta a incidente com Bacen notification protocol
16. Auditoria de conformidade com disclaimers (sweep de app)

**Mês 3:**
17. Realizar parecer jurídico formal sobre characterização de Muuney.hub como "casa de análise" (se necessário)
18. Implementar logs de auditoria segregados por entidade (Muuney vs. LPA)
19. Contratos de processamento com provedores (AWS, GCP) — verificar DPA

#### 🟢 FASE 3: MANUTENÇÃO CONTÍNUA (após 90 dias)

- Auditoria de conformidade trimestral
- Revisão de Política de Privacidade (anualmente ou quando mudanças ocorrerem)
- Treinamento LGPD + CVM para equipe (anualmente)
- Teste de plano de incidente (anualmente)
- Avaliação de novas funcionalidades para impacto regulatório

---

### 4.3 Alocação de Responsabilidades

| Ação | Responsável | Prazo | Checkpoint |
|------|------------|-------|-----------|
| Disclaimer Muuney.app | Product + Legal | 7 dias | Publicado em app + site |
| Análise de conteúdo Muuney.hub | Content + Legal | 15 dias | Todos os módulos revisados |
| Consentimento Open Finance | Backend + Product | 15 dias | Tela de consentimento em produção |
| Chinese Wall (policy + técnico) | Legal + Backend | 15 dias | Policy publicada + flag implementado |
| Política de Privacidade | Legal | 20 dias | Publicada e aceita no onboarding |
| DPA com Pluggy | Legal + Procurement | 30 dias | Contrato assinado + armazenado |
| RIPD | Legal + Security | 45 dias | Documento finalizado e aprovado |
| Auditoria de segurança cibernética | Security + Compliance | 60 dias | Relatório de terceiro obtenido |

---

## PARTE 5: REFERÊNCIAS REGULATÓRIAS

### CVM

- **Resolução CVM 19/2021** — Consultoria de Valores Mobiliários
- **Resolução CVM 21/2021** — Gestão de Carteiras
- **Instrução CVM 617/2021** — Mercado de Capitais (análise de valores mobiliários)
- **Resolução CVM 160/2022** — Crowdfunding
- **Resolução CVM 175/2022** — Fundos de Investimento

### Bacen

- **Resolução BCB 32/2020** — Open Finance
- **Resolução BCB 80/2021** — Instituições de Pagamento
- **Resolução CMN 4.893/2021** — Segurança Cibernética
- **Resolução CMN 4.658/2018** — Computação em Nuvem
- **Circular Bacen 3.978/2020** — PLD/FT (Prevenção à Lavagem de Dinheiro)

### ANPD/LGPD

- **Lei 13.709/2018** — Lei Geral de Proteção de Dados
- **Resolução ANPD 1/2021** — Diretrizes para RIPD
- **Orientação ANPD** — Notificação de Incidentes de Segurança

### Dados CVM/B3

- **Termos de Uso — Mercado de Valores Mobiliários (ANBID)**
- **Termos de Uso — Base de Dados B3**
- **Contrato de Acesso — Dados Públicos Bacen**

---

## CONCLUSÕES

### Status Geral: ⚠️ AMARELO (Conforme com Adequações Necessárias)

**Muuney.app:** Modelo viável legalmente. Riscos controlados com implementação de (i) disclaimers, (ii) consentimento Open Finance, (iii) conformidade LGPD.

**Muuney.hub:** Risco moderado de caracterização como "casa de análise" CVM. Requer (i) revisão de conteúdo, (ii) disclaimers robustos, (iii) possivelmente parecer jurídico formal.

**Chinese Wall:** Crítico. Muuney e LPA Wealth devem manter segregação formal documentada (policy + técnico) para evitar conflito de interesse.

**LGPD:** Aplicável a ambos os produtos. Base legal clara (consentimento + execução de contrato). Requer política de privacidade e protocolo de incidente.

### Próximos Passos Imediatos

1. **Semana 1:** Publicar disclaimers (Muuney.app + Muuney.hub)
2. **Semana 2:** Implementar consentimento Open Finance + Chinese Wall flag
3. **Semana 3:** Redigir Política de Privacidade LGPD
4. **Semana 4:** Verificar DPA com Pluggy e provedores
5. **Mês 2:** Auditoria de conformidade + parecer jurídico (se necessário)

---

**Documento preparado:** Abril 2026  
**Próxima revisão recomendada:** Trimestral (ou quando novas funcionalidades forem lançadas)  
**Contato:** Lucas [Founder, CVM-certificado] / Legal Team
