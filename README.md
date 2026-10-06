# App Cadastro MI

Aplicação web em Node.js para cadastro de **Visitas**. 

## Funcionalidades
- Rotas dedicadas:
- Formulários completos com envio para API local.
- Seleção de **Comum congregação** com modal de busca.
- Filtro por qualquer trecho (ex.: `car` encontra `Vila Doutor Cardoso`).
- Dados salvos localmente em arquivo NDJSON.

## Requisitos
- Node.js 18+ (recomendado 20+)

## Estrutura
```txt
src/
  server.js                # servidor HTTP e rotas
public/
  index.html               # página inicial
  cadastro.html            # página de formulários
  styles/main.css          # estilos
  scripts/cadastro.js      # lógica da página de cadastro
  scripts/comuns.js        # modal e busca de comuns
  assets/                  # logos e favicon
data/
  cadastros.ndjson         # base local de envios
```

## Executar localmente
```bash
npm start
```

Ou em modo desenvolvimento:
```bash
npm run dev
```

Acesse:
- `http://localhost:3000`

## Variáveis de ambiente (opcional)
Arquivo de exemplo: `.env.example`

- `PORT` (padrão: `3000`)


## Rotas da aplicação
- `GET /` -> tela inicial

## Publicação no GitHub
Repositório alvo:
`https://github.com/CCB-Regional-Itapevi/appvisitas.git`

Comandos (quando o repositório local estiver no escopo correto):
```bash
git add .
git commit -m "feat: estrutura completa do app cadastro MI com seleção de comuns por modal"
git branch -M main
git remote add origin https://github.com/CCB-Regional-Itapevi/appvisitas.git
git push -u origin main
```


## Supabase compartilhado com APP_GLOBAL

Use as mesmas variaveis SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY da matriz. O backend tambem exige SUPABASE_SECRET_KEY; essa chave fica apenas no servidor e nao aparece em /api/config. Configure os tres nomes na Vercel e faca um novo deploy. .env e .env.local sao locais, ignorados pelo Git e pelo upload da Vercel.

A configuracao vem exclusivamente do ambiente: nao ha retorno automatico ao projeto antigo. Variaveis de deploy tem prioridade sobre arquivos locais. Os nomes antigos SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY sao aceitos para compatibilidade, mas prefira os nomes novos.

Atividades EBI usam ebi_atividades; lancamentos de visitas usam visitas_lancamentos. O fluxo de cadastro de criancas e monitores por webhook foi removido por estar obsoleto. Esses endpoints de cadastro nao sao mais disponibilizados.

Execute npm test para verificar configuracao publica, isolamento de segredo e destino de gravacao com requisicoes simuladas.
