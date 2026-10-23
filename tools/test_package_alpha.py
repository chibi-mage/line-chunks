"""Packaging integrity, reproducibility and temporary lifecycle checks."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('package_alpha', Path(__file__).with_name('package-alpha.py'))
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='mdpf-package-tests-')
        self.addCleanup(self.temporary.cleanup)
        self.path = Path(self.temporary.name) / 'alpha.zip'
        package.build(output=self.path)

    def mutate(self, transform):
        with zipfile.ZipFile(self.path) as archive:
            entries = {name: archive.read(name) for name in archive.namelist()}
        transform(entries)
        with zipfile.ZipFile(self.path, 'w') as archive:
            for name, data in entries.items():
                archive.writestr(name, data)

    def test_exact_files_and_lifecycle(self):
        manifest = package.verify_lifecycle(self.path)
        self.assertEqual(len(manifest['files']), 22)
        self.assertEqual(manifest['distribution'], 'private-alpha')
        self.assertEqual(manifest['license'], 'MIT')
        self.assertIn('LICENSE', manifest['files'])

    def test_missing_license_rejected(self):
        self.mutate(lambda entries: entries.pop('mdpf-editor/LICENSE'))
        with self.assertRaisesRegex(ValueError, 'paths'):
            package.verify_archive(self.path)

    def test_wrong_license_metadata_rejected(self):
        import json
        def replace(entries):
            manifest = json.loads(entries['mdpf-editor/release-manifest.json'])
            manifest['license'] = 'UNLICENSED'
            entries['mdpf-editor/release-manifest.json'] = json.dumps(manifest).encode()
        self.mutate(replace)
        with self.assertRaisesRegex(ValueError, 'license'):
            package.verify_archive(self.path)

    def test_reproducible_build(self):
        second, _ = package.build(output=Path(self.temporary.name) / 'second.zip')
        self.assertEqual(self.path.read_bytes(), second.read_bytes())

    def test_quoted_import_scope_is_not_a_module_declaration(self):
        version, payload = package.archive_bytes()
        payload.pop(package.MANIFEST)
        payload['javascript/mdpf-organize-view.mjs'] += b"\nconst sampleScope = 'break-import';\n"
        package.validate_payload(payload, version)
        payload['javascript/mdpf-organize-view.mjs'] += b"\nimport 'https://example.invalid/module.mjs';\n"
        with self.assertRaisesRegex(ValueError, 'Non-local module import'):
            package.validate_payload(payload, version)

    def test_changed_runtime_rejected(self):
        self.mutate(lambda entries: entries.update({'mdpf-editor/style.css': b'changed'}))
        with self.assertRaisesRegex(ValueError, 'checksums'):
            package.verify_archive(self.path)

    def test_extra_local_data_rejected(self):
        self.mutate(lambda entries: entries.update({'mdpf-editor/local/private.json': b'{}'}))
        with self.assertRaisesRegex(ValueError, 'paths'):
            package.verify_archive(self.path)

    def test_traversal_rejected_before_extraction(self):
        self.mutate(lambda entries: entries.update({'../outside.txt': b'bad'}))
        with self.assertRaisesRegex(ValueError, 'paths'):
            package.verify_lifecycle(self.path)
        self.assertFalse((Path(self.temporary.name) / 'outside.txt').exists())

    def test_missing_module_rejected(self):
        self.mutate(lambda entries: entries.pop('mdpf-editor/javascript/mdpf-core.mjs'))
        with self.assertRaisesRegex(ValueError, 'paths'):
            package.verify_archive(self.path)

    def test_broken_import_rejected(self):
        version, payload = package.archive_bytes()
        payload.pop(package.MANIFEST)
        payload['javascript/mdpf-forge.mjs'] += b"\nimport './missing.mjs?v=0.17.3-alpha.1';\n"
        with self.assertRaisesRegex(ValueError, 'Missing module'):
            package.validate_payload(payload, version)

    def test_cache_version_mismatch_rejected(self):
        version, payload = package.archive_bytes()
        payload.pop(package.MANIFEST)
        payload['javascript/mdpf-forge.mjs'] = payload['javascript/mdpf-forge.mjs'].replace(version.encode(), b'0.0.0-alpha.1')
        with self.assertRaisesRegex(ValueError, 'cache version'):
            package.validate_payload(payload, version)

    def test_broken_documentation_link_rejected(self):
        version, payload = package.archive_bytes()
        payload.pop(package.MANIFEST)
        payload['README.md'] += b'\n[missing](docs/missing.md)\n'
        with self.assertRaisesRegex(ValueError, 'documentation link'):
            package.validate_payload(payload, version)

    def test_stylesheet_cache_version_mismatch_rejected(self):
        version, payload = package.archive_bytes()
        payload.pop(package.MANIFEST)
        payload['javascript/mdpf-forge.mjs'] = payload['javascript/mdpf-forge.mjs'].replace(
            f'../style.css?v={version}'.encode(), b'../style.css?v=stale')
        with self.assertRaisesRegex(ValueError, 'Stylesheet cache version'):
            package.validate_payload(payload, version)


if __name__ == '__main__':
    unittest.main(verbosity=2)
