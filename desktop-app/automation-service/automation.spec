# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('agent.py', '.'), ('.env', '.')]
binaries = []
hiddenimports = ['uvicorn.logging', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.http.h11_impl', 'uvicorn.protocols.http.httptools_impl', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.protocols.websockets.websockets_impl', 'uvicorn.protocols.websockets.wsproto_impl', 'uvicorn.lifespan', 'uvicorn.lifespan.on', 'uvicorn.lifespan.off', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.loops.asyncio', 'fastapi', 'fastapi.applications', 'fastapi.routing', 'fastapi.middleware', 'starlette', 'starlette.routing', 'starlette.middleware', 'starlette.middleware.cors', 'pydantic', 'pydantic.fields', 'pydantic_core', 'websockets', 'websockets.legacy', 'websockets.legacy.server', 'dotenv', 'python_dotenv', 'google', 'google.generativeai', 'google.generativeai.types', 'google.ai', 'google.ai.generativelanguage', 'google.api_core', 'google.auth', 'google.protobuf', 'langchain', 'langchain_core', 'langchain_core.language_models', 'langchain_core.messages', 'langchain_core.outputs', 'langchain_google_genai', 'langchain_google_genai.chat_models', 'browser_use', 'browser_use.agent', 'browser_use.agent.service', 'browser_use.browser', 'browser_use.browser.browser', 'browser_use.browser.context', 'browser_use.controller', 'browser_use.dom', 'browser_use.utils', 'playwright', 'playwright.sync_api', 'playwright.async_api', 'playwright._impl', 'playwright._impl._browser', 'playwright._impl._browser_context', 'playwright._impl._page', 'asyncio', 'httpx', 'httpcore', 'anyio', 'sniffio', 'h11', 'certifi', 'charset_normalizer', 'idna', 'urllib3', 'greenlet', 'pyee']
tmp_ret = collect_all('browser_use')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('playwright')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('langchain_google_genai')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('google.generativeai')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='automation',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='automation',
)
