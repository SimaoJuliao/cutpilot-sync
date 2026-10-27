# O que falta antes de publicar os Termos

Os [Termos](TERMOS.md) e a [Política de Privacidade](PRIVACIDADE.md) estão
escritos para um serviço por subscrição vendido a consumidores na UE. **Vários
pontos descrevem coisas que a aplicação ainda não faz.** Publicá-los sem isto
significaria prometer o que não se cumpre — o que é pior do que não ter termos.

---

## A. Verificar antes de prometer ⚠️

**Estas duas afirmações estão nos documentos e ainda não foram confirmadas.**
Se alguma não se verificar, corrige o texto em vez de o manter.

- [ ] **"Não usamos o teu conteúdo para treinar modelos, e exigimos o mesmo aos
      nossos fornecedores."** Confirmar nos contratos da Deepgram e da Anthropic,
      e ativar retenção zero / opt-out de treino onde existir. A Anthropic não
      treina com dados de API por omissão nos termos comerciais; a Deepgram
      depende do plano e das definições da conta.
- [ ] **Região de alojamento de cada fornecedor** (Deepgram, Anthropic, Supabase,
      processador de pagamentos). A tabela da secção 3 da Política tem
      `[confirmar]` em todas.

## B. Contratos de subcontratação (RGPD art. 28)

Obrigatório por lei, não é opcional: quem trata dados por tua conta tem de o
fazer ao abrigo de um contrato.

- [ ] Assinar/aceitar o DPA da **Deepgram**
- [ ] Assinar/aceitar o DPA da **Anthropic**
- [ ] Assinar/aceitar o DPA da **Supabase**
- [ ] Assinar/aceitar o DPA do **processador de pagamentos**
- [ ] Criar o **registo de atividades de tratamento** (RGPD art. 30)

## C. Campos por preencher

- [ ] **NIF** — `TERMOS.md` §1, `PRIVACIDADE.md` §1
- [ ] **Morada profissional** — idem (obrigatória na informação pré-contratual)
- [ ] **Preço e periodicidade** — `TERMOS.md` §5.1
- [ ] **Processador de pagamentos** — `TERMOS.md` §5.2, `PRIVACIDADE.md` §2.2 e §3
- [ ] **Comarca** para o foro B2B — `TERMOS.md` §19

## D. Escolher o processador de pagamentos

Decisão com consequências fiscais, não só técnicas.

Ao vender serviços digitais a consumidores noutros países da UE, o IVA é devido
**no país do consumidor**. Em nome individual, isso obriga a inscrever-te no
regime do **balcão único (OSS)** e a declarar IVA por país — trabalho recorrente.

Alternativa: um **Merchant of Record** (ex. Paddle, Lemon Squeezy) vende em nome
próprio e assume o IVA por ti. Cobra mais do que um Stripe, mas elimina a
obrigação declarativa. **Para um empresário em nome individual, é normalmente a
escolha certa** — mas confirma com o teu contabilista.

- [ ] Decidir processador
- [ ] Se fores por Stripe/direto: inscrição no **OSS** junto da AT

## E. Alterações necessárias na aplicação

Os documentos pressupõem estes comportamentos. Nenhum existe hoje no código.

### Registo

- [ ] **Confirmação de idade (18+)** no registo — `TERMOS.md` §3 exige-o e o
      ecrã de registo não pergunta nada
- [ ] **Caixa de aceitação** dos Termos e da Política de Privacidade, com links
      funcionais, antes de criar conta

### Compra

- [ ] **Botão de compra inequívoco** — a lei exige que o botão final diga
      expressamente que a encomenda implica pagar. Usar
      **"Subscrever e pagar"**, nunca "Continuar" ou "Confirmar"
- [ ] **Preço com IVA incluído** visível antes do pagamento, para consumidores
- [ ] **Consentimento expresso para início imediato** do serviço dentro dos 14
      dias, com reconhecimento das consequências — `TERMOS.md` §7 assenta nisto
- [ ] **Confirmação do contrato em suporte duradouro**: email após a compra com
      os Termos, a Política e o resumo da subscrição

### Durante a subscrição

- [ ] **Cancelar dentro da app**, sem ter de escrever email — `TERMOS.md` §6
      promete "quando quiseres, sem justificação"
- [ ] **Email de aviso antes de cada renovação** — `TERMOS.md` §5.3
- [ ] **Email de aviso de falha de pagamento** + os 14 dias antes de suspender
- [ ] **Aviso de alteração de preço** com 30 dias — `TERMOS.md` §5.5

### Acesso aos documentos

- [ ] Links para Termos, Privacidade e **Livro de Reclamações** dentro da app
      (ecrã de conta é o sítio natural)
- [ ] Publicar os três numa **página web acessível** — um ficheiro no GitHub não
      cumpre o dever de informação a consumidores

### Conta

- [x] Apagar conta na aplicação — **já existe** (Definições → Apagar conta)
- [ ] Verificar que apagar a conta também trata da subscrição ativa, ou avisar
      claramente que não trata — `TERMOS.md` §4 refere isso

## F. Revisão jurídica

- [ ] **Mandar rever por advogado.** Isto foi escrito com cuidado e com atenção
      à lei portuguesa e da UE, mas não substitui aconselhamento jurídico. Os
      pontos que eu mandaria olhar primeiro:
      - secção 7 (livre resolução) — é a mais fácil de errar num serviço
        contínuo com início imediato
      - secção 14 (responsabilidade) — os limites face a consumidores
      - a interação entre estes Termos e a [LICENSE](LICENSE) proprietária

---

## Ordem sugerida

1. **A** e **B** — porque são afirmações e obrigações legais já em curso
2. **D** — decide o processador; condiciona **C** e **E**
3. **C** — preencher campos
4. **E** — implementar na app
5. **F** — revisão jurídica
6. Publicar

Nada disto bloqueia o desenvolvimento normal da app. Bloqueia **cobrar dinheiro**.
