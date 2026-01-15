#!/usr/bin/env bash
#
# docTOmd Skill Installation Script
#
# Usage:
#   ./install.sh          # Install for current user
#   ./install.sh --force  # Force install even if same version
#

set -e

SKILL_NAME="docTOmd"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SOURCE="$SCRIPT_DIR/$SKILL_NAME"
SKILLS_DIR="$HOME/.claude/skills"
INSTALLED_SKILL="$SKILLS_DIR/$SKILL_NAME"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
FORCE_INSTALL=false
for arg in "$@"; do
    case $arg in
        --force) FORCE_INSTALL=true ;;
    esac
done

echo -e "${BLUE}docTOmd Skill Installer${NC}"
echo "=================================="
echo ""

# Check if skill source exists
if [ ! -d "$SKILL_SOURCE" ]; then
    echo -e "${RED}Error: Skill directory not found at $SKILL_SOURCE${NC}"
    exit 1
fi

# Get source version
SOURCE_VERSION="unknown"
if [ -f "$SKILL_SOURCE/VERSION" ]; then
    SOURCE_VERSION=$(cat "$SKILL_SOURCE/VERSION" | tr -d '[:space:]')
fi
echo -e "Source version: ${CYAN}$SOURCE_VERSION${NC}"

# Check prerequisites
echo ""
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Bun
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: Bun is not installed${NC}"
    echo "Install with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Bun $(bun --version)"

# Check Python3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Python $(python3 --version | cut -d' ' -f2)"

# Check Docling
DOCLING_PATH=""
for path in "docling" "$HOME/Library/Python/3.9/bin/doctomd" "$HOME/Library/Python/3.10/bin/doctomd" "$HOME/Library/Python/3.11/bin/doctomd" "$HOME/Library/Python/3.12/bin/doctomd" "$HOME/.local/bin/doctomd" "/usr/local/bin/doctomd"; do
    if command -v "$path" &> /dev/null 2>&1 || [ -x "$path" ]; then
        DOCLING_PATH="$path"
        break
    fi
done

if [ -z "$DOCLING_PATH" ]; then
    echo -e "  ${YELLOW}!${NC} Docling not found"
    echo ""
    echo "Docling is required. Install with:"
    echo "  pip3 install \"docling>=2.67.0\""
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    DOCLING_VERSION=$("$DOCLING_PATH" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
    echo -e "  ${GREEN}✓${NC} Docling $DOCLING_VERSION"
fi

echo ""

# Create skills directory
mkdir -p "$SKILLS_DIR"

# Check if skill already exists and compare versions
if [ -d "$INSTALLED_SKILL" ]; then
    INSTALLED_VERSION="unknown"
    if [ -f "$INSTALLED_SKILL/VERSION" ]; then
        INSTALLED_VERSION=$(cat "$INSTALLED_SKILL/VERSION" | tr -d '[:space:]')
    fi

    echo -e "Installed version: ${CYAN}$INSTALLED_VERSION${NC}"
    echo ""

    # Compare versions
    if [ "$SOURCE_VERSION" = "$INSTALLED_VERSION" ]; then
        if [ "$FORCE_INSTALL" = true ]; then
            echo -e "${YELLOW}Same version already installed. Force reinstalling...${NC}"
        else
            echo -e "${GREEN}✓ Version $INSTALLED_VERSION is already installed.${NC}"
            echo ""
            echo "Use --force to reinstall the same version."
            exit 0
        fi
    elif [ "$INSTALLED_VERSION" = "unknown" ]; then
        echo -e "${YELLOW}Existing installation found (version unknown).${NC}"
        read -p "Upgrade to version $SOURCE_VERSION? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Installation aborted."
            exit 0
        fi
    else
        # Version comparison using sort -V
        HIGHER_VERSION=$(printf '%s\n%s' "$SOURCE_VERSION" "$INSTALLED_VERSION" | sort -V | tail -n1)

        if [ "$HIGHER_VERSION" = "$SOURCE_VERSION" ]; then
            echo -e "${YELLOW}Upgrade available: $INSTALLED_VERSION → $SOURCE_VERSION${NC}"
            read -p "Upgrade to version $SOURCE_VERSION? (Y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Nn]$ ]]; then
                echo "Installation aborted."
                exit 0
            fi
        else
            echo -e "${RED}Warning: Source version ($SOURCE_VERSION) is older than installed ($INSTALLED_VERSION)${NC}"
            read -p "Downgrade to version $SOURCE_VERSION? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Installation aborted."
                exit 0
            fi
        fi
    fi

    # Remove existing installation
    echo -e "${YELLOW}Removing existing installation...${NC}"
    rm -r "$INSTALLED_SKILL"
fi

# Copy skill
echo -e "${YELLOW}Installing skill v$SOURCE_VERSION...${NC}"
cp -r "$SKILL_SOURCE" "$SKILLS_DIR/"

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$INSTALLED_SKILL"
bun install

echo ""
echo -e "${GREEN}Installation complete!${NC} Version ${CYAN}$SOURCE_VERSION${NC} installed."
echo ""
echo "Usage:"
echo "  - Slash command: /doctomd"
echo "  - Natural language: \"Convert document.pdf to markdown\""
echo "  - Direct: bun run ~/.claude/skills/docTOmd/Tools/Convert.ts <file>"
echo ""
echo "For more information, see: $SCRIPT_DIR/README.md"
