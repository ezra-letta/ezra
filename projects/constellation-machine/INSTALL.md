# Install — Constellation Machine on Raspberry Pi 5 (8GB)

**Last updated:** April 26, 2026
**Tested on:** Pi 5 8GB, Raspberry Pi OS, Python 3.11+, USB SSD boot
**Why this exists:** the obvious install path (`pip install sentence-transformers`) hard-froze a Pi 5 8GB during PyTorch ARM64 model load. This is the safe path.

## TL;DR

```bash
cd /home/star_and_ves/constellation-data
python3 -m venv .venv
source .venv/bin/activate
pip install --no-cache-dir fastembed sqlite-vec
```

Total install: ~200MB. Will not OOM on a Pi 5.

## Why fastembed instead of sentence-transformers

- **fastembed** uses ONNX Runtime — pure C++ inference, no PyTorch
- **sentence-transformers** pulls in PyTorch — ~2GB ARM64 wheel, load-time RAM spike OOMs the Pi 5
- Embedding quality is comparable (BGE-small-en outscores all-MiniLM-L6-v2 on most retrieval benchmarks)
- ARM64 optimized; cold start ~500ms vs ~2-3s for sentence-transformers
- Default model `BAAI/bge-small-en-v1.5` is also 384-dimensional — drop-in compatible with the existing schema

## Recovery: cleaning up after a failed sentence-transformers install

If you tried `pip install sentence-transformers` and the Pi froze, after rebooting:

```bash
# 1. Stop any running letta server / lettabot before cleanup
sudo systemctl stop letta-server  # or whatever the service is named
ps aux | grep letta              # confirm nothing's running

# 2. Check current memory state
free -h

# 3. Optional: nuke the venv and start fresh
cd /home/star_and_ves/constellation-data
rm -rf .venv

# 4. Clear pip cache (often eats ~2GB of disk after a torch install)
rm -rf ~/.cache/pip
```

You can also leave torch and sentence-transformers installed in the venv and just *not load them* — the code will use fastembed only. The risk is RAM during *model load*, not disk space at rest.

## Full setup

```bash
# 1. Create the data directory
mkdir -p /home/star_and_ves/constellation-data
cd /home/star_and_ves/constellation-data

# 2. Create venv
python3 -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install --no-cache-dir fastembed sqlite-vec pyyaml

# 4. First-run model download (~80MB for BGE-small)
python3 -c "from fastembed import TextEmbedding; m = TextEmbedding('BAAI/bge-small-en-v1.5'); list(m.embed(['warmup']))"

# 5. Initialize schema
sqlite3 memory.sqlite < /path/to/constellation-machine/schema.sql

# 6. Verify sqlite-vec loads
python3 -c "import sqlite3, sqlite_vec; c=sqlite3.connect(':memory:'); c.enable_load_extension(True); sqlite_vec.load(c); print('ok')"
```

## Pi-specific gotchas

### Avoid OOM during operations

```bash
# Stop letta server before any heavy install (gives you the full 8GB)
sudo systemctl stop letta-server
# install / index / etc.
sudo systemctl start letta-server
```

### Add real swap (one-time, helpful baseline)

Pi OS default swap is 100MB. Bump to 4GB:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=4096/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
free -h   # confirm 4GB swap
```

This won't make heavy installs *fast*, but it makes them *survivable* instead of OOM-killing the kernel.

### Watch the SD/SSD wear

Heavy swap use writes a lot to your USB SSD. Don't leave the Pi swap-thrashing for hours — kill the offending process.

## Daemon setup (recommended)

Cold-start latency matters during live RPG scenes. Run fastembed in a daemon to keep the model warm.

A minimal daemon with a Unix socket: see `scripts/daemon.py` (sketch). Run as a user systemd unit:

```ini
# ~/.config/systemd/user/constellation-daemon.service
[Unit]
Description=Constellation Machine embedding daemon

[Service]
Type=simple
WorkingDirectory=/home/star_and_ves/constellation-data
ExecStart=/home/star_and_ves/constellation-data/.venv/bin/python -m constellation.daemon
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now constellation-daemon
```

## Verifying it works

```bash
source .venv/bin/activate
python3 -c "
from fastembed import TextEmbedding
m = TextEmbedding('BAAI/bge-small-en-v1.5')
v = list(m.embed(['hello world']))[0]
print(f'Got {len(v)}-dim vector, first 3 values: {v[:3]}')
"
```

Should print `Got 384-dim vector, first 3 values: [...]`. If you get this, you're ready for indexing.
