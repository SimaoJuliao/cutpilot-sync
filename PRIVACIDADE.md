# Política de Privacidade — CutPilot Sync

**Última atualização:** 27 de outubro de 2026
**Versão:** 1.0

> ⚠️ **ANTES DE PUBLICAR:** há campos por preencher `[...]` e uma verificação
> obrigatória por fazer — confirmar onde cada fornecedor aloja os dados e se
> tens contratos de subcontratação com eles. Ver `TERMOS-PENDENTES.md`.

---

## O essencial em cinco linhas

- **O teu ficheiro de vídeo nunca sai do teu computador.** Só a faixa de áudio é
  enviada para transcrição.
- Guardamos pouco: o teu **email** e pouco mais.
- **Não vendemos dados** a ninguém, nem fazemos publicidade.
- **Não usamos o teu conteúdo para treinar modelos**, e exigimos o mesmo aos
  nossos fornecedores.
- Podes **apagar a conta** dentro da aplicação, a qualquer momento.

---

## 1. Responsável pelo tratamento

- **Simão Julião**, empresário em nome individual
- NIF: `[preencher]`
- Morada: `[preencher]`
- Email: **cutpilotsync@gmail.com**

Para qualquer questão sobre os teus dados, escreve para o email acima.

## 2. Que dados tratamos

### 2.1 Dados de conta

| Dado | Porquê | Fundamento legal |
|---|---|---|
| Email | Identificar-te, entrar na conta, recuperar palavra-passe, avisos de faturação | Execução do contrato |
| Palavra-passe | Autenticação — guardada **cifrada**, nunca em texto simples | Execução do contrato |
| Estado de introdução (`onboarding`) | Não repetir o ecrã inicial | Execução do contrato |

### 2.2 Dados de pagamento

Tratados pelo processador de pagamentos (`[preencher]`). **Não recebemos nem
guardamos os dados do teu cartão** — apenas o estado da subscrição (ativa,
cancelada, em falha) e os dados de faturação que a lei nos obriga a conservar.

### 2.3 O teu conteúdo

| O quê | Onde fica | Quanto tempo |
|---|---|---|
| Ficheiro de vídeo original | **Só no teu computador** | Controlas tu |
| Faixa de áudio extraída | Ficheiro temporário local, enviado à Deepgram | Apagado após a transcrição |
| Transcrição | Cache no teu computador; enviada à Anthropic para decidir os cortes | 30 dias na cache local |
| Envelope de áudio e pré-visualizações | **Só no teu computador** | Até 20 e 8 entradas, respetivamente |
| Vídeo final | **Só no teu computador** | Controlas tu |

**Não guardamos cópias do teu conteúdo nos nossos sistemas.** As caches ficam na
tua máquina, em `AppData/Roaming/CutPilotSync/cps-cache` (Windows) ou equivalente,
e podes apagá-las a qualquer momento.

### 2.4 Dados técnicos

A aplicação verifica atualizações no GitHub. Esse pedido revela o teu endereço
IP ao GitHub, como qualquer visita a um site.

**Não fazemos análise de utilização, nem telemetria, nem rastreio.**

## 3. Quem recebe os teus dados

Recorremos a subcontratantes que tratam dados **por nossa conta e segundo as
nossas instruções**:

| Fornecedor | O que recebe | Finalidade | Onde |
|---|---|---|---|
| **Deepgram** | Só a faixa de áudio | Transcrição | `[confirmar região]` |
| **Anthropic** | Só a transcrição (texto) | Decidir os cortes | `[confirmar região]` |
| **Supabase** | Email, palavra-passe cifrada | Autenticação | `[confirmar região]` |
| **`[processador de pagamentos]`** | Dados de pagamento | Cobrança | `[confirmar]` |
| **GitHub** | Endereço IP | Entrega de atualizações | EUA |

Alguns destes fornecedores podem tratar dados **fora da União Europeia**. Nesses
casos, a transferência assenta nas garantias previstas no RGPD, designadamente
Cláusulas Contratuais-Tipo aprovadas pela Comissão Europeia e, quando aplicável,
decisões de adequação.

**Não vendemos nem partilhamos os teus dados para fins publicitários.**

## 4. Quanto tempo guardamos

| Dado | Prazo |
|---|---|
| Conta | Enquanto a mantiveres. Apagas tu, e é eliminada |
| Faturação | 10 anos, por imposição fiscal |
| Áudio enviado para transcrição | Apagado do teu disco após a transcrição; retenção no fornecedor conforme os termos dele |
| Caches locais | Transcrições 30 dias; envelopes e pré-visualizações por rotação |

## 5. Os teus direitos

Tens direito a:

- **saber** que dados temos sobre ti e obter uma cópia;
- **corrigir** dados errados;
- **apagar** os teus dados ("direito a ser esquecido");
- **limitar** ou **opor-te** a certos tratamentos;
- **portabilidade** — receber os teus dados num formato legível por máquina;
- **retirar o consentimento**, quando o tratamento nele se basear.

Para exercer qualquer um deles: **cutpilotsync@gmail.com**. Respondemos no prazo
de **um mês**.

Para apagar a conta, podes fazê-lo diretamente: **Definições → Apagar conta**.

Se entenderes que não tratámos os teus dados corretamente, podes reclamar junto
da **Comissão Nacional de Proteção de Dados (CNPD)** — [www.cnpd.pt](https://www.cnpd.pt).

## 6. Segurança

A ligação aos nossos fornecedores é cifrada (HTTPS/TLS). As palavras-passe são
guardadas cifradas pela Supabase e nunca têm forma legível. As chaves de API
ficam no lado da aplicação e não são expostas na interface.

Nenhum sistema é totalmente seguro. Se ocorrer uma violação de dados que
implique risco elevado para ti, avisamos-te e à CNPD nos prazos legais.

## 7. Menores

O serviço destina-se a maiores de 18 anos. Não recolhemos conscientemente dados
de menores. Se souberes que um menor nos forneceu dados, avisa-nos e eliminamos.

## 8. Cookies

A aplicação de secretária **não usa cookies**. Se vier a existir um site, terá
aviso próprio.

## 9. Alterações a esta política

Se alterarmos esta política de forma significativa, avisamos por email com
antecedência razoável. A data no topo indica a última revisão.

---

*Dúvidas sobre privacidade: **cutpilotsync@gmail.com***
