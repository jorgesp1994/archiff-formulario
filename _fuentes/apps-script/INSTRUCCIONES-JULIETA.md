# Instalar el script de fichas de matrícula — Parte de Julieta

Tiempo: unos 10 minutos. Hazlo con tu cuenta julieta@archiff.com.

## 1. Crear una clave de HubSpot solo para el script
1. HubSpot › ⚙️ Configuración › Desarrollo › Claves › **Claves de servicio** › **Crear una clave de servicio**.
2. Nombre: `Script fichas de matrícula`.
3. Permisos (alcances): `crm.objects.contacts.read` y `crm.objects.contacts.write`.
4. Crear y **copiar** la clave (empieza por `pat-`). Tenla a mano para el paso 3.

## 2. Crear el proyecto
1. Entra en **https://script.google.com** › **Nuevo proyecto**.
2. Arriba a la izquierda, cambia "Proyecto sin título" por `Fichas de matrícula Archiff`.
3. Borra todo lo que hay en `Código.gs` y pega el contenido completo del archivo
   `_fuentes/apps-script/Codigo.gs` (te lo paso yo).
4. Pulsa el icono de **guardar** 💾.

## 3. Guardar los ajustes secretos (Propiedades del script)
1. Menú de la izquierda: ⚙️ **Configuración del proyecto**.
2. Baja hasta **Propiedades del script** › **Añadir propiedad del script**, y crea estas cuatro:

| Propiedad | Valor |
|---|---|
| `SECRET` | el código secreto que te paso yo |
| `HUBSPOT_TOKEN` | la clave de HubSpot del paso 1 |
| `CARPETA_ID` | `17MrVklqVubL08mYmZx9ACR6EiFYrBxE8` |
| `AVISO_ERRORES` | `julieta@archiff.com` |

3. Pulsa **Guardar propiedades del script**.

## 4. Compartir el proyecto con Vero
1. Arriba a la derecha, icono de **compartir** (persona con +).
2. Escribe `vferrer@archiff.com`, rol **Editor**, y envía.
3. Pásale a Vero sus instrucciones (`INSTRUCCIONES-VERO.md`).
