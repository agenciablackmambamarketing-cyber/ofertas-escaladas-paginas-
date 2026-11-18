# Ritmo 15 — página de oferta LATAM
Publicado dentro del repositorio `ofertas-escaladas-paginas-`, apartado `/ritmo15/`. Español neutro (es-419).
## Archivos
- `index.html`: página de ventas
- `recursos.html`: muestra gratuita de 3 días (sin el producto de pago)
- `creativos.html`: 6 briefs y copys para anuncios 4:5 y 9:16, **no** publicados
- `checkout.html`: preparación de checkout, deshabilitado sin pasarela
- `config.js`: editar `checkoutUrl` con URL HTTPS real después de hacer QA y `pixelId` solo tras validar privacidad/consentimiento
- `terminos.html`, `aviso.html`, `privacidad.html`: textos sujetos a revisión legal

## QA pré-lançamento
1. Completar razón social, identificación y contacto en legal.
2. Integrar checkout externo y confirmar precio, moneda, entrega y reembolsos por país.
3. Verificar eventos Meta: PageView, ViewContent, InitiateCheckout. No disparar Purchase sin transacción confirmada.
4. Revisar móvil, velocidad, imágenes y links.
5. Subir creativos de campaña solo tras aprobación; ninguna campaña se habilita desde este repositorio.

La fotografía del hero es una foto de ambiente de Unsplash, **no** la persona editorial Valeria Montes. Sustituirla por la imagen propia disponible en el kit antes de lanzar publicidad.
La guía completa de 23 páginas es un entregable privado; **no** debe publicarse en GitHub Pages.
