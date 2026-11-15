#!/usr/bin/env python3
"""Valida a interface dos menus do Neon Rush com Playwright + screenshots."""

from __future__ import annotations

import http.server
import socketserver
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tools" / "ui-shots"
PORT = 8765
BASE = f"http://127.0.0.1:{PORT}/index.html"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):  # noqa: A003
        pass


def start_server():
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), QuietHandler)
    httpd.allow_reuse_address = True
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def must_visible(page, selector: str, label: str, checks: list[str]):
    loc = page.locator(selector).first
    if loc.count() == 0:
        checks.append(f"FAIL: {label} não encontrado ({selector})")
        return False
    if not loc.is_visible():
        checks.append(f"FAIL: {label} existe mas não está visível")
        return False
    checks.append(f"OK: {label}")
    return True


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    httpd = start_server()
    checks: list[str] = []
    time.sleep(0.3)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.goto(BASE, wait_until="domcontentloaded", timeout=60000)
            # Babylon/CDN: dá um tempo pro hub montar
            page.wait_for_selector("#mainMenu.show", timeout=30000)
            page.wait_for_timeout(2500)

            must_visible(page, "#mainMenu.show", "Hub principal", checks)
            must_visible(page, "#btnStartRace", "Botão JOGAR", checks)
            must_visible(page, "#btnTrackSwitch", "Trocar pista", checks)
            must_visible(page, "#btnGarage", "Garagem", checks)
            must_visible(page, "#btnShop", "Loja", checks)
            must_visible(page, "#moneyLabel", "Moedas", checks)
            must_visible(page, "#carsCollectionLabel", "Contador de carros", checks)
            must_visible(page, "#winsLabel", "Vitórias", checks)

            track = page.locator("#trackNameLabel").inner_text().strip()
            checks.append(f"INFO: pista atual = {track or '(vazio)'}")

            page.screenshot(path=str(OUT / "01-hub.png"), full_page=True)

            # Garagem
            page.locator("#btnGarage").click()
            page.wait_for_selector("#garagePanel.show", timeout=10000)
            must_visible(page, "#garagePanel.show", "Painel da garagem", checks)
            must_visible(page, "#btnGaragePrev", "Seta garagem anterior", checks)
            must_visible(page, "#btnGarageNext", "Seta garagem próxima", checks)
            must_visible(page, "#garageCarName", "Nome do carro na garagem", checks)
            page.wait_for_timeout(800)
            page.screenshot(path=str(OUT / "02-garage.png"), full_page=True)
            page.locator("#btnRace").click()
            page.wait_for_selector("#garagePanel.show", state="hidden", timeout=10000)

            # Loja
            page.locator("#btnShop").click()
            page.wait_for_selector("#shopPanel.show", timeout=10000)
            must_visible(page, "#shopPanel.show", "Painel da loja", checks)
            must_visible(page, "#btnShopBuy", "Botão Comprar", checks)
            must_visible(page, "#shopCarName", "Nome da oferta", checks)
            offer = page.locator("#shopCarName").inner_text().strip()
            checks.append(f"INFO: oferta da loja = {offer or '(vazio)'}")
            page.wait_for_timeout(800)
            page.screenshot(path=str(OUT / "03-shop.png"), full_page=True)
            page.locator("#btnRace").click()
            page.wait_for_selector("#shopPanel.show", state="hidden", timeout=10000)

            # Troca de pista (sem reload no Cursor; no Chromium também usa rebuild)
            before = page.locator("#trackNameLabel").inner_text().strip()
            page.locator("#btnTrackSwitch").click()
            page.wait_for_timeout(1500)
            after = page.locator("#trackNameLabel").inner_text().strip()
            if before and after and before != after:
                checks.append(f"OK: troca de pista ({before} -> {after})")
            else:
                checks.append(
                    f"FAIL: troca de pista nao mudou o rotulo ({before!r} -> {after!r})"
                )
            page.screenshot(path=str(OUT / "04-track-switched.png"), full_page=True)

            browser.close()
    finally:
        httpd.shutdown()

    report = OUT / "report.txt"
    text = "\n".join(checks) + "\n"
    report.write_text(text, encoding="utf-8")
    failed = [c for c in checks if c.startswith("FAIL:")]
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"))
    print(f"Screenshots: {OUT}")
    print(f"Report: {report}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    run()
