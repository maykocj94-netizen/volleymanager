# Ícones do PWA

`icon.svg` é usado no scaffold. Para máxima compatibilidade de instalação
(iOS apple-touch-icon e maskable Android), gere PNGs a partir do SVG:

```bash
# exemplo com sharp-cli ou rsvg-convert / inkscape
npx sharp-cli -i icon.svg -o icon-192.png resize 192 192
npx sharp-cli -i icon.svg -o icon-512.png resize 512 512
```

Depois adicione as entradas PNG no `manifest.icons` em `vite.config.ts`.
