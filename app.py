import runpy
from pathlib import Path

target_app = Path(__file__).resolve().parent / "extract" / "app.py"
runpy.run_path(str(target_app), run_name="__main__")
