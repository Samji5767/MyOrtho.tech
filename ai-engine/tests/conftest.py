"""
Pytest configuration for AI engine unit tests.

Stubs out torch, monai, and trimesh before any src.* imports so the
tests can run in environments where the heavy ML stack is not installed
(CI, code review containers, etc.).

The stubs provide just enough surface area for the test-exercised code paths.
They do NOT simulate real inference — that happens inside Docker with GPU.
"""
import sys
import types


# ── torch stub ────────────────────────────────────────────────────────────────

class _FakeTensor:
    def __init__(self, data=None):
        self._data = data or []

    def cpu(self):
        return self

    def numpy(self):
        import numpy as np
        return np.zeros((1, 33, 16, 16, 16), dtype="float32")

    def to(self, device):
        return self


class _FakeCuda:
    @staticmethod
    def is_available():
        return False


class _FakeDevice:
    def __init__(self, name):
        self.type = name

    def __str__(self):
        return self.type


_torch = types.ModuleType("torch")
_torch.cuda = _FakeCuda()
_torch.device = _FakeDevice
_torch.no_grad = lambda: __import__("contextlib").nullcontext()
_torch.Tensor = _FakeTensor  # used as type hint in segmentation.py

def _fake_from_numpy(arr):
    t = _FakeTensor(arr)
    return t

_torch.from_numpy = _fake_from_numpy
_torch.softmax = lambda t, dim: t
_torch.argmax = lambda t, dim: t
sys.modules["torch"] = _torch

# ── monai stub ────────────────────────────────────────────────────────────────

_monai = types.ModuleType("monai")
_monai_nets = types.ModuleType("monai.networks")
_monai_nets_nets = types.ModuleType("monai.networks.nets")


class _FakeUNet:
    def __init__(self, **kwargs):
        pass

    def to(self, device):
        return self

    def eval(self):
        return self

    def __call__(self, x):
        return _FakeTensor()

    def load_state_dict(self, state, strict=True):
        pass


_monai_nets_nets.UNet = _FakeUNet
sys.modules["monai"] = _monai
sys.modules["monai.networks"] = _monai_nets
sys.modules["monai.networks.nets"] = _monai_nets_nets

# ── trimesh stub ──────────────────────────────────────────────────────────────

import numpy as np


class _FakeTrimesh:
    is_watertight = False
    is_winding_consistent = True
    is_manifold = False
    faces = np.zeros((0, 3), dtype=int)
    vertices = np.zeros((0, 3), dtype=float)
    extents = np.array([80.0, 60.0, 25.0])
    area_faces = np.array([1.0])
    edges_sorted = np.zeros((0, 2), dtype=int)
    boundary_edges = np.zeros((0, 2), dtype=int)

    def voxelized(self, pitch):
        class _V:
            filled = np.zeros((128, 128, 128), dtype="float32")
        return _V()

    def copy(self):
        return _FakeTrimesh()

    def subdivide(self):
        return _FakeTrimesh()

    def invert(self):
        pass

    def export(self, path, **kwargs):
        pass

    def split(self, only_watertight=True):
        return [self]

    @property
    def vertex_normals(self):
        return np.zeros((0, 3))


class _FakeScene:
    geometry = {}


_trimesh_mod = types.ModuleType("trimesh")
_trimesh_mod.Trimesh = _FakeTrimesh
_trimesh_mod.Scene = _FakeScene

_trimesh_util = types.ModuleType("trimesh.util")
_trimesh_util.concatenate = lambda meshes: _FakeTrimesh()

def _fake_load(path, force=None):
    return _FakeTrimesh()

_trimesh_mod.load = _fake_load
_trimesh_mod.util = _trimesh_util
sys.modules["trimesh"] = _trimesh_mod
sys.modules["trimesh.util"] = _trimesh_util

# scipy stub (used by some sub-modules)
_scipy = types.ModuleType("scipy")
_scipy_spatial = types.ModuleType("scipy.spatial")
sys.modules.setdefault("scipy", _scipy)
sys.modules.setdefault("scipy.spatial", _scipy_spatial)
