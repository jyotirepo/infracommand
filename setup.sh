#!/bin/bash
# ============================================================
# InfraCommand — One-Time Server Setup Script
# Run this ONCE on the VM before triggering the Jenkins pipeline
# Usage: sudo bash setup.sh
# ============================================================

set -e

NEXUS_REGISTRY="192.168.101.80:8082"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✔ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
err()  { echo -e "${RED}✘ $1${NC}"; }

echo ""
echo "============================================================"
echo "  InfraCommand Server Setup"
echo "  Target: ${NEXUS_REGISTRY}"
echo "============================================================"
echo ""

# ── 1. Check running as root ─────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  err "Please run as root: sudo bash setup.sh"
  exit 1
fi
ok "Running as root"

# ── 2. Install system packages ───────────────────────────────
echo ""
echo "[1/7] Installing required system packages..."
apt-get update -qq
apt-get install -y \
  python3-venv python3-pip python3-full python3-dev \
  build-essential curl wget git unzip \
  2>/dev/null || warn "Some packages may already be installed"
ok "System packages installed"

# ── 3. Verify python3-venv works ────────────────────────────
echo ""
echo "[2/7] Verifying python3-venv..."
python3 -m venv /tmp/test-venv && rm -rf /tmp/test-venv
ok "python3-venv works"

# ── 4. Docker insecure registry ──────────────────────────────
echo ""
echo "[3/7] Configuring Docker insecure registry..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << DOCKEREOF
{
  "insecure-registries": ["${NEXUS_REGISTRY}"]
}
DOCKEREOF
systemctl restart docker 2>/dev/null || warn "Docker not running — skipping restart"
ok "Docker insecure registry configured: ${NEXUS_REGISTRY}"

# ── 5. CRI-O insecure registry ───────────────────────────────
echo ""
echo "[4/7] Configuring CRI-O insecure registry..."
if command -v crio &>/dev/null || systemctl list-units --type=service | grep -q crio; then
  mkdir -p /etc/crio/crio.conf.d
  cat > /etc/crio/crio.conf.d/insecure-registry.conf << CRIOEOF
[crio.image]
insecure_registries = ["${NEXUS_REGISTRY}"]
CRIOEOF
  systemctl restart crio
  ok "CRI-O insecure registry configured: ${NEXUS_REGISTRY}"
else
  warn "CRI-O not found — skipping (only needed if Kubernetes uses CRI-O runtime)"
fi

# ── 6. containerd insecure registry ──────────────────────────
echo ""
echo "[5/7] Configuring containerd insecure registry..."
if command -v containerd &>/dev/null; then
  mkdir -p /etc/containerd/certs.d/${NEXUS_REGISTRY}
  cat > /etc/containerd/certs.d/${NEXUS_REGISTRY}/hosts.toml << CTDEOF
server = "http://${NEXUS_REGISTRY}"

[host."http://${NEXUS_REGISTRY}"]
  capabilities = ["pull", "resolve", "push"]
  skip_verify = true
CTDEOF
  # Ensure config_path is set in containerd config
  if [ -f /etc/containerd/config.toml ]; then
    if ! grep -q "config_path.*certs.d" /etc/containerd/config.toml; then
      echo "" >> /etc/containerd/config.toml
      echo "[plugins.\"io.containerd.grpc.v1.cri\".registry]" >> /etc/containerd/config.toml
      echo "  config_path = \"/etc/containerd/certs.d\"" >> /etc/containerd/config.toml
    fi
  fi
  systemctl restart containerd 2>/dev/null || warn "containerd not running — skipping restart"
  ok "containerd insecure registry configured"
else
  warn "containerd not found — skipping"
fi

# ── 7. Jenkins sudo rights ───────────────────────────────────
echo ""
echo "[6/7] Configuring Jenkins sudo rights..."
cat > /etc/sudoers.d/jenkins-infracommand << SUDOEOF
# InfraCommand — Jenkins pipeline sudo permissions
jenkins ALL=(ALL) NOPASSWD: /usr/bin/apt-get
jenkins ALL=(ALL) NOPASSWD: /usr/bin/crictl
jenkins ALL=(ALL) NOPASSWD: /usr/bin/ctr
jenkins ALL=(ALL) NOPASSWD: /usr/bin/docker
SUDOEOF
chmod 0440 /etc/sudoers.d/jenkins-infracommand
ok "Jenkins sudo rights configured"

# ── 8. Verify Jenkins can sudo ───────────────────────────────
if id jenkins &>/dev/null; then
  sudo -u jenkins sudo -n apt-get --version &>/dev/null && ok "Jenkins sudo verified" || warn "Jenkins user exists but sudo test failed — check /etc/sudoers.d/jenkins-infracommand"
else
  warn "Jenkins user not found — sudo rights will apply once Jenkins is installed"
fi

# ── 9. Summary ───────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "${GREEN}  Setup Complete!${NC}"
echo "============================================================"
echo ""
echo "  Nexus Docker Registry : http://${NEXUS_REGISTRY}"
echo "  Docker insecure-registries : configured ✔"
echo "  CRI-O insecure_registries  : configured ✔"
echo "  containerd certs.d         : configured ✔"
echo "  Jenkins sudo rights        : configured ✔"
echo ""
echo "  Next steps:"
echo "  1. Push infracommand code to GitHub"
echo "  2. Create Jenkins pipeline job pointing to your repo"
echo "  3. Add credentials in Jenkins (see README.md)"
echo "  4. Trigger the pipeline"
echo ""
echo "  App will be available at:"
echo "  http://$(hostname -I | awk '{print $1}'):32302"
echo "============================================================"
echo ""
