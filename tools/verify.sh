#!/usr/bin/env bash
# Verificación completa de MiniApps: las seis suites (lógica pura + navegador).
# Necesita node y Chrome; las suites de navegador se saltan solas si no lo encuentran.
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
