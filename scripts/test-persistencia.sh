#!/usr/bin/env bash
# Prova de persistência com processo real: altera dados via HTTP, mata o servidor
# com SIGKILL, sobe outro processo e compara o que a API devolve antes e depois.
# Uso: npm run build && bash scripts/test-persistencia.sh
# Variáveis opcionais: DATA_DIR (padrão: pasta temporária), PORT (padrão: 3456).
set -euo pipefail

cd "$(dirname "$0")/.."
export DATA_DIR="${DATA_DIR:-$(mktemp -d)}"
export PORT="${PORT:-3456}"
BASE="http://localhost:$PORT"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then kill -9 "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

start_server() {
  node dist/main.js >/dev/null &
  SERVER_PID=$!
  for _ in $(seq 1 50); do
    if curl -sf "$BASE/tasks" >/dev/null; then return 0; fi
    kill -0 "$SERVER_PID" 2>/dev/null || { echo "servidor morreu ao iniciar"; exit 1; }
    sleep 0.2
  done
  echo "servidor não respondeu"; exit 1
}

stop_server() {
  kill -9 "$SERVER_PID"
  wait "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
}

# send VERBO ROTA [JSON]: falha se a API responder com erro.
send() {
  curl -sSf -X "$1" "$BASE$2" -H 'Content-Type: application/json' ${3:+-d "$3"}
}

id_of() { node -pe 'JSON.parse(require("fs").readFileSync(0)).id'; }

echo "DATA_DIR=$DATA_DIR"
start_server

TASK=$(send POST /tasks '{"title":"Estudar","description":"NestJS"}' | id_of)
TASK_GONE=$(send POST /tasks '{"title":"Apagar"}' | id_of)
send PUT "/tasks/$TASK" '{"title":"Estudar NestJS","description":"Rotas"}' >/dev/null
send PATCH "/tasks/$TASK" '{"completed":true}' >/dev/null
send DELETE "/tasks/$TASK_GONE" >/dev/null

BOOK=$(send POST /books '{"title":"Dom Casmurro","author":"Machado"}' | id_of)
BOOK_GONE=$(send POST /books '{"title":"Apagar","author":"A"}' | id_of)
send PUT "/books/$BOOK" '{"title":"Dom Casmurro","author":"Machado de Assis","year":1899}' >/dev/null
send PATCH "/books/$BOOK" '{"read":true}' >/dev/null
send DELETE "/books/$BOOK_GONE" >/dev/null

TASKS_BEFORE=$(send GET /tasks)
BOOKS_BEFORE=$(send GET /books)
echo "antes  /tasks: $TASKS_BEFORE"
echo "antes  /books: $BOOKS_BEFORE"

stop_server
echo "--- servidor morto com SIGKILL, subindo novo processo ---"
start_server

TASKS_AFTER=$(send GET /tasks)
BOOKS_AFTER=$(send GET /books)
echo "depois /tasks: $TASKS_AFTER"
echo "depois /books: $BOOKS_AFTER"

if [[ "$TASKS_BEFORE" == "$TASKS_AFTER" && "$BOOKS_BEFORE" == "$BOOKS_AFTER" ]]; then
  echo "OK: dados iguais após o reinício"
else
  echo "FALHA: dados diferentes após o reinício"
  exit 1
fi
