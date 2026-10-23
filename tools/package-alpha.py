"""Build a private, allowlisted Forge alpha without touching the installed extension."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MODULES = (
    'mdpf-assignments', 'mdpf-classifier', 'mdpf-controls', 'mdpf-core',
    'mdpf-curated', 'mdpf-drafts', 'mdpf-forge', 'mdpf-inline', 'mdpf-line-organization',
    'mdpf-organize', 'mdpf-organize-view', 'mdpf-review', 'mdpf-rules', 'mdpf-structure',
)
FILES = tuple(sorted([
    *(f'javascript/{name}.mjs' for name in MODULES), 'style.css', 'README.md', 'LICENSE',
    *(f'docs/{name}.md' for name in (
        'installation', 'user-guide', 'troubleshooting', 'known-limitations', 'portability')),
]))
MANIFEST = 'release-manifest.json'
PREFIX = 'mdpf-editor/'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validate_payload(payload, version):
    if set(payload) != set(FILES):
        raise ValueError('Payload differs from the explicit runtime/documentation allowlist')
    if not payload['LICENSE'].startswith(b'MIT License\n') or b'Copyright (c) 2026 MDPF Editor contributors' not in payload['LICENSE']:
        raise ValueError('Missing or unexpected MIT license notice')
    for name, data in payload.items():
        text = data.decode('utf-8-sig')
        if name.endswith('.mjs'):
            # Match source declarations, not quoted UI values such as 'break-import'.
            for target in re.findall(r"^\s*(?:import\s+(?:[^\n;]*?\sfrom\s+)?|export\s+[^\n;]*?\sfrom\s+)['\"]([^'\"]+)['\"]", text, re.MULTILINE):
                if not target.startswith('./'):
                    raise ValueError(f'Non-local module import: {name}: {target}')
                path, _, query = target.partition('?')
                resolved = str(PurePosixPath(name).parent / path)
                if resolved not in payload:
                    raise ValueError(f'Missing module import: {name}: {target}')
                if query != f'v={version}':
                    raise ValueError(f'Module cache version mismatch: {name}: {target}')
        if name == 'javascript/mdpf-forge.mjs':
            styles = re.findall(r"new URL\(['\"]([^'\"]*style\.css[^'\"]*)['\"]", text)
            if styles != [f'../style.css?v={version}']:
                raise ValueError('Stylesheet cache version mismatch or missing release stylesheet')
        if name.endswith('.md'):
            for target in re.findall(r'\]\(([^)]+)\)', text):
                if target.startswith(('http:', 'https:', '#')):
                    continue
                target = target.split('#', 1)[0]
                resolved = str(PurePosixPath(name).parent / target)
                if resolved not in payload:
                    raise ValueError(f'Missing packaged documentation link: {name}: {target}')


def archive_bytes(root=ROOT):
    version = json.loads((root / 'package.json').read_text(encoding='utf-8-sig'))['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+-alpha\.\d+', version):
        raise ValueError('This tool packages private alpha versions only')
    payload = {}
    for name in FILES:
        path = root / name
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError(f'File escapes source root: {name}')
        payload[name] = path.read_bytes()
    validate_payload(payload, version)
    manifest = {
        'formatVersion': 1, 'name': 'mdpf-editor', 'version': version,
        'distribution': 'private-alpha', 'license': 'MIT',
        'files': {name: digest(data) for name, data in sorted(payload.items())},
    }
    payload[MANIFEST] = (json.dumps(manifest, indent=2) + '\n').encode('utf-8')
    return version, payload


def verify_archive(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        expected = {PREFIX + name for name in (*FILES, MANIFEST)}
        if len(names) != len(set(names)) or set(names) != expected:
            raise ValueError('Archive has missing, extra, duplicate or unsafe paths')
        payload = {name[len(PREFIX):]: archive.read(name) for name in names}
    manifest = json.loads(payload.pop(MANIFEST))
    if manifest.get('formatVersion') != 1 or manifest.get('name') != 'mdpf-editor':
        raise ValueError('Invalid release manifest')
    if manifest.get('license') != 'MIT' or manifest.get('distribution') != 'private-alpha':
        raise ValueError('Invalid release license or distribution metadata')
    actual = {name: digest(data) for name, data in sorted(payload.items())}
    if manifest.get('files') != actual:
        raise ValueError('Release checksums do not match')
    validate_payload(payload, manifest['version'])
    return manifest


def verify_lifecycle(path):
    manifest = verify_archive(path)
    with tempfile.TemporaryDirectory(prefix='mdpf-package-check-') as temporary:
        forge = Path(temporary).resolve() / 'forge'
        extensions = forge / 'extensions'
        extensions.mkdir(parents=True)
        sentinel = extensions / 'other-extension.txt'
        sentinel.write_bytes(b'unrelated extension remains unchanged\n')
        before = sentinel.read_bytes()
        with zipfile.ZipFile(path) as archive:
            archive.extractall(extensions)  # Exact allowlist verified before extraction.
        installed = (extensions / 'mdpf-editor').resolve()
        if installed.parent != extensions.resolve():
            raise ValueError('Temporary installation escaped its test directory')
        for name, expected in manifest['files'].items():
            if digest((installed / name).read_bytes()) != expected:
                raise ValueError(f'Installed file mismatch: {name}')
        if {p.relative_to(installed).as_posix() for p in installed.rglob('*') if p.is_file()} != set((*FILES, MANIFEST)):
            raise ValueError('Extracted installation contents differ')
        shutil.rmtree(installed)
        if installed.exists() or sentinel.read_bytes() != before or list(extensions.iterdir()) != [sentinel]:
            raise ValueError('Removal affected another extension')
    return manifest


def build(root=ROOT, output=None):
    version, payload = archive_bytes(root)
    output = Path(output) if output else root / 'dist' / f'mdpf-editor-{version}-forge-private-alpha.zip'
    output.parent.mkdir(parents=True, exist_ok=True)
    # Stable metadata and ordering make identical source produce identical archives.
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(payload.items()):
            info = zipfile.ZipInfo(PREFIX + name, date_time=(2026, 10, 22, 0, 0, 0))
            info.create_system = 3  # Fixed Unix metadata, independent of the builder OS.
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    verify_lifecycle(output)
    checksum = digest(output.read_bytes())
    output.with_suffix('.zip.sha256').write_text(f'{checksum}  {output.name}\n', encoding='utf-8')
    return output, checksum


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', type=Path, help='Verify an existing package and isolated install/removal')
    args = parser.parse_args()
    if args.verify:
        manifest = verify_lifecycle(args.verify)
        print(f"Verified {manifest['version']}: {len(manifest['files'])} files plus manifest; isolated install/removal passed")
    else:
        output, checksum = build()
        print(f'Built and verified: {output}\nSHA-256: {checksum}')


if __name__ == '__main__':
    main()
