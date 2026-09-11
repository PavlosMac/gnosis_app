#!/bin/bash
set -euo pipefail

# Build ARM64 image and push to Docker Hub for Raspberry Pi deployment.
# Prerequisites (one-time): docker buildx create --name pibuilder --use

DOCKER_USERNAME="pavlos888"
IMAGE_NAME="gnosis-esoterica-api"
TAG="latest"
FULL_IMAGE="${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG}"

echo "==> Building ARM64 image: ${FULL_IMAGE}"
docker buildx build \
  --platform linux/arm64 \
  --tag "${FULL_IMAGE}" \
  --push \
  .

echo ""
echo "==> Image pushed to Docker Hub: ${FULL_IMAGE}"
echo ""
echo "On your Raspberry Pi:"
echo "  cd ~/projects/gnosis-esoterica"
echo "  ./scripts/pi-pull-and-start.sh"
