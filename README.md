# CF Submit Extension

Extensión de navegador que permite **enviar soluciones a Codeforces
directamente desde una plataforma externa**.

Este proyecto actúa como puente entre una plataforma local de práctica y
Codeforces.\
Automatiza el flujo de envío abriendo la página oficial de envío,
llenando el formulario, enviando la solución y devolviendo el veredicto
a la plataforma.

## Propósito del repositorio

La extensión demuestra que es técnicamente posible **enviar soluciones a
Codeforces desde un entorno externo** sin que el usuario tenga que
copiar y pegar el código manualmente en la página de Codeforces.

Funciona junto con la plataforma:

https://github.com/Electromayonaise/cf-submit-extension

y permite que un entorno local de práctica se comporte de forma similar
a un sistema de juez en línea.

## Cómo funciona

1.  La plataforma envía un mensaje `CF_SUBMIT` que contiene:

    -   contestId
    -   problemIndex
    -   código fuente
    -   id del lenguaje

2.  La extensión:

    -   Abre la página de envío de Codeforces en una pestaña en segundo
        plano.
    -   Espera a que el editor cargue.
    -   Inserta el código y el lenguaje seleccionado.
    -   Espera la verificación de Cloudflare Turnstile si aparece.
    -   Presiona el botón de envío.

3.  Después del envío:

    -   La extensión obtiene el id de la submission.
    -   Consulta periódicamente la API de Codeforces (`user.status`)
        para detectar el veredicto.
    -   Envía el resultado de vuelta a la plataforma.
    -   Cierra automáticamente la pestaña de envío.

## Funcionalidades

-   Envío automático de soluciones a Codeforces
-   Obtención automática del veredicto
-   Envío en pestaña en segundo plano (no interrumpe al usuario)
-   Integración mediante `window.postMessage`
-   No requiere manejar credenciales

## Estructura del proyecto

content script

-   Interactúa con la página de Codeforces
-   Llena el formulario de envío
-   Obtiene el id de la submission

background script

-   Abre las pestañas de envío
-   Enruta mensajes entre la plataforma y el content script
-   Cierra las pestañas después del envío

## Limitaciones

La implementación actual tiene varias limitaciones.

### 1. Dependencia del navegador

El sistema requiere una extensión de navegador.\
Esto significa que los envíos no pueden realizarse completamente desde
el servidor.

### 2. Dependencia de la estructura de la página

La extensión depende de la estructura actual del DOM de la página de
envío de Codeforces.\
Si Codeforces cambia el diseño de la página, algunos selectores pueden
dejar de funcionar.

### 3. Mecanismos anti‑bot

Las protecciones de Cloudflare pueden requerir verificación manual si la
sesión del navegador no es considerada confiable.

### 4. Consulta periódica de la API

Los veredictos se obtienen consultando la API periódicamente, lo que
introduce un pequeño retraso entre el envío y la detección del
resultado.

### 5. Sesión iniciada requerida

El usuario debe estar previamente autenticado en Codeforces dentro del
navegador.

## Consideraciones de seguridad

La extensión **no maneja contraseñas ni procesos de login**.\
Simplemente utiliza la sesión activa del usuario en Codeforces dentro
del navegador.

## Conclusión

Esta extensión demuestra que **es técnicamente posible enviar soluciones
a Codeforces desde una plataforma externa** respetando el flujo oficial
del sitio.

En lugar de evitar o saltarse Codeforces, la extensión actúa como una
capa de automatización que:

-   utiliza la interfaz oficial de envío
-   mantiene la autenticación dentro del navegador
-   obtiene los veredictos mediante la API pública

Este enfoque ofrece un camino realista para integrar Codeforces en
herramientas educativas externas.
