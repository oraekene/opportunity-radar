#!/usr/bin/env python3
"""
Forwarding wrapper / identical entry point to github_repo_extractor.py
"""
import sys
from pathlib import Path

# Directly import and run github_repo_extractor
import github_repo_extractor

if __name__ == "__main__":
    github_repo_extractor.main()
