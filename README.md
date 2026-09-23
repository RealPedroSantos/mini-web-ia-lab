# Mini Web AI Lab

MVP experimental de chat web que tenta resolver perguntas com o menor custo computacional possível. A arquitetura prioriza regras locais, cálculo local, cache e pesquisa web seletiva antes de chamar um modelo generativo.

## Arquitetura

```text
Usuário
  ↓
Cache
  ↓ miss
Roteador local por regras
  ├─ CALCULATION ─→ parser matemático local ─→ resposta
  ├─ CONVERSATION ─→ resolvedor local quando possível
  ├─ DIRECT ─→ base local quando possível ─→ modelo pequeno se necessário
  ├─ CODE ─→ modelo
  ├─ COMPLEX_REASONING ─→ modelo
  └─ WEB_SEARCH
       ↓
   consulta curta otimizada
       ↓
   Brave Search API
       ↓
   3–5 resultados compactados
       ↓
   modelo generativo
       ↓
   resposta + fontes + métricas
```

A decisão do roteador é registrada no terminal em JSON, por exemplo:

```json
{
  "query": "quanto é 100 dividido por 4",
  "route": "CALCULATION",
  "web": false,
  "llm": false,
  "cache": "MISS",
  "result": "25"
}
```

## O que funciona nesta versão

- Chat HTML/CSS/JavaScript Vanilla.
- Histórico local no navegador.
- Markdown seguro básico, blocos de código e botão de copiar.
- Tema claro/escuro.
- Modos Econômico, Normal e Qualidade.
- Roteamento local entre `DIRECT`, `WEB_SEARCH`, `CALCULATION`, `CODE`, `CONVERSATION` e `COMPLEX_REASONING`.
- Cálculo local sem `eval`.
- Respostas locais para saudações e uma pequena base estável de demonstração.
- Detecção de perguntas atuais e de pedidos de validação/múltiplas fontes.
- Otimização local da consulta de pesquisa sem enviar o histórico ao buscador.
- Brave Search API como implementação real do módulo de pesquisa.
- OpenAI Responses API como implementação real do módulo generativo.
- Contexto web compacto de 3 a 5 fontes.
- Cache em memória com TTL diferente para conteúdo volátil e estável.
- Rate limit básico por IP.
- Limite de tamanho de mensagem.
- CORS restrito quando `ALLOWED_ORIGIN` é configurado.
- API keys exclusivamente no backend.
- Painel `/lab.html` com métricas da sessão do navegador.
- Registro de tokens quando o provedor os retorna.

## Estrutura

```text
mini-web-ai-lab/
├── public/
│   ├── index.html
│   ├── lab.html
│   ├── style.css
│   ├── app.js
│   └── lab.js
├── api/
│   └── chat.js
├── src/
│   ├── router.js
│   ├── webSearch.js
│   ├── aiProvider.js
│   ├── cache.js
│   ├── calculator.js
│   ├── contextBuilder.js
│   ├── localResolver.js
│   ├── metrics.js
│   └── rateLimit.js
├── test/
│   ├── router.test.js
│   └── calculator.test.js
├── local-server.js
├── .env.example
├── package.json
├── vercel.json
└── README.md
```

## Requisitos

- Node.js 22.x.
- Uma chave de pesquisa web para perguntas atuais.
- Uma chave de IA para perguntas que não possam ser resolvidas localmente.

## 1. Instalar

```bash
npm install
```

## 2. Configurar `.env`

Copie o exemplo:

```bash
cp .env.example .env
```

### OpenAI

Serviço usado nesta primeira versão: OpenAI Responses API.

Crie uma chave em:

https://platform.openai.com/api-keys

Configure:

```env
AI_PROVIDER=openai
AI_MODEL=gpt-5.6-luna
AI_QUALITY_MODEL=gpt-5.6-terra
AI_ROUTER_MODEL=gpt-5.6-luna
AI_API_KEY=sk-...
```

`gpt-5.6-luna` é usado como modelo econômico padrão. O modo Qualidade pode usar `gpt-5.6-terra`.

O projeto chama diretamente o endpoint REST `POST https://api.openai.com/v1/responses`, portanto não depende do SDK da OpenAI.

### Brave Search

Serviço usado nesta primeira versão: Brave Search API.

Crie uma conta/chave em:

https://brave.com/search/api/

Documentação:

https://api-dashboard.search.brave.com/app/documentation/web-search

Configure:

```env
WEB_SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=sua-chave
WEB_SEARCH_COUNTRY=BR
WEB_SEARCH_LANG=pt-br
```

A pesquisa usa o endpoint oficial:

```text
GET https://api.search.brave.com/res/v1/web/search
```

A chave é enviada no header `X-Subscription-Token` apenas pelo backend.

## 3. Rodar localmente

```bash
npm run dev
```

Abra:

```text
http://localhost:3000
```

Painel de laboratório:

```text
http://localhost:3000/lab.html
```

Health check local:

```text
http://localhost:3000/health
```

## 4. Testar

Execute os testes locais do roteador e calculadora:

```bash
npm test
```

Testes manuais sugeridos:

```text
Quanto é 25 x 48?
→ CALCULATION, internet Não, modelo nenhum

Olá
→ CONVERSATION, internet Não, modelo nenhum

Quem descobriu o Brasil?
→ DIRECT, resposta local, modelo nenhum

Qual é a versão atual do iOS?
→ WEB_SEARCH, internet Sim, Brave + modelo

Qual foi o resultado do jogo do Flamengo hoje?
→ WEB_SEARCH, internet Sim

Faça um código JavaScript para ordenar uma lista.
→ CODE, modelo Sim, internet Não

Explique relatividade geral detalhadamente.
→ COMPLEX_REASONING, modelo Sim, internet Não
```

## 5. Classificador por modelo pequeno

Por padrão ele fica desligado para evitar uma chamada extra:

```env
ROUTER_LLM_ENABLED=false
```

Para testar o conceito de um mini-modelo de decisão em perguntas ambíguas:

```env
ROUTER_LLM_ENABLED=true
ROUTER_LLM_CONFIDENCE_THRESHOLD=0.58
AI_ROUTER_MODEL=gpt-5.6-luna
```

O modo `ECONOMICO` não chama esse classificador adicional mesmo quando a opção global está ligada.

Isso permite comparar dois experimentos:

1. roteador 100% determinístico;
2. regras locais + modelo pequeno apenas para baixa confiança.

## 6. Modos experimentais

### ECONOMICO

- Até 3 fontes.
- Histórico mais curto.
- Contexto menor.
- Saída menor.
- Classificador por LLM adicional desativado.
- Modelo padrão econômico.

### NORMAL

- Até 4 fontes.
- Histórico e contexto intermediários.
- Modelo padrão econômico.

### QUALIDADE

- Até 5 fontes.
- Mais histórico e contexto.
- Saída maior.
- Pode usar `AI_QUALITY_MODEL`.

## 7. Cache

O cache atual é em memória do processo Node.

TTL inicial:

- cotação/preço/câmbio: 1 minuto;
- notícias, clima, placar e informação atual: 5 minutos;
- pesquisa web genérica: 5 minutos;
- código: 6 horas;
- conhecimento estável e cálculo: 24 horas.

Perguntas que parecem depender fortemente do histórico não usam cache.

Na Vercel, esse cache é por instância e não é persistente. Para produção, o próximo passo natural é criar um adaptador Redis/Upstash mantendo a mesma interface de `cache.js`.

## 8. Segurança aplicada

- Nenhuma chave é enviada ao navegador.
- Mensagem limitada por `MAX_MESSAGE_CHARS`.
- Corpo JSON limitado no servidor local.
- Rate limit básico por IP.
- Sem `eval` na calculadora.
- Código do usuário nunca é executado.
- HTML do Markdown é escapado antes da renderização.
- URLs renderizadas no chat aceitam somente `http:` e `https:`.
- Content Security Policy no frontend.
- CORS opcional por origem exata.
- Trechos recuperados da web são tratados como dados não confiáveis e não como instruções.

## 9. Publicar na Vercel

A Vercel continua aceitando funções Node dentro da pasta `/api`. Este projeto usa `/api/chat.js` como função e `vercel.json` apenas para mapear os arquivos estáticos de `/public` para URLs amigáveis.

Instale a CLI atual:

```bash
npm i -g vercel@latest
```

Na pasta do projeto:

```bash
vercel
```

Para produção:

```bash
vercel --prod
```

No painel do projeto, abra `Settings > Environment Variables` e cadastre pelo menos:

```text
AI_PROVIDER
AI_MODEL
AI_QUALITY_MODEL
AI_API_KEY
WEB_SEARCH_PROVIDER
BRAVE_SEARCH_API_KEY
WEB_SEARCH_COUNTRY
WEB_SEARCH_LANG
```

Para o domínio de produção, configure também:

```text
ALLOWED_ORIGIN=https://seu-projeto.vercel.app
```

Depois de alterar variáveis de ambiente, faça um novo deploy.

O projeto está fixado em Node.js 22.x. Isso evita depender do Node 20, cuja criação de novos deployments na Vercel está programada para ser desativada em 1º de outubro de 2026.

## 10. Como trocar provedores futuramente

### Pesquisa

Implemente outro adaptador dentro de `src/webSearch.js` mantendo a saída:

```js
{
  provider: 'nome',
  query: 'consulta',
  results: [
    {
      title: '...',
      url: 'https://...',
      snippet: '...',
      date: null
    }
  ]
}
```

### IA

Implemente outro provedor em `src/aiProvider.js` mantendo a saída de `generateAnswer()`:

```js
{
  text: 'resposta',
  model: 'modelo',
  latency: 320,
  tokens: {
    input: 100,
    output: 40
  }
}
```

O restante do sistema não precisa conhecer o SDK ou formato interno do provedor.

## 11. Próximo experimento recomendado

A métrica principal do projeto é:

```text
requisições sem modelo / total de perguntas
```

O painel também mede resolução local, buscas web, cache hits, chamadas reais ao modelo, tokens e latência.

O próximo passo útil é exportar os registros de decisão para JSON/CSV e montar um conjunto de 500–1.000 perguntas reais. Assim será possível medir precisão do roteador, falsos positivos de busca web e economia real de chamadas antes de substituir as regras por um mini-modelo especializado.
