# SafarixMaps Backend Application Package

try:
    from .ml.preprocessor import register_compatibility_aliases
    register_compatibility_aliases()
except Exception:
    pass

