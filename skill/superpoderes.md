---
name: superpoderes
description: Configura y verifica los superpoderes de Forja+, incluido el Blindaje anti-invento con base de conocimiento y entrega a humano.
---

# Superpoderes de Forja+

Ayuda al dueño a encender y comprobar las capacidades Pro de su bot. Habla en español
sencillo y haz **una sola pregunta por mensaje**. Nunca declares una función activa solo
porque existe en el código: comprueba configuración, datos y una prueba real.

## Antes de empezar

1. Lee `CLAUDE.md`, `wrangler.toml` y `skill/references/starter-vs-forja-plus.md` si existe.
2. Confirma que `BOT_TIER = "pro"`. Si el bot es Starter, explica que requiere Forja+ y no
   cambies el tier manualmente.
3. Pregunta qué superpoder quiere configurar. Si pide el Blindaje anti-invento, sigue el
   flujo obligatorio de abajo.
4. Nunca pegues secretos en archivos o en el chat. Usa `wrangler secret put`.
5. No hagas deploy sin confirmación del usuario.

## Blindaje anti-invento

El blindaje depende de que la fuente de verdad esté completa. **La primera pregunta debe ser:**

> ¿Tu base de conocimiento ya está completa con servicios o productos, precios, horarios,
> políticas, ubicación y las situaciones en que el bot debe pasarte la conversación?

Espera la respuesta antes de continuar.

### Si responde que no

- No actives ni declares verificado el blindaje.
- Abre `/admin/kb` y ayuda a completar la información faltante, una categoría por vez.
- Explica: el blindaje evita inventos comparando la respuesta con esa base; una base vacía
  solo hará que el bot entregue demasiadas conversaciones a un humano.
- Cuando termine, vuelve a hacer la pregunta de confirmación.

### Si responde que sí

Comprueba, en este orden:

1. La D1 remota contiene documentos de conocimiento y Vectorize está indexado.
2. `searchKb` no figura en `disabled_tools` y está disponible para el agente.
3. `handoffHuman` está disponible y crea un ticket en D1.
4. Hay por lo menos un canal de aviso al dueño configurado. Si no lo hay, el ticket sigue
   existiendo, pero avisa claramente que nadie recibirá la alerta inmediata.
5. El prompt exige buscar evidencia antes de afirmar precios, horarios, servicios,
   disponibilidad, políticas o promesas. Sin evidencia suficiente debe decir que necesita
   confirmarlo y llamar `handoffHuman`.

No inventes nombres de settings. Inspecciona el código y el esquema de esta versión antes de
escribir en D1. En la plantilla actual, el blindaje es un comportamiento central del agente,
no un interruptor booleano independiente: queda operativo cuando KB, `searchKb` y el handoff
están sanos.

### Prueba obligatoria

Haz dos pruebas desde el Playground o un canal de prueba:

- **Dato conocido:** pregunta un precio, horario o política que sí esté en la KB. Debe buscar
  evidencia y responder de forma consistente con ella.
- **Dato desconocido:** pide un precio, descuento, disponibilidad o promesa que no esté en la
  KB. Debe evitar afirmarlo, explicar que lo confirmará y entregar la conversación a humano.

Después verifica el registro de herramientas y el ticket, no solo el texto visible. Si alguna
prueba falla, no digas que el blindaje está activo; reporta el punto exacto y corrígelo antes
de repetir ambas pruebas.

### Confirmación al dueño

Solo tras pasar las dos pruebas, confirma:

> Blindaje anti-invento activo y verificado. Lo notarás porque el bot responderá normalmente
> cuando encuentre respaldo en tu base; cuando no tenga evidencia suficiente, no adivinará:
> dirá que necesita confirmarlo y te entregará la conversación con un ticket.

Aclara que ningún sistema probabilístico garantiza literalmente cero errores; esta protección
reduce el riesgo mediante evidencia, reglas y entrega humana, y depende de mantener la KB al día.

## Los demás superpoderes

Para cualquier otra capacidad, aplica la misma disciplina: identifica su implementación real,
confirma dependencias, configura sin exponer secretos, prueba el caso feliz y el caso de fallo,
y solo entonces márcala como activa. Si esta versión del bot no trae la implementación, no la
simules: indica que necesita actualizarse con `/actualizar-mi-bot`.
