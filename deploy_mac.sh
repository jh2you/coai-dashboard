#!/usr/bin/env bash
set -euo pipefail

# === 설정값을 본인 환경에 맞게 변경하세요 ===
REPO_NAME="coai-dashboard"
GITHUB_USER="__YOUR_GITHUB_USERNAME__"
ETHERSCAN_KEY="__YOUR_ETHERSCAN_KEY__"
# ============================================

echo ">>> 요구 도구 확인 (git/node/netlify-cli)"
if ! command -v git >/dev/null 2>&1; then
  echo "git 설치 중... (Homebrew 필요)"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  brew install git
fi
command -v node >/dev/null 2>&1 || brew install node
command -v netlify >/dev/null 2>&1 || npm install -g netlify-cli

echo ">>> Git 초기화 및 GitHub 연결"
if [ ! -d ".git" ]; then
  git init
  git add .
  git commit -m "Initial commit - COAI Dashboard"
  git branch -M main
  git remote add origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
fi

echo ">>> Netlify 로그인 (브라우저가 열립니다)"
netlify login

echo ">>> Netlify 사이트 생성/연결 (수동 모드)"
# --manual: 현재 폴더를 Netlify 사이트로 등록
netlify init --manual --name "${REPO_NAME}" || true

echo ">>> 환경변수(ETHERSCAN_KEY) 설정"
netlify env:set ETHERSCAN_KEY "${ETHERSCAN_KEY}"

echo ">>> GitHub로 푸시 → Netlify가 자동 배포"
git push -u origin main

echo ">>> 사이트 페이지 열기"
netlify open:site

echo "완료! https://<사이트명>.netlify.app 에서 확인하세요."
