#!/usr/bin/env bash
#
# Dev-only fixture: creates 3 accounts (Owner/Recruiter/Interviewer), a workspace, two
# job openings (one Open, one Draft), and a handful of candidates spread across the
# hiring board's stages, by driving the real HTTP API end to end (register -> CSRF ->
# create workspace -> invite -> accept -> create/open jobs -> add/move candidates).
#
# Intended to run ONCE against a fresh, empty local database, right after
# `docker compose up -d --build` and `dotnet ef database update`. Not idempotent: running
# it twice against the same database will fail on the second registration/invitation
# since the accounts and workspace already exist.
#
# Usage:
#   ./scripts/seed-dev-accounts.sh
#
# Override the API base URL if it isn't the Compose default:
#   API_URL=http://localhost:8080 ./scripts/seed-dev-accounts.sh

set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"

# Dev-only fixture credentials. Never use these outside a local/disposable database.
DEV_PASSWORD="DevPassword123"
OWNER_EMAIL="owner@example.com"
RECRUITER_EMAIL="recruiter@example.com"
INTERVIEWER_EMAIL="interviewer@example.com"

WORKSPACE_NAME="Acme Hiring"
JOB_OPEN_TITLE="Senior Backend Engineer"
JOB_DRAFT_TITLE="Product Designer (Draft)"

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

OWNER_JAR="$(mktemp)"
RECRUITER_JAR="$(mktemp)"
INTERVIEWER_JAR="$(mktemp)"
cleanup() { rm -f "$OWNER_JAR" "$RECRUITER_JAR" "$INTERVIEWER_JAR"; }
trap cleanup EXIT

log() { echo "==> $*"; }

# Fetches a CSRF token into the given cookie jar and prints it.
csrf_token() {
  local jar="$1"
  curl -sS -c "$jar" -b "$jar" "$API_URL/api/auth/csrf" -o /dev/null
  awk -F'\t' '$6 == "XSRF-TOKEN" { print $7 }' "$jar" | tail -n1
}

# api METHOD PATH JAR [JSON_BODY]
# Sends a request with cookies from JAR, CSRF header for mutating methods, and prints
# the response body. Fails loudly (with the response body) on a non-2xx status.
api() {
  local method="$1" path="$2" jar="$3" body="${4:-}"
  local args=(-sS -c "$jar" -b "$jar" -X "$method" "$API_URL$path" -H "Content-Type: application/json")

  case "$method" in
    POST|PATCH|DELETE|PUT)
      local token
      token="$(csrf_token "$jar")"
      args+=(-H "X-XSRF-TOKEN: $token")
      ;;
  esac

  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi

  local http_code response
  response="$(curl "${args[@]}" -w $'\n%{http_code}')"
  http_code="$(tail -n1 <<<"$response")"
  response="$(sed '$d' <<<"$response")"

  if [[ "$http_code" -ge 400 ]]; then
    echo "Request failed: $method $path -> $http_code" >&2
    echo "$response" >&2
    exit 1
  fi

  echo "$response"
}

register() {
  local email="$1" display_name="$2" jar="$3"
  log "Registering $email"
  api POST /api/auth/register "$jar" \
    "$(jq -n --arg e "$email" --arg p "$DEV_PASSWORD" --arg n "$display_name" \
      '{email:$e, password:$p, displayName:$n}')" >/dev/null
}

login() {
  local email="$1" jar="$2"
  log "Logging in $email"
  api POST /api/auth/login "$jar" \
    "$(jq -n --arg e "$email" --arg p "$DEV_PASSWORD" '{email:$e, password:$p}')" >/dev/null
}

register "$OWNER_EMAIL" "Olivia Owner" "$OWNER_JAR"
register "$RECRUITER_EMAIL" "Rae Recruiter" "$RECRUITER_JAR"
register "$INTERVIEWER_EMAIL" "Ivan Interviewer" "$INTERVIEWER_JAR"

# Registration already signs the caller in, but log in explicitly so each cookie jar
# holds a freshly-issued session (keeps this script correct even if registration ever
# stops auto-authenticating).
login "$OWNER_EMAIL" "$OWNER_JAR"

log "Creating workspace '$WORKSPACE_NAME' as Owner"
WORKSPACE_JSON="$(api POST /api/workspaces "$OWNER_JAR" \
  "$(jq -n --arg n "$WORKSPACE_NAME" '{name:$n}')")"
WORKSPACE_ID="$(jq -r '.id' <<<"$WORKSPACE_JSON")"
log "Workspace ID: $WORKSPACE_ID"

invite_and_accept() {
  local email="$1" role="$2" jar="$3"
  log "Inviting $email as $role"
  local invitation_json token
  invitation_json="$(api POST "/api/workspaces/$WORKSPACE_ID/invitations" "$OWNER_JAR" \
    "$(jq -n --arg e "$email" --arg r "$role" '{email:$e, role:$r}')")"
  token="$(jq -r '.token' <<<"$invitation_json")"

  login "$email" "$jar"
  log "Accepting invitation for $email"
  api POST "/api/invitations/$token/accept" "$jar" >/dev/null
}

invite_and_accept "$RECRUITER_EMAIL" "Recruiter" "$RECRUITER_JAR"
invite_and_accept "$INTERVIEWER_EMAIL" "Interviewer" "$INTERVIEWER_JAR"

log "Creating job '$JOB_OPEN_TITLE' as Owner"
JOB_OPEN_JSON="$(api POST "/api/workspaces/$WORKSPACE_ID/jobs" "$OWNER_JAR" \
  "$(jq -n --arg t "$JOB_OPEN_TITLE" --arg d "Own the backend platform for our hiring product." \
    '{title:$t, description:$d}')")"
JOB_OPEN_ID="$(jq -r '.id' <<<"$JOB_OPEN_JSON")"
JOB_OPEN_VERSION="$(jq -r '.version' <<<"$JOB_OPEN_JSON")"

log "Opening job $JOB_OPEN_ID"
api PATCH "/api/workspaces/$WORKSPACE_ID/jobs/$JOB_OPEN_ID/status" "$OWNER_JAR" \
  "$(jq -n --arg v "$JOB_OPEN_VERSION" '{status:"Open", version:$v}')" >/dev/null

log "Creating a second job '$JOB_DRAFT_TITLE' (left in Draft)"
api POST "/api/workspaces/$WORKSPACE_ID/jobs" "$OWNER_JAR" \
  "$(jq -n --arg t "$JOB_DRAFT_TITLE" '{title:$t}')" >/dev/null

add_candidate() {
  local name="$1" email="$2"
  api POST "/api/workspaces/$WORKSPACE_ID/jobs/$JOB_OPEN_ID/candidates" "$OWNER_JAR" \
    "$(jq -n --arg n "$name" --arg e "$email" '{name:$n, email:$e}')"
}

move_candidate() {
  local candidate_json="$1" stage="$2"
  local id version
  id="$(jq -r '.id' <<<"$candidate_json")"
  version="$(jq -r '.version' <<<"$candidate_json")"
  api PATCH "/api/workspaces/$WORKSPACE_ID/candidates/$id/stage" "$OWNER_JAR" \
    "$(jq -n --arg s "$stage" --arg v "$version" '{stage:$s, version:$v}')"
}

log "Adding candidates to '$JOB_OPEN_TITLE' across pipeline stages"
add_candidate "Alice Applicant" "alice.applicant@example.com" >/dev/null

BOB_JSON="$(add_candidate "Bob Screening" "bob.screening@example.com")"
move_candidate "$BOB_JSON" "Screening" >/dev/null

CARL_JSON="$(add_candidate "Carla Interview" "carla.interview@example.com")"
CARL_JSON="$(move_candidate "$CARL_JSON" "Screening")"
move_candidate "$CARL_JSON" "Interview" >/dev/null

DANA_JSON="$(add_candidate "Dana Offer" "dana.offer@example.com")"
DANA_JSON="$(move_candidate "$DANA_JSON" "Screening")"
DANA_JSON="$(move_candidate "$DANA_JSON" "Interview")"
move_candidate "$DANA_JSON" "Offer" >/dev/null

ERIN_JSON="$(add_candidate "Erin Rejected" "erin.rejected@example.com")"
move_candidate "$ERIN_JSON" "Rejected" >/dev/null

log "Adding internal notes so the workspace overview has note activity"
CARL_ID="$(jq -r '.id' <<<"$CARL_JSON")"
DANA_ID="$(jq -r '.id' <<<"$DANA_JSON")"
api POST "/api/workspaces/$WORKSPACE_ID/candidates/$CARL_ID/notes" "$INTERVIEWER_JAR" \
  "$(jq -n '{content: "Strong system-design answers; recommend advancing to the next round."}')" >/dev/null
api POST "/api/workspaces/$WORKSPACE_ID/candidates/$DANA_ID/notes" "$OWNER_JAR" \
  "$(jq -n '{content: "Reference checks came back positive. Preparing an offer."}')" >/dev/null

cat <<EOF

Seed complete.

Workspace:    $WORKSPACE_NAME ($WORKSPACE_ID)
Open job:     $JOB_OPEN_TITLE ($JOB_OPEN_ID) -- candidate intake enabled
              5 candidates seeded across Applied/Screening/Interview/Offer/Rejected
              2 internal notes seeded on Carla and Dana
Draft job:    $JOB_DRAFT_TITLE -- candidate intake disabled

Accounts (dev-only, do not reuse these credentials anywhere else):
  Owner:        $OWNER_EMAIL       / $DEV_PASSWORD
  Recruiter:    $RECRUITER_EMAIL   / $DEV_PASSWORD
  Interviewer:  $INTERVIEWER_EMAIL / $DEV_PASSWORD

Sign in at $API_URL's frontend (default http://localhost:3000/login) with any of the
above to exercise role-specific behavior.
EOF
