# API de Tasks e Books (NestJS)

API REST com dois módulos, `tasks` e `books`. Os dados ficam em arquivos JSON e continuam disponíveis depois que o servidor reinicia.

## Como rodar

Requer Node 22 ou superior.

```bash
npm ci
npm run build
npm run start:prod   # http://localhost:3000
```

Use `npm ci`: no npm 10, `npm install` sem o `package-lock.json` falha com `Cannot read properties of null (reading 'edgesOut')`.

Variáveis de ambiente opcionais: `PORT` (padrão `3000`) e `DATA_DIR` (padrão `./data`).

## Rotas

As rotas são iguais nos dois módulos, trocando `tasks` por `books`.

| Verbo | Rota | O que faz | Sucesso |
|---|---|---|---|
| GET | `/tasks` | lista todos | 200 |
| GET | `/tasks/:id` | busca um | 200 |
| POST | `/tasks` | cria | 201 |
| PUT | `/tasks/:id` | substitui; campos opcionais omitidos voltam ao padrão | 200 |
| PATCH | `/tasks/:id` | altera só os campos enviados | 200 |
| DELETE | `/tasks/:id` | remove | 204 |

Um id inexistente retorna 404. Um corpo inválido ou com campos desconhecidos retorna 400.

### Campos

| Módulo | Campo | Tipo | Obrigatório | Padrão |
|---|---|---|---|---|
| Task | `title` | string não vazia | sim | |
| Task | `description` | string | não | |
| Task | `completed` | boolean | não | `false` |
| Book | `title` | string não vazia | sim | |
| Book | `author` | string não vazia | sim | |
| Book | `year` | inteiro | não | |
| Book | `read` | boolean | não | `false` |

`id`, `createdAt` e `updatedAt` são gerados pela API.

### Exemplos

```bash
curl -X POST localhost:3000/tasks -H 'Content-Type: application/json' \
  -d '{"title":"Estudar NestJS"}'
curl localhost:3000/tasks
curl -X PUT localhost:3000/tasks/<id> -H 'Content-Type: application/json' \
  -d '{"title":"Revisar NestJS","description":"Rotas"}'
curl -X PATCH localhost:3000/tasks/<id> -H 'Content-Type: application/json' \
  -d '{"completed":true}'
curl -X DELETE localhost:3000/tasks/<id>

curl -X POST localhost:3000/books -H 'Content-Type: application/json' \
  -d '{"title":"Dom Casmurro","author":"Machado de Assis","year":1899}'
```

## Persistência

Cada módulo grava em seu arquivo: `data/tasks.json` e `data/books.json`. A classe `JsonRepository` (`src/common/json-repository.ts`) carrega o arquivo ao iniciar e atende as leituras pela memória. Cada alteração entra em uma fila, é gravada em um arquivo temporário e substitui o original com `rename`. Assim, requisições simultâneas não se sobrescrevem e uma queda no meio da gravação não corrompe o JSON.

## Testes

```bash
npm run test:e2e                                  # todas as rotas, erros 400/404 e reinício da aplicação
npm run build && bash scripts/test-persistencia.sh  # reinício real do processo
```

O script usa todos os verbos via `curl`, mata o servidor com `SIGKILL`, sobe um novo processo e compara as respostas de `GET /tasks` e `GET /books` antes e depois. Por padrão ele usa uma pasta temporária, sem tocar em `data/`.
