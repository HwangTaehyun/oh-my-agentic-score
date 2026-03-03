#!/usr/bin/env bash
#
# Oh My Agentic Score (omas) installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/HwangTaehyun/oh-my-agentic-score/main/install.sh | bash
#
# Environment variables:
#   OMAS_VERSION         - Specific version to install (default: latest)
#   OMAS_NO_MODIFY_PATH  - Set to 1 to skip PATH modification
#

set -euo pipefail

# --- Constants ---
PACKAGE_NAME="oh-my-agentic-score"
CLI_NAME="omas"
REPO_URL="https://github.com/HwangTaehyun/oh-my-agentic-score"
MIN_PYTHON_MAJOR=3
MIN_PYTHON_MINOR=11

# --- Colors (disabled if not a terminal) ---
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    DIM='\033[2m'
    RESET='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    BOLD=''
    DIM=''
    RESET=''
fi

# --- Helper Functions ---

info()    { printf "${BLUE}  info${RESET}  %s\n" "$1"; }
success() { printf "${GREEN}  ok${RESET}    %s\n" "$1"; }
warn()    { printf "${YELLOW}  warn${RESET}  %s\n" "$1" >&2; }
error()   { printf "${RED}  err${RESET}   %s\n" "$1" >&2; }
fatal()   { error "$1"; exit 1; }

# --- OS Detection ---

detect_os() {
    case "$(uname -s)" in
        Linux*)  echo "linux" ;;
        Darwin*) echo "macos" ;;
        CYGWIN*|MINGW*|MSYS*)
            fatal "Windows is not supported by this installer. Use: pip install ${PACKAGE_NAME}" ;;
        *)
            fatal "Unsupported OS: $(uname -s)" ;;
    esac
}

detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64)  echo "x86_64" ;;
        arm64|aarch64) echo "arm64" ;;
        *)             echo "$(uname -m)" ;;
    esac
}

# --- Python Detection ---

detect_python() {
    for cmd in python3 python; do
        if command -v "$cmd" &>/dev/null; then
            local version
            version=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0.0")
            local major minor
            major=$(echo "$version" | cut -d. -f1)
            minor=$(echo "$version" | cut -d. -f2)
            if [ "$major" -ge "$MIN_PYTHON_MAJOR" ] && [ "$minor" -ge "$MIN_PYTHON_MINOR" ]; then
                echo "$cmd"
                return 0
            fi
        fi
    done
    return 1
}

# --- Installer Detection (uv > pipx > pip) ---

detect_installer() {
    if command -v uv &>/dev/null; then
        echo "uv"; return 0
    fi
    if command -v pipx &>/dev/null; then
        echo "pipx"; return 0
    fi
    local python_cmd
    if python_cmd=$(detect_python 2>/dev/null); then
        if "$python_cmd" -m pip --version &>/dev/null; then
            echo "pip"; return 0
        fi
    fi
    echo "none"; return 1
}

# --- Installation ---

install_with_uv() {
    local spec="${PACKAGE_NAME}"
    [ -n "${OMAS_VERSION:-}" ] && spec="${PACKAGE_NAME}==${OMAS_VERSION}"
    info "Installing with uv tool install..."
    uv tool install "$spec" --force
    success "Installed via uv"
}

install_with_pipx() {
    local spec="${PACKAGE_NAME}"
    [ -n "${OMAS_VERSION:-}" ] && spec="${PACKAGE_NAME}==${OMAS_VERSION}"
    info "Installing with pipx..."
    pipx install "$spec" --force
    success "Installed via pipx"
}

install_with_pip() {
    local python_cmd
    python_cmd=$(detect_python)
    local spec="${PACKAGE_NAME}"
    [ -n "${OMAS_VERSION:-}" ] && spec="${PACKAGE_NAME}==${OMAS_VERSION}"
    warn "Using pip directly. Consider installing uv or pipx for isolated environments."
    info "Installing with pip..."
    "$python_cmd" -m pip install "$spec" --user --break-system-packages 2>/dev/null \
        || "$python_cmd" -m pip install "$spec" --user
    success "Installed via pip"
}

install_uv_first() {
    info "Installing uv (fast Python package manager)..."
    if command -v curl &>/dev/null; then
        curl -LsSf https://astral.sh/uv/install.sh | sh
    elif command -v wget &>/dev/null; then
        wget -qO- https://astral.sh/uv/install.sh | sh
    else
        fatal "Neither curl nor wget found. Cannot install uv."
    fi
    # Make uv available in current session
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    command -v uv &>/dev/null || fatal "Failed to install uv. Visit: https://docs.astral.sh/uv/"
    success "uv installed"
    install_with_uv
}

# --- PATH Setup ---

ensure_path() {
    local bin_dir="$1"
    [ "${OMAS_NO_MODIFY_PATH:-0}" = "1" ] && return

    # Already in PATH?
    echo "$PATH" | tr ':' '\n' | grep -qx "$bin_dir" && return

    local shell_name profile_file path_line
    shell_name="$(basename "${SHELL:-/bin/bash}")"

    case "$shell_name" in
        zsh)  profile_file="$HOME/.zshrc" ;;
        bash)
            if [ -f "$HOME/.bashrc" ]; then
                profile_file="$HOME/.bashrc"
            else
                profile_file="$HOME/.bash_profile"
            fi ;;
        fish) profile_file="$HOME/.config/fish/config.fish" ;;
        *)    profile_file="$HOME/.profile" ;;
    esac

    if [ "$shell_name" = "fish" ]; then
        path_line="set -gx PATH ${bin_dir} \$PATH"
    else
        path_line="export PATH=\"${bin_dir}:\$PATH\""
    fi

    if ! grep -qF "$bin_dir" "$profile_file" 2>/dev/null; then
        printf '\n# Added by %s installer\n%s\n' "$CLI_NAME" "$path_line" >> "$profile_file"
        info "Added ${bin_dir} to PATH in ${profile_file}"
    fi
}

# --- Verify ---

verify() {
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    if command -v "$CLI_NAME" &>/dev/null; then
        local ver loc
        ver=$("$CLI_NAME" --version 2>/dev/null || echo "unknown")
        loc=$(command -v "$CLI_NAME")
        echo ""
        success "${BOLD}${CLI_NAME}${RESET} is ready!"
        info "Version:  ${ver}"
        info "Location: ${loc}"
    else
        echo ""
        warn "${CLI_NAME} installed but not on PATH yet."
        info "Run: exec \$SHELL"
    fi
}

# --- Main (wrapped to prevent partial execution on interrupted download) ---

main() {
    printf "\n"
    printf "  ${BOLD}Oh My Agentic Score${RESET} installer\n"
    printf "  ${DIM}${REPO_URL}${RESET}\n"
    printf "\n"

    local os arch
    os=$(detect_os)
    arch=$(detect_arch)
    info "Platform: ${os} / ${arch}"

    local installer
    installer=$(detect_installer 2>/dev/null || echo "none")

    case "$installer" in
        uv)
            info "Found uv (fastest)"
            install_with_uv
            ensure_path "$HOME/.local/bin"
            ;;
        pipx)
            info "Found pipx"
            install_with_pipx
            ensure_path "$HOME/.local/bin"
            ;;
        pip)
            warn "Only pip found. Installing uv first for isolated environment..."
            install_uv_first
            ensure_path "$HOME/.local/bin"
            ;;
        none)
            if detect_python &>/dev/null; then
                info "Python found but no package installer. Installing uv..."
                install_uv_first
            else
                echo ""
                error "Python ${MIN_PYTHON_MAJOR}.${MIN_PYTHON_MINOR}+ is required but not found."
                info "Option 1: Install Python — https://www.python.org/downloads/"
                info "Option 2: Install uv (manages Python for you):"
                info "  curl -LsSf https://astral.sh/uv/install.sh | sh"
                exit 1
            fi
            ensure_path "$HOME/.local/bin"
            ;;
    esac

    verify

    printf "\n"
    info "Get started:"
    printf "  ${BOLD}omas scan${RESET}        # Scan Claude Code sessions\n"
    printf "  ${BOLD}omas report${RESET}      # View your report\n"
    printf "  ${BOLD}omas dashboard${RESET}   # Launch web dashboard\n"
    printf "\n"
}

main "$@"
