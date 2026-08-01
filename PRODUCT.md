# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hawk Guru vende y opera una suite para Realtors y pequeños equipos inmobiliarios que reciben prospectos por WhatsApp, redes sociales, anuncios y Open Houses. El usuario necesita convertir conversaciones dispersas en una siguiente acción visible sin perder el control humano.

## Product Purpose

Hawk Guru Realtor Suite centraliza conversaciones, califica intención de compra, venta o renta, y organiza oportunidades en pipelines para que un Realtor responda y haga seguimiento a tiempo.

## Positioning

La suite une un AI Concierge de canales con un sistema operativo Realtor: calificación guiada con botones, pipeline, Market Intel de listings verificados, Open House con QR y un Marketing Compliance Copilot que no publica ni responde leads.

## Operating Context

El producto opera sobre Cloudflare con D1, Durable Objects, Vectorize y R2. Kapso/WhatsApp puede entregar conversaciones al concierge. Los Realtors revisan leads, fichas de propiedad, Open Houses, borradores de marketing y acciones sugeridas desde el dashboard.

## Capabilities and Constraints

- Buyer, Seller y Renter pipelines con score, tags, evidencia y siguiente acción.
- Calificación Realtor guiada y Open House QR separados por propiedad.
- Listings verificados: el bot y el Marketing Copilot no deben afirmar disponibilidad, precio ni características que no estén confirmadas.
- Marketing Copilot crea borradores MLS, social, Reel, Open House y Meta Ads; requiere aprobación humana y no publica ni envía mensajes.
- Follow-ups, campañas, calendario y canales externos conservan reglas de aprobación y configuración independiente.
- La landing es una pieza local de venta; no se integra ni despliega como parte del Worker actual.

## Brand Commitments

Nombre: Hawk Guru Realtor Suite. Voz directa, profesional y orientada a la operación. La marca existente usa un entorno oscuro con verde lima y lenguaje de command center; no se deben fabricar métricas, clientes, ventas ni integraciones activas.

## Evidence on Hand

El repositorio contiene la suite funcional, rutas de dashboard, módulo de Open Houses, calificación, Marketing Compliance Copilot y conexiones de canal. No hay testimonios, precios, logos de clientes ni resultados cuantificados autorizados para la landing.

## Product Principles

- La automatización organiza y acelera; el Realtor aprueba lo importante.
- Cada lead y visitante debe pertenecer a su propiedad y etapa correcta.
- Las afirmaciones de marketing se basan en hechos verificados.
- El valor comercial debe ser comprensible en una sola pantalla.

## Accessibility & Inclusion

La landing debe ser responsive, tener contraste legible, navegación por teclado, formularios etiquetados y un lenguaje inmobiliario inclusivo.
