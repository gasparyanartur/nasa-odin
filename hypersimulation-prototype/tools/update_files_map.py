# AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
"""Refresh the byte-length map in scene.json after a data file was edited.

Run: python3 -I tools/update_files_map.py app/public/data
"""
import json
import os
import sys


def main(data_dir):
    scene_path = os.path.join(data_dir, "scene.json")
    with open(scene_path, encoding="utf-8") as f:
        scene = json.load(f)
    files = {}
    for root, _dirs, names in os.walk(data_dir):
        for name in sorted(names):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, data_dir).replace(os.sep, "/")
            if rel == "scene.json" or name.startswith("."):
                continue
            files[rel] = os.path.getsize(full)
    scene["files"] = dict(sorted(files.items()))
    with open(scene_path, "w", encoding="utf-8") as f:
        json.dump(scene, f, indent=1)
        f.write("\n")
    print(len(files), "files listed")


if __name__ == "__main__":
    main(sys.argv[1])
