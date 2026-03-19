# Export PDF

Raportul poate fi exportat in PDF in doua moduri.

## Varianta 1: VS Code

Extensia recomandata pentru export este `Markdown PDF` (`yzane.markdown-pdf`).

1. Deschide fisierul [PROJECT_AUDIT.md](./PROJECT_AUDIT.md) in VS Code.
2. Apasa `Ctrl+Shift+P`.
3. Ruleaza comanda `Markdown PDF: Export (pdf)`.
4. PDF-ul se genereaza in acelasi folder `docs/`.

## Varianta 2: script din proiect

Din radacina proiectului:

```bash
npm run docs:pdf
```

Acest script exporta [PROJECT_AUDIT.md](./PROJECT_AUDIT.md) in PDF folosind tema albastra din `docs/pdf-theme.css`.

## Configurare

- recomandarea de extensie este in `.vscode/extensions.json`
- stilul PDF este in [pdf-theme.css](./pdf-theme.css)
- setarile pentru exportul din VS Code sunt in `.vscode/settings.json`
- scriptul CLI de export este in `package.json` ca `docs:pdf`

## Fisier principal pentru export

- [PROJECT_AUDIT.md](./PROJECT_AUDIT.md)
