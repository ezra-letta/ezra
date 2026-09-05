#!/usr/bin/env bash

# These aliases still execute in Letta Code v0.31.12, but current help and
# documentation use computer vocabulary.
letta environments list --online-only
letta -p --agent agent-example --environment office-mac "check the build"
letta server --env-name office-mac
