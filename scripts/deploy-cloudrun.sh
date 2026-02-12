#!/usr/bin/env bash
set -euo pipefail

# deploy-cloudrun.sh
# Safe deploy wrapper for Cloud Build: ignores any unexpected positional
# arguments that Cloud Build may append to the step and deploys the image
# built earlier. Uses environment substitutions when available.

echo "deploy-cloudrun.sh starting..."

if [ "$#" -gt 0 ]; then
  echo "Ignoring unexpected args passed to script: $*"
fi

# Determine tag fallback (SHORT_SHA is supplied by Cloud Build when available)
TAG="${SHORT_SHA:-}"
if [ -z "$TAG" ]; then
  TAG="manual"
fi

REPO="${_REPO:-fat-bipe}"
SERVICE="${_SERVICE:-varzea-pro-scout}"
REGION="${_REGION:-us-west1}"
PROJECT="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
if [ -z "${PROJECT}" ]; then
  PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
fi
if [ -z "${PROJECT}" ] || [ "${PROJECT}" = "(unset)" ]; then
  echo "ERROR: project id not found. Set PROJECT_ID or GOOGLE_CLOUD_PROJECT in Cloud Build env."
  exit 1
fi

IMAGE="gcr.io/${PROJECT}/${REPO}:${TAG}"

echo "Deploying image: ${IMAGE}"
echo "Service: ${SERVICE}, Region: ${REGION}, Project: ${PROJECT}"

# Execute the deploy
gcloud --quiet run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --allow-unauthenticated

echo "deploy-cloudrun.sh finished"
